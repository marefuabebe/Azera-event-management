import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  FileSpreadsheet,
  FileText,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Filter,
  Sparkles,
  Check,
  X,
  Printer,
  Download,
  RefreshCw,
  LayoutGrid,
  List,
  MessageSquare,
  ShieldCheck,
  Eye,
  ArrowUpRight,
  Tag,
  CreditCard,
  UserCheck,
  Building,
  HelpCircle,
  Phone,
  Mail
} from 'lucide-react';

export default function CustomerQuotationsPage() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [inspectorModalOpen, setInspectorModalOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [activeActionQuote, setActiveActionQuote] = useState(null);

  // Form feedback state
  const [acceptNote, setAcceptNote] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [actionErrorMsg, setActionErrorMsg] = useState('');

  // Filtering, Searching, Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('DATE_DESC');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(4);

  // Load Quotations from API
  const loadData = async () => {
    try {
      setLoading(true);
      setActionErrorMsg('');

      // 1. Fetch real quotations from backend
      let quoteList = [];
      try {
        const res = await api.getQuotations();
        if (res?.data?.quotations) {
          quoteList = res.data.quotations;
        }
      } catch (err) {
        console.warn('api.getQuotations error, using fallback:', err);
      }

      // 2. Fetch customer bookings to link contextual metadata
      let userBookings = [];
      try {
        const bRes = await api.getMyBookings();
        if (bRes?.data?.bookings && bRes.data.bookings.length > 0) {
          userBookings = bRes.data.bookings;
        }
      } catch (err) {
        console.warn('api.getMyBookings error:', err);
      }
      setBookings(userBookings);
      setQuotations(quoteList || []);
    } catch (err) {
      console.error('Error loading quotations:', err);
      setActionErrorMsg('Failed to load quotations. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Accept Quotation
  const handleAcceptQuotation = async () => {
    if (!activeActionQuote) return;
    try {
      setSubmittingAction(true);
      setActionErrorMsg('');

      await api.acceptQuotation(activeActionQuote.id, acceptNote);

      setActionSuccessMsg(
        `Quotation v${activeActionQuote.version} for ${activeActionQuote.booking?.reference} was approved! Our production team is now generating your binding service contract.`
      );
      setAcceptModalOpen(false);
      setActiveActionQuote(null);
      setAcceptNote('');
      await loadData();
    } catch (err) {
      console.error('Accept error:', err);
      setActionErrorMsg(err.message || 'Failed to accept quotation. Please try again.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Request Revisions / Feedback
  const handleRequestRevision = async () => {
    if (!activeActionQuote) return;
    if (!revisionReason.trim()) {
      setActionErrorMsg('Please specify the budget or service adjustments you would like our coordinator to revise.');
      return;
    }

    try {
      setSubmittingAction(true);
      setActionErrorMsg('');

      await api.rejectQuotation(activeActionQuote.id, revisionReason, true);

      setActionSuccessMsg(
        `Your revision notes for Quotation v${activeActionQuote.version} were transmitted to lead coordinator ${activeActionQuote.createdBy?.fullName || 'Sara Hailu'}. A revised proposal version will be issued shortly.`
      );
      setRevisionModalOpen(false);
      setActiveActionQuote(null);
      setRevisionReason('');
      await loadData();
    } catch (err) {
      console.error('Revision error:', err);
      setActionErrorMsg(err.message || 'Failed to submit revision request.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Trigger Print Quotation
  const handlePrintQuotation = (quote) => {
    setSelectedQuote(quote);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Filter and Sort Logic
  const filteredQuotations = quotations.filter((q) => {
    const searchMatch =
      q.booking?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.booking?.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.createdBy?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.notes?.toLowerCase().includes(searchQuery.toLowerCase());

    const statusMatch = statusFilter === 'ALL' || q.status === statusFilter;
    const typeMatch = eventTypeFilter === 'ALL' || q.booking?.eventType === eventTypeFilter;

    return searchMatch && statusMatch && typeMatch;
  });

  const sortedQuotations = [...filteredQuotations].sort((a, b) => {
    if (sortBy === 'DATE_DESC') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (sortBy === 'DATE_ASC') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    }
    if (sortBy === 'AMOUNT_HIGH') {
      return Number(b.totalAmount) - Number(a.totalAmount);
    }
    if (sortBy === 'AMOUNT_LOW') {
      return Number(a.totalAmount) - Number(b.totalAmount);
    }
    if (sortBy === 'VERSION_DESC') {
      return b.version - a.version;
    }
    return 0;
  });

  // Pagination calculation
  const totalItems = sortedQuotations.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedQuotations.slice(indexOfFirstItem, indexOfLastItem);

  // Status Styling Badge Helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shrink-0 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Pending Review</span>
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Approved</span>
          </span>
        );
      case 'CHANGE_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0 shadow-2xs">
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Revisions Requested</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FCECE8] text-[#B95650] border border-[#E8B5A6] whitespace-nowrap shrink-0 shadow-2xs">
            <X className="w-3.5 h-3.5 text-[#B95650] shrink-0" />
            <span>Declined</span>
          </span>
        );
      case 'SUPERSEDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-[#E8DDD3] whitespace-nowrap shrink-0">
            <AlertCircle className="w-3.5 h-3.5 text-[#756B65] shrink-0" />
            <span>Archived</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-[#E8DDD3] whitespace-nowrap shrink-0">
            <span>{status}</span>
          </span>
        );
    }
  };

  // Helper: Format ETB Currency
  const formatETB = (val) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      maximumFractionDigits: 0
    }).format(num);
  };

  // Overview KPI Metrics
  const activeProposalsCount = quotations.filter((q) => q.status === 'SENT').length;
  const approvedCount = quotations.filter((q) => q.status === 'ACCEPTED').length;
  const totalBudgetSum = quotations
    .filter((q) => q.status !== 'REJECTED' && q.status !== 'SUPERSEDED')
    .reduce((sum, q) => sum + Number(q.totalAmount || 0), 0);
  const pendingInitialDeposit = quotations
    .filter((q) => q.status === 'SENT')
    .reduce((sum, q) => sum + Number(q.initialPaymentRequired || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Title & Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFDFC] p-6 rounded-2xl border border-[#E8DDD3] shadow-2xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-[#E8DDD3] text-xs font-bold text-slate-700 mb-2">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#B95650]" />
            <span>Official Event Proposals & Pricing</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#211D1B] tracking-tight">
            Quotations & Estimates
          </h1>
          <p className="text-sm text-[#756B65] mt-1 max-w-2xl leading-relaxed">
            Review detailed service breakdowns, transparent pricing schedules, and 50% initial payment schedules prepared by your dedicated Eventora Lead Coordinator.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            title="Refresh Quotations"
            className="p-2.5 rounded-xl border border-[#E8DDD3] text-slate-600 hover:text-[#211D1B] hover:bg-[#F7F2EC]/50 transition-colors shadow-2xs flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#B95650]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            to="/portal/bookings"
            className="px-4 py-2.5 rounded-xl bg-[#B95650] hover:bg-[#a84842] text-white font-bold text-xs shadow-xs shadow-[#B95650]/20 hover:shadow-sm transition-all flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            <span>View Related Bookings</span>
          </Link>
        </div>
      </div>

      {/* Notifications Alert Banner */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-800 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{actionSuccessMsg}</div>
          <button onClick={() => setActionSuccessMsg('')} className="text-emerald-500 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-4 rounded-xl bg-[#FCECE8] border border-[#E8B5A6] flex items-start gap-3 text-xs text-[#B95650] shadow-2xs">
          <AlertCircle className="w-4 h-4 text-[#B95650] shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{actionErrorMsg}</div>
          <button onClick={() => setActionErrorMsg('')} className="text-[#B95650] hover:text-[#B95650]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Overview KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8DDD3] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#756B65]">
              Awaiting Approval
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#211D1B]">{activeProposalsCount}</span>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              Action Required
            </span>
          </div>
          <p className="text-[11px] text-[#756B65] mt-1">Pending your formal customer review</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8DDD3] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#756B65]">
              Approved Proposals
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#211D1B]">{approvedCount}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Contract Ready
            </span>
          </div>
          <p className="text-[11px] text-[#756B65] mt-1">Ready for contract execution</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8DDD3] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#756B65]">
              Active Budget Total
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-[#E8DDD3] flex items-center justify-center text-slate-700">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black text-[#211D1B]">{formatETB(totalBudgetSum)}</span>
          </div>
          <p className="text-[11px] text-[#756B65] mt-1">Aggregate value across active events</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8DDD3] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#756B65]">
              Upcoming 50% Deposits
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black text-[#211D1B]">{formatETB(pendingInitialDeposit)}</span>
          </div>
          <p className="text-[11px] text-[#756B65] mt-1">Initial payment required to lock dates</p>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Sorting & View Mode Switcher */}
      <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8DDD3] shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#756B65] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by event, reference, coordinator, or notes..."
              className="w-full pl-10 pr-4 py-2 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-medium text-[#211D1B] placeholder:text-[#756B65] focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-colors"
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

          {/* Right Action Tools: Event Type, Sort, View Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Event Type Filter */}
            <div className="relative">
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors focus:outline-hidden focus:border-[#B95650] cursor-pointer"
              >
                <option value="ALL">All Event Types</option>
                <option value="WEDDING">Weddings</option>
                <option value="BIRTHDAY">Birthdays</option>
                <option value="CORPORATE">Corporate Events</option>
                <option value="CONCERT">Concerts & Shows</option>
                <option value="EXHIBITION">Exhibitions</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#756B65] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Sort Selector */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors focus:outline-hidden focus:border-[#B95650] cursor-pointer"
              >
                <option value="DATE_DESC">Date: Newest First</option>
                <option value="DATE_ASC">Date: Oldest First</option>
                <option value="AMOUNT_HIGH">Amount: High to Low</option>
                <option value="AMOUNT_LOW">Amount: Low to High</option>
                <option value="VERSION_DESC">Version: Highest First</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#756B65] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-[#E8DDD3]">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid Cards View"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-[#FFFDFC] text-[#B95650] shadow-xs'
                    : 'text-[#756B65] hover:text-[#211D1B]'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Table View"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table'
                    ? 'bg-[#FFFDFC] text-[#B95650] shadow-xs'
                    : 'text-[#756B65] hover:text-[#211D1B]'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 border-t border-[#E8DDD3]">
          {[
            { id: 'ALL', label: 'All Quotations', count: quotations.length },
            { id: 'SENT', label: 'Pending Review', count: quotations.filter((q) => q.status === 'SENT').length },
            { id: 'ACCEPTED', label: 'Accepted & Approved', count: quotations.filter((q) => q.status === 'ACCEPTED').length },
            { id: 'CHANGE_REQUESTED', label: 'Revisions Requested', count: quotations.filter((q) => q.status === 'CHANGE_REQUESTED').length },
            { id: 'SUPERSEDED', label: 'Archived Versions', count: quotations.filter((q) => q.status === 'SUPERSEDED').length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-[#F7F2EC] text-slate-600 hover:bg-slate-100 border border-[#E8DDD3]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  statusFilter === tab.id ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-[#FFFDFC] p-16 rounded-2xl border border-[#E8DDD3] text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#B95650] animate-spin mx-auto" />
          <h3 className="text-sm font-bold text-[#211D1B]">Loading Quotations & Proposals...</h3>
          <p className="text-xs text-[#756B65]">Accessing verified budget schedules and coordinator riders.</p>
        </div>
      ) : sortedQuotations.length === 0 ? (
        <div className="bg-[#FFFDFC] p-16 rounded-2xl border border-[#E8DDD3] text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-[#E8DDD3] flex items-center justify-center text-[#756B65] mx-auto">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#211D1B]">No Quotations Found</h3>
            <p className="text-xs text-[#756B65] max-w-md mx-auto mt-1">
              {searchQuery || statusFilter !== 'ALL' || eventTypeFilter !== 'ALL'
                ? 'No quotations match your current search and filter criteria. Try resetting filters.'
                : 'Your event inquiries are currently being reviewed by our lead coordinators. Itemized quotations will appear here once drafted.'}
            </p>
          </div>
          {(searchQuery || statusFilter !== 'ALL' || eventTypeFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setEventTypeFilter('ALL');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= GRID VIEW ================= */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {currentItems.map((quote) => (
            <div
              key={quote.id}
              className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] shadow-2xs hover:shadow-xs transition-all overflow-hidden flex flex-col justify-between"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-[#E8DDD3] bg-[#F7F2EC]">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 border border-[#E8DDD3] px-2 py-0.5 rounded-md shrink-0">
                        {quote.booking?.reference || 'EVT-PROPOSAL'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#B95650]/10 text-[#B95650] border border-[#B95650]/20 font-mono shrink-0">
                        v{quote.version}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] text-[#756B65] font-medium shrink-0">
                        Issued {new Date(quote.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#211D1B] pt-0.5 truncate">
                      {quote.booking?.title || 'Eventora Custom Proposal'}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-[#756B65] pt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#756B65]" />
                        {quote.booking?.locationName || 'Addis Ababa'}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#756B65]" />
                        {quote.booking?.preferredDate ? new Date(quote.booking.preferredDate).toLocaleDateString() : 'Date Pending'}
                      </span>
                      {quote.booking?.guestCount && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-[#756B65]" />
                            {quote.booking.guestCount} Guests
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {getStatusBadge(quote.status)}
                  </div>
                </div>
              </div>

              {/* Financial Breakdown Summary Box */}
              <div className="p-5 space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F7F2EC] border border-[#E8DDD3]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#756B65]">
                      Total Quotation Value
                    </span>
                    <div className="text-lg font-black text-[#211D1B] mt-0.5">
                      {formatETB(quote.totalAmount)}
                    </div>
                    <div className="text-[10px] text-[#756B65] mt-0.5">
                      Subtotal: {formatETB(quote.subtotal)}
                    </div>
                  </div>

                  <div className="border-l border-[#E8DDD3] pl-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      50% Initial Deposit
                    </span>
                    <div className="text-lg font-black text-amber-900 mt-0.5">
                      {formatETB(quote.initialPaymentRequired)}
                    </div>
                    <div className="text-[10px] text-[#756B65] mt-0.5">
                      Balance: {formatETB(quote.finalPaymentDue)}
                    </div>
                  </div>
                </div>

                {/* Service Items Count & Notes Snippet */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-bold flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#756B65]" />
                      Itemized Line Items ({quote.lineItems?.length || 0})
                    </span>
                    <span className="text-[#756B65] text-[11px]">
                      Coordinator: {quote.createdBy?.fullName || 'Assigned Producer'}
                    </span>
                  </div>

                  {quote.notes && (
                    <p className="text-[#756B65] text-[11px] bg-[#F7F2EC]/80 p-2.5 rounded-lg border border-[#E8DDD3] line-clamp-2 italic">
                      "{quote.notes}"
                    </p>
                  )}

                  {/* Customer Response / Feedback if present */}
                  {quote.customerResponseNote && (
                    <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-900">
                      <span className="font-bold">Your feedback: </span>
                      <span>"{quote.customerResponseNote}"</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 bg-[#F7F2EC]/80 border-t border-[#E8DDD3] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedQuote(quote);
                      setInspectorModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-[#E8DDD3] bg-[#FFFDFC] hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#756B65]" />
                    <span>View Breakdown</span>
                  </button>

                  <button
                    onClick={() => handlePrintQuotation(quote)}
                    title="Print or Save Official Proposal Sheet"
                    className="p-1.5 rounded-xl border border-[#E8DDD3] bg-[#FFFDFC] hover:bg-slate-100 text-slate-600 hover:text-[#211D1B] text-xs transition-colors shadow-2xs"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Action buttons based on status */}
                  {quote.status === 'SENT' && (
                    <>
                      <button
                        onClick={() => {
                          setActiveActionQuote(quote);
                          setRevisionModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 bg-[#FFFDFC] hover:bg-[#F7F2EC]/50 text-slate-700 font-bold text-xs transition-colors"
                      >
                        Request Changes
                      </button>

                      <button
                        onClick={() => {
                          setActiveActionQuote(quote);
                          setAcceptModalOpen(true);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-[#B95650] hover:bg-[#a84842] text-white font-bold text-xs shadow-xs shadow-[#B95650]/20 hover:shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Proposal</span>
                      </button>
                    </>
                  )}

                  {quote.status === 'ACCEPTED' && (
                    <Link
                      to="/portal/contracts"
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Proceed to Contract</span>
                    </Link>
                  )}

                  {quote.status === 'CHANGE_REQUESTED' && (
                    <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Coordinator revising...</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ================= TABLE VIEW ================= */
        <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F2EC]/80 border-b border-[#E8DDD3] text-[#756B65] uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-4">Proposal Reference</th>
                  <th className="py-3 px-4">Event Details</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Total Budget</th>
                  <th className="py-3 px-4">50% Deposit</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DDD3]/50">
                {currentItems.map((quote) => (
                  <tr key={quote.id} className="hover:bg-[#F7F2EC]/50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-[#211D1B]">
                        {quote.booking?.reference || 'EVT-PROPOSAL'}
                      </div>
                      <div className="text-[10px] text-[#756B65] mt-0.5">
                        Issued {new Date(quote.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#211D1B] max-w-xs truncate">
                        {quote.booking?.title || 'Custom Event'}
                      </div>
                      <div className="text-[11px] text-[#756B65] flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3 h-3 text-[#756B65] shrink-0" />
                        <span className="truncate max-w-xs">{quote.booking?.locationName || 'Addis Ababa'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#B95650]/10 text-[#B95650] border border-[#B95650]/20 font-mono">
                        v{quote.version}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-[#211D1B] text-sm">
                        {formatETB(quote.totalAmount)}
                      </div>
                      <div className="text-[10px] text-[#756B65] mt-0.5">
                        Subtotal: {formatETB(quote.subtotal)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-amber-900">
                        {formatETB(quote.initialPaymentRequired)}
                      </div>
                      <div className="text-[10px] text-[#756B65] mt-0.5">Upon signing</div>
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(quote.status)}</td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedQuote(quote);
                            setInspectorModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-[#E8DDD3] bg-[#FFFDFC] hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                        >
                          View
                        </button>

                        {quote.status === 'SENT' && (
                          <button
                            onClick={() => {
                              setActiveActionQuote(quote);
                              setAcceptModalOpen(true);
                            }}
                            className="px-3 py-1 rounded-lg bg-[#B95650] hover:bg-[#a84842] text-white font-bold text-xs shadow-xs shadow-[#B95650]/20 transition-all"
                          >
                            Approve
                          </button>
                        )}

                        {quote.status === 'ACCEPTED' && (
                          <Link
                            to="/portal/contracts"
                            className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-black text-white font-bold text-xs transition-colors"
                          >
                            Contract
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8DDD3] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-[#756B65] font-medium">
            Showing <span className="font-bold text-[#211D1B]">{indexOfFirstItem + 1}</span> to{' '}
            <span className="font-bold text-[#211D1B]">{Math.min(indexOfLastItem, totalItems)}</span> of{' '}
            <span className="font-bold text-[#211D1B]">{totalItems}</span> proposals
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-[#E8DDD3] text-slate-600 hover:bg-[#F7F2EC]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-[#E8DDD3] text-slate-600 hover:bg-[#F7F2EC]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                  currentPage === page
                    ? 'bg-[#B95650] text-white shadow-xs shadow-[#B95650]/30'
                    : 'text-slate-600 hover:bg-slate-100 border border-[#E8DDD3]'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-[#E8DDD3] text-slate-600 hover:bg-[#F7F2EC]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-[#E8DDD3] text-slate-600 hover:bg-[#F7F2EC]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#756B65]">
            <span>Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-[#F7F2EC] border border-[#E8DDD3] rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
            >
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={12}>12</option>
            </select>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. DETAILED PROPOSAL INSPECTOR MODAL - FIXED VIEWPORT FIT */}
      {/* ========================================================= */}
      {inspectorModalOpen && selectedQuote && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FFFDFC] rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-[#E8DDD3] flex flex-col text-[#211D1B] overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header - Fixed Top */}
            <div className="p-4 sm:p-5 border-b border-[#E8DDD3] flex items-start justify-between bg-[#FFFDFC] shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-[#E8DDD3]">
                    {selectedQuote.booking?.reference}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#B95650]/10 text-[#B95650] border border-[#B95650]/20 font-mono">
                    Quotation v{selectedQuote.version}
                  </span>
                  {getStatusBadge(selectedQuote.status)}
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#211D1B]">
                  {selectedQuote.booking?.title}
                </h2>
                <p className="text-xs text-[#756B65]">
                  Lead Coordinator: <span className="font-semibold text-slate-700">{selectedQuote.createdBy?.fullName || 'Sara Hailu'}</span> ({selectedQuote.createdBy?.email || 'sara.coordinator@eventora.et'})
                </p>
              </div>

              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={() => handlePrintQuotation(selectedQuote)}
                  title="Print Quotation"
                  className="p-2 rounded-xl border border-[#E8DDD3] hover:bg-[#F7F2EC]/50 text-slate-600 transition-colors shadow-2xs"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setInspectorModalOpen(false)}
                  className="p-2 rounded-xl text-[#756B65] hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Inner Scrollable Container */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Event & Booking Context Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#F7F2EC] border border-[#E8DDD3] text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#756B65] tracking-wider">Event Date</span>
                  <div className="font-bold text-[#211D1B] mt-0.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#756B65]" />
                    {selectedQuote.booking?.preferredDate ? new Date(selectedQuote.booking.preferredDate).toLocaleDateString() : 'N/A'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-[#756B65] tracking-wider">Venue Location</span>
                  <div className="font-bold text-[#211D1B] mt-0.5 flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#756B65] shrink-0" />
                    <span className="truncate">{selectedQuote.booking?.locationName || 'Addis Ababa'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-[#756B65] tracking-wider">Guest Count</span>
                  <div className="font-bold text-[#211D1B] mt-0.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#756B65]" />
                    {selectedQuote.booking?.guestCount || 'Custom'} Guests
                  </div>
                </div>
              </div>

              {/* Price Offer Notice */}
              <div className="p-3 bg-slate-50 border border-[#E8DDD3] rounded-xl text-xs text-[#756B65] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#B95650] shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold text-[#211D1B]">Price Offer Notice: </span>
                  This quotation is an itemized price offer for the requested services. Quotation acceptance initiates formal contract drafting. Official booking confirmation occurs only after dual contract execution and verified 50% initial payment.
                </div>
              </div>

              {/* Itemized Service Breakdown Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#B95650]" />
                    <span>Itemized Service Deliverables ({selectedQuote.lineItems?.length || 0})</span>
                  </h3>
                  <span className="text-[11px] text-[#756B65] font-mono">Currency: ETB</span>
                </div>

                <div className="border border-[#E8DDD3] rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F7F2EC] border-b border-[#E8DDD3] text-[10px] font-bold text-[#756B65] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Service & Deliverable</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8DDD3]/50">
                      {selectedQuote.lineItems && selectedQuote.lineItems.length > 0 ? (
                        selectedQuote.lineItems.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-[#F7F2EC]/40">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-[#211D1B]">{item.serviceTitle}</div>
                              {item.notes && <div className="text-[10px] text-[#756B65] mt-0.5">{item.notes}</div>}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                {item.category?.replace('_', ' ') || 'SERVICE'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {formatETB(item.unitPrice)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#211D1B]">
                              {formatETB(item.lineTotal)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-[#756B65] italic">
                            No line items listed. Package pricing applied.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary & Split */}
              <div className="p-4 rounded-xl bg-[#F7F2EC] border border-[#E8DDD3] space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal (Direct Services):</span>
                  <span className="font-mono font-bold text-[#211D1B]">{formatETB(selectedQuote.subtotal)}</span>
                </div>
                {Number(selectedQuote.discount) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Special Promotional Discount:</span>
                    <span className="font-mono font-bold">-{formatETB(selectedQuote.discount)}</span>
                  </div>
                )}
                {Number(selectedQuote.taxAndFees) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Taxes, Logistics & Permitting (VAT/Service):</span>
                    <span className="font-mono font-bold text-[#211D1B]">+{formatETB(selectedQuote.taxAndFees)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-[#E8DDD3] flex justify-between text-sm font-extrabold text-[#211D1B]">
                  <span>Total Quotation Amount:</span>
                  <span className="text-[#B95650] font-mono text-base">{formatETB(selectedQuote.totalAmount)}</span>
                </div>

                {/* 50% / 50% Milestone Schedule */}
                <div className="mt-3 pt-3 border-t border-[#E8DDD3] grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                    <span className="font-bold uppercase tracking-wider text-[10px] block text-amber-800">
                      1st Deposit (50% Due Upon Contract)
                    </span>
                    <span className="text-base font-extrabold font-mono block mt-0.5 text-amber-950">
                      {formatETB(selectedQuote.initialPaymentRequired)}
                    </span>
                    <span className="text-[10px] text-amber-700">Secures vendors, crew & reservation</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-100 border border-[#E8DDD3] text-[#211D1B]">
                    <span className="font-bold uppercase tracking-wider text-[10px] block text-[#756B65]">
                      2nd Balance (50% Due Post-Event)
                    </span>
                    <span className="text-base font-extrabold font-mono block mt-0.5 text-[#211D1B]">
                      {formatETB(selectedQuote.finalPaymentDue)}
                    </span>
                    <span className="text-[10px] text-[#756B65]">Upon complete satisfactory delivery</span>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions Notice */}
              {selectedQuote.paymentTerms && (
                <div className="text-xs text-[#756B65] space-y-1">
                  <span className="font-bold text-slate-700 block">Payment Terms & Validity:</span>
                  <p className="leading-relaxed bg-[#F7F2EC] p-3 rounded-xl border border-[#E8DDD3] text-slate-600">
                    {selectedQuote.paymentTerms}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer - Fixed at Bottom */}
            <div className="p-4 sm:p-5 bg-[#F7F2EC] border-t border-[#E8DDD3] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => setInspectorModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#FFFDFC] hover:bg-slate-100 text-slate-700 border border-[#E8DDD3] text-xs font-bold transition-colors shadow-2xs"
              >
                Close Inspector
              </button>

              <div className="flex items-center gap-2">
                {selectedQuote.status === 'SENT' && (
                  <>
                    <button
                      onClick={() => {
                        setInspectorModalOpen(false);
                        setActiveActionQuote(selectedQuote);
                        setRevisionModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-300 bg-[#FFFDFC] hover:bg-[#F7F2EC]/50 text-slate-700 text-xs font-bold transition-colors shadow-2xs"
                    >
                      Request Changes
                    </button>
                    <button
                      onClick={() => {
                        setInspectorModalOpen(false);
                        setActiveActionQuote(selectedQuote);
                        setAcceptModalOpen(true);
                      }}
                      className="px-5 py-2 rounded-xl bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold shadow-xs shadow-[#B95650]/20 transition-all flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve & Accept Proposal</span>
                    </button>
                  </>
                )}

                {selectedQuote.status === 'ACCEPTED' && (
                  <Link
                    to="/portal/contracts"
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View Generated Contract</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. ACCEPT QUOTATION CONFIRMATION MODAL - FIXED VIEWPORT FIT */}
      {/* ========================================================= */}
      {acceptModalOpen && activeActionQuote && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FFFDFC] rounded-2xl max-w-lg w-full max-h-[90vh] shadow-2xl border border-[#E8DDD3] flex flex-col text-[#211D1B] overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E8DDD3] flex items-start justify-between bg-[#FFFDFC] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#211D1B]">Approve Event Quotation</h3>
                  <p className="text-xs text-[#756B65]">
                    {activeActionQuote.booking?.reference} · Version {activeActionQuote.version}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAcceptModalOpen(false)}
                className="text-[#756B65] hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div className="p-3.5 rounded-xl bg-[#F7F2EC] border border-[#E8DDD3] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#756B65]">Event Title:</span>
                  <span className="font-bold text-[#211D1B]">{activeActionQuote.booking?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#756B65]">Total Agreed Amount:</span>
                  <span className="font-extrabold text-[#211D1B] font-mono">
                    {formatETB(activeActionQuote.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-amber-800">
                  <span className="font-medium">Initial 50% Payment Upon Contract:</span>
                  <span className="font-extrabold font-mono">
                    {formatETB(activeActionQuote.initialPaymentRequired)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Customer Acceptance Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={acceptNote}
                  onChange={(e) => setAcceptNote(e.target.value)}
                  placeholder="Add any specific comments or preferred dates for contract signing..."
                  className="w-full p-3 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs text-[#211D1B] focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-colors"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <span>
                  A quotation is a price offer, not a contract. By approving this quotation, Eventora will prepare your binding service agreement contract for dual signing. Official booking confirmation occurs only after contract execution and verified 50% initial payment.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#F7F2EC] border-t border-[#E8DDD3] flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => setAcceptModalOpen(false)}
                disabled={submittingAction}
                className="px-4 py-2 rounded-xl bg-[#FFFDFC] hover:bg-slate-100 border border-[#E8DDD3] text-slate-700 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptQuotation}
                disabled={submittingAction}
                className="px-5 py-2 rounded-xl bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold shadow-xs shadow-[#B95650]/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {submittingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Acceptance...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Accept</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. REQUEST REVISIONS / FEEDBACK MODAL - FIXED VIEWPORT FIT */}
      {/* ========================================================= */}
      {revisionModalOpen && activeActionQuote && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FFFDFC] rounded-2xl max-w-lg w-full max-h-[90vh] shadow-2xl border border-[#E8DDD3] flex flex-col text-[#211D1B] overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E8DDD3] flex items-start justify-between bg-[#FFFDFC] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#211D1B]">Request Proposal Revision</h3>
                  <p className="text-xs text-[#756B65]">
                    {activeActionQuote.booking?.reference} · Version {activeActionQuote.version}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRevisionModalOpen(false)}
                className="text-[#756B65] hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <p className="text-xs text-slate-600 leading-relaxed">
                Describe any budget modifications, service alterations, or adjustments you need. Lead Coordinator{' '}
                <span className="font-bold text-[#211D1B]">
                  {activeActionQuote.createdBy?.fullName || 'Sara Hailu'}
                </span>{' '}
                will generate a revised proposal version (v{activeActionQuote.version + 1}).
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Requested Adjustments & Feedback <span className="text-[#B95650]">*</span>
                </label>
                <textarea
                  rows={4}
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  placeholder="Example: Please replace the drone cinematography with an additional 50 floral table runners and adjust the sound package..."
                  className="w-full p-3 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs text-[#211D1B] focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-colors"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#F7F2EC] border-t border-[#E8DDD3] flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => setRevisionModalOpen(false)}
                disabled={submittingAction}
                className="px-4 py-2 rounded-xl bg-[#FFFDFC] hover:bg-slate-100 border border-[#E8DDD3] text-slate-700 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestRevision}
                disabled={submittingAction || !revisionReason.trim()}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {submittingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting Feedback...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Submit Revision Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
