import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import BookingModal from '../../components/booking/BookingModal';
import BookingDetailsCards from '../../components/booking/BookingDetailsCards';
import {
  Calendar,
  MapPin,
  Users,
  Sparkles,
  Cake,
  Briefcase,
  Heart,
  Crown,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  FileText,
  CreditCard,
  Phone,
  Mail,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  X,
  LayoutGrid,
  List,
  AlertCircle,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

export default function CustomerBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('DATE_ASC');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(4);

  // Reset pagination to first page whenever search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, sortBy, itemsPerPage]);

  // Load real customer bookings from API
  const loadBookings = async () => {
    try {
      setLoading(true);
      // Attempt fetching from getMyBookings or fallback to dashboard summary
      let items = [];
      try {
        const res = await api.getMyBookings();
        if (res?.data?.bookings) {
          items = res.data.bookings;
        }
      } catch (err) {
        console.warn('api.getMyBookings failed, checking dashboard summary:', err);
        const dashRes = await api.getDashboardSummary();
        if (dashRes?.data?.bookings) {
          items = dashRes.data.bookings;
        }
      }

      setBookings(items || []);
    } catch (err) {
      console.error('Error loading bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  // Visual helper per event category
  const getEventVisuals = (type, title = '') => {
    const t = (type || '').toUpperCase();
    const tit = title.toLowerCase();

    if (t === 'WEDDING' || tit.includes('wedding') || tit.includes('melse')) {
      return {
        label: 'Wedding Celebration',
        icon: <Sparkles className="w-4 h-4 text-[#B95650]" />,
        badgeBg: 'bg-[#FCECE8] text-[#B95650] border-[#E8B5A6]',
        cardBorder: 'hover:border-[#B95650]/40'
      };
    }
    if (t === 'BIRTHDAY' || tit.includes('birthday') || tit.includes('party')) {
      return {
        label: 'Birthday Party',
        icon: <Cake className="w-4 h-4 text-[#756B65]" />,
        badgeBg: 'bg-[#F7F2EC] text-[#211D1B] border-[#E8DDD3]',
        cardBorder: 'hover:border-[#B95650]/40'
      };
    }
    if (t === 'CORPORATE' || tit.includes('corporate') || tit.includes('summit') || tit.includes('gala')) {
      return {
        label: 'Corporate Event',
        icon: <Briefcase className="w-4 h-4 text-[#756B65]" />,
        badgeBg: 'bg-[#F7F2EC] text-[#211D1B] border-[#E8DDD3]',
        cardBorder: 'hover:border-[#B95650]/40'
      };
    }
    return {
      label: 'Traditional / Special',
      icon: <Crown className="w-4 h-4 text-[#756B65]" />,
      badgeBg: 'bg-[#F7F2EC] text-[#211D1B] border-[#E8DDD3]',
      cardBorder: 'hover:border-[#B95650]/40'
    };
  };

  // Status badge styling helper
  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'CONFIRMED' || s === 'SCHEDULED') {
      return {
        label: 'Confirmed & Scheduled',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-600'
      };
    }
    if (s === 'COMPLETED') {
      return {
        label: 'Celebration Completed',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-600'
      };
    }
    if (s === 'REQUEST_RECEIVED' || s === 'REQUESTED' || s === 'PENDING') {
      return {
        label: 'Pending Review',
        bg: 'bg-[#FCECE8] text-[#B95650] border-[#E8B5A6]',
        dot: 'bg-[#B95650]'
      };
    }
    if (s === 'UNDER_REVIEW' || s === 'QUOTED' || s.includes('PROPOSAL')) {
      return {
        label: 'Quotation Ready',
        bg: 'bg-[#F7F2EC] text-[#211D1B] border-[#E8DDD3]',
        dot: 'bg-[#B95650]'
      };
    }
    if (s === 'CONTRACT_PENDING' || s === 'CONTRACTED' || s === 'CONTRACT_SIGNED') {
      return {
        label: 'Contract Ready',
        bg: 'bg-[#FCECE8] text-[#B95650] border-[#E8B5A6]',
        dot: 'bg-[#B95650]'
      };
    }
    if (s === 'DEPOSIT_PENDING' || s === 'PAYMENT_PENDING') {
      return {
        label: 'Deposit Pending',
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-600'
      };
    }
    if (s === 'PAID') {
      return {
        label: 'Deposit Paid',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-600'
      };
    }
    if (s === 'CANCELLED') {
      return {
        label: 'Cancelled',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500'
      };
    }
    const humanized = (status || 'In Progress')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      label: humanized,
      bg: 'bg-[#F7F2EC] text-[#756B65] border-[#E8DDD3]',
      dot: 'bg-[#756B65]'
    };
  };

  // 5-Stage Stepper mapping helper
  const getProgressStage = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'CONFIRMED' || s === 'SCHEDULED') return 5;
    if (s === 'PAID' || s.includes('DEPOSIT') || s.includes('PAYMENT')) return 4;
    if (s.includes('CONTRACT')) return 3;
    if (s === 'UNDER_REVIEW' || s === 'QUOTED' || s.includes('PROPOSAL')) return 2;
    return 1; // REQUESTED / REQUEST_RECEIVED
  };

  // Filter and sort bookings
  const filteredBookings = bookings.filter((b) => {
    const titleMatch = (b.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const refMatch = (b.reference || '').toLowerCase().includes(searchQuery.toLowerCase());
    const locMatch = (b.locationName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = titleMatch || refMatch || locMatch;

    let matchesStatus = true;
    const s = (b.status || '').toUpperCase();
    if (statusFilter === 'CONFIRMED') matchesStatus = s === 'CONFIRMED';
    else if (statusFilter === 'PENDING') matchesStatus = s === 'REQUESTED' || s === 'REQUEST_RECEIVED';
    else if (statusFilter === 'QUOTED') matchesStatus = s === 'UNDER_REVIEW' || s === 'QUOTED';
    else if (statusFilter === 'COMPLETED') matchesStatus = s === 'COMPLETED';

    let matchesType = true;
    const t = (b.eventType || '').toUpperCase();
    if (typeFilter !== 'ALL') {
      matchesType = t === typeFilter;
    }

    return matchesSearch && matchesStatus && matchesType;
  }).sort((a, b) => {
    const dateA = new Date(a.preferredDate).getTime();
    const dateB = new Date(b.preferredDate).getTime();
    if (sortBy === 'DATE_ASC') return dateA - dateB;
    if (sortBy === 'DATE_DESC') return dateB - dateA;
    return b.id.localeCompare(a.id);
  });

  // Calculate Metrics
  const totalCount = bookings.length;
  const confirmedCount = bookings.filter((b) => (b.status || '').toUpperCase() === 'CONFIRMED').length;
  const pendingCount = bookings.filter((b) => ['REQUESTED', 'REQUEST_RECEIVED', 'UNDER_REVIEW', 'QUOTED'].includes((b.status || '').toUpperCase())).length;
  const completedCount = bookings.filter((b) => (b.status || '').toUpperCase() === 'COMPLETED').length;

  // Pagination calculations
  const totalItems = filteredBookings.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedBookings = filteredBookings.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              My Bookings
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {bookings.length} {bookings.length === 1 ? 'Event' : 'Events'}
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
            Track your reservations, review proposals, and collaborate with your assigned coordinators.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setBookingModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold rounded-xl shadow-md shadow-[#B95650]/20 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Request New Event</span>
        </button>
      </div>

      {/* 2. Overview Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-[#FFFDFC] rounded-2xl p-4 sm:p-5 border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#756B65]">Total Bookings</p>
            <p className="text-2xl font-black text-[#211D1B] mt-1">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F7F2EC] text-[#B95650] border border-[#E8DDD3] flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFDFC] rounded-2xl p-4 sm:p-5 border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#756B65]">Confirmed Events</p>
            <p className="text-2xl font-black text-[#211D1B] mt-1">{confirmedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F7F2EC] text-emerald-700 border border-[#E8DDD3] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFDFC] rounded-2xl p-4 sm:p-5 border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#756B65]">Under Review</p>
            <p className="text-2xl font-black text-[#211D1B] mt-1">{pendingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F7F2EC] text-[#B95650] border border-[#E8DDD3] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFDFC] rounded-2xl p-4 sm:p-5 border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#756B65]">Completed</p>
            <p className="text-2xl font-black text-[#211D1B] mt-1">{completedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F7F2EC] text-[#756B65] border border-[#E8DDD3] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Control Bar */}
      <div className="bg-[#FFFDFC] rounded-2xl p-4 border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#756B65] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by event title, reference (EVT-...), or venue..."
            className="w-full pl-9 pr-4 py-2 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-medium placeholder:text-[#756B65] focus:bg-[#FFFDFC] focus:outline-none focus:ring-2 focus:ring-[#B95650] text-[#211D1B] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#756B65] hover:text-[#211D1B]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center p-1 bg-[#F7F2EC] rounded-xl border border-[#E8DDD3]">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'CONFIRMED', label: 'Confirmed' },
              { id: 'PENDING', label: 'In Review' },
              { id: 'COMPLETED', label: 'Completed' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === tab.id
                  ? 'bg-[#B95650] text-white shadow-xs'
                  : 'text-[#756B65] hover:text-[#211D1B]'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Event Category Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none pl-3.5 pr-8 py-2 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-semibold text-[#211D1B] focus:outline-none focus:ring-2 focus:ring-[#B95650] cursor-pointer hover:bg-[#FCECE8]/40 transition-colors"
            >
              <option value="ALL">All Categories</option>
              <option value="WEDDING">Wedding</option>
              <option value="BIRTHDAY">Birthday</option>
              <option value="CORPORATE">Corporate</option>
              <option value="TRADITIONAL">Traditional</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#756B65] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none pl-3.5 pr-8 py-2 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-semibold text-[#211D1B] focus:outline-none focus:ring-2 focus:ring-[#B95650] cursor-pointer hover:bg-[#FCECE8]/40 transition-colors"
            >
              <option value="DATE_ASC">Event Date (Earliest)</option>
              <option value="DATE_DESC">Event Date (Latest)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#756B65] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Grid / Table View Switcher */}
          <div className="flex items-center border border-[#E8DDD3] rounded-xl overflow-hidden bg-[#F7F2EC]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-[#B95650] text-white' : 'text-[#756B65] hover:text-[#211D1B]'
                }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-[#B95650] text-white' : 'text-[#756B65] hover:text-[#211D1B]'
                }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bookings Display Area */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-3 border-[#E8B5A6] border-t-[#B95650] rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-bold text-[#756B65]">Loading your reservations...</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        /* Empty State */
        <div className="bg-[#FFFDFC] rounded-3xl p-12 text-center border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.03)] max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#FCECE8] text-[#B95650] border border-[#E8B5A6] flex items-center justify-center mx-auto mb-4 shadow-xs">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-[#211D1B]">No event bookings found</h3>
          <p className="text-xs text-[#756B65] mt-1.5 mb-6 max-w-sm mx-auto leading-relaxed">
            {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'No bookings match your current search and filter criteria. Try resetting the filters.'
              : 'You have not submitted any event bookings yet. Plan your dream wedding, birthday, or corporate summit today.'}
          </p>
          {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL' ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
              }}
              className="px-4 py-2 bg-[#F7F2EC] hover:bg-[#E8DDD3] text-[#211D1B] text-xs font-bold rounded-xl transition-all cursor-pointer border border-[#E8DDD3]"
            >
              Reset All Filters
            </button>
          ) : (
            <button
              onClick={() => setBookingModalOpen(true)}
              className="px-5 py-2.5 bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              + Submit First Booking Request
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW: Rich Interactive Cards */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {paginatedBookings.map((b) => {
            const visuals = getEventVisuals(b.eventType, b.title);
            const statusInfo = getStatusBadge(b.status);
            const activeStep = getProgressStage(b.status);
            const dateStr = new Date(b.preferredDate).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <div
                key={b.id}
                className={`bg-[#FFFDFC] rounded-2xl p-6 border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)] hover:shadow-md hover:border-[#B95650]/40 transition-all flex flex-col justify-between ${visuals.cardBorder}`}
              >
                <div>
                  {/* Card Header: Reference & Status Badges */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#E8DDD3]/60">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${visuals.badgeBg}`}>
                        {visuals.icon}
                        <span>{visuals.label}</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#756B65]">
                        {b.reference || 'EVT-2026-TEMP'}
                      </span>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold border ${statusInfo.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                      <span>{statusInfo.label}</span>
                    </span>
                  </div>

                  {/* Event Title */}
                  <div className="mt-3.5 mb-4">
                    <h2 className="text-base font-black text-[#211D1B] tracking-tight leading-snug">
                      {b.title}
                    </h2>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs text-[#756B65] bg-[#F7F2EC]/60 p-3.5 rounded-xl border border-[#E8DDD3] mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#B95650] shrink-0" />
                      <span className="font-semibold text-[#211D1B] truncate">{dateStr}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#B95650] shrink-0" />
                      <span><strong className="text-[#211D1B]">{b.guestCount}</strong> Expected Guests</span>
                    </div>

                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin className="w-4 h-4 text-[#B95650] shrink-0" />
                      <span className="truncate text-[#211D1B]">{b.locationName} · {b.city || 'Addis Ababa'}</span>
                    </div>
                  </div>

                  {/* 5-Stage Visual Workflow Stepper */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#756B65] uppercase tracking-wider mb-2">
                      <span>Booking Workflow Status</span>
                      <span className="text-[#B95650]">Stage {activeStep} of 5</span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 text-center">
                      {[
                        { num: 1, label: 'Request' },
                        { num: 2, label: 'Proposal' },
                        { num: 3, label: 'Contract' },
                        { num: 4, label: 'Deposit' },
                        { num: 5, label: 'Confirmed' }
                      ].map((s) => {
                        const isDone = s.num < activeStep;
                        const isCurrent = s.num === activeStep;
                        return (
                          <div key={s.num} className="flex flex-col items-center">
                            <div
                              className={`w-full h-1.5 rounded-full mb-1 transition-all ${isDone
                                ? 'bg-emerald-600'
                                : isCurrent
                                  ? 'bg-[#B95650] shadow-xs'
                                  : 'bg-[#E8DDD3]'
                                }`}
                            ></div>
                            <span
                              className={`text-[10px] font-semibold leading-tight ${isDone
                                ? 'text-emerald-700'
                                : isCurrent
                                  ? 'text-[#B95650] font-bold'
                                  : 'text-[#756B65]'
                                }`}
                            >
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Assigned Coordinator Information or Assignment Status */}
                  {b.assignedCoordinator ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F2EC]/50 border border-[#E8DDD3] text-xs mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#FCECE8] text-[#B95650] font-bold flex items-center justify-center text-xs border border-[#E8B5A6]">
                          {b.assignedCoordinator.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-[#211D1B] leading-tight">
                            {b.assignedCoordinator.fullName}
                          </p>
                          <p className="text-[10px] text-[#756B65] font-medium">
                            {b.assignedCoordinator.role || 'Eventora Coordinator'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${b.assignedCoordinator.phone}`}
                          className="p-1.5 rounded-lg bg-[#FFFDFC] border border-[#E8DDD3] text-[#756B65] hover:text-[#B95650] hover:border-[#B95650] transition-colors shadow-2xs"
                          title="Call Coordinator"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`mailto:${b.assignedCoordinator.email}`}
                          className="p-1.5 rounded-lg bg-[#FFFDFC] border border-[#E8DDD3] text-[#756B65] hover:text-[#B95650] hover:border-[#B95650] transition-colors shadow-2xs"
                          title="Email Coordinator"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F2EC]/50 border border-[#E8DDD3] text-xs mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#F7F2EC] text-[#756B65] font-bold flex items-center justify-center text-xs border border-[#E8DDD3]">
                          <UserCheck className="w-4 h-4 text-[#756B65]" />
                        </div>
                        <div>
                          <p className="font-bold text-[#211D1B] leading-tight">
                            Coordinator Assignment
                          </p>
                          <p className="text-[10px] text-[#756B65] font-medium">
                            Pending Producer Assignment
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FCECE8] text-[#B95650] border border-[#E8B5A6]">
                        In Assignment
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 border-t border-[#E8DDD3]/60 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="text-[#756B65] font-medium block text-[10px]">Contract Value / Budget</span>
                    <span className="font-black text-[#211D1B] text-sm">
                      ETB {Number(b.budgetEstimate || b.package?.price || 0).toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedBooking(b)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FFFDFC] border border-[#E8DDD3] hover:border-[#B95650] hover:bg-[#FCECE8] text-[#211D1B] hover:text-[#B95650] text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                  >
                    <span>View Full Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW: Structured Operational Grid */
        <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F2EC] border-b border-[#E8DDD3] text-[#756B65] font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Booking Ref</th>
                  <th className="py-3.5 px-4">Event & Category</th>
                  <th className="py-3.5 px-4">Event Date</th>
                  <th className="py-3.5 px-4">Venue & City</th>
                  <th className="py-3.5 px-4">Coordinator</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DDD3]/50">
                {paginatedBookings.map((b) => {
                  const visuals = getEventVisuals(b.eventType, b.title);
                  const statusInfo = getStatusBadge(b.status);
                  const dateStr = new Date(b.preferredDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  return (
                    <tr key={b.id} className="hover:bg-[#F7F2EC]/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#211D1B]">
                        {b.reference || 'EVT-2026-TEMP'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#211D1B]">{b.title}</div>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border mt-0.5 ${visuals.badgeBg}`}>
                          {visuals.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#211D1B] whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3.5 px-4 text-[#756B65] truncate max-w-[180px]">
                        {b.locationName}
                      </td>
                      <td className="py-3.5 px-4 text-[#211D1B] font-medium">
                        {b.assignedCoordinator?.fullName || 'Not assigned'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${statusInfo.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="px-3 py-1.5 rounded-lg bg-[#FFFDFC] border border-[#E8DDD3] hover:border-[#B95650] hover:bg-[#FCECE8] text-[#211D1B] hover:text-[#B95650] text-xs font-bold transition-all cursor-pointer"
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

      {/* 5. Pagination Controls Bar */}
      {!loading && filteredBookings.length > 0 && (
        <div className="bg-[#FFFDFC] rounded-2xl p-4 border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: Summary and Items Per Page */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#756B65] font-medium">
            <span>
              Showing <strong className="text-[#211D1B] font-bold">{totalItems === 0 ? 0 : startIndex + 1}</strong> to{' '}
              <strong className="text-[#211D1B] font-bold">{endIndex}</strong> of{' '}
              <strong className="text-[#211D1B] font-bold">{totalItems}</strong> events
            </span>

            <span className="text-[#E8DDD3]">|</span>

            <div className="flex items-center gap-2">
              <span className="text-[#756B65] text-xs">Per page:</span>
              <div className="relative">
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="appearance-none pl-2.5 pr-7 py-1 bg-[#F7F2EC] border border-[#E8DDD3] rounded-lg text-xs font-bold text-[#211D1B] hover:bg-[#FCECE8]/40 focus:outline-none focus:ring-2 focus:ring-[#B95650] cursor-pointer transition-colors"
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
            {/* First Page Button */}
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              className="p-2 rounded-xl border border-[#E8DDD3] text-[#756B65] hover:text-[#211D1B] hover:bg-[#F7F2EC] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all shadow-2xs cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page Button */}
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage === 1}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#E8DDD3] text-xs font-bold text-[#756B65] hover:text-[#211D1B] hover:bg-[#F7F2EC] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all shadow-2xs cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Page Number Buttons */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                if (
                  totalPages > 5 &&
                  pageNum !== 1 &&
                  pageNum !== totalPages &&
                  Math.abs(pageNum - safeCurrentPage) > 1
                ) {
                  if (pageNum === 2 || pageNum === totalPages - 1) {
                    return (
                      <span key={pageNum} className="px-1.5 text-xs font-bold text-[#756B65]/50">
                        ...
                      </span>
                    );
                  }
                  return null;
                }

                const isActive = pageNum === safeCurrentPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-8 h-8 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${isActive
                      ? 'bg-[#B95650] text-white shadow-xs scale-105'
                      : 'bg-[#FFFDFC] border border-[#E8DDD3] text-[#211D1B] hover:bg-[#F7F2EC]'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Page Button */}
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage === totalPages}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#E8DDD3] text-xs font-bold text-[#756B65] hover:text-[#211D1B] hover:bg-[#F7F2EC] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all shadow-2xs cursor-pointer"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page Button */}
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="p-2 rounded-xl border border-[#E8DDD3] text-[#756B65] hover:text-[#211D1B] hover:bg-[#F7F2EC] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all shadow-2xs cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 6. Booking Inspector Drawer / Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-[#211D1B]/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFFDFC] rounded-[28px] max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-[#E8DDD3] max-h-[90vh] flex flex-col text-[#211D1B]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E8DDD3]/80">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-xl sm:text-2xl font-black text-[#211D1B] tracking-tight">
                    {selectedBooking.title}
                  </h3>
                  <span className="font-mono text-xs font-bold text-[#B95650] bg-[#FCECE8] px-3 py-0.5 rounded-full border border-[#E8B5A6]">
                    {selectedBooking.reference}
                  </span>
                </div>
                <p className="text-xs text-[#756B65] mt-1">
                  Full reservation specifications &amp; verified contract status
                </p>
              </div>

              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 rounded-full text-[#756B65] hover:text-[#211D1B] hover:bg-[#F7F2EC] transition-colors cursor-pointer"
                aria-label="Close booking details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="my-5 overflow-y-auto space-y-4 pr-1 text-xs flex-1">
              {/* Event Specification Card */}
              <div className="p-4 rounded-2xl bg-[#F7F2EC]/70 border border-[#E8DDD3] space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#FCECE8] text-[#B95650] flex items-center justify-center shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <h4 className="font-bold text-[10.5px] uppercase tracking-[0.18em] text-[#B95650]">
                    Event Specifications
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-[#FFFDFC] border border-[#E8DDD3]">
                    <span className="text-[#756B65] block text-[10px] uppercase font-semibold">Preferred Date</span>
                    <span className="font-bold text-[#211D1B] text-xs mt-0.5 block">
                      {new Date(selectedBooking.preferredDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFDFC] border border-[#E8DDD3]">
                    <span className="text-[#756B65] block text-[10px] uppercase font-semibold">Expected Guests</span>
                    <span className="font-bold text-[#211D1B] text-xs mt-0.5 block">
                      {selectedBooking.guestCount} Guests
                    </span>
                  </div>

                  <div className="col-span-2 p-2.5 rounded-xl bg-[#FFFDFC] border border-[#E8DDD3]">
                    <span className="text-[#756B65] block text-[10px] uppercase font-semibold">Venue Location</span>
                    <span className="font-semibold text-[#211D1B] text-xs mt-0.5 block">
                      {selectedBooking.locationName}
                      {selectedBooking.locationAddress ? ` · ${selectedBooking.locationAddress}` : ''}
                      {selectedBooking.city ? ` (${selectedBooking.city})` : ''}
                    </span>
                  </div>

                  {selectedBooking.theme && (
                    <div className="col-span-2 p-2.5 rounded-xl bg-[#FFFDFC] border border-[#E8DDD3]">
                      <span className="text-[#756B65] block text-[10px] uppercase font-semibold">Styling &amp; Theme Vision</span>
                      <span className="font-medium text-[#211D1B] text-xs mt-0.5 block">
                        {selectedBooking.theme}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Structured Package Scope, Deliverables & Requirements Cards */}
              {selectedBooking.specialRequirements && (
                <BookingDetailsCards specialRequirements={selectedBooking.specialRequirements} />
              )}

              {/* Package & Financial Breakdown */}
              <div className="p-4 rounded-2xl bg-[#F7F2EC]/70 border border-[#E8DDD3] space-y-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-[#FCECE8] text-[#B95650] flex items-center justify-center shrink-0">
                    <CreditCard className="w-3.5 h-3.5" />
                  </span>
                  <h4 className="font-bold text-[10.5px] uppercase tracking-[0.18em] text-[#B95650]">
                    Financial Status &amp; Investment
                  </h4>
                </div>

                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-[#756B65]">Selected Event Package / Plan:</span>
                  <span className="font-bold text-[#211D1B]">
                    {selectedBooking.package?.name || 'Custom Bespoke Event Production'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs py-1 border-t border-[#E8DDD3]/60">
                  <span className="text-[#756B65]">Total Contract Investment:</span>
                  <span className="font-sans font-black text-[#B95650] text-lg">
                    ETB {Number(selectedBooking.budgetEstimate || selectedBooking.package?.price || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-1 border-t border-[#E8DDD3]/60">
                  <span className="text-[#756B65]">50% Advance Booking Deposit:</span>
                  <span className="font-bold text-[#211D1B]">
                    ETB {Number((selectedBooking.budgetEstimate || selectedBooking.package?.price || 0) * 0.5).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#756B65]">Post-Event Settlement Balance:</span>
                  <span className="font-semibold text-[#756B65]">
                    ETB {Number((selectedBooking.budgetEstimate || selectedBooking.package?.price || 0) * 0.5).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Dedicated Coordinator Support Card */}
              {selectedBooking.assignedCoordinator ? (
                <div className="p-4 rounded-2xl bg-[#FFFDFC] border border-[#E8DDD3] flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#FCECE8] border border-[#E8B5A6] text-[#B95650] font-sans font-bold flex items-center justify-center text-sm">
                      {selectedBooking.assignedCoordinator.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-sans font-bold text-[#211D1B] text-sm">
                        {selectedBooking.assignedCoordinator.fullName}
                      </p>
                      <p className="text-[11px] text-[#756B65]">
                        Your Assigned Senior Event Director
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${selectedBooking.assignedCoordinator.phone}`}
                      className="px-4 py-1.5 rounded-full bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      Call Director
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-[#FFFDFC] border border-[#E8DDD3] text-[#756B65] text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#B95650] shrink-0" />
                  <span>Coordinator assignment in progress by the Azera Senior Operations Team.</span>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="pt-3.5 border-t border-[#E8DDD3]/80 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="px-6 py-2 rounded-full border border-[#E8DDD3] bg-[#FFFDFC] hover:bg-[#F7F2EC] text-[#211D1B] font-semibold transition cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Booking Modal Engine */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => {
          setBookingModalOpen(false);
          loadBookings();
        }}
      />
    </div>
  );
}
