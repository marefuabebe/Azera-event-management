import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  X,
  RefreshCw,
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  Calendar,
  ChevronRight,
  Eye,
  User,
  Phone,
  Mail,
  FlaskConical,
  CreditCard,
  Plus,
  Check,
  XCircle,
  TrendingDown,
  TrendingUp,
  SlidersHorizontal,
  Info
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
    hour12: false
  });
};

export default function FinanceRefundsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState([]);
  const [eligiblePayments, setEligiblePayments] = useState([]);
  const [eligibleBookings, setEligibleBookings] = useState([]);
  const [summary, setSummary] = useState({
    pendingApprovalCount: 0,
    approvedPendingDisbursementAmount: 0,
    totalRefundedAmount: 0,
    adjustmentsCount: 0,
    adjustmentsCreditAmount: 0,
    adjustmentsDebitAmount: 0,
    netAdjustmentsAmount: 0
  });

  // Filter & Search Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, REFUNDS, ADJUSTMENTS, PENDING_APPROVAL, APPROVED, PROCESSING, PROCESSED, REJECTED
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, REFUND, CREDIT_ADJUSTMENT, DEBIT_ADJUSTMENT
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('ALL_TIME');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Modals & Drawers
  const [selectedRecord, setSelectedRecord] = useState(null); // for View Details drawer
  const [newRefundOpen, setNewRefundOpen] = useState(false);
  const [newAdjustmentOpen, setNewAdjustmentOpen] = useState(false);
  const [approveDialog, setApproveDialog] = useState({ open: false, record: null });
  const [rejectDialog, setRejectDialog] = useState({ open: false, record: null, reason: '' });
  const [processDialog, setProcessDialog] = useState({
    open: false,
    record: null,
    refundTransactionRef: '',
    refundMethod: 'Bank Transfer (CBE)',
    notes: ''
  });

  // New Refund Form State
  const [refundForm, setRefundForm] = useState({
    paymentId: '',
    bookingId: '',
    amount: '',
    reason: '',
    refundMethod: 'Bank Transfer (CBE)',
    notes: '',
    autoApprove: false
  });
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState(null);

  // New Adjustment Form State
  const [adjustmentForm, setAdjustmentForm] = useState({
    bookingId: '',
    adjustmentType: 'CREDIT',
    amount: '',
    reason: '',
    authorizationRef: ''
  });

  // Action submission states
  const [submitting, setSubmitting] = useState(false);

  const isDirector = user?.role === 'ADMIN_DIRECTOR';

  // Fetch Refunds & Adjustments from backend
  const loadRecords = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();

      // Synchronize activeTab with status/type filter
      if (activeTab === 'REFUNDS') {
        params.type = 'REFUND';
      } else if (activeTab === 'ADJUSTMENTS') {
        params.type = 'ADJUSTMENT';
      } else if (activeTab !== 'ALL') {
        params.status = activeTab;
      }

      if (typeFilter !== 'ALL' && activeTab === 'ALL') {
        params.type = typeFilter;
      }
      if (statusFilter !== 'ALL' && activeTab === 'ALL') {
        params.status = statusFilter;
      }

      if (dateRange === 'OCT_2026') {
        params.startDate = '2026-10-01';
        params.endDate = '2026-10-31';
      } else if (dateRange === 'LAST_30_DAYS') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.startDate = d.toISOString().split('T')[0];
      }

      params.sortBy = sortBy;
      params.sortOrder = sortOrder;
      params.page = page;
      params.limit = limit;

      const res = await api.getRefundsAndAdjustments(params);
      if (res && res.data) {
        setRecords(res.data.records || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        if (res.data.eligiblePayments) {
          setEligiblePayments(res.data.eligiblePayments);
        }
        if (res.data.eligibleBookings) {
          setEligibleBookings(res.data.eligibleBookings);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to load refunds and adjustments.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchTerm, activeTab, typeFilter, statusFilter, dateRange, sortBy, sortOrder, page, limit, showToast]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Tab count indicators
  const tabCounts = useMemo(() => {
    return {
      ALL: records.length,
      REFUNDS: records.filter((r) => r.recordType === 'REFUND').length,
      ADJUSTMENTS: records.filter((r) => r.recordType.includes('ADJUSTMENT')).length,
      PENDING_APPROVAL: summary.pendingApprovalCount || 0,
      APPROVED: records.filter((r) => r.status === 'APPROVED').length,
      PROCESSING: records.filter((r) => r.status === 'PROCESSING').length,
      PROCESSED: records.filter((r) => r.status === 'PROCESSED').length,
      REJECTED: records.filter((r) => r.status === 'REJECTED').length
    };
  }, [records, summary]);

  // Handle Export CSV
  const handleExportCSV = () => {
    if (!records.length) {
      showToast('No records available to export.', 'error');
      return;
    }

    const headers = [
      'Reference',
      'Date',
      'Customer',
      'Booking Reference',
      'Type',
      'Amount (ETB)',
      'Reason',
      'Status',
      'Approved By',
      'Processed Date'
    ];

    const rows = records.map((r) => [
      r.reference,
      formatDate(r.createdAt),
      `"${r.booking?.customer?.fullName || 'N/A'}"`,
      r.booking?.reference || 'N/A',
      r.typeLabel,
      r.amount,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      r.status,
      `"${r.approvedBy?.fullName || 'Pending'}"`,
      formatDate(r.processedAt)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Eventora_Refunds_Adjustments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${records.length} records to CSV.`, 'success');
  };

  // Create Refund Request
  const handleCreateRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundForm.bookingId || !refundForm.amount || !refundForm.reason.trim()) {
      showToast('Booking, amount, and reason are required.', 'error');
      return;
    }

    const numAmount = parseFloat(refundForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Refund amount must be greater than zero.', 'error');
      return;
    }

    if (selectedPaymentForRefund && numAmount > selectedPaymentForRefund.remainingRefundable) {
      showToast(
        `Refund amount cannot exceed remaining refundable balance of ${formatETB(selectedPaymentForRefund.remainingRefundable)}.`,
        'error'
      );
      return;
    }

    try {
      setSubmitting(true);
      await api.createRefundRequest({
        bookingId: refundForm.bookingId,
        originalPaymentId: refundForm.paymentId || null,
        amount: numAmount,
        reason: refundForm.reason.trim(),
        notes: refundForm.notes.trim(),
        refundMethod: refundForm.refundMethod,
        autoApprove: refundForm.autoApprove && isDirector
      });

      showToast('Refund request created successfully.', 'success');
      setNewRefundOpen(false);
      setRefundForm({
        paymentId: '',
        bookingId: '',
        amount: '',
        reason: '',
        refundMethod: 'Bank Transfer (CBE)',
        notes: '',
        autoApprove: false
      });
      setSelectedPaymentForRefund(null);
      loadRecords(true);
    } catch (err) {
      showToast(err.message || 'Failed to submit refund request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Create Adjustment
  const handleCreateAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!adjustmentForm.bookingId || !adjustmentForm.amount || !adjustmentForm.reason.trim()) {
      showToast('Booking, amount, and reason are required.', 'error');
      return;
    }

    const numAmount = parseFloat(adjustmentForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Adjustment amount must be greater than zero.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.createFinancialAdjustment({
        bookingId: adjustmentForm.bookingId,
        adjustmentType: adjustmentForm.adjustmentType,
        amount: numAmount,
        reason: adjustmentForm.reason.trim(),
        authorizationRef: adjustmentForm.authorizationRef.trim()
      });

      showToast('Financial adjustment applied successfully.', 'success');
      setNewAdjustmentOpen(false);
      setAdjustmentForm({
        bookingId: '',
        adjustmentType: 'CREDIT',
        amount: '',
        reason: '',
        authorizationRef: ''
      });
      loadRecords(true);
    } catch (err) {
      showToast(err.message || 'Failed to record adjustment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Refund
  const handleApproveConfirm = async () => {
    if (!approveDialog.record) return;
    try {
      setSubmitting(true);
      await api.approveRefund(approveDialog.record.id);
      showToast(`Refund ${approveDialog.record.reference} approved successfully.`, 'success');
      setApproveDialog({ open: false, record: null });
      loadRecords(true);
    } catch (err) {
      showToast(err.message || 'Failed to approve refund.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Reject Refund
  const handleRejectConfirm = async () => {
    if (!rejectDialog.record) return;
    if (!rejectDialog.reason.trim()) {
      showToast('Documented rejection reason is mandatory.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.rejectRefund(rejectDialog.record.id, rejectDialog.reason.trim());
      showToast(`Refund ${rejectDialog.record.reference} rejected.`, 'info');
      setRejectDialog({ open: false, record: null, reason: '' });
      loadRecords(true);
    } catch (err) {
      showToast(err.message || 'Failed to reject refund.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Process Refund Disbursement
  const handleProcessDisbursementSubmit = async (e) => {
    e.preventDefault();
    if (!processDialog.record) return;
    if (!processDialog.refundTransactionRef.trim()) {
      showToast('Disbursement Transaction Reference is required.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.processRefundExecution(processDialog.record.id, {
        refundTransactionRef: processDialog.refundTransactionRef.trim(),
        refundMethod: processDialog.refundMethod,
        notes: processDialog.notes.trim()
      });

      showToast(`Refund ${processDialog.record.reference} disbursed and processed successfully.`, 'success');
      setProcessDialog({
        open: false,
        record: null,
        refundTransactionRef: '',
        refundMethod: 'Bank Transfer (CBE)',
        notes: ''
      });
      loadRecords(true);
    } catch (err) {
      showToast(err.message || 'Failed to process refund disbursement.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const hasActiveFilters = Boolean(
    searchTerm || activeTab !== 'ALL' || typeFilter !== 'ALL' || statusFilter !== 'ALL' || dateRange !== 'ALL_TIME'
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setActiveTab('ALL');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setDateRange('ALL_TIME');
    setPage(1);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* 1. Header */}
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
            <span className="text-slate-700 font-semibold">Refunds & Adjustments</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Refunds & Adjustments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Manage customer refunds, financial adjustments, approvals, and processing history.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* New Refund Button */}
          <button
            onClick={() => setNewRefundOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F20047] hover:bg-[#d9003e] text-white text-xs font-bold rounded-xl shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Refund</span>
          </button>

          {/* New Adjustment Button */}
          <button
            onClick={() => setNewAdjustmentOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>New Adjustment</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          {/* Sync Button */}
          <button
            onClick={() => loadRecords(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F20047]' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* 2. Four KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Approval */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Approval</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {summary.pendingApprovalCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium flex items-center gap-1">
              <span>Claims awaiting director sign-off</span>
            </p>
          </div>
        </div>

        {/* Card 2: Approved Awaiting Disbursement */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approved (Unpaid)</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">
              {formatETB(summary.approvedPendingDisbursementAmount)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Authorized refunds ready for bank disbursement
            </p>
          </div>
        </div>

        {/* Card 3: Refunded Amount */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Refunded Amount</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#F20047] flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">
              {formatETB(summary.totalRefundedAmount)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Completed real fund returns to customers
            </p>
          </div>
        </div>

        {/* Card 4: Adjustments */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Adjustments</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {summary.adjustmentsCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium flex items-center gap-1.5 flex-wrap">
              <span className="text-emerald-600 font-semibold">-{formatETB(summary.adjustmentsCreditAmount)} (Credit)</span>
              <span>/</span>
              <span className="text-indigo-600 font-semibold">+{formatETB(summary.adjustmentsDebitAmount)} (Debit)</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden border-b border-slate-200/80">
        {[
          { key: 'ALL', label: 'All Records' },
          { key: 'REFUNDS', label: 'Refunds' },
          { key: 'ADJUSTMENTS', label: 'Adjustments' },
          { key: 'PENDING_APPROVAL', label: 'Pending Approval' },
          { key: 'APPROVED', label: 'Approved' },
          { key: 'PROCESSING', label: 'Processing' },
          { key: 'PROCESSED', label: 'Processed' },
          { key: 'REJECTED', label: 'Rejected' }
        ].map((tab) => {
          const isSelected = activeTab === tab.key;
          const count = tabCounts[tab.key] || 0;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                isSelected
                  ? 'bg-[#F20047] text-white shadow-sm shadow-rose-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white bg-slate-50/70 border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Search and Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Input */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search customer, booking ref, payment ref, reason..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Operation Type Dropdown */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Operation Types</option>
              <option value="REFUND">Refunds Only</option>
              <option value="CREDIT_ADJUSTMENT">Credit Adjustments</option>
              <option value="DEBIT_ADJUSTMENT">Debit Adjustments</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="PROCESSING">Processing</option>
              <option value="PROCESSED">Processed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Date Range Dropdown */}
          <div>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL_TIME">All Dates</option>
              <option value="OCT_2026">October 2026</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-slate-500 font-medium">Filters applied</span>
            <button
              onClick={handleResetFilters}
              className="text-[#F20047] hover:underline font-bold cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* 5. Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Booking Ref</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#F20047] mb-2" />
                    <span>Loading refunds and adjustment records...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <RotateCcw className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">No financial adjustment or refund records found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting search parameters or create a new request.</p>
                  </td>
                </tr>
              ) : (
                records.map((item) => {
                  const isRefund = item.recordType === 'REFUND';
                  const isCredit = item.recordType === 'CREDIT_ADJUSTMENT';
                  const isDebit = item.recordType === 'DEBIT_ADJUSTMENT';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Reference */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{item.reference}</span>
                          {item.isTest && (
                            <span className="text-[9px] uppercase font-black bg-amber-100 text-amber-800 px-1 py-0.2 rounded border border-amber-300">
                              TEST
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {item.booking?.customer?.fullName || 'Valued Client'}
                      </td>

                      {/* Booking Reference */}
                      <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                        {item.booking?.reference || 'N/A'}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isRefund && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-[#F20047] border border-rose-200">
                            <RotateCcw className="w-3 h-3" />
                            Refund
                          </span>
                        )}
                        {isCredit && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <TrendingDown className="w-3 h-3" />
                            Credit Adj
                          </span>
                        )}
                        {isDebit && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <TrendingUp className="w-3 h-3" />
                            Debit Adj
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-bold text-right text-slate-900 whitespace-nowrap">
                        {formatETB(item.amount)}
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={item.reason}>
                        {item.reason}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {item.status === 'PROCESSED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Processed
                          </span>
                        )}
                        {item.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Check className="w-3 h-3" />
                            Approved
                          </span>
                        )}
                        {(item.status === 'PENDING_APPROVAL' || item.status === 'PENDING') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Pending Approval
                          </span>
                        )}
                        {item.status === 'PROCESSING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Processing
                          </span>
                        )}
                        {item.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details */}
                          <button
                            onClick={() => setSelectedRecord(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Approve (For Director / Approver on Pending Refund) */}
                          {isRefund && (item.status === 'PENDING_APPROVAL' || item.status === 'PENDING') && isDirector && (
                            <button
                              onClick={() => setApproveDialog({ open: true, record: item })}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title="Approve Refund Claim"
                            >
                              Approve
                            </button>
                          )}

                          {/* Reject (On Pending or Approved Refund) */}
                          {isRefund && (item.status === 'PENDING_APPROVAL' || item.status === 'PENDING' || item.status === 'APPROVED') && (
                            <button
                              onClick={() => setRejectDialog({ open: true, record: item, reason: '' })}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title="Reject Refund Claim"
                            >
                              Reject
                            </button>
                          )}

                          {/* Process Disbursement (Only on Approved Refund) */}
                          {isRefund && item.status === 'APPROVED' && (
                            <button
                              onClick={() =>
                                setProcessDialog({
                                  open: true,
                                  record: item,
                                  refundTransactionRef: '',
                                  refundMethod: 'Bank Transfer (CBE)',
                                  notes: ''
                                })
                              }
                              className="px-2.5 py-1 bg-[#F20047] hover:bg-[#d9003e] text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                              title="Disburse Funds to Customer"
                            >
                              Process
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <span>Showing {records.length} record(s)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer font-medium"
            >
              Previous
            </button>
            <span className="font-bold text-slate-700">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={records.length < limit}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          DRAWER 1: VIEW RECORD DETAILS
          ========================================================= */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200/80 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    selectedRecord.recordType === 'REFUND'
                      ? 'bg-rose-50 text-[#F20047]'
                      : selectedRecord.recordType === 'CREDIT_ADJUSTMENT'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {selectedRecord.recordType === 'REFUND' ? (
                    <RotateCcw className="w-5 h-5" />
                  ) : (
                    <SlidersHorizontal className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{selectedRecord.reference}</h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedRecord.typeLabel}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1 text-xs">
              {/* Status Banner */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-400 block">Record Status</span>
                  <span className="text-sm font-extrabold text-slate-800">{selectedRecord.status}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block">Amount</span>
                  <span className="text-base font-extrabold text-[#F20047]">{formatETB(selectedRecord.amount)}</span>
                </div>
              </div>

              {/* Customer & Booking Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Customer & Event</h4>
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer Name:</span>
                    <span className="font-bold text-slate-800">
                      {selectedRecord.booking?.customer?.fullName || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer Email:</span>
                    <span className="font-medium text-slate-700">
                      {selectedRecord.booking?.customer?.email || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Booking Reference:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedRecord.booking?.reference || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Event Title:</span>
                    <span className="font-medium text-slate-700">
                      {selectedRecord.booking?.title || 'Event Celebration'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Original Payment Information (if Refund) */}
              {selectedRecord.recordType === 'REFUND' && selectedRecord.originalPayment && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Original Payment Source</h4>
                  <div className="p-4 rounded-xl border border-slate-200 space-y-2 bg-slate-50/50">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Channel:</span>
                      <span className="font-bold text-slate-800">
                        {selectedRecord.originalPayment.paymentMethod}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Original Payment Amount:</span>
                      <span className="font-bold text-slate-800">
                        {formatETB(selectedRecord.originalPayment.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">External Tx Reference:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {selectedRecord.originalPayment.externalReference || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Verification Date:</span>
                      <span className="text-slate-700">
                        {formatDateTime(selectedRecord.originalPayment.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Audit & Justification */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Audit & Justification</h4>
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div>
                    <span className="text-slate-500 block mb-1">Reason / Documented Notes:</span>
                    <p className="p-2.5 bg-slate-50 rounded-lg text-slate-800 font-medium">
                      {selectedRecord.reason}
                    </p>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Requested / Created At:</span>
                    <span className="text-slate-700">{formatDateTime(selectedRecord.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Authorized By:</span>
                    <span className="font-bold text-slate-800">
                      {selectedRecord.approvedBy?.fullName || 'Awaiting Authorization'}
                    </span>
                  </div>
                  {selectedRecord.processedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Disbursed At:</span>
                      <span className="text-slate-700">{formatDateTime(selectedRecord.processedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Immutable Accounting Policy Notice */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Financial Integrity Guarantee: Refunds and adjustments generate permanent immutable debit/credit entries. Original verified payment transactions are never modified or deleted.
                </p>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 1: NEW REFUND REQUEST
          ========================================================= */}
      {newRefundOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#F20047] flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">New Refund Request</h3>
                  <p className="text-xs text-slate-500">Initiate an authorized refund against a verified payment.</p>
                </div>
              </div>
              <button
                onClick={() => setNewRefundOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRefundSubmit} className="p-6 space-y-4 text-xs">
              {/* Payment Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select Verified Payment Claim <span className="text-[#F20047]">*</span>
                </label>
                <select
                  value={refundForm.paymentId}
                  onChange={(e) => {
                    const payId = e.target.value;
                    const matched = eligiblePayments.find((p) => p.paymentId === payId);
                    setSelectedPaymentForRefund(matched || null);
                    setRefundForm((prev) => ({
                      ...prev,
                      paymentId: payId,
                      bookingId: matched ? matched.bookingId : '',
                      amount: matched ? String(matched.remainingRefundable) : ''
                    }));
                  }}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:border-[#F20047]"
                >
                  <option value="">-- Choose verified payment --</option>
                  {eligiblePayments.map((p) => (
                    <option key={p.paymentId} value={p.paymentId}>
                      {p.customerName} — {p.bookingReference} ({formatETB(p.remainingRefundable)} available)
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Payment Context Card */}
              {selectedPaymentForRefund && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-bold text-slate-800">{selectedPaymentForRefund.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Booking:</span>
                    <span className="font-medium text-slate-700">{selectedPaymentForRefund.bookingReference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Original Amount:</span>
                    <span className="font-bold text-slate-800">{formatETB(selectedPaymentForRefund.originalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Already Refunded:</span>
                    <span className="text-slate-700">{formatETB(selectedPaymentForRefund.totalRefunded)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="font-bold text-slate-700">Remaining Refundable:</span>
                    <span className="font-extrabold text-[#F20047]">{formatETB(selectedPaymentForRefund.remainingRefundable)}</span>
                  </div>
                </div>
              )}

              {/* Refund Amount */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Refund Amount (ETB) <span className="text-[#F20047]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={selectedPaymentForRefund ? selectedPaymentForRefund.remainingRefundable : undefined}
                  value={refundForm.amount}
                  onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                  placeholder="e.g. 25000"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-hidden focus:border-[#F20047]"
                />
              </div>

              {/* Refund Method */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Proposed Disbursement Channel</label>
                <select
                  value={refundForm.refundMethod}
                  onChange={(e) => setRefundForm({ ...refundForm, refundMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-hidden"
                >
                  <option value="Bank Transfer (CBE)">Bank Transfer (CBE)</option>
                  <option value="Bank Transfer (Awash)">Bank Transfer (Awash Bank)</option>
                  <option value="Telebirr">Telebirr Account</option>
                  <option value="Cash / Cheque">Cash / Office Cheque</option>
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mandatory Reason / Justification <span className="text-[#F20047]">*</span>
                </label>
                <textarea
                  rows="2"
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                  placeholder="e.g., Cancellation of premium lighting add-on per customer amendment request."
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:border-[#F20047]"
                />
              </div>

              {/* Admin Director Auto-Approve Checkbox */}
              {isDirector && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <input
                    type="checkbox"
                    id="autoApproveCheck"
                    checked={refundForm.autoApprove}
                    onChange={(e) => setRefundForm({ ...refundForm, autoApprove: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="autoApproveCheck" className="text-xs font-bold text-emerald-900 cursor-pointer">
                    Director Immediate Authorization (Bypass Pending Approval)
                  </label>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewRefundOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#F20047] hover:bg-[#d9003e] text-white rounded-xl font-bold shadow-sm shadow-rose-500/20 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Submitting...' : 'Submit Refund Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: NEW FINANCIAL ADJUSTMENT
          ========================================================= */}
      {newAdjustmentOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">New Financial Adjustment</h3>
                  <p className="text-xs text-slate-500">Apply an authorized debit or credit correction to a booking.</p>
                </div>
              </div>
              <button
                onClick={() => setNewAdjustmentOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdjustmentSubmit} className="p-6 space-y-4 text-xs">
              {/* Booking Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select Customer Booking <span className="text-[#F20047]">*</span>
                </label>
                <select
                  value={adjustmentForm.bookingId}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, bookingId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:border-[#F20047]"
                >
                  <option value="">-- Choose active booking --</option>
                  {eligibleBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.reference} — {b.customer?.fullName || 'Client'} ({b.title})
                    </option>
                  ))}
                </select>
              </div>

              {/* Adjustment Type Toggle */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Adjustment Type <span className="text-[#F20047]">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustmentForm({ ...adjustmentForm, adjustmentType: 'CREDIT' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      adjustmentForm.adjustmentType === 'CREDIT'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <TrendingDown className="w-4 h-4 text-emerald-600" />
                      <span>Credit Adjustment</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Decreases customer obligation (e.g. discount, waiver, goodwill rebate).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentForm({ ...adjustmentForm, adjustmentType: 'DEBIT' })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      adjustmentForm.adjustmentType === 'DEBIT'
                        ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                      <span>Debit Adjustment</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Increases customer obligation (e.g. additional chairs, extra hours).
                    </p>
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Adjustment Amount (ETB) <span className="text-[#F20047]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={adjustmentForm.amount}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                  placeholder="e.g. 5000"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-hidden focus:border-[#F20047]"
                />
              </div>

              {/* Authorization Reference */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Authorization Reference / Director Sign-off
                </label>
                <input
                  type="text"
                  value={adjustmentForm.authorizationRef}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, authorizationRef: e.target.value })}
                  placeholder="e.g. DIR-AUTH-2026-042"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-hidden"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Documented Reason <span className="text-[#F20047]">*</span>
                </label>
                <textarea
                  rows="2"
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  placeholder="e.g. Authorized goodwill discount for delayed setup in Main Ballroom."
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:border-[#F20047]"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewAdjustmentOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-2xs cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Applying...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          DIALOG 1: APPROVE REFUND CONFIRMATION
          ========================================================= */}
      {approveDialog.open && approveDialog.record && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-xs space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-extrabold text-slate-900">Authorize Refund</h3>
              <p className="text-slate-500 mt-1">
                Are you sure you want to approve refund claim <span className="font-bold text-slate-800">{approveDialog.record.reference}</span> for{' '}
                <span className="font-bold text-[#F20047]">{formatETB(approveDialog.record.amount)}</span>?
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl text-slate-600 border border-slate-200">
              <span className="font-bold block text-slate-700 mb-0.5">Customer Justification:</span>
              <p className="italic">{approveDialog.record.reason}</p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setApproveDialog({ open: false, record: null })}
                className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveConfirm}
                disabled={submitting}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          DIALOG 2: REJECT REFUND
          ========================================================= */}
      {rejectDialog.open && rejectDialog.record && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-xs space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-extrabold text-slate-900">Reject Refund Claim</h3>
              <p className="text-slate-500 mt-1">
                Rejecting <span className="font-bold text-slate-800">{rejectDialog.record.reference}</span> ({formatETB(rejectDialog.record.amount)}).
              </p>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Documented Rejection Reason <span className="text-[#F20047]">*</span>
              </label>
              <textarea
                rows="3"
                value={rejectDialog.reason}
                onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
                placeholder="State the commercial or contractual grounds for rejecting this claim..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:border-[#F20047]"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setRejectDialog({ open: false, record: null, reason: '' })}
                className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={submitting}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          DIALOG 3: PROCESS REFUND DISBURSEMENT
          ========================================================= */}
      {processDialog.open && processDialog.record && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Process Disbursement</h3>
                  <p className="text-slate-500">Record payout execution for approved refund.</p>
                </div>
              </div>
              <button
                onClick={() => setProcessDialog({ open: false, record: null, refundTransactionRef: '', refundMethod: '', notes: '' })}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessDisbursementSubmit} className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Refund Claim:</span>
                  <span className="font-mono font-bold text-slate-800">{processDialog.record.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-800">
                    {processDialog.record.booking?.customer?.fullName || 'Client'}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">Amount to Disburse:</span>
                  <span className="font-extrabold text-[#F20047]">{formatETB(processDialog.record.amount)}</span>
                </div>
              </div>

              {/* Disbursement Reference */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bank / Gateway Transaction Reference <span className="text-[#F20047]">*</span>
                </label>
                <input
                  type="text"
                  value={processDialog.refundTransactionRef}
                  onChange={(e) => setProcessDialog({ ...processDialog, refundTransactionRef: e.target.value })}
                  placeholder="e.g. CBE-RTGS-9988123 or TELE-REF-776"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-hidden focus:border-[#F20047]"
                />
              </div>

              {/* Disbursement Method */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Disbursement Channel</label>
                <select
                  value={processDialog.refundMethod}
                  onChange={(e) => setProcessDialog({ ...processDialog, refundMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-hidden"
                >
                  <option value="Bank Transfer (CBE)">Bank Transfer (CBE)</option>
                  <option value="Bank Transfer (Awash)">Bank Transfer (Awash Bank)</option>
                  <option value="Telebirr">Telebirr Direct Disbursement</option>
                  <option value="Cash / Cheque">Cash / Physical Cheque</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Processing Notes</label>
                <textarea
                  rows="2"
                  value={processDialog.notes}
                  onChange={(e) => setProcessDialog({ ...processDialog, notes: e.target.value })}
                  placeholder="Optional notes regarding the disbursement..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProcessDialog({ open: false, record: null, refundTransactionRef: '', refundMethod: '', notes: '' })}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#F20047] hover:bg-[#d9003e] text-white rounded-xl font-bold shadow-sm shadow-rose-500/20 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Processing...' : 'Confirm Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

