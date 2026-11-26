import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  FileText,
  Calendar,
  FileSpreadsheet,
  Users,
  Bell,
  ChevronRight,
  ChevronLeft,
  CheckSquare,
  Clock,
  Video,
  Building,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Phone,
  Mail,
  Send,
  Sparkles,
  ShieldCheck,
  Check,
  ExternalLink,
  CalendarCheck,
  AlertTriangle,
  RotateCcw,
  Plus
} from 'lucide-react';

export default function CoordinatorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review Booking Modal state
  const [reviewModal, setReviewModal] = useState({ open: false, booking: null });
  const [statusUpdateReason, setStatusUpdateReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [claimingId, setClaimingId] = useState(null);
  const [pipelineTab, setPipelineTab] = useState('quotations');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboardSummary();
      if (res?.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Coordinator dashboard fetch error:', err);
      setError(err.message || 'Unable to connect to coordinator live records.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimBooking = async (bookingId, e) => {
    e?.stopPropagation();
    try {
      setClaimingId(bookingId);
      const res = await api.claimBooking(bookingId);
      toast.success(res?.message || 'You have claimed primary ownership of this booking request.');
      if (reviewModal.open && reviewModal.booking?.id === bookingId) {
        setReviewModal({
          open: true,
          booking: { ...reviewModal.booking, assignedCoordinatorId: user?.id, status: 'UNDER_REVIEW' }
        });
      }
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to claim request. It may have already been claimed.');
      loadData();
    } finally {
      setClaimingId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTimeOfDayGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const coordinatorFirstName = user?.fullName?.split(' ')[0] || 'Coordinator';

  // Format status labels into clean human-readable sentence case
  const formatStatus = (status) => {
    if (!status) return 'Pending';
    const map = {
      REQUESTED: 'New Request',
      NEEDS_INFORMATION: 'Needs Info',
      UNDER_REVIEW: 'In Review',
      QUOTATION_PENDING: 'Quotation Pending',
      CONFIRMED: 'Confirmed',
      CANCELLED: 'Cancelled',
      DRAFT: 'Draft',
      SENT: 'Sent to Client',
      ACCEPTED: 'Accepted',
      REJECTED: 'Declined',
      PENDING_SIGNATURE: 'Pending Signature',
      SIGNED: 'Signed',
      IN_PREPARATION: 'In Prep',
      DELIVERING: 'Active'
    };
    return map[status] || status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleUpdateBookingStatus = async (newStatus) => {
    if (!reviewModal.booking) return;
    try {
      setIsUpdatingStatus(true);
      await api.updateBookingStatus(
        reviewModal.booking.id,
        newStatus,
        statusUpdateReason || `Status updated to ${newStatus} by Coordinator ${user?.fullName || ''}`
      );
      toast.success(`Booking ${reviewModal.booking.reference || ''} updated to ${newStatus}`);
      setReviewModal({ open: false, booking: null });
      setStatusUpdateReason('');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update booking status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Real database metrics with zero hardcoded fallbacks
  const metrics = data?.metrics || {
    newBookingRequestsCount: 0,
    bookingsUnderReviewCount: 0,
    upcomingConsultationsCount: 0,
    quotationsAwaitingResponseCount: 0,
    contractsPendingSignatureCount: 0,
    confirmedUpcomingEventsCount: 0,
    tasksInProgressCount: 0,
    tasksOverdueCount: 0
  };

  // Section collections from live backend
  const recentBookingRequests = data?.sections?.recentBookingRequests || data?.recentBookingRequests || [];
  const upcomingConsultations = data?.sections?.upcomingConsultations || data?.upcomingConsultations || [];
  const upcomingEvents = data?.sections?.upcomingEvents || data?.upcomingEvents || [];
  const pendingQuotations = data?.sections?.pendingQuotationsAndContracts?.quotations || [];
  const pendingContracts = data?.sections?.pendingQuotationsAndContracts?.contracts || [];
  const partnerCommitmentStatus = data?.sections?.partnerCommitmentStatus || data?.partnerCommitmentStatus || [];
  const staffTaskProgress = data?.sections?.staffTaskProgress || data?.staffTaskProgress || [];
  const recentNotifications = data?.sections?.recentActivitiesAndNotifications || data?.notifications || [];

  // Recent 4 items slices (strictly top 4 items per card)
  const recentBookingsTop = recentBookingRequests.slice(0, 4);
  const upcomingEventsTop = upcomingEvents.slice(0, 4);
  const pendingQuotationsTop = pendingQuotations.slice(0, 4);
  const pendingContractsTop = pendingContracts.slice(0, 4);
  const upcomingConsultationsTop = upcomingConsultations.slice(0, 4);
  const staffTasksTop = staffTaskProgress.slice(0, 4);
  const partnerCommitmentsTop = partnerCommitmentStatus.slice(0, 4);
  const recentNotificationsTop = recentNotifications.slice(0, 4);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-white rounded-2xl border border-slate-200/80"></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200/80"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-96 bg-white rounded-2xl border border-slate-200/80"></div>
          <div className="lg:col-span-4 h-96 bg-white rounded-2xl border border-slate-200/80"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* 1. Greeting Banner with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {getTimeOfDayGreeting()}, {coordinatorFirstName}!
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Overview of inquiries, consultations, quotations, and active events today.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link
            to="/company/consultations"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
          >
            <Video className="w-3.5 h-3.5 text-slate-500" />
            <span>Consultations</span>
          </Link>
          <Link
            to="/company/quotations"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Quotations</span>
          </Link>
          <Link
            to="/company/bookings"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F20047] hover:bg-[#d9003f] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Booking Requests</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 2. Real Database Statistics (8 Exact KPI Metric Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
        {/* Metric 1: New Booking Requests */}
        <Link
          to="/company/bookings?status=REQUESTED"
          className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs hover:border-rose-200 transition-all cursor-pointer relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">New Requests</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-[#F20047] flex items-center justify-center border border-rose-100">
              <CalendarCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.newBookingRequestsCount}
            </h3>
            <span className="text-[11px] font-semibold text-rose-600">Incoming</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Pending initial review</p>
        </Link>

        {/* Metric 2: Bookings Under Review */}
        <Link
          to="/company/bookings?status=UNDER_REVIEW"
          className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs hover:border-amber-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Under Review</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.bookingsUnderReviewCount}
            </h3>
            <span className="text-[11px] font-semibold text-amber-700">In Review</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Active assessments</p>
        </Link>

        {/* Metric 3: Upcoming Consultations */}
        <Link
          to="/company/consultations"
          className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs hover:border-blue-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Consultations</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/60">
              <Video className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.upcomingConsultationsCount}
            </h3>
            <span className="text-[11px] font-semibold text-blue-700">Scheduled</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Video & in-person meetings</p>
        </Link>

        {/* Metric 4: Quotations Awaiting Response */}
        <Link
          to="/company/quotations"
          className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs hover:border-purple-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quotations Sent</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200/60">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.quotationsAwaitingResponseCount}
            </h3>
            <span className="text-[11px] font-semibold text-purple-700">Awaiting Client</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Customer response pending</p>
        </Link>

        {/* Metric 5: Contracts Pending Signature */}
        <Link
          to="/company/contracts"
          className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs hover:border-indigo-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contracts Pending</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/60">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.contractsPendingSignatureCount}
            </h3>
            <span className="text-[11px] font-semibold text-indigo-700">Signing</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Pending client / company signature</p>
        </Link>

        {/* Metric 6: Confirmed Upcoming Events */}
        <Link
          to="/company/events"
          className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs hover:border-emerald-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Confirmed Events</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.confirmedUpcomingEventsCount}
            </h3>
            <span className="text-[11px] font-semibold text-emerald-700">Active</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">In preparation & execution</p>
        </Link>

        {/* Metric 7: Tasks In Progress */}
        <Link
          to="/company/tasks?status=IN_PROGRESS"
          className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs hover:border-teal-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tasks Active</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60">
              <CheckSquare className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.tasksInProgressCount}
            </h3>
            <span className="text-[11px] font-semibold text-teal-700">In Progress</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Staff execution ongoing</p>
        </Link>

        {/* Metric 8: Tasks Overdue */}
        <Link
          to="/company/tasks?status=OVERDUE"
          className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs hover:border-rose-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tasks Overdue</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-[#F20047] flex items-center justify-center border border-rose-200/60">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.tasksOverdueCount}
            </h3>
            <span className="text-[11px] font-semibold text-rose-600">Attention</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Past targeted deadline</p>
        </Link>
      </div>

      {/* 3. Main Dashboard Content Grid: Direct 2-Column Responsive Grid with Exactly Equal-Height Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CARD 1: Recent Booking Requests Requiring Attention */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between h-[420px]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-[#F20047] flex items-center justify-center border border-rose-100">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Recent Booking Requests</h2>
                  <p className="text-[11px] text-slate-400">Incoming inquiries awaiting coordinator review</p>
                </div>
              </div>
              <Link
                to="/company/bookings"
                className="text-xs font-bold text-[#F20047] hover:underline flex items-center gap-1"
              >
                <span>All ({recentBookingRequests.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 mt-1 [scrollbar-width:none]">
              {recentBookingRequests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#F20047] flex items-center justify-center mb-2 border border-rose-100">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">No pending booking requests</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">New incoming requests from customers will appear here.</p>
                </div>
              ) : (
                recentBookingsTop.map((req) => (
                  <div
                    key={req.id}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/50 rounded-xl px-2 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                        {req.eventType?.slice(0, 2) || 'EV'}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {req.reference}
                          </span>
                          <h4 className="font-bold text-slate-900 text-xs truncate">
                            {req.title}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {req.customerName} • {req.preferredDateFormatted} • {req.location}
                        </p>
                        {req.budgetEstimate && (
                          <p className="text-[10px] font-semibold text-slate-400">
                            Budget: {req.budgetEstimate.toLocaleString()} ETB {req.guestCount ? `• ${req.guestCount} guests` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          req.status === 'NEEDS_INFORMATION'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                            : req.status === 'UNDER_REVIEW'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                            : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                        }`}
                      >
                        {formatStatus(req.status)}
                      </span>
                      {!req.assignedCoordinatorId ? (
                        <button
                          onClick={(e) => handleClaimBooking(req.id, e)}
                          disabled={claimingId === req.id}
                          className="px-2.5 py-1 bg-[#B95650] hover:bg-[#a24944] text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                          title="Claim primary ownership of this request"
                        >
                          {claimingId === req.id ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          <span>Claim</span>
                        </button>
                      ) : req.assignedCoordinatorId === user?.id ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          You
                        </span>
                      ) : null}
                      <button
                        onClick={() => setReviewModal({ open: true, booking: req })}
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2.5 mt-auto border-t border-slate-100 shrink-0">
            <Link
              to="/company/bookings"
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#F20047] hover:bg-rose-50/70 rounded-xl transition-colors border border-dashed border-rose-200"
            >
              <span>View all booking requests ({recentBookingRequests.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* CARD 2: Upcoming Consultations */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between h-[420px]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Upcoming Consultations</h3>
                  <p className="text-[11px] text-slate-400">Scheduled client video & in-person meetings</p>
                </div>
              </div>
              <Link to="/company/consultations" className="text-xs font-bold text-[#F20047] hover:underline flex items-center gap-1">
                <span>Schedule ({upcomingConsultations.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto mt-2 space-y-2 [scrollbar-width:none]">
              {upcomingConsultations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 border border-blue-100">
                    <Video className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">No consultations scheduled</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-[260px]">
                    Scheduled video calls and in-person consultations with clients will appear here.
                  </p>
                </div>
              ) : (
                upcomingConsultationsTop.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 truncate">{c.customerName}</span>
                      <span className="font-mono text-[10px] text-slate-500 font-semibold">{c.timeFormatted}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium truncate">{c.topic}</p>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        {c.method === 'VIDEO_CALL' ? <Video className="w-3 h-3 text-blue-600" /> : <Building className="w-3 h-3 text-slate-400" />}
                        <span>{c.meetingType}</span>
                      </span>
                      {c.meetLink && (
                        <a
                          href={c.meetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          <span>Join Meet</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2.5 mt-auto border-t border-slate-100 shrink-0">
            <Link
              to="/company/consultations"
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#F20047] hover:bg-rose-50/70 rounded-xl transition-colors border border-dashed border-rose-200"
            >
              <span>View all consultations ({upcomingConsultations.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* CARD 3: Confirmed Upcoming Events Execution */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between h-[420px]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Upcoming Confirmed Events</h2>
                  <p className="text-[11px] text-slate-400">Operational progress, assigned staff, and partners</p>
                </div>
              </div>
              <Link
                to="/company/events"
                className="text-xs font-bold text-[#F20047] hover:underline flex items-center gap-1"
              >
                <span>All ({upcomingEvents.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 mt-1 [scrollbar-width:none]">
              {upcomingEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 border border-emerald-100">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">No confirmed upcoming events</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Events with approved contracts and verified deposits will appear here.</p>
                </div>
              ) : (
                upcomingEventsTop.map((evt) => (
                  <div key={evt.id} className="py-2.5 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {evt.reference}
                          </span>
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                            {evt.title}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {evt.dateFormatted} • {evt.location}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs shrink-0">
                        <span className="text-[10px] font-medium text-slate-500">
                          Staff: <b>{evt.assignedStaffCount}</b>
                        </span>
                        <span className="text-[10px] font-medium text-slate-500">
                          Partners: <b>{evt.assignedPartnerCount}</b>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {evt.status}
                        </span>
                      </div>
                    </div>

                    {/* Milestone Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span className="truncate max-w-[200px]">Milestone: <b className="text-slate-800">{evt.nextMilestone}</b></span>
                        <span>{evt.progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                          style={{ width: `${evt.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2.5 mt-auto border-t border-slate-100 shrink-0">
            <Link
              to="/company/events"
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#F20047] hover:bg-rose-50/70 rounded-xl transition-colors border border-dashed border-rose-200"
            >
              <span>View all confirmed events ({upcomingEvents.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* CARD 4: Pending Quotations & Contracts */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between h-[420px]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-1.5 p-0.5 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPipelineTab('quotations')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    pipelineTab === 'quotations'
                      ? 'bg-white text-purple-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                  <span>Quotations ({pendingQuotations.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPipelineTab('contracts')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    pipelineTab === 'contracts'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Contracts ({pendingContracts.length})</span>
                </button>
              </div>

              <Link
                to={pipelineTab === 'quotations' ? '/company/quotations' : '/company/contracts'}
                className="text-[11px] font-bold text-[#F20047] hover:underline flex items-center gap-1"
              >
                <span>Manage {pipelineTab === 'quotations' ? 'Quotations' : 'Contracts'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto mt-2 [scrollbar-width:none]">
              {pipelineTab === 'quotations' ? (
                pendingQuotations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 border border-purple-100">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">No pending quotations</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Prepare quotations directly from reviewed booking inquiries.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingQuotationsTop.map((q) => (
                      <div key={q.id} className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs space-y-1 hover:border-slate-200 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 truncate max-w-[200px]">
                            {q.bookingTitle || q.bookingReference}
                          </span>
                          <span className="font-extrabold text-slate-900">
                            {q.totalAmountETB.toLocaleString()} ETB
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>v{q.version} • {q.customerName || 'Client'}</span>
                          <span className="font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60">
                            {formatStatus(q.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                pendingContracts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 border border-indigo-100">
                      <FileText className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">No pending contracts</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Binding service agreements awaiting signature will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingContractsTop.map((ct) => (
                      <div key={ct.id} className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs space-y-1 hover:border-slate-200 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 truncate max-w-[200px]">
                            {ct.bookingTitle || ct.bookingReference}
                          </span>
                          <span className="font-extrabold text-slate-900">
                            {ct.totalAmountETB.toLocaleString()} ETB
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>50% Deposit: {ct.initialPaymentAmountETB.toLocaleString()} ETB</span>
                          <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                            {formatStatus(ct.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

          <div className="pt-2.5 mt-auto border-t border-slate-100 shrink-0">
            <Link
              to={pipelineTab === 'quotations' ? '/company/quotations' : '/company/contracts'}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#F20047] hover:bg-rose-50/70 rounded-xl transition-colors border border-dashed border-rose-200"
            >
              <span>
                View all {pipelineTab === 'quotations' ? `quotations (${pendingQuotations.length})` : `contracts (${pendingContracts.length})`}
              </span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* CARD 5: Partner Commitment Status */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between h-[420px]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-[#F20047] flex items-center justify-center border border-rose-100">
                  <Users className="w-4 h-4 text-[#F20047]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">Partner Commitments</h3>
                  <p className="text-[10px] text-slate-400">External resource coordination & scope</p>
                </div>
              </div>
              <Link to="/company/partners" className="text-[11px] font-bold text-[#F20047] hover:underline flex items-center gap-1">
                <span>Directory ({partnerCommitmentStatus.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <p className="text-[10px] text-slate-400 italic py-1 shrink-0">
              External partners manage resources directly; payouts remain outside Eventora.
            </p>

            <div className="flex-1 min-h-0 overflow-y-auto mt-1 space-y-2 [scrollbar-width:none]">
              {partnerCommitmentStatus.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-2 border border-slate-200">
                    <Users className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">No partner commitments assigned</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Assigned external vendors and partners will appear here.</p>
                </div>
              ) : (
                partnerCommitmentsTop.map((pa) => (
                  <div key={pa.id} className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{pa.partnerName}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {pa.serviceCategory} • {pa.bookingTitle}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        pa.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : pa.status === 'DECLINED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {pa.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2.5 mt-auto border-t border-slate-100 shrink-0">
            <Link
              to="/company/partners"
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#F20047] hover:bg-rose-50/70 rounded-xl transition-colors border border-dashed border-rose-200"
            >
              <span>View all partner commitments ({partnerCommitmentStatus.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* CARD 6: Recent Activities and Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between h-[420px]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                  <Bell className="w-4 h-4 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">Recent Notifications</h3>
                  <p className="text-[10px] text-slate-400">Live operational events & staff updates</p>
                </div>
              </div>
              <Link to="/company/notifications" className="text-[11px] font-bold text-[#F20047] hover:underline flex items-center gap-1">
                <span>View all ({recentNotifications.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto mt-2 space-y-2 [scrollbar-width:none]">
              {recentNotifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-2 border border-slate-200">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">No recent notifications</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">System alerts and staff updates will appear here.</p>
                </div>
              ) : (
                recentNotificationsTop.map((n) => (
                  <div key={n.id} className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs space-y-0.5 hover:bg-slate-50 transition-colors">
                    <p className="font-bold text-slate-900 text-[11px] truncate">{n.title || 'System Notification'}</p>
                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2.5 mt-auto border-t border-slate-100 shrink-0">
            <Link
              to="/company/notifications"
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#F20047] hover:bg-rose-50/70 rounded-xl transition-colors border border-dashed border-rose-200"
            >
              <span>View all notifications ({recentNotifications.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Review Request Modal (SRS v1.3 Coordinator Review Workflow) */}
      {reviewModal.open && reviewModal.booking && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col text-left relative overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-[#F20047] flex items-center justify-center font-bold text-base">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Booking Request Review
                    </h3>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                      {reviewModal.booking.reference}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Review client specifications, assess capacity, and coordinate next steps.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewModal({ open: false, booking: null })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-left text-xs">
              {/* Event Overview Hero */}
              <div className="pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100">
                    {reviewModal.booking.eventType?.replace(/_/g, ' ') || 'Event Inquiry'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-400 font-medium">
                    {reviewModal.booking.preferredDateFormatted || 'Date Pending'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mt-2 leading-snug tracking-tight">
                  {reviewModal.booking.title}
                </h3>

                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Location</span>
                    <span className="text-xs font-semibold text-slate-800 truncate block">
                      {reviewModal.booking.location || 'Addis Ababa'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Scale</span>
                    <span className="text-xs font-semibold text-slate-800 block">
                      {reviewModal.booking.guestCount ? `${reviewModal.booking.guestCount} Guests` : 'Standard Scale'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Budget</span>
                    <span className="text-xs font-bold text-slate-900 block">
                      {reviewModal.booking.budgetEstimate ? `${reviewModal.booking.budgetEstimate.toLocaleString()} ETB` : 'TBD'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Contact Details */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/60 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-xs">{reviewModal.booking.customerName}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {reviewModal.booking.customerPhone || 'Phone unlisted'} • {reviewModal.booking.customerEmail || 'Email unlisted'}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {reviewModal.booking.status}
                </span>
              </div>

              {/* Coordinator Assignment Status Banner */}
              {!reviewModal.booking.assignedCoordinatorId ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <p className="text-xs text-amber-800 font-medium">
                      <strong>Unassigned Request:</strong> Claim this inquiry to become primary coordinator.
                    </p>
                  </div>
                  <button
                    onClick={() => handleClaimBooking(reviewModal.booking.id)}
                    disabled={claimingId === reviewModal.booking.id}
                    className="px-3 py-1.5 bg-[#B95650] hover:bg-[#a24944] text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {claimingId === reviewModal.booking.id ? (
                      <RotateCcw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    <span>Claim Request</span>
                  </button>
                </div>
              ) : reviewModal.booking.assignedCoordinatorId === user?.id ? (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>You are the primary coordinator responsible for this booking.</span>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-700">
                  <span>Assigned Primary Coordinator: <strong>{reviewModal.booking.assignedCoordinator?.fullName || 'Assigned'}</strong></span>
                </div>
              )}

              {/* Status Update & Reason */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-600">
                  Coordinator Instructions / Notes
                </label>
                <textarea
                  rows={2}
                  value={statusUpdateReason}
                  onChange={(e) => setStatusUpdateReason(e.target.value)}
                  placeholder="Enter comments, missing details needed, or reasons for review decision..."
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#F20047] transition-all"
                />
              </div>

              {/* Workflow Actions */}
              <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setReviewModal({ open: false, booking: null });
                    navigate('/company/quotations');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Start Quotation
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewModal({ open: false, booking: null });
                    navigate('/company/consultations');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Schedule Consultation
                </button>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setReviewModal({ open: false, booking: null })}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleUpdateBookingStatus('NEEDS_INFORMATION')}
                  className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Request Information
                </button>
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleUpdateBookingStatus('UNDER_REVIEW')}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Mark Under Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
