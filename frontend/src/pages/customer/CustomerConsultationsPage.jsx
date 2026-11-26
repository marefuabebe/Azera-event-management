import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  MessageSquare,
  Calendar,
  Clock,
  MapPin,
  Video,
  Phone,
  Building,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Mail,
  UserCheck,
  Sparkles,
  FileText
} from 'lucide-react';

// Strict Google Meet validator (accepts authentic Google 3-4-3 conferences and workspace aliases)
const isValidGoogleMeetUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  const official343 = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
  const alias = /^https:\/\/meet\.google\.com\/_meet\/[a-z0-9_-]+$/i;
  return official343.test(trimmed) || alias.test(trimmed);
};

const isConsultationPastDue = (consultation) => {
  if (!consultation || !consultation.scheduledStartTime) return false;
  const finalStatuses = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
  if (finalStatuses.includes(consultation.status)) return false;
  const endTime = consultation.scheduledEndTime
    ? new Date(consultation.scheduledEndTime)
    : new Date(new Date(consultation.scheduledStartTime).getTime() + 60 * 60 * 1000);
  return endTime < new Date();
};

const getEffectiveStatus = (consultation) => {
  if (!consultation) return 'SCHEDULED';
  if (consultation.effectiveStatus) return consultation.effectiveStatus;
  if (isConsultationPastDue(consultation)) return 'NEEDS_FOLLOW_UP';
  return consultation.status || 'SCHEDULED';
};

const formatDateTimeEAT = (dateInput) => {
  if (!dateInput) return 'TBD';
  const d = new Date(dateInput);
  return d.toLocaleString('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }) + ' (EAT)';
};

export default function CustomerConsultationsPage() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('DATE_ASC');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(4);

  // Form State for Scheduling New Consultation
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    return tomorrow.toISOString().split('T')[0];
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [formData, setFormData] = useState({
    bookingId: '',
    coordinatorId: '',
    method: 'OFFICE_MEETING',
    scheduledStartTime: '',
    scheduledEndTime: '',
    locationOrLink: 'Eventora Executive Studios, Bole Medhanialem, Addis Ababa',
    customerVisibleNotes: ''
  });

  // Load consultations and customer bookings from API
  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Fetch consultations from backend
      let items = [];
      try {
        const res = await api.getConsultations();
        if (res?.data?.consultations) {
          items = res.data.consultations;
        }
      } catch (err) {
        console.warn('api.getConsultations error:', err);
      }

      // 2. Fetch customer bookings to link with consultations
      let userBookings = [];
      try {
        const bRes = await api.getMyBookings();
        if (bRes?.data?.bookings && bRes.data.bookings.length > 0) {
          userBookings = bRes.data.bookings;
        }
      } catch (err) {
        console.warn('api.getMyBookings error:', err);
      }

      setBookings(userBookings || []);

      // Default the form bookingId if not selected
      if (!formData.bookingId && userBookings.length > 0) {
        setFormData((prev) => ({
          ...prev,
          bookingId: userBookings[0].id,
          coordinatorId: userBookings[0].assignedCoordinator?.id || ''
        }));
      }

      // Only real consultations from database
      setConsultations(items || []);
    } catch (err) {
      console.error('Error loading consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch Available Slots when selectedDate or coordinator changes
  const loadSlots = async (dateStr, coordId) => {
    try {
      setLoadingSlots(true);
      const res = await api.getConsultationSlots(dateStr, coordId);
      if (res?.data?.slots) {
        setAvailableSlots(res.data.slots);
      } else {
        // Fallback standard EAT business windows
        setAvailableSlots([
          { startTime: `${dateStr}T06:00:00.000Z`, endTime: `${dateStr}T07:00:00.000Z`, label: '09:00 AM - 10:00 AM (EAT)', isAvailable: true },
          { startTime: `${dateStr}T07:30:00.000Z`, endTime: `${dateStr}T08:30:00.000Z`, label: '10:30 AM - 11:30 AM (EAT)', isAvailable: true },
          { startTime: `${dateStr}T11:00:00.000Z`, endTime: `${dateStr}T12:00:00.000Z`, label: '02:00 PM - 03:00 PM (EAT)', isAvailable: true },
          { startTime: `${dateStr}T12:30:00.000Z`, endTime: `${dateStr}T13:30:00.000Z`, label: '03:30 PM - 04:30 PM (EAT)', isAvailable: false },
          { startTime: `${dateStr}T14:00:00.000Z`, endTime: `${dateStr}T15:00:00.000Z`, label: '05:00 PM - 06:00 PM (EAT)', isAvailable: true }
        ]);
      }
    } catch (err) {
      console.warn('Using standard slots fallback:', err);
      setAvailableSlots([
        { startTime: `${dateStr}T06:00:00.000Z`, endTime: `${dateStr}T07:00:00.000Z`, label: '09:00 AM - 10:00 AM (EAT)', isAvailable: true },
        { startTime: `${dateStr}T07:30:00.000Z`, endTime: `${dateStr}T08:30:00.000Z`, label: '10:30 AM - 11:30 AM (EAT)', isAvailable: true },
        { startTime: `${dateStr}T11:00:00.000Z`, endTime: `${dateStr}T12:00:00.000Z`, label: '02:00 PM - 03:00 PM (EAT)', isAvailable: true },
        { startTime: `${dateStr}T12:30:00.000Z`, endTime: `${dateStr}T13:30:00.000Z`, label: '03:30 PM - 04:30 PM (EAT)', isAvailable: false },
        { startTime: `${dateStr}T14:00:00.000Z`, endTime: `${dateStr}T15:00:00.000Z`, label: '05:00 PM - 06:00 PM (EAT)', isAvailable: true }
      ]);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (scheduleModalOpen && selectedDate) {
      loadSlots(selectedDate, formData.coordinatorId);
    }
  }, [scheduleModalOpen, selectedDate, formData.coordinatorId]);

  // Reset pagination whenever search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, methodFilter, sortBy, itemsPerPage]);

  // Format Helper: Method visuals
  const getMethodVisuals = (method) => {
    switch (method) {
      case 'VIDEO_CALL':
        return {
          label: 'Video Call (Meet)',
          icon: <Video className="w-3.5 h-3.5 text-blue-600" />,
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200'
        };
      case 'OFFICE_MEETING':
        return {
          label: 'Office Meeting',
          icon: <Building className="w-3.5 h-3.5 text-[#B95650]" />,
          badgeBg: 'bg-[#FCECE8] text-[#B95650] border-[#E8B5A6]'
        };
      case 'VENUE_VISIT':
        return {
          label: 'Venue Walkthrough',
          icon: <MapPin className="w-3.5 h-3.5 text-amber-600" />,
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200'
        };
      case 'PHONE_CALL':
        return {
          label: 'Phone Consultation',
          icon: <Phone className="w-3.5 h-3.5 text-emerald-600" />,
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      default:
        return {
          label: 'Advisory Session',
          icon: <MessageSquare className="w-3.5 h-3.5 text-slate-600" />,
          badgeBg: 'bg-[#F7F2EC] text-slate-700 border-[#E8DDD3]'
        };
    }
  };

  // Status Badge Helper (supports consultation object for dynamic past-due state)
  const getStatusBadge = (status, consultation) => {
    const eff = consultation ? getEffectiveStatus(consultation) : (status || 'SCHEDULED');
    const outcome = consultation?.outcome;

    if (outcome === 'CUSTOMER_NO_SHOW' || (eff === 'NO_SHOW' && outcome === 'CUSTOMER_NO_SHOW')) {
      return {
        label: 'Missed: Customer Absent',
        bg: 'bg-rose-50 text-rose-800 border-rose-200',
        dot: 'bg-rose-500'
      };
    }
    if (outcome === 'COORDINATOR_NO_SHOW' || (eff === 'NO_SHOW' && outcome === 'COORDINATOR_NO_SHOW')) {
      return {
        label: 'Missed: Coordinator Rescheduling',
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500'
      };
    }

    switch (eff) {
      case 'NEEDS_FOLLOW_UP':
        return {
          label: 'Needs Follow-up',
          bg: 'bg-amber-50 text-amber-900 border-amber-300',
          dot: 'bg-amber-500'
        };
      case 'CONFIRMED':
        return {
          label: 'Confirmed',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500'
        };
      case 'SCHEDULED':
        return {
          label: 'Scheduled',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500'
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          bg: 'bg-slate-100 text-slate-700 border-[#E8DDD3]',
          dot: 'bg-slate-500'
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          bg: 'bg-[#FCECE8] text-[#B95650] border-[#E8B5A6]',
          dot: 'bg-rose-400'
        };
      case 'NO_SHOW':
        return {
          label: 'Missed / No Show',
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          dot: 'bg-rose-500'
        };
      default:
        return {
          label: eff || 'Pending',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500'
        };
    }
  };

  // Handle New Consultation Submit
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.bookingId) {
      setFormError('Please select which celebration/event this consultation is for.');
      return;
    }
    if (!formData.scheduledStartTime || !formData.scheduledEndTime) {
      setFormError('Please choose an available date and time slot.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.scheduleConsultation({
        bookingId: formData.bookingId,
        coordinatorId: formData.coordinatorId || undefined,
        method: formData.method,
        scheduledStartTime: formData.scheduledStartTime,
        scheduledEndTime: formData.scheduledEndTime,
        locationOrLink: formData.locationOrLink,
        customerVisibleNotes: formData.customerVisibleNotes
      });

      setFormSuccess('Consultation successfully scheduled! Your coordinator has been notified.');
      setTimeout(() => {
        setScheduleModalOpen(false);
        setFormSuccess('');
        loadData();
      }, 1500);
    } catch (err) {
      console.error('Schedule consultation error:', err);
      setFormError(err.message || 'Unable to schedule consultation. Please select an event booking and available slot.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter & Sort Logic
  const filteredConsultations = consultations
    .filter((c) => {
      const coordName = c.coordinator?.fullName || '';
      const bookTitle = c.booking?.title || '';
      const bookRef = c.booking?.reference || '';
      const notes = c.customerVisibleNotes || '';
      const loc = c.locationOrLink || '';

      const searchMatch =
        coordName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bookTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bookRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.toLowerCase().includes(searchQuery.toLowerCase());

      let statusMatch = true;
      const eff = getEffectiveStatus(c);
      const s = (c.status || '').toUpperCase();
      if (statusFilter === 'NEEDS_FOLLOW_UP') statusMatch = eff === 'NEEDS_FOLLOW_UP';
      else if (statusFilter === 'UPCOMING') statusMatch = (s === 'SCHEDULED' || s === 'CONFIRMED') && !isConsultationPastDue(c);
      else if (statusFilter === 'COMPLETED') statusMatch = s === 'COMPLETED';
      else if (statusFilter === 'CANCELLED') statusMatch = s === 'CANCELLED';

      let methodMatch = true;
      if (methodFilter !== 'ALL') {
        methodMatch = c.method === methodFilter;
      }

      return searchMatch && statusMatch && methodMatch;
    })
    .sort((a, b) => {
      const timeA = new Date(a.scheduledStartTime).getTime();
      const timeB = new Date(b.scheduledStartTime).getTime();
      if (sortBy === 'DATE_ASC') return timeA - timeB;
      if (sortBy === 'DATE_DESC') return timeB - timeA;
      return 0;
    });

  // Calculate Metrics
  const totalCount = consultations.length;
  const needsFollowUpCount = consultations.filter((c) => getEffectiveStatus(c) === 'NEEDS_FOLLOW_UP').length;
  const upcomingCount = consultations.filter((c) => ['SCHEDULED', 'CONFIRMED'].includes((c.status || '').toUpperCase()) && !isConsultationPastDue(c)).length;
  const completedCount = consultations.filter((c) => (c.status || '').toUpperCase() === 'COMPLETED').length;
  const uniqueCoordinators = new Set(consultations.map((c) => c.coordinator?.fullName).filter(Boolean)).size;

  // Pagination calculations
  const totalItems = filteredConsultations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedConsultations = filteredConsultations.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black text-[#211D1B] tracking-tight">
              Consultations & Advisory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {consultations.length} {consultations.length === 1 ? 'Session' : 'Sessions'}
            </span>
          </div>
          <p className="text-xs md:text-sm text-[#756B65] font-medium mt-1">
            Meet with your dedicated event producers to finalize themes, review floral and stage layouts, and confirm logistics.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            setFormError('');
            setFormSuccess('');
            setScheduleModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold rounded-xl shadow-md shadow-[#B95650]/20 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Book Consultation</span>
        </button>
      </div>

      {/* 2. Overview Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-[#FFFDFC] rounded-2xl p-4 sm:p-5 border border-[#E8DDD3] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#756B65]">Total Consultations</p>
            <p className="text-2xl font-black text-[#211D1B] mt-1">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFDFC] rounded-2xl p-4 sm:p-5 border border-[#E8DDD3] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#756B65]">Upcoming Sessions</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{upcomingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFDFC] rounded-2xl p-4 sm:p-5 border border-[#E8DDD3] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#756B65]">Completed Sessions</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{completedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFDFC] rounded-2xl p-4 sm:p-5 border border-[#E8DDD3] shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#756B65]">Dedicated Producers</p>
            <p className="text-2xl font-black text-purple-600 mt-1">{uniqueCoordinators}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Control Bar */}
      <div className="bg-[#FFFDFC] rounded-2xl p-4 border border-[#E8DDD3] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#756B65] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by coordinator, booking ref, topic, venue..."
            className="w-full pl-9 pr-4 py-2 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-medium placeholder:text-[#756B65] focus:bg-[#FFFDFC] focus:outline-none focus:ring-2 focus:ring-[#B95650] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#756B65] hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl">
            {[
              { id: 'ALL', label: 'All', count: totalCount },
              { id: 'NEEDS_FOLLOW_UP', label: 'Needs Follow-up', count: needsFollowUpCount, isAmber: true },
              { id: 'UPCOMING', label: 'Upcoming', count: upcomingCount },
              { id: 'COMPLETED', label: 'Completed', count: completedCount },
              { id: 'CANCELLED', label: 'Cancelled' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-[#FFFDFC] text-[#211D1B] shadow-2xs'
                    : 'text-[#756B65] hover:text-[#211D1B]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    tab.isAmber && tab.count > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200/80 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Meeting Format Filter with Custom Chevron */}
          <div className="relative">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="appearance-none pl-3.5 pr-8 py-2 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#B95650] cursor-pointer hover:bg-slate-100/70 transition-colors"
            >
              <option value="ALL">All Formats</option>
              <option value="OFFICE_MEETING">Office Meeting</option>
              <option value="VIDEO_CALL">Video Call (Google Meet)</option>
              <option value="VENUE_VISIT">Venue Walkthrough</option>
              <option value="PHONE_CALL">Phone Call</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#756B65] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sort Dropdown with Custom Chevron */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none pl-3.5 pr-8 py-2 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#B95650] cursor-pointer hover:bg-slate-100/70 transition-colors"
            >
              <option value="DATE_ASC">Appointment Date (Earliest)</option>
              <option value="DATE_DESC">Appointment Date (Latest)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#756B65] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Grid / Table View Switcher */}
          <div className="flex items-center border border-[#E8DDD3] rounded-xl overflow-hidden bg-[#F7F2EC]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid' ? 'bg-[#B95650] text-white' : 'text-[#756B65] hover:text-[#211D1B]'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 transition-colors ${
                viewMode === 'table' ? 'bg-[#B95650] text-white' : 'text-[#756B65] hover:text-[#211D1B]'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Consultations Content Area */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-3 border-[#E8B5A6] border-t-[#B95650] rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-bold text-[#756B65]">Loading consultation appointments...</p>
        </div>
      ) : filteredConsultations.length === 0 ? (
        /* Empty State */
        <div className="bg-[#FFFDFC] rounded-3xl p-12 text-center border border-[#E8DDD3] shadow-2xs max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#FCECE8] text-[#B95650] border border-[#E8B5A6] flex items-center justify-center mx-auto mb-4 shadow-sm">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-[#211D1B]">No consultations found</h3>
          <p className="text-xs text-[#756B65] mt-1.5 mb-6 max-w-sm mx-auto leading-relaxed">
            {searchQuery || statusFilter !== 'ALL' || methodFilter !== 'ALL'
              ? 'No appointments match your current filter settings. Try resetting the filters.'
              : 'You do not have any scheduled consultations yet. Book a session with your coordinator to discuss your celebration.'}
          </p>
          {searchQuery || statusFilter !== 'ALL' || methodFilter !== 'ALL' ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setMethodFilter('ALL');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              Reset All Filters
            </button>
          ) : (
            <button
              onClick={() => setScheduleModalOpen(true)}
              className="px-5 py-2.5 bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold rounded-xl shadow-md shadow-[#B95650]/20 transition-all"
            >
              + Schedule First Consultation
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW: Responsive Cards */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {paginatedConsultations.map((c) => {
            const methodInfo = getMethodVisuals(c.method);
            const statusInfo = getStatusBadge(c.status, c);
            const startDate = new Date(c.scheduledStartTime);
            const endDate = new Date(c.scheduledEndTime);
            const isPastDue = isConsultationPastDue(c);
            const isUpcoming = ['SCHEDULED', 'CONFIRMED'].includes((c.status || '').toUpperCase()) && !isPastDue;
            const dateStr = startDate.toLocaleDateString('en-US', {
              timeZone: 'Africa/Addis_Ababa',
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            const timeStr = `${startDate.toLocaleTimeString('en-US', {
              timeZone: 'Africa/Addis_Ababa',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })} - ${endDate.toLocaleTimeString('en-US', {
              timeZone: 'Africa/Addis_Ababa',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })} (EAT)`;

            return (
              <div
                key={c.id}
                className="bg-[#FFFDFC] rounded-2xl p-5 sm:p-6 border border-[#E8DDD3] shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-[#E8DDD3]">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${methodInfo.badgeBg}`}>
                      {methodInfo.icon}
                      <span>{methodInfo.label}</span>
                    </span>

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${statusInfo.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                      <span>{statusInfo.label}</span>
                    </span>
                  </div>

                  {/* Booking Title Link */}
                  <div className="mt-3.5 mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] font-bold text-[#756B65] bg-slate-100 px-2 py-0.5 rounded">
                        {c.booking?.reference || 'EV-EVENT'}
                      </span>
                      <span className="text-[11px] font-bold text-[#B95650]">
                        {c.booking?.eventType || 'EVENT'}
                      </span>
                    </div>
                    <h2 className="text-base font-black text-[#211D1B] tracking-tight leading-snug">
                      {c.booking?.title || 'Celebration Planning Session'}
                    </h2>
                  </div>

                  {/* Schedule Details Box */}
                  <div className="p-3.5 bg-[#F7F2EC]/80 rounded-xl border border-[#E8DDD3]/90 space-y-2 mb-4 text-xs">
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <Calendar className="w-4 h-4 text-[#756B65] shrink-0" />
                      <span className="font-bold text-[#211D1B]">{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <Clock className="w-4 h-4 text-[#756B65] shrink-0" />
                      <span className="font-semibold">{timeStr}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-700">
                      {c.method === 'VIDEO_CALL' ? (
                        <Video className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : (
                        <MapPin className="w-4 h-4 text-[#B95650] shrink-0" />
                      )}
                      <span className="truncate text-slate-600">{c.locationOrLink || 'Eventora Studio'}</span>
                    </div>
                  </div>

                  {/* Needs Follow-up Message */}
                  {getEffectiveStatus(c) === 'NEEDS_FOLLOW_UP' && (
                    <div className="mb-4 text-xs text-amber-900 bg-amber-50/80 p-3 rounded-xl border border-amber-200">
                      <p className="font-semibold leading-relaxed">
                        Your scheduled consultation time has passed. Your coordinator will update the meeting outcome and contact you about the next steps.
                      </p>
                    </div>
                  )}

                  {/* Missed / No-Show Notice */}
                  {c.status === 'NO_SHOW' && (
                    <div className={`mb-4 text-xs p-3 rounded-xl border ${
                      c.outcome === 'COORDINATOR_NO_SHOW'
                        ? 'bg-amber-50/80 text-amber-900 border-amber-200'
                        : 'bg-rose-50/80 text-rose-900 border-rose-200'
                    }`}>
                      <p className="font-semibold leading-relaxed">
                        {c.outcome === 'COORDINATOR_NO_SHOW'
                          ? 'Coordinator missed this appointment due to an operational conflict and will contact you promptly to reschedule.'
                          : 'Missed appointment: You were unable to attend this consultation. Contact your coordinator to reschedule.'}
                      </p>
                    </div>
                  )}

                  {/* Assigned Coordinator Information */}
                  {c.coordinator ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F2EC]/70 border border-[#E8DDD3] text-xs mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#FCECE8] text-[#B95650] font-bold flex items-center justify-center text-xs">
                          {c.coordinator.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-[#211D1B] leading-tight">
                            {c.coordinator.fullName}
                          </p>
                          <p className="text-[10px] text-[#756B65] font-medium">
                            {c.coordinator.role || 'Event Coordinator'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {c.coordinator.phone && (
                          <a
                            href={`tel:${c.coordinator.phone}`}
                            className="p-1.5 rounded-lg bg-[#FFFDFC] border border-[#E8DDD3] text-slate-600 hover:text-[#B95650] hover:border-[#E8B5A6] transition-colors shadow-2xs"
                            title="Call Coordinator"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {c.coordinator.email && (
                          <a
                            href={`mailto:${c.coordinator.email}`}
                            className="p-1.5 rounded-lg bg-[#FFFDFC] border border-[#E8DDD3] text-slate-600 hover:text-[#B95650] hover:border-[#E8B5A6] transition-colors shadow-2xs"
                            title="Email Coordinator"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F2EC]/70 border border-[#E8DDD3] text-xs mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-[#756B65] flex items-center justify-center text-xs">
                          <UserCheck className="w-4 h-4 text-[#756B65]" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 leading-tight">Senior Event Producer</p>
                          <p className="text-[10px] text-[#756B65] font-medium">Assigned by Eventora Office</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        Eventora Team
                      </span>
                    </div>
                  )}

                  {/* Agenda / Customer Visible Notes */}
                  {c.customerVisibleNotes && (
                    <div className="mb-4 text-xs text-slate-600 bg-amber-50/60 p-3 rounded-xl border border-amber-100/80">
                      <p className="font-bold text-[11px] text-amber-900 mb-0.5">Discussion Agenda:</p>
                      <p className="line-clamp-2 text-slate-600 leading-relaxed">
                        {c.customerVisibleNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="pt-3.5 border-t border-[#E8DDD3] flex items-center justify-between gap-3">
                  {getEffectiveStatus(c) === 'NEEDS_FOLLOW_UP' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Outcome Pending</span>
                    </span>
                  ) : c.method === 'VIDEO_CALL' && isUpcoming ? (
                    isValidGoogleMeetUrl(c.locationOrLink) ? (
                      <a
                        href={c.locationOrLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all border border-blue-200"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Google Meet</span>
                      </a>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-[#756B65] text-[11px] font-semibold border border-[#E8DDD3] cursor-not-allowed"
                        title="Your coordinator will provide the verified Google Meet link prior to the appointment"
                      >
                        <Video className="w-3 h-3 text-[#756B65]" />
                        <span>Video Link Pending</span>
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] font-semibold text-[#756B65]">
                      {c.status === 'COMPLETED' ? 'Session Concluded' : isConsultationPastDue(c) ? 'Concluded (Pending Outcome)' : 'East Africa Time (EAT)'}
                    </span>
                  )}

                  <button
                    onClick={() => setSelectedConsultation(c)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-[#B95650] text-slate-700 hover:text-white text-xs font-bold rounded-xl transition-all shadow-2xs ml-auto"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW: Structured Operational Grid */
        <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F2EC] border-b border-[#E8DDD3] text-[#756B65] text-[#756B65] font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Celebration & Event</th>
                  <th className="py-3.5 px-4">Format</th>
                  <th className="py-3.5 px-4">Coordinator</th>
                  <th className="py-3.5 px-4">Location / Link</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedConsultations.map((c) => {
                  const methodInfo = getMethodVisuals(c.method);
                  const statusInfo = getStatusBadge(c.status, c);
                  const startDate = new Date(c.scheduledStartTime);
                  const dateStr = startDate.toLocaleDateString('en-US', {
                    timeZone: 'Africa/Addis_Ababa',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  const timeStr = startDate.toLocaleTimeString('en-US', {
                    timeZone: 'Africa/Addis_Ababa',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  });

                  return (
                    <tr key={c.id} className="hover:bg-[#F7F2EC]/50/60 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-[#211D1B]">{dateStr}</div>
                        <div className="text-[11px] text-[#756B65] font-medium">{timeStr} EAT</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#211D1B]">{c.booking?.title}</div>
                        <span className="font-mono text-[10px] text-[#756B65]">{c.booking?.reference}</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${methodInfo.badgeBg}`}>
                          {methodInfo.icon}
                          {methodInfo.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#211D1B] whitespace-nowrap">
                        {c.coordinator?.fullName || 'Eventora Producer'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 truncate max-w-[200px]">
                        {c.locationOrLink}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${statusInfo.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedConsultation(c)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#B95650] text-slate-700 hover:text-white text-xs font-bold transition-all"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Pagination Controls Bar (UI/UX Pro Max Standard) */}
      {!loading && filteredConsultations.length > 0 && (
        <div className="bg-[#FFFDFC] rounded-2xl p-4 border border-[#E8DDD3] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: Range Counter & Rows Selector */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#756B65] font-medium">
            <span>
              Showing <strong className="text-[#211D1B] font-bold">{totalItems === 0 ? 0 : startIndex + 1}</strong> to{' '}
              <strong className="text-[#211D1B] font-bold">{endIndex}</strong> of{' '}
              <strong className="text-[#211D1B] font-bold">{totalItems}</strong> consultations
            </span>

            <span className="text-slate-300">|</span>

            <div className="flex items-center gap-2">
              <span className="text-[#756B65] text-xs">Per page:</span>
              <div className="relative">
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="appearance-none pl-2.5 pr-7 py-1 bg-[#F7F2EC] border border-[#E8DDD3] rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-[#B95650] cursor-pointer transition-colors"
                >
                  <option value={2}>2</option>
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                </select>
                <ChevronDown className="w-3 h-3 text-[#756B65] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Right: Page Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              className="p-2 rounded-xl border border-[#E8DDD3] text-slate-600 hover:text-[#211D1B] hover:bg-[#F7F2EC]/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all shadow-2xs"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage === 1}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#E8DDD3] text-xs font-bold text-slate-600 hover:text-[#211D1B] hover:bg-[#F7F2EC]/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isActive = pageNum === safeCurrentPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-8 h-8 px-2.5 rounded-xl text-xs font-black transition-all ${
                      isActive
                        ? 'bg-[#B95650] text-white shadow-sm shadow-[#B95650]/20 scale-105'
                        : 'bg-[#FFFDFC] border border-[#E8DDD3] text-slate-700 hover:bg-slate-100 hover:text-[#211D1B]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage === totalPages}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#E8DDD3] text-xs font-bold text-slate-600 hover:text-[#211D1B] hover:bg-[#F7F2EC]/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all shadow-2xs"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="p-2 rounded-xl border border-[#E8DDD3] text-slate-600 hover:text-[#211D1B] hover:bg-[#F7F2EC]/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all shadow-2xs"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 6. Schedule Consultation Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFFDFC] rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-[#E8DDD3] max-h-[90vh] overflow-y-auto flex flex-col text-[#211D1B]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E8DDD3]">
              <div>
                <h3 className="text-lg font-black text-[#211D1B] tracking-tight">
                  Schedule Coordinator Consultation
                </h3>
                <p className="text-xs text-[#756B65] mt-0.5">
                  Book an advisory appointment with Eventora lead producers in Addis Ababa
                </p>
              </div>
              <button
                onClick={() => setScheduleModalOpen(false)}
                className="p-1 rounded-lg text-[#756B65] hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleScheduleSubmit} className="space-y-4 mt-4">
              {formError && (
                <div className="p-3 bg-[#FCECE8] border border-[#E8B5A6] text-[#B95650] text-xs font-semibold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* 1. Select Celebration / Booking */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Link to Event / Celebration *
                </label>
                <div className="relative">
                  <select
                    value={formData.bookingId}
                    onChange={(e) => {
                      const bId = e.target.value;
                      const b = bookings.find((item) => item.id === bId);
                      setFormData({
                        ...formData,
                        bookingId: bId,
                        coordinatorId: b?.assignedCoordinator?.id || ''
                      });
                    }}
                    className="w-full appearance-none pl-3.5 pr-8 py-2.5 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-bold text-[#211D1B] focus:outline-none focus:ring-2 focus:ring-[#B95650] cursor-pointer"
                    required
                  >
                    {bookings.length === 0 ? (
                      <option value="">No active bookings (Please request an event booking first)</option>
                    ) : (
                      bookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} ({b.reference})
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#756B65] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 2. Select Consultation Format */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  2. Choose Meeting Format *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    {
                      id: 'OFFICE_MEETING',
                      title: 'Office Meeting',
                      desc: 'Eventora HQ, Bole',
                      icon: <Building className="w-4 h-4 text-[#B95650]" />
                    },
                    {
                      id: 'VIDEO_CALL',
                      title: 'Video Call',
                      desc: 'Google Meet',
                      icon: <Video className="w-4 h-4 text-blue-500" />
                    },
                    {
                      id: 'VENUE_VISIT',
                      title: 'Venue Walkthrough',
                      desc: 'On-site venue visit',
                      icon: <MapPin className="w-4 h-4 text-amber-500" />
                    },
                    {
                      id: 'PHONE_CALL',
                      title: 'Phone Consultation',
                      desc: 'Direct coordinator call',
                      icon: <Phone className="w-4 h-4 text-emerald-500" />
                    }
                  ].map((fmt) => (
                    <button
                      type="button"
                      key={fmt.id}
                      onClick={() => {
                        let loc = formData.locationOrLink;
                        if (fmt.id === 'OFFICE_MEETING') loc = 'Eventora Executive Studios, Bole Medhanialem, Addis Ababa';
                        else if (fmt.id === 'VIDEO_CALL') loc = ''; // Verified Google Meet conference link assigned by coordinator or Calendar API
                        else if (fmt.id === 'VENUE_VISIT') loc = 'At Event Venue Location (Addis Ababa)';
                        else if (fmt.id === 'PHONE_CALL') loc = 'Coordinator Phone Line';

                        setFormData({
                          ...formData,
                          method: fmt.id,
                          locationOrLink: loc
                        });
                      }}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                        formData.method === fmt.id
                          ? 'border-[#B95650] bg-[#FCECE8]/40 shadow-2xs'
                          : 'border-[#E8DDD3] hover:bg-[#F7F2EC]/50'
                      }`}
                    >
                      <div className="p-1.5 bg-[#FFFDFC] rounded-lg border border-[#E8DDD3] shadow-2xs">
                        {fmt.icon}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#211D1B] leading-tight">{fmt.title}</p>
                        <p className="text-[10px] text-[#756B65] mt-0.5">{fmt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Pick Date and Available Slot */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  3. Select Date & Time Slot (East Africa Time UTC+3) *
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setFormData({ ...formData, scheduledStartTime: '', scheduledEndTime: '' });
                  }}
                  className="w-full px-3.5 py-2 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-bold text-[#211D1B] focus:outline-none focus:ring-2 focus:ring-[#B95650] mb-2.5"
                />

                {loadingSlots ? (
                  <div className="py-4 text-center text-xs text-[#756B65]">Loading available time slots...</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableSlots.map((slot, idx) => {
                      const isSelected =
                        formData.scheduledStartTime === slot.startTime &&
                        formData.scheduledEndTime === slot.endTime;

                      return (
                        <button
                          type="button"
                          key={idx}
                          disabled={!slot.isAvailable}
                          onClick={() => {
                            setFormData({
                              ...formData,
                              scheduledStartTime: slot.startTime,
                              scheduledEndTime: slot.endTime
                            });
                          }}
                          className={`p-2 rounded-xl text-xs font-bold flex items-center justify-between border transition-all ${
                            isSelected
                              ? 'bg-[#B95650] text-white border-[#B95650] shadow-xs'
                              : slot.isAvailable
                              ? 'bg-[#F7F2EC] hover:bg-slate-100 text-[#211D1B] border-[#E8DDD3]'
                              : 'bg-slate-100 text-[#756B65] border-[#E8DDD3] opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <span>{slot.label}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. Discussion Agenda / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  4. Agenda & Topics You Wish to Discuss
                </label>
                <textarea
                  rows={3}
                  value={formData.customerVisibleNotes}
                  onChange={(e) => setFormData({ ...formData, customerVisibleNotes: e.target.value })}
                  placeholder="e.g. Floral centerpiece styling, stage dimensions, catering dietary restrictions, photography shot list..."
                  className="w-full p-3 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-medium placeholder:text-[#756B65] focus:bg-[#FFFDFC] focus:outline-none focus:ring-2 focus:ring-[#B95650] transition-all"
                />
              </div>

              {/* Modal Submit Actions */}
              <div className="pt-3 border-t border-[#E8DDD3] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold rounded-xl shadow-md shadow-[#B95650]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? 'Confirming Appointment...' : 'Confirm Consultation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Consultation Details Inspector Modal */}
      {selectedConsultation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFFDFC] rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-[#E8DDD3] max-h-[90vh] overflow-y-auto flex flex-col text-[#211D1B]">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E8DDD3]">
              <div>
                <span className="font-mono text-xs font-bold text-[#756B65] bg-slate-100 px-2 py-0.5 rounded">
                  {selectedConsultation.booking?.reference || 'EV-CONS'}
                </span>
                <h3 className="text-lg font-black text-[#211D1B] mt-1">
                  {selectedConsultation.booking?.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedConsultation(null)}
                className="p-1 rounded-lg text-[#756B65] hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Appointment Overview */}
            <div className="space-y-4 my-4">
              {/* Needs Follow-up / Concluded Notice Banner */}
              {getEffectiveStatus(selectedConsultation) === 'NEEDS_FOLLOW_UP' && (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-300 flex items-start gap-2.5 text-xs text-amber-950 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Outcome Pending</span>
                    <span className="text-amber-800 text-[11px] leading-relaxed">
                      Your scheduled consultation time has passed. Your coordinator will update the meeting outcome and contact you about the next steps.
                    </span>
                  </div>
                </div>
              )}

              {/* No-Show Notice Banner */}
              {selectedConsultation.status === 'NO_SHOW' && (
                <div className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs shadow-2xs ${
                  selectedConsultation.outcome === 'COORDINATOR_NO_SHOW'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}>
                  <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                    selectedConsultation.outcome === 'COORDINATOR_NO_SHOW' ? 'text-amber-600' : 'text-rose-600'
                  }`} />
                  <div>
                    <span className="font-bold block">
                      {selectedConsultation.outcome === 'COORDINATOR_NO_SHOW'
                        ? 'Coordinator Rescheduling (Missed Appointment)'
                        : 'Missed Appointment (Customer Absent)'}
                    </span>
                    <span className={`text-[11px] leading-relaxed ${
                      selectedConsultation.outcome === 'COORDINATOR_NO_SHOW' ? 'text-amber-800' : 'text-rose-800'
                    }`}>
                      {selectedConsultation.outcome === 'COORDINATOR_NO_SHOW'
                        ? 'Our sincere apologies: Your coordinator was unavoidably detained and unable to attend. They will contact you promptly to reschedule.'
                        : 'You were unable to attend the scheduled consultation. Please contact your coordinator to reschedule.'}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs bg-[#F7F2EC] p-4 rounded-2xl border border-[#E8DDD3]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#756B65] block mb-0.5">Format</span>
                  <span className="font-bold text-[#211D1B] flex items-center gap-1.5">
                    {getMethodVisuals(selectedConsultation.method).icon}
                    {getMethodVisuals(selectedConsultation.method).label}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#756B65] block mb-0.5">Status</span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(selectedConsultation.status, selectedConsultation).bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusBadge(selectedConsultation.status, selectedConsultation).dot}`}></span>
                    {getStatusBadge(selectedConsultation.status, selectedConsultation).label}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] uppercase font-bold text-[#756B65] block mb-0.5">Scheduled Time</span>
                  <span className="font-bold text-[#211D1B]">
                    {formatDateTimeEAT(selectedConsultation.scheduledStartTime)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] uppercase font-bold text-[#756B65] block mb-0.5">Meeting Location / Access</span>
                  <span className="font-medium text-slate-700 break-all">
                    {selectedConsultation.locationOrLink}
                  </span>
                </div>
              </div>

              {/* Coordinator Information */}
              {selectedConsultation.coordinator && (
                <div className="p-4 rounded-2xl bg-[#F7F2EC] border border-[#E8DDD3] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#FCECE8] text-[#B95650] font-bold flex items-center justify-center text-sm shadow-xs">
                      {selectedConsultation.coordinator.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-[#211D1B] leading-tight">
                        {selectedConsultation.coordinator.fullName}
                      </p>
                      <p className="text-[11px] text-[#756B65] font-medium">
                        {selectedConsultation.coordinator.role || 'Designated Lead Producer'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedConsultation.coordinator.phone && (
                      <a
                        href={`tel:${selectedConsultation.coordinator.phone}`}
                        className="p-2 rounded-xl bg-[#FFFDFC] border border-[#E8DDD3] text-slate-600 hover:text-[#B95650] hover:border-[#E8B5A6] transition-colors shadow-2xs"
                        title="Direct Phone"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    {selectedConsultation.coordinator.email && (
                      <a
                        href={`mailto:${selectedConsultation.coordinator.email}`}
                        className="p-2 rounded-xl bg-[#FFFDFC] border border-[#E8DDD3] text-slate-600 hover:text-[#B95650] hover:border-[#E8B5A6] transition-colors shadow-2xs"
                        title="Direct Email"
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Agenda Notes */}
              {selectedConsultation.customerVisibleNotes && (
                <div className="p-3.5 bg-[#F7F2EC] rounded-2xl border border-[#E8DDD3] text-xs">
                  <p className="font-bold text-[#211D1B] mb-1">Customer Discussion Points:</p>
                  <p className="text-slate-600 leading-relaxed">
                    {selectedConsultation.customerVisibleNotes}
                  </p>
                </div>
              )}

              {/* Coordinator Meeting Summary (if recorded) */}
              {selectedConsultation.discussionSummary && (
                <div className="p-3.5 bg-[#F7F2EC] rounded-2xl border border-[#E8DDD3] text-xs">
                  <p className="font-bold text-[#211D1B] mb-1">Coordinator Meeting Summary:</p>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedConsultation.discussionSummary}
                  </p>
                </div>
              )}

              {/* Agreed Decisions / Outcomes (if recorded) */}
              {selectedConsultation.agreedDecisions && (
                <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-xs">
                  <p className="font-bold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Agreed Decisions & Scope Confirmation:</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    {selectedConsultation.agreedDecisions.map((dec, idx) => (
                      <li key={idx} className="leading-snug">{dec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-[#E8DDD3] flex items-center justify-between">
              {isConsultationPastDue(selectedConsultation) ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-[#E8DDD3]">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Meeting Concluded</span>
                  </span>
                </div>
              ) : selectedConsultation.method === 'VIDEO_CALL' ? (
                <div className="flex items-center gap-2">
                  {isValidGoogleMeetUrl(selectedConsultation.locationOrLink) ? (
                    <a
                      href={selectedConsultation.locationOrLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                    >
                      <Video className="w-4 h-4" />
                      <span>Launch Google Meet</span>
                    </a>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-[#756B65] text-xs font-medium rounded-xl border border-[#E8DDD3] cursor-not-allowed"
                      title="Video link will be provided prior to appointment"
                    >
                      <Video className="w-4 h-4 text-[#756B65]" />
                      <span>Video Link Pending</span>
                    </span>
                  )}

                  <a
                    href={selectedConsultation.googleCalendarUrl || `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedConsultation.booking?.title || 'Eventora Consultation')}&dates=${new Date(selectedConsultation.scheduledStartTime).toISOString().replace(/-|:|\.\d\d\d/g, '')}/${new Date(selectedConsultation.scheduledEndTime || new Date(selectedConsultation.scheduledStartTime).getTime() + 3600000).toISOString().replace(/-|:|\.\d\d\d/g, '')}&location=${encodeURIComponent(selectedConsultation.locationOrLink || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#FFFDFC] hover:bg-[#F7F2EC] border border-[#E8DDD3] text-slate-700 text-xs font-bold rounded-xl transition-all shadow-2xs"
                  >
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Add to Google Calendar</span>
                  </a>
                </div>
              ) : (
                <span className="text-[11px] text-[#756B65]">Addis Ababa, Ethiopia · EAT UTC+3</span>
              )}

              <button
                onClick={() => setSelectedConsultation(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors ml-auto"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
