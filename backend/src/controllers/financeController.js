const { prisma } = require('../config/prisma');
const { Prisma } = require('@prisma/client');
const { sendSuccess, AppError } = require('../utils/response');
const FinanceService = require('../services/financeService');
const { ROLES } = require('../config/roles');
const permissions = require('../config/permissions');
const emailNotificationService = require('../services/emailNotificationService');

class FinanceController {
  /**
   * POST /api/payments
   * Submit payment claim with evidence (Telebirr, Bank transfer, etc.)
   */
  static async submitPayment(req, res, next) {
    try {
      const {
        bookingId,
        amount,
        paymentMethod,
        externalReference,
        paymentDate,
        evidenceDocument,
        paymentType = 'INITIAL_50_PERCENT'
      } = req.body;

      if (!bookingId || !amount || !paymentMethod || !externalReference) {
        throw new AppError(
          'bookingId, amount, paymentMethod, and externalReference are required.',
          400
        );
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId }
      });

      if (!booking) {
        throw new AppError('Booking not found.', 404);
      }

      if (req.user.role === ROLES.CUSTOMER && booking.customerId !== req.user.id) {
        throw new AppError('Unauthorized: You cannot submit payments for other customers.', 403);
      }

      const payment = await FinanceService.submitPayment({
        bookingId,
        amount,
        paymentMethod,
        externalReference,
        paymentDate,
        evidenceDocument,
        submittedById: req.user.id,
        paymentType
      });

      // Dispatch 6-Actor Category 6 & 8: Payment Submitted (Customer -> Finance) & Verification Required (System -> Finance)
      prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          assignedCoordinator: { select: { id: true, fullName: true, email: true, phone: true } }
        }
      }).then((booking) => {
        if (booking) {
          emailNotificationService.sendPaymentSubmitted({
            payment,
            customer: booking.customer || req.user,
            booking
          }).catch(() => {});
          emailNotificationService.sendPaymentVerificationRequired({
            payment,
            booking
          }).catch(() => {});
        }
      }).catch(() => {});

      return sendSuccess(res, 201, 'Payment submitted successfully for verification.', { payment });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/payments/my
   * Customer views own payment history
   */
  static async getMyPayments(req, res, next) {
    try {
      const payments = await prisma.payment.findMany({
        where: {
          OR: [
            { submittedById: req.user.id },
            { booking: { customerId: req.user.id } }
          ]
        },
        include: {
          verification: {
            include: {
              verifiedBy: { select: { id: true, fullName: true, role: true } }
            }
          },
          receipt: true,
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              eventType: true,
              preferredDate: true,
              status: true,
              paymentPosition: true,
              contracts: {
                where: { status: { in: ['SIGNED', 'PARTIALLY_SIGNED'] } },
                select: {
                  id: true,
                  version: true,
                  status: true,
                  totalAmount: true,
                  initialPaymentAmount: true,
                  finalPaymentAmount: true,
                  currency: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return sendSuccess(res, 200, 'Customer payments retrieved.', {
        count: payments.length,
        payments
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/payments
   * Finance/Admin lists all payments with rich filtering, search, pagination, and backend metrics
   */
  static async getAllPayments(req, res, next) {
    try {
      const {
        status,
        paymentMethod,
        paymentType,
        receiptStatus,
        bookingId,
        search,
        environment,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page,
        limit
      } = req.query;

      const where = {};

      // Status filtering
      if (status) {
        const upperStatus = status.toUpperCase();
        if (upperStatus === 'PENDING') {
          where.status = { in: ['SUBMITTED', 'UNDER_REVIEW'] };
        } else if (upperStatus === 'VERIFIED') {
          where.status = 'VERIFIED';
        } else if (upperStatus === 'REJECTED') {
          where.status = 'REJECTED';
        } else if (upperStatus === 'TEST') {
          where.environment = 'TEST';
        } else if (upperStatus !== 'ALL') {
          where.status = upperStatus;
        }
      }

      // Method filtering
      if (paymentMethod && paymentMethod !== 'ALL') {
        where.paymentMethod = paymentMethod;
      }

      // Payment Type / Stage filtering
      if (paymentType && paymentType !== 'ALL') {
        where.paymentType = paymentType;
      }

      // Receipt Status filtering
      if (receiptStatus) {
        const upperReceipt = receiptStatus.toUpperCase();
        if (upperReceipt === 'GENERATED') {
          where.receipt = { isNot: null };
        } else if (upperReceipt === 'NOT_GENERATED' || upperReceipt === 'PENDING') {
          where.receipt = null;
        }
      }

      // Booking ID filtering
      if (bookingId) {
        where.bookingId = bookingId;
      }

      // Environment filtering
      if (environment && environment !== 'ALL') {
        where.environment = environment;
      }

      // Date range filtering
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      // Free-text search
      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { externalReference: { contains: q } },
          { submittedBy: { fullName: { contains: q } } },
          { submittedBy: { phone: { contains: q } } },
          { booking: { reference: { contains: q } } },
          { booking: { customer: { fullName: { contains: q } } } }
        ];
      }

      // Sorting
      const validSortFields = ['createdAt', 'amount', 'paymentDate'];
      const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';
      const orderBy = { [field]: order };

      // Pagination
      const parsedPage = page ? Math.max(1, parseInt(page, 10)) : null;
      const parsedLimit = limit ? Math.max(1, parseInt(limit, 10)) : null;
      const paginationArgs = parsedPage && parsedLimit ? {
        skip: (parsedPage - 1) * parsedLimit,
        take: parsedLimit
      } : {};

      const verifiedDateFilter = (startDate || endDate) && where.createdAt ? { createdAt: where.createdAt } : {};
      const envConstraint = environment === 'TEST'
        ? { environment: 'TEST' }
        : environment === 'LIVE'
        ? { environment: { not: 'TEST' } }
        : {};

      // Execute queries in parallel: records + live DB summary metrics
      const [
        totalCount,
        payments,
        pendingCount,
        verifiedCount,
        rejectedCount,
        pendingAgg,
        testCount,
        verifiedAgg,
        receiptsGeneratedCount,
        receiptsPendingCount
      ] = await Promise.all([
        prisma.payment.count({ where }),
        prisma.payment.findMany({
          where,
          include: {
            submittedBy: { select: { id: true, fullName: true, email: true, phone: true } },
            verification: {
              include: {
                verifiedBy: { select: { id: true, fullName: true, role: true } }
              }
            },
            receipt: true,
            chapaTransaction: {
              select: { id: true, txRef: true, status: true, environment: true }
            },
            booking: {
              select: {
                id: true,
                reference: true,
                title: true,
                preferredDate: true,
                paymentPosition: true,
                customer: { select: { id: true, fullName: true, email: true, phone: true } },
                contracts: {
                  where: { status: { in: ['SIGNED', 'PARTIALLY_SIGNED', 'PREPARED', 'SENT'] } },
                  select: {
                    id: true,
                    version: true,
                    status: true,
                    totalAmount: true,
                    initialPaymentAmount: true,
                    finalPaymentAmount: true,
                    currency: true
                  }
                }
              }
            }
          },
          orderBy,
          ...paginationArgs
        }),
        // 1. Pending claims awaiting review
        prisma.payment.count({
          where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, ...envConstraint }
        }),
        // 2. Successfully verified payments
        prisma.payment.count({
          where: { status: 'VERIFIED', ...envConstraint, ...verifiedDateFilter }
        }),
        // 3. Rejected claims
        prisma.payment.count({
          where: { status: 'REJECTED', ...envConstraint }
        }),
        // 4. Total pending amount awaiting verification
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, ...envConstraint }
        }),
        // 5. TEST transactions separated from real funds
        prisma.payment.count({
          where: { environment: 'TEST' }
        }),
        // 6. Total verified amount received
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: 'VERIFIED', ...envConstraint, ...verifiedDateFilter }
        }),
        // 7. Receipts generated count
        prisma.receipt.count({
          where: { ...(environment === 'TEST' ? { environment: 'TEST' } : environment === 'LIVE' ? { environment: { not: 'TEST' } } : {}) }
        }),
        // 8. Receipts pending count (verified payments without receipt)
        prisma.payment.count({
          where: { status: 'VERIFIED', ...envConstraint, receipt: null }
        })
      ]);

      const summary = {
        pendingCount,
        verifiedCount,
        rejectedCount,
        pendingAmount: Number(pendingAgg._sum.amount || 0),
        testCount,
        totalVerifiedAmount: Number(verifiedAgg._sum.amount || 0),
        receiptsGeneratedCount,
        receiptsPendingCount
      };

      return sendSuccess(res, 200, 'Payments retrieved successfully.', {
        count: totalCount,
        summary,
        pagination: parsedPage && parsedLimit ? {
          total: totalCount,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.max(1, Math.ceil(totalCount / parsedLimit))
        } : null,
        payments
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/payments/:id
   * Fetch full payment details, customer contact info, contract balance, previous payments
   */
  static async getPaymentById(req, res, next) {
    try {
      const { id } = req.params;

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          submittedBy: { select: { id: true, fullName: true, email: true, phone: true } },
          verification: {
            include: { verifiedBy: { select: { id: true, fullName: true, role: true } } }
          },
          receipt: true,
          chapaTransaction: true,
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              customerId: true,
              paymentPosition: true,
              preferredDate: true,
              customer: { select: { id: true, fullName: true, email: true, phone: true } },
              contracts: {
                where: { status: { in: ['SIGNED', 'PARTIALLY_SIGNED', 'PREPARED', 'SENT'] } },
                select: {
                  id: true,
                  version: true,
                  status: true,
                  totalAmount: true,
                  initialPaymentAmount: true,
                  finalPaymentAmount: true,
                  currency: true
                }
              },
              payments: {
                where: { status: 'VERIFIED' },
                select: {
                  id: true,
                  amount: true,
                  currency: true,
                  paymentType: true,
                  paymentMethod: true,
                  externalReference: true,
                  paymentDate: true,
                  createdAt: true
                }
              },
              refunds: {
                select: { id: true, amount: true, reason: true, createdAt: true }
              }
            }
          }
        }
      });

      if (!payment) {
        throw new AppError('Payment not found.', 404);
      }

      if (req.user.role === ROLES.CUSTOMER && payment.booking.customerId !== req.user.id) {
        throw new AppError('Access denied: You do not have permission to view this payment.', 403);
      }

      // Financial balance calculations
      const activeContract = payment.booking?.contracts?.[0] || null;
      const contractTotal = activeContract ? Number(activeContract.totalAmount) : 0;
      const verifiedPayments = (payment.booking?.payments || []);
      const totalVerifiedPaid = verifiedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalRefunded = (payment.booking?.refunds || []).reduce((sum, r) => sum + Number(r.amount), 0);
      const netPaid = Math.max(0, totalVerifiedPaid - totalRefunded);
      const outstandingBalance = Math.max(0, contractTotal - netPaid);
      const paymentProgress = contractTotal > 0 ? Math.min(100, Math.round((netPaid / contractTotal) * 100)) : 0;

      // Filter previous verified payments excluding this specific payment
      const previousVerifiedPayments = verifiedPayments.filter((p) => p.id !== payment.id);

      return sendSuccess(res, 200, 'Payment details retrieved successfully.', {
        payment: {
          ...payment,
          financialContext: {
            contractTotal,
            totalVerifiedPaid,
            totalRefunded,
            netPaid,
            outstandingBalance,
            paymentProgress,
            activeContract,
            previousVerifiedPayments
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/payments/:id/verify
   * Finance officer approves or rejects payment claim
   */
  static async verifyPayment(req, res, next) {
    try {
      const { id } = req.params;
      const { isApproved, rejectionReason, notes } = req.body;

      if (typeof isApproved !== 'boolean') {
        throw new AppError('isApproved (boolean) is required.', 400);
      }

      const result = await FinanceService.verifyPayment({
        paymentId: id,
        verifiedById: req.user.id,
        isApproved,
        rejectionReason,
        notes
      });

      // Dispatch 6-Actor Category 6: Payment Verification Notifications
      // Strict rule: Test transactions must NEVER trigger real payment confirmation emails!
      prisma.payment.findUnique({
        where: { id },
        include: {
          booking: {
            include: {
              customer: { select: { id: true, fullName: true, email: true, phone: true } },
              assignedCoordinator: { select: { id: true, fullName: true, email: true, phone: true } }
            }
          }
        }
      }).then((payRecord) => {
        if (!payRecord || !payRecord.booking) return;
        const b = payRecord.booking;
        const cust = b.customer;
        const isTestTx = payRecord.environment === 'TEST' || payRecord.paymentMethod === 'TEST';

        if (isApproved) {
          if (!isTestTx) {
            emailNotificationService.sendPaymentVerified({
              payment: result.payment,
              receipt: result.receipt,
              customer: cust,
              financeOfficer: req.user,
              booking: b,
              isTestTransaction: false
            }).catch(() => {});

            if (result.payment?.paymentType === 'INITIAL_50_PERCENT' || result.payment?.paymentType === 'DEPOSIT') {
              emailNotificationService.sendDepositConfirmation({
                payment: result.payment,
                customer: cust,
                coordinator: b.assignedCoordinator,
                booking: b
              }).catch(() => {});
            }

            if (b.paymentPosition === 'PAID_IN_FULL') {
              emailNotificationService.sendFinalPaymentVerified({
                payment: result.payment,
                receipt: result.receipt,
                customer: cust,
                financeOfficer: req.user,
                booking: b
              }).catch(() => {});
            }
          }
        } else {
          emailNotificationService.sendPaymentRejected({
            payment: result.payment,
            customer: cust,
            financeOfficer: req.user,
            booking: b,
            reason: rejectionReason
          }).catch(() => {});
        }
      }).catch(() => {});

      const message = isApproved
        ? 'Payment verified successfully. Official receipt issued.'
        : 'Payment verification rejected.';

      return sendSuccess(res, 200, message, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/bookings/:bookingId/summary
   * Reconciled financial statement for a booking
   */
  static async getBookingFinancialSummary(req, res, next) {
    try {
      const { bookingId } = req.params;

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          contracts: { where: { status: 'SIGNED' } },
          payments: {
            include: { receipt: true, verification: true }
          },
          refunds: true
        }
      });

      if (!booking) {
        throw new AppError('Booking not found.', 404);
      }

      if (req.user.role === ROLES.CUSTOMER && booking.customerId !== req.user.id) {
        throw new AppError('Access denied.', 403);
      }

      const activeContract = booking.contracts[0];
      const totalContracted = activeContract ? activeContract.totalAmount : new Prisma.Decimal(0);
      const initialDepositRequired = activeContract ? activeContract.initialPaymentAmount : new Prisma.Decimal(0);
      const finalPaymentDue = activeContract ? activeContract.finalPaymentAmount : new Prisma.Decimal(0);

      const verifiedPayments = booking.payments.filter((p) => p.status === 'VERIFIED');
      const totalVerifiedPaid = verifiedPayments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

      const pendingPayments = booking.payments.filter((p) => p.status === 'SUBMITTED');
      const totalPending = pendingPayments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

      const totalRefunded = booking.refunds.reduce((sum, r) => sum.add(r.amount), new Prisma.Decimal(0));

      const netPaid = totalVerifiedPaid.sub(totalRefunded);
      const balanceOutstanding = totalContracted.sub(netPaid);

      return sendSuccess(res, 200, 'Financial summary retrieved.', {
        summary: {
          bookingId: booking.id,
          reference: booking.reference,
          currency: 'ETB',
          totalContracted,
          initialDepositRequired,
          finalPaymentDue,
          totalVerifiedPaid,
          totalPending,
          totalRefunded,
          netPaid,
          balanceOutstanding: balanceOutstanding.lessThan(0) ? new Prisma.Decimal(0) : balanceOutstanding,
          paymentPosition: booking.paymentPosition,
          isContractSigned: Boolean(activeContract),
          payments: booking.payments,
          refunds: booking.refunds
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/refunds
   * Retrieve all refund claims and financial adjustments with summary cards and eligible selection records
   */
  static async getAllRefundsAndAdjustments(req, res, next) {
    try {
      const {
        search,
        type,
        status,
        startDate,
        endDate,
        sortBy = 'date',
        sortOrder = 'desc',
        page,
        limit
      } = req.query;

      // 1. Fetch refunds
      const refunds = await prisma.refund.findMany({
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              isTestBooking: true,
              preferredDate: true,
              eventStatus: true,
              paymentPosition: true,
              customer: { select: { id: true, fullName: true, email: true, phone: true } },
              contracts: {
                where: { status: { in: ['SIGNED', 'PARTIALLY_SIGNED', 'PREPARED', 'SENT'] } },
                select: { id: true, version: true, totalAmount: true }
              }
            }
          },
          originalPayment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              paymentMethod: true,
              paymentType: true,
              externalReference: true,
              environment: true,
              status: true,
              createdAt: true
            }
          },
          approvedBy: { select: { id: true, fullName: true, email: true, role: true } },
          processedBy: { select: { id: true, fullName: true, email: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      // 2. Fetch financial adjustments
      const adjustments = await prisma.financialAdjustment.findMany({
        orderBy: { createdAt: 'desc' }
      });

      // Fetch bookings and approvers for adjustments
      const adjBookingIds = [...new Set(adjustments.map((a) => a.bookingId))];
      const adjApproverIds = [...new Set(adjustments.map((a) => a.approvedById))];
      const [adjBookings, adjApprovers] = await Promise.all([
        prisma.booking.findMany({
          where: { id: { in: adjBookingIds } },
          select: {
            id: true,
            reference: true,
            title: true,
            isTestBooking: true,
            preferredDate: true,
            eventStatus: true,
            paymentPosition: true,
            customer: { select: { id: true, fullName: true, email: true, phone: true } },
            contracts: {
              where: { status: { in: ['SIGNED', 'PARTIALLY_SIGNED', 'PREPARED', 'SENT'] } },
              select: { id: true, version: true, totalAmount: true }
            }
          }
        }),
        prisma.user.findMany({
          where: { id: { in: adjApproverIds } },
          select: { id: true, fullName: true, email: true, role: true }
        })
      ]);
      const adjBookingMap = new Map(adjBookings.map((b) => [b.id, b]));
      const adjApproverMap = new Map(adjApprovers.map((u) => [u.id, u]));

      // 3. Normalize into unified records
      const normalizedRefunds = refunds.map((r) => {
        const isTest = r.originalPayment?.environment === 'TEST' || Boolean(r.booking?.isTestBooking);
        return {
          id: r.id,
          recordType: 'REFUND',
          typeLabel: 'Refund',
          reference: `REF-${r.id.slice(0, 8).toUpperCase()}`,
          amount: Number(r.amount),
          currency: r.currency || 'ETB',
          reason: r.reason,
          status: r.status || 'PENDING_APPROVAL',
          isTest,
          createdAt: r.createdAt,
          processedAt: r.processedAt,
          bookingId: r.bookingId,
          booking: r.booking,
          originalPayment: r.originalPayment,
          approvedBy: r.approvedBy,
          processedBy: r.processedBy
        };
      });

      const normalizedAdjustments = adjustments.map((a) => {
        const booking = adjBookingMap.get(a.bookingId) || null;
        const isTest = Boolean(booking?.isTestBooking);
        const isCredit = a.adjustmentType === 'CREDIT';
        return {
          id: a.id,
          recordType: isCredit ? 'CREDIT_ADJUSTMENT' : 'DEBIT_ADJUSTMENT',
          typeLabel: isCredit ? 'Credit Adjustment' : 'Debit Adjustment',
          reference: `ADJ-${a.id.slice(0, 8).toUpperCase()}`,
          amount: Number(a.amount),
          currency: 'ETB',
          reason: a.reason,
          status: 'PROCESSED',
          isTest,
          createdAt: a.createdAt,
          processedAt: a.createdAt,
          bookingId: a.bookingId,
          booking,
          originalPayment: null,
          approvedBy: adjApproverMap.get(a.approvedById) || null,
          processedBy: adjApproverMap.get(a.approvedById) || null
        };
      });

      // 4. Summary cards calculation (strictly real funds, excluding TEST)
      const liveRefunds = normalizedRefunds.filter((r) => !r.isTest);
      const liveAdjustments = normalizedAdjustments.filter((a) => !a.isTest);

      const pendingApprovalCount = liveRefunds.filter(
        (r) => r.status === 'PENDING_APPROVAL' || r.status === 'PENDING'
      ).length;

      const approvedPendingDisbursementAmount = liveRefunds
        .filter((r) => r.status === 'APPROVED')
        .reduce((sum, r) => sum + r.amount, 0);

      const totalRefundedAmount = liveRefunds
        .filter((r) => r.status === 'PROCESSED')
        .reduce((sum, r) => sum + r.amount, 0);

      const creditAdjustments = liveAdjustments.filter((a) => a.recordType === 'CREDIT_ADJUSTMENT');
      const debitAdjustments = liveAdjustments.filter((a) => a.recordType === 'DEBIT_ADJUSTMENT');

      const creditAdjustmentsAmount = creditAdjustments.reduce((sum, a) => sum + a.amount, 0);
      const debitAdjustmentsAmount = debitAdjustments.reduce((sum, a) => sum + a.amount, 0);

      const summary = {
        pendingApprovalCount,
        approvedPendingDisbursementAmount,
        totalRefundedAmount,
        adjustmentsCount: liveAdjustments.length,
        adjustmentsCreditAmount: creditAdjustmentsAmount,
        adjustmentsDebitAmount: debitAdjustmentsAmount,
        netAdjustmentsAmount: debitAdjustmentsAmount - creditAdjustmentsAmount
      };

      // 5. Eligible payments for the New Refund Modal
      const verifiedPayments = await prisma.payment.findMany({
        where: { status: 'VERIFIED' },
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              customer: { select: { id: true, fullName: true, email: true, phone: true } },
              contracts: {
                where: { status: { in: ['SIGNED', 'PARTIALLY_SIGNED'] } },
                select: { id: true, totalAmount: true }
              }
            }
          },
          refunds: {
            where: { status: { not: 'REJECTED' } },
            select: { amount: true, status: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const eligiblePayments = verifiedPayments.map((p) => {
        const totalRefundedOnPayment = (p.refunds || []).reduce((sum, r) => sum + Number(r.amount), 0);
        const origAmount = Number(p.amount);
        const remainingRefundable = Math.max(0, origAmount - totalRefundedOnPayment);
        return {
          paymentId: p.id,
          bookingId: p.bookingId,
          bookingReference: p.booking?.reference,
          bookingTitle: p.booking?.title,
          customerName: p.booking?.customer?.fullName || 'Valued Customer',
          customerEmail: p.booking?.customer?.email,
          customerPhone: p.booking?.customer?.phone,
          originalAmount: origAmount,
          totalRefunded: totalRefundedOnPayment,
          remainingRefundable,
          paymentMethod: p.paymentMethod,
          externalReference: p.externalReference,
          paymentDate: p.paymentDate || p.createdAt
        };
      }).filter((p) => p.remainingRefundable > 0);

      // 6. Eligible bookings for the New Adjustment Modal
      const eligibleBookings = await prisma.booking.findMany({
        where: { isTestBooking: false },
        select: {
          id: true,
          reference: true,
          title: true,
          preferredDate: true,
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          contracts: {
            where: { status: { in: ['SIGNED', 'PARTIALLY_SIGNED', 'PREPARED', 'SENT'] } },
            select: { id: true, version: true, totalAmount: true }
          }
        },
        orderBy: { preferredDate: 'asc' }
      });

      // 7. Combine records and apply filters
      let combined = [...normalizedRefunds, ...normalizedAdjustments];

      // Filter by type
      if (type && type !== 'ALL') {
        const upperType = type.toUpperCase();
        if (upperType === 'REFUNDS' || upperType === 'REFUND') {
          combined = combined.filter((item) => item.recordType === 'REFUND');
        } else if (upperType === 'ADJUSTMENTS' || upperType === 'ADJUSTMENT') {
          combined = combined.filter((item) => item.recordType === 'CREDIT_ADJUSTMENT' || item.recordType === 'DEBIT_ADJUSTMENT');
        } else if (upperType === 'CREDIT_ADJUSTMENT') {
          combined = combined.filter((item) => item.recordType === 'CREDIT_ADJUSTMENT');
        } else if (upperType === 'DEBIT_ADJUSTMENT') {
          combined = combined.filter((item) => item.recordType === 'DEBIT_ADJUSTMENT');
        }
      }

      // Filter by status
      if (status && status !== 'ALL') {
        const upperStatus = status.toUpperCase();
        if (upperStatus === 'PENDING' || upperStatus === 'PENDING_APPROVAL') {
          combined = combined.filter((item) => item.status === 'PENDING_APPROVAL' || item.status === 'PENDING');
        } else {
          combined = combined.filter((item) => item.status === upperStatus);
        }
      }

      // Filter by date range
      if (startDate || endDate) {
        if (startDate) {
          const start = new Date(startDate);
          combined = combined.filter((item) => new Date(item.createdAt) >= start);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          combined = combined.filter((item) => new Date(item.createdAt) <= end);
        }
      }

      // Filter by search text
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        combined = combined.filter((item) => {
          const custName = item.booking?.customer?.fullName?.toLowerCase() || '';
          const bookingRef = item.booking?.reference?.toLowerCase() || '';
          const origPayRef = item.originalPayment?.externalReference?.toLowerCase() || '';
          const recRef = item.reference.toLowerCase();
          const reason = item.reason.toLowerCase();
          return (
            custName.includes(q) ||
            bookingRef.includes(q) ||
            origPayRef.includes(q) ||
            recRef.includes(q) ||
            reason.includes(q)
          );
        });
      }

      // Sorting
      combined.sort((a, b) => {
        let valA = a.createdAt;
        let valB = b.createdAt;
        if (sortBy === 'amount') {
          valA = a.amount;
          valB = b.amount;
        } else if (sortBy === 'reference') {
          valA = a.reference;
          valB = b.reference;
        } else if (sortBy === 'customer') {
          valA = a.booking?.customer?.fullName || '';
          valB = b.booking?.customer?.fullName || '';
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // Pagination
      const parsedPage = page ? Math.max(1, parseInt(page, 10)) : 1;
      const parsedLimit = limit ? Math.max(1, parseInt(limit, 10)) : 10;
      const totalCount = combined.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / parsedLimit));
      const paginatedRecords = page && limit
        ? combined.slice((parsedPage - 1) * parsedLimit, parsedPage * parsedLimit)
        : combined;

      return sendSuccess(res, 200, 'Refunds and adjustments retrieved successfully.', {
        summary,
        pagination: {
          total: totalCount,
          page: parsedPage,
          limit: parsedLimit,
          totalPages
        },
        records: paginatedRecords,
        eligiblePayments,
        eligibleBookings
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/finance/refunds
   * Create a new refund request (starts at PENDING_APPROVAL unless Admin Director auto-approves)
   */
  static async createRefundRequest(req, res, next) {
    try {
      const { bookingId, originalPaymentId, amount, reason, notes, refundMethod, autoApprove } = req.body;

      if (!bookingId || !amount || !reason) {
        throw new AppError('bookingId, amount, and reason are required.', 400);
      }

      const amountDec = new Prisma.Decimal(amount);
      if (amountDec.lessThanOrEqualTo(0)) {
        throw new AppError('Refund amount must be greater than zero.', 400);
      }

      let originalPayment = null;
      if (originalPaymentId) {
        originalPayment = await prisma.payment.findUnique({
          where: { id: originalPaymentId },
          include: {
            refunds: {
              where: { status: { not: 'REJECTED' } },
              select: { amount: true, status: true }
            },
            booking: { select: { id: true, reference: true } }
          }
        });

        if (!originalPayment) {
          throw new AppError('Original payment record not found.', 404);
        }

        if (originalPayment.status !== 'VERIFIED') {
          throw new AppError('Only VERIFIED payments are eligible for refund.', 400);
        }

        const alreadyRefunded = (originalPayment.refunds || []).reduce(
          (sum, r) => sum.add(r.amount),
          new Prisma.Decimal(0)
        );
        const maxRefundable = originalPayment.amount.sub(alreadyRefunded);
        if (amountDec.greaterThan(maxRefundable)) {
          throw new AppError(
            `Refund amount of ${amountDec} ETB exceeds the remaining refundable amount of ${maxRefundable} ETB on this payment.`,
            400
          );
        }
      }

      // Determine initial status based on role and explicit autoApprove request
      const isDirector = req.user.role === ROLES.ADMIN_DIRECTOR;
      const initialStatus = (isDirector && autoApprove) ? 'APPROVED' : 'PENDING_APPROVAL';

      const fullReason = notes && notes.trim()
        ? `${reason.trim()} | Method: ${refundMethod || 'Original Channel'} | Notes: ${notes.trim()}`
        : `${reason.trim()} | Method: ${refundMethod || 'Original Channel'}`;

      const refund = await prisma.$transaction(async (tx) => {
        const newRefund = await tx.refund.create({
          data: {
            bookingId,
            originalPaymentId,
            amount: amountDec,
            currency: 'ETB',
            reason: fullReason,
            approvedById: req.user.id,
            status: initialStatus
          }
        });

        await tx.auditLog.create({
          data: {
            actorId: req.user.id,
            action: initialStatus === 'APPROVED' ? 'REFUND_REQUEST_APPROVED' : 'REFUND_REQUEST_CREATED',
            entity: 'Refund',
            entityId: newRefund.id,
            reason: fullReason,
            metadata: {
              bookingId,
              originalPaymentId,
              amount: Number(amountDec),
              status: initialStatus
            }
          }
        });

        return newRefund;
      });

      return sendSuccess(res, 201, 'Refund request created successfully.', { refund });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/finance/refunds/:id/approve
   * Authorize a pending refund claim (Separation of duties: Admin Director or authorized approver)
   */
  static async approveRefund(req, res, next) {
    try {
      const { id } = req.params;

      const refund = await prisma.refund.findUnique({
        where: { id },
        include: {
          booking: {
            select: { id: true, reference: true, customerId: true }
          }
        }
      });

      if (!refund) {
        throw new AppError('Refund record not found.', 404);
      }

      if (refund.status === 'APPROVED') {
        return sendSuccess(res, 200, 'Refund is already approved.', { refund });
      }

      if (refund.status === 'PROCESSED') {
        throw new AppError('Cannot re-approve an already processed refund.', 400);
      }

      if (refund.status === 'REJECTED') {
        throw new AppError('Cannot approve a rejected refund request.', 400);
      }

      // Check permissions: only ADMIN_DIRECTOR or users with APPROVE_REFUNDS permission
      const hasApprovePerm = permissions.hasPermission(req.user.role, permissions.PERMISSIONS.APPROVE_REFUNDS) || req.user.role === ROLES.ADMIN_DIRECTOR;
      if (!hasApprovePerm) {
        throw new AppError('Access denied: You do not have permission to approve refunds.', 403);
      }

      // Separation of duties: regular Finance officer cannot self-approve their own created refund
      if (req.user.role !== ROLES.ADMIN_DIRECTOR && refund.approvedById === req.user.id) {
        throw new AppError('Separation of duties violation: You cannot approve your own refund request. Approval must be completed by the Admin Director.', 403);
      }

      const updatedRefund = await prisma.$transaction(async (tx) => {
        const approved = await tx.refund.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedById: req.user.id
          }
        });

        await tx.auditLog.create({
          data: {
            actorId: req.user.id,
            action: 'REFUND_APPROVED',
            entity: 'Refund',
            entityId: id,
            metadata: {
              amount: Number(refund.amount),
              bookingReference: refund.booking?.reference
            }
          }
        });

        return approved;
      });

      return sendSuccess(res, 200, 'Refund request approved successfully.', { refund: updatedRefund });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/finance/refunds/:id/reject
   * Reject a refund request with mandatory documented reason
   */
  static async rejectRefund(req, res, next) {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;

      if (!rejectionReason || !rejectionReason.trim()) {
        throw new AppError('rejectionReason is required when rejecting a refund claim.', 400);
      }

      const refund = await prisma.refund.findUnique({
        where: { id },
        include: {
          booking: {
            select: { id: true, reference: true, customerId: true }
          }
        }
      });

      if (!refund) {
        throw new AppError('Refund record not found.', 404);
      }

      if (refund.status === 'PROCESSED') {
        throw new AppError('Cannot reject an already processed refund.', 400);
      }

      const updatedRefund = await prisma.$transaction(async (tx) => {
        const rejected = await tx.refund.update({
          where: { id },
          data: {
            status: 'REJECTED',
            reason: `${refund.reason} [REJECTED: ${rejectionReason.trim()}]`
          }
        });

        await tx.auditLog.create({
          data: {
            actorId: req.user.id,
            action: 'REFUND_REJECTED',
            entity: 'Refund',
            entityId: id,
            reason: rejectionReason.trim(),
            metadata: {
              amount: Number(refund.amount),
              bookingReference: refund.booking?.reference,
              previousStatus: refund.status
            }
          }
        });

        if (refund.booking?.customerId) {
          await tx.notification.create({
            data: {
              recipientId: refund.booking.customerId,
              title: 'Refund Request Rejected',
              message: `Your refund request for booking ${refund.booking.reference} could not be approved. Reason: ${rejectionReason.trim()}`,
              type: 'REFUND_REJECTED',
              link: '/portal/payments'
            }
          });
        }

        return rejected;
      });

      return sendSuccess(res, 200, 'Refund request rejected successfully.', { refund: updatedRefund });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/finance/refunds/:id/process
   * Execute disbursement of an approved refund
   */
  static async processRefundExecution(req, res, next) {
    try {
      const { id } = req.params;
      const { refundTransactionRef, refundMethod, notes } = req.body;

      const refund = await prisma.refund.findUnique({
        where: { id },
        include: {
          booking: {
            select: { id: true, reference: true, customerId: true }
          }
        }
      });

      if (!refund) {
        throw new AppError('Refund record not found.', 404);
      }

      if (refund.status !== 'APPROVED') {
        throw new AppError(`Only APPROVED refunds can be processed for disbursement. Current status: ${refund.status}`, 400);
      }

      const processedRefund = await prisma.$transaction(async (tx) => {
        const updatedReason = refundTransactionRef
          ? `${refund.reason} [Disbursed: Ref ${refundTransactionRef}, Channel: ${refundMethod || 'Bank Transfer'}${notes ? `, Notes: ${notes}` : ''}]`
          : refund.reason;

        const processed = await tx.refund.update({
          where: { id },
          data: {
            status: 'PROCESSED',
            processedById: req.user.id,
            processedAt: new Date(),
            reason: updatedReason
          }
        });

        await FinanceService.recalculateBookingPaymentPosition(tx, refund.bookingId);

        await tx.auditLog.create({
          data: {
            actorId: req.user.id,
            action: 'REFUND_PROCESSED',
            entity: 'Refund',
            entityId: id,
            reason: notes || 'Refund disbursement completed',
            metadata: {
              refundTransactionRef,
              refundMethod,
              amount: Number(refund.amount),
              bookingReference: refund.booking?.reference
            }
          }
        });

        if (refund.booking?.customerId) {
          await tx.notification.create({
            data: {
              recipientId: refund.booking.customerId,
              title: 'Refund Processed',
              message: `Your refund of ${Number(refund.amount).toLocaleString()} ETB for booking ${refund.booking.reference} has been processed via ${refundMethod || 'Electronic Transfer'}. Disbursement Ref: ${refundTransactionRef || 'N/A'}.`,
              type: 'REFUND_PROCESSED',
              link: '/portal/payments'
            }
          });
        }

        return processed;
      });

      return sendSuccess(res, 200, 'Refund disbursement processed successfully.', { refund: processedRefund });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/finance/adjustments
   * Record an authorized debit or credit adjustment on customer account
   */
  static async createFinancialAdjustment(req, res, next) {
    try {
      const { bookingId, adjustmentType, amount, reason, authorizationRef } = req.body;

      if (!bookingId || !adjustmentType || !amount || !reason) {
        throw new AppError('bookingId, adjustmentType, amount, and reason are required.', 400);
      }

      if (!['CREDIT', 'DEBIT'].includes(adjustmentType.toUpperCase())) {
        throw new AppError('adjustmentType must be either CREDIT or DEBIT.', 400);
      }

      const amountDec = new Prisma.Decimal(amount);
      if (amountDec.lessThanOrEqualTo(0)) {
        throw new AppError('Adjustment amount must be greater than zero.', 400);
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, reference: true, customerId: true }
      });

      if (!booking) {
        throw new AppError('Booking record not found.', 404);
      }

      const cleanType = adjustmentType.toUpperCase();
      const fullReason = authorizationRef && authorizationRef.trim()
        ? `${reason.trim()} (Auth: ${authorizationRef.trim()})`
        : reason.trim();

      const adjustment = await prisma.$transaction(async (tx) => {
        const newAdjustment = await tx.financialAdjustment.create({
          data: {
            bookingId,
            amount: amountDec,
            adjustmentType: cleanType,
            reason: fullReason,
            approvedById: req.user.id
          }
        });

        await FinanceService.recalculateBookingPaymentPosition(tx, bookingId);

        await tx.auditLog.create({
          data: {
            actorId: req.user.id,
            action: 'FINANCIAL_ADJUSTMENT_CREATED',
            entity: 'FinancialAdjustment',
            entityId: newAdjustment.id,
            reason: fullReason,
            metadata: {
              bookingReference: booking.reference,
              adjustmentType: cleanType,
              amount: Number(amountDec),
              authorizationRef: authorizationRef || 'N/A'
            }
          }
        });

        if (booking.customerId) {
          const typeLabel = cleanType === 'CREDIT' ? 'Credit Note / Waiver' : 'Additional Fee / Debit';
          await tx.notification.create({
            data: {
              recipientId: booking.customerId,
              title: `Account Balance Adjustment: ${typeLabel}`,
              message: `A financial adjustment of ${Number(amountDec).toLocaleString()} ETB (${typeLabel}) was applied to your booking ${booking.reference}. Reason: ${fullReason}`,
              type: 'FINANCIAL_ADJUSTMENT',
              link: '/portal/payments'
            }
          });
        }

        return newAdjustment;
      });

      return sendSuccess(res, 201, 'Financial adjustment recorded successfully.', { adjustment });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/finance/refunds (Backwards compatibility wrapper)
   */
  static async processRefund(req, res, next) {
    return FinanceController.createRefundRequest(req, res, next);
  }

  /**
   * GET /api/finance/receipts/:receiptNumber
   * Retrieve official receipt details for printing / auditing
   */
  static async getReceiptByNumber(req, res, next) {
    try {
      const { receiptNumber } = req.params;

      const receipt = await prisma.receipt.findUnique({
        where: { receiptNumber },
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              customer: { select: { id: true, fullName: true, email: true, phone: true } },
              contracts: {
                where: { status: { in: ['SIGNED', 'PARTIALLY_SIGNED', 'PREPARED', 'SENT'] } },
                select: { id: true, version: true, totalAmount: true }
              }
            }
          },
          payment: {
            include: {
              verification: {
                include: { verifiedBy: { select: { id: true, fullName: true, role: true } } }
              }
            }
          }
        }
      });

      if (!receipt) {
        throw new AppError('Receipt not found.', 404);
      }

      // Check permission
      if (req.user.role === ROLES.CUSTOMER && receipt.booking?.customer?.id !== req.user.id) {
        throw new AppError('Access denied: You do not have permission to view this receipt.', 403);
      }

      // Ensure official receipt parameters are verified

      return sendSuccess(res, 200, 'Official receipt retrieved successfully.', {
        receipt: {
          receiptNumber: receipt.receiptNumber,
          customerName: receipt.booking?.customer?.fullName || 'Valued Client',
          customerPhone: receipt.booking?.customer?.phone,
          customerEmail: receipt.booking?.customer?.email,
          bookingReference: receipt.booking?.reference,
          contractReference: receipt.booking?.contracts?.[0]?.id ? `CNT-${receipt.booking.contracts[0].version}` : 'N/A',
          amount: Number(receipt.amount),
          currency: receipt.currency,
          paymentMethod: receipt.payment?.paymentMethod,
          externalReference: receipt.payment?.externalReference,
          issuedAt: receipt.issuedAt,
          verifiedAt: receipt.payment?.verification?.verifiedAt || receipt.issuedAt,
          verifiedBy: receipt.payment?.verification?.verifiedBy?.fullName || 'Eventora Finance Officer',
          company: {
            name: 'Eventora Events & Celebrations PLC',
            address: 'Bole Sub-City, Mickey Leland St, Addis Ababa, Ethiopia',
            phone: '+251 11 661 2345',
            email: 'finance@eventora.et',
            tin: '0092817462',
            vat: '118274619'
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/finance/payments/:id/receipt
   * Issue official receipt for an eligible verified real payment
   */
  static async generateReceipt(req, res, next) {
    try {
      const { id } = req.params;

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          receipt: true,
          booking: {
            include: {
              customer: { select: { id: true, fullName: true, email: true, phone: true } },
              contracts: {
                where: { status: { in: ['SIGNED', 'PARTIALLY_SIGNED', 'PREPARED', 'SENT'] } },
                select: { id: true, version: true, totalAmount: true }
              }
            }
          },
          verification: {
            include: { verifiedBy: { select: { id: true, fullName: true, role: true } } }
          }
        }
      });

      if (!payment) {
        throw new AppError('Payment record not found.', 404);
      }

      if (payment.status !== 'VERIFIED') {
        throw new AppError('Only VERIFIED payments are eligible for official receipt generation.', 400);
      }

      if (payment.receipt) {
        return sendSuccess(res, 200, 'Receipt already exists for this payment.', {
          receipt: {
            ...payment.receipt,
            customerName: payment.booking?.customer?.fullName || 'Valued Client',
            customerPhone: payment.booking?.customer?.phone,
            customerEmail: payment.booking?.customer?.email,
            bookingReference: payment.booking?.reference,
            contractReference: payment.booking?.contracts?.[0]?.id ? `CNT-${payment.booking.contracts[0].version}` : 'N/A',
            amount: Number(payment.receipt.amount),
            currency: payment.receipt.currency,
            paymentMethod: payment.paymentMethod,
            externalReference: payment.externalReference,
            issuedAt: payment.receipt.issuedAt,
            verifiedAt: payment.verification?.verifiedAt || payment.receipt.issuedAt,
            verifiedBy: payment.verification?.verifiedBy?.fullName || 'Eventora Finance Officer',
            company: {
              name: 'Eventora Events & Celebrations PLC',
              address: 'Bole Sub-City, Mickey Leland St, Addis Ababa, Ethiopia',
              phone: '+251 11 661 2345',
              email: 'finance@eventora.et',
              tin: '0092817462',
              vat: '118274619'
            }
          },
          isDuplicate: true
        });
      }

      const receiptCount = await prisma.receipt.count();
      const year = new Date().getFullYear();
      const receiptNumber = `REC-${year}-${String(receiptCount + 1).padStart(5, '0')}`;

      const receipt = await prisma.$transaction(async (tx) => {
        const newReceipt = await tx.receipt.create({
          data: {
            receiptNumber,
            bookingId: payment.bookingId,
            paymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency || 'ETB',
            environment: payment.environment,
            issuedById: req.user.id
          }
        });

        await tx.auditLog.create({
          data: {
            actorId: req.user.id,
            action: 'RECEIPT_GENERATED',
            entity: 'Receipt',
            entityId: newReceipt.id,
            metadata: {
              receiptNumber,
              paymentId: payment.id,
              bookingReference: payment.booking?.reference,
              amount: Number(payment.amount)
            }
          }
        });

        return newReceipt;
      });

      return sendSuccess(res, 201, 'Official receipt generated successfully.', {
        receipt: {
          receiptNumber: receipt.receiptNumber,
          customerName: payment.booking?.customer?.fullName || 'Valued Client',
          customerPhone: payment.booking?.customer?.phone,
          customerEmail: payment.booking?.customer?.email,
          bookingReference: payment.booking?.reference,
          contractReference: payment.booking?.contracts?.[0]?.id ? `CNT-${payment.booking.contracts[0].version}` : 'N/A',
          amount: Number(receipt.amount),
          currency: receipt.currency,
          paymentMethod: payment.paymentMethod,
          externalReference: payment.externalReference,
          issuedAt: receipt.issuedAt,
          verifiedAt: payment.verification?.verifiedAt || receipt.issuedAt,
          verifiedBy: payment.verification?.verifiedBy?.fullName || req.user.fullName || 'Eventora Finance Officer',
          company: {
            name: 'Eventora Events & Celebrations PLC',
            address: 'Bole Sub-City, Mickey Leland St, Addis Ababa, Ethiopia',
            phone: '+251 11 661 2345',
            email: 'finance@eventora.et',
            tin: '0092817462',
            vat: '118274619'
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/balances
   * Retrieve list of customer balances with calculated contract totals, verified paid,
   * outstanding balances, contractual due dates, and payment status.
   */
  static async getOutstandingBalances(req, res, next) {
    try {
      const {
        search,
        eventType,
        paymentStatus,
        startDate,
        endDate,
        sortBy = 'eventDate',
        sortOrder = 'asc',
        page,
        limit
      } = req.query;

      // Base query condition
      const where = {};

      // If customer role, restrict to their own records
      if (req.user.role === ROLES.CUSTOMER) {
        where.customerId = req.user.id;
      } else if (req.user.role === ROLES.COORDINATOR) {
        where.assignedCoordinatorId = req.user.id;
      }

      // Event type filter
      if (eventType && eventType !== 'ALL') {
        where.eventType = eventType;
      }

      // Date range filtering on event date (preferredDate)
      if (startDate || endDate) {
        where.preferredDate = {};
        if (startDate) where.preferredDate.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.preferredDate.lte = end;
        }
      }

      // Free-text search on customer, booking reference, or event title
      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { reference: { contains: q } },
          { title: { contains: q } },
          { customer: { fullName: { contains: q } } },
          { customer: { phone: { contains: q } } },
          { customer: { email: { contains: q } } }
        ];
      }

      // Fetch bookings with relations
      const bookings = await prisma.booking.findMany({
        where,
        include: {
          customer: {
            select: { id: true, fullName: true, email: true, phone: true }
          },
          assignedCoordinator: {
            select: { id: true, fullName: true, email: true, phone: true }
          },
          contracts: {
            where: { status: { in: ['SIGNED', 'PARTIALLY_SIGNED', 'PREPARED', 'SENT', 'DRAFT'] } },
            orderBy: { version: 'desc' },
            select: {
              id: true,
              version: true,
              status: true,
              totalAmount: true,
              initialPaymentAmount: true,
              finalPaymentAmount: true,
              currency: true,
              termsAndConditions: true,
              executedAt: true,
              createdAt: true
            }
          },
          payments: {
            include: {
              receipt: true,
              verification: {
                include: { verifiedBy: { select: { id: true, fullName: true, role: true } } }
              }
            },
            orderBy: { createdAt: 'desc' }
          },
          refunds: {
            where: { status: { in: ['PROCESSED', 'APPROVED'] } },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Process each booking's financial ledger
      const allBalances = bookings.map((b) => {
        const activeContract = b.contracts.find((c) => c.status === 'SIGNED') || b.contracts[0] || null;
        const contractTotal = activeContract
          ? Number(activeContract.totalAmount)
          : Number(b.budgetEstimate || 0);

        const initialRequired = activeContract
          ? Number(activeContract.initialPaymentAmount)
          : Math.round(contractTotal * 0.5);

        const finalRequired = activeContract
          ? Number(activeContract.finalPaymentAmount)
          : Math.max(0, contractTotal - initialRequired);

        // Sum verified payments (strictly excluding TEST mode transactions)
        const verifiedPayments = (b.payments || []).filter(
          (p) => p.status === 'VERIFIED' && p.environment !== 'TEST'
        );
        const totalVerifiedPaid = verifiedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

        // Sum approved refunds
        const approvedRefunds = (b.refunds || []).filter(
          (r) => r.status === 'PROCESSED' || r.status === 'APPROVED'
        );
        const totalRefunded = approvedRefunds.reduce((sum, r) => sum + Number(r.amount), 0);

        const netPaid = Math.max(0, totalVerifiedPaid - totalRefunded);
        const outstanding = Math.max(0, contractTotal - netPaid);
        const paymentProgress = contractTotal > 0 ? Math.min(100, Math.round((netPaid / contractTotal) * 100)) : 0;

        // Determine contractual next due date and stage
        let nextDueAmount = 0;
        let nextDueDate = null;
        let nextStage = 'FULLY_SETTLED';
        let calculatedStatus = 'PAID';

        const eventDate = new Date(b.preferredDate);
        eventDate.setHours(0, 0, 0, 0);

        if (outstanding <= 0) {
          calculatedStatus = 'PAID';
          nextDueAmount = 0;
          nextDueDate = null;
          nextStage = 'FULLY_SETTLED';
        } else if (netPaid < initialRequired) {
          // Initial deposit is still due
          nextDueAmount = initialRequired - netPaid;
          nextStage = 'INITIAL_DEPOSIT';
          // Due date is before the event (14 days before event date)
          const depositDueDate = new Date(eventDate);
          depositDueDate.setDate(depositDueDate.getDate() - 14);
          nextDueDate = depositDueDate;

          const diffDays = Math.ceil((depositDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            calculatedStatus = 'OVERDUE';
          } else if (diffDays === 0) {
            calculatedStatus = 'DUE';
          } else if (diffDays <= 7) {
            calculatedStatus = 'DUE_SOON';
          } else {
            calculatedStatus = netPaid > 0 ? 'PARTIALLY_PAID' : 'NOT_YET_DUE';
          }
        } else {
          // Initial deposit is satisfied; final settlement is due upon completion of event services
          nextDueAmount = outstanding;
          nextStage = 'FINAL_SETTLEMENT';
          nextDueDate = eventDate;

          const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 0 || b.eventStatus === 'COMPLETED') {
            calculatedStatus = 'OVERDUE';
          } else if (diffDays === 0) {
            calculatedStatus = 'DUE';
          } else if (diffDays <= 7) {
            calculatedStatus = 'DUE_SOON';
          } else {
            calculatedStatus = 'NOT_YET_DUE';
          }
        }

        return {
          bookingId: b.id,
          reference: b.reference,
          title: b.title,
          eventType: b.eventType,
          eventDate: b.preferredDate,
          eventStatus: b.eventStatus,
          bookingStatus: b.status,
          city: b.city,
          locationName: b.locationName,
          guestCount: b.guestCount,
          customer: b.customer,
          assignedCoordinator: b.assignedCoordinator,
          contract: activeContract,
          contractValue: contractTotal,
          initialDepositRequired: initialRequired,
          finalPaymentRequired: finalRequired,
          verifiedPaid: totalVerifiedPaid,
          refundedAmount: totalRefunded,
          netPaid,
          outstanding,
          paymentProgress,
          nextDueAmount,
          nextDueDate,
          nextStage,
          paymentStatus: calculatedStatus,
          payments: b.payments,
          refunds: b.refunds
        };
      });

      // Filter by paymentStatus if specified
      let filteredBalances = allBalances;
      if (paymentStatus && paymentStatus !== 'ALL') {
        const upperStatus = paymentStatus.toUpperCase();
        if (upperStatus === 'OUTSTANDING_ONLY') {
          filteredBalances = allBalances.filter((b) => b.outstanding > 0);
        } else if (upperStatus === 'OVERDUE') {
          filteredBalances = allBalances.filter((b) => b.paymentStatus === 'OVERDUE');
        } else if (upperStatus === 'DUE_SOON') {
          filteredBalances = allBalances.filter((b) => b.paymentStatus === 'DUE_SOON' || b.paymentStatus === 'DUE');
        } else if (upperStatus === 'PARTIALLY_PAID') {
          filteredBalances = allBalances.filter((b) => b.paymentStatus === 'PARTIALLY_PAID' || (b.netPaid > 0 && b.outstanding > 0));
        } else if (upperStatus === 'PAID') {
          filteredBalances = allBalances.filter((b) => b.paymentStatus === 'PAID');
        } else if (upperStatus === 'NOT_YET_DUE') {
          filteredBalances = allBalances.filter((b) => b.paymentStatus === 'NOT_YET_DUE');
        }
      }

      // Summary metrics across ALL eligible balances
      const balancesWithOutstanding = allBalances.filter((b) => b.outstanding > 0);
      const uniqueCustomersWithBalances = new Set(balancesWithOutstanding.map((b) => b.customer?.id || b.bookingId));
      
      const totalOutstanding = balancesWithOutstanding.reduce((sum, b) => sum + b.outstanding, 0);
      const dueSoonAmount = balancesWithOutstanding
        .filter((b) => b.paymentStatus === 'DUE_SOON' || b.paymentStatus === 'DUE')
        .reduce((sum, b) => sum + b.outstanding, 0);
      const overdueAmount = balancesWithOutstanding
        .filter((b) => b.paymentStatus === 'OVERDUE')
        .reduce((sum, b) => sum + b.outstanding, 0);

      const summary = {
        totalOutstanding,
        customersWithBalances: uniqueCustomersWithBalances.size,
        dueSoonAmount,
        overdueAmount,
        totalBookingsWithBalances: balancesWithOutstanding.length,
        totalContractedValue: allBalances.reduce((sum, b) => sum + b.contractValue, 0),
        totalVerifiedPaid: allBalances.reduce((sum, b) => sum + b.verifiedPaid, 0)
      };

      // Sorting
      filteredBalances.sort((a, b) => {
        let valA = a.eventDate;
        let valB = b.eventDate;
        if (sortBy === 'outstanding') {
          valA = a.outstanding;
          valB = b.outstanding;
        } else if (sortBy === 'contractValue') {
          valA = a.contractValue;
          valB = b.contractValue;
        } else if (sortBy === 'nextDueDate') {
          valA = a.nextDueDate ? new Date(a.nextDueDate).getTime() : 0;
          valB = b.nextDueDate ? new Date(b.nextDueDate).getTime() : 0;
        } else if (sortBy === 'customer') {
          valA = a.customer?.fullName || '';
          valB = b.customer?.fullName || '';
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // Pagination
      const parsedPage = page ? Math.max(1, parseInt(page, 10)) : 1;
      const parsedLimit = limit ? Math.max(1, parseInt(limit, 10)) : 10;
      const totalRecords = filteredBalances.length;
      const totalPages = Math.max(1, Math.ceil(totalRecords / parsedLimit));
      const paginatedBalances = page && limit
        ? filteredBalances.slice((parsedPage - 1) * parsedLimit, parsedPage * parsedLimit)
        : filteredBalances;

      return sendSuccess(res, 200, 'Outstanding balances retrieved successfully.', {
        summary,
        pagination: {
          total: totalRecords,
          page: parsedPage,
          limit: parsedLimit,
          totalPages
        },
        balances: paginatedBalances
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/finance/balances/:bookingId/remind
   * Send official payment reminder to customer through notification and messaging system
   */
  static async sendPaymentReminder(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { customNote } = req.body;

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          contracts: {
            where: { status: { in: ['SIGNED', 'PARTIALLY_SIGNED'] } },
            select: { id: true, version: true, totalAmount: true, initialPaymentAmount: true, finalPaymentAmount: true }
          },
          payments: {
            where: { status: 'VERIFIED' }
          },
          refunds: {
            where: { status: { in: ['PROCESSED', 'APPROVED'] } }
          }
        }
      });

      if (!booking) {
        throw new AppError('Booking not found.', 404);
      }

      if (!booking.customer) {
        throw new AppError('Customer record not associated with this booking.', 400);
      }

      const activeContract = booking.contracts[0] || null;
      const contractTotal = activeContract ? Number(activeContract.totalAmount) : Number(booking.budgetEstimate || 0);
      const totalPaid = booking.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalRefunded = booking.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
      const netPaid = Math.max(0, totalPaid - totalRefunded);
      const outstanding = Math.max(0, contractTotal - netPaid);

      if (outstanding <= 0) {
        throw new AppError('Customer has no outstanding balance for this booking. Payment reminder not required.', 400);
      }

      const formattedETB = `${outstanding.toLocaleString('en-US')} ETB`;
      const customerName = booking.customer.fullName || 'Valued Customer';
      const eventDateStr = new Date(booking.preferredDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const initialRequired = activeContract ? Number(activeContract.initialPaymentAmount) : contractTotal * 0.5;
      const isInitialDue = netPaid < initialRequired;
      const dueStageText = isInitialDue
        ? 'before the event execution per your initial milestone deposit schedule'
        : 'after completion of the contracted event services per your final settlement schedule';

      let reminderMessage = `Dear ${customerName}, our records show an outstanding balance of ${formattedETB} for booking ${booking.reference} (${booking.title}, scheduled for ${eventDateStr}). According to your payment schedule, this amount is due ${dueStageText}. Please contact Eventora Finance if you need assistance.`;

      if (customNote && customNote.trim()) {
        reminderMessage += ` Note from Finance: ${customNote.trim()}`;
      }

      const notification = await prisma.$transaction(async (tx) => {
        const notif = await tx.notification.create({
          data: {
            recipientId: booking.customerId,
            title: `Payment Reminder: Outstanding Balance for ${booking.reference}`,
            message: reminderMessage,
            type: 'PAYMENT_REMINDER',
            link: '/portal/payments'
          }
        });

        await tx.auditLog.create({
          data: {
            actorId: req.user.id,
            action: 'PAYMENT_REMINDER_SENT',
            entity: 'Booking',
            entityId: booking.id,
            reason: customNote || 'Official payment reminder for outstanding balance',
            metadata: {
              bookingReference: booking.reference,
              customerId: booking.customerId,
              customerName,
              outstandingETB: outstanding,
              contractTotal
            }
          }
        });

        return notif;
      });

      return sendSuccess(res, 200, 'Payment reminder sent successfully to customer.', {
        reminder: {
          notificationId: notification.id,
          recipient: booking.customer,
          bookingReference: booking.reference,
          outstandingAmount: outstanding,
          message: reminderMessage,
          sentAt: notification.createdAt
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/reports
   * Comprehensive, decimal-safe aggregated reporting data for Finance Officers & Directors.
   */
  static async getFinancialReports(req, res, next) {
    try {
      const reports = await FinanceService.getFinancialReportsData(req.query);
      return sendSuccess(res, 200, 'Financial reports data retrieved successfully.', reports);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = FinanceController;
