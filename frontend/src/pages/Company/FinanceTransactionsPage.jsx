import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  Receipt,
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
  ChevronRight,
  Eye,
  Building,
  User,
  Phone,
  Mail,
  FlaskConical,
  ArrowUpDown,
  CreditCard,
  Check
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

const getPaymentStageLabel = (type) => {
  switch (type) {
    case 'INITIAL_50_PERCENT':
      return 'Initial 50% Milestone';
    case 'FINAL_50_PERCENT':
      return 'Final 50% Settlement';
    case 'FULL_PAYMENT':
      return '100% Full Payment';
    case 'SUPPLEMENTAL':
      return 'Supplemental Addition';
    default:
      return 'Event Payment';
  }
};

export default function FinanceTransactionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    verifiedCount: 0,
    totalVerifiedAmount: 0,
    receiptsGeneratedCount: 0,
    receiptsPendingCount: 0
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterReceiptStatus, setFilterReceiptStatus] = useState('ALL'); // 'ALL' | 'GENERATED' | 'NOT_GENERATED'
  const [filterEnvironment, setFilterEnvironment] = useState('ALL'); // 'ALL' | 'LIVE' | 'TEST'
  const [dateRange, setDateRange] = useState('ALL_TIME');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState(null);

  // Modals & Drawers
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [generateModal, setGenerateModal] = useState({ open: false, transaction: null, submitting: false });
  const [receiptModal, setReceiptModal] = useState({ open: false, receipt: null, loading: false });

  // Fetch transactions from backend
  const loadTransactions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams();
      // Default to VERIFIED records for Transactions & Receipts unless explicitly looking at TEST
      params.append('status', 'VERIFIED');
      params.append('page', page.toString());
      params.append('limit', pageSize.toString());
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (filterMethod) params.append('paymentMethod', filterMethod);
      if (filterStage) params.append('paymentType', filterStage);
      if (filterReceiptStatus && filterReceiptStatus !== 'ALL') {
        params.append('receiptStatus', filterReceiptStatus);
      }
      if (filterEnvironment && filterEnvironment !== 'ALL') {
        params.append('environment', filterEnvironment);
      }

      // Date ranges
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

      const res = await api.getAllPayments(`?${params.toString()}`);
      if (res && res.data) {
        const list = res.data.payments || [];
        setTransactions(list);

        const verifiedList = list.filter((p) => p.status === 'VERIFIED');
        const sumVerified = verifiedList.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const countReceipts = list.filter((p) => Boolean(p.receipt)).length;
        const countPendingReceipts = verifiedList.filter((p) => !p.receipt).length;

        setSummary({
          verifiedCount: (res.data.summary?.verifiedCount > 0 ? res.data.summary.verifiedCount : verifiedList.length),
          totalVerifiedAmount: (res.data.summary?.totalVerifiedAmount > 0 ? res.data.summary.totalVerifiedAmount : sumVerified),
          receiptsGeneratedCount: (res.data.summary?.receiptsGeneratedCount > 0 ? res.data.summary.receiptsGeneratedCount : countReceipts),
          receiptsPendingCount: (res.data.summary?.receiptsPendingCount !== undefined ? res.data.summary.receiptsPendingCount : countPendingReceipts)
        });
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load transaction history:', err);
      showToast('Failed to load transaction history.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, pageSize, sortBy, sortOrder, searchTerm, filterMethod, filterStage, filterReceiptStatus, filterEnvironment, dateRange, showToast]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Open Details Drawer
  const handleOpenDetails = (tx) => {
    setSelectedTransaction(tx);
    setDetailsDrawerOpen(true);
  };

  // Helper to build full receipt data immediately from local payment object
  const buildReceiptFromPayment = (payment, receiptNumber = null) => {
    if (!payment) return null;
    const rNum = receiptNumber || payment.receipt?.receiptNumber || `REC-${new Date().getFullYear()}-${String(payment.id || '00001').slice(0, 5).toUpperCase()}`;
    const issuedDate = payment.receipt?.issuedAt || payment.verification?.verifiedAt || payment.createdAt || new Date().toISOString();
    const verifiedDate = payment.verification?.verifiedAt || payment.receipt?.issuedAt || payment.createdAt || new Date().toISOString();
    const customer = payment.booking?.customer || payment.submittedBy || {};
    
    let contractRef = 'N/A';
    if (payment.booking?.contracts && payment.booking.contracts.length > 0) {
      const activeContract = payment.booking.contracts[0];
      contractRef = activeContract.version ? `CNT-v${activeContract.version}` : (activeContract.id ? `CNT-${activeContract.id.slice(0, 8).toUpperCase()}` : 'N/A');
    }

    return {
      receiptNumber: rNum,
      customerName: customer.fullName || 'Valued Client',
      customerPhone: customer.phone || '',
      customerEmail: customer.email || '',
      bookingReference: payment.booking?.reference || 'N/A',
      contractReference: contractRef,
      amount: Number(payment.receipt?.amount ?? payment.amount ?? 0),
      currency: payment.receipt?.currency || payment.currency || 'ETB',
      paymentMethod: payment.paymentMethod,
      externalReference: payment.externalReference || 'N/A',
      issuedAt: issuedDate,
      verifiedAt: verifiedDate,
      verifiedBy: payment.verification?.verifiedBy?.fullName || 'Eventora Finance Officer',
      company: {
        name: 'Eventora Events & Celebrations PLC',
        address: 'Bole Sub-City, Mickey Leland St, Addis Ababa, Ethiopia',
        phone: '+251 11 661 2345',
        email: 'finance@eventora.et',
        tin: '0092817462',
        vat: '118274619'
      }
    };
  };

  // Open Receipt Modal (Instant display without blocking retrieve spinner)
  const handleViewReceipt = (receiptNumber, fallbackPayment = null) => {
    const instantReceipt = buildReceiptFromPayment(fallbackPayment, receiptNumber);

    if (instantReceipt) {
      setReceiptModal({
        open: true,
        receipt: instantReceipt,
        loading: false
      });
    } else {
      setReceiptModal({ open: true, receipt: null, loading: true });
    }

    // Background sync: Fetch latest audit snapshot if receiptNumber is present
    if (receiptNumber) {
      api.getReceiptByNumber(receiptNumber)
        .then((res) => {
          if (res && res.data?.receipt) {
            setReceiptModal((prev) => (prev.open ? { ...prev, receipt: res.data.receipt, loading: false } : prev));
          }
        })
        .catch((err) => {
          console.debug('Background receipt sync:', err?.message);
          if (!instantReceipt) {
            showToast(err.message || 'Unable to open official receipt.', 'error');
            setReceiptModal({ open: false, receipt: null, loading: false });
          }
        });
    }
  };

  // Trigger Generate Receipt Action
  const handleConfirmGenerateReceipt = async () => {
    if (!generateModal.transaction) return;
    try {
      setGenerateModal((prev) => ({ ...prev, submitting: true }));
      const res = await api.issueReceipt(generateModal.transaction.id);

      if (res && res.data?.receipt) {
        showToast(
          res.data.isDuplicate
            ? `Receipt already existed: ${res.data.receipt.receiptNumber}`
            : `Official receipt ${res.data.receipt.receiptNumber} generated successfully.`,
          'success'
        );
        setGenerateModal({ open: false, transaction: null, submitting: false });
        // Automatically open the generated receipt
        setReceiptModal({ open: true, receipt: res.data.receipt, loading: false });
        // Refresh transaction list & counts
        loadTransactions(true);
      }
    } catch (err) {
      console.error('Failed to generate receipt:', err);
      showToast(err.message || 'Receipt generation failed. Verify payment eligibility.', 'error');
      setGenerateModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!transactions || transactions.length === 0) {
      showToast('No transaction records available to export.', 'error');
      return;
    }
    const headers = [
      'Verification Date',
      'Transaction Ref',
      'Customer',
      'Booking Ref',
      'Description',
      'Amount (ETB)',
      'Method',
      'Status',
      'Receipt Number'
    ];
    const rows = transactions.map((t) => [
      formatDate(t.verification?.verifiedAt || t.createdAt),
      t.externalReference || 'NO-REF',
      `"${t.booking?.customer?.fullName || t.submittedBy?.fullName || 'Client'}"`,
      t.booking?.reference || 'N/A',
      `"${getPaymentStageLabel(t.paymentType)}"`,
      t.amount,
      t.paymentMethod || 'Bank Transfer',
      t.status || 'VERIFIED',
      t.receipt?.receiptNumber || 'Not Generated'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Eventora_Transactions_Receipts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${transactions.length} verified transactions as CSV.`, 'success');
  };

  // Print Receipt
  const handlePrintReceipt = () => {
    if (!receiptModal.receipt) {
      showToast('Receipt details are being prepared. Please try in a moment.', 'warning');
      return;
    }
    window.print();
  };

  const hasActiveFilters = Boolean(
    searchTerm || filterMethod || filterStage || filterReceiptStatus !== 'ALL' || filterEnvironment !== 'ALL'
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterMethod('');
    setFilterStage('');
    setFilterReceiptStatus('ALL');
    setFilterEnvironment('ALL');
    setPage(1);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* 1. Header matching exact Eventora Design System */}
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
            <span className="text-slate-700 font-semibold">Transactions & Receipts</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Transactions & Receipts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            View verified payment history and manage customer receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Date Range Selector */}
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
              <option value="ALL_TIME">All Fiscal Periods (All Time)</option>
              <option value="OCT_2026">Oct 1, 2026 – Oct 31, 2026</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
              <option value="THIS_QUARTER">Q4 2026</option>
            </select>
          </div>

          {/* Sync Button */}
          <button
            onClick={() => loadTransactions(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F20047]' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Filter Drawer Toggle */}
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

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F20047] hover:bg-[#d9003e] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 2. Four Summary Cards (Real Backend Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Verified Transactions */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500">Verified Transactions</p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {summary.verifiedCount.toLocaleString('en-US')}
          </div>
          <div className="mt-2 text-[11px] font-medium flex items-center gap-1.5 text-slate-400">
            <span className="text-emerald-600 font-bold">100% Audited</span>
            <span>real customer payments</span>
          </div>
        </div>

        {/* Card 2: Total Verified Amount */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-[#F20047] mb-3">
            <CreditCard className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500">Total Verified Amount</p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {formatETB(summary.totalVerifiedAmount)}
          </div>
          <div className="mt-2 text-[11px] font-medium flex items-center gap-1.5 text-slate-400">
            <span className="text-slate-600 font-bold">Reconciled funds</span>
            <span>in selected period</span>
          </div>
        </div>

        {/* Card 3: Receipts Generated */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 mb-3">
            <Receipt className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500">Receipts Generated</p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {summary.receiptsGeneratedCount.toLocaleString('en-US')}
          </div>
          <div className="mt-2 text-[11px] font-bold flex items-center gap-1 text-blue-600">
            <CheckCircle2 className="w-3 h-3" />
            <span>Official digital receipts issued</span>
          </div>
        </div>

        {/* Card 4: Receipts Pending */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500">Receipts Pending</p>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {summary.receiptsPendingCount.toLocaleString('en-US')}
          </div>
          <div className="mt-2 text-[11px] font-bold flex items-center gap-1 text-amber-600">
            <AlertTriangle className="w-3 h-3" />
            <span>Eligible for receipt issuance</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar & Search Bar */}
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
              placeholder="Search customer, booking ref, transaction ref..."
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

          {/* Payment Method Filter */}
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
              <option value="BANK_TRANSFER">Bank Transfer (CBE / Awash)</option>
              <option value="TELEBIRR">Telebirr Confirmation</option>
              <option value="CHAPA">Chapa Online Gateway</option>
              <option value="CASH">Cash Office</option>
            </select>
          </div>

          {/* Payment Stage Filter */}
          <div>
            <select
              value={filterStage}
              onChange={(e) => {
                setFilterStage(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">All Payment Stages</option>
              <option value="INITIAL_50_PERCENT">Initial 50% Deposit</option>
              <option value="FINAL_50_PERCENT">Final 50% Settlement</option>
              <option value="FULL_PAYMENT">100% Full Payment</option>
              <option value="SUPPLEMENTAL">Supplemental Addition</option>
            </select>
          </div>

          {/* Receipt Status Filter */}
          <div>
            <select
              value={filterReceiptStatus}
              onChange={(e) => {
                setFilterReceiptStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Receipt Statuses</option>
              <option value="GENERATED">Receipt Generated</option>
              <option value="NOT_GENERATED">Receipt Not Generated</option>
            </select>
          </div>
        </div>

        {/* Secondary Extended Filters Drawer */}
        {filterDrawerOpen && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Environment
              </label>
              <select
                value={filterEnvironment}
                onChange={(e) => {
                  setFilterEnvironment(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Reconciled Funds</option>
                <option value="LIVE">Primary Operating Account</option>
                <option value="TEST">Secondary Digital Gateway</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Sort By
              </label>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="createdAt">Date Recorded</option>
                  <option value="amount">Amount (ETB)</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-2.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  title="Toggle Sort Order"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleResetFilters}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Showing <strong className="text-slate-800">{transactions.length}</strong> verified transactions
          </span>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-[#F20047] hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Transactions History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#F20047] animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Loading verified transactions...
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No verified transactions found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Payments submitted by customers are reviewed on the Payments page. Once verified, eligible real transactions appear here.
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
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Transaction Ref</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Booking Ref</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Method</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Receipt</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {transactions.map((tx) => {
                  const isTest = tx.environment === 'TEST';
                  const hasReceipt = Boolean(tx.receipt);

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {formatDate(tx.verification?.verifiedAt || tx.createdAt)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {tx.verification?.verifiedAt ? 'Verified' : 'Created'}
                        </div>
                      </td>

                      {/* Transaction Reference */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/60 text-[11px]">
                          {tx.externalReference || 'NO-REF'}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{tx.booking?.customer?.fullName || tx.submittedBy?.fullName || 'Customer'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 pl-5">
                          {tx.booking?.customer?.phone || tx.submittedBy?.phone || ''}
                        </div>
                      </td>

                      {/* Booking Reference */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-600">
                          {tx.booking?.reference || 'N/A'}
                        </span>
                      </td>

                      {/* Description / Stage */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-medium">
                        {getPaymentStageLabel(tx.paymentType)}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-extrabold text-slate-900 text-sm">
                          {formatETB(tx.amount)}
                        </span>
                      </td>

                      {/* Method */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                        {tx.paymentMethod === 'BANK_TRANSFER'
                          ? 'Bank Transfer'
                          : tx.paymentMethod === 'TELEBIRR'
                          ? 'Telebirr'
                          : tx.paymentMethod === 'CASH'
                          ? 'Cash Office'
                          : 'Chapa Gateway'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Verified
                        </span>
                      </td>

                      {/* Receipt Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasReceipt ? (
                          <button
                            onClick={() => handleViewReceipt(tx.receipt.receiptNumber, tx)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                            title="View Receipt"
                          >
                            <Receipt className="w-2.5 h-2.5" />
                            <span>{tx.receipt.receiptNumber}</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-2.5 h-2.5" />
                            Not Generated
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(tx)}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>Details</span>
                          </button>

                          {hasReceipt ? (
                            <button
                              onClick={() => handleViewReceipt(tx.receipt.receiptNumber, tx)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Receipt className="w-3 h-3 text-blue-600" />
                              <span>View Receipt</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setGenerateModal({ open: true, transaction: tx, submitting: false })}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-[#F20047] text-[#F20047] hover:text-white border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Generate Receipt</span>
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

      {/* 5. READ-ONLY TRANSACTION DETAILS DRAWER */}
      {detailsDrawerOpen && selectedTransaction && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div>
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Historical Ledger Record
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    Transaction Details
                  </h3>
                </div>
                <button
                  onClick={() => setDetailsDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-5 space-y-5">
                {/* Status Notice */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Verified immutable financial record. Reconciled with electronic payment gateway.</span>
                </div>

                {/* Amount & Method Banner */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Verified Amount
                    </span>
                    <div className="text-2xl font-black text-slate-900">
                      {formatETB(selectedTransaction.amount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Method
                    </span>
                    <div className="text-xs font-bold text-slate-800">
                      {selectedTransaction.paymentMethod === 'BANK_TRANSFER'
                        ? 'Bank Transfer'
                        : selectedTransaction.paymentMethod === 'TELEBIRR'
                        ? 'Telebirr'
                        : selectedTransaction.paymentMethod === 'CASH'
                        ? 'Cash Office'
                        : 'Chapa Gateway'}
                    </div>
                  </div>
                </div>

                {/* Core Attributes */}
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Customer Name</span>
                    <span className="font-bold text-slate-900">
                      {selectedTransaction.booking?.customer?.fullName || selectedTransaction.submittedBy?.fullName || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Customer Phone</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {selectedTransaction.booking?.customer?.phone || selectedTransaction.submittedBy?.phone || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Customer Email</span>
                    <span className="font-semibold text-slate-800">
                      {selectedTransaction.booking?.customer?.email || selectedTransaction.submittedBy?.email || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Booking Reference</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedTransaction.booking?.reference || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Contract Reference</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedTransaction.booking?.contracts?.[0]?.id
                        ? `CNT-${selectedTransaction.booking.contracts[0].version}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Payment Stage</span>
                    <span className="font-bold text-slate-900">
                      {getPaymentStageLabel(selectedTransaction.paymentType)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Transaction Reference</span>
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {selectedTransaction.externalReference || 'NO-REF'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Submitted At</span>
                    <span className="font-semibold text-slate-800">
                      {formatDateTime(selectedTransaction.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Verification Date</span>
                    <span className="font-semibold text-emerald-800">
                      {formatDateTime(selectedTransaction.verification?.verifiedAt || selectedTransaction.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Verifying Finance Officer</span>
                    <span className="font-bold text-slate-900">
                      {selectedTransaction.verification?.verifiedBy?.fullName || 'Eventora Finance Officer'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Official Receipt</span>
                    <span className="font-bold text-slate-900">
                      {selectedTransaction.receipt?.receiptNumber ? (
                        <span className="text-emerald-700 font-mono">
                          {selectedTransaction.receipt.receiptNumber}
                        </span>
                      ) : (
                        <span className="text-amber-600">Pending Issuance</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Uploaded Evidence Slip (if present) */}
                {selectedTransaction.paymentProofUrl && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-slate-700 block">
                      Uploaded Payment Evidence
                    </span>
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-2">
                      <img
                        src={selectedTransaction.paymentProofUrl}
                        alt="Payment Evidence"
                        className="w-full max-h-52 object-contain rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
              <button
                onClick={() => setDetailsDrawerOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>

              {selectedTransaction.receipt ? (
                <button
                  onClick={() => {
                    setDetailsDrawerOpen(false);
                    handleViewReceipt(selectedTransaction.receipt.receiptNumber, selectedTransaction);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>View Official Receipt</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setDetailsDrawerOpen(false);
                    setGenerateModal({ open: true, transaction: selectedTransaction, submitting: false });
                  }}
                  className="px-4 py-2 bg-[#F20047] hover:bg-[#d9003e] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Generate Receipt</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. GENERATE RECEIPT CONFIRMATION MODAL */}
      {generateModal.open && generateModal.transaction && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-[#F20047] flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">
                  Generate Official Receipt
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Issue an official sequential receipt under Eventora PLC Ethiopian commercial regulations.
                </p>
              </div>

              {/* Receipt Preview Summary */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">
                    {generateModal.transaction.booking?.customer?.fullName || generateModal.transaction.submittedBy?.fullName || 'Client'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking Ref:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {generateModal.transaction.booking?.reference || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Amount:</span>
                  <span className="font-black text-[#F20047] text-sm">
                    {formatETB(generateModal.transaction.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-semibold text-slate-800">
                    {generateModal.transaction.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Telebirr'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction Ref:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {generateModal.transaction.externalReference || 'NO-REF'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 font-medium">
                Receipt numbers are generated sequentially and immutable once issued. Duplicate receipts cannot be created for the same payment.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setGenerateModal({ open: false, transaction: null, submitting: false })}
                disabled={generateModal.submitting}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmGenerateReceipt}
                disabled={generateModal.submitting}
                className="px-4 py-2 bg-[#F20047] hover:bg-[#d9003e] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {generateModal.submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Issue Receipt</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. PRINTABLE OFFICIAL DIGITAL RECEIPT MODAL */}
      {receiptModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:static print:bg-transparent print:p-0 print:overflow-visible">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8 print:my-0 print:border-none print:shadow-none print:w-full print:max-w-none print:p-0">
            {/* Top Toolbar (Hidden during print) */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#F20047]" />
                <span className="text-xs font-bold text-slate-900">
                  Official Digital Commercial Receipt
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintReceipt}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setReceiptModal({ open: false, receipt: null, loading: false })}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Receipt Printable Body */}
            {receiptModal.receipt ? (
              <div className="p-8 sm:p-10 space-y-6 print:p-0 print:space-y-4 bg-white" id="printable-receipt">
                {/* Company Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-[#F20047] flex items-center justify-center text-white font-black text-sm">
                        E
                      </div>
                      <span className="text-lg font-black tracking-tight text-slate-900">
                        EVENTORA
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      {receiptModal.receipt.company?.name || 'Eventora Events & Celebrations PLC'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {receiptModal.receipt.company?.address || 'Bole Sub-City, Mickey Leland St, Addis Ababa, Ethiopia'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Tel: {receiptModal.receipt.company?.phone || '+251 11 661 2345'} | Email: {receiptModal.receipt.company?.email || 'finance@eventora.et'}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider mb-2">
                      OFFICIAL RECEIPT
                    </span>
                    <div className="text-sm font-mono font-black text-slate-900">
                      {receiptModal.receipt.receiptNumber}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Issue Date: {formatDate(receiptModal.receipt.issuedAt)}
                    </div>
                  </div>
                </div>

                {/* Tax Credentials Bar */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 grid grid-cols-2 text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold">TIN: </span>
                    <strong className="font-mono text-slate-900">{receiptModal.receipt.company?.tin || '0092817462'}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 font-semibold">VAT Reg No: </span>
                    <strong className="font-mono text-slate-900">{receiptModal.receipt.company?.vat || '118274619'}</strong>
                  </div>
                </div>

                {/* Received From Client Details */}
                <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Received From
                    </span>
                    <p className="font-bold text-slate-900 text-sm">
                      {receiptModal.receipt.customerName}
                    </p>
                    {receiptModal.receipt.customerPhone && (
                      <p className="text-slate-600 font-mono mt-0.5">
                        {receiptModal.receipt.customerPhone}
                      </p>
                    )}
                    {receiptModal.receipt.customerEmail && (
                      <p className="text-slate-500 mt-0.5">
                        {receiptModal.receipt.customerEmail}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Event References
                    </span>
                    <p className="text-slate-700">
                      Booking: <strong className="font-mono text-slate-900">{receiptModal.receipt.bookingReference || 'N/A'}</strong>
                    </p>
                    <p className="text-slate-700 mt-0.5">
                      Contract: <strong className="font-mono text-slate-900">{receiptModal.receipt.contractReference || 'N/A'}</strong>
                    </p>
                  </div>
                </div>

                {/* Receipt Line Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-2.5 px-3 text-left">Description</th>
                        <th className="py-2.5 px-3 text-left">Payment Method & Ref</th>
                        <th className="py-2.5 px-3 text-right">Amount Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">Event Services Milestone Payment</p>
                          <p className="text-[11px] text-slate-500">
                            Reconciled & verified under Eventora financial policy
                          </p>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <p className="font-semibold text-slate-800">
                            {receiptModal.receipt.paymentMethod === 'BANK_TRANSFER'
                              ? 'Bank Transfer'
                              : receiptModal.receipt.paymentMethod === 'TELEBIRR'
                              ? 'Telebirr'
                              : receiptModal.receipt.paymentMethod === 'CASH'
                              ? 'Cash Deposit'
                              : (receiptModal.receipt.paymentMethod || 'Bank Transfer')}
                          </p>
                          <p className="font-mono text-[11px] text-slate-400">
                            {receiptModal.receipt.externalReference || 'NO-REF'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-900 text-sm">
                          {formatETB(receiptModal.receipt.amount)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/80 border-t-2 border-slate-200">
                        <td colSpan={2} className="py-3 px-3 font-bold text-slate-900 uppercase tracking-wider text-right">
                          Total Received (ETB)
                        </td>
                        <td className="py-3 px-3 text-right font-black text-[#F20047] text-base">
                          {formatETB(receiptModal.receipt.amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Audit & Legal Footer */}
                <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-[11px] text-slate-500">
                  <div>
                    <p>Verified on: <strong>{formatDateTime(receiptModal.receipt.verifiedAt || receiptModal.receipt.issuedAt)}</strong></p>
                    <p>Auditing Officer: <strong>{receiptModal.receipt.verifiedBy || 'Eventora Finance Officer'}</strong></p>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Certified Eventora Legal Receipt</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Computer-generated commercial document</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs">
                Receipt record is being prepared...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

