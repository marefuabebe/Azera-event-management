import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Filter,
  X,
  FileText,
  FileSpreadsheet,
  CalendarCheck,
  CheckSquare,
  ShieldCheck,
  Building,
  UserCheck,
  User,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  AlertCircle,
  Briefcase,
  SlidersHorizontal,
  ChevronDown,
  Info,
  Phone,
  Mail,
  Copy,
  Check,
  Trash2,
  Eye,
  Edit3,
  Package,
  Flag,
  DollarSign
} from 'lucide-react';

// Format ETB currency strictly according to Ethiopian Birr standard
const formatETB = (val) => {
  const num = parseFloat(val || 0);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  }).format(num) + ' ETB';
};

// Date formatter helpers
const formatDate = (dateStr, opts = {}) => {
  if (!dateStr) return 'Not Scheduled';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleDateString('en-US', {
    year: opts.year !== false ? 'numeric' : undefined,
    month: opts.month || 'short',
    day: 'numeric',
    weekday: opts.weekday || undefined
  });
};

const formatTime = (timeStr) => {
  if (!timeStr) return '--:--';
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return timeStr;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const toISODate = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    return d.substring(0, 10);
  }
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const EVENT_TYPE_LABELS = {
  WEDDING: 'Wedding',
  BIRTHDAY: 'Birthday',
  CORPORATE: 'Corporate Event',
  SHIMGLINA: 'Shimglina',
  ANNIVERSARY: 'Anniversary',
  CONCERT: 'Concert & Festival',
  GRADUATION: 'Graduation',
  EXHIBITION: 'Exhibition',
  CHARITY_GALA: 'Charity Gala',
  FUNERAL: 'Memorial / Funeral',
  OTHER: 'Special Event'
};

const EVENT_STATUS_CONFIG = {
  SCHEDULED: {
    label: 'Scheduled',
    badge: 'bg-slate-50 text-slate-700 border-slate-200',
    dot: 'bg-slate-500'
  },
  PREPARING: {
    label: 'In Preparation',
    badge: 'bg-slate-100 text-slate-800 border-slate-200 font-medium',
    dot: 'bg-slate-600'
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badge: 'bg-slate-100 text-slate-900 border-slate-200 font-semibold',
    dot: 'bg-slate-900'
  },
  COMPLETED: {
    label: 'Completed',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500'
  },
  CANCELLED: {
    label: 'Cancelled',
    badge: 'bg-rose-50 text-[#F50046] border-rose-200 font-semibold',
    dot: 'bg-[#F50046]'
  }
};

// Authoritative confirmed event statuses according to Eventora SRS & Workflow
export const CONFIRMED_EVENT_STATUSES = ['CONFIRMED', 'PREPARATION', 'IN_PROGRESS', 'COMPLETED'];

// Helper to determine if a booking qualifies as a confirmed event (signed contract + verified initial payment, or confirmed status)
export const isConfirmedEvent = (b) => {
  if (!b) return false;
  if (b.status === 'CANCELLED' || b.eventStatus === 'CANCELLED') return false;

  // 1. Confirmed booking lifecycle status
  if (CONFIRMED_EVENT_STATUSES.includes(b.status)) return true;

  // 2. Or executed signed contract + verified payment / partially paid / paid
  const hasSignedContract = b.contracts && b.contracts.some((c) => c.status === 'SIGNED');
  const hasVerifiedPayment =
    (b.payments && b.payments.some((p) => p.status === 'VERIFIED')) ||
    ['PARTIALLY_PAID', 'PAID'].includes(b.paymentPosition);

  return Boolean(hasSignedContract && hasVerifiedPayment);
};

export default function CompanyEventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary state
  const [bookings, setBookings] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Calendar View & Navigation state
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day' | 'list'
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Filter state
  const [eventScope, setEventScope] = useState('confirmed'); // 'confirmed' (default: only confirmed events with signed contract & verified deposit) | 'all' (includes unconfirmed tentative requests)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterEventStatus, setFilterEventStatus] = useState('');
  const [filterCoordinator, setFilterCoordinator] = useState('');
  const [filterReadiness, setFilterReadiness] = useState('all'); // 'all' | 'ready' | 'in_progress' | 'attention'
  const [activeMetricTab, setActiveMetricTab] = useState(null); // 'upcoming' | 'today' | 'preparing' | 'attention'

  // Drawer / Inspection state
  const [selectedBookingId, setSelectedBookingId] = useState(() => searchParams.get('bookingId') || null);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview'); // 'overview' | 'booking' | 'schedule' | 'partners' | 'staff' | 'resources' | 'readiness'

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editScheduleModal, setEditScheduleModal] = useState({ open: false, booking: null });
  const [addMilestoneModal, setAddMilestoneModal] = useState({ open: false, bookingId: null });
  const [newMilestoneForm, setNewMilestoneForm] = useState({ title: '', targetDate: '', order: 1 });
  const [copiedRef, setCopiedRef] = useState(null);

  // Form state for Create / Schedule Event modal
  const [createStep, setCreateStep] = useState(1);
  const [createMode, setCreateMode] = useState('existing'); // 'existing' | 'new'
  const [selectedExistingBookingId, setSelectedExistingBookingId] = useState('');
  const [createForm, setCreateForm] = useState({
    title: '',
    eventType: 'WEDDING',
    preferredDate: toISODate(new Date()),
    startTime: '10:00',
    endTime: '18:00',
    setupStartTime: '08:00',
    teardownEndTime: '20:00',
    locationName: '',
    locationAddress: '',
    city: 'Addis Ababa',
    guestCount: 100,
    assignedCoordinatorId: '',
    notes: ''
  });
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Form state for Edit Schedule modal
  const [editForm, setEditForm] = useState({
    title: '',
    eventType: 'WEDDING',
    preferredDate: '',
    startTime: '',
    endTime: '',
    setupStartTime: '',
    teardownEndTime: '',
    locationName: '',
    locationAddress: '',
    guestCount: 100,
    eventStatus: 'SCHEDULED',
    assignedCoordinatorId: ''
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // 1. Data Fetching
  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const [bookingsRes, staffRes, partnersRes] = await Promise.allSettled([
        api.getAllBookings('?limit=200'),
        api.getStaffMembers(),
        api.getPartners()
      ]);

      if (bookingsRes.status === 'fulfilled' && bookingsRes.value?.data?.bookings) {
        setBookings(bookingsRes.value.data.bookings);
      } else if (bookingsRes.status === 'rejected') {
        const errMsg = bookingsRes.reason?.message || 'Failed to load bookings';
        console.error('Bookings load failed:', errMsg);
        setError(errMsg);
      }

      if (staffRes.status === 'fulfilled' && staffRes.value?.data?.staff) {
        setStaffMembers(staffRes.value.data.staff);
      }

      if (partnersRes.status === 'fulfilled' && partnersRes.value?.data?.partners) {
        setPartners(partnersRes.value.data.partners);
      }
    } catch (err) {
      console.error('Failed to load events data:', err);
      setError(err.message || 'Unable to load event schedules.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load selected booking details when drawer opens
  useEffect(() => {
    if (!selectedBookingId) {
      setSelectedBookingDetails(null);
      return;
    }
    let isMounted = true;
    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        const res = await api.getBookingById(selectedBookingId);
        if (isMounted && res?.data?.booking) {
          setSelectedBookingDetails(res.data.booking);
        }
      } catch (err) {
        console.error('Error fetching event details:', err);
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    };
    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [selectedBookingId]);

  // Keep URL query param in sync with selected booking
  useEffect(() => {
    if (selectedBookingId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('bookingId', selectedBookingId);
        return next;
      });
    } else {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('bookingId');
        return next;
      });
    }
  }, [selectedBookingId, setSearchParams]);

  // 2. Readiness Engine: Authoritative 5-pillar calculation (0 - 100%)
  const calculateReadiness = useCallback((b) => {
    if (!b) return { score: 0, items: [] };

    // Pillar 1: Contract Signed
    const hasContract = b.contracts && b.contracts.length > 0;
    const contractSigned = hasContract && ['SIGNED', 'VIEWED', 'PREPARED'].includes(b.contracts[0].status);

    // Pillar 2: 50% Initial Lock Deposit
    const hasInitialPayment =
      (b.payments && b.payments.some((p) => p.status === 'VERIFIED' || p.paymentType === 'INITIAL_50_PERCENT' || p.type === 'INITIAL_50_PERCENT')) ||
      ['PARTIALLY_PAID', 'PAID'].includes(b.paymentPosition);

    // Pillar 3: Partner Confirmations
    const hasRequiredServices = b.items && b.items.length > 0;
    const partnerAssignments = b.partnerAssignments || [];
    const partnersConfirmed =
      hasRequiredServices && partnerAssignments.length > 0
        ? partnerAssignments.every((pa) => pa.status === 'CONFIRMED' || !pa.status)
        : true; // If no partner services, consider satisfied

    // Pillar 4: Staff & Coordinator Assignment
    const hasCoordinator = Boolean(b.assignedCoordinatorId || b.assignedCoordinator);
    const hasStaff = (b.staffAssignments && b.staffAssignments.length > 0) || hasCoordinator;

    // Pillar 5: Milestones & Runsheet Defined
    const hasMilestones = b.milestones && b.milestones.length > 0;

    const checklist = [
      { name: 'Master Contract Executed', satisfied: contractSigned, weight: 20 },
      { name: '50% Initial Lock Deposit Verified', satisfied: hasInitialPayment, weight: 20 },
      { name: 'Contracted Partners Assigned', satisfied: partnersConfirmed, weight: 20 },
      { name: 'Lead Coordinator & Staff Assigned', satisfied: hasStaff, weight: 20 },
      { name: 'Event Milestones & Runsheet Ready', satisfied: hasMilestones, weight: 20 }
    ];

    const score = checklist.reduce((sum, item) => sum + (item.satisfied ? item.weight : 0), 0);

    return {
      score,
      items: checklist,
      isFullyReady: score === 100,
      needsAttention: score < 40 || !hasCoordinator
    };
  }, []);

  // 3. Confirmed Events vs Tentative Requests Segregation
  const { confirmedBookings, tentativeBookings } = useMemo(() => {
    const confirmed = [];
    const tentative = [];

    bookings.forEach((b) => {
      if (b.status === 'CANCELLED' || b.eventStatus === 'CANCELLED') return;
      if (isConfirmedEvent(b)) {
        confirmed.push(b);
      } else {
        tentative.push(b);
      }
    });

    return { confirmedBookings: confirmed, tentativeBookings: tentative };
  }, [bookings]);

  // Active bookings pool based on eventScope:
  // 'confirmed' (default: ONLY paid & signed confirmed events)
  // 'all' (includes unconfirmed tentative requests for scheduling visibility)
  const activeScopeBookings = useMemo(() => {
    if (eventScope === 'all') {
      return bookings.filter((b) => b.status !== 'CANCELLED' && b.eventStatus !== 'CANCELLED');
    }
    return confirmedBookings;
  }, [eventScope, bookings, confirmedBookings]);

  // 4. Multi-Event Conflict Detection Engine
  // Checks only within active scope events to prevent false warnings from unconfirmed inquiries
  const conflictMap = useMemo(() => {
    const map = new Map(); // bookingId -> array of conflict descriptions

    // Group bookings by preferred date string YYYY-MM-DD
    const byDate = new Map();
    activeScopeBookings.forEach((b) => {
      if (b.status === 'CANCELLED' || b.eventStatus === 'CANCELLED') return;
      const dStr = toISODate(b.preferredDate);
      if (!dStr) return;
      if (!byDate.has(dStr)) byDate.set(dStr, []);
      byDate.get(dStr).push(b);
    });

    byDate.forEach((dateBookings) => {
      if (dateBookings.length <= 1) return;

      // Check all pairs for resource overlaps
      for (let i = 0; i < dateBookings.length; i++) {
        for (let j = i + 1; j < dateBookings.length; j++) {
          const b1 = dateBookings[i];
          const b2 = dateBookings[j];

          // Check if times overlap (assuming fallback to full-day if times not explicitly set)
          const b1Start = b1.setupStartTime || b1.startTime || '08:00';
          const b1End = b1.teardownEndTime || b1.endTime || '22:00';
          const b2Start = b2.setupStartTime || b2.startTime || '08:00';
          const b2End = b2.teardownEndTime || b2.endTime || '22:00';

          const timesOverlap = b1Start < b2End && b2Start < b1End;

          if (timesOverlap) {
            // Check Coordinator overlap
            if (b1.assignedCoordinatorId && b1.assignedCoordinatorId === b2.assignedCoordinatorId) {
              const coordName = b1.assignedCoordinator?.fullName || 'Assigned Coordinator';
              const msg = `Coordinator Overlap: ${coordName} assigned to both ${b1.reference} and ${b2.reference}`;
              if (!map.has(b1.id)) map.set(b1.id, []);
              if (!map.has(b2.id)) map.set(b2.id, []);
              map.get(b1.id).push(msg);
              map.get(b2.id).push(msg);
            }

            // Check Staff Member overlap
            const b1StaffIds = (b1.staffAssignments || []).map((s) => s.staffId).filter(Boolean);
            const b2StaffIds = (b2.staffAssignments || []).map((s) => s.staffId).filter(Boolean);
            const overlappingStaff = b1StaffIds.filter((id) => b2StaffIds.includes(id));

            if (overlappingStaff.length > 0) {
              const msg = `Staff Overlap: Shared operational staff assigned across concurrent events (${b1.reference} & ${b2.reference})`;
              if (!map.has(b1.id)) map.set(b1.id, []);
              if (!map.has(b2.id)) map.set(b2.id, []);
              map.get(b1.id).push(msg);
              map.get(b2.id).push(msg);
            }

            // Check Venue Specific Collision (same venue hall)
            if (
              b1.locationName &&
              b2.locationName &&
              b1.locationName.trim().toLowerCase() === b2.locationName.trim().toLowerCase()
            ) {
              const msg = `Venue Hall Contention: Both events booked at identical venue (${b1.locationName})`;
              if (!map.has(b1.id)) map.set(b1.id, []);
              if (!map.has(b2.id)) map.set(b2.id, []);
              map.get(b1.id).push(msg);
              map.get(b2.id).push(msg);
            }
          }
        }
      }
    });

    return map;
  }, [activeScopeBookings]);

  // 5. Authoritative Summary Counts (calculated strictly on active scope)
  const summaryMetrics = useMemo(() => {
    const todayStr = toISODate(new Date());

    let upcoming = 0;
    let today = 0;
    let inPreparation = 0;
    let needsAttention = 0;

    activeScopeBookings.forEach((b) => {
      if (b.status === 'CANCELLED' || b.eventStatus === 'CANCELLED') return;
      const bDateStr = toISODate(b.preferredDate);

      // Upcoming: future dates
      if (bDateStr >= todayStr) {
        upcoming++;
      }

      // Today
      if (bDateStr === todayStr) {
        today++;
      }

      // In Preparation
      if (b.eventStatus === 'PREPARING' || ['CONFIRMED', 'PREPARATION'].includes(b.status)) {
        inPreparation++;
      }

      // Needs Attention: conflict detected, or unassigned coordinator, or readiness < 40%
      const hasConflicts = conflictMap.has(b.id) && conflictMap.get(b.id).length > 0;
      const readiness = calculateReadiness(b);
      if (hasConflicts || readiness.needsAttention || !b.assignedCoordinatorId) {
        needsAttention++;
      }
    });

    return { upcoming, today, inPreparation, needsAttention };
  }, [activeScopeBookings, conflictMap, calculateReadiness]);

  // 6. Filtered Bookings
  const filteredBookings = useMemo(() => {
    const todayStr = toISODate(new Date());

    return activeScopeBookings.filter((b) => {
      const bDateStr = toISODate(b.preferredDate);
      const readiness = calculateReadiness(b);
      const hasConflicts = conflictMap.has(b.id) && conflictMap.get(b.id).length > 0;

      // Metric tab shortcut filtering
      if (activeMetricTab === 'upcoming' && bDateStr < todayStr) return false;
      if (activeMetricTab === 'today' && bDateStr !== todayStr) return false;
      if (activeMetricTab === 'preparing' && b.eventStatus !== 'PREPARING' && !['CONFIRMED', 'PREPARATION'].includes(b.status))
        return false;
      if (activeMetricTab === 'attention' && !hasConflicts && !readiness.needsAttention && b.assignedCoordinatorId)
        return false;

      // Event Type
      if (filterEventType && b.eventType !== filterEventType) return false;

      // Event Status
      if (filterEventStatus && (b.eventStatus || 'SCHEDULED') !== filterEventStatus) return false;

      // Coordinator / Staff
      if (filterCoordinator && b.assignedCoordinatorId !== filterCoordinator) return false;

      // Readiness
      if (filterReadiness === 'ready' && readiness.score < 100) return false;
      if (filterReadiness === 'in_progress' && (readiness.score <= 20 || readiness.score >= 100)) return false;
      if (filterReadiness === 'attention' && !readiness.needsAttention && !hasConflicts) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchRef = b.reference?.toLowerCase().includes(q);
        const matchTitle = b.title?.toLowerCase().includes(q);
        const matchCust = b.customer?.fullName?.toLowerCase().includes(q);
        const matchLoc = b.locationName?.toLowerCase().includes(q) || b.city?.toLowerCase().includes(q);
        if (!matchRef && !matchTitle && !matchCust && !matchLoc) return false;
      }

      return true;
    });
  }, [
    activeScopeBookings,
    activeMetricTab,
    filterEventType,
    filterEventStatus,
    filterCoordinator,
    filterReadiness,
    searchTerm,
    calculateReadiness,
    conflictMap
  ]);

  // List View Pagination
  const [listPage, setListPage] = useState(1);
  const LIST_ITEMS_PER_PAGE = 10;
  const totalListPages = Math.ceil(filteredBookings.length / LIST_ITEMS_PER_PAGE) || 1;
  const paginatedListBookings = useMemo(() => {
    const start = (listPage - 1) * LIST_ITEMS_PER_PAGE;
    return filteredBookings.slice(start, start + LIST_ITEMS_PER_PAGE);
  }, [filteredBookings, listPage, LIST_ITEMS_PER_PAGE]);

  useEffect(() => {
    setListPage(1);
  }, [activeMetricTab, filterEventType, filterEventStatus, filterCoordinator, filterReadiness, searchTerm, eventScope]);

  // Group events by date for calendar render
  const eventsByDate = useMemo(() => {
    const map = new Map();
    filteredBookings.forEach((b) => {
      const dStr = toISODate(b.preferredDate);
      if (!dStr) return;
      if (!map.has(dStr)) map.set(dStr, []);
      map.get(dStr).push(b);
    });
    return map;
  }, [filteredBookings]);

  // Selected Day's Events for Agenda panel
  const selectedDayEvents = useMemo(() => {
    const dStr = toISODate(selectedDate);
    return eventsByDate.get(dStr) || [];
  }, [eventsByDate, selectedDate]);

  // Tentative inquiries on selected date (for informative notification when in Confirmed mode)
  const dayTentativeInquiries = useMemo(() => {
    const dStr = toISODate(selectedDate);
    return tentativeBookings.filter((b) => toISODate(b.preferredDate) === dStr);
  }, [selectedDate, tentativeBookings]);

  // Next 5 upcoming events across system (strictly confirmed by default)
  const nextUpcomingEvents = useMemo(() => {
    const todayStr = toISODate(new Date());
    return [...activeScopeBookings]
      .filter((b) => toISODate(b.preferredDate) >= todayStr && b.status !== 'CANCELLED')
      .sort((a, b) => new Date(a.preferredDate) - new Date(b.preferredDate))
      .slice(0, 5);
  }, [activeScopeBookings]);

  // Eligible Bookings for Create / Schedule Modal (prioritizes confirmed bookings)
  const eligibleBookingsForScheduling = useMemo(() => {
    return [...bookings]
      .filter((b) => b.status !== 'CANCELLED' && b.eventStatus !== 'COMPLETED')
      .sort((a, b) => {
        const aConf = isConfirmedEvent(a) ? 1 : 0;
        const bConf = isConfirmedEvent(b) ? 1 : 0;
        if (aConf !== bConf) return bConf - aConf;
        return new Date(a.preferredDate) - new Date(b.preferredDate);
      });
  }, [bookings]);

  // 6. Calendar Date Math
  const getDaysInMonthGrid = useCallback((year, month) => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday-based week index (0 = Monday, 6 = Sunday)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days = [];

    // Preceding month trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Following month leading days (fill up to 35 or 42 grid cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, []);

  const calendarDays = useMemo(() => {
    return getDaysInMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
  }, [currentDate, getDaysInMonthGrid]);

  // Week view days (7 days centered around currentDate)
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    let dayOfWeek = curr.getDay() - 1;
    if (dayOfWeek === -1) dayOfWeek = 6;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - dayOfWeek);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Navigation handlers
  const handlePrevPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() - 7);
      setCurrentDate(next);
    } else if (viewMode === 'day') {
      const next = new Date(selectedDate);
      next.setDate(next.getDate() - 1);
      setSelectedDate(next);
      setCurrentDate(next);
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      setCurrentDate(next);
    } else if (viewMode === 'day') {
      const next = new Date(selectedDate);
      next.setDate(next.getDate() + 1);
      setSelectedDate(next);
      setCurrentDate(next);
    }
  };

  const handleTodayShortcut = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterEventType('');
    setFilterEventStatus('');
    setFilterCoordinator('');
    setFilterReadiness('all');
    setActiveMetricTab(null);
    setEventScope('confirmed');
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedRef(id);
    toast.success(`Copied: ${text}`);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  // 7. Actions: Create / Schedule Event Submit
  const handleOpenCreateModal = (presetBooking = null) => {
    if (presetBooking) {
      setCreateMode('existing');
      setSelectedExistingBookingId(presetBooking.id);
      setCreateForm({
        title: presetBooking.title || '',
        eventType: presetBooking.eventType || 'WEDDING',
        preferredDate: toISODate(presetBooking.preferredDate) || toISODate(selectedDate),
        startTime: presetBooking.startTime ? new Date(presetBooking.startTime).toTimeString().substring(0, 5) : '10:00',
        endTime: presetBooking.endTime ? new Date(presetBooking.endTime).toTimeString().substring(0, 5) : '18:00',
        setupStartTime: presetBooking.setupStartTime ? new Date(presetBooking.setupStartTime).toTimeString().substring(0, 5) : '08:00',
        teardownEndTime: presetBooking.teardownEndTime ? new Date(presetBooking.teardownEndTime).toTimeString().substring(0, 5) : '20:00',
        locationName: presetBooking.locationName || '',
        locationAddress: presetBooking.locationAddress || '',
        city: presetBooking.city || 'Addis Ababa',
        guestCount: presetBooking.guestCount || 100,
        assignedCoordinatorId: presetBooking.assignedCoordinatorId || '',
        notes: ''
      });
    } else {
      setCreateMode('existing');
      setSelectedExistingBookingId('');
      setCreateForm({
        title: '',
        eventType: 'WEDDING',
        preferredDate: toISODate(selectedDate) || toISODate(new Date()),
        startTime: '10:00',
        endTime: '18:00',
        setupStartTime: '08:00',
        teardownEndTime: '20:00',
        locationName: '',
        locationAddress: '',
        city: 'Addis Ababa',
        guestCount: 100,
        assignedCoordinatorId: user?.id || '',
        notes: ''
      });
    }
    setCreateStep(1);
    setCreateModalOpen(true);
  };

  // When existing booking is selected in dropdown, prefill form
  const handleSelectExistingBooking = (bookingId) => {
    setSelectedExistingBookingId(bookingId);
    const b = bookings.find((item) => item.id === bookingId);
    if (!b) return;

    setCreateForm({
      title: b.title || '',
      eventType: b.eventType || 'WEDDING',
      preferredDate: toISODate(b.preferredDate) || toISODate(selectedDate),
      startTime: b.startTime ? new Date(b.startTime).toTimeString().substring(0, 5) : '10:00',
      endTime: b.endTime ? new Date(b.endTime).toTimeString().substring(0, 5) : '18:00',
      setupStartTime: b.setupStartTime ? new Date(b.setupStartTime).toTimeString().substring(0, 5) : '08:00',
      teardownEndTime: b.teardownEndTime ? new Date(b.teardownEndTime).toTimeString().substring(0, 5) : '20:00',
      locationName: b.locationName || '',
      locationAddress: b.locationAddress || '',
      city: b.city || 'Addis Ababa',
      guestCount: b.guestCount || 100,
      assignedCoordinatorId: b.assignedCoordinatorId || user?.id || '',
      notes: ''
    });
  };

  const handleSubmitScheduleEvent = async (e) => {
    e.preventDefault();
    try {
      setSubmittingCreate(true);

      // Validate times
      if (createForm.endTime <= createForm.startTime) {
        toast.error('End time must be after event start time.');
        setSubmittingCreate(false);
        return;
      }

      const prefDate = createForm.preferredDate;
      const startDateTime = new Date(`${prefDate}T${createForm.startTime}:00`);
      const endDateTime = new Date(`${prefDate}T${createForm.endTime}:00`);
      const setupDateTime = createForm.setupStartTime ? new Date(`${prefDate}T${createForm.setupStartTime}:00`) : null;
      const teardownDateTime = createForm.teardownEndTime ? new Date(`${prefDate}T${createForm.teardownEndTime}:00`) : null;

      if (createMode === 'existing' && selectedExistingBookingId) {
        // Update existing booking schedule
        await api.updateEventSchedule(selectedExistingBookingId, {
          title: createForm.title,
          eventType: createForm.eventType,
          preferredDate: new Date(prefDate),
          startTime: startDateTime,
          endTime: endDateTime,
          setupStartTime: setupDateTime,
          teardownEndTime: teardownDateTime,
          locationName: createForm.locationName,
          locationAddress: createForm.locationAddress,
          guestCount: parseInt(createForm.guestCount, 10),
          eventStatus: 'SCHEDULED',
          assignedCoordinatorId: createForm.assignedCoordinatorId || null
        });

        toast.success(`Event schedule updated for booking: ${createForm.title}`);
      } else {
        // Create new booking directly
        await api.createBooking({
          title: createForm.title,
          eventType: createForm.eventType,
          preferredDate: prefDate,
          startTime: startDateTime,
          endTime: endDateTime,
          locationName: createForm.locationName,
          locationAddress: createForm.locationAddress,
          city: createForm.city || 'Addis Ababa',
          guestCount: parseInt(createForm.guestCount, 10),
          specialRequirements: createForm.notes
        });

        toast.success(`New event created and scheduled: ${createForm.title}`);
      }

      setCreateModalOpen(false);
      await loadData(true);
    } catch (err) {
      console.error('Failed to schedule event:', err);
      toast.error(err.message || 'Failed to schedule event.');
    } finally {
      setSubmittingCreate(false);
    }
  };

  // 8. Actions: Edit Schedule Quick Modal
  const handleOpenEditSchedule = (b) => {
    setEditScheduleModal({ open: true, booking: b });
    setEditForm({
      title: b.title || '',
      eventType: b.eventType || 'WEDDING',
      preferredDate: toISODate(b.preferredDate),
      startTime: b.startTime ? new Date(b.startTime).toTimeString().substring(0, 5) : '10:00',
      endTime: b.endTime ? new Date(b.endTime).toTimeString().substring(0, 5) : '18:00',
      setupStartTime: b.setupStartTime ? new Date(b.setupStartTime).toTimeString().substring(0, 5) : '08:00',
      teardownEndTime: b.teardownEndTime ? new Date(b.teardownEndTime).toTimeString().substring(0, 5) : '20:00',
      locationName: b.locationName || '',
      locationAddress: b.locationAddress || '',
      guestCount: b.guestCount || 100,
      eventStatus: b.eventStatus || 'SCHEDULED',
      assignedCoordinatorId: b.assignedCoordinatorId || ''
    });
  };

  const handleSubmitEditSchedule = async (e) => {
    e.preventDefault();
    if (!editScheduleModal.booking) return;
    try {
      setSubmittingEdit(true);

      const prefDate = editForm.preferredDate;
      const startDateTime = editForm.startTime ? new Date(`${prefDate}T${editForm.startTime}:00`) : null;
      const endDateTime = editForm.endTime ? new Date(`${prefDate}T${editForm.endTime}:00`) : null;
      const setupDateTime = editForm.setupStartTime ? new Date(`${prefDate}T${editForm.setupStartTime}:00`) : null;
      const teardownDateTime = editForm.teardownEndTime ? new Date(`${prefDate}T${editForm.teardownEndTime}:00`) : null;

      await api.updateEventSchedule(editScheduleModal.booking.id, {
        title: editForm.title,
        eventType: editForm.eventType,
        preferredDate: new Date(prefDate),
        startTime: startDateTime,
        endTime: endDateTime,
        setupStartTime: setupDateTime,
        teardownEndTime: teardownDateTime,
        locationName: editForm.locationName,
        locationAddress: editForm.locationAddress,
        guestCount: parseInt(editForm.guestCount, 10),
        eventStatus: editForm.eventStatus,
        assignedCoordinatorId: editForm.assignedCoordinatorId || null
      });

      toast.success('Event timeline updated successfully.');
      setEditScheduleModal({ open: false, booking: null });
      await loadData(true);

      // Refresh drawer if active
      if (selectedBookingId === editScheduleModal.booking.id) {
        const res = await api.getBookingById(selectedBookingId);
        if (res?.data?.booking) setSelectedBookingDetails(res.data.booking);
      }
    } catch (err) {
      console.error('Error updating schedule:', err);
      toast.error(err.message || 'Failed to update schedule.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // 9. Actions: Milestone Toggle & Add
  const handleToggleMilestone = async (milestoneId, currentStatus) => {
    try {
      await api.updateMilestone(milestoneId, { isCompleted: !currentStatus });
      toast.success('Milestone runsheet updated.');
      if (selectedBookingId) {
        const res = await api.getBookingById(selectedBookingId);
        if (res?.data?.booking) setSelectedBookingDetails(res.data.booking);
      }
      loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to update milestone.');
    }
  };

  const handleAddMilestoneSubmit = async (e) => {
    e.preventDefault();
    if (!addMilestoneModal.bookingId || !newMilestoneForm.title.trim()) return;
    try {
      await api.addBookingMilestone(addMilestoneModal.bookingId, {
        title: newMilestoneForm.title.trim(),
        targetDate: newMilestoneForm.targetDate || new Date().toISOString(),
        order: parseInt(newMilestoneForm.order, 10) || 1
      });
      toast.success('Milestone added to runsheet.');
      setAddMilestoneModal({ open: false, bookingId: null });
      setNewMilestoneForm({ title: '', targetDate: '', order: 1 });
      if (selectedBookingId) {
        const res = await api.getBookingById(selectedBookingId);
        if (res?.data?.booking) setSelectedBookingDetails(res.data.booking);
      }
      loadData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to add milestone.');
    }
  };

  // Format month and year label
  const periodLabel = useMemo(() => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week') {
      const first = weekDays[0];
      const last = weekDays[6];
      if (first.getMonth() === last.getMonth()) {
        return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
      }
      return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return 'Full Events Schedule Registry';
  }, [viewMode, currentDate, weekDays, selectedDate]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans antialiased text-slate-800">
      {/* =========================================================
          1. PAGE HEADER: Breadcrumb, Title & Primary Actions
          ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <Link to="/company/dashboard" className="hover:text-[#F50046] transition-colors">
              Company Portal
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Events & Schedule</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Events & Schedule
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Plan event timelines, coordinate resources, and track event preparation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Refresh schedule registry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F50046]' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            onClick={handleTodayShortcut}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Today</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F50046] hover:bg-[#d9003f] text-white text-xs font-bold rounded-xl shadow-sm shadow-[#F50046]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Event</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          2. SUMMARY CARDS: 4 Compact Metrics
          ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Upcoming Events */}
        <button
          onClick={() => setActiveMetricTab((prev) => (prev === 'upcoming' ? null : 'upcoming'))}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeMetricTab === 'upcoming'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeMetricTab === 'upcoming' ? 'text-slate-300' : 'text-slate-500'}`}>
              Upcoming Events
            </span>
            <CalendarCheck className={`w-4 h-4 ${activeMetricTab === 'upcoming' ? 'text-slate-300' : 'text-blue-500'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{summaryMetrics.upcoming}</div>
          <p className={`text-[11px] mt-1.5 font-medium ${activeMetricTab === 'upcoming' ? 'text-slate-300' : 'text-slate-400'}`}>
            Scheduled future events
          </p>
        </button>

        {/* Metric 2: Today's Events */}
        <button
          onClick={() => {
            setActiveMetricTab((prev) => (prev === 'today' ? null : 'today'));
            handleTodayShortcut();
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeMetricTab === 'today'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-blue-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeMetricTab === 'today' ? 'text-blue-100' : 'text-blue-600'}`}>
              Today's Events
            </span>
            <Clock className={`w-4 h-4 ${activeMetricTab === 'today' ? 'text-blue-100' : 'text-blue-600'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{summaryMetrics.today}</div>
          <p className={`text-[11px] mt-1.5 font-medium ${activeMetricTab === 'today' ? 'text-blue-100' : 'text-slate-400'}`}>
            Executing on current date
          </p>
        </button>

        {/* Metric 3: In Preparation */}
        <button
          onClick={() => setActiveMetricTab((prev) => (prev === 'preparing' ? null : 'preparing'))}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeMetricTab === 'preparing'
              ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-amber-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeMetricTab === 'preparing' ? 'text-amber-100' : 'text-amber-600'}`}>
              In Preparation
            </span>
            <Briefcase className={`w-4 h-4 ${activeMetricTab === 'preparing' ? 'text-amber-100' : 'text-amber-500'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{summaryMetrics.inPreparation}</div>
          <p className={`text-[11px] mt-1.5 font-medium ${activeMetricTab === 'preparing' ? 'text-amber-100' : 'text-slate-400'}`}>
            Logistics & vendor staging
          </p>
        </button>

        {/* Metric 4: Needs Attention */}
        <button
          onClick={() => setActiveMetricTab((prev) => (prev === 'attention' ? null : 'attention'))}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeMetricTab === 'attention'
              ? 'bg-[#F50046] text-white border-[#F50046] shadow-md ring-2 ring-[#F50046]/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-rose-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeMetricTab === 'attention' ? 'text-rose-100' : 'text-[#F50046]'}`}>
              Needs Attention
            </span>
            <AlertCircle className={`w-4 h-4 ${activeMetricTab === 'attention' ? 'text-rose-100' : 'text-[#F50046]'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{summaryMetrics.needsAttention}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${activeMetricTab === 'attention' ? 'text-rose-100' : 'text-slate-400'}`}>
            Conflicts or missing items
          </p>
        </button>
      </div>

      {/* =========================================================
          3. FILTER BAR & VIEW TOGGLES
          ========================================================= */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* View mode buttons */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/70 self-start">
            {['month', 'week', 'day', 'list'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer ${
                  viewMode === mode
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Calendar Period Navigation */}
          <div className="flex items-center justify-between lg:justify-center gap-2">
            <button
              onClick={handlePrevPeriod}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200/80 cursor-pointer"
              title="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold text-slate-900 px-2 min-w-[170px] text-center">
              {periodLabel}
            </div>
            <button
              onClick={handleNextPeriod}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200/80 cursor-pointer"
              title="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search event, customer, ref, or venue..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50/80 border border-slate-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F50046]/20 focus:border-[#F50046] transition-all"
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

        {/* Second row of compact filters */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
          {/* Operational Scope Toggle: Confirmed Events vs All Inquiries */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80 mr-1 shrink-0">
            <button
              type="button"
              onClick={() => setEventScope('confirmed')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                eventScope === 'confirmed'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Only show officially confirmed events (signed contracts & verified deposits)"
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${eventScope === 'confirmed' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Confirmed Events ({confirmedBookings.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setEventScope('all')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                eventScope === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Include unconfirmed booking requests and tentative inquiries"
            >
              <span>Include Tentative Inquiries ({bookings.filter((b) => b.status !== 'CANCELLED' && b.eventStatus !== 'CANCELLED').length})</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px] mr-1">
            <Filter className="w-3 h-3" />
            <span>Filters:</span>
          </div>

          {/* Event Type Filter */}
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-[#F50046]"
          >
            <option value="">All Event Types</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Event Status Filter */}
          <select
            value={filterEventStatus}
            onChange={(e) => setFilterEventStatus(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-[#F50046]"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PREPARING">In Preparation</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Coordinator Filter */}
          <select
            value={filterCoordinator}
            onChange={(e) => setFilterCoordinator(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-[#F50046]"
          >
            <option value="">All Coordinators</option>
            {staffMembers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.role})
              </option>
            ))}
          </select>

          {/* Readiness Filter */}
          <select
            value={filterReadiness}
            onChange={(e) => setFilterReadiness(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-[#F50046]"
          >
            <option value="all">All Readiness Levels</option>
            <option value="ready">Fully Ready (100%)</option>
            <option value="in_progress">In Progress (20-80%)</option>
            <option value="attention">Needs Attention / Conflicts</option>
          </select>

          {(searchTerm || filterEventType || filterEventStatus || filterCoordinator || filterReadiness !== 'all' || activeMetricTab || eventScope !== 'confirmed') && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F50046] hover:underline ml-auto cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================
          4. MAIN VIEW LAYOUT: Calendar / Schedule + Selected Day Agenda
          ========================================================= */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 space-y-4 animate-pulse">
          <div className="h-8 bg-slate-100 rounded-xl w-1/4"></div>
          <div className="grid grid-cols-7 gap-2">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-50 rounded-xl border border-slate-100"></div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center text-rose-800">
          <AlertCircle className="w-8 h-8 text-[#F50046] mx-auto mb-2" />
          <h3 className="text-base font-bold text-rose-900">Failed to Load Schedule Registry</h3>
          <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => loadData()}
            className="mt-4 px-4 py-2 bg-[#F50046] text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Area: Month, Week, Day or List */}
          <div className={viewMode === 'list' ? 'lg:col-span-12' : 'lg:col-span-8 xl:col-span-8'}>
            {/* -------------------- MONTH VIEW -------------------- */}
            {viewMode === 'month' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                {/* 7-column Weekday Headers */}
                <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-50/80 text-center py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>

                {/* Day Grid Cells */}
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                  {calendarDays.map((dayItem, idx) => {
                    const dStr = toISODate(dayItem.date);
                    const dayEvents = eventsByDate.get(dStr) || [];
                    const isSelected = toISODate(selectedDate) === dStr;
                    const isToday = toISODate(new Date()) === dStr;

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedDate(dayItem.date)}
                        className={`min-h-[105px] sm:min-h-[115px] p-1.5 sm:p-2 transition-all flex flex-col justify-between cursor-pointer ${
                          !dayItem.isCurrentMonth ? 'bg-slate-50/40 text-slate-300' : 'bg-white text-slate-800'
                        } ${isSelected ? 'ring-2 ring-inset ring-[#F50046] bg-rose-50/20' : 'hover:bg-slate-50/60'}`}
                      >
                        {/* Day header: Date number and indicators */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${
                              isToday
                                ? 'bg-[#F50046] text-white shadow-2xs font-extrabold'
                                : isSelected
                                ? 'bg-slate-900 text-white'
                                : dayItem.isCurrentMonth
                                ? 'text-slate-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {dayItem.date.getDate()}
                          </span>

                          {/* Multiple events counter badge */}
                          {dayEvents.length > 1 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {dayEvents.length} events
                            </span>
                          )}
                        </div>

                        {/* Events Pills inside Day Cell */}
                        <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                          {dayEvents.slice(0, 2).map((ev) => {
                            const hasConflict = conflictMap.has(ev.id);
                            const isConfirmed = isConfirmedEvent(ev);
                            const stConfig = EVENT_STATUS_CONFIG[ev.eventStatus || 'SCHEDULED'] || EVENT_STATUS_CONFIG.SCHEDULED;

                            return (
                              <div
                                key={ev.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBookingId(ev.id);
                                }}
                                className={`text-[11px] p-1 rounded-md border truncate font-medium flex items-center gap-1 transition-transform hover:scale-[1.02] cursor-pointer ${
                                  hasConflict
                                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                                    : !isConfirmed
                                    ? 'bg-amber-50/70 border-dashed border-amber-300 text-amber-900'
                                    : 'bg-slate-50 border-slate-200/90 hover:bg-white text-slate-800 shadow-2xs'
                                }`}
                                title={`${ev.title} (${formatTime(ev.startTime)})${!isConfirmed ? ' - Tentative Inquiry' : ''}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${!isConfirmed ? 'bg-amber-400' : stConfig.dot}`}></span>
                                {hasConflict && <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                                <span className="font-semibold text-slate-500 shrink-0 text-[10px]">
                                  {ev.startTime ? formatTime(ev.startTime).split(' ')[0] : ''}
                                </span>
                                <span className="truncate">{ev.title}</span>
                                {!isConfirmed && (
                                  <span className="text-[9px] font-bold text-amber-600 shrink-0 ml-auto">Tentative</span>
                                )}
                              </div>
                            );
                          })}

                          {dayEvents.length > 2 && (
                            <div className="text-[10px] text-slate-500 font-bold text-center py-0.5 bg-slate-100/60 rounded">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* -------------------- WEEK VIEW -------------------- */}
            {viewMode === 'week' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-50 text-center py-3">
                  {weekDays.map((d, i) => {
                    const isToday = toISODate(d) === toISODate(new Date());
                    const isSelected = toISODate(d) === toISODate(selectedDate);
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedDate(d)}
                        className={`cursor-pointer transition-colors p-1 ${isSelected ? 'text-[#F50046]' : 'text-slate-600'}`}
                      >
                        <div className="text-[11px] font-semibold uppercase">
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div
                          className={`text-base font-black mx-auto w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
                            isToday ? 'bg-[#F50046] text-white' : isSelected ? 'bg-slate-900 text-white' : 'text-slate-800'
                          }`}
                        >
                          {d.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 7 Columns Content */}
                <div className="grid grid-cols-7 divide-x divide-slate-100 min-h-[420px]">
                  {weekDays.map((d, i) => {
                    const dStr = toISODate(d);
                    const dayEvents = eventsByDate.get(dStr) || [];

                    return (
                      <div key={i} className="p-2 space-y-2 bg-slate-50/20">
                        {dayEvents.length === 0 ? (
                          <div className="text-[11px] text-slate-300 font-medium text-center py-8">
                            No events
                          </div>
                        ) : (
                          dayEvents.map((ev) => {
                            const hasConflict = conflictMap.has(ev.id);
                            const isConfirmed = isConfirmedEvent(ev);
                            const readiness = calculateReadiness(ev);

                            return (
                              <div
                                key={ev.id}
                                onClick={() => setSelectedBookingId(ev.id)}
                                className={`p-2.5 rounded-xl border text-left space-y-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-sm ${
                                  hasConflict
                                    ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                                    : !isConfirmed
                                    ? 'bg-amber-50/50 border-dashed border-amber-300'
                                    : 'bg-white border-slate-200/80 hover:border-[#F50046]/40'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-slate-500">
                                    {formatTime(ev.startTime)}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {!isConfirmed && (
                                      <span className="px-1 py-0.2 rounded font-bold bg-amber-100 text-amber-800 text-[8px]">
                                        Tentative
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700 text-[9px]">
                                      {EVENT_TYPE_LABELS[ev.eventType] || ev.eventType}
                                    </span>
                                  </div>
                                </div>
                                <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                                  {ev.title}
                                </h4>
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate">
                                  <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{ev.locationName || 'Venue TBD'}</span>
                                </div>

                                {/* Readiness Mini Bar */}
                                <div className="pt-1">
                                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium mb-0.5">
                                    <span>Readiness</span>
                                    <span className="font-bold text-slate-700">{readiness.score}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        readiness.score === 100
                                          ? 'bg-emerald-500'
                                          : readiness.score >= 60
                                          ? 'bg-blue-500'
                                          : 'bg-amber-500'
                                      }`}
                                      style={{ width: `${readiness.score}%` }}
                                    ></div>
                                  </div>
                                </div>

                                {hasConflict && (
                                  <div className="text-[9px] font-bold text-amber-800 bg-amber-100/70 p-1 rounded flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-amber-700" />
                                    <span>Resource Conflict</span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* -------------------- DAY VIEW -------------------- */}
            {viewMode === 'day' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-bold text-[#F50046] uppercase tracking-wider">
                      Operational Day Runsheet
                    </span>
                    <h2 className="text-lg font-black text-slate-900">
                      {formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </h2>
                  </div>
                  <button
                    onClick={() => handleOpenCreateModal()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F50046] text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Schedule on this Day</span>
                  </button>
                </div>

                {selectedDayEvents.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <Calendar className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                    <p className="text-sm font-bold text-slate-700">
                      No {eventScope === 'confirmed' ? 'confirmed ' : ''}events scheduled for this day.
                    </p>
                    <p className="text-xs text-slate-400">All coordinators and resources are currently free.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDayEvents.map((ev) => {
                      const readiness = calculateReadiness(ev);
                      const hasConflict = conflictMap.has(ev.id);
                      const isConfirmed = isConfirmedEvent(ev);
                      const stConfig = EVENT_STATUS_CONFIG[ev.eventStatus || 'SCHEDULED'] || EVENT_STATUS_CONFIG.SCHEDULED;

                      return (
                        <div
                          key={ev.id}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                            hasConflict
                              ? 'bg-amber-50/60 border-amber-300'
                              : !isConfirmed
                              ? 'bg-amber-50/30 border-dashed border-amber-300'
                              : 'bg-slate-50/60 border-slate-200/80 hover:bg-white'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {!isConfirmed && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    Tentative Inquiry
                                  </span>
                                )}
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${stConfig.badge}`}>
                                  {stConfig.label}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  {EVENT_TYPE_LABELS[ev.eventType] || ev.eventType}
                                </span>
                                <span className="text-xs font-bold text-slate-500 font-mono">
                                  {ev.reference}
                                </span>
                              </div>
                              <h3 className="text-base font-extrabold text-slate-900 mt-1">{ev.title}</h3>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleOpenEditSchedule(ev)}
                                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                              >
                                Edit Times
                              </button>
                              <button
                                onClick={() => setSelectedBookingId(ev.id)}
                                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 cursor-pointer"
                              >
                                Full Details
                              </button>
                            </div>
                          </div>

                          {/* Time breakdown cards */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 text-xs">
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 font-semibold block">Setup Window</span>
                              <span className="font-bold text-slate-800">
                                {ev.setupStartTime ? formatTime(ev.setupStartTime) : '08:00 AM'}
                              </span>
                            </div>
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 font-semibold block">Event Start & End</span>
                              <span className="font-bold text-blue-700">
                                {formatTime(ev.startTime)} - {formatTime(ev.endTime)}
                              </span>
                            </div>
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 font-semibold block">Teardown</span>
                              <span className="font-bold text-slate-800">
                                {ev.teardownEndTime ? formatTime(ev.teardownEndTime) : '10:00 PM'}
                              </span>
                            </div>
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 font-semibold block">Guests / Scale</span>
                              <span className="font-bold text-slate-800">{ev.guestCount} Attendees</span>
                            </div>
                          </div>

                          {/* Venue & Coordinator Info */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium">{ev.locationName || 'Venue Address TBD'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">Coordinator:</span>
                              <span className="font-bold text-slate-800">
                                {ev.assignedCoordinator?.fullName || 'Unassigned'}
                              </span>
                              <span className="text-slate-300">|</span>
                              <span className="font-bold text-slate-700">Readiness: {readiness.score}%</span>
                            </div>
                          </div>

                          {hasConflict && (
                            <div className="mt-3 p-2.5 bg-amber-100 border border-amber-300 rounded-xl text-xs text-amber-900 font-semibold space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>Conflict Warnings Detected on This Date:</span>
                              </div>
                              <ul className="list-disc list-inside text-[11px] font-medium space-y-0.5">
                                {conflictMap.get(ev.id).map((cMsg, cIdx) => (
                                  <li key={cIdx}>{cMsg}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* -------------------- LIST VIEW -------------------- */}
            {viewMode === 'list' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Event & Ref</th>
                        <th className="py-3 px-4">Type & Guests</th>
                        <th className="py-3 px-4">Date & Timing</th>
                        <th className="py-3 px-4">Venue</th>
                        <th className="py-3 px-4">Coordinator</th>
                        <th className="py-3 px-4">Readiness</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBookings.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="py-12 text-center text-slate-400">
                            No events match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        paginatedListBookings.map((b) => {
                          const readiness = calculateReadiness(b);
                          const hasConflict = conflictMap.has(b.id);
                          const stConfig = EVENT_STATUS_CONFIG[b.eventStatus || 'SCHEDULED'] || EVENT_STATUS_CONFIG.SCHEDULED;

                          return (
                            <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{b.title}</div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                                  <span>{b.reference}</span>
                                  <button
                                    onClick={() => copyToClipboard(b.reference, b.id)}
                                    className="hover:text-slate-600"
                                    title="Copy reference"
                                  >
                                    {copiedRef === b.id ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {EVENT_TYPE_LABELS[b.eventType] || b.eventType}
                                </span>
                                <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                                  {b.guestCount} guests
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-800">{formatDate(b.preferredDate)}</div>
                                <div className="text-[10px] text-slate-500 font-medium">
                                  {formatTime(b.startTime)} - {formatTime(b.endTime)}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-800 truncate max-w-[150px]">
                                  {b.locationName || 'TBD'}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                  {b.city || 'Addis Ababa'}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800">
                                  {b.assignedCoordinator?.fullName || (
                                    <span className="text-amber-600 font-bold">Unassigned</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {b.staffAssignments?.length || 0} crew assigned
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        readiness.score === 100
                                          ? 'bg-emerald-500'
                                          : readiness.score >= 60
                                          ? 'bg-blue-500'
                                          : 'bg-amber-500'
                                      }`}
                                      style={{ width: `${readiness.score}%` }}
                                    ></div>
                                  </div>
                                  <span className="font-bold text-[11px] text-slate-700">{readiness.score}%</span>
                                </div>
                                {hasConflict && (
                                  <span className="text-[9px] font-bold text-amber-600 flex items-center gap-0.5 mt-0.5">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Conflict
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${stConfig.badge}`}>
                                    {stConfig.label}
                                  </span>
                                  {!isConfirmedEvent(b) && (
                                    <span className="block px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                                      Tentative
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditSchedule(b)}
                                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="Edit schedule"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setSelectedBookingId(b.id)}
                                    className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                                  >
                                    View
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* List View Pagination Footer */}
                {filteredBookings.length > 0 && (
                  <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                    <span className="text-[11px] font-medium text-slate-500">
                      Showing {(listPage - 1) * LIST_ITEMS_PER_PAGE + 1}–{Math.min(listPage * LIST_ITEMS_PER_PAGE, filteredBookings.length)} of {filteredBookings.length} events
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setListPage((p) => Math.max(1, p - 1))}
                        disabled={listPage === 1}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs cursor-pointer"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalListPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            onClick={() => setListPage(p)}
                            className={`w-6 h-6 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                              listPage === p
                                ? 'bg-[#F50046] text-white shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setListPage((p) => Math.min(totalListPages, p + 1))}
                        disabled={listPage === totalListPages}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Secondary Area: Selected Day Agenda & Upcoming Panel (For Month & Week Views) */}
          {viewMode !== 'list' && (
            <div className="lg:col-span-4 xl:col-span-4 space-y-5">
              {/* Card 1: Selected Day Agenda */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-[#F50046] uppercase tracking-wider block">
                      Selected Day Agenda
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {formatDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                    {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'event' : 'events'}
                  </span>
                </div>

                {selectedDayEvents.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 space-y-2">
                    <Calendar className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                    <p className="text-xs font-bold text-slate-600">
                      No {eventScope === 'confirmed' ? 'confirmed ' : ''}events on this date
                    </p>
                    <p className="text-[11px] text-slate-400">Venue, staff, and partners are open.</p>
                    <button
                      onClick={() => handleOpenCreateModal()}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-[#F50046]" />
                      <span>Schedule Event</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDayEvents.map((ev) => {
                      const readiness = calculateReadiness(ev);
                      const hasConflict = conflictMap.has(ev.id);
                      const isConfirmed = isConfirmedEvent(ev);
                      const stConfig = EVENT_STATUS_CONFIG[ev.eventStatus || 'SCHEDULED'] || EVENT_STATUS_CONFIG.SCHEDULED;

                      return (
                        <div
                          key={ev.id}
                          className={`p-3.5 rounded-xl border text-left space-y-2 transition-all ${
                            hasConflict
                              ? 'bg-amber-50/80 border-amber-300'
                              : !isConfirmed
                              ? 'bg-amber-50/40 border-dashed border-amber-300'
                              : 'bg-slate-50/60 border-slate-200/80 hover:border-slate-300 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-blue-700 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {formatTime(ev.startTime)} - {formatTime(ev.endTime)}
                            </span>
                            <div className="flex items-center gap-1">
                              {!isConfirmed && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Tentative
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${stConfig.badge}`}>
                                {stConfig.label}
                              </span>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-slate-900 leading-tight">{ev.title}</h4>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{ev.locationName || 'Venue TBD'}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/50">
                            <span className="text-slate-500">
                              Coord: <strong className="text-slate-800">{ev.assignedCoordinator?.fullName?.split(' ')[0] || 'None'}</strong>
                            </span>
                            <span className="text-slate-700 font-bold">
                              {readiness.score}% Ready
                            </span>
                          </div>

                          {hasConflict && (
                            <div className="text-[10px] font-bold text-amber-900 bg-amber-100 p-1.5 rounded-lg flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                              <span>Scheduling Conflict Detected</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => setSelectedBookingId(ev.id)}
                              className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer text-center"
                            >
                              Inspect Details
                            </button>
                            <button
                              onClick={() => handleOpenEditSchedule(ev)}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
                              title="Edit time"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Informative notice if tentative inquiries exist on this date when in Confirmed scope */}
                {eventScope === 'confirmed' && dayTentativeInquiries.length > 0 && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-left space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{dayTentativeInquiries.length} Tentative Inquiry on this date</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setEventScope('all')}
                        className="text-[10px] font-bold text-[#F50046] hover:underline cursor-pointer"
                      >
                        Show on Calendar
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-700 leading-normal">
                      Unconfirmed requests (pending quotation, contract, or deposit) do not block resources until confirmed.
                    </p>
                    <div className="pt-0.5 space-y-1">
                      {dayTentativeInquiries.slice(0, 2).map((item) => (
                        <Link
                          key={item.id}
                          to={`/company/bookings?search=${item.reference}`}
                          className="flex items-center justify-between py-1 px-2 rounded-lg bg-white/70 hover:bg-amber-100/60 text-[11px] text-slate-800 transition-colors border border-amber-200/50"
                        >
                          <span className="font-semibold truncate">{item.reference} • {item.title}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Upcoming Master Schedule */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Next Upcoming Events
                    </h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Confirmed
                    </span>
                  </div>
                  <Link
                    to="/company/bookings"
                    className="text-[11px] font-bold text-[#F50046] hover:underline"
                  >
                    View All Bookings
                  </Link>
                </div>

                <div className="divide-y divide-slate-100">
                  {nextUpcomingEvents.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center font-medium">
                      No upcoming confirmed events scheduled.
                    </p>
                  ) : (
                    nextUpcomingEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => {
                          setSelectedBookingId(ev.id);
                          if (ev.preferredDate) setSelectedDate(new Date(ev.preferredDate));
                        }}
                        className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{ev.title}</h4>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 font-medium">
                            <span>{formatDate(ev.preferredDate)}</span>
                            <span>•</span>
                            <span>{ev.locationName || 'Addis Ababa'}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          5. SELECTED EVENT DETAILS DRAWER (Slide-in Right Panel)
          ========================================================= */}
      {selectedBookingId && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedBookingId(null)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-200/80 bg-slate-50 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                      {selectedBookingDetails?.reference || 'Loading...'}
                    </span>
                    {selectedBookingDetails && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-[#F50046] border border-rose-200">
                        {EVENT_TYPE_LABELS[selectedBookingDetails.eventType] || selectedBookingDetails.eventType}
                      </span>
                    )}
                    {selectedBookingDetails && (
                      isConfirmedEvent(selectedBookingDetails) ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Confirmed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Tentative
                        </span>
                      )
                    )}
                  </div>
                  <h2 className="text-lg font-black text-slate-900 mt-1">
                    {selectedBookingDetails?.title || 'Event Details'}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {selectedBookingDetails && (
                    <button
                      onClick={() => handleOpenEditSchedule(selectedBookingDetails)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Edit Timeline
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedBookingId(null)}
                    className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Tabs */}
              <div className="flex items-center gap-1 px-5 border-b border-slate-200 bg-white overflow-x-auto text-xs font-bold">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'booking', label: 'Client & Links' },
                  { id: 'schedule', label: 'Milestones & Runsheet' },
                  { id: 'partners', label: 'Services & Partners' },
                  { id: 'staff', label: 'Staff & Tasks' },
                  { id: 'resources', label: 'Equipment & Inventory' },
                  { id: 'readiness', label: 'Readiness & Audit' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setDrawerTab(t.id)}
                    className={`py-3 px-2.5 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                      drawerTab === t.id
                        ? 'border-[#F50046] text-[#F50046]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Drawer Body Content */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {loadingDetails || !selectedBookingDetails ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-6 bg-slate-100 rounded w-1/3"></div>
                    <div className="h-20 bg-slate-50 rounded-xl"></div>
                    <div className="h-40 bg-slate-50 rounded-xl"></div>
                  </div>
                ) : (
                  <>
                    {/* TAB 1: OVERVIEW */}
                    {drawerTab === 'overview' && (
                      <div className="space-y-5">
                        {/* Conflict Banner if applicable */}
                        {conflictMap.has(selectedBookingDetails.id) && (
                          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold">
                              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                              <span>Scheduling Attention Required</span>
                            </div>
                            <ul className="list-disc list-inside text-[11px] font-medium space-y-0.5">
                              {conflictMap.get(selectedBookingDetails.id).map((m, idx) => (
                                <li key={idx}>{m}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Timing Overview Grid */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Event Execution Timeline
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 font-medium block">Date</span>
                              <span className="font-bold text-slate-800">
                                {formatDate(selectedBookingDetails.preferredDate)}
                              </span>
                            </div>
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 font-medium block">Setup Starts</span>
                              <span className="font-bold text-slate-800">
                                {selectedBookingDetails.setupStartTime
                                  ? formatTime(selectedBookingDetails.setupStartTime)
                                  : '08:00 AM'}
                              </span>
                            </div>
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 font-medium block">Event Hours</span>
                              <span className="font-bold text-blue-700">
                                {formatTime(selectedBookingDetails.startTime)} – {formatTime(selectedBookingDetails.endTime)}
                              </span>
                            </div>
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 font-medium block">Teardown Closes</span>
                              <span className="font-bold text-slate-800">
                                {selectedBookingDetails.teardownEndTime
                                  ? formatTime(selectedBookingDetails.teardownEndTime)
                                  : '10:00 PM'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Venue & Location */}
                        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-2">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Venue & Attendance
                          </h4>
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-[#F50046] shrink-0 mt-0.5" />
                            <div>
                              <div className="font-bold text-slate-900 text-sm">
                                {selectedBookingDetails.locationName || 'Venue Unassigned'}
                              </div>
                              <div className="text-xs text-slate-500">
                                {selectedBookingDetails.locationAddress || 'Addis Ababa, Ethiopia'}
                              </div>
                              <div className="text-xs font-medium text-slate-700 mt-1">
                                Registered Scale: <strong>{selectedBookingDetails.guestCount} Attendees</strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Status & Financial Position */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                              Status & Commercial Position
                            </h4>
                            {isConfirmedEvent(selectedBookingDetails) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Confirmed Event
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                Unconfirmed Request
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2.5">
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 block font-medium">Booking Status</span>
                              <span className="font-bold text-slate-800 text-xs">
                                {selectedBookingDetails.status || 'REQUESTED'}
                              </span>
                            </div>
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 block font-medium">Execution Status</span>
                              <span className="font-bold text-slate-800 text-xs">
                                {selectedBookingDetails.eventStatus || 'SCHEDULED'}
                              </span>
                            </div>
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                              <span className="text-[10px] text-slate-400 block font-medium">Payment Position</span>
                              <span className="font-bold text-slate-800 text-xs">
                                {selectedBookingDetails.paymentPosition || 'UNPAID'}
                              </span>
                            </div>
                          </div>

                          {!isConfirmedEvent(selectedBookingDetails) && (
                            <div className="p-3 bg-amber-100/70 border border-amber-200 rounded-xl space-y-1 mt-2">
                              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>Pre-Confirmation Booking Request</span>
                              </div>
                              <p className="text-[11px] text-amber-800 leading-normal">
                                This booking has not been confirmed yet. Master contract signing and initial 50% payment verification are required before operational delivery.
                              </p>
                              <Link
                                to={`/company/bookings?search=${selectedBookingDetails.reference}`}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F50046] hover:underline pt-1"
                              >
                                <span>Open Booking Request ({selectedBookingDetails.reference}) →</span>
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 2: CLIENT & BOOKING */}
                    {drawerTab === 'booking' && (
                      <div className="space-y-4 text-xs">
                        {/* Customer Information */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Client Details
                          </h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-400" />
                              <span className="font-bold text-slate-800">
                                {selectedBookingDetails.customer?.fullName || 'Client Name'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-600">{selectedBookingDetails.customer?.email || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-600">{selectedBookingDetails.customer?.phone || 'N/A'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Navigation Links to Linked Entities */}
                        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-3">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Linked Contracts & Quotations
                          </h4>
                          <div className="space-y-2">
                            <Link
                              to={`/company/bookings?search=${selectedBookingDetails.reference}`}
                              className="p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <CalendarCheck className="w-4 h-4 text-[#F50046]" />
                                <div>
                                  <div className="font-bold text-slate-800">Booking Request</div>
                                  <div className="text-[10px] text-slate-400">Ref: {selectedBookingDetails.reference}</div>
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            </Link>

                            <Link
                              to={`/company/quotations?bookingId=${selectedBookingDetails.id}`}
                              className="p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                                <div>
                                  <div className="font-bold text-slate-800">Accepted Quotation</div>
                                  <div className="text-[10px] text-slate-400">
                                    {selectedBookingDetails.quotations?.[0]
                                      ? `v${selectedBookingDetails.quotations[0].version} (${selectedBookingDetails.quotations[0].status})`
                                      : 'Prepare or inspect quotation'}
                                  </div>
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            </Link>

                            <Link
                              to={`/company/contracts?bookingId=${selectedBookingDetails.id}`}
                              className="p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <FileText className="w-4 h-4 text-emerald-600" />
                                <div>
                                  <div className="font-bold text-slate-800">Master Service Contract</div>
                                  <div className="text-[10px] text-slate-400">
                                    {selectedBookingDetails.contracts?.[0]
                                      ? `Version ${selectedBookingDetails.contracts[0].version} (${selectedBookingDetails.contracts[0].status})`
                                      : 'Contract execution'}
                                  </div>
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: MILESTONES & RUNSHEET */}
                    {drawerTab === 'schedule' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Event Runsheet & Milestones
                          </h4>
                          <button
                            onClick={() => {
                              setNewMilestoneForm({
                                title: '',
                                targetDate: toISODate(selectedBookingDetails.preferredDate),
                                order: (selectedBookingDetails.milestones?.length || 0) + 1
                              });
                              setAddMilestoneModal({ open: true, bookingId: selectedBookingDetails.id });
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#F50046] hover:underline cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Milestone</span>
                          </button>
                        </div>

                        {(!selectedBookingDetails.milestones || selectedBookingDetails.milestones.length === 0) ? (
                          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                            <Clock className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                            <p className="text-xs font-bold text-slate-700">No Runsheet Milestones Recorded</p>
                            <p className="text-[11px] text-slate-400">
                              Establish milestones for vendor setup, arrival, and service stages.
                            </p>
                            <button
                              onClick={() => {
                                setNewMilestoneForm({
                                  title: 'Venue Setup & Soundcheck',
                                  targetDate: toISODate(selectedBookingDetails.preferredDate),
                                  order: 1
                                });
                                setAddMilestoneModal({ open: true, bookingId: selectedBookingDetails.id });
                              }}
                              className="mt-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                            >
                              Initialize Default Runsheet
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {selectedBookingDetails.milestones.map((m) => (
                              <div
                                key={m.id}
                                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                  m.isCompleted ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200/80'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(m.isCompleted)}
                                    onChange={() => handleToggleMilestone(m.id, m.isCompleted)}
                                    className="w-4 h-4 text-[#F50046] rounded focus:ring-0 cursor-pointer"
                                  />
                                  <div>
                                    <div className={`font-bold ${m.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                      {m.title}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      Target: {formatDate(m.targetDate)} • Sequence #{m.order}
                                    </div>
                                  </div>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    m.isCompleted
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {m.isCompleted ? 'Completed' : 'Pending'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 4: SERVICES & PARTNERS */}
                    {drawerTab === 'partners' && (
                      <div className="space-y-4 text-xs">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Contracted Services & Assigned Partners
                          </h4>
                          <Link
                            to="/company/partners"
                            className="text-xs font-bold text-[#F50046] hover:underline"
                          >
                            Partner Directory
                          </Link>
                        </div>

                        {(!selectedBookingDetails.partnerAssignments || selectedBookingDetails.partnerAssignments.length === 0) ? (
                          <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                            <Briefcase className="w-7 h-7 mx-auto text-slate-300 stroke-1" />
                            <p className="text-xs font-bold text-slate-700">No External Partners Formally Assigned</p>
                            <p className="text-[11px] text-slate-400">
                              Assign catering, sound, floral, photography, or transportation partners.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {selectedBookingDetails.partnerAssignments.map((pa) => (
                              <div
                                key={pa.id}
                                className="p-3.5 rounded-xl border border-slate-200/80 bg-white space-y-1.5 shadow-2xs"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="font-bold text-slate-800 text-sm">
                                    {pa.partner?.businessName || pa.partner?.companyName || 'Assigned Partner'}
                                  </div>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {pa.status || 'CONFIRMED'}
                                  </span>
                                </div>
                                <div className="text-slate-500 text-xs">
                                  Contact: {pa.partner?.contactPerson || 'N/A'} • {pa.partner?.phone || 'N/A'}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Shift: {formatTime(pa.startTime)} – {formatTime(pa.endTime)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Booking items list */}
                        {selectedBookingDetails.items && selectedBookingDetails.items.length > 0 && (
                          <div className="pt-3 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                              Contracted Service Riders ({selectedBookingDetails.items.length})
                            </span>
                            <div className="space-y-1.5">
                              {selectedBookingDetails.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-between"
                                >
                                  <span className="font-medium text-slate-800">{item.service?.name || 'Service Rider'}</span>
                                  <span className="text-[10px] text-slate-500 font-semibold uppercase">
                                    {item.service?.category}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 5: STAFF & TASKS */}
                    {drawerTab === 'staff' && (
                      <div className="space-y-4 text-xs">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Operational Field Team
                          </h4>
                          <Link
                            to="/company/tasks"
                            className="text-xs font-bold text-[#F50046] hover:underline"
                          >
                            Staff Tasks Board
                          </Link>
                        </div>

                        {/* Coordinator Card */}
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                              {selectedBookingDetails.assignedCoordinator?.fullName?.charAt(0) || 'C'}
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                                Lead Event Coordinator
                              </span>
                              <span className="font-bold text-slate-800 text-sm">
                                {selectedBookingDetails.assignedCoordinator?.fullName || 'Not Yet Assigned'}
                              </span>
                            </div>
                          </div>
                          {selectedBookingDetails.assignedCoordinator?.phone && (
                            <span className="text-slate-600 font-mono text-[11px]">
                              {selectedBookingDetails.assignedCoordinator.phone}
                            </span>
                          )}
                        </div>

                        {/* Field Staff Assignments */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Assigned Field Crew ({selectedBookingDetails.staffAssignments?.length || 0})
                          </span>

                          {(!selectedBookingDetails.staffAssignments || selectedBookingDetails.staffAssignments.length === 0) ? (
                            <p className="text-xs text-slate-400 italic">No field crew assigned yet.</p>
                          ) : (
                            selectedBookingDetails.staffAssignments.map((sa) => (
                              <div
                                key={sa.id}
                                className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-slate-800">{sa.staff?.fullName || 'Crew Member'}</div>
                                  <div className="text-[10px] text-slate-400">{sa.role}</div>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {formatTime(sa.startTime)} - {formatTime(sa.endTime)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 6: RESOURCES & INVENTORY */}
                    {drawerTab === 'resources' && (
                      <div className="space-y-4 text-xs">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Reserved Equipment & Assets
                          </h4>
                          <span className="text-xs text-slate-400">
                            {selectedBookingDetails.inventoryReservations?.length || 0} Assets Allocated
                          </span>
                        </div>

                        {(!selectedBookingDetails.inventoryReservations || selectedBookingDetails.inventoryReservations.length === 0) ? (
                          <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-1">
                            <Package className="w-7 h-7 mx-auto text-slate-300 stroke-1" />
                            <p className="text-xs font-bold text-slate-700">No Warehouse Assets Reserved</p>
                            <p className="text-[11px] text-slate-400">
                              Tents, stage platforms, PA sound systems, and chairs are reserved via Inventory module.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {selectedBookingDetails.inventoryReservations.map((ir) => (
                              <div
                                key={ir.id}
                                className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-slate-800">{ir.inventoryItem?.name || 'Asset Item'}</div>
                                  <div className="text-[10px] text-slate-400">
                                    Category: {ir.inventoryItem?.category || 'General'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-xs">
                                    Qty: {ir.quantityReserved}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 7: READINESS & AUDIT */}
                    {drawerTab === 'readiness' && (
                      <div className="space-y-5 text-xs">
                        {/* Readiness Score Breakdown */}
                        {(() => {
                          const r = calculateReadiness(selectedBookingDetails);
                          return (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                  Readiness Compliance Score
                                </span>
                                <span className="text-sm font-black text-slate-900">{r.score}%</span>
                              </div>

                              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    r.score === 100
                                      ? 'bg-emerald-500'
                                      : r.score >= 60
                                      ? 'bg-blue-600'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${r.score}%` }}
                                ></div>
                              </div>

                              <div className="divide-y divide-slate-200/70 pt-2">
                                {r.items.map((item, idx) => (
                                  <div key={idx} className="py-2 flex items-center justify-between">
                                    <span className="font-medium text-slate-700">{item.name}</span>
                                    {item.satisfied ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Ready (+{item.weight}%)</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                        <AlertTriangle className="w-3 h-3 text-[#F50046]" />
                                        <span>Pending (0%)</span>
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Audit / Status History */}
                        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-3">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Lifecycle Activity History
                          </h4>
                          {(!selectedBookingDetails.statusHistory || selectedBookingDetails.statusHistory.length === 0) ? (
                            <p className="text-xs text-slate-400">No activity history recorded.</p>
                          ) : (
                            <div className="space-y-3">
                              {selectedBookingDetails.statusHistory.map((h) => (
                                <div key={h.id} className="flex items-start gap-2.5 text-xs">
                                  <span className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 shrink-0"></span>
                                  <div>
                                    <div className="font-bold text-slate-800">
                                      Transitioned to {h.newStatus}
                                    </div>
                                    <div className="text-[10px] text-slate-500">{h.reason || 'Workflow update'}</div>
                                    <div className="text-[10px] text-slate-400">{formatDate(h.createdAt)}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          6. CREATE / SCHEDULE EVENT MODAL
          ========================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden font-sans">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#F50046] uppercase tracking-wider">
                  Event Coordination & Production
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                  Create / Schedule Event
                </h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitScheduleEvent} className="p-5 sm:p-6 space-y-4 text-xs">
              {/* Mode Selection */}
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setCreateMode('existing')}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    createMode === 'existing'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Schedule from Existing Booking
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode('new');
                    setSelectedExistingBookingId('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    createMode === 'new'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Create New Event
                </button>
              </div>

              {/* Existing Booking Selector */}
              {createMode === 'existing' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Select Booking / Inquiry <span className="text-[#F50046]">*</span>
                  </label>
                  <select
                    value={selectedExistingBookingId}
                    onChange={(e) => handleSelectExistingBooking(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#F50046] font-medium"
                  >
                    <option value="">-- Choose an eligible booking to schedule --</option>
                    {eligibleBookingsForScheduling.map((b) => {
                      const isConf = isConfirmedEvent(b);
                      return (
                        <option key={b.id} value={b.id}>
                          {b.reference} — {b.title} ({b.customer?.fullName || 'Client'}, {formatDate(b.preferredDate)}) {isConf ? '✓ [Confirmed]' : '• [Tentative Inquiry]'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Event Title & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Event Title <span className="text-[#F50046]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="e.g. Almaz & Dawit Wedding"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#F50046]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Event Type <span className="text-[#F50046]">*</span>
                  </label>
                  <select
                    value={createForm.eventType}
                    onChange={(e) => setCreateForm({ ...createForm, eventType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#F50046]"
                  >
                    {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Core Times */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Scheduled Date <span className="text-[#F50046]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.preferredDate}
                    onChange={(e) => setCreateForm({ ...createForm, preferredDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#F50046]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Start Time <span className="text-[#F50046]">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#F50046]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    End Time <span className="text-[#F50046]">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={createForm.endTime}
                    onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#F50046]"
                  />
                </div>
              </div>

              {/* Setup & Teardown Times */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Setup Commencement
                  </label>
                  <input
                    type="time"
                    value={createForm.setupStartTime}
                    onChange={(e) => setCreateForm({ ...createForm, setupStartTime: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Teardown Completion
                  </label>
                  <input
                    type="time"
                    value={createForm.teardownEndTime}
                    onChange={(e) => setCreateForm({ ...createForm, teardownEndTime: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Venue & Guest Count */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Venue / Hall Name <span className="text-[#F50046]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.locationName}
                    onChange={(e) => setCreateForm({ ...createForm, locationName: e.target.value })}
                    placeholder="e.g. Ethiopian Skylight Hotel, Grand Ballroom"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#F50046]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Expected Guests
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={createForm.guestCount}
                    onChange={(e) => setCreateForm({ ...createForm, guestCount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#F50046]"
                  />
                </div>
              </div>

              {/* Coordinator Assignment */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Assigned Lead Coordinator
                </label>
                <select
                  value={createForm.assignedCoordinatorId}
                  onChange={(e) => setCreateForm({ ...createForm, assignedCoordinatorId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#F50046]"
                >
                  <option value="">-- Select Event Coordinator --</option>
                  {staffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-5 py-2 bg-[#F50046] hover:bg-[#d9003f] text-white font-bold rounded-xl transition-all shadow-sm shadow-[#F50046]/20 cursor-pointer disabled:opacity-60"
                >
                  {submittingCreate ? 'Saving Schedule...' : 'Save & Schedule Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          7. EDIT SCHEDULE MODAL
          ========================================================= */}
      {editScheduleModal.open && editScheduleModal.booking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden font-sans">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#F50046] uppercase tracking-wider">
                  Operational Schedule
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Edit Event Schedule: {editScheduleModal.booking.reference}
                </h3>
              </div>
              <button
                onClick={() => setEditScheduleModal({ open: false, booking: null })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditSchedule} className="p-5 sm:p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#F50046]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editForm.preferredDate}
                    onChange={(e) => setEditForm({ ...editForm, preferredDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Setup Start</label>
                  <input
                    type="time"
                    value={editForm.setupStartTime}
                    onChange={(e) => setEditForm({ ...editForm, setupStartTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teardown End</label>
                  <input
                    type="time"
                    value={editForm.teardownEndTime}
                    onChange={(e) => setEditForm({ ...editForm, teardownEndTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Venue Location</label>
                  <input
                    type="text"
                    value={editForm.locationName}
                    onChange={(e) => setEditForm({ ...editForm, locationName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Event Status</label>
                  <select
                    value={editForm.eventStatus}
                    onChange={(e) => setEditForm({ ...editForm, eventStatus: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="PREPARING">In Preparation</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Coordinator</label>
                <select
                  value={editForm.assignedCoordinatorId}
                  onChange={(e) => setEditForm({ ...editForm, assignedCoordinatorId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">-- Unassigned --</option>
                  {staffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditScheduleModal({ open: false, booking: null })}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-60"
                >
                  {submittingEdit ? 'Saving...' : 'Update Timeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          8. ADD MILESTONE MODAL
          ========================================================= */}
      {addMilestoneModal.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Add Milestone to Runsheet</h3>
              <button
                onClick={() => setAddMilestoneModal({ open: false, bookingId: null })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMilestoneSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Milestone Activity Name <span className="text-[#F50046]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Floral Stage Assembly & Lighting Check"
                  value={newMilestoneForm.title}
                  onChange={(e) => setNewMilestoneForm({ ...newMilestoneForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={newMilestoneForm.targetDate}
                    onChange={(e) => setNewMilestoneForm({ ...newMilestoneForm, targetDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Runsheet Order</label>
                  <input
                    type="number"
                    min="1"
                    value={newMilestoneForm.order}
                    onChange={(e) => setNewMilestoneForm({ ...newMilestoneForm, order: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddMilestoneModal({ open: false, bookingId: null })}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#F50046] text-white rounded-xl font-bold shadow-sm"
                >
                  Add Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

