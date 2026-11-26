import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  ExternalLink,
  MessageCircle,
  Building,
  MapPin,
  Edit2,
  X,
  Filter,
  CheckCircle2,
  RefreshCw,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

const CATEGORIES = [
  { id: 'ALL', label: 'All Providers' },
  { id: 'Catering', label: 'Catering' },
  { id: 'Floral & Decor', label: 'Floral & Decor' },
  { id: 'Photography & Video', label: 'Photography & Video' },
  { id: 'Sound & Lighting', label: 'Sound & Lighting' },
  { id: 'Music & DJ', label: 'Music & DJ' },
  { id: 'Venue', label: 'Venue' },
  { id: 'Transport', label: 'Transport' },
  { id: 'Hospitality', label: 'Hospitality' },
  { id: 'Other', label: 'Other' }
];

export default function CompanyPartnersPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [formData, setFormData] = useState({
    businessName: '',
    contactPerson: '',
    phone: '',
    email: '',
    category: 'Catering',
    coverageAreas: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const loadPartners = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const res = await api.getPartners();
      if (res?.data?.partners) {
        setPartners(res.data.partners);
      } else if (Array.isArray(res?.data)) {
        setPartners(res.data);
      } else {
        setPartners([]);
      }
    } catch (err) {
      console.error('Failed to load external providers:', err);
      toast.error('Unable to retrieve external providers directory.');
      setPartners([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  const handleOpenAdd = () => {
    setEditingPartner(null);
    setFormData({
      businessName: '',
      contactPerson: '',
      phone: '',
      email: '',
      category: 'Catering',
      coverageAreas: '',
      notes: ''
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (partner) => {
    setEditingPartner(partner);
    const cat = Array.isArray(partner.serviceCategories) && partner.serviceCategories.length > 0
      ? partner.serviceCategories[0]
      : partner.category || 'Other';

    const cov = Array.isArray(partner.coverageAreas)
      ? partner.coverageAreas.join(', ')
      : partner.coverageAreas || '';

    setFormData({
      businessName: partner.businessName || '',
      contactPerson: partner.contactPerson || '',
      phone: partner.phone || '',
      email: partner.email || '',
      category: cat,
      coverageAreas: cov,
      notes: partner.notes || ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.businessName.trim() || !formData.phone.trim()) {
      toast.error('Please enter the provider business name and phone number.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        businessName: formData.businessName.trim(),
        name: formData.businessName.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        serviceCategories: [formData.category],
        category: formData.category,
        coverageAreas: formData.coverageAreas.split(',').map((s) => s.trim()).filter(Boolean),
        notes: formData.notes.trim() || null
      };

      if (editingPartner) {
        await api.updatePartner(editingPartner.id, payload);
        toast.success(`Updated contact for ${payload.businessName}.`);
      } else {
        await api.createPartner(payload);
        toast.success(`Added ${payload.businessName} to provider directory.`);
      }

      setModalOpen(false);
      loadPartners(true);
    } catch (err) {
      console.error('Failed to save provider contact:', err);
      toast.error(err.message || 'Failed to save provider contact.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper: clean phone for WhatsApp link
  const formatWhatsAppUrl = (phone) => {
    if (!phone) return null;
    const cleanDigits = phone.replace(/[^0-9]/g, '');
    // If starts with 09..., replace leading 0 with 251 for Ethiopia
    const international = cleanDigits.startsWith('09')
      ? `251${cleanDigits.slice(1)}`
      : cleanDigits;
    return `https://wa.me/${international}`;
  };

  const filteredPartners = partners.filter((p) => {
    const pCat = Array.isArray(p.serviceCategories) && p.serviceCategories.length > 0
      ? p.serviceCategories[0]
      : p.category || 'Other';

    if (selectedCategory !== 'ALL' && pCat.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = p.businessName?.toLowerCase().includes(q);
      const matchContact = p.contactPerson?.toLowerCase().includes(q);
      const matchPhone = p.phone?.toLowerCase().includes(q);
      const matchCat = pCat.toLowerCase().includes(q);
      if (!matchName && !matchContact && !matchPhone && !matchCat) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-slate-800 text-left">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <Link to="/company/dashboard" className="hover:text-[#B95650] transition-colors">
              Company Portal
            </Link>
            <span>•</span>
            <span className="text-slate-700 font-semibold">External Providers</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            External Provider & Contact Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manual external partner coordination via direct Phone, WhatsApp, and Email. Coordinators directly verify arrangements and enter approved quotes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPartners(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Provider Contact</span>
          </button>
        </div>
      </div>

      {/* Manual Coordination Notice */}
      <div className="bg-[#FFF8F6] border border-[#E8B5A6]/40 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#B95650] shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 leading-relaxed">
          <span className="font-bold text-[#B95650]">Manual External Coordination Model: </span>
          External partners (caterers, florists, audio technicians, venues) do not have system access or internal availability tracking. Event Coordinators contact providers directly via Phone or WhatsApp to verify availability, negotiate rates, and include verified line items in client quotations.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search providers by business name, contact person, or phone number..."
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#B95650] focus:bg-white transition"
          />
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Provider Cards Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
          Loading external provider contacts...
        </div>
      ) : filteredPartners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-500 space-y-3">
          <Building className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="font-bold text-sm text-slate-800">No external providers found</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {search || selectedCategory !== 'ALL'
              ? 'No contacts match your active search or category filters. Try resetting the filter.'
              : 'Your external provider directory is currently empty. Click "Add Provider Contact" above to register caterers, florists, photographers, and audio engineers.'}
          </p>
          {(search || selectedCategory !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('ALL');
              }}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPartners.map((partner) => {
            const category = Array.isArray(partner.serviceCategories) && partner.serviceCategories.length > 0
              ? partner.serviceCategories[0]
              : partner.category || 'Provider';

            const whatsappUrl = formatWhatsAppUrl(partner.phone);

            return (
              <div
                key={partner.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-4"
              >
                <div>
                  {/* Top Category Badge & Actions */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      {category}
                    </span>
                    <button
                      onClick={() => handleOpenEdit(partner)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                      title="Edit Contact"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Business & Contact Name */}
                  <h3 className="font-extrabold text-slate-900 text-sm leading-snug">
                    {partner.businessName}
                  </h3>
                  {partner.contactPerson && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Contact: <span className="text-slate-700 font-semibold">{partner.contactPerson}</span>
                    </p>
                  )}

                  {/* Coverage area */}
                  {partner.coverageAreas && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {Array.isArray(partner.coverageAreas)
                          ? partner.coverageAreas.join(', ')
                          : partner.coverageAreas}
                      </span>
                    </div>
                  )}

                  {/* Notes / Specialization */}
                  {partner.notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2.5 mt-3 border border-slate-100 leading-relaxed line-clamp-3">
                      {partner.notes}
                    </p>
                  )}
                </div>

                {/* Direct Outreach Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  {partner.phone && (
                    <a
                      href={`tel:${partner.phone}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-600" />
                      <span>Call</span>
                    </a>
                  )}

                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 text-xs font-bold rounded-xl transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp</span>
                    </a>
                  )}

                  {partner.email && (
                    <a
                      href={`mailto:${partner.email}`}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                      title={partner.email}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-left relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-[#B95650]" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingPartner ? 'Edit Provider Contact' : 'Add External Provider Contact'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="py-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Business / Provider Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="e.g. Selam Premium Floral & Decor"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#B95650]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#B95650] cursor-pointer"
                  >
                    {CATEGORIES.filter((c) => c.id !== 'ALL').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="e.g. Dawit Tadesse"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#B95650]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0911234567"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#B95650]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@selamdecor.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#B95650]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Coverage / Location</label>
                <input
                  type="text"
                  value={formData.coverageAreas}
                  onChange={(e) => setFormData({ ...formData, coverageAreas: e.target.value })}
                  placeholder="e.g. Addis Ababa (Bole, Kazanchis, CMC)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#B95650]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Coordination Notes / Standard Rates
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Direct pricing: 45,000 ETB per 100 guest floral setup. Requires 3 days advance notice for fresh roses."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#B95650]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingPartner ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
