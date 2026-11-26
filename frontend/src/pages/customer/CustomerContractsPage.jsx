import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { isCustomerEmailUnverified, UNVERIFIED_ACTION_MESSAGE } from '../../utils/emailVerification';
import {
  FileText,
  FileCheck,
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
  ShieldCheck,
  Eye,
  ArrowUpRight,
  CreditCard,
  UserCheck,
  Building,
  Lock,
  PenTool
} from 'lucide-react';

export default function CustomerContractsPage() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [inspectorModalOpen, setInspectorModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [activeSignContract, setActiveSignContract] = useState(null);

  // Digital Signature Form State
  const [signatureName, setSignatureName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [signingMethod, setSigningMethod] = useState('ELECTRONIC_AFFIRMATION');
  const [documentUrl, setDocumentUrl] = useState('');
  const [submittingSignature, setSubmittingSignature] = useState(false);
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

  // Load Contracts from API
  const loadData = async () => {
    try {
      setLoading(true);
      setActionErrorMsg('');

      let contractList = [];
      try {
        const res = await api.getContracts();
        if (res?.data?.contracts) {
          contractList = res.data.contracts;
        }
      } catch (err) {
        console.warn('api.getContracts error, using fallback:', err);
      }

      setContracts(contractList || []);
    } catch (err) {
      console.error('Error loading contracts:', err);
      setActionErrorMsg('Failed to load contracts. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Digital Signature Submission
  const handleSignContract = async () => {
    if (!activeSignContract) return;
    if (isCustomerEmailUnverified(user)) {
      setActionErrorMsg(UNVERIFIED_ACTION_MESSAGE);
      return;
    }
    if (!signatureName.trim()) {
      setActionErrorMsg('Please enter your full legal name as digital signature evidence.');
      return;
    }
    if (!agreeTerms) {
      setActionErrorMsg('You must check the agreement box confirming legal consent.');
      return;
    }

    try {
      setSubmittingSignature(true);
      setActionErrorMsg('');

      const evidence =
        signingMethod === 'PHYSICAL_UPLOAD_SCAN'
          ? `Physical signed contract scan confirmed by ${signatureName.trim()} with reference: ${documentUrl || 'Uploaded Scan Document'}`
          : `Digital electronic signature affirmed by ${signatureName.trim()} with explicit consent on ${new Date().toISOString()}`;

      await api.signContract(activeSignContract.id, {
        signatureEvidence: evidence,
        signingMethod,
        documentUrl: signingMethod === 'PHYSICAL_UPLOAD_SCAN' ? documentUrl : null
      });

      setActionSuccessMsg(
        `Contract for ${activeSignContract.booking?.reference} was successfully signed! Your agreement is now legally executed, and your 50% initial payment schedule is unlocked.`
      );
      setSignModalOpen(false);
      setActiveSignContract(null);
      setSignatureName('');
      setAgreeTerms(false);
      setSigningMethod('ELECTRONIC_AFFIRMATION');
      setDocumentUrl('');
      await loadData();
    } catch (err) {
      console.error('Signing error:', err);
      setActionErrorMsg(err.message || 'Failed to sign contract. Please try again.');
    } finally {
      setSubmittingSignature(false);
    }
  };

  // Open Contract Inspector & Fetch Full Details (triggers markViewed if SENT)
  const handleOpenContract = async (contract) => {
    setSelectedContract(contract);
    setInspectorModalOpen(true);
    if (contract.id && !contract.id.startsWith('demo-')) {
      try {
        const res = await api.getContractById(contract.id);
        if (res?.data?.contract) {
          setSelectedContract(res.data.contract);
          setContracts((prev) =>
            prev.map((c) => (c.id === contract.id ? res.data.contract : c))
          );
        }
      } catch (err) {
        console.warn('Could not fetch full contract details:', err);
      }
    }
  };

  // Accept formal Contract Amendment
  const handleAcceptAmendment = async (amendmentId) => {
    if (isCustomerEmailUnverified(user)) {
      setActionErrorMsg(UNVERIFIED_ACTION_MESSAGE);
      return;
    }
    try {
      setLoading(true);
      setActionErrorMsg('');
      await api.acceptContractAmendment(amendmentId);
      setActionSuccessMsg('Contract amendment accepted successfully! The payment schedule has been updated.');
      await loadData();
      if (selectedContract && !selectedContract.id.startsWith('demo-')) {
        const res = await api.getContractById(selectedContract.id);
        if (res?.data?.contract) setSelectedContract(res.data.contract);
      }
    } catch (err) {
      console.error('Failed to accept amendment:', err);
      setActionErrorMsg(err.message || 'Failed to accept amendment.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Print Contract
  const handlePrintContract = (contract) => {
    setSelectedContract(contract);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Filter and Sort Logic
  const filteredContracts = contracts.filter((c) => {
    const searchMatch =
      c.booking?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.booking?.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.booking?.assignedCoordinator?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.termsAndConditions?.toLowerCase().includes(searchQuery.toLowerCase());

    const statusMatch = statusFilter === 'ALL' || c.status === statusFilter;
    const typeMatch = eventTypeFilter === 'ALL' || c.booking?.eventType === eventTypeFilter;

    return searchMatch && statusMatch && typeMatch;
  });

  const sortedContracts = [...filteredContracts].sort((a, b) => {
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
    return 0;
  });

  // Pagination calculation
  const totalItems = sortedContracts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedContracts.slice(indexOfFirstItem, indexOfLastItem);

  // Status Badge Helper with strict whitespace-nowrap and single-line pills
  const getStatusBadge = (status, isFullyExecuted) => {
    if (isFullyExecuted || status === 'SIGNED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Fully Executed</span>
        </span>
      );
    }
    switch (status) {
      case 'PARTIALLY_SIGNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0 shadow-2xs">
            <PenTool className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Awaiting Signature</span>
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap shrink-0 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>Issued / Ready for Review</span>
          </span>
        );
      case 'VIEWED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0 shadow-2xs">
            <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Under Review</span>
          </span>
        );
      case 'PENDING_SIGNATURES':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shrink-0 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Pending Signatures</span>
          </span>
        );
      case 'AMENDMENT_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap shrink-0 shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Amendment Proposed</span>
          </span>
        );
      case 'REJECTED':
      case 'CANCELLED':
      case 'VOIDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FCECE8] text-[#B95650] border border-[#E8B5A6] whitespace-nowrap shrink-0 shadow-2xs">
            <X className="w-3.5 h-3.5 text-[#B95650] shrink-0" />
            <span>{status}</span>
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

  // Format ETB Currency
  const formatETB = (val) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      maximumFractionDigits: 0
    }).format(num);
  };

  // Check if current user has already signed
  const hasUserSigned = (contract) => {
    return Boolean(contract.signatures?.some((s) => s.signerType === 'CUSTOMER'));
  };

  const hasCompanySigned = (contract) => {
    return Boolean(contract.signatures?.some((s) => s.signerType === 'COMPANY_AUTHORIZED'));
  };

  // KPI Overview Metrics
  const awaitingSignatureCount = contracts.filter((c) => !hasUserSigned(c) && c.status !== 'VOIDED').length;
  const executedCount = contracts.filter((c) => c.isFullyExecuted || c.status === 'SIGNED').length;
  const totalContractValue = contracts
    .filter((c) => c.status !== 'VOIDED')
    .reduce((sum, c) => sum + Number(c.totalAmount || 0), 0);
  const pendingDepositSum = contracts
    .filter((c) => !c.isFullyExecuted && c.status !== 'VOIDED')
    .reduce((sum, c) => sum + Number(c.initialPaymentAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFDFC] p-6 rounded-2xl border border-[#E8DDD3] shadow-2xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-[#E8DDD3] text-xs font-bold text-slate-700 mb-2">
            <FileText className="w-3.5 h-3.5 text-[#B95650]" />
            <span>Legally Binding Agreements & Execution</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#211D1B] tracking-tight">
            Event Contracts & Agreements
          </h1>
          <p className="text-sm text-[#756B65] mt-1 max-w-2xl leading-relaxed">
            Review formal service agreements generated from your approved quotations, inspect dual legal signatures, and execute digital signatures to lock event production.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            title="Refresh Contracts"
            className="p-2.5 rounded-xl border border-[#E8DDD3] text-slate-600 hover:text-[#211D1B] hover:bg-[#F7F2EC]/50 transition-colors shadow-2xs flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#B95650]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            to="/portal/quotations"
            className="px-4 py-2.5 rounded-xl bg-[#B95650] hover:bg-[#a84842] text-white font-bold text-xs shadow-xs shadow-[#B95650]/20 hover:shadow-sm transition-all flex items-center gap-2"
          >
            <FileCheck className="w-4 h-4" />
            <span>View Approved Quotations</span>
          </Link>
        </div>
      </div>

      {/* Action Notification Banners */}
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
              Awaiting Signature
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <PenTool className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#211D1B]">{awaitingSignatureCount}</span>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              Action Required
            </span>
          </div>
          <p className="text-[11px] text-[#756B65] mt-1">Pending your legal digital sign-off</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8DDD3] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#756B65]">
              Fully Executed
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#211D1B]">{executedCount}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Legally Sealed
            </span>
          </div>
          <p className="text-[11px] text-[#756B65] mt-1">Dual signatures verified & active</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8DDD3] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#756B65]">
              Total Contract Value
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-[#E8DDD3] flex items-center justify-center text-slate-700">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black text-[#211D1B]">{formatETB(totalContractValue)}</span>
          </div>
          <p className="text-[11px] text-[#756B65] mt-1">Contracted service deliverables</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#FFFDFC] p-5 rounded-2xl border border-[#E8DDD3] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#756B65]">
              Pending 50% Deposits
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black text-[#211D1B]">{formatETB(pendingDepositSum)}</span>
          </div>
          <p className="text-[11px] text-[#756B65] mt-1">Due upon agreement execution</p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-[#FFFDFC] p-4 rounded-2xl border border-[#E8DDD3] shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#756B65] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contracts by event, reference, or coordinator..."
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

          {/* Right Tools: Event Type, Sort, View Toggle */}
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
                <option value="OTHER">Ceremonial / Other</option>
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
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#756B65] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-[#E8DDD3]">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
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
            { id: 'ALL', label: 'All Contracts', count: contracts.length },
            { id: 'PARTIALLY_SIGNED', label: 'Awaiting Your Signature', count: contracts.filter((c) => !hasUserSigned(c)).length },
            { id: 'SIGNED', label: 'Fully Executed', count: contracts.filter((c) => c.isFullyExecuted || c.status === 'SIGNED').length },
            { id: 'PENDING_SIGNATURES', label: 'Pending Signatures', count: contracts.filter((c) => c.status === 'PENDING_SIGNATURES').length }
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
          <h3 className="text-sm font-bold text-[#211D1B]">Loading Contracts & Agreements...</h3>
          <p className="text-xs text-[#756B65]">Accessing verified legal contracts and signature audit logs.</p>
        </div>
      ) : sortedContracts.length === 0 ? (
        <div className="bg-[#FFFDFC] p-16 rounded-2xl border border-[#E8DDD3] text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-[#E8DDD3] flex items-center justify-center text-[#756B65] mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#211D1B]">No Contracts Found</h3>
            <p className="text-xs text-[#756B65] max-w-md mx-auto mt-1">
              {searchQuery || statusFilter !== 'ALL' || eventTypeFilter !== 'ALL'
                ? 'No agreements match your search or filter parameters.'
                : 'Contracts are generated as soon as you approve an itemized event quotation. Check your Quotations tab to approve active proposals.'}
            </p>
          </div>
          {(searchQuery || statusFilter !== 'ALL' || eventTypeFilter !== 'ALL') ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setEventTypeFilter('ALL');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Clear Filters
            </button>
          ) : (
            <Link
              to="/portal/quotations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              <span>Review Quotations</span>
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= GRID VIEW ================= */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {currentItems.map((contract) => {
            const userSigned = hasUserSigned(contract);
            const companySigned = hasCompanySigned(contract);

            return (
              <div
                key={contract.id}
                className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] shadow-2xs hover:shadow-xs transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-[#E8DDD3] bg-[#F7F2EC]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 border border-[#E8DDD3] px-2 py-0.5 rounded-md shrink-0">
                          {contract.booking?.reference || 'EVT-CONTRACT'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#B95650]/10 text-[#B95650] border border-[#B95650]/20 font-mono shrink-0">
                          Agreement v{contract.version}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[11px] text-[#756B65] font-medium shrink-0">
                          Created {new Date(contract.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-[#211D1B] pt-0.5 truncate">
                        {contract.booking?.title || 'Event Master Agreement'}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-[#756B65] pt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#756B65]" />
                          {contract.booking?.locationName || 'Addis Ababa'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#756B65]" />
                          {contract.booking?.preferredDate ? new Date(contract.booking.preferredDate).toLocaleDateString() : 'Date Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      {getStatusBadge(contract.status, contract.isFullyExecuted)}
                    </div>
                  </div>
                </div>

                {/* Card Body: Dual Signature Verification & Pricing Summary */}
                <div className="p-5 space-y-4 flex-1">
                  {/* Financial Terms Split Box */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F7F2EC] border border-[#E8DDD3]">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#756B65]">
                        Total Contract Value
                      </span>
                      <div className="text-lg font-black text-[#211D1B] mt-0.5">
                        {formatETB(contract.totalAmount)}
                      </div>
                      <div className="text-[10px] text-[#756B65] mt-0.5">
                        Final Balance: {formatETB(contract.finalPaymentAmount)}
                      </div>
                    </div>

                    <div className="border-l border-[#E8DDD3] pl-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        50% Initial Deposit
                      </span>
                      <div className="text-lg font-black text-amber-900 mt-0.5">
                        {formatETB(contract.initialPaymentAmount)}
                      </div>
                      <div className="text-[10px] text-[#756B65] mt-0.5">
                        Locks date and production crew
                      </div>
                    </div>
                  </div>

                  {/* Dual Signature Status Checklist */}
                  <div className="p-3.5 rounded-xl border border-[#E8DDD3] bg-[#FFFDFC] space-y-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#756B65] block">
                      Dual Legal Execution Status
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* Customer Signature Status */}
                      <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                        userSigned
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50/70 border-amber-200 text-amber-900'
                      }`}>
                        <div className="flex items-center gap-2">
                          {userSigned ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                          <div>
                            <span className="font-bold block text-xs">Customer Signature</span>
                            <span className="text-[10px] text-[#756B65]">
                              {userSigned ? 'Affirmed & Timestamped' : 'Action Required'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Company Coordinator Signature Status */}
                      <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                        companySigned
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                          : 'bg-[#F7F2EC] border-[#E8DDD3] text-slate-700'
                      }`}>
                        <div className="flex items-center gap-2">
                          {companySigned ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-[#756B65] shrink-0" />
                          )}
                          <div>
                            <span className="font-bold block text-xs">Azera Seal</span>
                            <span className="text-[10px] text-[#756B65]">
                              {companySigned ? 'Authorized by Directorate' : 'In Review'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-4 bg-[#F7F2EC]/80 border-t border-[#E8DDD3] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenContract(contract)}
                      className="px-3 py-1.5 rounded-xl border border-[#E8DDD3] bg-[#FFFDFC] hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#756B65]" />
                      <span>View Agreement</span>
                    </button>

                    <a
                      href={api.getContractPdfUrl(contract.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Download Official A4 PDF"
                      className="p-1.5 rounded-xl border border-[#E8DDD3] bg-[#FFFDFC] hover:bg-slate-100 text-slate-600 hover:text-[#B95650] text-xs transition-colors shadow-2xs inline-flex items-center"
                    >
                      <Download className="w-4 h-4" />
                    </a>

                    <button
                      onClick={() => handlePrintContract(contract)}
                      title="Print Official Agreement"
                      className="p-1.5 rounded-xl border border-[#E8DDD3] bg-[#FFFDFC] hover:bg-slate-100 text-slate-600 hover:text-[#211D1B] text-xs transition-colors shadow-2xs"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* If Customer has not signed yet */}
                    {!userSigned && contract.status !== 'VOIDED' && (
                      <button
                        onClick={() => {
                          setActiveSignContract(contract);
                          setSignatureName(user?.fullName || '');
                          setSignModalOpen(true);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-[#B95650] hover:bg-[#a84842] text-white font-bold text-xs shadow-xs shadow-[#B95650]/20 hover:shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Sign Agreement</span>
                      </button>
                    )}

                    {/* If Fully Executed -> Proceed to Deposit */}
                    {(contract.isFullyExecuted || contract.status === 'SIGNED') && (
                      <Link
                        to="/portal/payments"
                        className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 transition-colors"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Submit 50% Deposit</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= TABLE VIEW ================= */
        <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F2EC]/80 border-b border-[#E8DDD3] text-[#756B65] uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-4">Contract Reference</th>
                  <th className="py-3 px-4">Event Details</th>
                  <th className="py-3 px-4">Total Value</th>
                  <th className="py-3 px-4">50% Deposit</th>
                  <th className="py-3 px-4">Execution Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DDD3]/50">
                {currentItems.map((contract) => {
                  const userSigned = hasUserSigned(contract);

                  return (
                    <tr key={contract.id} className="hover:bg-[#F7F2EC]/50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-[#211D1B]">
                          {contract.booking?.reference || 'EVT-CONTRACT'}
                        </div>
                        <div className="text-[10px] text-[#756B65] mt-0.5">
                          v{contract.version} · {new Date(contract.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#211D1B] max-w-xs truncate">
                          {contract.booking?.title || 'Master Event Agreement'}
                        </div>
                        <div className="text-[11px] text-[#756B65] flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#756B65] shrink-0" />
                          <span className="truncate max-w-xs">{contract.booking?.locationName || 'Addis Ababa'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-[#211D1B] text-sm">
                          {formatETB(contract.totalAmount)}
                        </div>
                        <div className="text-[10px] text-[#756B65] mt-0.5 font-mono">ETB Currency</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-amber-900">
                          {formatETB(contract.initialPaymentAmount)}
                        </div>
                        <div className="text-[10px] text-[#756B65] mt-0.5">Locks reservation</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {getStatusBadge(contract.status, contract.isFullyExecuted)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenContract(contract)}
                            className="px-2.5 py-1 rounded-lg border border-[#E8DDD3] bg-[#FFFDFC] hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                          >
                            View
                          </button>

                          <a
                            href={api.getContractPdfUrl(contract.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download PDF"
                            className="p-1 rounded-lg border border-[#E8DDD3] bg-[#FFFDFC] hover:bg-slate-100 text-slate-600 hover:text-[#B95650] transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          {!userSigned && contract.status !== 'VOIDED' && (
                            <button
                              onClick={() => {
                                setActiveSignContract(contract);
                                setSignatureName(user?.fullName || '');
                                setSignModalOpen(true);
                              }}
                              className="px-3 py-1 rounded-lg bg-[#B95650] hover:bg-[#a84842] text-white font-bold text-xs shadow-xs shadow-[#B95650]/20 transition-all"
                            >
                              Sign
                            </button>
                          )}

                          {(contract.isFullyExecuted || contract.status === 'SIGNED') && (
                            <Link
                              to="/portal/payments"
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-black text-white font-bold text-xs transition-colors"
                            >
                              Pay Deposit
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
            <span className="font-bold text-[#211D1B]">{totalItems}</span> contracts
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
            </select>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. CONTRACT INSPECTOR MODAL - FIXED VIEWPORT FIT */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* 1. CONTRACT INSPECTOR MODAL - FIXED VIEWPORT FIT */}
      {/* ========================================================= */}
      {inspectorModalOpen && selectedContract && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FFFDFC] rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-[#E8DDD3] flex flex-col text-[#211D1B] overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E8DDD3] flex items-start justify-between bg-[#FFFDFC] shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-[#E8DDD3]">
                    {selectedContract.booking?.reference || 'EVT-CONTRACT'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#B95650]/10 text-[#B95650] border border-[#B95650]/20 font-mono">
                    Agreement v{selectedContract.version}
                  </span>
                  {selectedContract.policyVersion && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-[#E8DDD3] font-mono">
                      Policy {selectedContract.policyVersion}
                    </span>
                  )}
                  {getStatusBadge(selectedContract.status, selectedContract.isFullyExecuted)}
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#211D1B]">
                  {selectedContract.booking?.title || 'Master Event Service Agreement'}
                </h2>
                <p className="text-xs text-[#756B65]">
                  Venue: <span className="font-semibold text-slate-700">{selectedContract.booking?.locationName || 'Addis Ababa'}</span> · Event Date:{' '}
                  <span className="font-semibold text-slate-700">
                    {selectedContract.booking?.preferredDate ? new Date(selectedContract.booking.preferredDate).toLocaleDateString() : 'Pending'}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-1.5 ml-2">
                <a
                  href={api.getContractPdfUrl(selectedContract.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download Official A4 PDF"
                  className="p-2 rounded-xl border border-[#E8DDD3] hover:bg-[#F7F2EC]/50 text-slate-600 hover:text-[#B95650] transition-colors shadow-2xs inline-flex items-center"
                >
                  <Download className="w-4 h-4" />
                </a>

                <button
                  onClick={() => handlePrintContract(selectedContract)}
                  title="Print Agreement"
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

            {/* Modal Body - Inner Scrollable */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Proposed Amendments Alert Card */}
              {selectedContract.amendments?.filter((a) => a.status === 'PENDING').map((amendment) => (
                <div key={amendment.id} className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-3 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                        <AlertCircle className="w-3 h-3" />
                        <span>Proposed Contract Amendment (Pending Your Approval)</span>
                      </div>
                      <h4 className="text-sm font-bold text-purple-950 mt-1">
                        {amendment.description}
                      </h4>
                      {amendment.affectedServices && (
                        <p className="text-xs text-purple-800">
                          <span className="font-semibold">Affected Service Scope:</span> {amendment.affectedServices}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleAcceptAmendment(amendment.id)}
                      className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Accept & Execute Amendment</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-purple-200/60 font-mono">
                    <div>
                      <span className="text-purple-600 block text-[10px]">Previous Total</span>
                      <span className="font-bold text-purple-900">{formatETB(amendment.previousTotal)}</span>
                    </div>
                    <div>
                      <span className="text-purple-600 block text-[10px]">Cost Adjustment</span>
                      <span className="font-bold text-purple-900">
                        {Number(amendment.costAdjustment) >= 0 ? `+${formatETB(amendment.costAdjustment)}` : formatETB(amendment.costAdjustment)}
                      </span>
                    </div>
                    <div>
                      <span className="text-purple-600 block text-[10px]">New Total Consideration</span>
                      <span className="font-extrabold text-purple-950">{formatETB(amendment.newTotal)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Dynamic Service Schedule & Deliverables Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#B95650]" />
                    <span>Approved Service Schedule & Line Items</span>
                  </h3>
                  <span className="text-[10px] font-mono text-[#756B65]">
                    {selectedContract.serviceSnapshots?.length > 0 ? 'Immutable Contract Snapshot' : 'Approved Quotation Items'}
                  </span>
                </div>

                <div className="border border-[#E8DDD3] rounded-xl overflow-hidden bg-[#FFFDFC] shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F7F2EC] border-b border-[#E8DDD3] text-[#756B65] uppercase tracking-wider text-[10px] font-bold">
                          <th className="py-2.5 px-3">Service & Specifications</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-2 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">Unit Price</th>
                          <th className="py-2.5 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8DDD3]/50">
                        {(selectedContract.serviceSnapshots && selectedContract.serviceSnapshots.length > 0
                          ? selectedContract.serviceSnapshots
                          : selectedContract.quotation?.lineItems || []
                        ).map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-[#F7F2EC]/50/60 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-[#211D1B]">{item.serviceTitle}</div>
                              {item.specifications && (
                                <div className="text-[10px] text-[#756B65] mt-0.5 line-clamp-2">{item.specifications}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[#756B65] text-[11px] font-medium">
                              {item.category || 'Service'}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-medium text-slate-700">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {formatETB(item.unitPrice || item.lineTotal / (item.quantity || 1))}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#211D1B]">
                              {formatETB(item.totalPrice || item.lineTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Breakdown Summary */}
                  <div className="bg-[#F7F2EC]/70 p-3 border-t border-[#E8DDD3] flex flex-col items-end text-xs space-y-1">
                    <div className="flex justify-between w-64 text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono font-medium">
                        {formatETB(selectedContract.subtotal || selectedContract.totalAmount)}
                      </span>
                    </div>
                    {Number(selectedContract.discount) > 0 && (
                      <div className="flex justify-between w-64 text-emerald-700">
                        <span>Discount:</span>
                        <span className="font-mono font-medium">-{formatETB(selectedContract.discount)}</span>
                      </div>
                    )}
                    {Number(selectedContract.taxAndFees) > 0 && (
                      <div className="flex justify-between w-64 text-slate-600">
                        <span>Tax & Regulatory Fees:</span>
                        <span className="font-mono font-medium">+{formatETB(selectedContract.taxAndFees)}</span>
                      </div>
                    )}
                    <div className="flex justify-between w-64 text-[#211D1B] font-bold pt-1 border-t border-[#E8DDD3] text-sm">
                      <span>Total Consideration:</span>
                      <span className="font-mono font-black text-[#B95650]">
                        {formatETB(selectedContract.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 50-50 Payment Schedule */}
              <div className="p-4 rounded-xl bg-[#F7F2EC] border border-[#E8DDD3] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs shadow-2xs">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">
                    1st Deposit (50% Required to Finalize)
                  </span>
                  <span className="text-xl font-extrabold font-mono text-amber-950 block">
                    {formatETB(selectedContract.initialPaymentAmount)}
                  </span>
                  <span className="text-[11px] text-[#756B65] block leading-tight">
                    Due upon signature. Locks event date, production crew, and equipment reservations.
                  </span>
                </div>

                <div className="border-t sm:border-t-0 sm:border-l border-[#E8DDD3] pt-3 sm:pt-0 sm:pl-4 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider block">
                    2nd Final Balance (50% Due 48h Prior)
                  </span>
                  <span className="text-xl font-extrabold font-mono text-[#211D1B] block">
                    {formatETB(selectedContract.finalPaymentAmount)}
                  </span>
                  <span className="text-[11px] text-[#756B65] block leading-tight">
                    Due 48 hours prior to event start following complete venue preparation briefing.
                  </span>
                </div>
              </div>

              {/* Versioned Cancellation & Refund Policy v1.2 */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-[#756B65]" />
                  <span>Versioned Staged Refund Policy ({selectedContract.policyVersion || 'v1.2'})</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-800 block uppercase">60+ Days Prior</span>
                    <span className="text-base font-extrabold text-emerald-900 block font-mono">85% Refund</span>
                    <span className="text-[10px] text-emerald-700 block mt-0.5">15% admin fee</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200">
                    <span className="text-[10px] font-bold text-blue-800 block uppercase">30 - 59 Days Prior</span>
                    <span className="text-base font-extrabold text-blue-900 block font-mono">70% Refund</span>
                    <span className="text-[10px] text-blue-700 block mt-0.5">30% retainer fee</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200">
                    <span className="text-[10px] font-bold text-amber-800 block uppercase">14 - 29 Days Prior</span>
                    <span className="text-base font-extrabold text-amber-900 block font-mono">40% Refund</span>
                    <span className="text-[10px] text-amber-700 block mt-0.5">60% staging commitment</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FCECE8]/60 border border-[#E8B5A6]">
                    <span className="text-[10px] font-bold text-[#B95650] block uppercase">&lt; 14 Days Prior</span>
                    <span className="text-base font-extrabold text-[#B95650] block font-mono">Non-Refundable</span>
                    <span className="text-[10px] text-[#B95650] block mt-0.5">100% committed reservations</span>
                  </div>
                </div>
              </div>

              {/* Legal Terms & Conditions Text Block */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#B95650]" />
                  <span>Binding Service Agreement & Legal Clauses</span>
                </h3>

                <div className="p-4 rounded-xl bg-[#F7F2EC] border border-[#E8DDD3] text-xs text-slate-700 font-mono leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
                  {selectedContract.termsAndConditions}
                </div>
              </div>

              {/* Digital Signatures Audit Trail */}
              <div className="space-y-2 pt-2 border-t border-[#E8DDD3]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Dual Signature Verification ({selectedContract.signatures?.length || 0}/2)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Customer Block */}
                  <div className="p-3.5 rounded-xl border border-[#E8DDD3] bg-[#F7F2EC] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#211D1B]">Client Signatory</span>
                      {hasUserSigned(selectedContract) ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Signed
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Pending
                        </span>
                      )}
                    </div>
                    {hasUserSigned(selectedContract) ? (
                      (() => {
                        const sig = selectedContract.signatures.find((s) => s.signerType === 'CUSTOMER');
                        return (
                          <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                            <div><span className="font-medium text-[#756B65]">Signer:</span> {sig?.signerName}</div>
                            <div><span className="font-medium text-[#756B65]">Timestamp:</span> {new Date(sig?.signedAt).toLocaleString()}</div>
                            <div className="text-[10px] text-[#756B65] font-mono truncate">{sig?.signatureEvidence}</div>
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-[11px] text-[#756B65] italic pt-1">
                        Client electronic signature required to execute.
                      </p>
                    )}
                  </div>

                  {/* Company Block */}
                  <div className="p-3.5 rounded-xl border border-[#E8DDD3] bg-[#F7F2EC] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#211D1B]">Azera Corporate Seal</span>
                      {hasCompanySigned(selectedContract) ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Authorized
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#756B65] bg-slate-100 px-2 py-0.5 rounded-full">
                          Pending
                        </span>
                      )}
                    </div>
                    {hasCompanySigned(selectedContract) ? (
                      (() => {
                        const sig = selectedContract.signatures.find((s) => s.signerType === 'COMPANY_AUTHORIZED');
                        return (
                          <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                            <div><span className="font-medium text-[#756B65]">Authorized:</span> {sig?.signerName}</div>
                            <div><span className="font-medium text-[#756B65]">Timestamp:</span> {new Date(sig?.signedAt).toLocaleString()}</div>
                            <div className="text-[10px] text-[#756B65] font-mono truncate">{sig?.signatureEvidence}</div>
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-[11px] text-[#756B65] italic pt-1">
                        Directorate corporate seal pending execution.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-[#F7F2EC] border-t border-[#E8DDD3] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInspectorModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#FFFDFC] hover:bg-slate-100 border border-[#E8DDD3] text-slate-700 text-xs font-bold transition-colors shadow-2xs"
                >
                  Close Agreement
                </button>

                <a
                  href={api.getContractPdfUrl(selectedContract.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl border border-[#E8DDD3] bg-[#FFFDFC] hover:bg-slate-100 text-slate-700 hover:text-[#B95650] text-xs font-bold transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download A4 PDF</span>
                </a>
              </div>

              <div className="flex items-center gap-2">
                {!hasUserSigned(selectedContract) && selectedContract.status !== 'VOIDED' && (
                  <button
                    onClick={() => {
                      setInspectorModalOpen(false);
                      setActiveSignContract(selectedContract);
                      setSignatureName(user?.fullName || '');
                      setSignModalOpen(true);
                    }}
                    className="px-5 py-2 rounded-xl bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold shadow-xs shadow-[#B95650]/20 transition-all flex items-center gap-1.5"
                  >
                    <PenTool className="w-4 h-4" />
                    <span>Sign This Contract</span>
                  </button>
                )}

                {(selectedContract.isFullyExecuted || selectedContract.status === 'SIGNED') && (
                  <Link
                    to="/portal/payments"
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Proceed to 50% Deposit</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. DIGITAL SIGNATURE EXECUTION MODAL - FIXED VIEWPORT FIT */}
      {/* ========================================================= */}
      {signModalOpen && activeSignContract && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FFFDFC] rounded-2xl max-w-lg w-full max-h-[90vh] shadow-2xl border border-[#E8DDD3] flex flex-col text-[#211D1B] overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E8DDD3] flex items-start justify-between bg-[#FFFDFC] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#B95650]/10 border border-[#B95650]/20 flex items-center justify-center text-[#B95650] shrink-0">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#211D1B]">Execute Legal Contract Signature</h3>
                  <p className="text-xs text-[#756B65]">
                    {activeSignContract.booking?.reference} · Agreement v{activeSignContract.version}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSignModalOpen(false)}
                className="text-[#756B65] hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Financial Recap */}
              <div className="p-3.5 rounded-xl bg-[#F7F2EC] border border-[#E8DDD3] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#756B65]">Event:</span>
                  <span className="font-bold text-[#211D1B] truncate max-w-[240px]">{activeSignContract.booking?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#756B65]">Total Contract Value:</span>
                  <span className="font-extrabold text-[#211D1B] font-mono">
                    {formatETB(activeSignContract.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-amber-800">
                  <span className="font-medium">1st Deposit (50% Required):</span>
                  <span className="font-extrabold font-mono">
                    {formatETB(activeSignContract.initialPaymentAmount)}
                  </span>
                </div>
              </div>

              {/* Signing Method Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Signing Method
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSigningMethod('ELECTRONIC_AFFIRMATION')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      signingMethod === 'ELECTRONIC_AFFIRMATION'
                        ? 'border-[#B95650] bg-[#B95650]/5 text-[#211D1B] font-bold'
                        : 'border-[#E8DDD3] bg-[#FFFDFC] text-slate-600 hover:bg-[#F7F2EC]/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-[#B95650]" />
                      <span>Electronic Affirmation</span>
                    </div>
                    <span className="text-[10px] text-[#756B65] font-normal block mt-1">Instant digital consent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSigningMethod('PHYSICAL_UPLOAD_SCAN')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      signingMethod === 'PHYSICAL_UPLOAD_SCAN'
                        ? 'border-[#B95650] bg-[#B95650]/5 text-[#211D1B] font-bold'
                        : 'border-[#E8DDD3] bg-[#FFFDFC] text-slate-600 hover:bg-[#F7F2EC]/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-[#B95650]" />
                      <span>Upload Signed Scan</span>
                    </div>
                    <span className="text-[10px] text-[#756B65] font-normal block mt-1">Physical scan reference</span>
                  </button>
                </div>
              </div>

              {/* Legal Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Full Legal Signatory Name <span className="text-[#B95650]">*</span>
                </label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Enter your full legal name as digital signature..."
                  className="w-full p-3 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-bold text-[#211D1B] focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-colors"
                />
              </div>

              {/* Physical Scan Reference Input */}
              {signingMethod === 'PHYSICAL_UPLOAD_SCAN' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Signed Document Link or Reference
                  </label>
                  <input
                    type="text"
                    value={documentUrl}
                    onChange={(e) => setDocumentUrl(e.target.value)}
                    placeholder="Enter URL or file reference for signed scan document..."
                    className="w-full p-3 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs font-mono text-[#211D1B] focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-colors"
                  />
                </div>
              )}

              {/* Consent Checkbox */}
              <div className="p-3.5 rounded-xl bg-[#F7F2EC] border border-[#E8DDD3] space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#B95650] focus:ring-[#B95650] cursor-pointer"
                  />
                  <span className="leading-relaxed">
                    I confirm that I am legally authorized to sign this master event agreement, accept the cancellation policy, and agree that this submission constitutes a legally binding execution under Ethiopian commercial law.
                  </span>
                </label>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <span>
                  Cryptographic verification will capture your digital signature, device IP address, and timestamp upon confirmation.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#F7F2EC] border-t border-[#E8DDD3] flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => setSignModalOpen(false)}
                disabled={submittingSignature}
                className="px-4 py-2 rounded-xl bg-[#FFFDFC] hover:bg-slate-100 border border-[#E8DDD3] text-slate-700 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSignContract}
                disabled={submittingSignature || !signatureName.trim() || !agreeTerms}
                className="px-5 py-2 rounded-xl bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold shadow-xs shadow-[#B95650]/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {submittingSignature ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sealing Signature...</span>
                  </>
                ) : (
                  <>
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Confirm & Execute Contract</span>
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
