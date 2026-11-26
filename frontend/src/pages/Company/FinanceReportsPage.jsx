import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Printer,
  Filter,
  RotateCcw,
  Search,
  Calendar,
  CreditCard,
  Receipt,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Info,
  X,
  FileText,
  BarChart3,
  PieChart,
  Users,
  Building,
  ArrowUpDown,
  ExternalLink,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-react';

const formatETB = (amount) => {
  const num = Number(amount) || 0;
  return `ETB ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const formatEventType = (type) => {
  if (!type) return 'Other';
  return type
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export default function FinanceReportsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters state
  const [dateRange, setDateRange] = useState('THIS_MONTH');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateBasis, setDateBasis] = useState('PAYMENT_DATE');
  const [eventType, setEventType] = useState('ALL');
  const [paymentMethod, setPaymentMethod] = useState('ALL');
  const [paymentStatus, setPaymentStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Sub-tab state
  const [activeReportTab, setActiveReportTab] = useState('REVENUE');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Data & loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportsData, setReportsData] = useState(null);
  const [error, setError] = useState(null);

  // Detail Modal State
  const [detailModal, setDetailModal] = useState({ open: false, record: null, type: null });

  // Hover states for chart tooltips
  const [trendHover, setTrendHover] = useState(null);

  // Fetch Reports Data from Backend
  const loadReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (dateRange) queryParams.set('dateRange', dateRange);
      if (dateRange === 'CUSTOM') {
        if (startDate) queryParams.set('startDate', startDate);
        if (endDate) queryParams.set('endDate', endDate);
      }
      if (dateBasis) queryParams.set('dateBasis', dateBasis);
      if (eventType && eventType !== 'ALL') queryParams.set('eventType', eventType);
      if (paymentMethod && paymentMethod !== 'ALL') queryParams.set('paymentMethod', paymentMethod);
      if (paymentStatus && paymentStatus !== 'ALL') queryParams.set('paymentStatus', paymentStatus);
      if (searchTerm.trim()) queryParams.set('search', searchTerm.trim());
      queryParams.set('reportTab', activeReportTab);
      queryParams.set('page', page);
      queryParams.set('limit', limit);
      queryParams.set('sortBy', sortBy);
      queryParams.set('sortOrder', sortOrder);

      const res = await api.getFinancialReports(`?${queryParams.toString()}`);
      if (res && res.data) {
        setReportsData(res.data);
      } else {
        throw new Error('Invalid financial reports response payload');
      }
    } catch (err) {
      console.error('Failed to load financial reports:', err);
      setError(err.message || 'Unable to load financial reports from server.');
      showToast(err.message || 'Error fetching report data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, startDate, endDate, dateBasis, eventType, paymentMethod, paymentStatus, searchTerm, activeReportTab, page, limit, sortBy, sortOrder, showToast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Reset pagination when tab or filters change
  const handleTabChange = (tab) => {
    setActiveReportTab(tab);
    setPage(1);
  };

  const handleResetFilters = () => {
    setDateRange('THIS_MONTH');
    setStartDate('');
    setEndDate('');
    setDateBasis('PAYMENT_DATE');
    setEventType('ALL');
    setPaymentMethod('ALL');
    setPaymentStatus('ALL');
    setSearchTerm('');
    setPage(1);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      dateRange !== 'THIS_MONTH' ||
      startDate !== '' ||
      endDate !== '' ||
      dateBasis !== 'PAYMENT_DATE' ||
      eventType !== 'ALL' ||
      paymentMethod !== 'ALL' ||
      paymentStatus !== 'ALL' ||
      searchTerm.trim() !== ''
    );
  }, [dateRange, startDate, endDate, dateBasis, eventType, paymentMethod, paymentStatus, searchTerm]);

  // CSV Export Utility
  const handleExportCSV = () => {
    if (!reportsData || !reportsData.detailedReport || !reportsData.detailedReport.records) {
      showToast('No record data available to export.', 'warning');
      return;
    }

    const records = reportsData.detailedReport.records;
    if (records.length === 0) {
      showToast('Current filtered table is empty.', 'info');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    const tab = reportsData.detailedReport.tab;

    if (tab === 'REVENUE') {
      csvContent += 'Transaction Reference,Customer Name,Customer Email,Customer Phone,Booking Reference,Event Type,Payment Stage,Payment Method,Amount Received (ETB),Verification Date,Receipt Number,Receipt Status\r\n';
      records.forEach((r) => {
        csvContent += `"${r.transactionReference}","${r.customerName}","${r.customerEmail}","${r.customerPhone}","${r.bookingReference}","${r.eventType}","${r.paymentStage}","${r.paymentMethod}","${r.amountReceived}","${r.verificationDate}","${r.receiptNumber || 'N/A'}","${r.receiptStatus}"\r\n`;
      });
    } else if (tab === 'BALANCES') {
      csvContent += 'Booking Reference,Customer Name,Customer Email,Customer Phone,Event Type,Event Date,Contract Value (ETB),Verified Paid (ETB),Adjustments (ETB),Outstanding Amount (ETB),Next Due Date,Payment Status\r\n';
      records.forEach((r) => {
        csvContent += `"${r.bookingReference}","${r.customerName}","${r.customerEmail}","${r.customerPhone}","${r.eventType}","${r.eventDate}","${r.contractValue}","${r.verifiedPaid}","${r.approvedCreditsDebits}","${r.outstandingAmount}","${r.nextPaymentDueDate || 'N/A'}","${r.paymentStatus}"\r\n`;
      });
    } else if (tab === 'REFUNDS') {
      csvContent += 'Reference,Customer Name,Booking Reference,Record Type,Amount (ETB),Reason,Approval Status,Processing Status,Processing Date,Created Date\r\n';
      records.forEach((r) => {
        csvContent += `"${r.reference}","${r.customerName}","${r.bookingReference}","${r.recordType}","${r.amount}","${(r.reason || '').replace(/"/g, '""')}","${r.approvalStatus}","${r.processingStatus}","${r.actualProcessingDate || 'N/A'}","${r.createdAt}"\r\n`;
      });
    } else if (tab === 'PARTNERS') {
      csvContent += 'Partner Name,Service Title,Booking Reference,Agreed Cost (ETB),Required Advance (ETB),Due Date,Status,Event Date\r\n';
      records.forEach((r) => {
        csvContent += `"${r.partnerName}","${r.partnerService}","${r.bookingReference}","${r.agreedCost}","${r.requiredAdvance || 0}","${r.dueDate || 'N/A'}","${r.commitmentStatus}","${r.eventDate || 'N/A'}"\r\n`;
      });
    } else if (tab === 'SUMMARY') {
      csvContent += 'Event Category,Total Bookings,Confirmed Bookings,Contracted Value (ETB),Verified Revenue (ETB),Outstanding Receivables (ETB)\r\n';
      records.forEach((r) => {
        csvContent += `"${r.label}","${r.totalBookings}","${r.confirmedCount}","${r.contractedValue}","${r.verifiedRevenue}","${r.outstandingBalance}"\r\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Eventora_Financial_Report_${tab}_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${records.length} records to CSV`, 'success');
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // Safe references
  const summary = reportsData?.summaryCards || {};
  const charts = reportsData?.charts || {};
  const detailed = reportsData?.detailedReport || { records: [], pagination: { total: 0, page: 1, totalPages: 1 } };
  const periodInfo = reportsData?.period || { label: 'Active Period', dateBasis: 'PAYMENT_DATE' };

  // Calculate maximum value for visual bar scaling
  const maxTrendVal = useMemo(() => {
    if (!charts.revenueTrend || charts.revenueTrend.length === 0) return 100000;
    return Math.max(...charts.revenueTrend.map((t) => t.verifiedRevenue), 10000);
  }, [charts.revenueTrend]);

  const maxOverviewVal = useMemo(() => {
    if (!charts.financialOverview || charts.financialOverview.length === 0) return 100000;
    return Math.max(...charts.financialOverview.map((o) => o.amount), 10000);
  }, [charts.financialOverview]);

  const maxPartnerCatVal = useMemo(() => {
    if (!charts.partnerCommittedCostsByCategory || charts.partnerCommittedCostsByCategory.length === 0) return 50000;
    return Math.max(...charts.partnerCommittedCostsByCategory.map((c) => c.committedCost), 10000);
  }, [charts.partnerCommittedCostsByCategory]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:max-w-none">
      {/* =========================================================
          PRINT HEADER (Visible only on print)
          ========================================================= */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">EVENTORA</h1>
            <p className="text-xs text-slate-600 font-semibold">Official Financial Statement & Accounting Summary</p>
            <p className="text-[11px] text-slate-500 mt-1">Generated by Finance Officer: {user?.fullName || 'Finance Department'}</p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-bold text-slate-800">Period: {periodInfo.label}</p>
            <p>Basis: {periodInfo.dateBasis.replace('_', ' ')}</p>
            <p>Printed: {formatDate(new Date())}</p>
          </div>
        </div>
      </div>

      {/* =========================================================
          1. SCREEN PAGE HEADER & ACTIONS
          ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <Link to="/company/dashboard" className="hover:text-[#F50046] transition-colors">
              Company Portal
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/company/finance?tab=overview" className="hover:text-[#F50046] transition-colors">
              Finance
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Financial Reports</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Financial Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Monitor Eventora's financial performance, revenue, outstanding balances, refunds, and partner costs.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => setShowFilterDrawer(!showFilterDrawer)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 border text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer ${
              showFilterDrawer || hasActiveFilters
                ? 'bg-rose-50 border-rose-200 text-[#F50046]'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters {hasActiveFilters && '(Active)'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            title="Export filtered dataset to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            title="Print certified accounting statement"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>

          <button
            onClick={() => loadReports(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Refresh database aggregations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F50046]' : 'text-slate-300'}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          2. FILTER TOOLBAR & CONTROLS
          ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Preset Date Range */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Reporting Period
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer"
              >
                <option value="TODAY">Today</option>
                <option value="THIS_WEEK">This Week</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="LAST_MONTH">Last Month</option>
                <option value="THIS_QUARTER">This Quarter (Q4)</option>
                <option value="THIS_YEAR">This Year (2026)</option>
                <option value="CUSTOM">Custom Range...</option>
              </select>
            </div>
          </div>

          {/* Report Date Basis */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Accounting Date Basis
            </label>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={dateBasis}
                onChange={(e) => setDateBasis(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer"
              >
                <option value="PAYMENT_DATE">Payment Clearance Date (Cash Basis)</option>
                <option value="EVENT_DATE">Event Execution Date</option>
                <option value="BOOKING_DATE">Booking Contract Date</option>
              </select>
            </div>
          </div>

          {/* Event Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Event Category
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer"
            >
              <option value="ALL">All Event Categories</option>
              <option value="WEDDING">Weddings</option>
              <option value="BIRTHDAY">Birthdays</option>
              <option value="SHIMGLINA">Shimglina</option>
              <option value="FUNERAL_SUPPORT">Funerals</option>
              <option value="CORPORATE">Corporate</option>
              <option value="OTHER">Other Celebrations</option>
            </select>
          </div>

          {/* Free-text Search */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Search Record
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Client, booking ref, or tx..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium text-slate-800 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F50046]/20"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Custom Date Range pickers (shown when Custom is selected or drawer toggled) */}
        {(dateRange === 'CUSTOM' || showFilterDrawer) && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Custom Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateRange('CUSTOM');
                }}
                className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Custom End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateRange('CUSTOM');
                }}
                className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Payment Channel
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer"
              >
                <option value="ALL">All Payment Channels</option>
                <option value="BANK_TRANSFER">Bank Transfer (CBE / Awash / Dashen)</option>
                <option value="TELEBIRR">Telebirr SuperApp</option>
                <option value="CHAPA">Chapa Electronic Gateway</option>
                <option value="CASH">Direct Cash Settlement</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Settlement Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 cursor-pointer"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="VERIFIED">Verified & Cleared (Real Money)</option>
                <option value="PENDING">Pending Claim Verification</option>
                <option value="REJECTED">Rejected Payment Claims</option>
              </select>
            </div>
          </div>
        )}

        {/* Filter Badges & Reset Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500">Active Scope:</span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
              Period: {periodInfo.label || 'Active'}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-[#F50046] border border-rose-200">
              Basis: {periodInfo.dateBasis === 'PAYMENT_DATE' ? 'Payment Date' : periodInfo.dateBasis === 'EVENT_DATE' ? 'Event Date' : 'Booking Date'}
            </span>
            {hasActiveFilters && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Custom Criteria Applied
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================
          ERROR ALERT STATE
          ========================================================= */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="font-bold text-rose-900">Failed to calculate financial reports:</strong>
            <p className="text-rose-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* =========================================================
          3. SIX SUMMARY FINANCIAL CARDS
          ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Verified Revenue */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2 hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Verified Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            {formatETB(summary.verifiedRevenue?.amount || 0)}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            {summary.verifiedRevenue?.trend !== null && summary.verifiedRevenue?.trend !== undefined ? (
              <span className={`inline-flex items-center font-bold ${summary.verifiedRevenue.trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {summary.verifiedRevenue.trend >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {summary.verifiedRevenue.trend > 0 ? `+${summary.verifiedRevenue.trend}%` : `${summary.verifiedRevenue.trend}%`}
              </span>
            ) : (
              <span className="text-slate-400 font-medium">Cleared funds</span>
            )}
            <span className="text-slate-400 font-medium truncate" title="Eligible verified customer payments">
              In period
            </span>
          </div>
        </div>

        {/* Card 2: Net Cash Received */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2 hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Net Cash Received</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-blue-700 tracking-tight">
            {formatETB(summary.netCashReceived?.amount || 0)}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            {summary.netCashReceived?.trend !== null && summary.netCashReceived?.trend !== undefined ? (
              <span className={`inline-flex items-center font-bold ${summary.netCashReceived.trend >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                {summary.netCashReceived.trend >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {summary.netCashReceived.trend > 0 ? `+${summary.netCashReceived.trend}%` : `${summary.netCashReceived.trend}%`}
              </span>
            ) : (
              <span className="text-slate-400 font-medium">Net inflow</span>
            )}
            <span className="text-slate-400 font-medium truncate" title="Receipts minus processed refunds">
              Net of refunds
            </span>
          </div>
        </div>

        {/* Card 3: Outstanding Balances */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2 hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Outstanding Balances</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-700 tracking-tight">
            {formatETB(summary.outstandingBalances?.amount || 0)}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-amber-700">
              {summary.outstandingBalances?.count || 0} bookings
            </span>
            <span className="text-slate-400 font-medium">Uncollected</span>
          </div>
        </div>

        {/* Card 4: Refunds Processed */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2 hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Refunds Processed</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-[#F50046] flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-700 tracking-tight">
            {formatETB(summary.refundsProcessed?.amount || 0)}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-rose-600">Disbursed</span>
            <span className="text-slate-400 font-medium">Approved only</span>
          </div>
        </div>

        {/* Card 5: Partner Committed Costs */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2 hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Partner Commitments</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-purple-700 tracking-tight">
            {formatETB(summary.partnerCommittedCosts?.amount || 0)}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-purple-700">
              {summary.partnerCommittedCosts?.count || 0} contracts
            </span>
            <span className="text-slate-400 font-medium">Cost planning</span>
          </div>
        </div>

        {/* Card 6: Bookings Revenue */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Bookings Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            {formatETB(summary.bookingsRevenue?.amount || 0)}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700">
              {summary.bookingsRevenue?.count || 0} events
            </span>
            <span className="text-slate-400 font-medium">Contract value</span>
          </div>
        </div>
      </div>

      {/* Commercial Policy Notice Banner */}
      <div className="p-3.5 bg-purple-50/80 border border-purple-200/80 rounded-2xl text-xs text-purple-900 flex items-start gap-2.5 print:hidden">
        <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold">Commercial & Financial Reporting Policy:</span> Partner payouts are coordinated and settled directly with external partners outside Eventora. Partner figures represent contractual planning commitments and are NOT classified as actual paid expenses or subtracted to calculate speculative net profit.
        </div>
      </div>

      {/* =========================================================
          4. FIVE VISUAL ANALYTICS & CHARTS
          ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 print:grid-cols-1">
        {/* Chart 1: Revenue Trajectory (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#F50046]" />
                <span>Verified Revenue Trajectory</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real cleared receipts aggregated over {periodInfo.label}
              </p>
            </div>
            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
              {formatETB(summary.verifiedRevenue?.amount || 0)}
            </span>
          </div>

          {/* SVG Line / Bar Chart for Trajectory */}
          {charts.revenueTrend && charts.revenueTrend.length > 0 ? (
            <div className="space-y-3">
              <div className="h-48 w-full flex items-end gap-2 pt-6 pb-2 px-1 border-b border-slate-100">
                {charts.revenueTrend.map((bucket, idx) => {
                  const pct = Math.max(8, Math.round((bucket.verifiedRevenue / maxTrendVal) * 100));
                  const isHovered = trendHover === idx;
                  return (
                    <div
                      key={bucket.date || idx}
                      className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                      onMouseEnter={() => setTrendHover(idx)}
                      onMouseLeave={() => setTrendHover(null)}
                    >
                      {/* Tooltip on Hover */}
                      {isHovered && (
                        <div className="absolute -top-12 z-20 bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded-lg shadow-lg whitespace-nowrap pointer-events-none animate-fade-in">
                          <div>{bucket.label}</div>
                          <div className="text-emerald-400">{formatETB(bucket.verifiedRevenue)}</div>
                          <div className="text-slate-400 text-[9px]">{bucket.transactionsCount} txs</div>
                        </div>
                      )}

                      {/* Bar with gradient */}
                      <div
                        className={`w-full max-w-[36px] rounded-t-lg transition-all ${
                          isHovered
                            ? 'bg-[#F50046] shadow-sm'
                            : 'bg-gradient-to-t from-rose-500/80 to-[#F50046] group-hover:from-rose-600 group-hover:to-[#F50046]'
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* X-axis labels */}
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 px-1 overflow-x-auto">
                {charts.revenueTrend.map((bucket, idx) => (
                  <span key={bucket.date || idx} className="truncate max-w-[60px] text-center">
                    {bucket.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
              <BarChart3 className="w-8 h-8 text-slate-300" />
              <span>No verified payment records in this period.</span>
            </div>
          )}
        </div>

        {/* Chart 2: Revenue by Event Category (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-600" />
                <span>Revenue by Event Type</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Contribution across celebrations</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {charts.revenueByEventType && charts.revenueByEventType.length > 0 ? (
              charts.revenueByEventType.map((item, idx) => {
                const colors = [
                  'bg-[#F50046]',
                  'bg-blue-600',
                  'bg-emerald-600',
                  'bg-purple-600',
                  'bg-amber-500',
                  'bg-indigo-600'
                ];
                const barColor = colors[idx % colors.length];

                return (
                  <div key={item.eventType || idx} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">{item.label}</span>
                      <div className="text-right">
                        <span className="font-black text-slate-900">{formatETB(item.amount)}</span>
                        <span className="text-[11px] font-bold text-slate-500 ml-1.5">
                          ({item.percentage}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${Math.max(2, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No event revenue breakdown available.</p>
            )}
          </div>
        </div>

        {/* Chart 3: Payment Method Distribution (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Payment Methods</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Cleared channel distribution</p>
          </div>

          <div className="space-y-3">
            {charts.paymentMethodBreakdown && charts.paymentMethodBreakdown.length > 0 ? (
              charts.paymentMethodBreakdown.map((item) => (
                <div key={item.method} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{item.label}</span>
                    <span className="font-black text-slate-900">{formatETB(item.amount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500">
                    <span>{item.count} verified transactions</span>
                    <span className="font-bold text-blue-600">{item.percentage}% of total</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200/70 overflow-hidden mt-1">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No payment method data recorded.</p>
            )}
          </div>
        </div>

        {/* Chart 4: Financial Overview Comparison (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>Financial Overview</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Core balance comparison</p>
          </div>

          <div className="space-y-2.5">
            {charts.financialOverview && charts.financialOverview.length > 0 ? (
              charts.financialOverview.map((item) => {
                const pct = Math.max(4, Math.round((item.amount / maxOverviewVal) * 100));
                return (
                  <div key={item.category} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">{item.category}</span>
                      <span className="font-black text-slate-900">{formatETB(item.amount)}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No balance data available.</p>
            )}
          </div>
        </div>

        {/* Chart 5: Partner Committed Costs by Category (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-purple-600" />
              <span>Partner Cost Commitments</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Agreed vendor category planning</p>
          </div>

          <div className="space-y-2.5">
            {charts.partnerCommittedCostsByCategory && charts.partnerCommittedCostsByCategory.length > 0 ? (
              charts.partnerCommittedCostsByCategory.map((item) => {
                const pct = Math.max(4, Math.round((item.committedCost / maxPartnerCatVal) * 100));
                return (
                  <div key={item.category} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 truncate max-w-[150px]" title={item.category}>
                        {item.category}
                      </span>
                      <div className="text-right">
                        <span className="font-black text-purple-700">{formatETB(item.committedCost)}</span>
                        <span className="text-[10px] text-slate-400 block">{item.assignmentsCount} assignments</span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-purple-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No partner assignments in current period.</p>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================
          5. DETAILED FINANCIAL REPORTS & TABLES (5 SUB-TABS)
          ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="border-b border-slate-200 px-4 sm:px-6 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 print:bg-white">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-2 sm:pb-0">
            <button
              onClick={() => handleTabChange('REVENUE')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                activeReportTab === 'REVENUE'
                  ? 'bg-white text-[#F50046] shadow-2xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Revenue Report
            </button>

            <button
              onClick={() => handleTabChange('BALANCES')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                activeReportTab === 'BALANCES'
                  ? 'bg-white text-[#F50046] shadow-2xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Outstanding Balances Report
            </button>

            <button
              onClick={() => handleTabChange('REFUNDS')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                activeReportTab === 'REFUNDS'
                  ? 'bg-white text-[#F50046] shadow-2xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Refunds & Adjustments Report
            </button>

            <button
              onClick={() => handleTabChange('PARTNERS')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                activeReportTab === 'PARTNERS'
                  ? 'bg-white text-[#F50046] shadow-2xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Partner Cost Planning
            </button>

            <button
              onClick={() => handleTabChange('SUMMARY')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                activeReportTab === 'SUMMARY'
                  ? 'bg-white text-[#F50046] shadow-2xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Event Portfolio Summary
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2 sm:pb-0 text-xs text-slate-500 print:hidden">
            <span>Showing {detailed.records?.length || 0} of {detailed.pagination?.total || 0} records</span>
          </div>
        </div>

        {/* Sub-tab 1: Revenue Report Table */}
        {activeReportTab === 'REVENUE' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Transaction Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount Received</th>
                  <th className="py-3 px-4">Cleared Date</th>
                  <th className="py-3 px-4">Receipt</th>
                  <th className="py-3 px-4 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {detailed.records && detailed.records.length > 0 ? (
                  detailed.records.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{row.transactionReference}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{row.customerName}</div>
                        <div className="text-[11px] text-slate-400">{row.customerPhone || row.customerEmail}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{row.bookingReference}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {formatEventType(row.eventType)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {row.paymentStage === 'FINAL_50_PERCENT' ? 'Final 50%' : 'Initial 50%'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{row.paymentMethod}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatETB(row.amountReceived)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(row.verificationDate)}</td>
                      <td className="py-3 px-4">
                        {row.receiptNumber ? (
                          <span className="font-mono text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {row.receiptNumber}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">No Receipt</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center print:hidden">
                        <button
                          onClick={() => setDetailModal({ open: true, record: row, type: 'REVENUE' })}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                      No verified revenue records found matching current criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Sub-tab 2: Outstanding Balances Report Table */}
        {activeReportTab === 'BALANCES' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4 text-right">Contract Value</th>
                  <th className="py-3 px-4 text-right">Verified Paid</th>
                  <th className="py-3 px-4 text-right">Adjustments</th>
                  <th className="py-3 px-4 text-right">Outstanding Due</th>
                  <th className="py-3 px-4">Payment Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {detailed.records && detailed.records.length > 0 ? (
                  detailed.records.map((row) => (
                    <tr key={row.bookingId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{row.customerName}</div>
                        <div className="text-[11px] text-slate-400">{row.customerPhone}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{row.bookingReference}</td>
                      <td className="py-3 px-4 font-medium text-slate-600">{formatEventType(row.eventType)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">{formatETB(row.contractValue)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatETB(row.verifiedPaid)}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {row.approvedCreditsDebits !== 0 ? formatETB(row.approvedCreditsDebits) : '0 ETB'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-amber-700">
                        {formatETB(row.outstandingAmount)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(row.nextPaymentDueDate)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.paymentStatus === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : row.paymentStatus === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {row.paymentStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center print:hidden">
                        <button
                          onClick={() => setDetailModal({ open: true, record: row, type: 'BALANCES' })}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                      No customer balance records found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Sub-tab 3: Refunds & Adjustments Report Table */}
        {activeReportTab === 'REFUNDS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Customer / Booking</th>
                  <th className="py-3 px-4">Record Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Approval</th>
                  <th className="py-3 px-4">Execution Status</th>
                  <th className="py-3 px-4">Processed Date</th>
                  <th className="py-3 px-4 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {detailed.records && detailed.records.length > 0 ? (
                  detailed.records.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{row.reference}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{row.customerName}</div>
                        <div className="text-[11px] font-mono text-slate-400">{row.bookingReference}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.recordType === 'REFUND'
                              ? 'bg-rose-50 text-[#F50046] border border-rose-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {row.recordType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-700">{formatETB(row.amount)}</td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={row.reason}>
                        {row.reason}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.approvalStatus === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {row.approvalStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">{row.processingStatus}</td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(row.actualProcessingDate)}</td>
                      <td className="py-3 px-4 text-center print:hidden">
                        <button
                          onClick={() => setDetailModal({ open: true, record: row, type: 'REFUNDS' })}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                      No refund or adjustment records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Sub-tab 4: Partner Cost Planning Report Table */}
        {activeReportTab === 'PARTNERS' && (
          <div className="overflow-x-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span className="font-semibold text-slate-800">
                Partner Cost Planning Ledger (Coordinated Externally)
              </span>
              <span className="text-[11px] text-purple-700 font-bold bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                Non-Platform Payouts
              </span>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Partner Name</th>
                  <th className="py-3 px-4">Service Assigned</th>
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4 text-right">Agreed Cost</th>
                  <th className="py-3 px-4 text-right">Advance Required</th>
                  <th className="py-3 px-4">Settlement Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Event Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {detailed.records && detailed.records.length > 0 ? (
                  detailed.records.map((row) => (
                    <tr key={row.assignmentId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{row.partnerName}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{row.partnerService}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{row.bookingReference}</td>
                      <td className="py-3 px-4 text-right font-black text-purple-700">{formatETB(row.agreedCost)}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {row.requiredAdvance ? formatETB(row.requiredAdvance) : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(row.dueDate)}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {row.commitmentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(row.eventDate)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      No partner assignments found for current period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Sub-tab 5: Event Portfolio Summary */}
        {activeReportTab === 'SUMMARY' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Event Category</th>
                  <th className="py-3 px-4 text-center">Total Bookings</th>
                  <th className="py-3 px-4 text-center">Confirmed</th>
                  <th className="py-3 px-4 text-right">Contracted Value</th>
                  <th className="py-3 px-4 text-right">Verified Revenue</th>
                  <th className="py-3 px-4 text-right">Outstanding Receivables</th>
                  <th className="py-3 px-4 text-right">Collection Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {detailed.records && detailed.records.length > 0 ? (
                  detailed.records.map((row) => {
                    const rate = row.contractedValue > 0 ? Math.round((row.verifiedRevenue / row.contractedValue) * 100) : 0;
                    return (
                      <tr key={row.eventType} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.label}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700">{row.totalBookings}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-600">{row.confirmedCount}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-800">{formatETB(row.contractedValue)}</td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900">{formatETB(row.verifiedRevenue)}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-amber-700">{formatETB(row.outstandingBalance)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`font-black ${rate >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      No event categories found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="border-t border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 print:hidden">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>records per page</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-bold text-slate-800">
              Page {detailed.pagination?.page || 1} of {detailed.pagination?.totalPages || 1}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(detailed.pagination?.totalPages || 1, p + 1))}
              disabled={page >= (detailed.pagination?.totalPages || 1)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(detailed.pagination?.totalPages || 1)}
              disabled={page >= (detailed.pagination?.totalPages || 1)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          6. ROW DETAIL MODAL
          ========================================================= */}
      {detailModal.open && detailModal.record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-fade-in print:hidden">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {detailModal.type === 'REVENUE'
                    ? 'Payment & Revenue Record'
                    : detailModal.type === 'BALANCES'
                    ? 'Outstanding Balance Audit'
                    : 'Refund & Adjustment Details'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Comprehensive audit trail entry</p>
              </div>
              <button
                onClick={() => setDetailModal({ open: false, record: null, type: null })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {detailModal.type === 'REVENUE' && (
                <>
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[11px] font-semibold uppercase">External Reference</span>
                    <div className="font-mono font-bold text-slate-900 text-sm">
                      {detailModal.record.transactionReference}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 font-semibold text-[11px]">Customer</span>
                      <p className="font-bold text-slate-900 mt-0.5">{detailModal.record.customerName}</p>
                      <p className="text-slate-500 text-[11px]">{detailModal.record.customerPhone}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold text-[11px]">Booking</span>
                      <p className="font-mono font-bold text-slate-900 mt-0.5">{detailModal.record.bookingReference}</p>
                      <p className="text-slate-500 text-[11px]">{formatEventType(detailModal.record.eventType)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 font-semibold text-[11px]">Amount Cleared</span>
                      <p className="font-black text-slate-900 text-sm mt-0.5">
                        {formatETB(detailModal.record.amountReceived)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold text-[11px]">Method</span>
                      <p className="font-bold text-slate-800 mt-0.5">{detailModal.record.paymentMethod}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-400 font-semibold text-[11px]">Electronic Receipt</span>
                    <p className="font-mono font-bold text-emerald-600 mt-0.5">
                      {detailModal.record.receiptNumber || 'No receipt issued yet'}
                    </p>
                  </div>
                </>
              )}

              {detailModal.type === 'BALANCES' && (
                <>
                  <div className="p-3 bg-amber-50 rounded-xl space-y-1 border border-amber-200">
                    <span className="text-amber-800 text-[11px] font-semibold uppercase">Outstanding Receivable</span>
                    <div className="font-black text-amber-900 text-lg">
                      {formatETB(detailModal.record.outstandingAmount)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 font-semibold text-[11px]">Contract Value</span>
                      <p className="font-bold text-slate-900 mt-0.5">{formatETB(detailModal.record.contractValue)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold text-[11px]">Verified Paid</span>
                      <p className="font-bold text-emerald-600 mt-0.5">{formatETB(detailModal.record.verifiedPaid)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 font-semibold text-[11px]">Adjustments</span>
                      <p className="font-medium text-slate-700 mt-0.5">{formatETB(detailModal.record.approvedCreditsDebits)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold text-[11px]">Payment Due Date</span>
                      <p className="font-bold text-slate-800 mt-0.5">{formatDate(detailModal.record.nextPaymentDueDate)}</p>
                    </div>
                  </div>
                </>
              )}

              {detailModal.type === 'REFUNDS' && (
                <>
                  <div className="p-3 bg-rose-50 rounded-xl space-y-1 border border-rose-200">
                    <span className="text-rose-800 text-[11px] font-semibold uppercase">Disbursed Amount</span>
                    <div className="font-black text-rose-900 text-lg">
                      {formatETB(detailModal.record.amount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold text-[11px]">Reason</span>
                    <p className="font-medium text-slate-800 mt-0.5">{detailModal.record.reason}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 font-semibold text-[11px]">Approval</span>
                      <p className="font-bold text-slate-800 mt-0.5">{detailModal.record.approvalStatus}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold text-[11px]">Processing Status</span>
                      <p className="font-bold text-slate-800 mt-0.5">{detailModal.record.processingStatus}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setDetailModal({ open: false, record: null, type: null })}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

