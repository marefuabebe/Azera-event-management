import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Phone,
  Building,
  User,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  ArrowRight,
  ExternalLink,
  FileText,
  Lock,
  ListTodo,
  CheckSquare,
  Square,
  X,
  MessageSquare,
  RefreshCw,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Info,
  CalendarDays,
  UserCheck,
  Copy,
  Check,
  ClipboardCheck,
  UserX,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const METHOD_CONFIG = {
  OFFICE_MEETING: { label: 'In Person (Office)', icon: Building, color: 'bg-slate-100 text-slate-800 border-slate-200' },
  VENUE_VISIT: { label: 'Venue Site Visit', icon: MapPin, color: 'bg-slate-100 text-slate-800 border-slate-200' },
  PHONE_CALL: { label: 'Phone Call', icon: Phone, color: 'bg-slate-100 text-slate-800 border-slate-200' },
  VIDEO_CALL: { label: 'Video Meeting', icon: Video, color: 'bg-slate-100 text-slate-800 border-slate-200' },
  OTHER: { label: 'Other Method', icon: Calendar, color: 'bg-slate-100 text-slate-800 border-slate-200' }
};

const STATUS_CONFIG = {
  NEEDS_FOLLOW_UP: {
    label: 'Needs Follow-up',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-300',
    dot: 'bg-amber-500'
  },
  REQUESTED: {
    label: 'Awaiting Confirmation',
    bg: 'bg-rose-50',
    text: 'text-rose-900',
    border: 'border-rose-200',
    dot: 'bg-[#F20047]'
  },
  SCHEDULED: {
    label: 'Scheduled',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
    dot: 'bg-slate-600'
  },
  CONFIRMED: {
    label: 'Confirmed',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
    dot: 'bg-slate-600'
  },
  RESCHEDULE_REQUESTED: {
    label: 'Reschedule Requested',
    bg: 'bg-rose-50',
    text: 'text-rose-900',
    border: 'border-rose-200',
    dot: 'bg-[#F20047]'
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-600'
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400'
  },
  NO_SHOW: {
    label: 'No Show',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    dot: 'bg-rose-500'
  }
};

const isConsultationPastDue = (consultation) => {
  if (!consultation || !consultation.scheduledStartTime) return false;
  const finalStatuses = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
  if (finalStatuses.includes(consultation.status)) return false;
  const endTime = consultation.scheduledEndTime 
    ? new Date(consultation.scheduledEndTime) 
    : new Date(new Date(consultation.scheduledStartTime).getTime() + 60 * 60 * 1000);
  return endTime < new Date();
};

const getEffectiveStatus = (consultation) => {
  if (!consultation) return 'SCHEDULED';
  if (consultation.effectiveStatus) return consultation.effectiveStatus;
  if (isConsultationPastDue(consultation)) return 'NEEDS_FOLLOW_UP';
  return consultation.status || 'SCHEDULED';
};

const formatDateTimeEAT = (dateInput) => {
  if (!dateInput) return 'TBD';
  const d = new Date(dateInput);
  return d.toLocaleString('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }) + ' (EAT)';
};

const StatusBadge = ({ consultation, status }) => {
  const effective = consultation ? getEffectiveStatus(consultation) : (status || 'SCHEDULED');
  let cfg = STATUS_CONFIG[effective] || STATUS_CONFIG.SCHEDULED;

  if (effective === 'NO_SHOW' || consultation?.outcome === 'CUSTOMER_NO_SHOW' || consultation?.outcome === 'COORDINATOR_NO_SHOW') {
    const outcome = consultation?.outcome;
    if (outcome === 'CUSTOMER_NO_SHOW' || consultation?.internalNotes?.includes('CUSTOMER_NO_SHOW') || consultation?.internalNotes?.includes('CUSTOMER_DID_NOT_ATTEND')) {
      cfg = {
        label: 'No-Show (Customer)',
        bg: 'bg-rose-50',
        text: 'text-rose-800',
        border: 'border-rose-200',
        dot: 'bg-rose-500'
      };
    } else if (outcome === 'COORDINATOR_NO_SHOW' || consultation?.internalNotes?.includes('COORDINATOR_NO_SHOW') || consultation?.internalNotes?.includes('COORDINATOR_DID_NOT_ATTEND')) {
      cfg = {
        label: 'No-Show (Coordinator)',
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
      };
    }
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// Genuine Google Meet URL validator (strictly enforces authentic 3-4-3 Google Meet conferences)
const isValidGoogleMeetUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  const official343 = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
  const alias = /^https:\/\/meet\.google\.com\/_meet\/[a-z0-9_-]+$/i;
  return official343.test(trimmed) || alias.test(trimmed);
};

export default function CompanyConsultationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const preselectedBookingId = searchParams.get('bookingId');

  const [consultations, setConsultations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedConsultationId, setSelectedConsultationId] = useState(null);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [copiedRef, setCopiedRef] = useState(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const copyToClipboard = (text, label = 'Reference') => {
    navigator.clipboard.writeText(text);
    setCopiedRef(text);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  // Google Meet and Google Calendar helpers
  const generateFreshMeetLink = async () => {
    try {
      const res = await api.generateGoogleMeetLink();
      if (res.data?.meetingUrl && isValidGoogleMeetUrl(res.data.meetingUrl)) {
        setFormData(prev => ({ ...prev, locationOrLink: res.data.meetingUrl }));
        toast.success('Generated authentic Google Meet conference.');
      } else {
        toast.info(res.data?.message || 'Google Calendar authorization pending. Paste an authentic Google Meet URL.');
      }
    } catch (err) {
      toast.error('Unable to create Google Meet conference: ' + (err.message || 'Authorization required'));
    }
  };

  const getGoogleCalendarUrl = (consultation) => {
    if (consultation?.googleCalendarUrl) return consultation.googleCalendarUrl;
    if (!consultation?.scheduledStartTime) return '#';
    const start = new Date(consultation.scheduledStartTime).toISOString().replace(/-|:|\.\d\d\d/g, '');
    const end = new Date(consultation.scheduledEndTime || new Date(consultation.scheduledStartTime).getTime() + 3600000).toISOString().replace(/-|:|\.\d\d\d/g, '');
    const title = encodeURIComponent(consultation.booking?.title || `Eventora Consultation (${consultation.booking?.reference})`);
    const details = encodeURIComponent(
      `Eventora Client Planning Consultation\nBooking: ${consultation.booking?.reference || ''}\nClient: ${consultation.customer?.fullName || ''}\nGoogle Meet: ${consultation.locationOrLink || ''}`
    );
    const location = encodeURIComponent(consultation.locationOrLink || 'Google Meet');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
  };

  // Tabs & Search Filters
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [formData, setFormData] = useState({
    bookingId: preselectedBookingId || '',
    method: 'OFFICE_MEETING',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '10:00',
    durationMinutes: 60,
    locationOrLink: 'Eventora Headquarters, Morning Star Mall, Bole, Addis Ababa',
    customerVisibleNotes: ''
  });

  // Notes & Tasks State inside Drawer
  const [newNote, setNewNote] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(true);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Outcome Recording Modal State
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [outcomeTargetConsultation, setOutcomeTargetConsultation] = useState(null);
  const [outcomeLoading, setOutcomeLoading] = useState(false);
  const [outcomeType, setOutcomeType] = useState('MEETING_COMPLETED'); // 'MEETING_COMPLETED' | 'CUSTOMER_NO_SHOW' | 'COORDINATOR_NO_SHOW' | 'RESCHEDULE' | 'CANCELLED'
  const [outcomeData, setOutcomeData] = useState({
    discussionSummary: '',
    agreedDecisions: '',
    internalNotes: '',
    reason: '',
    rescheduleDate: new Date().toISOString().split('T')[0],
    rescheduleTime: '10:00',
    durationMinutes: 60,
    rescheduleMethod: 'OFFICE_MEETING',
    rescheduleLocation: '',
    tasks: []
  });
  const [newModalTaskTitle, setNewModalTaskTitle] = useState('');
  const [newModalTaskDueDate, setNewModalTaskDueDate] = useState('');

  // Load consultations and booking references
  const loadData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [consResult, bookResult] = await Promise.allSettled([
        api.getConsultations(),
        api.getAllBookings('?limit=100')
      ]);

      let consultList = [];
      if (consResult.status === 'fulfilled') {
        consultList = consResult.value?.data?.consultations || consResult.value?.data || [];
        setConsultations(consultList);
      } else {
        console.error('Failed to load consultations:', consResult.reason);
        toast.error('Unable to load consultations registry: ' + (consResult.reason?.message || 'Server connection error'));
      }

      if (bookResult.status === 'fulfilled') {
        const bookingList = bookResult.value?.data?.bookings || bookResult.value?.data || [];
        setBookings(bookingList);
      } else {
        console.warn('Failed to load booking references:', bookResult.reason);
      }

      if (preselectedBookingId && consultList.length > 0) {
        const matched = consultList.find(c => c.bookingId === preselectedBookingId);
        if (matched) {
          setSelectedConsultationId(matched.id);
        } else {
          setFormData(prev => ({ ...prev, bookingId: preselectedBookingId }));
          setShowScheduleModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to load consultations data:', err);
      toast.error('Unable to load consultations registry: ' + (err.message || 'Network error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [preselectedBookingId]);

  // Load single consultation details when selected
  useEffect(() => {
    if (!selectedConsultationId) {
      setSelectedConsultation(null);
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        const res = await api.getConsultationById(selectedConsultationId);
        setSelectedConsultation(res.data?.consultation || res.data);
      } catch (err) {
        console.error('Failed to load consultation details:', err);
        toast.error('Failed to load appointment details.');
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [selectedConsultationId]);

  // Metrics calculation
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      total: consultations.length,
      today: consultations.filter(c => c.scheduledStartTime?.startsWith(todayStr)).length,
      awaiting: consultations.filter(c => c.status === 'REQUESTED' || c.status === 'RESCHEDULE_REQUESTED').length,
      needsFollowUp: consultations.filter(c => getEffectiveStatus(c) === 'NEEDS_FOLLOW_UP').length,
      upcoming: consultations.filter(c => ['CONFIRMED', 'SCHEDULED'].includes(c.status) && !isConsultationPastDue(c)).length,
      completed: consultations.filter(c => c.status === 'COMPLETED').length,
      followUp: consultations.filter(c => c.status === 'COMPLETED' && c.followUpTasks?.some(t => !t.isCompleted)).length
    };
  }, [consultations]);

  // Filtered consultations
  const filteredConsultations = useMemo(() => {
    return consultations.filter(c => {
      // Tab Filtering
      if (activeTab === 'needs_follow_up') {
        if (getEffectiveStatus(c) !== 'NEEDS_FOLLOW_UP') return false;
      } else if (activeTab === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (!c.scheduledStartTime?.startsWith(todayStr)) return false;
      } else if (activeTab === 'attention') {
        if (!['REQUESTED', 'RESCHEDULE_REQUESTED'].includes(c.status)) return false;
      } else if (activeTab === 'upcoming') {
        if (!['CONFIRMED', 'SCHEDULED'].includes(c.status) || isConsultationPastDue(c)) return false;
      } else if (activeTab === 'followup') {
        if (c.status !== 'COMPLETED' || !c.followUpTasks?.some(t => !t.isCompleted)) return false;
      } else if (activeTab === 'completed') {
        if (c.status !== 'COMPLETED') return false;
      }

      // Dropdown status filter
      if (filterStatus) {
        if (filterStatus === 'NEEDS_FOLLOW_UP') {
          if (getEffectiveStatus(c) !== 'NEEDS_FOLLOW_UP') return false;
        } else if (c.status !== filterStatus) {
          return false;
        }
      }

      // Method filter
      if (filterMethod && c.method !== filterMethod) return false;

      // Search query
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesRef = (c.booking?.reference || '').toLowerCase().includes(term);
        const matchesCustomer = (c.customer?.fullName || '').toLowerCase().includes(term);
        const matchesTitle = (c.booking?.title || '').toLowerCase().includes(term);
        if (!matchesRef && !matchesCustomer && !matchesTitle) return false;
      }

      return true;
    });
  }, [consultations, activeTab, filterStatus, filterMethod, searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterMethod, filterStatus, activeTab]);

  // Paginated consultations
  const totalPages = Math.max(1, Math.ceil(filteredConsultations.length / pageSize));
  const paginatedConsultations = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredConsultations.slice(start, start + pageSize);
  }, [filteredConsultations, page, pageSize]);

  // Handle Schedule Submit
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setScheduleError('');
    if (!formData.bookingId) {
      setScheduleError('Please select an event booking request.');
      return;
    }

    try {
      setScheduleLoading(true);
      const startDateTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + formData.durationMinutes * 60000);

      const res = await api.scheduleConsultation({
        bookingId: formData.bookingId,
        method: formData.method,
        scheduledStartTime: startDateTime.toISOString(),
        scheduledEndTime: endDateTime.toISOString(),
        locationOrLink: formData.locationOrLink,
        customerVisibleNotes: formData.customerVisibleNotes
      });

      setShowScheduleModal(false);
      toast.success('Consultation appointment scheduled successfully.');
      await loadData(true);
      const newId = res.data?.consultation?.id;
      if (newId) setSelectedConsultationId(newId);
    } catch (err) {
      setScheduleError(err.message || 'Failed to schedule appointment.');
      toast.error(err.message || 'Failed to schedule appointment.');
    } finally {
      setScheduleLoading(false);
    }
  };

  // Handle Add Note
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedConsultation) return;
    try {
      setNoteSubmitting(true);
      await api.addConsultationNote(selectedConsultation.id, {
        content: newNote.trim(),
        isInternalOnly: isInternalNote
      });
      setNewNote('');
      const res = await api.getConsultationById(selectedConsultation.id);
      setSelectedConsultation(res.data?.consultation || res.data);
      loadData(true);
      toast.success(isInternalNote ? 'Private internal note saved.' : 'Customer-visible note recorded.');
    } catch (err) {
      toast.error('Failed to record note: ' + err.message);
    } finally {
      setNoteSubmitting(false);
    }
  };

  // Handle Add Task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedConsultation) return;
    try {
      setTaskSubmitting(true);
      await api.addConsultationTask(selectedConsultation.id, {
        title: newTaskTitle.trim(),
        dueDate: newTaskDueDate || null
      });
      setNewTaskTitle('');
      setNewTaskDueDate('');
      const res = await api.getConsultationById(selectedConsultation.id);
      setSelectedConsultation(res.data?.consultation || res.data);
      loadData(true);
      toast.success('Follow-up task created.');
    } catch (err) {
      toast.error('Failed to add task: ' + err.message);
    } finally {
      setTaskSubmitting(false);
    }
  };

  // Toggle Task Completion
  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      await api.toggleConsultationTask(taskId, !currentStatus);
      const res = await api.getConsultationById(selectedConsultation.id);
      setSelectedConsultation(res.data?.consultation || res.data);
      loadData(true);
      toast.success(!currentStatus ? 'Task marked as completed.' : 'Task reopened.');
    } catch (err) {
      toast.error('Failed to update task: ' + err.message);
    }
  };

  // Status Change Handler
  const handleStatusChange = async (newStatus) => {
    if (!selectedConsultation) return;
    try {
      setStatusUpdating(true);
      await api.updateConsultation(selectedConsultation.id, { status: newStatus });
      const res = await api.getConsultationById(selectedConsultation.id);
      setSelectedConsultation(res.data?.consultation || res.data);
      loadData(true);
      toast.success(`Consultation status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}.`);
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  // Open Outcome Recording Modal
  const openOutcomeModal = (consultation) => {
    if (!consultation) return;
    setOutcomeTargetConsultation(consultation);
    setOutcomeType('MEETING_COMPLETED');
    const existingDecisions = Array.isArray(consultation.agreedDecisions)
      ? consultation.agreedDecisions.join('\n')
      : (consultation.agreedDecisions || '');
    setOutcomeData({
      discussionSummary: consultation.discussionSummary || '',
      agreedDecisions: existingDecisions,
      internalNotes: '',
      reason: '',
      rescheduleDate: new Date().toISOString().split('T')[0],
      rescheduleTime: '10:00',
      durationMinutes: 60,
      rescheduleMethod: consultation.method || 'OFFICE_MEETING',
      rescheduleLocation: consultation.locationOrLink || 'Eventora Headquarters, Morning Star Mall, Bole, Addis Ababa',
      tasks: []
    });
    setNewModalTaskTitle('');
    setNewModalTaskDueDate('');
    setOutcomeModalOpen(true);
  };

  const addModalTask = () => {
    if (!newModalTaskTitle.trim()) return;
    setOutcomeData(prev => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        {
          id: Date.now().toString(),
          title: newModalTaskTitle.trim(),
          dueDate: newModalTaskDueDate || null,
          assignedTo: user?.fullName || 'Coordinator'
        }
      ]
    }));
    setNewModalTaskTitle('');
    setNewModalTaskDueDate('');
  };

  const removeModalTask = (taskId) => {
    setOutcomeData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== taskId)
    }));
  };

  const generateOutcomeMeetLink = async () => {
    try {
      const res = await api.generateGoogleMeetLink();
      if (res.data?.meetingUrl && isValidGoogleMeetUrl(res.data.meetingUrl)) {
        setOutcomeData(prev => ({ ...prev, rescheduleLocation: res.data.meetingUrl }));
        toast.success('Generated authentic Google Meet conference.');
      } else {
        toast.info(res.data?.message || 'Google Calendar authorization pending. Paste an authentic Google Meet URL.');
      }
    } catch (err) {
      toast.error('Unable to create Google Meet conference: ' + (err.message || 'Authorization required'));
    }
  };

  const handleRecordOutcomeSubmit = async (e) => {
    e.preventDefault();
    if (!outcomeTargetConsultation) return;

    try {
      setOutcomeLoading(true);
      const payload = { outcome: outcomeType };

      if (outcomeType === 'MEETING_COMPLETED') {
        if (!outcomeData.discussionSummary.trim()) {
          toast.error('Please enter discussion summary / meeting notes.');
          setOutcomeLoading(false);
          return;
        }
        payload.discussionSummary = outcomeData.discussionSummary.trim();
        payload.agreedDecisions = outcomeData.agreedDecisions;
        payload.notes = outcomeData.internalNotes;
        if (outcomeData.tasks.length > 0) {
          payload.followUpTasks = outcomeData.tasks.map(t => ({
            title: t.title,
            dueDate: t.dueDate || null,
            assignedTo: t.assignedTo || user?.fullName || 'Coordinator'
          }));
        }
      } else if (outcomeType === 'CUSTOMER_NO_SHOW' || outcomeType === 'CUSTOMER_DID_NOT_ATTEND') {
        payload.outcome = 'CUSTOMER_NO_SHOW';
        payload.notes = outcomeData.internalNotes || 'Customer did not attend the scheduled consultation.';
      } else if (outcomeType === 'COORDINATOR_NO_SHOW' || outcomeType === 'COORDINATOR_DID_NOT_ATTEND') {
        payload.outcome = 'COORDINATOR_NO_SHOW';
        payload.notes = outcomeData.internalNotes || 'Coordinator was unable to attend due to an operational conflict.';
      } else if (outcomeType === 'RESCHEDULE') {
        if (!outcomeData.rescheduleDate || !outcomeData.rescheduleTime) {
          toast.error('Please specify a new date and time for rescheduling.');
          setOutcomeLoading(false);
          return;
        }
        const startDateTime = new Date(`${outcomeData.rescheduleDate}T${outcomeData.rescheduleTime}:00`);
        const endDateTime = new Date(startDateTime.getTime() + (Number(outcomeData.durationMinutes) || 60) * 60000);
        payload.scheduledStartTime = startDateTime.toISOString();
        payload.scheduledEndTime = endDateTime.toISOString();
        payload.method = outcomeData.rescheduleMethod;
        payload.locationOrLink = outcomeData.rescheduleLocation;
        payload.reason = outcomeData.reason || outcomeData.internalNotes;
      } else if (outcomeType === 'CANCELLED') {
        payload.reason = outcomeData.reason || 'Consultation cancelled during follow-up review.';
        payload.notes = outcomeData.internalNotes;
      }

      await api.recordConsultationOutcome(outcomeTargetConsultation.id, payload);
      toast.success('Consultation outcome recorded successfully.');
      setOutcomeModalOpen(false);

      await loadData(true);
      if (selectedConsultationId) {
        const res = await api.getConsultationById(selectedConsultationId);
        setSelectedConsultation(res.data?.consultation || res.data);
      }
    } catch (err) {
      console.error('Failed to record consultation outcome:', err);
      toast.error(err.message || 'Failed to record consultation outcome.');
    } finally {
      setOutcomeLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header with Breadcrumb, Title & Global Actions (Consistent with Bookings Page) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <Link to="/company/dashboard" className="hover:text-[#F20047] transition-colors">
              Coordinator Portal
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Consultations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Consultations & Meetings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Schedule customer appointments, conduct venue visits, align requirements, and track follow-up tasks.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Refresh appointments"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#F20047]' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setShowScheduleModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F20047] hover:bg-[#d9003f] text-white text-xs font-bold rounded-xl shadow-sm shadow-[#F20047]/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Consultation</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Key Metric Cards (Matching Coordinator Dashboard styling) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Today's Meetings */}
        <button
          onClick={() => setActiveTab('today')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'today'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeTab === 'today' ? 'text-slate-300' : 'text-slate-500'}`}>
              Today's Meetings
            </span>
            <CalendarCheck className={`w-4 h-4 ${activeTab === 'today' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.today}</div>
          <p className={`text-[11px] mt-1.5 font-medium ${activeTab === 'today' ? 'text-slate-300' : 'text-slate-400'}`}>
            Scheduled appointments today
          </p>
        </button>

        {/* Metric 2: Needs Follow-up (Past Due without outcome recorded) */}
        <button
          onClick={() => setActiveTab('needs_follow_up')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'needs_follow_up'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-500/20'
              : metrics.needsFollowUp > 0
              ? 'bg-amber-50/70 text-amber-950 border-amber-300 hover:border-amber-400 shadow-2xs'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeTab === 'needs_follow_up' ? 'text-amber-100' : 'text-amber-800'}`}>
              Needs Follow-up
            </span>
            <AlertTriangle className={`w-4 h-4 ${activeTab === 'needs_follow_up' ? 'text-amber-100' : 'text-amber-600'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 leading-none ${activeTab === 'needs_follow_up' ? 'text-white' : 'text-amber-900'}`}>
            {metrics.needsFollowUp}
          </div>
          <p className={`text-[11px] font-medium mt-1.5 ${activeTab === 'needs_follow_up' ? 'text-amber-100' : 'text-amber-700'}`}>
            Time concluded, record outcome
          </p>
        </button>

        {/* Metric 3: Awaiting Confirmation */}
        <button
          onClick={() => setActiveTab('attention')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'attention'
              ? 'bg-[#F50046] text-white border-[#F50046] shadow-md ring-2 ring-[#F50046]/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-rose-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeTab === 'attention' ? 'text-rose-100' : 'text-[#F50046]'}`}>
              Awaiting Confirmation
            </span>
            <AlertCircle className={`w-4 h-4 ${activeTab === 'attention' ? 'text-rose-100' : 'text-[#F50046]'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.awaiting}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${activeTab === 'attention' ? 'text-rose-100' : 'text-slate-400'}`}>
            Customer requested slots
          </p>
        </button>

        {/* Metric 4: Upcoming Meetings */}
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'upcoming'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeTab === 'upcoming' ? 'text-slate-300' : 'text-slate-500'}`}>
              Upcoming Meetings
            </span>
            <CheckCircle2 className={`w-4 h-4 ${activeTab === 'upcoming' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.upcoming}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${activeTab === 'upcoming' ? 'text-slate-300' : 'text-slate-400'}`}>
            Confirmed future appointments
          </p>
        </button>

        {/* Metric 5: Follow-up Tasks */}
        <button
          onClick={() => setActiveTab('followup')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'followup'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${activeTab === 'followup' ? 'text-slate-300' : 'text-slate-500'}`}>
              Follow-up Tasks
            </span>
            <ListTodo className={`w-4 h-4 ${activeTab === 'followup' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2 leading-none">{metrics.followUp}</div>
          <p className={`text-[11px] font-medium mt-1.5 ${activeTab === 'followup' ? 'text-slate-300' : 'text-slate-400'}`}>
            Meetings with pending tasks
          </p>
        </button>
      </div>

      {/* 3. Filter Tabs + Search & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden border-b border-slate-100">
          {[
            { id: 'all', label: 'All Consultations', count: metrics.total },
            { id: 'needs_follow_up', label: 'Needs Follow-up', count: metrics.needsFollowUp, amberHighlight: true },
            { id: 'today', label: 'Today', count: metrics.today },
            { id: 'attention', label: 'Needs Confirmation', count: metrics.awaiting, highlight: true },
            { id: 'upcoming', label: 'Upcoming Confirmed', count: metrics.upcoming },
            { id: 'followup', label: 'Follow-up Tasks', count: metrics.followUp },
            { id: 'completed', label: 'Completed History', count: metrics.completed }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setFilterStatus('');
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? tab.amberHighlight
                      ? 'bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs'
                      : 'bg-[#FFF0F4] text-[#F20047] border border-rose-200 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isActive
                      ? tab.amberHighlight
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#F20047] text-white'
                      : tab.amberHighlight && tab.count > 0
                      ? 'bg-amber-200 text-amber-900'
                      : tab.highlight && tab.count > 0
                      ? 'bg-rose-100 text-[#F20047]'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by customer name, booking reference, or event title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047] transition-all"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
            >
              <option value="">All Meeting Methods</option>
              <option value="OFFICE_MEETING">In Person (Office Meeting)</option>
              <option value="VENUE_VISIT">Venue Site Visit</option>
              <option value="PHONE_CALL">Phone Call</option>
              <option value="VIDEO_CALL">Video Meeting</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
            >
              <option value="">All Appointment Statuses</option>
              <option value="NEEDS_FOLLOW_UP">Needs Follow-up (Outcome Pending)</option>
              <option value="REQUESTED">Awaiting Confirmation</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="RESCHEDULE_REQUESTED">Reschedule Requested</option>
              <option value="COMPLETED">Completed</option>
              <option value="NO_SHOW">No Show</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Appointment List (Full width cards, highly legible) */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200/80 shadow-2xs">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#F20047] mb-2" />
            <p className="text-xs font-medium text-slate-600">Loading consultations registry...</p>
          </div>
        ) : filteredConsultations.length === 0 ? (
          <div className="bg-white p-16 text-center rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No appointments found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No consultations match your selected filter tab or search criteria.
            </p>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#F20047] hover:bg-[#d9003f] text-white text-xs font-bold rounded-xl shadow-sm shadow-[#F20047]/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Consultation</span>
            </button>
          </div>
        ) : (
          paginatedConsultations.map((c) => {
            const method = METHOD_CONFIG[c.method] || METHOD_CONFIG.OFFICE_MEETING;
            const MethodIcon = method.icon;
            const isSelected = selectedConsultationId === c.id;
            const startDate = new Date(c.scheduledStartTime);

            return (
              <div
                key={c.id}
                onClick={() => setSelectedConsultationId(c.id)}
                className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer hover:shadow-md ${
                  isSelected ? 'border-[#F20047] ring-2 ring-[#F20047]/10' : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Date Badge + Content */}
                  <div className="flex items-start gap-4">
                    {/* Modern Date Tile */}
                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {startDate.toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-xl font-black leading-none">{startDate.getDate()}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {c.booking?.title || 'Event Planning Consultation'}
                        </h3>
                        <StatusBadge consultation={c} />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 mt-1">
                        <span className="font-semibold text-slate-900">{c.customer?.fullName}</span>
                        <span className="text-slate-300">•</span>
                        <div className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/70">
                          <span>{c.booking?.reference}</span>
                          {c.booking?.reference && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(c.booking.reference, 'Booking Reference');
                              }}
                              className="text-slate-400 hover:text-slate-700"
                              title="Copy reference"
                            >
                              {copiedRef === c.booking.reference ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                        {c.booking?.preferredDate && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">
                              Event Target: {new Date(c.booking.preferredDate).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${method.color}`}>
                          <MethodIcon className="w-3 h-3" />
                          {method.label}
                        </span>
                        {c.locationOrLink && (
                          <span className="truncate max-w-[240px] text-slate-500">
                            {c.locationOrLink}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {getEffectiveStatus(c) === 'NEEDS_FOLLOW_UP' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openOutcomeModal(c);
                        }}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>Record Outcome</span>
                      </button>
                    )}
                    {c.method === 'VIDEO_CALL' && c.locationOrLink && !isConsultationPastDue(c) && (
                      <a
                        href={c.locationOrLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
                        title="Launch Google Meet"
                      >
                        <Video className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden lg:inline">Meet</span>
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConsultationId(c.id);
                      }}
                      className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Details</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/company/bookings?bookingId=${c.bookingId}`);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold transition-colors"
                      title="Open connected booking"
                    >
                      Booking
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Pagination Controls */}
        {filteredConsultations.length > 0 && !loading && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-3 text-slate-500 font-medium">
              <span>
                Showing <strong className="text-slate-800">{(page - 1) * pageSize + 1}</strong>–
                <strong className="text-slate-800">{Math.min(page * pageSize, filteredConsultations.length)}</strong> of{' '}
                <strong className="text-slate-800">{filteredConsultations.length}</strong> appointments
              </span>
              <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                <span className="text-[11px] text-slate-400">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-hidden"
                >
                  <option value={6}>6</option>
                  <option value={8}>8</option>
                  <option value={16}>16</option>
                  <option value={24}>24</option>
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
                            ? 'bg-[#F20047] text-white shadow-2xs'
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

      {/* 5. Slide-Over Inspection Drawer (Identical right-side slide-over mechanism to CompanyBookingsPage) */}
      {selectedConsultationId && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                  <span>{selectedConsultation?.booking?.reference || 'Consultation'}</span>
                  {selectedConsultation?.booking?.reference && (
                    <button
                      onClick={() => copyToClipboard(selectedConsultation.booking.reference, 'Booking Reference')}
                      className="text-slate-400 hover:text-slate-700"
                      title="Copy reference"
                    >
                      {copiedRef === selectedConsultation.booking.reference ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
                <StatusBadge consultation={selectedConsultation} />
              </div>
              <button
                onClick={() => setSelectedConsultationId(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
              {loadingDetails ? (
                <div className="py-20 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#F20047] mb-2" />
                  <p className="text-xs font-medium text-slate-600">Loading consultation details...</p>
                </div>
              ) : selectedConsultation ? (
                <>
                  {/* Title & Meeting Window */}
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {selectedConsultation.booking?.title || 'Client Planning Consultation'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDateTimeEAT(selectedConsultation.scheduledStartTime)}</span>
                    </div>
                  </div>

                  {/* Needs Follow-up Outcome Action Bar / Status Transitions */}
                  {getEffectiveStatus(selectedConsultation) === 'NEEDS_FOLLOW_UP' ? (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 space-y-3 shadow-2xs">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide">
                              Appointment Concluded — Needs Follow-up
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                              Outcome Pending
                            </span>
                          </div>
                          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                            The scheduled appointment time has passed ({formatDateTimeEAT(selectedConsultation.scheduledStartTime)}). Record the meeting outcome below to document discussions, assign follow-up tasks, reschedule, or notify the customer.
                          </p>
                        </div>
                      </div>
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => openOutcomeModal(selectedConsultation)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <ClipboardCheck className="w-4 h-4" />
                          <span>Record Outcome</span>
                        </button>
                      </div>
                    </div>
                  ) : selectedConsultation.status === 'COMPLETED' ? (
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Meeting Completed & Documented</span>
                      </div>
                      <button
                        onClick={() => openOutcomeModal(selectedConsultation)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold rounded-lg cursor-pointer"
                      >
                        Update Outcome / Notes
                      </button>
                    </div>
                  ) : selectedConsultation.status === 'NO_SHOW' ? (
                    <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                      selectedConsultation.outcome === 'COORDINATOR_NO_SHOW' || selectedConsultation.internalNotes?.includes('COORDINATOR')
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-rose-50 border-rose-200'
                    }`}>
                      <div className={`flex items-center gap-2 font-bold ${
                        selectedConsultation.outcome === 'COORDINATOR_NO_SHOW' || selectedConsultation.internalNotes?.includes('COORDINATOR')
                          ? 'text-amber-800'
                          : 'text-rose-800'
                      }`}>
                        <AlertCircle className={`w-4 h-4 ${
                          selectedConsultation.outcome === 'COORDINATOR_NO_SHOW' || selectedConsultation.internalNotes?.includes('COORDINATOR')
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`} />
                        <span>
                          {selectedConsultation.outcome === 'COORDINATOR_NO_SHOW' || selectedConsultation.internalNotes?.includes('COORDINATOR')
                            ? 'No-Show: Coordinator Absent'
                            : 'No-Show: Customer Absent'}
                        </span>
                      </div>
                      <button
                        onClick={() => openOutcomeModal(selectedConsultation)}
                        className={`px-2.5 py-1 bg-white font-bold rounded-lg cursor-pointer ${
                          selectedConsultation.outcome === 'COORDINATOR_NO_SHOW' || selectedConsultation.internalNotes?.includes('COORDINATOR')
                            ? 'hover:bg-amber-100 border border-amber-300 text-amber-800'
                            : 'hover:bg-rose-100 border border-rose-300 text-rose-800'
                        }`}
                      >
                        Reschedule Consultation
                      </button>
                    </div>
                  ) : selectedConsultation.status === 'CANCELLED' ? (
                    <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <X className="w-4 h-4 text-slate-400" />
                        <span>This consultation appointment has been cancelled.</span>
                      </div>
                      <button
                        onClick={() => openOutcomeModal(selectedConsultation)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold rounded-lg cursor-pointer"
                      >
                        Reschedule
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Appointment Actions
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedConsultation.status !== 'CONFIRMED' && (
                          <button
                            onClick={() => handleStatusChange('CONFIRMED')}
                            disabled={statusUpdating}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                          >
                            Confirm Appointment
                          </button>
                        )}
                        <button
                          onClick={() => openOutcomeModal(selectedConsultation)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          Record Outcome
                        </button>
                        <button
                          onClick={() => handleStatusChange('CANCELLED')}
                          disabled={statusUpdating}
                          className="px-3 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Cancel Appointment
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recorded Outcomes Summary Block */}
                  {(selectedConsultation.discussionSummary || (selectedConsultation.agreedDecisions && selectedConsultation.agreedDecisions.length > 0)) && (
                    <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-900 uppercase tracking-wider text-[11px]">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Recorded Outcome & Decisions</span>
                      </div>
                      {selectedConsultation.discussionSummary && (
                        <p className="text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                          {selectedConsultation.discussionSummary}
                        </p>
                      )}
                      {selectedConsultation.agreedDecisions?.length > 0 && (
                        <div className="pt-2 border-t border-emerald-100">
                          <span className="font-bold text-emerald-950 block mb-1">Agreed Decisions:</span>
                          <ul className="list-disc list-inside space-y-1 text-slate-700">
                            {selectedConsultation.agreedDecisions.map((dec, i) => (
                              <li key={i}>{dec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Connected Booking & Customer Info */}
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                      <span className="font-bold text-slate-700">Customer</span>
                      <span className="font-bold text-slate-900">{selectedConsultation.customer?.fullName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Email:</span>
                      <a href={`mailto:${selectedConsultation.customer?.email}`} className="font-medium text-[#F20047] hover:underline">
                        {selectedConsultation.customer?.email}
                      </a>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Phone:</span>
                      <a href={`tel:${selectedConsultation.customer?.phone}`} className="font-medium text-slate-800 hover:underline">
                        {selectedConsultation.customer?.phone}
                      </a>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
                      <span className="text-slate-500">Preferred Event Date:</span>
                      <span className="font-bold text-slate-900">
                        {selectedConsultation.booking?.preferredDate
                          ? new Date(selectedConsultation.booking.preferredDate).toLocaleDateString()
                          : 'Pending'}
                      </span>
                    </div>
                    {selectedConsultation.booking?.budgetEstimate && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Estimated Budget:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {Number(selectedConsultation.booking.budgetEstimate).toLocaleString()} ETB
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Meeting Channel / Address */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Meeting Channel & Access
                    </div>
                    {selectedConsultation.method === 'VIDEO_CALL' ? (
                      <div className="p-4 bg-blue-50/70 border border-blue-200/90 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                              <Video className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 leading-tight">Google Meet Video Meeting</h4>
                              <span className="text-[11px] font-mono text-slate-500 truncate block max-w-[280px]">
                                {isValidGoogleMeetUrl(selectedConsultation.locationOrLink)
                                  ? selectedConsultation.locationOrLink
                                  : 'Conference link pending coordinator confirmation'}
                              </span>
                            </div>
                          </div>
                          {isValidGoogleMeetUrl(selectedConsultation.locationOrLink) && (
                            <button
                              onClick={() => copyToClipboard(selectedConsultation.locationOrLink, 'Google Meet Link')}
                              className="p-1.5 bg-white border border-blue-200 rounded-lg text-slate-600 hover:text-blue-700 transition-colors shadow-2xs shrink-0"
                              title="Copy Google Meet Link"
                            >
                              {copiedRef === selectedConsultation.locationOrLink ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-100">
                          {isValidGoogleMeetUrl(selectedConsultation.locationOrLink) ? (
                            <a
                              href={selectedConsultation.locationOrLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Join Google Meet</span>
                              <ExternalLink className="w-3 h-3 ml-0.5" />
                            </a>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold border border-slate-200 cursor-not-allowed"
                              title="Meeting link will be functional once a verified Google Meet room is allocated"
                            >
                              <Video className="w-3.5 h-3.5 text-slate-400" />
                              <span>Link Pending Allocation</span>
                            </span>
                          )}

                          <a
                            href={getGoogleCalendarUrl(selectedConsultation)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
                          >
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            <span>Add to Google Calendar</span>
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-slate-800 font-medium">
                          {selectedConsultation.locationOrLink || 'Eventora Headquarters, Morning Star Mall, Bole, Addis Ababa'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Follow-up Action Items */}
                  <div className="space-y-3 pt-3 border-t border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <ListTodo className="w-4 h-4 text-purple-600" />
                        Follow-up Action Items
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selectedConsultation.followUpTasks?.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No follow-up tasks recorded.</p>
                      ) : (
                        selectedConsultation.followUpTasks?.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs"
                          >
                            <button
                              onClick={() => handleToggleTask(task.id, task.isCompleted)}
                              className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                            >
                              {task.isCompleted ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                            <div className="flex-1">
                              <p className={`font-medium ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                {task.title}
                              </p>
                              {task.dueDate && (
                                <span className="text-[11px] text-slate-500 font-medium">
                                  Due {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Quick Add Task Form */}
                    <form onSubmit={handleAddTask} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add follow-up task..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#F20047] focus:outline-none"
                      />
                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="w-32 px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={taskSubmitting || !newTaskTitle.trim()}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black disabled:opacity-50 transition-colors"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Discussion Notes & Decisions */}
                  <div className="space-y-3 pt-3 border-t border-slate-200/80">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Discussion Notes & Decisions
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {selectedConsultation.notes?.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No notes recorded yet.</p>
                      ) : (
                        selectedConsultation.notes?.map((note) => (
                          <div
                            key={note.id}
                            className={`p-3 rounded-xl border text-xs ${
                              note.isInternalOnly ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200/80'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                              <span className="font-bold text-slate-700">{note.author?.fullName || 'Coordinator'}</span>
                              {note.isInternalOnly && (
                                <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
                                  <Lock className="w-3 h-3" /> Private Staff Note
                                </span>
                              )}
                            </div>
                            <p className="text-slate-800 whitespace-pre-wrap font-medium">{note.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Note Form */}
                    <form onSubmit={handleAddNote} className="space-y-2">
                      <textarea
                        rows={2}
                        placeholder="Record client preferences, agreed scope, decor requirements..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#F20047]"
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInternalNote}
                            onChange={(e) => setIsInternalNote(e.target.checked)}
                            className="rounded border-slate-300 text-[#F20047] focus:ring-[#F20047]"
                          />
                          <span>Private coordinator note (hidden from customer)</span>
                        </label>
                        <button
                          type="submit"
                          disabled={noteSubmitting || !newNote.trim()}
                          className="px-3.5 py-1.5 bg-[#F20047] hover:bg-[#d9003f] text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors"
                        >
                          Record Note
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between gap-3">
              <button
                onClick={() => navigate(`/company/bookings?bookingId=${selectedConsultation?.bookingId}`)}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>View Full Booking</span>
              </button>

              <button
                onClick={() => navigate(`/company/bookings`)}
                className="flex-1 py-2 px-3 bg-[#F20047] hover:bg-[#d9003f] text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 shadow-sm shadow-[#F20047]/20"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Prepare Quotation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Consultation Modal (Consistent Modal Design) */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-5 text-left relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Schedule Customer Consultation</h3>
                <p className="text-xs text-slate-500 mt-0.5">Arrange an in-person, venue, phone, or video meeting</p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {scheduleError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {scheduleError}
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              {/* Connected Booking Reference */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Connected Booking Request *
                </label>
                <select
                  value={formData.bookingId}
                  onChange={(e) => setFormData(prev => ({ ...prev, bookingId: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
                >
                  <option value="">-- Select Booking Request --</option>
                  {bookings.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.reference} — {b.title || b.eventType} ({b.customer?.fullName || 'Customer'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Consultation Method *
                </label>
                <select
                  value={formData.method}
                  onChange={(e) => {
                    const m = e.target.value;
                    let defaultLoc = formData.locationOrLink;
                    if (m === 'OFFICE_MEETING') defaultLoc = 'Eventora Headquarters, Morning Star Mall, Bole, Addis Ababa';
                    if (m === 'VIDEO_CALL') defaultLoc = ''; // Authenticated Google Meet link generated on schedule or pasted
                    if (m === 'PHONE_CALL') defaultLoc = 'Coordinator direct line';
                    setFormData(prev => ({ ...prev, method: m, locationOrLink: defaultLoc }));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
                >
                  <option value="OFFICE_MEETING">In Person (Office Meeting)</option>
                  <option value="VENUE_VISIT">Venue Site Visit</option>
                  <option value="PHONE_CALL">Phone Call</option>
                  <option value="VIDEO_CALL">Video Meeting (Google Meet)</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Meeting Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
                  />
                </div>
              </div>

              {/* Location or Meeting Link */}
              {formData.method === 'VIDEO_CALL' ? (
                <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                      <Video className="w-4 h-4 text-blue-600" />
                      <span>Google Meet Meeting Link</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={generateFreshMeetLink}
                        className="px-2 py-1 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="Generate a fresh Google Meet link"
                      >
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        <span>New Link</span>
                      </button>
                      <a
                        href="https://meet.google.com/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors inline-flex items-center gap-1"
                        title="Open Google Meet in a new tab to create room directly"
                      >
                        <span>Open Meet</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.locationOrLink}
                      onChange={(e) => setFormData(prev => ({ ...prev, locationOrLink: e.target.value }))}
                      placeholder="https://meet.google.com/xxx-yyyy-zzz"
                      className="w-full px-3 py-2 pr-10 bg-white border border-blue-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    {formData.locationOrLink && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formData.locationOrLink, 'Google Meet Link')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Copy link"
                      >
                        {copiedRef === formData.locationOrLink ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-blue-700 font-medium">
                    This Google Meet link will be attached to the appointment and made available in the customer portal.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Location or Meeting Link
                  </label>
                  <input
                    type="text"
                    value={formData.locationOrLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, locationOrLink: e.target.value }))}
                    placeholder="Address or venue location"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
                  />
                </div>
              )}

              {/* Customer-Visible Instructions */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer-Visible Preparation Notes / Agenda
                </label>
                <textarea
                  rows={2}
                  value={formData.customerVisibleNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerVisibleNotes: e.target.value }))}
                  placeholder="What customer should prepare (floor plans, inspiration photos, dietary lists)..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F20047]/20 focus:border-[#F20047]"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
                <strong>Important Note:</strong> Scheduling a consultation does not reserve the event date or block resources. Date and service reservation requires quotation acceptance, signed contract, and verified 50% deposit.
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleLoading}
                  className="px-4 py-2 bg-[#F20047] hover:bg-[#d9003f] text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-[#F20047]/20 disabled:opacity-50"
                >
                  {scheduleLoading ? 'Scheduling...' : 'Schedule Consultation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Record Consultation Outcome Modal */}
      {outcomeModalOpen && outcomeTargetConsultation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto flex flex-col text-slate-800">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {outcomeTargetConsultation.booking?.reference || 'Consultation'}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {outcomeTargetConsultation.customer?.fullName}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                  Record Consultation Outcome
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scheduled time: {formatDateTimeEAT(outcomeTargetConsultation.scheduledStartTime)}
                </p>
              </div>
              <button
                onClick={() => setOutcomeModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordOutcomeSubmit} className="space-y-5 mt-5">
              {/* Outcome Selection Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Meeting Outcome *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'MEETING_COMPLETED',
                      label: 'Meeting Completed',
                      desc: 'Discussion held & requirements aligned',
                      icon: CheckCircle2,
                      activeColor: 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20',
                      badgeColor: 'bg-emerald-600 text-white'
                    },
                    {
                      id: 'CUSTOMER_NO_SHOW',
                      label: 'Customer Did Not Attend',
                      desc: 'Client was absent / no-show',
                      icon: UserX,
                      activeColor: 'border-rose-400 bg-rose-50/70 text-rose-950 ring-2 ring-rose-400/20',
                      badgeColor: 'bg-rose-600 text-white'
                    },
                    {
                      id: 'COORDINATOR_NO_SHOW',
                      label: 'Coordinator Did Not Attend',
                      desc: 'Staff operational delay or conflict',
                      icon: AlertCircle,
                      activeColor: 'border-amber-400 bg-amber-50/70 text-amber-950 ring-2 ring-amber-400/20',
                      badgeColor: 'bg-amber-600 text-white'
                    },
                    {
                      id: 'RESCHEDULE',
                      label: 'Reschedule',
                      desc: 'Choose a new date, time & method',
                      icon: RotateCcw,
                      activeColor: 'border-blue-500 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/20',
                      badgeColor: 'bg-blue-600 text-white'
                    },
                    {
                      id: 'CANCELLED',
                      label: 'Cancelled',
                      desc: 'Meeting cancelled without reschedule',
                      icon: X,
                      activeColor: 'border-slate-400 bg-slate-100 text-slate-900 ring-2 ring-slate-400/20',
                      badgeColor: 'bg-slate-700 text-white'
                    }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = outcomeType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setOutcomeType(item.id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? item.activeColor
                            : 'border-slate-200/90 bg-white hover:bg-slate-50/80 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-inherit' : 'text-slate-500'}`} />
                          {isSelected && (
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${item.badgeColor}`}>
                              Selected
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-tight">{item.label}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Outcome Fields: 1. MEETING COMPLETED */}
              {outcomeType === 'MEETING_COMPLETED' && (
                <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Discussion Summary & Meeting Notes *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={outcomeData.discussionSummary}
                      onChange={(e) => setOutcomeData(prev => ({ ...prev, discussionSummary: e.target.value }))}
                      placeholder="Summarize customer preferences, confirmed headcount, theme selections, venue layout agreements..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      This summary will be documented in the consultation record and visible to the client.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Agreed Decisions & Scope Confirmation (One per line)
                    </label>
                    <textarea
                      rows={2}
                      value={outcomeData.agreedDecisions}
                      onChange={(e) => setOutcomeData(prev => ({ ...prev, agreedDecisions: e.target.value }))}
                      placeholder="e.g.&#10;Decor theme: Traditional Ethiopian Gold & Emerald&#10;Catering: 250 Guests Buffet&#10;Photographer: 2 Operators + Drone"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* Follow-up Tasks Sub-Section */}
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <ListTodo className="w-4 h-4 text-purple-600" />
                        <span>Follow-up Action Items</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {outcomeData.tasks.length} task(s) added
                      </span>
                    </div>

                    {outcomeData.tasks.length > 0 && (
                      <div className="space-y-2">
                        {outcomeData.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 text-xs"
                          >
                            <div>
                              <span className="font-semibold text-slate-900">{task.title}</span>
                              {task.dueDate && (
                                <span className="text-[11px] text-slate-500 ml-2">
                                  Due: {task.dueDate}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeModalTask(task.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Remove task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Task title (e.g. Inquire with lighting vendor)..."
                        value={newModalTaskTitle}
                        onChange={(e) => setNewModalTaskTitle(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                      />
                      <input
                        type="date"
                        value={newModalTaskDueDate}
                        onChange={(e) => setNewModalTaskDueDate(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={addModalTask}
                        disabled={!newModalTaskTitle.trim()}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-colors"
                      >
                        Add Task
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Private Coordinator Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={outcomeData.internalNotes}
                      onChange={(e) => setOutcomeData(prev => ({ ...prev, internalNotes: e.target.value }))}
                      placeholder="Internal observation or coordinator reminder..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Recording this outcome marks the consultation as Completed and documents meeting notes. The booking status remains active and unchanged until quotation preparation is initiated.
                    </span>
                  </div>
                </div>
              )}

              {/* Conditional Outcome Fields: 2. CUSTOMER DID NOT ATTEND */}
              {(outcomeType === 'CUSTOMER_NO_SHOW' || outcomeType === 'CUSTOMER_DID_NOT_ATTEND') && (
                <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Follow-up & Contact Notes
                    </label>
                    <textarea
                      rows={3}
                      value={outcomeData.internalNotes}
                      onChange={(e) => setOutcomeData(prev => ({ ...prev, internalNotes: e.target.value }))}
                      placeholder="Note attempts to contact the client (phone calls, email, message sent)..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
                    />
                  </div>

                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Status will be updated to <strong>No-Show (Customer Absent)</strong>. The customer will receive an alert letting them know they were missed with an invitation to reschedule.
                    </span>
                  </div>
                </div>
              )}

              {/* Conditional Outcome Fields: 3. COORDINATOR DID NOT ATTEND */}
              {(outcomeType === 'COORDINATOR_NO_SHOW' || outcomeType === 'COORDINATOR_DID_NOT_ATTEND') && (
                <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Internal Incident Explanation
                    </label>
                    <textarea
                      rows={3}
                      value={outcomeData.internalNotes}
                      onChange={(e) => setOutcomeData(prev => ({ ...prev, internalNotes: e.target.value }))}
                      placeholder="Explain the operational conflict or emergency that prevented attendance..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                    />
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      The customer will receive an official apology message from Eventora assuring them their coordinator will reach out promptly to reschedule.
                    </span>
                  </div>
                </div>
              )}

              {/* Conditional Outcome Fields: 4. RESCHEDULE */}
              {outcomeType === 'RESCHEDULE' && (
                <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        New Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={outcomeData.rescheduleDate}
                        onChange={(e) => setOutcomeData(prev => ({ ...prev, rescheduleDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        New Start Time *
                      </label>
                      <input
                        type="time"
                        required
                        value={outcomeData.rescheduleTime}
                        onChange={(e) => setOutcomeData(prev => ({ ...prev, rescheduleTime: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Duration
                      </label>
                      <select
                        value={outcomeData.durationMinutes}
                        onChange={(e) => setOutcomeData(prev => ({ ...prev, durationMinutes: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                        <option value={60}>60 Minutes</option>
                        <option value={90}>90 Minutes</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Consultation Method *
                    </label>
                    <select
                      value={outcomeData.rescheduleMethod}
                      onChange={(e) => {
                        const m = e.target.value;
                        let loc = outcomeData.rescheduleLocation;
                        if (m === 'OFFICE_MEETING') loc = 'Eventora Headquarters, Morning Star Mall, Bole, Addis Ababa';
                        if (m === 'VIDEO_CALL') loc = '';
                        if (m === 'PHONE_CALL') loc = 'Coordinator direct line';
                        setOutcomeData(prev => ({ ...prev, rescheduleMethod: m, rescheduleLocation: loc }));
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="OFFICE_MEETING">In Person (Office Meeting)</option>
                      <option value="VENUE_VISIT">Venue Site Visit</option>
                      <option value="PHONE_CALL">Phone Call</option>
                      <option value="VIDEO_CALL">Video Meeting (Google Meet)</option>
                      <option value="OTHER">Other Method</option>
                    </select>
                  </div>

                  {outcomeData.rescheduleMethod === 'VIDEO_CALL' ? (
                    <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/90 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                          <Video className="w-4 h-4 text-blue-600" />
                          <span>Google Meet Meeting Link</span>
                        </div>
                        <button
                          type="button"
                          onClick={generateOutcomeMeetLink}
                          className="px-2 py-1 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-blue-600" />
                          <span>Generate Link</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={outcomeData.rescheduleLocation}
                        onChange={(e) => setOutcomeData(prev => ({ ...prev, rescheduleLocation: e.target.value }))}
                        placeholder="https://meet.google.com/xxx-yyyy-zzz"
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Location / Connection Details
                      </label>
                      <input
                        type="text"
                        value={outcomeData.rescheduleLocation}
                        onChange={(e) => setOutcomeData(prev => ({ ...prev, rescheduleLocation: e.target.value }))}
                        placeholder="Venue address or office room"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Reason for Rescheduling
                    </label>
                    <input
                      type="text"
                      value={outcomeData.reason}
                      onChange={(e) => setOutcomeData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="e.g. Customer requested alternate time slot to review venue quotes..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 font-medium flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Previous appointment history is preserved in consultation notes. The customer will receive an updated schedule confirmation with the new time and meeting link.
                    </span>
                  </div>
                </div>
              )}

              {/* Conditional Outcome Fields: 5. CANCELLED */}
              {outcomeType === 'CANCELLED' && (
                <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cancellation Reason *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={outcomeData.reason}
                      onChange={(e) => setOutcomeData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Explain reason for cancellation (e.g. Customer withdrew request, duplicate appointment)..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>

                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium flex items-center gap-2">
                    <X className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                      Consultation status will be marked as Cancelled. Customer and assigned staff will be notified.
                    </span>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOutcomeModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={outcomeLoading}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                    outcomeType === 'MEETING_COMPLETED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : outcomeType === 'CUSTOMER_DID_NOT_ATTEND'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : outcomeType === 'COORDINATOR_DID_NOT_ATTEND'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : outcomeType === 'RESCHEDULE'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                >
                  {outcomeLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Outcome...</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>Confirm & Record Outcome</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
