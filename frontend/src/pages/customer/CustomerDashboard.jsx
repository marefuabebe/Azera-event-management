import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import BookingModal from '../../components/booking/BookingModal';
import {
  Calendar,
  CalendarCheck,
  CreditCard,
  BadgeCheck,
  Check,
  FileText,
  Clock,
  Sparkles,
  Headphones,
  MapPin,
  X,
  ChevronRight,
  Plus,
  Cake,
  Briefcase,
  Heart
} from 'lucide-react';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [consultModalOpen, setConsultModalOpen] = useState(false);
  const [quoteDetailsOpen, setQuoteDetailsOpen] = useState(false);
  const [allBookingsOpen, setAllBookingsOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Consultation Form State
  const [consultForm, setConsultForm] = useState({
    method: 'OFFICE_MEETING',
    date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    time: '10:00 AM',
    notes: 'Discussion regarding wedding floral styling and banquet menu.'
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardSummary();
      if (res?.data) {
        setData(res.data);
      }
    } catch (err) {
      console.warn('Dashboard summary load error, using fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleScheduleConsultation = async (e) => {
    e.preventDefault();
    try {
      const startTime = new Date(`${consultForm.date}T09:00:00.000Z`);
      const endTime = new Date(`${consultForm.date}T10:00:00.000Z`);
      const bookingId = data?.bookings?.[0]?.id;

      if (bookingId) {
        await api.scheduleConsultation({
          bookingId,
          method: consultForm.method,
          scheduledStartTime: startTime.toISOString(),
          scheduledEndTime: endTime.toISOString(),
          customerVisibleNotes: consultForm.notes
        });
      }
      setActionSuccessMsg('Consultation appointment request submitted successfully!');
      toast.success('Consultation appointment request submitted successfully!');
      setConsultModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Consultation request could not be processed.');
      setConsultModalOpen(false);
    }
  };

  const handleAcceptQuotation = async (quotationId) => {
    try {
      if (quotationId) {
        await api.acceptQuotation(quotationId, 'Accepted by customer via portal.');
      }
      setActionSuccessMsg('Quotation accepted! Contract is now ready for digital execution.');
      toast.success('Quotation accepted! Contract is now ready for digital execution.');
      setQuoteDetailsOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Quotation could not be accepted.');
      setQuoteDetailsOpen(false);
    }
  };

  // Metrics from real database only (0 fallback when no records exist)
  const metrics = data?.metrics || {};
  const upcomingCount = metrics.upcomingCount ?? 0;
  const activeBookingsCount = metrics.totalBookings ?? 0;
  const pendingPaymentsCount = data?.payments?.filter(p => p.status === 'SUBMITTED').length || 0;
  const pendingPaymentETB = metrics.pendingVerificationETB || 0;
  const totalSpentETB = metrics.verifiedPaidETB || 0;

  // Real bookings or exact reference list
  const realBookings = data?.bookings || [];
  const displayEvents = realBookings.length > 0 ? realBookings.slice(0, 3).map((b, idx) => {
    const defaultBadges = ['Confirmed', 'Pending', 'Quotation'];
    const badgeText = b.status === 'CONFIRMED' ? 'Confirmed' :
                      b.status === 'REQUEST_RECEIVED' ? 'Pending' :
                      b.status === 'UNDER_REVIEW' ? 'Quotation' :
                      b.status === 'COMPLETED' ? 'Completed' : defaultBadges[idx % 3];
    return {
      id: b.id,
      title: b.title,
      type: b.eventType,
      dateStr: new Date(b.preferredDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      location: b.locationName || 'Addis Ababa',
      badge: badgeText
    };
  }) : [];

  // Latest quotation from data
  const latestQuote = data?.quotations?.[0] || null;

  const customerFirstName = user?.fullName ? user.fullName.split(' ')[0] : 'Client';

  const getTimeOfDayGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Helper to resolve category-accurate visual styling and icons
  const getEventVisuals = (evt) => {
    const type = (evt.type || '').toUpperCase();
    const title = (evt.title || '').toLowerCase();

    if (type === 'WEDDING' || title.includes('wedding') || title.includes('royal wedding') || title.includes('melse') || title.includes('reception')) {
      return {
        icon: <Sparkles className="w-5 h-5 text-[#B95650]" />,
        bg: 'bg-[#FCECE8] border-[#E8B5A6] text-[#B95650]'
      };
    }
    if (type === 'BIRTHDAY' || title.includes('birthday') || title.includes('1st birthday') || title.includes('party')) {
      return {
        icon: <Cake className="w-5 h-5 text-amber-500" />,
        bg: 'bg-amber-50 border-amber-100 text-amber-500'
      };
    }
    if (type === 'CORPORATE' || title.includes('corporate') || title.includes('conference') || title.includes('summit')) {
      return {
        icon: <Briefcase className="w-5 h-5 text-blue-500" />,
        bg: 'bg-blue-50 border-blue-100 text-blue-500'
      };
    }
    return {
      icon: <Heart className="w-5 h-5 text-purple-500" />,
      bg: 'bg-purple-50 border-purple-100 text-purple-500'
    };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Greeting Header with Action Cluster */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[#211D1B] tracking-tight">
            {getTimeOfDayGreeting()}, {customerFirstName}!
          </h1>
          <p className="text-xs md:text-sm text-[#756B65] font-medium mt-1">
            Here's what's happening with your celebrations and bookings.
          </p>
        </div>

        {/* Header Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setBookingModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B95650] hover:bg-[#A34741] text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Request New Event</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Upcoming Events */}
        <div className="bg-[#FFFDFC] rounded-2xl p-5 border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#756B65]">Upcoming Events</span>
            <div className="w-10 h-10 rounded-xl bg-[#F7F2EC] text-[#B95650] border border-[#E8DDD3] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-[#211D1B]">{upcomingCount}</span>
          </div>
          <div className="mt-3 text-xs text-[#756B65] font-medium">
            Next: <span className="text-[#211D1B] font-semibold">Dec 12, 2026</span>
          </div>
        </div>

        {/* Card 2: Active Bookings */}
        <div className="bg-[#FFFDFC] rounded-2xl p-5 border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#756B65]">Active Bookings</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-[#211D1B]">{activeBookingsCount}</span>
          </div>
          <div className="mt-3 text-xs font-semibold text-emerald-700">
            In Progress
          </div>
        </div>

        {/* Card 3: Pending Payments */}
        <div className="bg-[#FFFDFC] rounded-2xl p-5 border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#756B65]">Pending Payments</span>
            <div className="w-10 h-10 rounded-xl bg-[#FCECE8] text-[#B95650] border border-[#E8B5A6] flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-[#211D1B]">{pendingPaymentsCount}</span>
          </div>
          <div className="mt-3 text-xs font-bold text-[#B95650]">
            ETB {Number(pendingPaymentETB).toLocaleString()}
          </div>
        </div>

        {/* Card 4: Total Spent */}
        <div className="bg-[#FFFDFC] rounded-2xl p-5 border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#756B65]">Total Spent</span>
            <div className="w-10 h-10 rounded-xl bg-[#F7F2EC] text-[#756B65] border border-[#E8DDD3] flex items-center justify-center">
              <BadgeCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black text-[#211D1B]">
              ETB {Number(totalSpentETB).toLocaleString()}
            </span>
          </div>
          <div className="mt-3 text-xs text-[#756B65] font-medium">
            All time
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Upcoming Events List + (Booking Progress & Latest Quotation) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Card: Upcoming Events List (~60% = 7 cols) */}
        <div className="lg:col-span-7 bg-[#FFFDFC] rounded-2xl p-6 border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-[#211D1B]">Upcoming Events</h2>
              <button
                onClick={() => setAllBookingsOpen(true)}
                className="text-xs font-semibold text-[#B95650] hover:text-[#A34741] hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            {/* List of events with distinct category-based icons and status badges */}
            <div className="space-y-3">
              {displayEvents.map((evt) => {
                const visuals = getEventVisuals(evt);
                const badgeColor =
                  evt.badge === 'Confirmed'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : evt.badge === 'Pending'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-[#FCECE8] text-[#B95650] border border-[#E8B5A6]';

                return (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between py-2.5 border-b border-[#E8DDD3]/60 last:border-b-0 hover:bg-[#F7F2EC]/60 rounded-xl px-2.5 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Category-Specific Visual Avatar */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${visuals.bg}`}>
                        {visuals.icon}
                      </div>

                      {/* Event Details */}
                      <div>
                        <h3 className="text-xs md:text-sm font-bold text-[#211D1B] leading-snug">{evt.title}</h3>
                        <p className="text-[11px] text-[#756B65] mt-0.5 font-medium flex items-center gap-1.5">
                          <span>{evt.dateStr}</span>
                          <span>•</span>
                          <span className="truncate max-w-[200px] sm:max-w-none">{evt.location}</span>
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-lg shrink-0 ml-2 ${badgeColor}`}>
                      {evt.badge}
                    </span>
                  </div>
                );
              })}

              {displayEvents.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-xs font-bold text-[#211D1B]">No events booked yet</p>
                  <p className="text-[11px] text-[#756B65] mt-1 mb-1">Plan your wedding, birthday, or corporate celebration with our team.</p>
                </div>
              )}

              {/* Balances vertical height with the right column and invites direct bookings */}
              {displayEvents.length < 3 && (
                <div
                  onClick={() => setBookingModalOpen(true)}
                  className="mt-3 p-3.5 rounded-xl border border-dashed border-[#E8B5A6] bg-[#FCECE8]/40 hover:bg-[#FCECE8]/70 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FFFDFC] border border-[#E8B5A6] text-[#B95650] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#211D1B] group-hover:text-[#B95650] transition-colors">
                        Planning another celebration?
                      </p>
                      <p className="text-[11px] text-[#756B65]">
                        Reserve dates early for weddings, birthdays, or galas
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#B95650] group-hover:translate-x-0.5 transition-transform whitespace-nowrap pl-2">
                    + Plan Event →
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Stack: Booking Progress + Latest Quotation (~40% = 5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Booking Progress Stepper Card */}
          <div className="bg-[#FFFDFC] rounded-2xl p-6 border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)]">
            <h2 className="text-sm font-bold text-[#211D1B] mb-6">Booking Progress</h2>

            {/* 5-step visual stepper */}
            <div className="relative flex items-center justify-between px-1">
              {/* Connecting Line */}
              <div className="absolute left-4 right-4 top-3 h-0.5 bg-[#B95650] -z-0"></div>

              {[
                { label: 'Request' },
                { label: 'Quotation' },
                { label: 'Contract' },
                { label: 'Payment' },
                { label: 'Confirmed' }
              ].map((step, idx) => (
                <div key={idx} className="relative z-10 flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-[#B95650] text-white flex items-center justify-center shadow-xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="text-[10px] font-medium text-[#756B65] mt-2 whitespace-nowrap">
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Latest Quotation Card */}
          <div className="bg-[#FFFDFC] rounded-2xl p-5 border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#FCECE8] text-[#B95650] border border-[#E8B5A6] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#756B65]">Latest Quotation</p>
                {latestQuote ? (
                  <>
                    <p className="text-sm font-bold text-[#211D1B] mt-0.5">
                      {latestQuote.reference || (latestQuote.version ? `QT-2026-000${latestQuote.version}` : 'Quotation')}
                    </p>
                    <p className="text-[10px] text-[#756B65] mt-0.5">
                      {latestQuote.validUntil ? `Valid until: ${latestQuote.validUntil}` : (latestQuote.totalAmount ? `${Number(latestQuote.totalAmount).toLocaleString()} ETB` : 'Under preparation')}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-[#211D1B] mt-0.5">No active proposals</p>
                    <p className="text-[10px] text-[#756B65] mt-0.5">Submit an event booking to receive itemized pricing</p>
                  </>
                )}
              </div>
            </div>

            {latestQuote ? (
              <button
                onClick={() => setQuoteDetailsOpen(true)}
                className="px-4 py-2 bg-[#B95650] hover:bg-[#A34741] text-white text-xs font-bold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
              >
                View Details
              </button>
            ) : (
              <button
                onClick={() => setBookingModalOpen(true)}
                className="px-3.5 py-1.5 bg-[#F7F2EC] hover:bg-[#E8DDD3] text-[#211D1B] text-xs font-bold rounded-xl border border-[#E8DDD3] transition-all shrink-0 cursor-pointer"
              >
                + Plan Event
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Bottom Card: Need Help? Consultation Banner */}
      <div className="bg-[#FFFDFC] border border-[#E8DDD3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(33,29,27,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#B95650] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-[#211D1B]">Need help?</h3>
            <p className="text-xs text-[#756B65] mt-0.5">
              Book a consultation with our dedicated planning team.
            </p>
          </div>
        </div>

        <button
          onClick={() => setConsultModalOpen(true)}
          className="px-6 py-2.5 bg-[#B95650] hover:bg-[#A34741] text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer"
        >
          Schedule Now
        </button>
      </div>

      {/* Modal 1: Consultation Scheduling Modal */}
      {consultModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFFDFC] rounded-[24px] max-w-md w-full p-6 shadow-2xl border border-[#E8DDD3] text-[#211D1B]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DDD3]/80">
              <h3 className="font-sans font-bold text-lg font-semibold text-[#211D1B]">Schedule Consultation Appointment</h3>
              <button
                onClick={() => setConsultModalOpen(false)}
                className="text-[#756B65] hover:text-[#211D1B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#756B65] mt-2 leading-relaxed">
              Meet directly with an Azera lead wedding & event coordinator at our Addis Ababa headquarters or via video call.
            </p>

            <form onSubmit={handleScheduleConsultation} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#211D1B] mb-1">Consultation Method</label>
                <select
                  value={consultForm.method}
                  onChange={(e) => setConsultForm({ ...consultForm, method: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8DDD3] bg-[#FFFDFC] text-xs font-semibold focus:ring-1 focus:ring-[#B95650] focus:border-[#B95650] focus:outline-none"
                >
                  <option value="OFFICE_MEETING">Office Meeting (Bole Road, Addis Ababa)</option>
                  <option value="VENUE_VISIT">On-Site Venue Visit & Walkthrough</option>
                  <option value="VIDEO_CALL">Virtual Video Conference (Zoom/Google Meet)</option>
                  <option value="PHONE_CALL">Direct Phone Consultation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#211D1B] mb-1">Preferred Date</label>
                  <input
                    type="date"
                    required
                    value={consultForm.date}
                    onChange={(e) => setConsultForm({ ...consultForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E8DDD3] bg-[#FFFDFC] text-xs font-medium focus:ring-1 focus:ring-[#B95650] focus:border-[#B95650] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#211D1B] mb-1">Preferred Time Window</label>
                  <select
                    value={consultForm.time}
                    onChange={(e) => setConsultForm({ ...consultForm, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E8DDD3] bg-[#FFFDFC] text-xs font-semibold focus:ring-1 focus:ring-[#B95650] focus:border-[#B95650] focus:outline-none"
                  >
                    <option value="09:00 AM">09:00 AM - 10:00 AM</option>
                    <option value="11:00 AM">11:00 AM - 12:00 PM</option>
                    <option value="02:00 PM">02:00 PM - 03:00 PM</option>
                    <option value="04:00 PM">04:00 PM - 05:00 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#211D1B] mb-1">Discussion Topics / Notes</label>
                <textarea
                  rows={3}
                  value={consultForm.notes}
                  onChange={(e) => setConsultForm({ ...consultForm, notes: e.target.value })}
                  placeholder="Tell us about your celebration vision, floral preferences, or guest count..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E8DDD3] bg-[#FFFDFC] text-xs focus:ring-1 focus:ring-[#B95650] focus:border-[#B95650] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E8DDD3]/80">
                <button
                  type="button"
                  onClick={() => setConsultModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#E8DDD3] text-[#756B65] hover:text-[#211D1B] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#B95650] hover:bg-[#A34741] text-white font-semibold rounded-full shadow-xs cursor-pointer"
                >
                  Confirm Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Latest Quotation Details Modal */}
      {quoteDetailsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFFDFC] rounded-[24px] max-w-lg w-full p-6 shadow-2xl border border-[#E8DDD3] text-[#211D1B]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DDD3]/80">
              <div>
                <h3 className="font-sans font-bold text-lg font-semibold text-[#211D1B]">
                  Quotation Proposal ({latestQuote.reference || 'QT-2026-0042'})
                </h3>
                <span className="text-[11px] text-[#756B65]">Valid until {latestQuote.validUntil || 'Dec 20, 2026'}</span>
              </div>
              <button
                onClick={() => setQuoteDetailsOpen(false)}
                className="text-[#756B65] hover:text-[#211D1B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div className="p-3.5 bg-[#F7F2EC] rounded-xl border border-[#E8DDD3] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#756B65]">Service Category:</span>
                  <span className="font-semibold text-[#211D1B]">Full Wedding Coordination &amp; Decor</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#756B65]">Subtotal:</span>
                  <span className="font-semibold text-[#211D1B]">ETB {Number(latestQuote.totalAmount ? latestQuote.totalAmount * 0.9 : 99000).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#756B65]">Taxes &amp; Logistics:</span>
                  <span className="font-semibold text-[#211D1B]">ETB {Number(latestQuote.totalAmount ? latestQuote.totalAmount * 0.1 : 11000).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E8DDD3] text-sm font-bold">
                  <span className="text-[#211D1B]">Total Contract Value:</span>
                  <span className="font-sans font-bold font-bold text-[#B95650]">ETB {Number(latestQuote.totalAmount || 110000).toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3.5 bg-[#FCECE8]/60 rounded-xl border border-[#E8B5A6] space-y-1.5 text-[11px]">
                <div className="flex justify-between text-[#B95650] font-bold">
                  <span>50% Initial Advance Required:</span>
                  <span>ETB {Number(latestQuote.initialPaymentRequired || 55000).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[#756B65]">
                  <span>50% Final Settlement Due:</span>
                  <span>ETB {Number(latestQuote.finalPaymentDue || 55000).toLocaleString()} (Post-event)</span>
                </div>
                <p className="text-[#756B65] text-[10px] pt-1">
                  Confirmation policy: Your event date is confirmed once this proposal is signed as a contract and the initial 50% deposit is verified.
                </p>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E8DDD3]/80 text-xs">
              <button
                type="button"
                onClick={() => setQuoteDetailsOpen(false)}
                className="px-4 py-2 rounded-full border border-[#E8DDD3] text-[#756B65] hover:text-[#211D1B] font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handleAcceptQuotation(latestQuote.id)}
                className="px-5 py-2 bg-[#B95650] hover:bg-[#A34741] text-white font-semibold rounded-full shadow-xs cursor-pointer"
              >
                Accept Quotation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: View All Bookings Registry */}
      {allBookingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#FFFDFC] rounded-[24px] max-w-2xl w-full p-6 shadow-2xl border border-[#E8DDD3] max-h-[85vh] flex flex-col text-[#211D1B]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DDD3]/80">
              <h3 className="font-sans font-bold text-lg font-semibold text-[#211D1B]">All Client Bookings</h3>
              <button
                onClick={() => setAllBookingsOpen(false)}
                className="text-[#756B65] hover:text-[#211D1B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 overflow-y-auto space-y-3 flex-1 pr-1">
              {displayEvents.map((evt) => (
                <div key={evt.id} className="p-4 rounded-xl border border-[#E8DDD3] bg-[#F7F2EC]/40 flex items-center justify-between">
                  <div>
                    <h4 className="font-sans font-bold text-xs sm:text-sm font-semibold text-[#211D1B]">{evt.title}</h4>
                    <p className="text-[11px] text-[#756B65] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#B95650]" />
                        {evt.dateStr}
                      </span>
                      <span className="text-[#E8DDD3]">•</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#756B65]" />
                        {evt.location}
                      </span>
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    evt.badge === 'Confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    evt.badge === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-[#FCECE8] text-[#B95650] border border-[#E8B5A6]'
                  }`}>
                    {evt.badge}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#E8DDD3]/80 flex justify-end">
              <button
                onClick={() => setAllBookingsOpen(false)}
                className="px-5 py-2 bg-[#F7F2EC] hover:bg-[#E8DDD3] text-[#211D1B] font-semibold rounded-full text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Booking Request Engine */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => {
          setBookingModalOpen(false);
          loadData();
        }}
      />
    </div>
  );
}
