import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { isCustomerEmailUnverified, UNVERIFIED_ACTION_MESSAGE } from '../../utils/emailVerification';
import {
  CreditCard,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Printer,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Sparkles,
  MapPin,
  ChevronRight,
  HelpCircle,
  Camera,
  UtensilsCrossed,
  Music,
  Palette,
  X,
  FileCheck,
  Info
} from 'lucide-react';

export default function CustomerPaymentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected booking and context state
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [paymentContext, setPaymentContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [chapaLoading, setChapaLoading] = useState(false);
  const [chapaError, setChapaError] = useState('');

  // Modals state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);

  // Load payment context for a booking
  const loadPaymentContext = async (bId) => {
    if (!bId) return;
    setLoadingContext(true);
    setChapaError('');
    try {
      const res = await api.getPaymentContext(bId);
      if (res && res.success) {
        setPaymentContext(res.data);
      }
    } catch (err) {
      console.error('Failed to load payment context:', err);
    } finally {
      setLoadingContext(false);
    }
  };

  // Fetch payments and customer bookings
  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, bookingsRes] = await Promise.all([
        api.getMyPayments(),
        api.getBookings()
      ]);

      if (paymentsRes && paymentsRes.success && paymentsRes.data) {
        setPayments(paymentsRes.data.payments || []);
      } else {
        setPayments([]);
      }

      if (bookingsRes && bookingsRes.success && bookingsRes.data) {
        const customerBookings = bookingsRes.data.bookings || [];
        setBookings(customerBookings);

        if (customerBookings.length > 0) {
          const initialId =
            selectedBookingId ||
            customerBookings.find((b) => b.contracts && b.contracts.length > 0)?.id ||
            customerBookings[0].id;
          setSelectedBookingId(initialId);
          await loadPaymentContext(initialId);
        }
      }
    } catch (err) {
      console.error('Failed to load payments or bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format currency
  const formatETB = (val) => {
    const num = parseFloat(val || 0);
    return `ETB ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const formatRawNumber = (val) => {
    const num = parseFloat(val || 0);
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Format date helper with fallback
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date to be scheduled';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Date to be scheduled';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Date to be scheduled';
    }
  };

  // Cover image helper based on real event type
  const getEventCoverImage = (eventType) => {
    switch (eventType) {
      case 'WEDDING':
        return 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=300&q=80';
      case 'BIRTHDAY':
        return 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=300&q=80';
      case 'CORPORATE':
      case 'CONFERENCE':
        return 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=300&q=80';
      case 'ANNIVERSARY':
      case 'GALA':
        return 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=300&q=80';
      default:
        return 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=300&q=80';
    }
  };

  // Data helpers from real context
  const currentBooking = paymentContext?.booking || bookings.find((b) => b.id === selectedBookingId) || bookings[0];
  const currentContract = paymentContext?.contract;
  const financials = paymentContext?.financials;

  // Real financial figures strictly from database context (no mock defaults)
  const totalContractValue = financials
    ? financials.contractTotal
    : currentContract
    ? parseFloat(currentContract.totalAmount || 0)
    : currentBooking?.quotationTotal
    ? parseFloat(currentBooking.quotationTotal)
    : currentBooking?.budgetEstimate
    ? parseFloat(currentBooking.budgetEstimate)
    : 0;

  const initialDepositRequired = financials
    ? financials.initialDepositRequired
    : Math.floor(totalContractValue * 0.5);

  const remainingBalance = financials
    ? financials.remainingBalance
    : Math.max(0, totalContractValue - (financials?.totalVerifiedPaid || 0));

  const verifiedPaidSoFar = financials
    ? financials.totalVerifiedPaid
    : payments
        .filter((p) => p.status === 'VERIFIED' && (!selectedBookingId || p.bookingId === selectedBookingId))
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const amountDueNow = financials
    ? financials.amountDueNow
    : Math.max(0, initialDepositRequired - verifiedPaidSoFar);

  // Real services from database context or contract service snapshots (no mocked items)
  const displayServices = paymentContext?.services || currentContract?.serviceSnapshots || [];

  // Map service icon
  const getServiceIcon = (name = '', category = '') => {
    const lower = `${name} ${category}`.toLowerCase();
    if (lower.includes('photo') || lower.includes('camera') || lower.includes('video') || lower.includes('cinemat')) {
      return <Camera className="w-4 h-4 text-[#B95650]" />;
    }
    if (lower.includes('cater') || lower.includes('food') || lower.includes('buffet') || lower.includes('meal') || lower.includes('cake') || lower.includes('dessert') || lower.includes('banquet')) {
      return <UtensilsCrossed className="w-4 h-4 text-[#B95650]" />;
    }
    if (lower.includes('music') || lower.includes('sound') || lower.includes('acoustic') || lower.includes('dj') || lower.includes('band')) {
      return <Music className="w-4 h-4 text-[#B95650]" />;
    }
    if (lower.includes('decor') || lower.includes('flower') || lower.includes('stage') || lower.includes('floral') || lower.includes('balloon')) {
      return <Palette className="w-4 h-4 text-[#B95650]" />;
    }
    return <Sparkles className="w-4 h-4 text-[#B95650]" />;
  };

  const isDepositCompleted = verifiedPaidSoFar >= initialDepositRequired && initialDepositRequired > 0;

  // Real payment status flags for current booking
  const bookingPayments = payments.filter((p) => !selectedBookingId || p.bookingId === selectedBookingId);
  const hasSubmittedPayment = bookingPayments.some((p) => p.status === 'SUBMITTED');
  const hasAnyPayment = bookingPayments.length > 0;
  const isBookingConfirmed = currentBooking?.status === 'CONFIRMED' || currentBooking?.status === 'COMPLETED';

  // Handle Pay with Chapa online checkout
  const handlePayWithChapa = async () => {
    if (!paymentContext || !paymentContext.financials?.canPay) return;
    if (isCustomerEmailUnverified(user)) {
      setChapaError(UNVERIFIED_ACTION_MESSAGE);
      return;
    }
    setChapaLoading(true);
    setChapaError('');

    try {
      const res = await api.initializeChapaPayment({
        bookingId: paymentContext.booking.id,
        paymentType: paymentContext.financials.currentStage
      });

      if (res && res.success && res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        setChapaError(res?.message || 'Could not initialize online checkout. Please try again.');
        setChapaLoading(false);
      }
    } catch (err) {
      console.error('Chapa initialization error:', err);
      setChapaError(err.message || 'Failed to initialize online payment session.');
      setChapaLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in font-sans">
      {/* =========================================================================
          PAGE TITLE & CELEBRATION SELECTOR
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[#211D1B] tracking-tight">
            Make Payment
          </h1>
          <p className="text-xs sm:text-sm text-[#756B65] mt-1">
            Complete your initial payment to confirm your booking and move forward with your event.
          </p>
        </div>

        {bookings.length > 1 && (
          <div className="flex items-center gap-2 self-start sm:self-auto bg-[#FFFDFC] p-1.5 px-3 rounded-2xl border border-[#E8DDD3]/80 shadow-2xs">
            <span className="text-[11px] font-bold text-[#756B65] uppercase tracking-wider">
              Event:
            </span>
            <select
              value={selectedBookingId}
              onChange={(e) => {
                setSelectedBookingId(e.target.value);
                loadPaymentContext(e.target.value);
              }}
              className="text-xs font-bold text-[#211D1B] bg-transparent focus:outline-none cursor-pointer"
            >
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.reference} — {b.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* =========================================================================
          MAIN CONTENT / EMPTY STATE
          ========================================================================= */}
      {bookings.length === 0 && payments.length === 0 ? (
        <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8DDD3] p-12 text-center max-w-xl mx-auto shadow-2xs my-6">
          <div className="w-16 h-16 rounded-2xl bg-[#FCECE8] text-[#B95650] border border-[#E8B5A6] flex items-center justify-center mx-auto mb-4 shadow-xs">
            <CreditCard className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-[#211D1B]">No payments due</h2>
          <p className="text-xs text-[#756B65] mt-1.5 mb-6 max-w-md mx-auto leading-relaxed">
            Payment schedules and online checkout options unlock automatically once you receive and accept your celebration quotation and sign your event agreement.
          </p>
          <Link
            to="/portal/bookings"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B95650] hover:bg-[#a84842] text-white text-xs font-bold rounded-xl shadow-md shadow-[#B95650]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>View Booking Requests</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =======================================================================
            LEFT COLUMN: 4 Step Cards (Col-Span 8)
            ======================================================================= */}
        <div className="lg:col-span-8 space-y-6">
          {/* ---------------------------------------------------------------------
              CARD 1: Booking & Contract Information
              --------------------------------------------------------------------- */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-[#211D1B]">
              1. Booking & Contract Information
            </h2>
            <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)]/80 p-5 shadow-xs flex flex-col sm:flex-row justify-between gap-5">
              {/* Left Details: Image + Title + Location + Date + Badge */}
              <div className="flex items-start gap-4">
                <img
                  src={getEventCoverImage(currentBooking?.eventType)}
                  alt={currentBooking?.title || 'Celebration Event'}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 border border-[#E8DDD3] shadow-2xs"
                />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#211D1B] leading-snug">
                    {currentBooking?.title || 'Celebration Event'}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-[#756B65]">
                    <MapPin className="w-3.5 h-3.5 text-[#756B65] shrink-0" />
                    <span>
                      {currentBooking?.locationName
                        ? `${currentBooking.locationName}${currentBooking?.city ? `, ${currentBooking.city}` : ''}`
                        : 'Venue to be confirmed'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#756B65]">
                    <Calendar className="w-3.5 h-3.5 text-[#756B65] shrink-0" />
                    <span>
                      {formatDate(currentBooking?.preferredDate)}
                    </span>
                  </div>

                  <div className="pt-1">
                    {currentContract?.status === 'SIGNED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Contract Signed
                      </span>
                    ) : currentContract?.status === 'PARTIALLY_SIGNED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Awaiting Execution
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-[#E8DDD3]">
                        <FileText className="w-3 h-3 text-[#756B65]" />
                        Contract Pending Execution
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Stack: Booking Ref, Contract No, Quotation No */}
              <div className="sm:text-right space-y-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E8DDD3] shrink-0">
                <div>
                  <span className="text-[11px] text-[#756B65] block font-medium">Booking Ref</span>
                  <span className="text-xs font-bold text-[#211D1B] font-mono">
                    {currentBooking?.reference || 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-[#756B65] block font-medium">Contract No</span>
                  <span className="text-xs font-bold text-[#211D1B] font-mono">
                    {currentContract ? (
                      <>
                        {currentContract.contractNumber}{' '}
                        <span className="text-[#756B65] font-normal font-sans">
                          (v{Number(currentContract.version || 1).toFixed(1)})
                        </span>
                      </>
                    ) : (
                      <span className="text-[#756B65] font-sans font-normal italic">
                        Pending Execution
                      </span>
                    )}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-[#756B65] block font-medium">Quotation No</span>
                  <span className="text-xs font-bold text-[#211D1B] font-mono">
                    {currentBooking?.quotationNumber ? (
                      currentBooking.quotationNumber
                    ) : (
                      <span className="text-[#756B65] font-sans font-normal italic">
                        Pending Preparation
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------------
              CARD 2: Services Included in Your Contract (Real-Time Synchronized)
              --------------------------------------------------------------------- */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#211D1B]">
                2. Services Included in Your Contract
              </h2>
              {currentContract && (
                <span className="text-[11px] font-semibold text-[#756B65]">
                  Synchronized with {currentContract.contractNumber}
                </span>
              )}
            </div>

            {displayServices.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2 bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)]/80 shadow-xs">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-[#756B65]">
                  <Sparkles className="w-5 h-5 text-[#756B65]" />
                </div>
                <p className="text-sm font-bold text-[#211D1B]">
                  Services Finalization in Progress
                </p>
                <p className="text-xs text-[#756B65] max-w-md mx-auto">
                  {currentContract
                    ? 'Services will appear here once itemized by your event coordinator.'
                    : 'Your dedicated Azera coordinator is currently compiling your custom service catalog and quotation.'}
                </p>
              </div>
            ) : (
              <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)]/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E8DDD3] text-[11px] font-bold text-[#756B65] bg-[#F7F2EC]">
                        <th className="py-3 px-5 font-bold">Service</th>
                        <th className="py-3 px-5 font-bold">Description</th>
                        <th className="py-3 px-5 font-bold">Qty / Duration</th>
                        <th className="py-3 px-5 font-bold text-right">Price (ETB)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8DDD3]/50 text-xs">
                      {displayServices.map((srv, idx) => (
                        <tr key={srv.id || idx} className="hover:bg-[#F7F2EC]/40 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#FCECE8] flex items-center justify-center shrink-0">
                                {getServiceIcon(srv.serviceName || srv.serviceTitle, srv.category)}
                              </div>
                              <span className="font-semibold text-[#211D1B] text-xs md:text-sm">
                                {srv.serviceName || srv.serviceTitle}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-[#756B65] max-w-xs truncate">
                            {srv.description || srv.deliverables || 'Standard professional execution'}
                          </td>
                          <td className="py-3.5 px-5 text-slate-600 font-medium">
                            {srv.quantity ? `${srv.quantity} ${srv.unit || 'Event'}` : '1 Event'}
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-[#211D1B] font-mono">
                            {formatRawNumber(srv.subtotal || srv.lineTotal || srv.unitPrice || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#E8DDD3] bg-[#FFFDFC]">
                        <td colSpan={3} className="py-4 px-5 text-sm font-bold text-[#211D1B]">
                          {currentContract ? 'Contract Total' : 'Quotation Total'}
                        </td>
                        <td className="py-4 px-5 text-right text-base font-black text-[#211D1B] font-mono">
                          {formatRawNumber(totalContractValue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* =======================================================================
            RIGHT COLUMN: Sidebar Widgets (Col-Span 4)
            ======================================================================= */}
        <div className="lg:col-span-4 space-y-5">
          {/* ---------------------------------------------------------------------
              WIDGET 1: Payment Status (Real Database Status)
              --------------------------------------------------------------------- */}
          <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)]/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#211D1B]">Payment Status</h3>
              {isBookingConfirmed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Confirmed
                </span>
              ) : isDepositCompleted ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Deposit Verified
                </span>
              ) : hasSubmittedPayment ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="w-3 h-3 text-amber-600" />
                  Under Review
                </span>
              ) : !currentContract || currentContract.status !== 'SIGNED' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-[#E8DDD3]">
                  <FileText className="w-3 h-3 text-[#756B65]" />
                  Contract Pending
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="w-3 h-3 text-amber-600" />
                  Pending
                </span>
              )}
            </div>

            <p className="text-xs text-[#756B65]">
              {isBookingConfirmed
                ? 'Your booking is confirmed and event preparations are underway.'
                : isDepositCompleted
                ? 'Your initial 50% deposit has been verified.'
                : hasSubmittedPayment
                ? 'Your payment has been received and is undergoing finance review.'
                : !currentContract || currentContract.status !== 'SIGNED'
                ? 'A signed event contract is required before payment can proceed.'
                : 'Your initial payment is due to confirm your booking.'}
            </p>

            {/* Stepper Timeline - Real Dynamic Progression */}
            <div className="space-y-4 pt-1">
              {/* Step 1: Payment Initiated */}
              <div className="flex items-start gap-3 relative">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
                    hasAnyPayment || hasSubmittedPayment || verifiedPaidSoFar > 0
                      ? 'bg-[#B95650] text-white shadow-2xs'
                      : 'bg-slate-100 text-[#756B65]'
                  }`}
                >
                  1
                </div>
                <div className="pt-0.5">
                  <p
                    className={`text-xs ${
                      hasAnyPayment || hasSubmittedPayment || verifiedPaidSoFar > 0
                        ? 'font-bold text-[#211D1B]'
                        : 'text-[#756B65] font-medium'
                    }`}
                  >
                    Payment Initiated
                  </p>
                </div>
                {/* Vertical Line */}
                <div className="absolute left-3 top-6 w-0.5 h-6 bg-slate-200 -translate-x-1/2"></div>
              </div>

              {/* Step 2: Processing */}
              <div className="flex items-start gap-3 relative">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
                    hasSubmittedPayment || isDepositCompleted || verifiedPaidSoFar > 0
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-[#756B65]'
                  }`}
                >
                  2
                </div>
                <div className="pt-0.5">
                  <p
                    className={`text-xs ${
                      hasSubmittedPayment || isDepositCompleted || verifiedPaidSoFar > 0
                        ? 'font-bold text-[#211D1B]'
                        : 'text-[#756B65] font-medium'
                    }`}
                  >
                    Processing
                  </p>
                </div>
                {/* Vertical Line */}
                <div className="absolute left-3 top-6 w-0.5 h-6 bg-slate-200 -translate-x-1/2"></div>
              </div>

              {/* Step 3: Verified */}
              <div className="flex items-start gap-3 relative">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
                    isDepositCompleted || verifiedPaidSoFar > 0
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-[#756B65]'
                  }`}
                >
                  3
                </div>
                <div className="pt-0.5">
                  <p
                    className={`text-xs ${
                      isDepositCompleted || verifiedPaidSoFar > 0
                        ? 'font-bold text-[#211D1B]'
                        : 'text-[#756B65] font-medium'
                    }`}
                  >
                    Verified
                  </p>
                </div>
                {/* Vertical Line */}
                <div className="absolute left-3 top-6 w-0.5 h-6 bg-slate-200 -translate-x-1/2"></div>
              </div>

              {/* Step 4: Booking Confirmed */}
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
                    isBookingConfirmed
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-[#756B65]'
                  }`}
                >
                  4
                </div>
                <div className="pt-0.5">
                  <p
                    className={`text-xs ${
                      isBookingConfirmed ? 'font-bold text-[#211D1B]' : 'text-[#756B65] font-medium'
                    }`}
                  >
                    Booking Confirmed
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------------
              WIDGET 2: Quick Links (Direct online access only)
              --------------------------------------------------------------------- */}
          <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)]/80 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-[#211D1B]">Quick Links</h3>

            <div className="divide-y divide-[#E8DDD3]/50 text-xs">
              {/* Link 1: View Contract */}
              <button
                onClick={() => {
                  if (currentContract) {
                    setContractModalOpen(true);
                  } else {
                    navigate('/portal/contracts');
                  }
                }}
                className="w-full flex items-center justify-between py-3 hover:text-[#B95650] transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FCECE8] text-[#B95650] flex items-center justify-center shrink-0 group-hover:bg-[#B95650] group-hover:text-white transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-[#211D1B] group-hover:text-[#B95650] transition-colors block">
                      View Contract
                    </span>
                    <span className="text-[11px] text-[#756B65] block">
                      Download or preview your contract
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#B95650] group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Link 2: Payment History */}
              <button
                onClick={() => setHistoryModalOpen(true)}
                className="w-full flex items-center justify-between py-3 hover:text-[#B95650] transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FCECE8] text-[#B95650] flex items-center justify-center shrink-0 group-hover:bg-[#B95650] group-hover:text-white transition-colors">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-[#211D1B] group-hover:text-[#B95650] transition-colors block">
                      Payment History
                    </span>
                    <span className="text-[11px] text-[#756B65] block">
                      See all your payments and receipts
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#B95650] group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Link 3: Contact Support */}
              <Link
                to="/portal/consultations"
                className="w-full flex items-center justify-between py-3 hover:text-[#B95650] transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FCECE8] text-[#B95650] flex items-center justify-center shrink-0 group-hover:bg-[#B95650] group-hover:text-white transition-colors">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-[#211D1B] group-hover:text-[#B95650] transition-colors block">
                      Contact Support
                    </span>
                    <span className="text-[11px] text-[#756B65] block">
                      Get help with your payment
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#B95650] group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          {/* ---------------------------------------------------------------------
              WIDGET 3: Secure & Safe
              --------------------------------------------------------------------- */}
          <div className="bg-[#FCECE8]/40 border border-[#E8B5A6] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#B95650]" />
              <h3 className="text-xs font-bold text-[#211D1B]">Secure & Safe</h3>
            </div>

            <p className="text-xs text-[#756B65] leading-relaxed">
              Your payment information is protected with bank-level security and Chapa&apos;s trusted platform.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <div className="w-6 h-6 rounded-full bg-[#1C1F37] flex items-center justify-center shrink-0">
                <svg className="w-2.5 h-2.5 fill-white ml-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="text-sm font-black tracking-tight text-[#211D1B]">
                Chapa
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 2: PAYMENT SUMMARY & PAYMENT METHOD (SIDE-BY-SIDE FULL WIDTH)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* ---------------------------------------------------------------------
            CARD 3: Payment Summary (Real-Time Calculation)
            --------------------------------------------------------------------- */}
        <section className="space-y-2 flex flex-col">
          <h2 className="text-sm font-bold text-[#211D1B]">
            3. Payment Summary
          </h2>
          <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)]/80 p-5 shadow-xs flex-1 flex flex-col justify-between space-y-4">
            {/* Payment Schedule Banner */}
            <div className="bg-[#FCECE8]/70 border border-[#E8B5A6] rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#B95650] flex items-center justify-center text-white shrink-0 shadow-2xs">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#211D1B]">Payment Schedule</div>
                <div className="text-xs text-[#756B65]">
                  50% before the event &nbsp;|&nbsp; 50% after services are completed
                </div>
              </div>
            </div>

            {/* Informational notice when contract signature is pending */}
            {(!currentContract || currentContract.status !== 'SIGNED') && (
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {paymentContext?.financials?.paymentEligibilityReason ||
                    'Payment will unlock once your master event contract is signed by all parties.'}
                </span>
              </div>
            )}

            {/* 3 Metric Columns: Contract Total, Initial Payment (50%), Remaining Balance */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <p className="text-[11px] text-[#756B65] font-medium">
                  {currentContract ? 'Contract Total' : 'Quotation Total'}
                </p>
                <p className="text-base sm:text-lg font-black text-[#211D1B] mt-0.5 font-mono">
                  {formatETB(totalContractValue)}
                </p>
              </div>

              <div>
                <p className="text-[11px] text-[#756B65] font-medium">Initial Payment (50%)</p>
                <p className="text-base sm:text-lg font-black text-[#211D1B] mt-0.5 font-mono">
                  {formatETB(initialDepositRequired)}
                </p>
              </div>

              <div>
                <p className="text-[11px] text-[#756B65] font-medium">Remaining Balance</p>
                <p className="text-base sm:text-lg font-black text-[#211D1B] mt-0.5 font-mono">
                  {formatETB(remainingBalance)}
                </p>
              </div>
            </div>

            {/* Bottom 2 Summary Pills: Already Paid & Amount Due Now */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#E8DDD3] mt-auto">
              {/* Already Paid (Verified) */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F7F2EC]/60 border border-[#E8DDD3]">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-[#756B65] font-medium block">
                    Already Paid (Verified)
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#211D1B] font-mono">
                    {formatETB(verifiedPaidSoFar)}
                  </span>
                </div>
              </div>

              {/* Amount Due Now */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FCECE8]/50 border border-[#E8B5A6]">
                <div className="w-8 h-8 rounded-full bg-[#FCECE8] text-[#B95650] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-[#756B65] font-medium block">
                    Amount Due Now
                  </span>
                  <span className="text-sm sm:text-base font-black text-[#B95650] font-mono">
                    {formatETB(amountDueNow)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------------
            CARD 4: Payment Method (Chapa Online Checkout)
            --------------------------------------------------------------------- */}
        <section className="space-y-2 flex flex-col">
          <h2 className="text-sm font-bold text-[#211D1B]">
            4. Payment Method
          </h2>

          <div className="bg-[#FFFDFC] rounded-2xl border border-[#E8DDD3] shadow-[0_4px_16px_rgba(33,29,27,0.03)]/80 p-5 shadow-xs flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1C1F37] flex items-center justify-center shrink-0 shadow-xs">
                    <svg className="w-4 h-4 fill-white ml-0.5" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black tracking-tight text-[#211D1B]">
                        Chapa
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Instant Confirmation
                      </span>
                    </div>
                    <p className="text-[11px] text-[#756B65] mt-0.5">
                      Premier digital payment infrastructure for Ethiopia
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Pay securely with Chapa. You will be redirected to Chapa&apos;s checkout page to complete your payment using Telebirr, CBE Birr, cards, or mobile banking.
              </p>

              {/* Accepted Methods 4-Pill Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="p-2 bg-[#F7F2EC]/80 rounded-lg border border-[#E8DDD3]/70 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                  <span className="font-semibold text-[#211D1B] text-[10px] truncate">Telebirr</span>
                </div>
                <div className="p-2 bg-[#F7F2EC]/80 rounded-lg border border-[#E8DDD3]/70 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                  <span className="font-semibold text-[#211D1B] text-[10px] truncate">CBE Birr</span>
                </div>
                <div className="p-2 bg-[#F7F2EC]/80 rounded-lg border border-[#E8DDD3]/70 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></div>
                  <span className="font-semibold text-[#211D1B] text-[10px] truncate">Awash Birr</span>
                </div>
                <div className="p-2 bg-[#F7F2EC]/80 rounded-lg border border-[#E8DDD3]/70 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
                  <span className="font-semibold text-[#211D1B] text-[10px] truncate">Visa / MC</span>
                </div>
              </div>
            </div>

            {chapaError && (
              <div className="p-3 rounded-xl bg-[#FCECE8] border border-[#E8B5A6] text-[#B95650] text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{chapaError}</span>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-[#E8DDD3] mt-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={handlePayWithChapa}
                disabled={
                  chapaLoading ||
                  loadingContext ||
                  !currentContract ||
                  currentContract.status !== 'SIGNED' ||
                  isDepositCompleted
                }
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                  !currentContract || currentContract.status !== 'SIGNED'
                    ? 'bg-slate-300 cursor-not-allowed text-[#756B65]'
                    : isDepositCompleted
                    ? 'bg-slate-300 cursor-not-allowed text-slate-600'
                    : chapaLoading
                    ? 'bg-[#B95650]/80 cursor-wait'
                    : 'bg-[#B95650] hover:bg-[#D9003E] active:scale-[0.98]'
                }`}
              >
                {chapaLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting to Chapa...</span>
                  </>
                ) : !currentContract || currentContract.status !== 'SIGNED' ? (
                  <>
                    <FileText className="w-4 h-4 text-[#756B65]" />
                    <span>Contract Signing Required to Pay</span>
                  </>
                ) : isDepositCompleted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Initial 50% Deposit Paid</span>
                  </>
                ) : (
                  <>
                    <span>Pay with Chapa ({formatETB(amountDueNow)})</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </>
                )}
              </button>

              <div className="flex items-center gap-1.5 text-xs text-[#756B65]">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-[11px]">256-bit Encrypted Checkout</span>
              </div>
            </div>
          </div>
        </section>
      </div>
      </>
      )}

      {/* =========================================================================
          PAGE FOOTER
          ========================================================================= */}
      <footer className="pt-10 pb-6 border-t border-[#E8DDD3]/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#756B65]">
        <div>© 2026 Azera. All rights reserved.</div>
        <div className="flex items-center gap-3">
          <span>Elegant Events</span>
          <span>•</span>
          <span>Professional Planning</span>
          <span>•</span>
          <span>Unforgettable Moments</span>
        </div>
      </footer>

      {/* =========================================================================
          MODAL 1: PAYMENT HISTORY & RECEIPTS MODAL
          ========================================================================= */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFDFC] rounded-2xl shadow-2xl border border-[#E8DDD3] w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-[#E8DDD3] flex items-center justify-between bg-[#F7F2EC]/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FCECE8] text-[#B95650] flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#211D1B]">Payment History & Verified Ledger</h3>
                  <p className="text-[11px] text-[#756B65]">All recorded milestone deposits and electronic receipts</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1 rounded-lg text-[#756B65] hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {payments.length === 0 ? (
                <div className="text-center py-12 text-[#756B65]">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No payment records found</p>
                  <p className="text-[11px] text-[#756B65] mt-0.5">
                    Your payments will appear here once initiated or verified.
                  </p>
                </div>
              ) : (
                <div className="border border-[#E8DDD3]/80 rounded-xl overflow-hidden divide-y divide-[#E8DDD3]/50 text-xs">
                  {payments.map((p) => (
                    <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F7F2EC]/50/60 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#211D1B]">
                            {p.paymentType === 'INITIAL_50_PERCENT' ? '50% Initial Deposit' : '50% Final Settlement'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.status === 'VERIFIED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.status === 'SUBMITTED'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#756B65] font-mono">
                          Ref: {p.externalReference} &nbsp;|&nbsp; {p.paymentMethod} &nbsp;|&nbsp; {formatDate(p.paymentDate || p.createdAt)}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:text-right">
                        <div>
                          <div className="text-sm font-black text-[#211D1B] font-mono">
                            {formatETB(p.amount)}
                          </div>
                          <div className="text-[10px] text-[#756B65]">
                            {p.receipt?.receiptNumber ? `Receipt: ${p.receipt.receiptNumber}` : 'Pending audit'}
                          </div>
                        </div>

                        {p.status === 'VERIFIED' && (
                          <button
                            onClick={() => {
                              setSelectedReceiptPayment(p);
                              setReceiptModalOpen(true);
                            }}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-[#FCECE8] text-slate-600 hover:text-[#B95650] transition-colors"
                            title="View Receipt Voucher"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-[#E8DDD3] bg-[#F7F2EC] flex justify-end">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E8DDD3] text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: OFFICIAL ELECTRONIC RECEIPT VOUCHER
          ========================================================================= */}
      {receiptModalOpen && selectedReceiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFDFC] rounded-2xl shadow-2xl border border-[#E8DDD3] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-[#E8DDD3] flex items-center justify-between bg-[#F7F2EC]/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#B95650]/10 text-[#B95650] flex items-center justify-center">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#211D1B]">Electronic Payment Receipt</h3>
                  <p className="text-[11px] text-[#756B65] font-mono">
                    {selectedReceiptPayment.receipt?.receiptNumber || 'REC-OFFICIAL'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="p-1 rounded-lg text-[#756B65] hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Issuer details */}
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-[#E8DDD3]">
                <div>
                  <span className="text-[10px] font-bold text-[#756B65] uppercase tracking-wider block">Issued By</span>
                  <span className="text-xs font-bold text-[#211D1B] block mt-0.5">Azera Celebrations PLC</span>
                  <span className="text-[11px] text-[#756B65]">Bole Airport Road, Addis Ababa</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-[#756B65] uppercase tracking-wider block">Status</span>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    VERIFIED & CLEARED
                  </span>
                </div>
              </div>

              {/* Booking reference */}
              <div className="bg-[#F7F2EC] p-3.5 rounded-xl border border-[#E8DDD3]/80 space-y-1">
                <span className="text-[10px] font-bold text-[#756B65] uppercase tracking-wider block">Celebration</span>
                <span className="text-xs font-bold text-[#211D1B] block">
                  {selectedReceiptPayment.booking?.title || currentBooking?.title}
                </span>
                <span className="text-[11px] text-[#756B65] font-mono">
                  Ref: {selectedReceiptPayment.booking?.reference || currentBooking?.reference}
                </span>
              </div>

              {/* Particulars breakdown */}
              <div className="border border-[#E8DDD3]/80 rounded-xl overflow-hidden divide-y divide-[#E8DDD3]/50">
                <div className="flex justify-between p-3 bg-[#FFFDFC]">
                  <span className="text-[#756B65]">Payment Stage</span>
                  <span className="font-semibold text-[#211D1B]">
                    {selectedReceiptPayment.paymentType === 'INITIAL_50_PERCENT' ? '50% Initial Deposit' : '50% Final Settlement'}
                  </span>
                </div>

                <div className="flex justify-between p-3 bg-[#FFFDFC]">
                  <span className="text-[#756B65]">Payment Channel</span>
                  <span className="font-semibold text-[#211D1B]">
                    {selectedReceiptPayment.paymentMethod === 'CHAPA'
                      ? 'Chapa Gateway (Online)'
                      : selectedReceiptPayment.paymentMethod}
                  </span>
                </div>

                <div className="flex justify-between p-3 bg-[#FFFDFC]">
                  <span className="text-[#756B65]">Transaction Reference</span>
                  <span className="font-mono font-bold text-[#211D1B]">
                    {selectedReceiptPayment.externalReference}
                  </span>
                </div>

                <div className="flex justify-between p-3.5 bg-emerald-50/50">
                  <span className="font-bold text-[#211D1B]">Amount Cleared</span>
                  <span className="font-black text-[#211D1B] font-mono text-sm">
                    {formatETB(selectedReceiptPayment.amount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-[#E8DDD3] bg-[#F7F2EC] flex items-center justify-between shrink-0">
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E8DDD3] text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B95650] hover:bg-[#D9003E] text-white text-xs font-bold transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: MASTER CONTRACT PREVIEW MODAL
          ========================================================================= */}
      {contractModalOpen && currentContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFDFC] rounded-2xl shadow-2xl border border-[#E8DDD3] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-[#E8DDD3] flex items-center justify-between bg-[#F7F2EC]/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#B95650]/10 text-[#B95650] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#211D1B]">Master Service Contract</h3>
                  <p className="text-[11px] text-[#756B65] font-mono">
                    {currentContract.contractNumber || `CT-${currentBooking?.reference || '2026-0001'}`} (v{currentContract.version ? Number(currentContract.version).toFixed(1) : '1.0'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setContractModalOpen(false)}
                className="p-1 rounded-lg text-[#756B65] hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="p-4 bg-[#F7F2EC] rounded-xl border border-[#E8DDD3]/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#211D1B]">{currentBooking?.title || 'Wedding Celebration'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FCECE8] text-[#B95650] border border-[#E8B5A6]">
                    {currentContract.status || 'SIGNED'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] text-slate-600">
                  <div>
                    <span className="text-[#756B65] block">Total Contract Value:</span>
                    <span className="font-bold text-[#211D1B] font-mono">{formatETB(currentContract.totalAmount)}</span>
                  </div>
                  <div>
                    <span className="text-[#756B65] block">Initial 50% Deposit:</span>
                    <span className="font-bold text-[#211D1B] font-mono">{formatETB(currentContract.initialPaymentAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="border border-[#E8DDD3]/80 rounded-xl overflow-hidden divide-y divide-[#E8DDD3]/50">
                <div className="p-3 bg-[#F7F2EC]/80 font-bold text-slate-700">Approved Scope & Service Schedule</div>
                {displayServices.map((s, idx) => (
                  <div key={idx} className="p-3 flex justify-between items-center bg-[#FFFDFC]">
                    <div>
                      <span className="font-semibold text-[#211D1B] block">{s.serviceName || s.serviceTitle}</span>
                      <span className="text-[11px] text-[#756B65]">{s.description}</span>
                    </div>
                    <span className="font-bold text-[#211D1B] font-mono">{formatRawNumber(s.subtotal || s.lineTotal || s.unitPrice)} ETB</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-[#E8DDD3] bg-[#F7F2EC] flex justify-between items-center shrink-0">
              <Link
                to="/portal/contracts"
                className="text-xs font-bold text-[#B95650] hover:underline"
              >
                Go to Contracts Center →
              </Link>
              <button
                onClick={() => setContractModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E8DDD3] text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
