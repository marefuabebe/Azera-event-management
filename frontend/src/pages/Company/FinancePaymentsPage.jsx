import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  X,
  RefreshCw,
  FileText,
  Printer,
  Download,
  ExternalLink,
  ShieldCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Receipt,
  Building,
  User,
  Users,
  Phone,
  Mail,
  Check,
  MoreVertical,
  FlaskConical,
  XCircle,
  FileCheck,
  ArrowUpDown,
  Maximize2
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

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export default function FinancePaymentsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL query state
  const initialStatusTab = searchParams.get('status') || 'PENDING';
  const [activeTab, setActiveTab] = useState(initialStatusTab.toUpperCase());

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({
    pendingCount: 0,
    verifiedCount: 0,
    rejectedCount: 0,
    pendingAmount: 0,
    testCount: 0
  });

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterEnvironment, setFilterEnvironment] = useState('ALL'); // 'ALL' | 'LIVE' | 'TEST'
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalCount, setTotalCount] = useState(0);

  // Modals & Drawers
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [verifyModal, setVerifyModal] = useState({ open: false, payment: null });
  const [reconciledConfirmed, setReconciledConfirmed] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [rejectModal, setRejectModal] = useState({ open: false, payment: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [receiptModal, setReceiptModal] = useState({ open: false, payment: null, receiptData: null, loading: false });
  const [evidenceModal, setEvidenceModal] = useState({ open: false, url: null, title: '' });
  const [kebabOpenId, setKebabOpenId] = useState(null);

  // Fetch payments from backend
  const fetchPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      if (activeTab === 'TEST') {
        params.append('environment', 'TEST');
      } else if (activeTab !== 'ALL') {
        params.append('status', activeTab);
        if (filterEnvironment !== 'ALL') {
          params.append('environment', filterEnvironment);
        } else {
          // By default, exclude simulated test transactions from standard tabs
          params.append('environment', 'LIVE');
        }
      } else if (filterEnvironment !== 'ALL') {
        params.append('environment', filterEnvironment);
      }

      if (filterMethod) params.append('paymentMethod', filterMethod);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      params.append('page', String(page));
      params.append('limit', String(pageSize));

      const res = await api.getAllPayments(`?${params.toString()}`);
      if (res && res.data) {
        setPayments(res.data.payments || []);
        setTotalCount(res.data.count || 0);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
      showToast(err.message || 'Failed to retrieve payment records from server.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, filterMethod, filterEnvironment, searchTerm, filterStartDate, filterEndDate, sortBy, sortOrder, page, pageSize, showToast]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Sync tab change with searchParams
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setPage(1);
    const p = new URLSearchParams(searchParams);
    p.set('status', newTab.toLowerCase());
    setSearchParams(p);
  };

  // Open Details Drawer
  const handleOpenDetails = async (payment) => {
    try {
      setDetailsDrawerOpen(true);
      const res = await api.getPaymentById(payment.id);
      if (res && res.data && res.data.payment) {
        setSelectedPayment(res.data.payment);
      } else {
        setSelectedPayment(payment);
      }
    } catch {
      setSelectedPayment(payment);
    }
  };

  // Open Verify Modal
  const handleOpenVerify = (payment) => {
    setVerifyModal({ open: true, payment });
    setReconciledConfirmed(false);
    setVerifyNotes('');
  };

  // Confirm Verification
  const handleConfirmVerify = async () => {
    if (!verifyModal.payment) return;
    if (!reconciledConfirmed) {
      showToast('You must reconcile and confirm that money was received in the bank statement.', 'error');
      return;
    }

    setVerifying(true);
    try {
      const res = await api.verifyPayment(verifyModal.payment.id, true, {
        notes: verifyNotes.trim() || 'Verified upon reconciliation with bank statement.'
      });
      showToast(res.message || 'Payment successfully verified. Official receipt issued.', 'success');
      setVerifyModal({ open: false, payment: null });
      if (detailsDrawerOpen && selectedPayment?.id === verifyModal.payment.id) {
        setDetailsDrawerOpen(false);
      }
      fetchPayments(true);
    } catch (err) {
      showToast(err.message || 'Failed to verify payment claim.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  // Open Reject Modal
  const handleOpenReject = (payment) => {
    setRejectModal({ open: true, payment });
    setRejectionReason('');
    setRejectionError('');
  };

  // Confirm Rejection
  const handleConfirmReject = async () => {
    if (!rejectModal.payment) return;
    if (!rejectionReason.trim()) {
      setRejectionError('A specific rejection reason is required.');
      return;
    }

    setRejecting(true);
    try {
      const res = await api.verifyPayment(rejectModal.payment.id, false, {
        rejectionReason: rejectionReason.trim()
      });
      showToast(res.message || 'Payment claim rejected.', 'info');
      setRejectModal({ open: false, payment: null });
      if (detailsDrawerOpen && selectedPayment?.id === rejectModal.payment.id) {
        setDetailsDrawerOpen(false);
      }
      fetchPayments(true);
    } catch (err) {
      showToast(err.message || 'Failed to reject payment claim.', 'error');
    } finally {
      setRejecting(false);
    }
  };

  // View Official Receipt
  const handleOpenReceipt = async (payment) => {
    if (payment.environment === 'TEST') {
      showToast('Official receipts cannot be issued for simulated TEST mode transactions.', 'error');
      return;
    }

    const receiptNum = payment.receipt?.receiptNumber;
    setReceiptModal({ open: true, payment, receiptData: null, loading: Boolean(receiptNum) });

    if (receiptNum) {
      try {
        const res = await api.getReceiptByNumber(receiptNum);
        if (res && res.data && res.data.receipt) {
          setReceiptModal((prev) => ({ ...prev, receiptData: res.data.receipt, loading: false }));
        } else {
          setReceiptModal((prev) => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.error('Failed to load official receipt:', err);
        setReceiptModal((prev) => ({ ...prev, loading: false }));
      }
    }
  };

  // Export Payments CSV
  const handleExportCSV = () => {
    if (!payments.length) {
      showToast('No payment records available to export.', 'info');
      return;
    }

    const headers = [
      'Payment ID',
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      'Booking Reference',
      'Contract Reference',
      'Amount ETB',
      'Payment Method',
      'Transaction Reference',
      'Status',
      'Environment',
      'Submitted At',
      'Verified At',
      'Receipt Number'
    ];

    const rows = payments.map((p) => [
      `"${p.id}"`,
      `"${p.submittedBy?.fullName || p.booking?.customer?.fullName || 'Client'}"`,
      `"${p.submittedBy?.email || p.booking?.customer?.email || ''}"`,
      `"${p.submittedBy?.phone || p.booking?.customer?.phone || ''}"`,
      `"${p.booking?.reference || 'N/A'}"`,
      `"${p.booking?.contracts?.[0]?.id ? `CNT-v${p.booking.contracts[0].version}` : 'N/A'}"`,
      `"${p.amount}"`,
      `"${p.paymentMethod}"`,
      `"${p.externalReference || 'N/A'}"`,
      `"${p.status}"`,
      `"${p.environment}"`,
      `"${p.createdAt ? new Date(p.createdAt).toISOString() : ''}"`,
      `"${p.verification?.verifiedAt ? new Date(p.verification.verifiedAt).toISOString() : ''}"`,
      `"${p.receipt?.receiptNumber || 'None'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Eventora_Payments_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Successfully exported ${payments.length} payment records.`, 'success');
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterMethod('');
    setFilterEnvironment('ALL');
    setFilterStartDate('');
    setFilterEndDate('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() || filterMethod || filterEnvironment !== 'ALL' || filterStartDate || filterEndDate
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* =========================================================
          1. PAGE HEADER & ACTIONS
          ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <Link to="/company/dashboard" className="hover:text-[#F50046] transition-colors">
              Finance Portal
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-700 font-semibold">Payments</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Payments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Review and verify customer payment submissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
            className={`inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer ${
              filterDrawerOpen || hasActiveFilters ? 'border-[#F50046] text-[#F50046] ring-1 ring-[#F50046]/20' : ''
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-[#F50046]" />
            )}
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-5 py-2 bg-[#F50046] hover:bg-[#d9003f] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Export</span>
          </button>

          <button
            onClick={() => fetchPayments(true)}
            disabled={refreshing}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-500 hover:text-slate-800 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Refresh payment records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F50046]' : ''}`} />
          </button>
        </div>
      </div>

      {/* =========================================================
          2. SUMMARY CARDS (Strictly Real Backend DB Records)
          ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Verification */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-center justify-between group hover:border-amber-300 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pending Verification
            </span>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {summary.pendingCount}
            </div>
            <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              <span>Claims awaiting bank reconciliation</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Verified Payments */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-center justify-between group hover:border-emerald-300 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Verified Payments
            </span>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {summary.verifiedCount}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>Real funds cleared & receipts issued</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Rejected Payments */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-center justify-between group hover:border-rose-300 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rejected Payments
            </span>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {summary.rejectedCount}
            </div>
            <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
              <XCircle className="w-3 h-3 shrink-0" />
              <span>Invalid or unverified claims</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Pending Amount */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-center justify-between group hover:border-blue-300 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pending Amount
            </span>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatETB(summary.pendingAmount)}
            </div>
            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Excluded from verified ledger</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* =========================================================
          3. PAYMENT STATUS TABS (Exact Mockup Alignment)
          ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 overflow-x-auto [scrollbar-width:none]">
          <button
            onClick={() => handleTabChange('PENDING')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'PENDING'
                ? 'bg-[#F50046] text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Pending ({summary.pendingCount})
          </button>

          <button
            onClick={() => handleTabChange('VERIFIED')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'VERIFIED'
                ? 'bg-[#F50046] text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Verified ({summary.verifiedCount})
          </button>

          <button
            onClick={() => handleTabChange('REJECTED')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'REJECTED'
                ? 'bg-[#F50046] text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Rejected ({summary.rejectedCount})
          </button>
        </div>

        {/* Page size selector */}
        <div className="flex items-center gap-2 text-xs text-slate-500 self-end sm:self-auto">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value={10}>10 records</option>
            <option value={20}>20 records</option>
            <option value={50}>50 records</option>
          </select>
        </div>
      </div>

      {/* =========================================================
          4. FILTER & SEARCH DRAWER
          ========================================================= */}
      {filterDrawerOpen && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                placeholder="Search by customer name, booking ref, or slip ID..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
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

            {/* Payment Method */}
            <div>
              <select
                value={filterMethod}
                onChange={(e) => {
                  setFilterMethod(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="">All Payment Methods</option>
                <option value="BANK_TRANSFER">Bank Transfer (CBE / Awash / Dashen)</option>
                <option value="TELEBIRR">Telebirr Confirmation</option>
                <option value="CHAPA">Chapa Online Gateway</option>
                <option value="CASH">Cash / Physical Office</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => {
                  setFilterStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
                title="Filter start date"
              />
            </div>

            {/* End Date */}
            <div>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => {
                  setFilterEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
                title="Filter end date"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>
              Matching filtered records: <strong className="text-slate-800">{totalCount}</strong>
            </span>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-xs font-bold text-[#F20047] hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          5. PAYMENT TABLE (Aligned with Mockup Reference)
          ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Booking Ref</th>
                <th
                  onClick={() => {
                    if (sortBy === 'amount') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else {
                      setSortBy('amount');
                      setSortOrder('desc');
                    }
                  }}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Amount</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Method</th>
                <th
                  onClick={() => {
                    if (sortBy === 'createdAt') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else {
                      setSortBy('createdAt');
                      setSortOrder('desc');
                    }
                  }}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Submitted At</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-7 h-7 text-[#F50046] animate-spin mx-auto mb-2" />
                    <p className="font-bold text-slate-600">Loading payment records...</p>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No payment submissions found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {hasActiveFilters
                        ? 'Try clearing active filters to see all payments.'
                        : 'No payment submissions currently in this category.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleClearFilters}
                        className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const customerName = p.submittedBy?.fullName || p.booking?.customer?.fullName || 'Client';
                  const bookingRef = p.booking?.reference || 'N/A';
                  const isTest = p.environment === 'TEST';
                  const isPending = p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW';
                  const isVerified = p.status === 'VERIFIED';
                  const isRejected = p.status === 'REJECTED';

                  // Method formatting
                  const methodLabel =
                    p.paymentMethod === 'BANK_TRANSFER'
                      ? 'Bank Transfer'
                      : p.paymentMethod === 'TELEBIRR'
                      ? 'Telebirr'
                      : p.paymentMethod === 'CHAPA'
                      ? 'Chapa Gateway'
                      : p.paymentMethod === 'CASH'
                      ? 'Cash'
                      : 'Other';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Customer */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200/80 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {p.submittedBy?.avatar ? (
                              <img src={p.submittedBy.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              customerName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{customerName}</div>
                            <div className="text-[11px] text-slate-400 font-normal">
                              {p.submittedBy?.location || p.submittedBy?.phone || 'Customer'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Booking Reference */}
                      <td className="py-4 px-4 font-mono font-bold text-slate-700">
                        <Link
                          to={`/company/bookings?selectedBookingId=${p.bookingId}`}
                          className="hover:text-[#F50046] transition-colors"
                          title="View Booking"
                        >
                          {bookingRef}
                        </Link>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 font-black text-slate-900 font-mono">
                        {formatETB(p.amount)}
                      </td>

                      {/* Method */}
                      <td className="py-4 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {methodLabel}
                      </td>

                      {/* Submitted At */}
                      <td className="py-4 px-4 text-[11px] whitespace-nowrap leading-tight">
                        <div className="font-medium text-slate-700">{formatDate(p.createdAt)}</div>
                        <div className="text-slate-400 font-mono text-[10px]">{formatTime(p.createdAt)}</div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isTest && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                              TEST
                            </span>
                          )}
                          {isPending ? (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#D97706]">
                              Pending
                            </span>
                          ) : isVerified ? (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                              Verified
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                              Rejected
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          {/* Verify Button (Only for eligible pending manual payments & Finance role) */}
                          {isPending && !isTest && (user?.role === 'FINANCE' || user?.role === 'ADMIN_DIRECTOR') && (
                            <button
                              onClick={() => handleOpenVerify(p)}
                              className="px-4 py-1 rounded-full border border-[#F50046] text-[#F50046] hover:bg-[#F50046] hover:text-white font-bold text-xs transition-all shadow-2xs cursor-pointer"
                            >
                              Verify
                            </button>
                          )}

                          {/* View Receipt Button (For verified payments with receipt) */}
                          {isVerified && p.receipt && (
                            <button
                              onClick={() => handleOpenReceipt(p)}
                              className="px-3 py-1 rounded-full border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold text-xs transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                              title="View Official Receipt"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Receipt</span>
                            </button>
                          )}

                          {/* Kebab Menu */}
                          <div className="relative">
                            <button
                              onClick={() => setKebabOpenId(kebabOpenId === p.id ? null : p.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="More options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {kebabOpenId === p.id && (
                              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-40 animate-in fade-in duration-100 text-left">
                                <button
                                  onClick={() => {
                                    handleOpenDetails(p);
                                    setKebabOpenId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Full Details</span>
                                </button>

                                {p.evidenceDocument && (
                                  <button
                                    onClick={() => {
                                      setEvidenceModal({
                                        open: true,
                                        url: p.evidenceDocument,
                                        title: `Payment Evidence — ${p.booking?.reference || 'Claim'}`
                                      });
                                      setKebabOpenId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <FileCheck className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Inspect Deposit Slip</span>
                                  </button>
                                )}

                                {isPending && !isTest && (user?.role === 'FINANCE' || user?.role === 'ADMIN_DIRECTOR') && (
                                  <>
                                    <button
                                      onClick={() => {
                                        handleOpenVerify(p);
                                        setKebabOpenId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 font-semibold"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Verify Payment</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        handleOpenReject(p);
                                        setKebabOpenId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold"
                                    >
                                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                      <span>Reject Claim</span>
                                    </button>
                                  </>
                                )}

                                {isVerified && !isTest && (
                                  <button
                                    onClick={() => {
                                      handleOpenReceipt(p);
                                      setKebabOpenId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <Receipt className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Official Receipt</span>
                                  </button>
                                )}

                                <Link
                                  to={`/company/bookings?selectedBookingId=${p.bookingId}`}
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                  <span>View Booking</span>
                                </Link>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* =========================================================
            6. PAGINATION FOOTER
            ========================================================= */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/40">
          <div>
            Showing{' '}
            <strong className="text-slate-900 font-bold">
              {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)}
            </strong>{' '}
            of <strong className="text-slate-900 font-bold">{totalCount}</strong> payments
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) pageNum = i + 1;
              else if (page <= 3) pageNum = i + 1;
              else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = page - 2 + i;

              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    page === pageNum
                      ? 'bg-[#F50046] text-white shadow-2xs'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          7. PAYMENT DETAILS SIDE DRAWER
          ========================================================= */}
      {detailsDrawerOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setDetailsDrawerOpen(false)}
          />

          <div className="relative w-full max-w-xl bg-white shadow-2xl z-10 flex flex-col h-full overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-20">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Payment Claim Audit
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {selectedPayment.externalReference || 'Payment Details'}
                </h2>
              </div>
              <button
                onClick={() => setDetailsDrawerOpen(false)}
                className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-6 flex-1">
              {/* Verified Status Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">VERIFIED FINANCIAL RECORD</strong>
                  <p className="mt-0.5 text-emerald-800">
                    This transaction has been successfully confirmed and reconciled with payment settlement records.
                  </p>
                </div>
              </div>

              {/* Status Badge & Overview Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Submitted Claim Amount</div>
                  <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                    {formatETB(selectedPayment.amount)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Method: <strong className="text-slate-700">{selectedPayment.paymentMethod}</strong>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                      selectedPayment.status === 'VERIFIED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedPayment.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedPayment.status}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono">
                    {formatDate(selectedPayment.createdAt)} {formatTime(selectedPayment.createdAt)}
                  </div>
                </div>
              </div>

              {/* Customer Contact Information */}
              <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Customer & Contact Information</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-400 font-medium">Customer Name</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {selectedPayment.submittedBy?.fullName || selectedPayment.booking?.customer?.fullName || 'Client'}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-400 font-medium">Phone Number</div>
                    <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{selectedPayment.submittedBy?.phone || selectedPayment.booking?.customer?.phone || 'Not recorded'}</span>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-slate-400 font-medium">Email Address</div>
                    <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>{selectedPayment.submittedBy?.email || selectedPayment.booking?.customer?.email || 'Not recorded'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Booking & Contract Context */}
              <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Booking & Contract Information</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-400 font-medium">Booking Reference</div>
                    <Link
                      to={`/company/bookings?selectedBookingId=${selectedPayment.bookingId}`}
                      className="font-mono font-bold text-[#F20047] hover:underline mt-0.5 block"
                    >
                      {selectedPayment.booking?.reference || 'N/A'}
                    </Link>
                  </div>

                  <div>
                    <div className="text-slate-400 font-medium">Event Title</div>
                    <div className="font-bold text-slate-900 mt-0.5 truncate">
                      {selectedPayment.booking?.title || 'Celebration'}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-400 font-medium">Contract Reference</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {selectedPayment.financialContext?.activeContract
                        ? `CNT-v${selectedPayment.financialContext.activeContract.version}`
                        : 'Under Preparation'}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-400 font-medium">Contract Total Amount</div>
                    <div className="font-mono font-black text-slate-900 mt-0.5">
                      {formatETB(selectedPayment.financialContext?.contractTotal || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Outstanding Balance & Payment Progress (50/50 Schedule) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Balance Calculation & Progress</span>
                  <span className="font-mono text-emerald-700">
                    {selectedPayment.financialContext?.paymentProgress || 0}% Cleared
                  </span>
                </h3>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${selectedPayment.financialContext?.paymentProgress || 0}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <div className="text-slate-500 font-medium">Total Verified Cleared</div>
                    <div className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                      {formatETB(selectedPayment.financialContext?.totalVerifiedPaid || 0)}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500 font-medium">Remaining Outstanding Due</div>
                    <div className="font-mono font-bold text-rose-600 text-sm mt-0.5">
                      {formatETB(selectedPayment.financialContext?.outstandingBalance || 0)}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 pt-1">
                  Eventora commercial policy requires 50% initial deposit upon contract execution and remaining 50% prior to event execution.
                </p>
              </div>

              {/* Uploaded Payment Evidence */}
              <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Uploaded Payment Evidence</span>
                  {selectedPayment.evidenceDocument && (
                    <button
                      onClick={() =>
                        setEvidenceModal({
                          open: true,
                          url: selectedPayment.evidenceDocument,
                          title: `Payment Evidence — ${selectedPayment.externalReference}`
                        })
                      }
                      className="text-xs font-bold text-[#F20047] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Inspect Fullscreen</span>
                    </button>
                  )}
                </h3>

                {selectedPayment.evidenceDocument ? (
                  <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-56 flex items-center justify-center">
                    <img
                      src={selectedPayment.evidenceDocument}
                      alt="Bank deposit slip evidence"
                      className="max-h-56 object-contain"
                    />
                    <div
                      onClick={() =>
                        setEvidenceModal({
                          open: true,
                          url: selectedPayment.evidenceDocument,
                          title: `Payment Evidence — ${selectedPayment.externalReference}`
                        })
                      }
                      className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Click to Enlarge</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-600">No Document File Uploaded</p>
                    <p className="text-[11px] text-slate-400">Claim submitted via transaction reference only.</p>
                  </div>
                )}
              </div>

              {/* Verification History / Rejection Notice */}
              {selectedPayment.verification && (
                <div
                  className={`p-4 rounded-2xl border ${
                    selectedPayment.verification.isApproved
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/60 border-rose-200 text-rose-950'
                  } space-y-2`}
                >
                  <h4 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    {selectedPayment.verification.isApproved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>
                      {selectedPayment.verification.isApproved
                        ? 'Verification Record (Approved)'
                        : 'Verification Decision (Rejected)'}
                    </span>
                  </h4>

                  <div className="text-xs space-y-1">
                    <div>
                      Audited by:{' '}
                      <strong className="font-bold">
                        {selectedPayment.verification.verifiedBy?.fullName || 'Finance Officer'}
                      </strong>
                    </div>
                    <div>
                      Audited at:{' '}
                      <span className="font-mono text-slate-600">
                        {formatDate(selectedPayment.verification.verifiedAt)}{' '}
                        {formatTime(selectedPayment.verification.verifiedAt)}
                      </span>
                    </div>

                    {!selectedPayment.verification.isApproved && selectedPayment.verification.rejectionReason && (
                      <div className="p-3 bg-white/80 rounded-xl border border-rose-200 text-rose-800 text-xs mt-2">
                        <strong className="font-bold block mb-0.5">Rejection Reason:</strong>
                        <span>{selectedPayment.verification.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Actions Footer */}
            <div className="p-6 border-t border-slate-200 bg-white sticky bottom-0 flex items-center gap-3">
              {selectedPayment.status === 'SUBMITTED' || selectedPayment.status === 'UNDER_REVIEW' ? (
                <>
                  <button
                    onClick={() => handleOpenVerify(selectedPayment)}
                    className="flex-1 py-2.5 px-4 bg-[#F20047] hover:bg-[#d9003f] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify Payment</span>
                  </button>

                  <button
                    onClick={() => handleOpenReject(selectedPayment)}
                    className="py-2.5 px-4 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Claim</span>
                  </button>
                </>
              ) : selectedPayment.status === 'VERIFIED' && selectedPayment.receipt ? (
                <button
                  onClick={() => handleOpenReceipt(selectedPayment)}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Receipt className="w-4 h-4" />
                  <span>View Official Commercial Receipt</span>
                </button>
              ) : (
                <button
                  onClick={() => setDetailsDrawerOpen(false)}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close Details
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          8. VERIFY PAYMENT CONFIRMATION MODAL
          ========================================================= */}
      {verifyModal.open && verifyModal.payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Verify Payment Claim</h3>
                  <p className="text-xs text-slate-500 font-medium">Reconcile received money with bank statement</p>
                </div>
              </div>
              <button
                onClick={() => setVerifyModal({ open: false, payment: null })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Mandatory Reconciliation Warning */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                <strong className="font-bold flex items-center gap-1 text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Mandatory Reconciliation Notice</span>
                </strong>
                <p>
                  An uploaded screenshot, slip image, or reference code alone is <strong>never sufficient proof</strong>. You must verify that the funds have cleared and appear on the official Eventora bank account statement before approving.
                </p>
              </div>

              {/* Payment Summary Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Customer:</span>
                  <strong className="text-slate-900 font-bold">
                    {verifyModal.payment.submittedBy?.fullName || verifyModal.payment.booking?.customer?.fullName || 'Client'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Booking Reference:</span>
                  <strong className="font-mono text-slate-900 font-bold">
                    {verifyModal.payment.booking?.reference || 'N/A'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Payment Method:</span>
                  <strong className="text-slate-900 font-bold">{verifyModal.payment.paymentMethod}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Transaction Reference:</span>
                  <strong className="font-mono text-slate-900">{verifyModal.payment.externalReference || '—'}</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
                  <span className="text-slate-700 font-bold">Amount to Reconcile:</span>
                  <strong className="font-mono font-black text-emerald-600 text-base">
                    {formatETB(verifyModal.payment.amount)}
                  </strong>
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Audit Notes (Optional)
                </label>
                <input
                  type="text"
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="e.g. CBE statement line #49281 confirmed by Mekdes"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
                />
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={reconciledConfirmed}
                  onChange={(e) => setReconciledConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-[#F20047] focus:ring-[#F20047]"
                />
                <span className="text-slate-700 font-medium">
                  I confirm that I have reconciled this transaction with the company bank records and verified receipt of{' '}
                  <strong className="font-bold text-slate-900">{formatETB(verifyModal.payment.amount)}</strong>.
                </span>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setVerifyModal({ open: false, payment: null })}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmVerify}
                disabled={!reconciledConfirmed || verifying}
                className="px-4 py-2 bg-[#F20047] hover:bg-[#d9003f] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                {verifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Confirm & Verify Payment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          9. REJECT PAYMENT CONFIRMATION MODAL
          ========================================================= */}
      {rejectModal.open && rejectModal.payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Reject Payment Claim</h3>
                  <p className="text-xs text-slate-500 font-medium">Record unverified or invalid transaction</p>
                </div>
              </div>
              <button
                onClick={() => setRejectModal({ open: false, payment: null })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <strong className="text-slate-900">
                    {rejectModal.payment.submittedBy?.fullName || rejectModal.payment.booking?.customer?.fullName || 'Client'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking Reference:</span>
                  <strong className="font-mono text-slate-900">{rejectModal.payment.booking?.reference}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Submitted Amount:</span>
                  <strong className="font-mono text-slate-900">{formatETB(rejectModal.payment.amount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction Reference:</span>
                  <strong className="font-mono text-slate-900">{rejectModal.payment.externalReference || '—'}</strong>
                </div>
              </div>

              {/* Required Reason Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    setRejectionError('');
                  }}
                  placeholder="e.g. Transaction could not be found in the bank statement. Please check your transfer reference and submit the correct payment details."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
                />
                {rejectionError && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{rejectionError}</p>
                )}
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500">Quick Reason Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setRejectionReason(
                        'Transaction could not be found in the bank statement. Please check your transfer reference and submit the correct payment details.'
                      )
                    }
                    className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Not in Bank Statement
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setRejectionReason(
                        'Deposit slip image is unreadable, blurry, or missing transaction details. Please re-upload a clear copy.'
                      )
                    }
                    className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Unreadable Slip
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setRejectionReason(
                        'Submitted payment amount does not match the bank record. Please verify the exact amount transferred.'
                      )
                    }
                    className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Amount Discrepancy
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectModal({ open: false, payment: null })}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejecting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                {rejecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Confirm Rejection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          10. OFFICIAL RECEIPT MODAL
          ========================================================= */}
      {receiptModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 print:static print:bg-transparent print:p-0 print:overflow-visible">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col print:max-h-none print:border-none print:shadow-none print:w-full print:max-w-none print:p-0">
            {/* Modal Top Bar */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Official Commercial Digital Receipt
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (receiptModal.loading) {
                      showToast('Receipt details are being loaded. Please try in a moment.', 'warning');
                      return;
                    }
                    window.print();
                  }}
                  className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setReceiptModal({ open: false, payment: null, receiptData: null, loading: false })}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Receipt Body */}
            <div className="p-8 space-y-6 overflow-y-auto font-sans print:p-0">
              {/* Receipt Header */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-5">
                <div>
                  <div className="text-xl font-black text-[#F20047] tracking-tight">EVENTORA</div>
                  <div className="text-xs font-bold text-slate-800">Events & Celebrations PLC</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-tight">
                    Bole Sub-City, Mickey Leland St<br />
                    Addis Ababa, Ethiopia<br />
                    Tel: +251 11 661 2345 | finance@eventora.et
                  </div>
                </div>

                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wider">
                    Official Receipt
                  </span>
                  <div className="text-base font-black font-mono text-slate-900 mt-2">
                    {receiptModal.receiptData?.receiptNumber || receiptModal.payment?.receipt?.receiptNumber || 'REC-2026-00001'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Date: {formatDate(receiptModal.receiptData?.issuedAt || receiptModal.payment?.receipt?.issuedAt || new Date())}
                  </div>
                </div>
              </div>

              {/* Tax & Legal Compliance Info */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-slate-600">
                <div>
                  TIN: <strong className="text-slate-900">{receiptModal.receiptData?.company?.tin || '0092817462'}</strong>
                </div>
                <div className="text-right">
                  VAT Reg: <strong className="text-slate-900">{receiptModal.receiptData?.company?.vat || '118274619'}</strong>
                </div>
              </div>

              {/* Customer & Booking Particulars */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">Received From:</span>
                  <strong className="text-slate-900 font-bold text-sm block mt-0.5">
                    {receiptModal.receiptData?.customerName ||
                      receiptModal.payment?.submittedBy?.fullName ||
                      receiptModal.payment?.booking?.customer?.fullName ||
                      'Valued Customer'}
                  </strong>
                  <div className="text-slate-500 text-[11px]">
                    {receiptModal.receiptData?.customerPhone || receiptModal.payment?.submittedBy?.phone || ''}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-slate-400 font-medium block">Booking Reference:</span>
                  <strong className="font-mono text-slate-900 font-bold block mt-0.5">
                    {receiptModal.receiptData?.bookingReference || receiptModal.payment?.booking?.reference || 'N/A'}
                  </strong>
                  <div className="text-slate-500 text-[11px]">
                    Contract: {receiptModal.receiptData?.contractReference || 'CNT-v1'}
                  </div>
                </div>
              </div>

              {/* Receipt Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Description</th>
                      <th className="py-2.5 px-3 text-left">Payment Method</th>
                      <th className="py-2.5 px-3 text-left">Ref Number</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">
                          {receiptModal.payment?.paymentType === 'INITIAL_50_PERCENT'
                            ? '50% Initial Booking Deposit'
                            : receiptModal.payment?.paymentType === 'FINAL_50_PERCENT'
                            ? '50% Final Celebration Settlement'
                            : 'Event Celebration Milestone Payment'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {receiptModal.payment?.booking?.title || 'Celebration Services'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {receiptModal.receiptData?.paymentMethod || receiptModal.payment?.paymentMethod || 'Bank Transfer'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                        {receiptModal.receiptData?.externalReference || receiptModal.payment?.externalReference || '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatETB(receiptModal.receiptData?.amount || receiptModal.payment?.amount || 0)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-50/70 border-t border-slate-200">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 font-extrabold text-slate-800 text-right uppercase text-[11px]">
                        Total Verified Received
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 text-sm">
                        {formatETB(receiptModal.receiptData?.amount || receiptModal.payment?.amount || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Receipt Footer & Signatures */}
              <div className="pt-4 border-t border-slate-200 flex items-end justify-between text-xs text-slate-500">
                <div>
                  <div className="text-[11px]">Verified & Audited by:</div>
                  <strong className="text-slate-800 font-bold block mt-0.5">
                    {receiptModal.receiptData?.verifiedBy ||
                      receiptModal.payment?.verification?.verifiedBy?.fullName ||
                      'Mekdes Tadesse (Finance Officer)'}
                  </strong>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Audited: {formatDate(receiptModal.receiptData?.verifiedAt || new Date())}
                  </div>
                </div>

                <div className="text-right">
                  <div className="w-24 border-b border-slate-400 pb-1 mb-1 font-mono text-[10px] text-slate-400">
                    [E-AFFIRMATION]
                  </div>
                  <span className="text-[10px] text-slate-400">Official Eventora Digital Stamp</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          11. EVIDENCE IMAGE MODAL
          ========================================================= */}
      {evidenceModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>{evidenceModal.title || 'Payment Evidence Document'}</span>
              </h3>
              <button
                onClick={() => setEvidenceModal({ open: false, url: null, title: '' })}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-100 flex items-center justify-center overflow-auto flex-1">
              <img
                src={evidenceModal.url}
                alt="Payment evidence document"
                className="max-h-[70vh] rounded-xl object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

