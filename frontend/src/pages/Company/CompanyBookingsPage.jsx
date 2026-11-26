import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import BookingDetailsCards from '../../components/booking/BookingDetailsCards';
import {
  CalendarCheck,
  Search,
  Filter,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Phone,
  Mail,
  RefreshCw,
  Eye,
  Send,
  Copy,
  Check,
  Layers,
  FileSpreadsheet,
  UserCheck,
  UserPlus,
  UserMinus,
  User,
  History,
  ArrowRightLeft,
  SlidersHorizontal,
  ArrowRight,
  BadgeAlert,
  Sparkles,
  Info,
  DollarSign,
  CheckSquare,
  ShieldCheck,
  Building,
  ExternalLink,
  Lock,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';

export default function CompanyBookingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data states
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Shared Workspace Ownership Scope & Team Assignment states
  const [ownershipScope, setOwnershipScope] = useState('all'); // 'all' | 'my' | 'unassigned'
  const [claimingId, setClaimingId] = useState(null);
  const [activeCoordinators, setActiveCoordinators] = useState([]);
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Executive Administration Reassignment Modal
  const [reassignModal, setReassignModal] = useState({
    open: false,
    booking: null,
    targetCoordinatorId: '',
    reason: ''
  });
  const [reassigning, setReassigning] = useState(false);

  // Assisting Coordinator (Collaborator) Modal
  const [collaboratorModal, setCollaboratorModal] = useState({
    open: false,
    booking: null,
    staffId: '',
    notes: ''
  });
  const [addingCollaborator, setAddingCollaborator] = useState(false);
  const [removingStaffId, setRemovingStaffId] = useState(null);

  // Filter & Search states
  const initialStatusQuery = searchParams.get('status') || '';
  const [activeTab, setActiveTab] = useState(
    initialStatusQuery === 'REQUESTED' ? 'attention' : 'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterStatus, setFilterStatus] = useState(initialStatusQuery);
  const [sortBy, setSortBy] = useState('date_asc');

  // Selected Booking Drawer state
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);
  const [availabilityAssessment, setAvailabilityAssessment] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Status Update & Action Modals
  const [statusModal, setStatusModal] = useState({ open: false, booking: null, targetStatus: '' });
  const [statusReason, setStatusReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [missingInfoModal, setMissingInfoModal] = useState({ open: false, booking: null });
  const [missingChecklist, setMissingChecklist] = useState([]);
  const [missingNotes, setMissingNotes] = useState('');

  // Confirmation Gating Modal
  const [confirmGateModal, setConfirmGateModal] = useState({ open: false, booking: null });
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const [providerVerificationChecked, setProviderVerificationChecked] = useState(false);

  // Internal Note Box
  const [internalNoteText, setInternalNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Copied indicator for references
  const [copiedRef, setCopiedRef] = useState(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch bookings registry
  const loadBookings = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      // Fetch all bookings for coordinator workspace
      const res = await api.getAllBookings('?limit=100');
      if (res?.data?.bookings) {
        setBookings(res.data.bookings);
      }
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setError(err.message || 'Unable to load bookings registry.');
      toast.error('Failed to retrieve bookings registry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load active coordinators for assignments & collaboration
  const loadActiveCoordinators = async () => {
    try {
      const res = await api.getActiveCoordinators();
      if (res?.data?.coordinators) {
        setActiveCoordinators(res.data.coordinators);
      }
    } catch (err) {
      console.error('Failed to load active coordinators directory:', err);
    }
  };

  useEffect(() => {
    loadBookings();
    loadActiveCoordinators();
  }, []);

  // Fetch assignment history for the selected booking
  const loadAssignmentHistory = async (bookingId) => {
    const id = bookingId || selectedBookingId;
    if (!id) return;
    try {
      setLoadingHistory(true);
      const res = await api.getAssignmentHistory(id);
      if (res?.data?.history) {
        setAssignmentHistory(res.data.history);
      }
    } catch (err) {
      console.error('Failed to load assignment history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Reload active selected booking details, availability, and assignment history
  const reloadActiveBookingDetails = async (bookingId) => {
    const id = bookingId || selectedBookingId;
    if (!id) return;
    try {
      const [detailsRes, availRes, histRes] = await Promise.allSettled([
        api.getBookingById(id),
        api.getBookingAvailability(id),
        api.getAssignmentHistory(id)
      ]);
      if (detailsRes.status === 'fulfilled' && detailsRes.value?.data?.booking) {
        setSelectedBookingDetails(detailsRes.value.data.booking);
      }
      if (availRes.status === 'fulfilled' && availRes.value?.data) {
        setAvailabilityAssessment(availRes.value.data);
      }
      if (histRes.status === 'fulfilled' && histRes.value?.data?.history) {
        setAssignmentHistory(histRes.value.data.history);
      }
    } catch (err) {
      console.error('Failed to reload booking inspection data:', err);
    }
  };

  // Fetch specific booking details, availability & history when selected
  useEffect(() => {
    if (!selectedBookingId) {
      setSelectedBookingDetails(null);
      setAvailabilityAssessment(null);
      setAssignmentHistory([]);
      return;
    }
    const fetchBookingDetails = async () => {
      try {
        setLoadingDetails(true);
        setLoadingAvailability(true);
        setLoadingHistory(true);
        const [detailsRes, availRes, histRes] = await Promise.allSettled([
          api.getBookingById(selectedBookingId),
          api.getBookingAvailability(selectedBookingId),
          api.getAssignmentHistory(selectedBookingId)
        ]);

        if (detailsRes.status === 'fulfilled' && detailsRes.value?.data?.booking) {
          setSelectedBookingDetails(detailsRes.value.data.booking);
        } else {
          toast.error('Unable to fetch detailed records for this booking.');
        }

        if (availRes.status === 'fulfilled' && availRes.value?.data) {
          setAvailabilityAssessment(availRes.value.data);
        }

        if (histRes.status === 'fulfilled' && histRes.value?.data?.history) {
          setAssignmentHistory(histRes.value.data.history);
        }
      } catch (err) {
        console.error('Failed to fetch booking details:', err);
        toast.error('Unable to fetch detailed records for this booking.');
      } finally {
        setLoadingDetails(false);
        setLoadingAvailability(false);
        setLoadingHistory(false);
      }
    };
    fetchBookingDetails();
  }, [selectedBookingId]);

  // Confirmation prerequisites calculation
  const confirmationPrerequisites = useMemo(() => {
    if (!selectedBookingDetails) return null;
    const acceptedQuote = selectedBookingDetails.quotations?.find((q) => q.status === 'ACCEPTED');
    const signedContract = selectedBookingDetails.contracts?.find((c) => c.status === 'SIGNED');
    const verifiedPayments = (selectedBookingDetails.payments || []).filter((p) => p.status === 'VERIFIED');
    const totalVerified = verifiedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const requiredDeposit = signedContract ? Number(signedContract.initialPaymentAmount || 0) : null;
    const depositSatisfied = requiredDeposit !== null && totalVerified >= requiredDeposit;

    return {
      acceptedQuote,
      signedContract,
      verifiedPayments,
      totalVerified,
      requiredDeposit,
      depositSatisfied,
      canConfirm: Boolean(acceptedQuote && signedContract && depositSatisfied)
    };
  }, [selectedBookingDetails]);

  // Copy booking reference
  const handleCopyReference = (ref, e) => {
    e?.stopPropagation();
    navigator.clipboard?.writeText(ref);
    setCopiedRef(ref);
    toast.success(`Copied ${ref} to clipboard`);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  // Status transitions
  const handleExecuteStatusChange = async (targetStatus, reasonText) => {
    const bookingId = statusModal.booking?.id || missingInfoModal.booking?.id || selectedBookingId;
    if (!bookingId) return;

    // Check cancellation reason requirement
    if (targetStatus === 'CANCELLED' && (!reasonText || !reasonText.trim())) {
      toast.error('A cancellation reason is required.');
      return;
    }

    try {
      setUpdatingStatus(true);
      await api.updateBookingStatus(
        bookingId,
        targetStatus,
        reasonText || `Status transitioned to ${targetStatus} by ${user?.fullName || 'Coordinator'}`
      );

      toast.success(`Booking status updated to ${targetStatus.replace(/_/g, ' ')}`);
      setStatusModal({ open: false, booking: null, targetStatus: '' });
      setMissingInfoModal({ open: false, booking: null });
      setStatusReason('');
      setMissingNotes('');
      setMissingChecklist([]);

      // Reload list and active details
      await loadBookings(true);
      await reloadActiveBookingDetails(bookingId);
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error(err.message || 'Failed to update booking status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Confirm booking action with prerequisite validation
  const handleConfirmBooking = async (bookingId) => {
    const id = bookingId || selectedBookingId;
    if (!id) return;

    try {
      setConfirmingBooking(true);
      await api.confirmBooking(id, {
        providerVerificationConfirmed: true,
        notes: 'External provider availability and arrangements manually verified via phone/WhatsApp/email.'
      });
      toast.success('Booking formally confirmed! Status transitioned to CONFIRMED.');
      setConfirmGateModal({ open: false, booking: null });
      setProviderVerificationChecked(false);
      await loadBookings(true);
      await reloadActiveBookingDetails(id);
    } catch (err) {
      console.error('Failed to confirm booking:', err);
      toast.error(err.message || 'Cannot confirm booking: Required prerequisites not yet met.');
    } finally {
      setConfirmingBooking(false);
    }
  };

  // Send missing information request
  const handleSendMissingInfo = async () => {
    const booking = missingInfoModal.booking || selectedBookingDetails;
    if (!booking) return;

    if (!missingNotes.trim() && missingChecklist.length === 0) {
      toast.error('Please specify the missing requirements or write an instruction message.');
      return;
    }

    try {
      setUpdatingStatus(true);
      await api.requestMissingInfo(booking.id, {
        missingFields: missingChecklist,
        customerMessage:
          missingNotes.trim() || 'Please clarify the selected event details so our team can prepare your quotation.'
      });
      toast.success('Missing details requested. Customer notified via Planning Channel.');
      setMissingInfoModal({ open: false, booking: null });
      setMissingChecklist([]);
      setMissingNotes('');
      await loadBookings(true);
      await reloadActiveBookingDetails(booking.id);
    } catch (err) {
      console.error('Failed to request missing info:', err);
      toast.error(err.message || 'Failed to dispatch request.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Add internal coordinator note
  const handleAddInternalNote = async () => {
    if (!internalNoteText.trim() || !selectedBookingDetails) return;
    try {
      setSubmittingNote(true);
      await api.addInternalNote(selectedBookingDetails.id, internalNoteText.trim());
      toast.success('Private internal coordinator note logged.');
      setInternalNoteText('');
      await reloadActiveBookingDetails(selectedBookingDetails.id);
    } catch (err) {
      console.error('Failed to add internal note:', err);
      toast.error(err.message || 'Failed to record note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Claim request: Coordinator takes primary ownership of an unassigned request
  const handleClaimRequest = async (bookingId, e) => {
    e?.stopPropagation();
    try {
      setClaimingId(bookingId);
      const res = await api.claimBooking(bookingId);
      toast.success(res?.message || 'You have claimed primary ownership of this booking request.');
      await loadBookings(true);
      if (selectedBookingId === bookingId) {
        await reloadActiveBookingDetails(bookingId);
      }
    } catch (err) {
      console.error('Failed to claim request:', err);
      // Handles 409 conflict when claimed by another coordinator simultaneously
      toast.error(err.message || 'Cannot claim this request. It may have already been claimed by another coordinator.');
      await loadBookings(true);
      if (selectedBookingId === bookingId) {
        await reloadActiveBookingDetails(bookingId);
      }
    } finally {
      setClaimingId(null);
    }
  };

  // Reassignment Modal Handlers (Executive Administration: ADMIN_DIRECTOR)
  const handleOpenReassignModal = (booking, e) => {
    e?.stopPropagation();
    setReassignModal({
      open: true,
      booking,
      targetCoordinatorId: '',
      reason: ''
    });
  };

  const handleReassignSubmit = async (e) => {
    e?.preventDefault();
    if (!reassignModal.booking || !reassignModal.targetCoordinatorId) {
      toast.error('Please select a target coordinator.');
      return;
    }
    if (!reassignModal.reason?.trim()) {
      toast.error('A reassignment reason is required for audit history.');
      return;
    }

    try {
      setReassigning(true);
      await api.reassignBooking(
        reassignModal.booking.id,
        reassignModal.targetCoordinatorId,
        reassignModal.reason.trim()
      );
      toast.success('Primary coordinator successfully reassigned.');
      const bId = reassignModal.booking.id;
      setReassignModal({ open: false, booking: null, targetCoordinatorId: '', reason: '' });
      await loadBookings(true);
      if (selectedBookingId === bId) {
        await reloadActiveBookingDetails(bId);
      }
    } catch (err) {
      console.error('Failed to reassign coordinator:', err);
      toast.error(err.message || 'Failed to reassign coordinator.');
    } finally {
      setReassigning(false);
    }
  };

  // Assisting Coordinator (Collaborator) Handlers
  const handleOpenAddCollaborator = (booking, e) => {
    e?.stopPropagation();
    setCollaboratorModal({
      open: true,
      booking,
      staffId: '',
      notes: ''
    });
  };

  const handleAddCollaboratorSubmit = async (e) => {
    e?.preventDefault();
    if (!collaboratorModal.booking || !collaboratorModal.staffId) {
      toast.error('Please select a coordinator or staff collaborator.');
      return;
    }

    try {
      setAddingCollaborator(true);
      await api.addBookingCollaborator(collaboratorModal.booking.id, {
        staffId: collaboratorModal.staffId,
        notes: collaboratorModal.notes?.trim() || ''
      });
      toast.success('Assisting coordinator added to this booking.');
      const bId = collaboratorModal.booking.id;
      setCollaboratorModal({ open: false, booking: null, staffId: '', notes: '' });
      await loadBookings(true);
      if (selectedBookingId === bId) {
        await reloadActiveBookingDetails(bId);
      }
    } catch (err) {
      console.error('Failed to add collaborator:', err);
      toast.error(err.message || 'Failed to add assisting coordinator.');
    } finally {
      setAddingCollaborator(false);
    }
  };

  const handleRemoveCollaborator = async (bookingId, staffId, e) => {
    e?.stopPropagation();
    if (!window.confirm('Remove this assisting coordinator from this booking?')) return;
    try {
      setRemovingStaffId(staffId);
      await api.removeBookingCollaborator(bookingId, staffId);
      toast.success('Assisting coordinator removed.');
      await loadBookings(true);
      if (selectedBookingId === bookingId) {
        await reloadActiveBookingDetails(bookingId);
      }
    } catch (err) {
      console.error('Failed to remove collaborator:', err);
      toast.error(err.message || 'Failed to remove assisting coordinator.');
    } finally {
      setRemovingStaffId(null);
    }
  };

  // Quick missing checklist presets
  const missingOptions = [
    'Confirmed Guest Count',
    'Specific Venue Hall / Floor',
    'Preferred Start & End Time',
    'Decor Color Theme & Floral Style',
    'Catering Dietary & Menu Choice',
    'Photography Coverage Hours'
  ];

  const toggleMissingOption = (item) => {
    setMissingChecklist((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // Metrics & Ownership Calculations
  const metrics = useMemo(() => {
    const total = bookings.length;
    const myAssigned = bookings.filter((b) => b.assignedCoordinatorId === user?.id).length;
    const unassigned = bookings.filter((b) => !b.assignedCoordinatorId).length;
    const otherAssigned = bookings.filter((b) => b.assignedCoordinatorId && b.assignedCoordinatorId !== user?.id).length;

    const attention = bookings.filter((b) =>
      ['REQUESTED', 'NEEDS_INFORMATION'].includes(b.status)
    ).length;
    const review = bookings.filter((b) =>
      ['UNDER_REVIEW', 'SERVICE_CHECK', 'PARTNER_CONFIRMATION_PENDING'].includes(b.status)
    ).length;
    const quotation = bookings.filter((b) =>
      ['QUOTATION_IN_PROGRESS', 'QUOTATION_SENT', 'CHANGES_REQUESTED', 'QUOTATION_ACCEPTED', 'CONTRACT_PENDING'].includes(b.status)
    ).length;
    const confirmed = bookings.filter((b) =>
      ['CONFIRMED', 'PREPARATION', 'IN_PROGRESS'].includes(b.status)
    ).length;
    return { total, myAssigned, unassigned, otherAssigned, attention, review, quotation, confirmed };
  }, [bookings, user?.id]);

  // Tab Filtering, Ownership Scope & Query
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        // Ownership Scope Filter
        if (ownershipScope === 'my') {
          if (b.assignedCoordinatorId !== user?.id) return false;
        } else if (ownershipScope === 'unassigned') {
          if (b.assignedCoordinatorId) return false;
        }

        // Tab Filter
        if (activeTab === 'attention') {
          if (!['REQUESTED', 'NEEDS_INFORMATION'].includes(b.status)) return false;
        } else if (activeTab === 'review') {
          if (!['UNDER_REVIEW', 'SERVICE_CHECK', 'PARTNER_CONFIRMATION_PENDING'].includes(b.status)) return false;
        } else if (activeTab === 'quotation') {
          if (!['QUOTATION_IN_PROGRESS', 'QUOTATION_SENT', 'CHANGES_REQUESTED', 'QUOTATION_ACCEPTED'].includes(b.status)) return false;
        } else if (activeTab === 'contract') {
          if (!['CONTRACT_PENDING', 'INITIAL_PAYMENT_PENDING'].includes(b.status)) return false;
        } else if (activeTab === 'confirmed') {
          if (!['CONFIRMED', 'PREPARATION', 'IN_PROGRESS'].includes(b.status)) return false;
        } else if (activeTab === 'completed') {
          if (!['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(b.status)) return false;
        }

        // Specific Status Dropdown
        if (filterStatus && b.status !== filterStatus) return false;

        // Event Type Filter
        if (filterEventType && b.eventType !== filterEventType) return false;

        // Search Term (Reference, Customer Name, Title, Location, Coordinator Name)
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchRef = b.reference?.toLowerCase().includes(q);
          const matchTitle = b.title?.toLowerCase().includes(q);
          const matchCustomer = b.customer?.fullName?.toLowerCase().includes(q);
          const matchLoc = b.locationName?.toLowerCase().includes(q) || b.city?.toLowerCase().includes(q);
          const matchCoord = b.assignedCoordinator?.fullName?.toLowerCase().includes(q);
          if (!matchRef && !matchTitle && !matchCustomer && !matchLoc && !matchCoord) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_asc') {
          return new Date(a.preferredDate) - new Date(b.preferredDate);
        }
        if (sortBy === 'date_desc') {
          return new Date(b.preferredDate) - new Date(a.preferredDate);
        }
        if (sortBy === 'created_desc') {
          return new Date(b.createdAt || b.preferredDate) - new Date(a.createdAt || a.preferredDate);
        }
        if (sortBy === 'guests_desc') {
          return (b.guestCount || 0) - (a.guestCount || 0);
        }
        if (sortBy === 'budget_desc') {
          return (parseFloat(b.budgetEstimate) || 0) - (parseFloat(a.budgetEstimate) || 0);
        }
        return 0;
      });
  }, [bookings, ownershipScope, activeTab, filterStatus, filterEventType, searchTerm, sortBy, user?.id]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterEventType, filterStatus, activeTab, ownershipScope, sortBy]);

  // Paginated bookings
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const paginatedBookings = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, page, pageSize]);

  // Refined Color & Badge Tokens for Statuses (Sleek SaaS Palette)
  const getStatusBadgeConfig = (status) => {
    switch (status) {
      case 'REQUESTED':
        return {
          label: 'New Request',
          bg: 'bg-rose-50/80',
          text: 'text-rose-700',
          border: 'border-rose-200/60',
          dot: 'bg-rose-500'
        };
      case 'NEEDS_INFORMATION':
        return {
          label: 'Needs Info',
          bg: 'bg-amber-50/80',
          text: 'text-amber-800',
          border: 'border-amber-200/60',
          dot: 'bg-amber-500'
        };
      case 'UNDER_REVIEW':
        return {
          label: 'Under Review',
          bg: 'bg-blue-50/80',
          text: 'text-blue-700',
          border: 'border-blue-200/60',
          dot: 'bg-blue-500'
        };
      case 'SERVICE_CHECK':
        return {
          label: 'Service Check',
          bg: 'bg-blue-50/70',
          text: 'text-blue-700',
          border: 'border-blue-200/60',
          dot: 'bg-blue-500'
        };
      case 'PARTNER_CONFIRMATION_PENDING':
        return {
          label: 'Partner Pending',
          bg: 'bg-indigo-50/80',
          text: 'text-indigo-700',
          border: 'border-indigo-200/60',
          dot: 'bg-indigo-500'
        };
      case 'QUOTATION_IN_PROGRESS':
        return {
          label: 'Quote Draft',
          bg: 'bg-purple-50/80',
          text: 'text-purple-700',
          border: 'border-purple-200/60',
          dot: 'bg-purple-500'
        };
      case 'QUOTATION_SENT':
        return {
          label: 'Quote Sent',
          bg: 'bg-purple-50/80',
          text: 'text-purple-700',
          border: 'border-purple-200/60',
          dot: 'bg-purple-500'
        };
      case 'CONTRACT_PENDING':
        return {
          label: 'Contract Pending',
          bg: 'bg-indigo-50/80',
          text: 'text-indigo-700',
          border: 'border-indigo-200/60',
          dot: 'bg-indigo-500'
        };
      case 'CONFIRMED':
        return {
          label: 'Confirmed',
          bg: 'bg-emerald-50/80',
          text: 'text-emerald-700',
          border: 'border-emerald-200/60',
          dot: 'bg-emerald-500'
        };
      case 'PREPARATION':
      case 'IN_PROGRESS':
        return {
          label: 'Active Delivery',
          bg: 'bg-emerald-50/80',
          text: 'text-emerald-700',
          border: 'border-emerald-200/60',
          dot: 'bg-emerald-500'
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200',
          dot: 'bg-slate-400'
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          bg: 'bg-slate-100',
          text: 'text-slate-500',
          border: 'border-slate-200',
          dot: 'bg-slate-300'
        };
      default:
        return {
          label: status?.replace(/_/g, ' ') || 'In Progress',
          bg: 'bg-slate-50',
          text: 'text-slate-700',
          border: 'border-slate-200',
          dot: 'bg-slate-400'
        };
    }
  };

  const getEventTypeBadge = (type) => {
    const formatted = type?.replace(/_/g, ' ') || 'Event';
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
        {formatted}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header with Breadcrumb, Title & Global Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <Link to="/company/dashboard" className="hover:text-[#B95650] transition-colors">
              Coordinator Portal
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Booking Requests</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Booking Requests & Inquiries
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Review incoming event requests, clarify missing details, verify capacity, and transition stages.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => loadBookings(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Refresh bookings registry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#B95650]' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <Link
            to="/company/quotations"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold rounded-xl shadow-sm shadow-[#B95650]/20 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Prepare Quotation</span>
          </Link>
        </div>
      </div>

      {/* 2. Top 5 Key Metric Cards matching SRS Workflow stages */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Total */}
        <button
          onClick={() => { setActiveTab('all'); setFilterStatus(''); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'all' && !filterStatus
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeTab === 'all' && !filterStatus ? 'text-slate-300' : 'text-slate-500'}`}>
              Total Inquiries
            </span>
            <Layers className={`w-4 h-4 ${activeTab === 'all' && !filterStatus ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.total}</div>
          <p className={`text-[11px] mt-1.5 font-medium ${activeTab === 'all' && !filterStatus ? 'text-slate-300' : 'text-slate-400'}`}>
            All recorded requests
          </p>
        </button>

        {/* Metric 2: Needs Attention */}
        <button
          onClick={() => { setActiveTab('attention'); setFilterStatus(''); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'attention'
              ? 'bg-[#B95650] text-white border-[#B95650] shadow-md ring-2 ring-[#B95650]/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-[#E8B5A6] shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeTab === 'attention' ? 'text-rose-100' : 'text-[#B95650]'}`}>
              Needs Attention
            </span>
            <AlertCircle className={`w-4 h-4 ${activeTab === 'attention' ? 'text-rose-100' : 'text-[#B95650]'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.attention}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${activeTab === 'attention' ? 'text-rose-100' : 'text-slate-400'}`}>
            New / Missing details
          </p>
        </button>

        {/* Metric 3: Under Review */}
        <button
          onClick={() => { setActiveTab('review'); setFilterStatus(''); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'review'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeTab === 'review' ? 'text-slate-300' : 'text-slate-600'}`}>
              Review & Checks
            </span>
            <CalendarCheck className={`w-4 h-4 ${activeTab === 'review' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.review}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${activeTab === 'review' ? 'text-slate-300' : 'text-slate-400'}`}>
            Capacity evaluation
          </p>
        </button>

        {/* Metric 4: Quotation & Contract */}
        <button
          onClick={() => { setActiveTab('quotation'); setFilterStatus(''); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'quotation'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeTab === 'quotation' ? 'text-slate-300' : 'text-slate-600'}`}>
              Quote / Contract
            </span>
            <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'quotation' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.quotation}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${activeTab === 'quotation' ? 'text-slate-300' : 'text-slate-400'}`}>
            Negotiation & signing
          </p>
        </button>

        {/* Metric 5: Confirmed */}
        <button
          onClick={() => { setActiveTab('confirmed'); setFilterStatus(''); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'confirmed'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeTab === 'confirmed' ? 'text-slate-300' : 'text-slate-600'}`}>
              Confirmed Events
            </span>
            <CheckCircle2 className={`w-4 h-4 ${activeTab === 'confirmed' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.confirmed}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${activeTab === 'confirmed' ? 'text-slate-300' : 'text-slate-400'}`}>
            50% verified & active
          </p>
        </button>
      </div>

      {/* 3. Filter Tabs + Search & Dropdown Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-4">
        {/* Shared Workspace Ownership Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              onClick={() => setOwnershipScope('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                ownershipScope === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Inquiries</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${ownershipScope === 'all' ? 'bg-slate-100 text-slate-800' : 'bg-slate-200 text-slate-600'}`}>
                {metrics.total}
              </span>
            </button>

            <button
              onClick={() => setOwnershipScope('unassigned')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                ownershipScope === 'unassigned'
                  ? 'bg-white text-amber-800 shadow-2xs ring-1 ring-amber-300'
                  : 'text-slate-600 hover:text-amber-800'
              }`}
            >
              <AlertCircle className={`w-3.5 h-3.5 ${metrics.unassigned > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
              <span>Unassigned Queue</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                metrics.unassigned > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-600'
              }`}>
                {metrics.unassigned}
              </span>
            </button>

            <button
              onClick={() => setOwnershipScope('my')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                ownershipScope === 'my'
                  ? 'bg-white text-[#B95650] shadow-2xs ring-1 ring-[#B95650]/30 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-[#B95650]" />
              <span>My Assigned</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${ownershipScope === 'my' ? 'bg-rose-100 text-[#B95650]' : 'bg-slate-200 text-slate-600'}`}>
                {metrics.myAssigned}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            {ownershipScope === 'unassigned' && (
              <span className="text-amber-800 flex items-center gap-1.5 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Shared coordinator queue — click <strong>"Claim"</strong> to take primary ownership
              </span>
            )}
            {ownershipScope === 'my' && (
              <span className="text-slate-700 flex items-center gap-1.5 font-semibold">
                <UserCheck className="w-3.5 h-3.5 text-[#B95650]" />
                Inquiries where you are the primary assigned coordinator
              </span>
            )}
            {ownershipScope === 'all' && (
              <span className="text-slate-400">
                Shared workspace — displaying all team inquiries ({metrics.unassigned} unassigned)
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs - Streamlined SaaS Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden border-b border-slate-100">
          {[
            { id: 'all', label: 'All Inquiries', count: metrics.total },
            { id: 'attention', label: 'Needs Action', count: metrics.attention, highlight: true },
            { id: 'review', label: 'In Review', count: metrics.review },
            { id: 'quotation', label: 'Quotation', count: metrics.quotation },
            { id: 'contract', label: 'Contracts', count: bookings.filter((b) => ['CONTRACT_PENDING', 'INITIAL_PAYMENT_PENDING'].includes(b.status)).length },
            { id: 'confirmed', label: 'Confirmed', count: metrics.confirmed },
            { id: 'completed', label: 'Archived', count: bookings.filter((b) => ['COMPLETED', 'CANCELLED'].includes(b.status)).length }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setFilterStatus('');
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : tab.highlight && tab.count > 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Facet Controls: Search Input, Type Dropdown, Detailed Status, Sort Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search bar (4 cols) */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reference, client, title, venue..."
              className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#B95650] focus:bg-white transition-all shadow-2xs"
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

          {/* Event Type Filter (3 cols) */}
          <div className="lg:col-span-3">
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-[#B95650] focus:bg-white shadow-2xs cursor-pointer"
            >
              <option value="">All Event Types</option>
              <option value="WEDDING">Wedding</option>
              <option value="SHIMGLINA">Shimglina Ceremony</option>
              <option value="BIRTHDAY">Birthday</option>
              <option value="CORPORATE">Corporate & Gala</option>
              <option value="ANNIVERSARY">Anniversary</option>
              <option value="FUNERAL_SUPPORT">Funeral Support</option>
              <option value="OTHER">Other Custom Event</option>
            </select>
          </div>

          {/* Detailed Status Filter (3 cols) */}
          <div className="lg:col-span-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-[#B95650] focus:bg-white shadow-2xs cursor-pointer"
            >
              <option value="">All Lifecycle Statuses</option>
              <option value="REQUESTED">Requested (New)</option>
              <option value="NEEDS_INFORMATION">Needs Information</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="SERVICE_CHECK">Service Capacity Check</option>
              <option value="PARTNER_CONFIRMATION_PENDING">Partner Confirmation Pending</option>
              <option value="QUOTATION_IN_PROGRESS">Quotation In Progress</option>
              <option value="QUOTATION_SENT">Quotation Sent</option>
              <option value="CONTRACT_PENDING">Contract Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Sort By (2 cols) */}
          <div className="lg:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-[#B95650] focus:bg-white shadow-2xs cursor-pointer"
            >
              <option value="date_asc">Event Date (Soonest)</option>
              <option value="date_desc">Event Date (Furthest)</option>
              <option value="created_desc">Submission (Newest)</option>
              <option value="guests_desc">Guest Count (High-Low)</option>
              <option value="budget_desc">Budget (High-Low)</option>
            </select>
          </div>
        </div>

        {/* Filter stats bar */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1">
          <div>
            Showing <strong className="text-slate-900">{filteredBookings.length}</strong> matching booking{filteredBookings.length === 1 ? '' : 's'}
            {(searchTerm || filterEventType || filterStatus || activeTab !== 'all') && (
              <span className="ml-1.5 text-[#B95650]">
                (Filtered from {bookings.length} total)
              </span>
            )}
          </div>

          {(searchTerm || filterEventType || filterStatus || activeTab !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterEventType('');
                setFilterStatus('');
                setActiveTab('all');
              }}
              className="text-[#B95650] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Reset all filters</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Bookings Data Table / Registry */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 space-y-4">
            <div className="h-6 bg-slate-100 rounded-lg animate-pulse w-1/4"></div>
            <div className="h-12 bg-slate-50 rounded-xl animate-pulse"></div>
            <div className="h-12 bg-slate-50 rounded-xl animate-pulse"></div>
            <div className="h-12 bg-slate-50 rounded-xl animate-pulse"></div>
            <div className="h-12 bg-slate-50 rounded-xl animate-pulse"></div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FCECE8] text-[#B95650] flex items-center justify-center mx-auto border border-[#E8B5A6]/40 shadow-xs">
              <CalendarCheck className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#211D1B]">No booking requests recorded</h3>
              <p className="text-xs text-[#756B65] max-w-md mx-auto font-medium mt-1 leading-relaxed">
                The coordinator inquiry queue is currently empty. Incoming customer celebration requests and event inquiries will appear here in real time as clients submit bookings.
              </p>
            </div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FCECE8] text-[#B95650] flex items-center justify-center mx-auto border border-[#E8B5A6]/40">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#211D1B]">No matching booking requests</h3>
            <p className="text-xs text-[#756B65] max-w-sm mx-auto font-medium">
              No inquiries match your current search query or active filter settings. Try adjusting your filter parameters or search terms.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterEventType('');
                setFilterStatus('');
                setActiveTab('all');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <span>Clear filters</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-3">Reference</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Event & Type</th>
                  <th className="py-3 px-3">Preferred Date</th>
                  <th className="py-3 px-3">Assigned Coordinator</th>
                  <th className="py-3 px-3">Location & Guests</th>
                  <th className="py-3 px-3">Budget</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedBookings.map((b) => {
                  const cfg = getStatusBadgeConfig(b.status);
                  const isSelected = selectedBookingId === b.id;
                  const formattedDate = b.preferredDate
                    ? new Date(b.preferredDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'TBD';

                  return (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBookingId(b.id)}
                      className={`transition-colors cursor-pointer group ${
                        isSelected
                          ? 'bg-[#FCECE8]/70 hover:bg-[#FCECE8]'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Reference Column with Copy Action */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-[#B95650] transition-colors">
                            {b.reference}
                          </span>
                          <button
                            onClick={(e) => handleCopyReference(b.reference, e)}
                            className="p-1 rounded text-slate-300 hover:text-slate-600 transition-colors"
                            title="Copy Reference"
                          >
                            {copiedRef === b.reference ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400 block font-normal mt-0.5">
                          {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'Active'}
                        </span>
                      </td>

                      {/* Client Column */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center font-bold text-[#B95650] shrink-0 text-[11px]">
                            {b.customer?.fullName
                              ? b.customer.fullName.charAt(0).toUpperCase()
                              : 'C'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate max-w-[120px]">
                              {b.customer?.fullName || 'Client'}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[120px]">
                              {b.customer?.phone || b.customer?.email || 'No phone'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Event Title & Type */}
                      <td className="py-3 px-3">
                        <div className="min-w-0 max-w-[240px]">
                          <span className="font-bold text-slate-900 block line-clamp-2 leading-tight" title={b.title}>
                            {b.title}
                          </span>
                          <div className="mt-1">{getEventTypeBadge(b.eventType)}</div>
                        </div>
                      </td>

                      {/* Preferred Date */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formattedDate}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {b.startTime ? 'Scheduled' : 'Full day'}
                        </span>
                      </td>

                      {/* Assigned Coordinator Column */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {b.assignedCoordinatorId === user?.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <UserCheck className="w-3 h-3" />
                              <span>You (Primary)</span>
                            </span>
                          </div>
                        ) : b.assignedCoordinator ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="truncate max-w-[110px]" title={b.assignedCoordinator.fullName}>
                                  {b.assignedCoordinator.fullName}
                                </span>
                              </span>
                              {user?.role === 'ADMIN_DIRECTOR' && (
                                <button
                                  onClick={(e) => handleOpenReassignModal(b, e)}
                                  className="text-[10px] text-slate-400 hover:text-[#B95650] underline font-semibold cursor-pointer"
                                  title="Reassign as Executive Admin"
                                >
                                  Reassign
                                </button>
                              )}
                            </div>
                            {b.staffAssignments?.some((sa) => sa.role === 'ASSISTING_COORDINATOR') && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                +{b.staffAssignments.filter((sa) => sa.role === 'ASSISTING_COORDINATOR').length} assisting
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                              <span>Unassigned</span>
                            </span>
                            {['COORDINATOR', 'ADMIN_DIRECTOR'].includes(user?.role) && (
                              <button
                                onClick={(e) => handleClaimRequest(b.id, e)}
                                disabled={claimingId === b.id}
                                className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#B95650] hover:bg-[#a24944] text-white transition shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                title="Claim this unassigned request to become primary coordinator"
                              >
                                {claimingId === b.id ? (
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                  <UserPlus className="w-2.5 h-2.5" />
                                )}
                                <span>Claim</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Location & Guests */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 text-slate-700 whitespace-nowrap">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{b.guestCount || 'TBD'} guests</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 truncate max-w-[130px]" title={b.locationName || b.city || 'Addis Ababa'}>
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{b.locationName || b.city || 'Addis Ababa'}</span>
                        </div>
                      </td>

                      {/* Budget in ETB */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-extrabold text-slate-900 block">
                          {b.budgetEstimate
                            ? `${Number(b.budgetEstimate).toLocaleString()} ETB`
                            : 'Flexible'}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[110px]" title={b.package?.name || 'Custom scope'}>
                          {b.package?.name || 'Custom scope'}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          <span>{cfg.label}</span>
                        </span>
                      </td>

                      {/* Action button */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBookingId(b.id);
                          }}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-[#FCECE8] text-slate-700 hover:text-[#B95650] border border-slate-200 hover:border-rose-200 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {filteredBookings.length > 0 && !loading && (
          <div className="px-4 py-3 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 text-slate-500 font-medium">
              <span>
                Showing <strong className="text-slate-800">{(page - 1) * pageSize + 1}</strong>–
                <strong className="text-slate-800">{Math.min(page * pageSize, filteredBookings.length)}</strong> of{' '}
                <strong className="text-slate-800">{filteredBookings.length}</strong> bookings
              </span>
              <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                <span className="text-[11px] text-slate-400">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-hidden"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  if (
                    p === 1 ||
                    p === totalPages ||
                    (p >= page - 1 && p <= page + 1)
                  ) {
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          page === p
                            ? 'bg-[#B95650] text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  }
                  if (p === page - 2 || p === page + 2) {
                    return (
                      <span key={p} className="text-slate-400 px-0.5">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Comprehensive Booking Detail Slide-Over Drawer */}
      {selectedBookingId && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                  {selectedBookingDetails?.reference || 'Booking Details'}
                </span>
                {selectedBookingDetails?.status && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      getStatusBadgeConfig(selectedBookingDetails.status).bg
                    } ${getStatusBadgeConfig(selectedBookingDetails.status).text} ${
                      getStatusBadgeConfig(selectedBookingDetails.status).border
                    }`}
                  >
                    {getStatusBadgeConfig(selectedBookingDetails.status).label}
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedBookingId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-left text-xs">
              {loadingDetails ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-16 bg-slate-100 rounded-xl"></div>
                  <div className="h-28 bg-slate-100 rounded-xl"></div>
                  <div className="h-36 bg-slate-100 rounded-xl"></div>
                </div>
              ) : selectedBookingDetails ? (
                <>
                  {/* SECTION 1: REQUEST OVERVIEW */}
                  <div className="pb-4 border-b border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          1. Request Overview
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                          {selectedBookingDetails.reference}
                        </span>
                        <button
                          onClick={(e) => handleCopyReference(selectedBookingDetails.reference, e)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition cursor-pointer"
                          title="Copy reference code"
                        >
                          {copiedRef === selectedBookingDetails.reference ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Ref: {selectedBookingDetails.id.slice(0, 8)}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 leading-snug tracking-tight mb-3">
                      {selectedBookingDetails.title}
                    </h2>

                    {/* Independent Lifecycle Badges */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Booking Request Status */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                          Booking Request
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            getStatusBadgeConfig(selectedBookingDetails.status).bg
                          } ${getStatusBadgeConfig(selectedBookingDetails.status).text} ${
                            getStatusBadgeConfig(selectedBookingDetails.status).border
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              getStatusBadgeConfig(selectedBookingDetails.status).dot
                            }`}
                          />
                          <span>{selectedBookingDetails.status?.replace(/_/g, ' ')}</span>
                        </span>
                      </div>

                      {/* Event Execution Status */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                          Event Execution
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3 h-3 text-blue-500" />
                          <span>{selectedBookingDetails.eventStatus || 'SCHEDULED'}</span>
                        </span>
                      </div>

                      {/* Payment Position */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                          Payment Position
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            selectedBookingDetails.paymentPosition === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : selectedBookingDetails.paymentPosition === 'PARTIALLY_PAID'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : selectedBookingDetails.paymentPosition === 'BALANCE_OUTSTANDING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <DollarSign className="w-3 h-3" />
                          <span>{selectedBookingDetails.paymentPosition?.replace(/_/g, ' ') || 'UNPAID'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-100">
                      <span>Submitted: {new Date(selectedBookingDetails.createdAt).toLocaleString()}</span>
                      <span>Updated: {new Date(selectedBookingDetails.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* SECTION 2: CUSTOMER INFORMATION */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <span>2. Customer Information</span>
                      <span className="text-[10px] font-normal text-slate-400 lowercase">(verified profile)</span>
                    </h3>
                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-rose-100 text-[#B95650] font-bold text-xs flex items-center justify-center shrink-0 border border-rose-200">
                            {selectedBookingDetails.customer?.fullName?.charAt(0) || 'C'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate">
                              {selectedBookingDetails.customer?.fullName || 'Anonymous Customer'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              Account ID: {selectedBookingDetails.customer?.id?.slice(0, 8)}... • Customer Role
                            </div>
                          </div>
                        </div>
                        <Link
                          to="/portal/dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-[11px] text-[#B95650] hover:bg-rose-50 rounded border border-rose-200 flex items-center gap-1 transition"
                        >
                          <span>Portal View</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {selectedBookingDetails.customer?.phone ? (
                            <a
                              href={`tel:${selectedBookingDetails.customer.phone}`}
                              className="font-medium text-slate-700 hover:text-[#B95650] hover:underline"
                            >
                              {selectedBookingDetails.customer.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">No phone recorded</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {selectedBookingDetails.customer?.email ? (
                            <a
                              href={`mailto:${selectedBookingDetails.customer.email}`}
                              className="font-medium text-slate-700 hover:text-[#B95650] hover:underline truncate"
                            >
                              {selectedBookingDetails.customer.email}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">No email recorded</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: COORDINATOR ASSIGNMENT & COLLABORATION */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#B95650]" />
                        <span>3. Coordinator Ownership & Team</span>
                      </h3>
                      {selectedBookingDetails.assignedCoordinatorId && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active Primary Owner
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-3">
                      {/* Primary Coordinator Info or Unassigned Claim Banner */}
                      {selectedBookingDetails.assignedCoordinatorId ? (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 text-[#B95650] font-bold text-sm flex items-center justify-center shrink-0">
                                {selectedBookingDetails.assignedCoordinator?.fullName?.charAt(0) || 'C'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-xs truncate">
                                    {selectedBookingDetails.assignedCoordinator?.fullName}
                                  </span>
                                  {selectedBookingDetails.assignedCoordinatorId === user?.id && (
                                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium block">
                                  Primary Event Coordinator • Sole Primary Owner
                                </span>
                              </div>
                            </div>

                            {/* Executive Admin Reassign Button */}
                            {user?.role === 'ADMIN_DIRECTOR' && (
                              <button
                                onClick={(e) => handleOpenReassignModal(selectedBookingDetails, e)}
                                className="px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition inline-flex items-center gap-1 cursor-pointer shrink-0"
                                title="Executive override to reassign primary coordinator"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>Reassign</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                            <div className="flex items-center gap-2 text-slate-600">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{selectedBookingDetails.assignedCoordinator?.email || 'No email recorded'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{selectedBookingDetails.assignedCoordinator?.phone || 'No phone recorded'}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-amber-50/90 rounded-xl border border-amber-200 space-y-2.5">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                              <AlertCircle className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-amber-900">
                                No Primary Coordinator Assigned
                              </div>
                              <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                                This inquiry is currently unassigned in the shared queue. Claim this request to take responsibility for customer communication, quotation preparation, and event delivery.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-amber-200/60">
                            <span className="text-[10px] text-amber-700 font-medium">
                              Atomic locking prevents simultaneous claims
                            </span>
                            {['COORDINATOR', 'ADMIN_DIRECTOR'].includes(user?.role) && (
                              <button
                                onClick={(e) => handleClaimRequest(selectedBookingDetails.id, e)}
                                disabled={claimingId === selectedBookingDetails.id}
                                className="px-4 py-1.5 bg-[#B95650] hover:bg-[#a24944] text-white text-xs font-bold rounded-lg shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                              >
                                {claimingId === selectedBookingDetails.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="w-3.5 h-3.5" />
                                )}
                                <span>Claim Request & Take Ownership</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Assisting Coordinators (Collaborators) */}
                      <div className="pt-2 border-t border-slate-200/60">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">
                              Assisting Coordinators & Collaborators
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Support team members assisting without changing primary ownership
                            </span>
                          </div>
                          {['COORDINATOR', 'ADMIN_DIRECTOR'].includes(user?.role) && (
                            <button
                              onClick={(e) => handleOpenAddCollaborator(selectedBookingDetails, e)}
                              className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <UserPlus className="w-3 h-3 text-[#B95650]" />
                              <span>+ Add Collaborator</span>
                            </button>
                          )}
                        </div>

                        {selectedBookingDetails.staffAssignments?.filter((sa) => sa.role === 'ASSISTING_COORDINATOR').length > 0 ? (
                          <div className="space-y-1.5">
                            {selectedBookingDetails.staffAssignments
                              .filter((sa) => sa.role === 'ASSISTING_COORDINATOR')
                              .map((sa) => (
                                <div
                                  key={sa.id}
                                  className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {sa.staff?.fullName?.charAt(0) || 'S'}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="font-bold text-slate-800 block truncate">
                                        {sa.staff?.fullName}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block truncate">
                                        {sa.location || 'Assisting Coordinator Support'}
                                      </span>
                                    </div>
                                  </div>

                                  {(user?.id === selectedBookingDetails.assignedCoordinatorId || user?.role === 'ADMIN_DIRECTOR') && (
                                    <button
                                      onClick={(e) => handleRemoveCollaborator(selectedBookingDetails.id, sa.staffId, e)}
                                      disabled={removingStaffId === sa.staffId}
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer"
                                      title="Remove collaborator"
                                    >
                                      {removingStaffId === sa.staffId ? (
                                        <RefreshCw className="w-3 h-3 animate-spin text-rose-500" />
                                      ) : (
                                        <X className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No assisting coordinators assigned yet.</p>
                        )}
                      </div>

                      {/* Assignment & Audit Timeline */}
                      <div className="pt-2 border-t border-slate-200/60">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                            <History className="w-3 h-3 text-slate-400" />
                            <span>Assignment History</span>
                          </span>
                          {loadingHistory && <span className="text-[10px] text-slate-400">Loading audit log...</span>}
                        </div>

                        {assignmentHistory.length > 0 ? (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-[11px]">
                            {assignmentHistory.map((item) => (
                              <div key={item.id} className="p-2 bg-white rounded-lg border border-slate-200/70">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800">
                                    {item.action === 'COORDINATOR_CLAIMED'
                                      ? `Claimed by ${item.newCoordinator}`
                                      : item.action === 'COORDINATOR_REASSIGNED'
                                      ? `Reassigned: ${item.previousCoordinator} → ${item.newCoordinator}`
                                      : item.action === 'COORDINATOR_ASSIGNED'
                                      ? `Assigned to ${item.newCoordinator}`
                                      : item.action?.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="text-slate-500 text-[10px] mt-0.5">
                                  By {item.assignedBy} ({item.assignedByRole})
                                </div>
                                {item.reason && (
                                  <p className="text-slate-600 mt-1 italic text-[10px] bg-slate-50 p-1.5 rounded">
                                    "{item.reason}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No previous reassignments recorded.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: EVENT DETAILS AND SCHEDULE */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                      4. Event Details and Schedule
                    </h3>
                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Category</span>
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-slate-200 text-slate-700">
                            {selectedBookingDetails.eventType?.replace(/_/g, ' ') || 'Event'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Primary Coordinator</span>
                          <span className="text-xs font-semibold text-slate-900 block truncate">
                            {selectedBookingDetails.assignedCoordinator?.fullName || 'Unassigned'}
                          </span>
                        </div>
                      </div>

                      {/* Preferred Date Notice */}
                      <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200/80">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-amber-700" />
                            <span className="text-xs font-bold text-amber-900">
                              {new Date(selectedBookingDetails.preferredDate).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                            ['CONFIRMED', 'PREPARATION', 'IN_PROGRESS', 'COMPLETED'].includes(selectedBookingDetails.status)
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-200/80 text-amber-900'
                          }`}>
                            {['CONFIRMED', 'PREPARATION', 'IN_PROGRESS', 'COMPLETED'].includes(selectedBookingDetails.status)
                              ? 'Confirmed Date'
                              : 'Preferred Date — Not Yet Confirmed'}
                          </span>
                        </div>
                        {!['CONFIRMED', 'PREPARATION', 'IN_PROGRESS', 'COMPLETED'].includes(selectedBookingDetails.status) && (
                          <p className="text-[11px] text-amber-800 mt-1 leading-snug">
                            This date remains provisional until quotation acceptance, dual contract execution, and verified initial 50% deposit.
                          </p>
                        )}
                      </div>

                      {/* Times & Setup/Teardown */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">Event Operating Hours</span>
                          <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>
                              {selectedBookingDetails.startTime && selectedBookingDetails.endTime
                                ? `${new Date(selectedBookingDetails.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(selectedBookingDetails.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : 'Full-Day Event Window'}
                            </span>
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">Setup & Teardown Buffers</span>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {selectedBookingDetails.setupStartTime
                              ? `Setup: ${new Date(selectedBookingDetails.setupStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : 'Standard 2h Pre-Setup'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: LOCATION AND AVAILABILITY */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                      4. Scale, Location and Availability
                    </h3>
                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-3">
                      {/* Guest Count & Scale Category */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Expected Attendance</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm font-bold text-slate-900">{selectedBookingDetails.guestCount} Guests</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              selectedBookingDetails.guestCount > 300
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {selectedBookingDetails.guestCount > 300 ? 'Large Scale (>300 guests)' : 'Standard Scale (≤300 guests)'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">City</span>
                          <span className="text-xs font-semibold text-slate-800">{selectedBookingDetails.city || 'Addis Ababa'}</span>
                        </div>
                      </div>

                      {/* Venue & Detailed Address */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Venue & Address</span>
                        <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{selectedBookingDetails.locationName || 'Venue TBD'}</span>
                        </p>
                        {selectedBookingDetails.locationAddress && (
                          <p className="text-[11px] text-slate-500 mt-0.5 pl-5">
                            {selectedBookingDetails.locationAddress}
                          </p>
                        )}
                      </div>

                      {/* Real Backend Availability Assessment Badge & Details */}
                      <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                            Availability Assessment
                          </span>
                          {loadingAvailability ? (
                            <span className="text-[10px] text-slate-400 animate-pulse">Checking resources...</span>
                          ) : availabilityAssessment ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              availabilityAssessment.assessmentStatus === 'AVAILABLE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : availabilityAssessment.assessmentStatus === 'CONFLICT_FOUND'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : availabilityAssessment.assessmentStatus === 'NEEDS_MANUAL_REVIEW'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              {availabilityAssessment.assessmentStatus?.replace(/_/g, ' ')}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              Not Checked
                            </span>
                          )}
                        </div>

                        {availabilityAssessment && (
                          <div className="space-y-1.5 text-[11px] text-slate-600">
                            <div className="flex items-start gap-1.5">
                              <span className="font-semibold text-slate-700 shrink-0">• Venue Check:</span>
                              <span>{availabilityAssessment.venueCheck?.message}</span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="font-semibold text-slate-700 shrink-0">• Coordinator:</span>
                              <span>{availabilityAssessment.coordinatorCheck?.message}</span>
                            </div>
                          </div>
                        )}

                        {/* Critical Multi-Event Capacity Rule Callout */}
                        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-1.5">
                          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <span>
                            <strong>Same-Day Multi-Event Permitted:</strong> Azera coordinates multiple concurrent events across independent partner teams and venues. Calendar dates are never blocked globally.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 5: REQUESTED SERVICES AND PACKAGE */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                      5. Requested Services and Package
                    </h3>
                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-3">
                      {/* Package vs A-La-Carte */}
                      {selectedBookingDetails.package ? (
                        <div className="p-2.5 bg-white rounded-lg border border-rose-200 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-rose-600 block">Selected Package</span>
                            <div className="text-xs font-bold text-slate-900">{selectedBookingDetails.package.name}</div>
                            {selectedBookingDetails.package.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{selectedBookingDetails.package.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-extrabold text-rose-600">
                              {Number(selectedBookingDetails.package.startingPrice || selectedBookingDetails.package.price || 0).toLocaleString()} ETB
                            </span>
                            <span className="block text-[10px] text-slate-400">Package Starting</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-200">
                          No pre-built package selected. Client requested customized a-la-carte services.
                        </div>
                      )}

                      {/* Individual Services */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                          Requested Services ({selectedBookingDetails.items?.length || 0})
                        </span>
                        {selectedBookingDetails.items && selectedBookingDetails.items.length > 0 ? (
                          <div className="space-y-1.5">
                            {selectedBookingDetails.items.map((it) => (
                              <div
                                key={it.id}
                                className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="font-semibold text-slate-800">{it.service?.name || 'Requested Service'}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                    {it.service?.category || 'Service'}
                                  </span>
                                </div>
                                <span className="text-[11px] font-medium text-slate-500">
                                  Qty: {it.quantity || 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No individual a-la-carte services selected.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 6: BUDGET AND SPECIAL REQUIREMENTS */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                      6. Budget and Special Requirements
                    </h3>
                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-3">
                      {/* Estimated Budget vs Official Quotation */}
                      <div className="grid grid-cols-2 gap-3 pb-2.5 border-b border-slate-200/60">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer's Budget Estimate</span>
                          <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                            {selectedBookingDetails.budgetEstimate
                              ? `${Number(selectedBookingDetails.budgetEstimate).toLocaleString()} ETB`
                              : 'Unspecified'}
                          </div>
                          <p className="text-[10px] text-amber-700 mt-0.5">
                            Customer estimate only — Not an agreed price.
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Official Quotation</span>
                          {selectedBookingDetails.quotations && selectedBookingDetails.quotations.length > 0 ? (
                            <div>
                              <div className="text-sm font-extrabold text-emerald-700 mt-0.5">
                                {Number(selectedBookingDetails.quotations[0].totalAmount).toLocaleString()} ETB
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">
                                v{selectedBookingDetails.quotations[0].version} • {selectedBookingDetails.quotations[0].status}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic block mt-1">Pending formal quotation</span>
                          )}
                        </div>
                      </div>

                      {/* Theme & Styling */}
                      {selectedBookingDetails.theme && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Creative Theme & Styling</span>
                          <p className="text-xs text-slate-800 italic bg-white p-2 rounded-lg border border-slate-200">
                            "{selectedBookingDetails.theme}"
                          </p>
                        </div>
                      )}

                      {/* Special Requirements & Dietary (Structured UI Cards) */}
                      {selectedBookingDetails.specialRequirements ? (
                        <div className="pt-1">
                          <BookingDetailsCards specialRequirements={selectedBookingDetails.specialRequirements} />
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic">No special instructions or dietary restrictions provided.</div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 7: COORDINATOR REVIEW AND ACTIONS */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                      7. Coordinator Review and Actions
                    </h3>
                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-3">
                      {/* Workflow Navigation Shortcuts */}
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          to={`/company/quotations?bookingId=${selectedBookingDetails.id}`}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-[#B95650]" />
                          <span>Prepare Quotation</span>
                        </Link>
                        <Link
                          to={`/company/consultations?bookingId=${selectedBookingDetails.id}`}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs"
                        >
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span>Schedule Consultation</span>
                        </Link>
                      </div>

                      {/* Direct Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => setMissingInfoModal({ open: true, booking: selectedBookingDetails })}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Request Missing Details
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setStatusModal({
                              open: true,
                              booking: selectedBookingDetails,
                              targetStatus: selectedBookingDetails.allowedTransitions?.[0] || 'UNDER_REVIEW'
                            })
                          }
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Change Status
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmGateModal({ open: true, booking: selectedBookingDetails })}
                          className="px-3 py-1.5 bg-[#B95650] hover:bg-[#a84842] text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Confirm Booking
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setStatusModal({
                              open: true,
                              booking: selectedBookingDetails,
                              targetStatus: 'CANCELLED'
                            })
                          }
                          className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Reject Request
                        </button>
                      </div>

                      {/* Add Internal Note */}
                      <div className="pt-2 border-t border-slate-200/60">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>Add Internal Coordinator Note</span>
                          </label>
                          <span className="text-[10px] text-slate-400 font-medium">Never visible to client</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={internalNoteText}
                            onChange={(e) => setInternalNoteText(e.target.value)}
                            placeholder="Log private notes regarding client preferences, venue survey, or partner calls..."
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#B95650]"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddInternalNote();
                            }}
                          />
                          <button
                            type="button"
                            disabled={submittingNote || !internalNoteText.trim()}
                            onClick={handleAddInternalNote}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40"
                          >
                            {submittingNote ? 'Saving...' : 'Save Note'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 8: ACTIVITY TIMELINE */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                      8. Activity Timeline & Audit History
                    </h3>
                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
                      {/* Combined chronological timeline */}
                      {(() => {
                        const historyItems = (selectedBookingDetails.statusHistory || []).map((h) => ({
                          id: `hist-${h.id}`,
                          type: 'STATUS',
                          title: `Status: ${h.newStatus?.replace(/_/g, ' ')}`,
                          actor: h.changedBy?.fullName || 'System',
                          role: h.changedBy?.role || 'SYSTEM',
                          reason: h.reason,
                          date: new Date(h.createdAt)
                        }));

                        const messageItems = [];
                        if (selectedBookingDetails.conversations && selectedBookingDetails.conversations.length > 0) {
                          (selectedBookingDetails.conversations[0]?.messages || []).forEach((m) => {
                            messageItems.push({
                              id: `msg-${m.id}`,
                              type: m.isInternalOnly ? 'INTERNAL_NOTE' : 'MESSAGE',
                              title: m.isInternalOnly ? 'Internal Note' : 'Customer Message',
                              actor: m.sender?.fullName || 'Staff Member',
                              role: m.sender?.role || 'STAFF',
                              reason: m.content,
                              date: new Date(m.createdAt)
                            });
                          });
                        }

                        const timeline = [...historyItems, ...messageItems].sort((a, b) => b.date - a.date);

                        if (timeline.length === 0) {
                          return <p className="text-slate-400 italic text-xs">No activity logged yet.</p>;
                        }

                        return (
                          <div className="space-y-3 pl-3.5 border-l-2 border-slate-200">
                            {timeline.map((item) => (
                              <div key={item.id} className="relative">
                                <span
                                  className={`absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full border border-white ${
                                    item.type === 'INTERNAL_NOTE'
                                      ? 'bg-amber-500'
                                      : item.type === 'MESSAGE'
                                      ? 'bg-blue-500'
                                      : 'bg-[#B95650]'
                                  }`}
                                />
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-800">{item.title}</span>
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                        item.type === 'INTERNAL_NOTE'
                                          ? 'bg-amber-100 text-amber-800'
                                          : item.type === 'MESSAGE'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-slate-200 text-slate-700'
                                      }`}
                                    >
                                      {item.type === 'INTERNAL_NOTE'
                                        ? 'Internal Only'
                                        : item.type === 'MESSAGE'
                                        ? 'Client Visible'
                                        : 'Audit'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    {item.date.toLocaleDateString()}{' '}
                                    {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  By <strong className="text-slate-700">{item.actor}</strong> ({item.role})
                                </div>
                                {item.reason && (
                                  <p className="text-slate-700 text-xs mt-1 bg-white p-2 rounded border border-slate-200/60 leading-relaxed whitespace-pre-wrap">
                                    {item.reason}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Actions Footer */}
            {selectedBookingDetails && (
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setMissingInfoModal({ open: true, booking: selectedBookingDetails })}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                >
                  Request Missing Info
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setStatusModal({
                        open: true,
                        booking: selectedBookingDetails,
                        targetStatus: selectedBookingDetails.allowedTransitions?.[0] || 'UNDER_REVIEW'
                      })
                    }
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Change Status
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmGateModal({ open: true, booking: selectedBookingDetails })}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#B95650] hover:bg-[#a84842] rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Confirm Booking
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Request Missing Information Modal (SRS FR-021) */}
      {missingInfoModal.open && missingInfoModal.booking && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 text-left relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Request Missing Details
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {missingInfoModal.booking.reference} • {missingInfoModal.booking.customer?.fullName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMissingInfoModal({ open: false, booking: null })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <p className="text-slate-600 font-medium">
                Select items requiring customer clarification. Status will automatically update to{' '}
                <strong className="text-amber-700">NEEDS INFORMATION</strong> and post to their dedicated planning channel.
              </p>

              {/* Checkboxes for quick items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {missingOptions.map((opt) => {
                  const isChecked = missingChecklist.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleMissingOption(opt)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isChecked ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{opt}</span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Coordinator Instructions to Customer (Client-Visible Message)
                </label>
                <textarea
                  rows={3}
                  value={missingNotes}
                  onChange={(e) => setMissingNotes(e.target.value)}
                  placeholder="Please specify your guest count, schedule, or decor preferences so we can prepare your official quotation..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#B95650]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setMissingInfoModal({ open: false, booking: null })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={handleSendMissingInfo}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {updatingStatus ? 'Updating...' : 'Submit Request to Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. General Status Transition Modal (Filtered to Valid Transitions Only) */}
      {statusModal.open && statusModal.booking && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-left relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Update Booking Status
              </h3>
              <button
                onClick={() => setStatusModal({ open: false, booking: null, targetStatus: '' })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Current Status: <span className="font-bold text-[#B95650]">{statusModal.booking.status}</span>
                </label>
                <div className="text-[11px] text-slate-500 mb-2">
                  Select an authorized next status from the approved workflow state machine:
                </div>
                <select
                  value={statusModal.targetStatus}
                  onChange={(e) => setStatusModal({ ...statusModal, targetStatus: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#B95650]"
                >
                  {(statusModal.booking.allowedTransitions || [
                    'UNDER_REVIEW',
                    'NEEDS_INFORMATION',
                    'SERVICE_CHECK',
                    'QUOTATION_IN_PROGRESS',
                    'QUOTATION_SENT',
                    'CANCELLED'
                  ]).map((st) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, ' ')}
                    </option>
                  ))}
                  {/* Always provide CANCELLED option if not present */}
                  {!(statusModal.booking.allowedTransitions || []).includes('CANCELLED') && (
                    <option value="CANCELLED">CANCELLED (Reject Request)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason / Coordinator Audit Notes {statusModal.targetStatus === 'CANCELLED' && <span className="text-rose-600">* (Required)</span>}
                </label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={
                    statusModal.targetStatus === 'CANCELLED'
                      ? 'Please specify why this booking request is being cancelled or rejected...'
                      : 'Record rationale for this lifecycle transition...'
                  }
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#B95650]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStatusModal({ open: false, booking: null, targetStatus: '' })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingStatus || !statusModal.targetStatus}
                onClick={() => handleExecuteStatusChange(statusModal.targetStatus, statusReason)}
                className="px-5 py-2 text-xs font-bold text-white bg-[#B95650] hover:bg-[#a84842] rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {updatingStatus ? 'Updating...' : 'Save & Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Confirmation Gating Modal */}
      {confirmGateModal.open && confirmGateModal.booking && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-left relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Confirm Booking Request
              </h3>
              <button
                onClick={() => setConfirmGateModal({ open: false, booking: null })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs">
              <p className="text-slate-600 font-medium">
                Formal booking confirmation requires all three prerequisites to be met:
              </p>

              {/* 3 Prerequisite Checks */}
              <div className="space-y-2">
                {/* Check 1: Quotation Accepted */}
                <div className="p-3 rounded-xl border flex items-center justify-between bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-800">1. Quotation Accepted</div>
                    <div className="text-[11px] text-slate-500">
                      {confirmationPrerequisites?.acceptedQuote
                        ? `Accepted Quote v${confirmationPrerequisites.acceptedQuote.version} (${Number(
                            confirmationPrerequisites.acceptedQuote.totalAmount
                          ).toLocaleString()} ETB)`
                        : 'No quotation has been accepted by the customer.'}
                    </div>
                  </div>
                  {confirmationPrerequisites?.acceptedQuote ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  )}
                </div>

                {/* Check 2: Signed Contract */}
                <div className="p-3 rounded-xl border flex items-center justify-between bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-800">2. Fully Executed Contract</div>
                    <div className="text-[11px] text-slate-500">
                      {confirmationPrerequisites?.signedContract
                        ? `Dual Signed Contract v${confirmationPrerequisites.signedContract.version}`
                        : 'Contract is not yet fully executed with dual signatures.'}
                    </div>
                  </div>
                  {confirmationPrerequisites?.signedContract ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  )}
                </div>

                {/* Check 3: Verified 50% Initial Deposit */}
                <div className="p-3 rounded-xl border flex items-center justify-between bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-800">3. Verified 50% Deposit</div>
                    <div className="text-[11px] text-slate-500">
                      Verified: {Number(confirmationPrerequisites?.totalVerified || 0).toLocaleString()} ETB
                      {confirmationPrerequisites?.requiredDeposit
                        ? ` / Required: ${Number(confirmationPrerequisites.requiredDeposit).toLocaleString()} ETB`
                        : ''}
                    </div>
                  </div>
                  {confirmationPrerequisites?.depositSatisfied ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  )}
                </div>

                {/* Check 4: Manual External Provider Verification */}
                <div className="p-3 rounded-xl border bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800">4. Manual External Provider Verification</div>
                    {providerVerificationChecked ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer select-none text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-slate-200/80">
                    <input
                      type="checkbox"
                      checked={providerVerificationChecked}
                      onChange={(e) => setProviderVerificationChecked(e.target.checked)}
                      className="rounded border-slate-300 text-[#B95650] focus:ring-[#B95650] w-3.5 h-3.5 mt-0.5 cursor-pointer"
                    />
                    <span>
                      I confirm as Coordinator that external providers (caterer, florist, audio, venue, etc.) have been manually verified via phone, WhatsApp, or email.
                    </span>
                  </label>
                </div>
              </div>

              {(!confirmationPrerequisites?.canConfirm || !providerVerificationChecked) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    {!confirmationPrerequisites?.canConfirm
                      ? 'Confirmation cannot be granted until all financial and contractual criteria are satisfied.'
                      : 'Please check the coordinator verification box above to confirm real-world external provider arrangements.'}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmGateModal({ open: false, booking: null });
                  setProviderVerificationChecked(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
              {confirmationPrerequisites?.canConfirm ? (
                <button
                  type="button"
                  disabled={confirmingBooking || !providerVerificationChecked}
                  onClick={() => handleConfirmBooking(confirmGateModal.booking.id)}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#B95650] hover:bg-[#a84842] rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {confirmingBooking ? 'Confirming...' : 'Confirm Booking'}
                </button>
              ) : (
                <Link
                  to={`/company/quotations?bookingId=${confirmGateModal.booking.id}`}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition"
                >
                  Go to Quotations
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. Reassign Primary Coordinator Modal (Executive Administration: ADMIN_DIRECTOR) */}
      {reassignModal.open && reassignModal.booking && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-left relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Reassign Primary Coordinator
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {reassignModal.booking.reference} • {reassignModal.booking.customer?.fullName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReassignModal({ open: false, booking: null, targetCoordinatorId: '', reason: '' })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="py-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Current Primary Owner</span>
                <span className="text-xs font-bold text-slate-800">
                  {reassignModal.booking.assignedCoordinator?.fullName || 'Unassigned'}
                </span>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Executive override will transfer primary responsibility and dispatch official notifications to both coordinators.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select New Primary Coordinator <span className="text-rose-600">*</span>
                </label>
                <select
                  value={reassignModal.targetCoordinatorId}
                  onChange={(e) => setReassignModal({ ...reassignModal, targetCoordinatorId: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#B95650] bg-white cursor-pointer"
                  required
                >
                  <option value="">-- Choose Coordinator --</option>
                  {activeCoordinators
                    .filter((c) => c.id !== reassignModal.booking.assignedCoordinatorId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.role}) — {c.activeBookingsCount || 0} active bookings
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reassignment Reason <span className="text-rose-600">* (Mandatory for Audit History)</span>
                </label>
                <textarea
                  rows={3}
                  value={reassignModal.reason}
                  onChange={(e) => setReassignModal({ ...reassignModal, reason: e.target.value })}
                  placeholder="e.g., Workload rebalancing, coordinator leave coverage, or client relationship alignment..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#B95650]"
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReassignModal({ open: false, booking: null, targetCoordinatorId: '', reason: '' })}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning || !reassignModal.targetCoordinatorId || !reassignModal.reason.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#B95650] hover:bg-[#a24944] rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {reassigning ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. Add Assisting Coordinator (Collaborator) Modal */}
      {collaboratorModal.open && collaboratorModal.booking && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-left relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add Assisting Coordinator
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {collaboratorModal.booking.reference} • Support Collaboration
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCollaboratorModal({ open: false, booking: null, staffId: '', notes: '' })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCollaboratorSubmit} className="py-4 space-y-4 text-xs">
              <p className="text-slate-600 font-medium">
                Assisting coordinators can view booking specifications, join consultations, and support venue operations without altering the primary coordinator's ownership.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Assisting Coordinator / Staff <span className="text-rose-600">*</span>
                </label>
                <select
                  value={collaboratorModal.staffId}
                  onChange={(e) => setCollaboratorModal({ ...collaboratorModal, staffId: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#B95650] bg-white cursor-pointer"
                  required
                >
                  <option value="">-- Choose Team Member --</option>
                  {activeCoordinators
                    .filter(
                      (c) =>
                        c.id !== collaboratorModal.booking.assignedCoordinatorId &&
                        !collaboratorModal.booking.staffAssignments?.some(
                          (sa) => sa.staffId === c.id && sa.role === 'ASSISTING_COORDINATOR'
                        )
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.role})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Role / Support Responsibilities (Optional)
                </label>
                <textarea
                  rows={3}
                  value={collaboratorModal.notes}
                  onChange={(e) => setCollaboratorModal({ ...collaboratorModal, notes: e.target.value })}
                  placeholder="e.g., Venue survey assistance, catering menu tastings, or day-of logistics support..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#B95650]"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCollaboratorModal({ open: false, booking: null, staffId: '', notes: '' })}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingCollaborator || !collaboratorModal.staffId}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#B95650] hover:bg-[#a24944] rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {addingCollaborator ? 'Adding...' : 'Add Assisting Coordinator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
