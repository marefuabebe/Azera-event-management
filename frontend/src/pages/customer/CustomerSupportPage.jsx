import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Headphones,
  PhoneCall,
  Mail,
  MapPin,
  Send,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Clock,
  Sparkles,
  Copy,
  Check,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export default function CustomerSupportPage() {
  const { user } = useAuth();

  // Form State
  const [topic, setTopic] = useState('Booking Inquiry');
  const [selectedBooking, setSelectedBooking] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Bookings list for dropdown
  const [bookings, setBookings] = useState([]);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.getMyBookings();
        if (res && res.data && Array.isArray(res.data.bookings)) {
          setBookings(res.data.bookings);
        } else if (res && Array.isArray(res.data)) {
          setBookings(res.data);
        }
      } catch {
        setBookings([]);
      }
    };
    fetchBookings();
  }, []);

  const handleCopy = (text, type) => {
    navigator.clipboard?.writeText(text);
    if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setTimeout(() => {
      const ticketRef = `EVT-SUP-${Math.floor(1000 + Math.random() * 9000)}`;
      setSubmittedTicket({
        ticketId: ticketRef,
        topic,
        booking: selectedBooking || 'General Account',
        createdAt: 'Just now'
      });
      setMessage('');
      setSubmitting(false);
    }, 700);
  };

  const faqs = [
    {
      q: 'How do I reschedule or book a consultation?',
      a: 'You can view all available advisory slots directly from the Consultations page in the sidebar. Click "Book Consultation" or select an existing session to request a new date and time.'
    },
    {
      q: 'Which payment methods are accepted in Ethiopia?',
      a: 'We accept Commercial Bank of Ethiopia (CBE), Telebirr, Awash Bank, Chapa online debit/credit cards, and cash or cheque at our Bole Medhanialem executive lounge.'
    },
    {
      q: 'Can I request adjustments to an active quotation?',
      a: 'Yes! If you need to adjust catering numbers, décor themes, or photography packages, simply open your quotation and click "Request Changes" or send a note directly to your lead coordinator.'
    },
    {
      q: 'How do I get in direct contact with my coordinator?',
      a: 'Click "Messages" in your portal navigation to chat directly with your assigned coordinator and event management staff in real time.'
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-12">
      {/* Top Header */}
      <div className="flex items-start gap-4">
        <div className="w-13 h-13 rounded-2xl bg-[#FFF0F4] flex items-center justify-center shrink-0 border border-[#E8B5A6]/60 shadow-2xs">
          <Headphones className="w-6 h-6 text-[#B95650]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#211D1B] tracking-tight">
            Get Support
          </h1>
          <p className="text-xs sm:text-sm text-[#756B65] mt-1 font-normal leading-relaxed">
            Need assistance with your celebration, billing, or consultation? We are here for you.
          </p>
        </div>
      </div>

      {/* 3 Quick Direct Contact Channels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Phone Card */}
        <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)]/80 p-5 shadow-2xs hover:border-[#E8B5A6] transition-all text-left group">
          <div className="w-10 h-10 rounded-xl bg-[#FCECE8] text-[#B95650] flex items-center justify-center mb-3">
            <PhoneCall className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#211D1B]">Phone Support</h3>
          <p className="text-xs text-[#756B65] mt-0.5">Mon–Sat, 8:30 AM – 7:00 PM</p>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#E8DDD3]">
            <span className="text-xs font-bold text-[#211D1B] tracking-tight">+251 911 111 001</span>
            <button
              type="button"
              onClick={() => handleCopy('+251911111001', 'phone')}
              className="text-[11px] font-semibold text-[#B95650] hover:underline flex items-center gap-1 cursor-pointer"
            >
              {copiedPhone ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPhone ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Email Card */}
        <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)]/80 p-5 shadow-2xs hover:border-blue-200 transition-all text-left group">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Mail className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#211D1B]">Email Concierge</h3>
          <p className="text-xs text-[#756B65] mt-0.5">Fast reply within 2 business hours</p>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#E8DDD3]">
            <span className="text-xs font-bold text-[#211D1B] tracking-tight">support@azeraevents.com</span>
            <button
              type="button"
              onClick={() => handleCopy('support@azeraevents.com', 'email')}
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              {copiedEmail ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Office Location Card */}
        <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)]/80 p-5 shadow-2xs hover:border-emerald-200 transition-all text-left group">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <MapPin className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#211D1B]">Addis Ababa Office</h3>
          <p className="text-xs text-[#756B65] mt-0.5">Bole Medhanialem, Edna Mall Area</p>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#E8DDD3]">
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Walk-ins Welcome
            </span>
            <Link
              to="/portal/consultations"
              className="text-[11px] font-semibold text-emerald-600 hover:underline flex items-center gap-1"
            >
              <span>Book In-Person</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main 2-Column Balanced Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Send Support Request Form */}
        <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)]/80 shadow-2xs p-6 sm:p-7">
          <div className="pb-4 border-b border-[#E8DDD3] mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#211D1B]">Send a Message to Support</h3>
              <p className="text-xs text-[#756B65] mt-0.5">
                Our customer team will respond directly to your inquiry.
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#F7F2EC] flex items-center justify-center text-[#756B65]">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>

          {/* Submitted Ticket Success Banner */}
          {submittedTicket && (
            <div className="mb-5 p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-emerald-800 text-sm">
                    Inquiry Received — Ticket {submittedTicket.ticketId}
                  </div>
                  <p className="text-emerald-700 mt-1 leading-relaxed">
                    Thank you, {user?.fullName || 'Customer'}. We have routed your request regarding{' '}
                    <strong>{submittedTicket.topic}</strong> to our support coordinators. You will receive an
                    update shortly.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <Link
                      to="/portal/messages"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-colors inline-flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>View Messages</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSubmittedTicket(null)}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Send another inquiry
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Topic Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Support Topic
              </label>
              <div className="relative">
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full appearance-none pl-3.5 pr-10 py-2.5 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs sm:text-sm text-[#211D1B] font-semibold focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-all cursor-pointer"
                >
                  <option value="Booking Inquiry">Booking Inquiry & Date Changes</option>
                  <option value="Quotations & Pricing">Quotations, Customization & Pricing</option>
                  <option value="Payments & Invoicing">Payments, Receipts & Invoicing</option>
                  <option value="Consultation Scheduling">Consultation & Meeting Scheduling</option>
                  <option value="General Question">General Question or Feedback</option>
                </select>
                <ChevronDown className="w-4 h-4 text-[#756B65] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Related Event/Booking */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Related Event / Booking <span className="text-[#756B65] font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <select
                  value={selectedBooking}
                  onChange={(e) => setSelectedBooking(e.target.value)}
                  className="w-full appearance-none pl-3.5 pr-10 py-2.5 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs sm:text-sm text-[#211D1B] font-medium focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-all cursor-pointer"
                >
                  <option value="">General (Not tied to a specific celebration)</option>
                  {bookings.map((b) => (
                    <option key={b.id || b._id} value={b.eventName || b.title || b.id}>
                      {b.eventName || b.title || b.id} {b.bookingNumber ? `(${b.bookingNumber})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#756B65] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Message Area */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Your Message
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                placeholder="Explain how we can help you with your celebration..."
                className="w-full p-3.5 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs sm:text-sm text-[#211D1B] font-medium focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-all placeholder:text-[#756B65]"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="px-6 py-2.5 rounded-xl bg-[#B95650] hover:bg-[#a84842] text-white text-xs sm:text-sm font-bold shadow-xs shadow-[#B95650]/30 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4 text-white" />
                <span>{submitting ? 'Submitting...' : 'Send Support Request'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Frequently Asked Questions */}
        <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)]/80 shadow-2xs p-6 sm:p-7">
          <div className="pb-4 border-b border-[#E8DDD3] mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#211D1B]">Frequently Asked Questions</h3>
              <p className="text-xs text-[#756B65] mt-0.5">
                Instant answers to common customer questions.
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#F7F2EC] flex items-center justify-center text-[#756B65]">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isOpen ? 'border-[#E8B5A6] bg-[#FCECE8]/20 shadow-2xs' : 'border-[#E8DDD3]/80 bg-[#FFFDFC]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-bold text-[#211D1B]">
                      {faq.q}
                    </span>
                    <span className="shrink-0 text-[#756B65]">
                      {isOpen ? <ChevronUp className="w-4 h-4 text-[#B95650]" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs text-slate-600 leading-relaxed border-t border-[#E8B5A6]/60 font-normal">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Consultation Callout */}
          <div className="mt-6 p-4 rounded-2xl bg-gradient-to-tr from-[#F7F2EC] to-[#FCECE8]/40 border border-[#E8DDD3] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFFDFC] shadow-xs border border-[#E8B5A6] flex items-center justify-center text-[#B95650] shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#211D1B]">Need personalized planning advice?</h4>
                <p className="text-[11px] text-[#756B65]">Book a 30-minute consultation with a senior event director.</p>
              </div>
            </div>
            <Link
              to="/portal/consultations"
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shrink-0 shadow-2xs"
            >
              Schedule
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
