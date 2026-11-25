const { prisma } = require('../config/prisma');
const { sendSuccess, AppError } = require('../utils/response');
const { ROLES } = require('../config/roles');
const BookingWorkflowService = require('../services/bookingWorkflowService');
const BookingExpiryScheduler = require('../services/bookingExpiryScheduler');

class DashboardController {
  /**
   * GET /api/dashboard/summary
   * Returns role-scoped KPI metrics, alerts, and recent items
   */
  static async getSummary(req, res, next) {
    try {
      const user = req.user;
      let summary = {};

      switch (user.role) {
        case ROLES.CUSTOMER:
          summary = await DashboardController.getCustomerSummary(user.id);
          break;
        case ROLES.COORDINATOR:
          summary = await DashboardController.getCoordinatorSummary(user.id);
          break;
        case ROLES.FINANCE:
          summary = await DashboardController.getFinanceSummary(user.id);
          break;
        case ROLES.STAFF:
          summary = await DashboardController.getStaffSummary(user.id);
          break;
        case ROLES.ADMIN_DIRECTOR:
          summary = await DashboardController.getAdminSummary(user.id);
          break;
        default:
          throw new AppError('Unauthorized role for dashboard', 403);
      }

      return sendSuccess(res, 200, `${user.role} dashboard summary retrieved.`, {
        role: user.role,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        },
        ...summary
      });
    } catch (err) {
      next(err);
    }
  }

  static async getCustomerSummary(customerId) {
    const [bookings, payments, consultations, notifications] = await Promise.all([
      prisma.booking.findMany({
        where: { customerId },
        include: {
          package: true,
          quotations: { orderBy: { version: 'desc' }, take: 1 },
          contracts: { orderBy: { version: 'desc' }, take: 1 },
          payments: { orderBy: { createdAt: 'desc' } },
          milestones: { orderBy: { targetDate: 'asc' } }
        },
        orderBy: { preferredDate: 'asc' }
      }),
      prisma.payment.findMany({
        where: { submittedById: customerId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.consultationAppointment.findMany({
        where: { customerId },
        orderBy: { scheduledStartTime: 'asc' }
      }),
      prisma.notification.findMany({
        where: { recipientId: customerId },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    const activeBookings = bookings.filter((b) =>
      ['CONFIRMED', 'PREPARATION', 'IN_PROGRESS', 'QUOTATION_ACCEPTED', 'CONTRACT_PENDING'].includes(b.status)
    );
    const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
    const pendingRequests = bookings.filter((b) =>
      ['REQUESTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'QUOTATION_SENT'].includes(b.status)
    );

    let totalPaid = 0;
    let pendingPaymentAmount = 0;

    payments.forEach((p) => {
      const amt = parseFloat(p.amount) || 0;
      if (p.status === 'VERIFIED') totalPaid += amt;
      else if (p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW') pendingPaymentAmount += amt;
    });

    return {
      metrics: {
        totalBookings: bookings.length,
        activeEvents: activeBookings.length,
        completedEvents: completedBookings.length,
        pendingRequests: pendingRequests.length,
        totalPaidETB: totalPaid,
        pendingPaymentETB: pendingPaymentAmount,
        upcomingConsultations: consultations.filter((c) => new Date(c.scheduledStartTime) >= new Date()).length
      },
      bookings,
      consultations,
      payments,
      notifications
    };
  }

  static async getCoordinatorSummary(coordinatorId) {
    const now = new Date();
    await BookingExpiryScheduler.processExpiredBookings({ now }).catch(() => {});

    // 1. Fetch real database counts concurrently
    const [
      newBookingRequestsCount,
      bookingsUnderReviewCount,
      upcomingConsultationsCount,
      quotationsAwaitingResponseCount,
      contractsPendingSignatureCount,
      confirmedUpcomingEventsCount,
      tasksInProgressCount,
      tasksOverdueCount
    ] = await Promise.all([
      prisma.booking.count({ where: { status: 'REQUESTED' } }),
      prisma.booking.count({ where: { status: { in: ['UNDER_REVIEW', 'NEEDS_INFORMATION'] } } }),
      prisma.consultationAppointment.count({
        where: {
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          scheduledStartTime: { gte: now }
        }
      }),
      prisma.quotation.count({ where: { status: 'SENT' } }),
      prisma.contract.count({ where: { status: { in: ['SENT', 'PARTIALLY_SIGNED'] } } }),
      prisma.booking.count({
        where: {
          status: { in: ['CONFIRMED', 'PREPARATION', 'IN_PROGRESS'] },
          preferredDate: { gte: now }
        }
      }),
      prisma.staffTask.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.staffTask.count({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS', 'BLOCKED'] },
          dueDate: { lt: now }
        }
      })
    ]);

    // 2. Fetch records for the 7 dashboard sections concurrently
    const [
      recentBookingRequestsRaw,
      upcomingConsultationsRaw,
      upcomingEventsRaw,
      pendingQuotationsRaw,
      pendingContractsRaw,
      partnerAssignmentsRaw,
      staffTasksRaw,
      recentNotificationsRaw
    ] = await Promise.all([
      // Section 1: Recent Booking Requests (Incoming & Under Review)
      prisma.booking.findMany({
        where: {
          status: { in: ['REQUESTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'CHANGES_REQUESTED', 'QUOTATION_IN_PROGRESS'] }
        },
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true, profile: true } },
          assignedCoordinator: { select: { id: true, fullName: true, email: true } },
          package: true,
          items: { include: { service: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 6
      }),
      // Section 2: Upcoming Consultations
      prisma.consultationAppointment.findMany({
        where: {
          status: { in: ['SCHEDULED', 'CONFIRMED', 'REQUESTED'] },
          scheduledStartTime: { gte: new Date(now.getTime() - 24 * 3600 * 1000) }
        },
        include: {
          customer: { select: { id: true, fullName: true, phone: true, email: true, profile: true } },
          booking: { select: { id: true, reference: true, title: true, eventType: true, preferredDate: true } }
        },
        orderBy: { scheduledStartTime: 'asc' },
        take: 5
      }),
      // Section 3: Upcoming Confirmed Events
      prisma.booking.findMany({
        where: {
          status: { in: ['CONFIRMED', 'PREPARATION', 'IN_PROGRESS'] },
          preferredDate: { gte: new Date(now.getTime() - 24 * 3600 * 1000) }
        },
        include: {
          customer: { select: { id: true, fullName: true, phone: true, profile: true } },
          milestones: { orderBy: { order: 'asc' } },
          staffAssignments: { include: { staff: { select: { id: true, fullName: true } } } },
          partnerAssignments: { include: { partner: true } }
        },
        orderBy: { preferredDate: 'asc' },
        take: 5
      }),
      // Section 4a: Pending Quotations
      prisma.quotation.findMany({
        where: { status: { in: ['SENT', 'DRAFT', 'CHANGE_REQUESTED'] } },
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              eventType: true,
              customer: { select: { fullName: true, email: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      // Section 4b: Pending Contracts
      prisma.contract.findMany({
        where: { status: { in: ['SENT', 'PARTIALLY_SIGNED', 'DRAFT'] } },
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              eventType: true,
              customer: { select: { fullName: true, email: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      // Section 5: Partner Commitment Status
      prisma.partnerAssignment.findMany({
        include: {
          partner: true,
          booking: { select: { id: true, reference: true, title: true, preferredDate: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 6
      }),
      // Section 6: Staff Task Progress
      prisma.staffTask.findMany({
        include: {
          assignedStaff: { select: { id: true, fullName: true, email: true } },
          booking: { select: { id: true, reference: true, title: true } },
          incidentReports: { orderBy: { createdAt: 'desc' }, take: 1 }
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        take: 8
      }),
      // Section 7: Recent Notifications
      prisma.notification.findMany({
        where: {
          recipientId: coordinatorId
        },
        orderBy: { createdAt: 'desc' },
        take: 6
      })
    ]);

    // Format Section 1: Recent Booking Requests
    const recentBookingRequests = recentBookingRequestsRaw.map((b) => {
      let attentionTag = 'Needs review';
      if (b.status === 'NEEDS_INFORMATION') attentionTag = 'Missing details';
      else if (b.status === 'REQUESTED') attentionTag = 'Check availability';
      else if (b.status === 'UNDER_REVIEW') attentionTag = 'Under review';
      else if (b.status === 'QUOTATION_IN_PROGRESS') attentionTag = 'Quotation prep';

      return {
        id: b.id,
        reference: b.reference,
        title: b.title,
        eventType: b.eventType,
        customerName: b.customer?.fullName || 'Valued Customer',
        customerPhone: b.customer?.phone || null,
        customerEmail: b.customer?.email || null,
        customerAvatar: b.customer?.profile?.avatarUrl || null,
        guestCount: b.guestCount,
        budgetEstimate: b.budgetEstimate ? parseFloat(b.budgetEstimate) : null,
        preferredDate: b.preferredDate,
        preferredDateFormatted: b.preferredDate
          ? new Date(b.preferredDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Date TBD',
        location: b.locationName || b.city || 'Addis Ababa',
        status: b.status,
        attentionTag,
        assignedCoordinatorId: b.assignedCoordinatorId,
        assignedCoordinator: b.assignedCoordinator,
        createdAt: b.createdAt
      };
    });

    // Format Section 2: Upcoming Consultations
    const upcomingConsultations = upcomingConsultationsRaw.map((c) => {
      const dt = new Date(c.scheduledStartTime);
      const isToday = now.toDateString() === dt.toDateString();
      const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const timeFormatted = isToday ? `Today, ${timeStr}` : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

      return {
        id: c.id,
        bookingId: c.booking?.id,
        bookingReference: c.booking?.reference,
        bookingTitle: c.booking?.title,
        customerName: c.customer?.fullName || 'Customer',
        customerPhone: c.customer?.phone,
        customerAvatar: c.customer?.profile?.avatarUrl,
        topic: c.customerVisibleNotes || `${c.booking?.eventType || 'Event'} Consultation`,
        timeFormatted,
        scheduledStartTime: c.scheduledStartTime,
        method: c.method,
        meetingType: c.method === 'VIDEO_CALL' ? 'Google Meet Video Call' : 'In-Person Consultation',
        meetLink: c.meetLink,
        location: c.location || (c.method === 'VIDEO_CALL' ? 'Google Meet' : 'Eventora Office, Addis Ababa'),
        status: c.status
      };
    });

    // Format Section 3: Upcoming Confirmed Events
    const upcomingEvents = upcomingEventsRaw.map((b) => {
      const totalMilestones = b.milestones.length;
      const completedMilestones = b.milestones.filter((m) => m.status === 'COMPLETED').length;
      const progressPercent = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 10;
      const nextMilestone = b.milestones.find((m) => m.status !== 'COMPLETED')?.title || 'Day-of Event Execution';

      return {
        id: b.id,
        reference: b.reference,
        title: b.title,
        eventType: b.eventType,
        customerName: b.customer?.fullName,
        customerPhone: b.customer?.phone,
        dateFormatted: b.preferredDate
          ? new Date(b.preferredDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'TBD',
        location: b.locationName || 'Addis Ababa Venue',
        assignedStaffCount: b.staffAssignments.length,
        assignedPartnerCount: b.partnerAssignments.length,
        progressPercent,
        nextMilestone,
        status: b.status
      };
    });

    // Format Section 4: Pending Quotations and Contracts
    const pendingQuotations = pendingQuotationsRaw.map((q) => ({
      id: q.id,
      bookingId: q.booking?.id,
      bookingReference: q.booking?.reference,
      bookingTitle: q.booking?.title,
      customerName: q.booking?.customer?.fullName,
      version: q.version,
      status: q.status,
      totalAmountETB: parseFloat(q.totalAmount) || 0,
      createdAt: q.createdAt
    }));

    const pendingContracts = pendingContractsRaw.map((ct) => ({
      id: ct.id,
      bookingId: ct.booking?.id,
      bookingReference: ct.booking?.reference,
      bookingTitle: ct.booking?.title,
      customerName: ct.booking?.customer?.fullName,
      version: ct.version,
      status: ct.status,
      totalAmountETB: parseFloat(ct.totalAmount) || 0,
      initialPaymentAmountETB: parseFloat(ct.initialPaymentAmount) || 0,
      createdAt: ct.createdAt
    }));

    // Format Section 5: Partner Commitment Status
    const partnerCommitmentStatus = partnerAssignmentsRaw.map((pa) => ({
      id: pa.id,
      partnerName: pa.partner?.businessName || 'Specialist Partner',
      serviceCategory: Array.isArray(pa.partner?.serviceCategories) ? pa.partner.serviceCategories[0] : 'Vendor Service',
      bookingReference: pa.booking?.reference || 'EV-REQ',
      bookingTitle: pa.booking?.title || 'Celebration',
      status: pa.status,
      agreedCostETB: pa.agreedCost ? parseFloat(pa.agreedCost) : null,
      depositRequiredETB: pa.depositRequired ? parseFloat(pa.depositRequired) : null,
      partnerPhone: pa.partner?.contactPhone,
      partnerEmail: pa.partner?.contactEmail
    }));

    // Format Section 6: Staff Task Progress
    const staffTaskProgress = staffTasksRaw.map((st) => ({
      id: st.id,
      title: st.title,
      bookingReference: st.booking?.reference,
      bookingTitle: st.booking?.title,
      assignedStaffName: st.assignedStaff?.fullName || 'Unassigned',
      priority: st.priority,
      status: st.status,
      dueDate: st.dueDate,
      dueDateFormatted: st.dueDate
        ? new Date(st.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'No deadline',
      isOverdue: st.status !== 'COMPLETED' && st.dueDate && new Date(st.dueDate) < now,
      hasBlocker: st.incidentReports?.length > 0 || st.status === 'BLOCKED',
      blockerNote: st.incidentReports?.[0]?.description || null
    }));

    return {
      metrics: {
        newBookingRequestsCount,
        bookingsUnderReviewCount,
        upcomingConsultationsCount,
        quotationsAwaitingResponseCount,
        contractsPendingSignatureCount,
        confirmedUpcomingEventsCount,
        tasksInProgressCount,
        tasksOverdueCount
      },
      sections: {
        recentBookingRequests,
        upcomingConsultations,
        upcomingEvents,
        pendingQuotationsAndContracts: {
          quotations: pendingQuotations,
          contracts: pendingContracts
        },
        partnerCommitmentStatus,
        staffTaskProgress,
        recentActivitiesAndNotifications: recentNotificationsRaw
      },
      // Backward-compatibility keys for existing UI consumers
      recentBookingRequests,
      upcomingConsultations,
      upcomingEvents,
      partnerCommitmentStatus,
      staffTaskProgress,
      notifications: recentNotificationsRaw
    };
  }

  static async getFinanceSummary(userId) {
    const [payments, bookings, receipts, refunds] = await Promise.all([
      prisma.payment.findMany({
        include: {
          booking: { select: { id: true, reference: true, title: true, status: true, budgetEstimate: true } },
          submittedBy: { select: { id: true, fullName: true, email: true } },
          verification: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.booking.findMany({
        where: { status: { in: ['CONFIRMED', 'PREPARATION', 'IN_PROGRESS', 'COMPLETED'] } },
        include: {
          payments: { where: { status: 'VERIFIED' } },
          quotations: { where: { status: 'ACCEPTED' }, take: 1 }
        }
      }),
      prisma.receipt.findMany({
        orderBy: { issuedAt: 'desc' },
        take: 10,
        include: {
          booking: { select: { reference: true, title: true } }
        }
      }),
      prisma.refund.findMany({
        where: { status: 'PENDING' },
        include: { booking: { select: { reference: true, title: true } } }
      })
    ]);

    let totalVerifiedRevenue = 0;
    let pendingVerificationAmount = 0;
    let testModeRevenue = 0;
    let testModeTransactionsCount = 0;
    const pendingPayments = [];

    payments.forEach((p) => {
      const amt = parseFloat(p.amount) || 0;
      if (p.status === 'VERIFIED') {
        totalVerifiedRevenue += amt;
      } else if (p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW') {
        pendingVerificationAmount += amt;
        pendingPayments.push(p);
      }
    });

    let totalOutstandingBalance = 0;
    bookings.forEach((b) => {
      const agreedTotal = b.quotations[0] ? parseFloat(b.quotations[0].totalAmount) : parseFloat(b.budgetEstimate) || 0;
      const verifiedPaid = (b.payments || [])
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const diff = agreedTotal - verifiedPaid;
      if (diff > 0) totalOutstandingBalance += diff;
    });

    return {
      metrics: {
        pendingSubmissionsCount: pendingPayments.length,
        pendingSubmissionsETB: pendingVerificationAmount,
        totalVerifiedRevenueETB: totalVerifiedRevenue,
        testModeRevenueETB: testModeRevenue,
        testModeCount: testModeTransactionsCount,
        isTestModeNotice: 'CHAPA TEST MODE EXCLUDED FROM REAL REVENUE',
        totalOutstandingBalanceETB: totalOutstandingBalance,
        receiptsIssuedCount: receipts.length,
        pendingRefundsCount: refunds.length
      },
      pendingPayments,
      recentPayments: payments.slice(0, 15),
      receipts,
      refunds
    };
  }

  static async getStaffSummary(staffId) {
    const [assignments, tasks, incidents, notifications] = await Promise.all([
      prisma.staffAssignment.findMany({
        where: { staffId },
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              eventType: true,
              preferredDate: true,
              startTime: true,
              endTime: true,
              locationName: true,
              locationAddress: true,
              city: true,
              status: true,
              eventStatus: true,
              assignedCoordinator: {
                select: { id: true, fullName: true, phone: true }
              }
            }
          }
        },
        orderBy: { startTime: 'asc' }
      }),
      prisma.staffTask.findMany({
        where: { assignedStaffId: staffId },
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              eventType: true,
              preferredDate: true,
              locationName: true,
              assignedCoordinator: { select: { fullName: true } }
            }
          },
          incidentReports: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }]
      }),
      prisma.incidentReport.findMany({
        where: { reportedById: staffId },
        include: {
          task: { select: { id: true, title: true } },
          booking: { select: { id: true, reference: true, title: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.findMany({
        where: { recipientId: staffId },
        orderBy: { createdAt: 'desc' },
        take: 6
      })
    ]);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const pendingTasks = tasks.filter((t) => t.status === 'PENDING');
    const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS');
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');
    const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED');

    const tasksDueToday = tasks.filter((t) => {
      if (t.status === 'COMPLETED' || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= startOfToday && d <= endOfToday;
    });

    const overdueTasks = tasks.filter((t) => {
      if (t.status === 'COMPLETED' || !t.dueDate) return false;
      return new Date(t.dueDate) < startOfToday;
    });

    const upcomingEvents = assignments.filter((a) => {
      const eventTime = a.endTime ? new Date(a.endTime) : (a.startTime ? new Date(a.startTime) : null);
      return eventTime && eventTime >= startOfToday;
    });

    const todaysTasks = tasks.filter((t) => {
      if (t.status === 'COMPLETED') return false;
      if (t.status === 'IN_PROGRESS') return true;
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d <= endOfToday;
    });

    return {
      metrics: {
        myAssignedTasksCount: tasks.length,
        tasksDueTodayCount: tasksDueToday.length,
        overdueTasksCount: overdueTasks.length,
        tasksInProgressCount: inProgressTasks.length,
        completedTasksCount: completedTasks.length,
        blockedTasksCount: blockedTasks.length,
        upcomingAssignedEventsCount: upcomingEvents.length,
        totalTasksCount: tasks.length,
        assignedEventsCount: assignments.length,
        reportedIncidentsCount: incidents.length
      },
      todaysTasks,
      upcomingEvents,
      notifications,
      assignments,
      tasks,
      incidents
    };
  }

  static async getAdminSummary(adminId) {
    const [bookings, users, payments, auditLogs] = await Promise.all([
      prisma.booking.findMany({
        include: {
          customer: { select: { fullName: true, phone: true } },
          assignedCoordinator: { select: { id: true, fullName: true, email: true } },
          quotations: { where: { status: 'ACCEPTED' }, take: 1 },
          payments: { where: { status: 'VERIFIED' } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.findMany({
        select: { id: true, fullName: true, email: true, role: true, status: true, createdAt: true }
      }),
      prisma.payment.findMany({
        where: { status: 'VERIFIED' }
      }),
      prisma.auditLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 15,
        include: {
          actor: { select: { fullName: true, email: true, role: true } }
        }
      })
    ]);

    let totalVerifiedRevenue = 0;
    payments.forEach((p) => {
      totalVerifiedRevenue += parseFloat(p.amount) || 0;
    });

    let totalOutstandingBalance = 0;
    bookings.forEach((b) => {
      const target = b.quotations[0] ? parseFloat(b.quotations[0].totalAmount) : parseFloat(b.budgetEstimate) || 0;
      const paid = b.payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
      const diff = target - paid;
      if (diff > 0) totalOutstandingBalance += diff;
    });

    const roleCounts = {};
    users.forEach((u) => {
      roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
    });

    return {
      metrics: {
        totalBookings: bookings.length,
        activeEvents: bookings.filter((b) => ['CONFIRMED', 'PREPARATION', 'IN_PROGRESS'].includes(b.status)).length,
        pendingReviewBookings: bookings.filter((b) => b.status === 'REQUESTED').length,
        totalVerifiedRevenueETB: totalVerifiedRevenue,
        totalOutstandingBalanceETB: totalOutstandingBalance,
        totalUsers: users.length,
        roleCounts,
        recentAuditCount: auditLogs.length
      },
      bookings: bookings.slice(0, 10),
      users: users.filter((u) => u.role !== 'CUSTOMER'),
      auditLogs
    };
  }
}

module.exports = DashboardController;
