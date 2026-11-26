import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  AlertTriangle,
  Users,
  Clock,
  Calendar,
  Search,
  Filter,
  X,
  RefreshCw,
  Download,
  ChevronRight,
  Eye,
  Mail,
  Send,
  Building,
  CheckCircle2,
  FileText,
  CreditCard,
  Receipt,
  User,
  ArrowUpDown,
  Check,
  AlertCircle
} from 'lucide-react';

const formatETB = (amount) => {
  const num = Number(amount) || 0;
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ETB`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatEventType = (type) => {
  if (!type) return 'Event';
  return type
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export default function FinanceOutstandingBalancesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState([]);
  const [summary, setSummary] = useState({
    totalOutstanding: 0,
    customersWithBalances: 0,
    dueSoonAmount: 0,
    overdueAmount: 0,
    totalBookingsWithBalances: 0,
    totalContractedValue: 0,
    totalVerifiedPaid: 0
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterStatus, setFilterStatus] = useState('OUTSTANDING_ONLY'); // 'OUTSTANDING_ONLY' | 'ALL' | 'DUE_SOON' | 'OVERDUE' | 'PARTIALLY_PAID' | 'PAID'
  const [dateRange, setDateRange] = useState('OCT_2026');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState('eventDate');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState(null);

  // Modals & Drawers
  const [selectedBalance, setSelectedBalance] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [reminderModal, setReminderModal] = useState({ open: false, balance: null, customNote: '', submitting: false });

  // Load balances from backend
  const loadBalances = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pageSize.toString());
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (filterEventType) params.append('eventType', filterEventType);
      if (filterStatus && filterStatus !== 'ALL') params.append('paymentStatus', filterStatus);

      if (dateRange === 'OCT_2026') {
        params.append('startDate', '2026-10-01');
        params.append('endDate', '2026-10-31');
      } else if (dateRange === 'LAST_30_DAYS') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.append('startDate', d.toISOString().split('T')[0]);
      } else if (dateRange === 'THIS_QUARTER') {
        params.append('startDate', '2026-10-01');
        params.append('endDate', '2026-12-31');
      }

      const res = await api.getOutstandingBalances(`?${params.toString()}`);
      if (res && res.data) {
        setBalances(res.data.balances || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load outstanding balances:', err);
      showToast('Failed to load customer balances.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, pageSize, sortBy, sortOrder, searchTerm, filterEventType, filterStatus, dateRange, showToast]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  // Details drawer handler
  const handleOpenDetails = (item) => {
    setSelectedBalance(item);
    setDetailsDrawerOpen(true);
  };

  // Open reminder modal
  const handleOpenReminder = (item) => {
    setReminderModal({ open: true, balance: item, customNote: '', submitting: false });
  };

  // Submit reminder
  const handleSendReminder = async () => {
    if (!reminderModal.balance) return;
    try {
      setReminderModal((prev) => ({ ...prev, submitting: true }));
      const res = await api.sendPaymentReminder(reminderModal.balance.bookingId, {
        customNote: reminderModal.customNote
      });

      if (res && res.success) {
        showToast(
          `Payment reminder sent to ${reminderModal.balance.customer?.fullName || 'customer'}.`,
          'success'
        );
        setReminderModal({ open: false, balance: null, customNote: '', submitting: false });
      }
    } catch (err) {
      console.error('Failed to send reminder:', err);
      showToast(err.message || 'Failed to dispatch payment reminder.', 'error');
      setReminderModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!balances || balances.length === 0) {
      showToast('No customer balance records available to export.', 'error');
      return;
    }

    const headers = [
      'Customer',
      'Phone',
      'Booking Ref',
      'Event Title',
      'Event Type',
      'Event Date',
      'Contract Value (ETB)',
      'Verified Paid (ETB)',
      'Refunded (ETB)',
      'Net Paid (ETB)',
      'Outstanding Balance (ETB)',
      'Next Due Date',
      'Next Stage',
      'Payment Status'
    ];

    const rows = balances.map((b) => [
      `"${b.customer?.fullName || 'Client'}"`,
      b.customer?.phone || '',
      b.reference || '',
      `"${b.title || ''}"`,
      formatEventType(b.eventType),
      formatDate(b.eventDate),
      b.contractValue,
      b.verifiedPaid,
      b.refundedAmount,
      b.netPaid,
      b.outstanding,
      formatDate(b.nextDueDate),
      b.nextStage === 'INITIAL_DEPOSIT' ? 'Initial 50%' : 'Final 50%',
      b.paymentStatus
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Eventora_Outstanding_Balances_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${balances.length} customer balances as CSV.`, 'success');
  };

  const hasActiveFilters = Boolean(
    searchTerm || filterEventType || (filterStatus && filterStatus !== 'OUTSTANDING_ONLY')
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterEventType('');
    setFilterStatus('OUTSTANDING_ONLY');
    setPage(1);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* 1. Page Header matching Eventora Design System */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <Link to="/company/dashboard" className="hover:text-[#F20047] transition-colors">
              Company Portal
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/company/finance" className="hover:text-[#F20047] transition-colors">
              Finance
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Outstanding Balances</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Outstanding Balances
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Monitor customer unpaid amounts and upcoming payment obligations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Fiscal Date Range Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="OCT_2026">Oct 1, 2026 – Oct 31, 2026</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
              <option value="THIS_QUARTER">Q4 2026</option>
              <option value="ALL_TIME">All Fiscal Periods</option>
            </select>
          </div>

          {/* Sync Button */}
          <button
            onClick={() => loadBalances(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Sync Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F20047]' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Filter Toggle */}
          <button
            onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 border text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer ${
              filterDrawerOpen || hasActiveFilters
                ? 'bg-rose-50 border-rose-300 text-[#F20047]'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#F20047]" />
            )}
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F20047] hover:bg-[#d9003e] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 2. Four Summary Cards (Backend Reconciled Figures) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Outstanding */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-[#F20047] mb-3">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500">Total Outstanding</p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {formatETB(summary.totalOutstanding)}
          </div>
          <div className="mt-2 text-[11px] font-medium flex items-center gap-1.5 text-slate-400">
            <span className="text-[#F20047] font-bold">Uncollected funds</span>
            <span>across signed contracts</span>
          </div>
        </div>

        {/* Card 2: Customers with Balances */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 mb-3">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500">Customers with Balances</p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {summary.customersWithBalances.toLocaleString('en-US')}
          </div>
          <div className="mt-2 text-[11px] font-bold flex items-center gap-1 text-blue-600">
            <User className="w-3 h-3" />
            <span>{summary.totalBookingsWithBalances} active contracted events</span>
          </div>
        </div>

        {/* Card 3: Due Soon */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500">Due Soon</p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {formatETB(summary.dueSoonAmount)}
          </div>
          <div className="mt-2 text-[11px] font-bold flex items-center gap-1 text-amber-600">
            <Clock className="w-3 h-3" />
            <span>Approaching contractual dates (≤ 7 days)</span>
          </div>
        </div>

        {/* Card 4: Overdue Balances */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200/60 flex items-center justify-center text-red-600 mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500">Overdue Balances</p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {formatETB(summary.overdueAmount)}
          </div>
          <div className="mt-2 text-[11px] font-bold flex items-center gap-1 text-red-600">
            <AlertCircle className="w-3 h-3" />
            <span>Past contractual payment deadline</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search customer, booking ref, event title..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Event Type Filter */}
          <div>
            <select
              value={filterEventType}
              onChange={(e) => {
                setFilterEventType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">All Event Types</option>
              <option value="WEDDING">Wedding Celebration</option>
              <option value="BIRTHDAY">Birthday Party</option>
              <option value="CORPORATE">Corporate Conference</option>
              <option value="SHIMGLINA">Traditional Shimglina</option>
              <option value="GRADUATION">Graduation Celebration</option>
              <option value="MEMORIAL">Memorial / Funeral</option>
              <option value="OTHER">Other Custom Event</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="OUTSTANDING_ONLY">All Outstanding Balances</option>
              <option value="OVERDUE">Overdue Only</option>
              <option value="DUE_SOON">Due Soon (≤ 7 Days)</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="NOT_YET_DUE">Not Yet Due</option>
              <option value="PAID">Fully Settled (Paid)</option>
              <option value="ALL">All Records (Incl. Fully Paid)</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="eventDate">Sort by Event Date</option>
              <option value="outstanding">Sort by Outstanding Amount</option>
              <option value="contractValue">Sort by Contract Value</option>
              <option value="nextDueDate">Sort by Due Date</option>
              <option value="customer">Sort by Customer Name</option>
            </select>
          </div>
        </div>

        {/* Secondary Extended Filters Drawer */}
        {filterDrawerOpen && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                Order:
              </span>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 transition-colors cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{sortOrder === 'asc' ? 'Ascending (Lowest first)' : 'Descending (Highest first)'}</span>
              </button>
            </div>
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Showing <strong className="text-slate-800">{balances.length}</strong> customer balance records
          </span>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-[#F20047] hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Customer Balances Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#F20047] animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Reconciling customer balances...
            </p>
          </div>
        ) : balances.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No outstanding customer balances</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              All contracted customer obligations under the selected criteria are fully settled or no records match your filter.
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Booking Ref</th>
                  <th className="py-3.5 px-4">Event Details</th>
                  <th className="py-3.5 px-4">Contract Value</th>
                  <th className="py-3.5 px-4">Verified Paid</th>
                  <th className="py-3.5 px-4">Outstanding</th>
                  <th className="py-3.5 px-4">Next Due Date</th>
                  <th className="py-3.5 px-4">Payment Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {balances.map((item) => {
                  const isPaid = item.outstanding <= 0;
                  const isOverdue = item.paymentStatus === 'OVERDUE';
                  const isDueSoon = item.paymentStatus === 'DUE_SOON' || item.paymentStatus === 'DUE';

                  return (
                    <tr key={item.bookingId} className="hover:bg-slate-50/80 transition-colors">
                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.customer?.fullName || 'Client'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 pl-5">
                          {item.customer?.phone || item.customer?.email || 'No contact info'}
                        </div>
                      </td>

                      {/* Booking Reference */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/60 text-[11px]">
                          {item.reference}
                        </span>
                      </td>

                      {/* Event Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {formatEventType(item.eventType)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatDate(item.eventDate)} • {item.city}
                        </div>
                      </td>

                      {/* Contract Value */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-700">
                        {formatETB(item.contractValue)}
                      </td>

                      {/* Verified Paid */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-emerald-700">
                          {formatETB(item.verifiedPaid)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${item.paymentProgress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {item.paymentProgress}%
                          </span>
                        </div>
                      </td>

                      {/* Outstanding */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`font-black text-sm ${isPaid ? 'text-slate-400' : 'text-[#F20047]'}`}>
                          {formatETB(item.outstanding)}
                        </span>
                      </td>

                      {/* Next Due Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.nextDueDate ? (
                          <div>
                            <div className={`font-semibold ${isOverdue ? 'text-red-700 font-bold' : isDueSoon ? 'text-amber-700' : 'text-slate-800'}`}>
                              {formatDate(item.nextDueDate)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {item.nextStage === 'INITIAL_DEPOSIT' ? 'Initial 50%' : 'Final Settlement'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Settled</span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-2.5 h-2.5" />
                            Paid
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Overdue
                          </span>
                        ) : isDueSoon ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-2.5 h-2.5" />
                            Due Soon
                          </span>
                        ) : item.paymentStatus === 'PARTIALLY_PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Partially Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Not Yet Due
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(item)}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>Details</span>
                          </button>

                          {!isPaid && (
                            <button
                              onClick={() => handleOpenReminder(item)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-[#F20047] text-[#F20047] hover:text-white border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                              title="Send Official Payment Reminder"
                            >
                              <Send className="w-3 h-3" />
                              <span>Remind</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{pagination.totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. READ-ONLY BALANCE DETAILS DRAWER */}
      {detailsDrawerOpen && selectedBalance && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div>
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Customer Ledger Reconciliation
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    Balance & Contract Details
                  </h3>
                </div>
                <button
                  onClick={() => setDetailsDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5">
                {/* Outstanding Amount Banner */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Remaining Balance Due
                    </span>
                    <div className="text-2xl font-black text-[#F20047]">
                      {formatETB(selectedBalance.outstanding)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Payment Progress
                    </span>
                    <div className="text-xs font-black text-slate-900">
                      {selectedBalance.paymentProgress}% Settled
                    </div>
                  </div>
                </div>

                {/* Customer & Booking Information */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 text-slate-500">
                    Customer & Event
                  </h4>
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-200/60 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Customer Name:</span>
                      <strong className="text-slate-900">{selectedBalance.customer?.fullName || 'Client'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone:</span>
                      <span className="font-mono text-slate-800">{selectedBalance.customer?.phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="text-slate-800">{selectedBalance.customer?.email || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Booking Reference:</span>
                      <strong className="font-mono text-slate-900">{selectedBalance.reference}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Event Title:</span>
                      <span className="font-semibold text-slate-800">{selectedBalance.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Event Date:</span>
                      <strong className="text-slate-900">{formatDate(selectedBalance.eventDate)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Location:</span>
                      <span className="text-slate-800">{selectedBalance.locationName}, {selectedBalance.city}</span>
                    </div>
                    {selectedBalance.assignedCoordinator && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Coordinator:</span>
                        <span className="text-slate-800 font-semibold">{selectedBalance.assignedCoordinator.fullName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contract Summary */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 text-slate-500">
                    Signed Contract Terms
                  </h4>
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-200/60 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contract Reference:</span>
                      <strong className="font-mono text-slate-900">
                        {selectedBalance.contract ? `CNT-${selectedBalance.contract.version}` : 'Standard Estimate'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contract Total:</span>
                      <strong className="font-black text-slate-900">{formatETB(selectedBalance.contractValue)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Initial 50% Required:</span>
                      <span className="font-semibold text-slate-800">{formatETB(selectedBalance.initialDepositRequired)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Final 50% Settlement:</span>
                      <span className="font-semibold text-slate-800">{formatETB(selectedBalance.finalPaymentRequired)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Schedule:</span>
                      <span className="text-slate-700 font-medium">50% before event • 50% upon completion</span>
                    </div>
                  </div>
                </div>

                {/* Due Information */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 text-slate-500">
                    Next Due Payment
                  </h4>
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-200/60 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Next Stage:</span>
                      <strong className="text-slate-900">
                        {selectedBalance.nextStage === 'INITIAL_DEPOSIT' ? 'Initial 50% Deposit' : 'Final 50% Settlement'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Next Due Amount:</span>
                      <strong className="font-black text-[#F20047]">{formatETB(selectedBalance.nextDueAmount)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contractual Due Date:</span>
                      <strong className="text-slate-900">{formatDate(selectedBalance.nextDueDate)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="font-bold text-slate-900">{selectedBalance.paymentStatus}</span>
                    </div>
                  </div>
                </div>

                {/* Payment History List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 text-slate-500">
                    Verified Payment History
                  </h4>
                  {selectedBalance.payments && selectedBalance.payments.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Amount</th>
                            <th className="py-2 px-3">Method</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedBalance.payments.map((p) => (
                            <tr key={p.id}>
                              <td className="py-2 px-3 text-slate-600">{formatDate(p.createdAt)}</td>
                              <td className="py-2 px-3 font-bold text-slate-900">{formatETB(p.amount)}</td>
                              <td className="py-2 px-3 text-slate-600">{p.paymentMethod}</td>
                              <td className="py-2 px-3">
                                {p.status === 'VERIFIED' ? (
                                  <span className="text-emerald-700 font-bold text-[10px]">Verified</span>
                                ) : (
                                  <span className="text-amber-600 text-[10px]">{p.status}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No payments recorded yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
              <button
                onClick={() => setDetailsDrawerOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>

              {selectedBalance.outstanding > 0 && (
                <button
                  onClick={() => {
                    setDetailsDrawerOpen(false);
                    handleOpenReminder(selectedBalance);
                  }}
                  className="px-4 py-2 bg-[#F20047] hover:bg-[#d9003e] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Reminder</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. SEND PAYMENT REMINDER CONFIRMATION MODAL */}
      {reminderModal.open && reminderModal.balance && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-[#F20047] flex items-center justify-center mx-auto">
                <Send className="w-6 h-6" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">
                  Send Payment Reminder
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Dispatch an official reminder via Eventora Customer Portal notifications.
                </p>
              </div>

              {/* Summary of Reminder */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <strong className="text-slate-900">{reminderModal.balance.customer?.fullName || 'Client'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking:</span>
                  <span className="font-mono font-bold text-slate-900">{reminderModal.balance.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Outstanding Amount:</span>
                  <strong className="font-black text-[#F20047] text-sm">{formatETB(reminderModal.balance.outstanding)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Due Date:</span>
                  <span className="font-semibold text-slate-800">{formatDate(reminderModal.balance.nextDueDate)}</span>
                </div>
              </div>

              {/* Optional Custom Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Note from Finance (Appended to reminder):
                </label>
                <textarea
                  value={reminderModal.customNote}
                  onChange={(e) => setReminderModal((prev) => ({ ...prev, customNote: e.target.value }))}
                  placeholder="e.g. Please note final settlement is required prior to event day."
                  rows={2}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-xl text-[11px] text-blue-900 font-medium">
                The reminder will be sent directly to the customer's portal and logged in the immutable security audit trail.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setReminderModal({ open: false, balance: null, customNote: '', submitting: false })}
                disabled={reminderModal.submitting}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReminder}
                disabled={reminderModal.submitting}
                className="px-4 py-2 bg-[#F20047] hover:bg-[#d9003e] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {reminderModal.submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm & Send Reminder</span>
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

