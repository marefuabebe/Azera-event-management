import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ArrowRight,
  Receipt,
  FileText,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const txRef = searchParams.get('tx_ref') || searchParams.get('trx_ref');

  const [verifying, setVerifying] = useState(true);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState(null);

  const verifyPayment = async () => {
    if (!txRef) {
      setError('No transaction reference found in callback parameters.');
      setVerifying(false);
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const res = await api.verifyChapaPayment(txRef);
      if (res && res.success) {
        setVerificationResult(res.data);
      } else {
        setError(res?.message || 'Verification could not be confirmed.');
      }
    } catch (err) {
      console.error('Payment verification error:', err);
      setError(err.message || 'Payment verification failed. Please try again or contact support.');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    verifyPayment();
  }, [txRef]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full">
        {/* MAIN CARD */}
        <div className="bg-[#111C44]/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div
            className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
              verifying
                ? 'bg-blue-500'
                : error
                ? 'bg-red-500'
                : 'bg-emerald-500'
            }`}
          />

          {/* 1. VERIFYING STATE */}
          {verifying && (
            <div className="text-center py-10 space-y-4">
              <div className="inline-flex p-4 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 animate-spin">
                <RefreshCw className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                Verifying Payment Transaction...
              </h2>
              <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                Communicating with the payment gateway to confirm settlement of transaction{' '}
                <span className="font-mono text-slate-300 font-semibold">{txRef || '...'}</span>.
              </p>
            </div>
          )}

          {/* 2. SUCCESS STATE */}
          {!verifying && verificationResult && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-wide">
                  Payment Verified Successfully!
                </h2>
                <p className="text-sm text-slate-300">
                  Your payment has been successfully processed and verified.
                </p>
              </div>

              {/* RECEIPT SUMMARY BOX */}
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-3.5">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Amount Paid
                  </span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {Number(verificationResult.payment?.amount || 0).toLocaleString()} ETB
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Transaction Reference</span>
                  <span className="font-mono text-slate-200 font-medium">
                    {verificationResult.transaction?.txRef || txRef}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Payment Gateway Reference</span>
                  <span className="font-mono text-slate-200 font-medium">
                    {verificationResult.transaction?.chapaReference || 'CHAPA-TX-CONFIRMED'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Official Receipt Number</span>
                  <span className="font-mono text-emerald-400 font-medium flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" />
                    {verificationResult.receipt?.receiptNumber || 'REC-CONFIRMED'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Payment Status</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Verified & Audited
                  </span>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Link
                  to="/portal/payments"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  <Receipt className="w-4 h-4 text-slate-400" />
                  View Payment Records
                </Link>

                <Link
                  to="/portal/bookings"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-[#F50046] hover:bg-[#d4003d] shadow-lg shadow-[#F50046]/20 transition-all"
                >
                  Go to Bookings
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* 3. ERROR / FAILED STATE */}
          {!verifying && error && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex p-4 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <XCircle className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-wide">
                  Payment Verification Unsuccessful
                </h2>
                <p className="text-sm text-rose-300/90 max-w-sm mx-auto leading-relaxed">
                  {error}
                </p>
              </div>

              <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 text-xs text-rose-200/80 space-y-2">
                <div className="font-semibold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  What happened?
                </div>
                <p>
                  The payment transaction could not be confirmed with the payment gateway. Your contract
                  balance and booking status remain unchanged.
                </p>
                {txRef && (
                  <p className="font-mono text-[11px] text-slate-400 pt-1">
                    Attempt Reference: {txRef}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={verifyPayment}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Verification
                </button>

                <Link
                  to="/portal/payments"
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-[#F50046] hover:bg-[#d4003d] transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Return to Payments
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
