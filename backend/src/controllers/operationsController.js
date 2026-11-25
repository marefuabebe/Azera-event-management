const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/prisma');
const { sendSuccess, AppError } = require('../utils/response');
const AvailabilityService = require('../services/availabilityService');
const BookingWorkflowService = require('../services/bookingWorkflowService');
const emailNotificationService = require('../services/emailNotificationService');

class OperationsController {
  /**
   * POST /api/operations/bookings/:bookingId/partners
   * Atomic partner assignment with concurrency locking
   */
  static async assignPartner(req, res, next) {
    try {
      const { bookingId } = req.params;
      const {
        partnerId,
        partnerServiceId,
        startTime,
        endTime,
        agreedCost,
        depositRequired,
        paymentDeadline,
        travelMinutes = 45
      } = req.body;

      if (!partnerId || !startTime || !endTime || !agreedCost) {
        throw new AppError('partnerId, startTime, endTime, and agreedCost are required.', 400);
      }

      const assignment = await AvailabilityService.assignPartnerAtomic({
        bookingId,
        partnerId,
        partnerServiceId,
        startTime,
        endTime,
        agreedCost,
        depositRequired,
        paymentDeadline,
        travelMinutes
      });

      return sendSuccess(res, 201, 'Partner assigned successfully with locked schedule.', {
        assignment
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/bookings/:bookingId/partners
   */
  static async getBookingPartners(req, res, next) {
    try {
      const { bookingId } = req.params;

      const assignments = await prisma.partnerAssignment.findMany({
        where: { bookingId },
        include: {
          partner: true,
          partnerService: true,
          payable: true
        },
        orderBy: { startTime: 'asc' }
      });

      return sendSuccess(res, 200, 'Assigned partners retrieved.', {
        count: assignments.length,
        assignments
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/operations/bookings/:bookingId/staff
   * Assign staff member with conflict checking
   */
  static async assignStaff(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { staffId, role, startTime, endTime, location, bufferMinutes = 60 } = req.body;

      if (!staffId || !role || !startTime || !endTime) {
        throw new AppError('staffId, role, startTime, and endTime are required.', 400);
      }

      const check = await AvailabilityService.checkStaffAvailability({
        staffId,
        startTime,
        endTime,
        bufferMinutes
      });

      if (!check.isAvailable) {
        throw new AppError(
          `Staff scheduling conflict: ${check.reason}`,
          409,
          null,
          'STAFF_CONFLICT'
        );
      }

      const assignment = await prisma.staffAssignment.create({
        data: {
          bookingId,
          staffId,
          role,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          location: location || null,
          status: 'ASSIGNED'
        },
        include: {
          staff: { select: { id: true, fullName: true, role: true, phone: true } }
        }
      });

      return sendSuccess(res, 201, 'Staff member assigned successfully.', { assignment });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/bookings/:bookingId/staff
   */
  static async getBookingStaff(req, res, next) {
    try {
      const { bookingId } = req.params;

      const assignments = await prisma.staffAssignment.findMany({
        where: { bookingId },
        include: {
          staff: { select: { id: true, fullName: true, role: true, phone: true, email: true } }
        },
        orderBy: { startTime: 'asc' }
      });

      return sendSuccess(res, 200, 'Assigned staff retrieved.', {
        count: assignments.length,
        assignments
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/operations/bookings/:bookingId/inventory
   * Reserve fungible inventory with atomic stock lock
   */
  static async reserveInventory(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { inventoryItemId, quantityNeeded, startTime, endTime, bufferMinutes = 120 } = req.body;

      if (!inventoryItemId || !quantityNeeded || !startTime || !endTime) {
        throw new AppError(
          'inventoryItemId, quantityNeeded, startTime, and endTime are required.',
          400
        );
      }

      const reservation = await AvailabilityService.reserveInventoryAtomic({
        inventoryItemId,
        bookingId,
        quantityNeeded: parseInt(quantityNeeded, 10),
        startTime,
        endTime,
        bufferMinutes
      });

      return sendSuccess(res, 201, 'Inventory reserved successfully.', { reservation });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/bookings/:bookingId/inventory
   */
  static async getBookingInventory(req, res, next) {
    try {
      const { bookingId } = req.params;

      const reservations = await prisma.inventoryReservation.findMany({
        where: { bookingId },
        include: { inventoryItem: true },
        orderBy: { startTime: 'asc' }
      });

      return sendSuccess(res, 200, 'Inventory reservations retrieved.', {
        count: reservations.length,
        reservations
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/bookings/:bookingId/milestones
   * Event milestones / runsheet
   */
  static async getMilestones(req, res, next) {
    try {
      const { bookingId } = req.params;

      const milestones = await prisma.eventMilestone.findMany({
        where: { bookingId },
        orderBy: [{ order: 'asc' }, { targetDate: 'asc' }]
      });

      return sendSuccess(res, 200, 'Milestones retrieved.', {
        count: milestones.length,
        milestones
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/operations/bookings/:bookingId/milestones
   */
  static async addMilestone(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { title, targetDate, order = 0 } = req.body;

      if (!title || !targetDate) {
        throw new AppError('title and targetDate are required.', 400);
      }

      const milestone = await prisma.eventMilestone.create({
        data: {
          bookingId,
          title,
          targetDate: new Date(targetDate),
          order: parseInt(order, 10)
        }
      });

      return sendSuccess(res, 201, 'Milestone added to runsheet.', { milestone });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/operations/milestones/:id
   */
  static async updateMilestone(req, res, next) {
    try {
      const { id } = req.params;
      const { isCompleted, title, targetDate } = req.body;

      const updateData = {};
      if (typeof isCompleted === 'boolean') {
        updateData.isCompleted = isCompleted;
        updateData.completedAt = isCompleted ? new Date() : null;
      }
      if (title) updateData.title = title;
      if (targetDate) updateData.targetDate = new Date(targetDate);

      const milestone = await prisma.eventMilestone.update({
        where: { id },
        data: updateData
      });

      return sendSuccess(res, 200, 'Milestone updated.', { milestone });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/milestones
   * List all milestones across events for master runsheet timeline
   */
  static async listAllMilestones(req, res, next) {
    try {
      const milestones = await prisma.eventMilestone.findMany({
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              preferredDate: true,
              locationName: true,
              eventType: true,
              eventStatus: true
            }
          }
        },
        orderBy: [{ targetDate: 'asc' }, { order: 'asc' }]
      });

      return sendSuccess(res, 200, 'All event milestones retrieved.', {
        count: milestones.length,
        milestones
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/operations/milestones/:id
   */
  static async deleteMilestone(req, res, next) {
    try {
      const { id } = req.params;
      await prisma.eventMilestone.delete({ where: { id } });
      return sendSuccess(res, 200, 'Milestone deleted successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/operations/bookings/:bookingId/complete
   * Mark event execution completed and calculate final balance outstanding
   */
  static async completeEvent(req, res, next) {
    try {
      const { bookingId } = req.params;

      const updatedBooking = await BookingWorkflowService.completeEvent(bookingId);

      return sendSuccess(
        res,
        200,
        `Event execution completed. Financial status updated to '${updatedBooking.paymentPosition}'.`,
        { booking: updatedBooking }
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/inventory/items
   * List all warehouse inventory items with reservation stats
   */
  static async listInventoryItems(req, res, next) {
    try {
      const items = await prisma.inventoryItem.findMany({
        include: {
          reservations: {
            where: { status: { in: ['PROVISIONAL', 'CONFIRMED'] } }
          }
        },
        orderBy: { category: 'asc' }
      });

      return sendSuccess(res, 200, 'Inventory items retrieved.', { items });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/operations/inventory/items
   */
  static async createInventoryItem(req, res, next) {
    try {
      const { name, category, totalQuantity, condition = 'EXCELLENT', location } = req.body;

      if (!name || !category || totalQuantity === undefined) {
        throw new AppError('name, category, and totalQuantity are required.', 400);
      }

      const qty = parseInt(totalQuantity, 10);
      const item = await prisma.inventoryItem.create({
        data: {
          name: name.trim(),
          category: category.trim(),
          totalQuantity: qty,
          availableQuantity: qty,
          condition,
          location: location || 'Main Warehouse, Addis Ababa'
        }
      });

      return sendSuccess(res, 201, 'Inventory item registered successfully.', { item });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/operations/inventory/items/:id
   */
  static async updateInventoryItem(req, res, next) {
    try {
      const { id } = req.params;
      const { name, category, totalQuantity, condition, location } = req.body;

      const updateData = {};
      if (name) updateData.name = name.trim();
      if (category) updateData.category = category.trim();
      if (totalQuantity !== undefined) {
        const qty = parseInt(totalQuantity, 10);
        updateData.totalQuantity = qty;
        // recalculate available based on reservations
        const activeRes = await prisma.inventoryReservation.aggregate({
          where: { inventoryItemId: id, status: { in: ['PROVISIONAL', 'CONFIRMED'] } },
          _sum: { quantityReserved: true }
        });
        const reservedTotal = activeRes._sum.quantityReserved || 0;
        updateData.availableQuantity = Math.max(0, qty - reservedTotal);
      }
      if (condition) updateData.condition = condition;
      if (location) updateData.location = location;

      const item = await prisma.inventoryItem.update({
        where: { id },
        data: updateData
      });

      return sendSuccess(res, 200, 'Inventory item updated.', { item });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/operations/inventory/items/:id
   */
  static async deleteInventoryItem(req, res, next) {
    try {
      const { id } = req.params;
      const active = await prisma.inventoryReservation.count({
        where: { inventoryItemId: id, status: { in: ['PROVISIONAL', 'CONFIRMED'] } }
      });
      if (active > 0) {
        throw new AppError('Cannot delete an inventory asset that has active reservations.', 400);
      }
      await prisma.inventoryItem.delete({ where: { id } });
      return sendSuccess(res, 200, 'Inventory asset deleted successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/inventory/reservations
   */
  static async listInventoryReservations(req, res, next) {
    try {
      const reservations = await prisma.inventoryReservation.findMany({
        include: {
          inventoryItem: true,
          booking: {
            select: { id: true, reference: true, title: true, preferredDate: true, locationName: true }
          }
        },
        orderBy: { startTime: 'asc' }
      });

      return sendSuccess(res, 200, 'Inventory reservations retrieved.', { reservations });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/tasks
   * Staff gets their assigned tasks; Coordinator/Admin gets all
   */
  static async listTasks(req, res, next) {
    try {
      const user = req.user;
      const { bookingId, status, priority, assignedStaffId } = req.query;
      const where = {};

      if (user.role === 'STAFF') {
        where.assignedStaffId = user.id;
      } else if (assignedStaffId) {
        where.assignedStaffId = assignedStaffId;
      }

      if (bookingId) where.bookingId = bookingId;
      if (status) where.status = status;
      if (priority) where.priority = priority;

      const tasks = await prisma.staffTask.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              preferredDate: true,
              locationName: true,
              eventType: true,
              eventStatus: true
            }
          },
          assignedStaff: { select: { id: true, fullName: true, email: true, phone: true } },
          createdBy: { select: { id: true, fullName: true } },
          incidentReports: {
            include: {
              reportedBy: { select: { id: true, fullName: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }]
      });

      return sendSuccess(res, 200, 'Tasks retrieved.', { count: tasks.length, tasks });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/operations/tasks
   */
  static async createTask(req, res, next) {
    try {
      const { bookingId, title, description, assignedStaffId, priority = 'MEDIUM', dueDate } = req.body;

      if (!bookingId || !title) {
        throw new AppError('bookingId and title are required.', 400);
      }

      const task = await prisma.staffTask.create({
        data: {
          bookingId,
          title: title.trim(),
          description: description ? description.trim() : null,
          assignedStaffId: assignedStaffId || null,
          createdById: req.user.id,
          priority,
          status: 'PENDING',
          dueDate: dueDate ? new Date(dueDate) : null
        },
        include: {
          assignedStaff: { select: { id: true, fullName: true, email: true, phone: true } },
          booking: { select: { id: true, reference: true, title: true, preferredDate: true, locationName: true, assignedCoordinatorId: true } }
        }
      });

      // Dispatch 6-Actor Category 7: Event Task Assigned (Coordinator -> Operations Staff)
      if (task.assignedStaff) {
        emailNotificationService.sendEventTaskAssigned({
          task,
          assignedStaff: task.assignedStaff,
          coordinator: req.user,
          booking: task.booking
        }).catch(() => {});
      }

      return sendSuccess(res, 201, 'Task created successfully.', { task });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/operations/tasks/:id/status
   */
  static async updateTaskStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'].includes(status)) {
        throw new AppError('Valid status is required (PENDING, IN_PROGRESS, COMPLETED, BLOCKED)', 400);
      }

      const existingTask = await prisma.staffTask.findUnique({
        where: { id },
        include: {
          booking: {
            select: { id: true, reference: true, title: true, assignedCoordinatorId: true }
          }
        }
      });
      if (!existingTask) {
        throw new AppError('Task not found.', 404);
      }

      // Enforce: Staff can only update status on tasks assigned to them
      if (req.user.role === 'STAFF' && existingTask.assignedStaffId !== req.user.id) {
        throw new AppError('Access denied: You can only update tasks assigned to your account.', 403);
      }

      const task = await prisma.staffTask.update({
        where: { id },
        data: {
          status,
          completedAt: status === 'COMPLETED' ? new Date() : null
        },
        include: {
          assignedStaff: { select: { id: true, fullName: true } },
          booking: { select: { id: true, reference: true, title: true, assignedCoordinatorId: true } }
        }
      });

      // Dispatch notifications to the Lead Coordinator if task is COMPLETED or BLOCKED
      if (task.booking?.assignedCoordinatorId) {
        if (status === 'COMPLETED') {
          emailNotificationService.sendTaskCompleted({
            task,
            operationsStaff: req.user,
            coordinator: null,
            booking: task.booking
          }).catch(() => {});

          await prisma.notification.create({
            data: {
              recipientId: task.booking.assignedCoordinatorId,
              title: 'Task Completed by Staff',
              message: `${req.user.fullName || 'Staff'} marked task "${task.title}" as COMPLETED for event ${task.booking.reference}.`,
              type: 'TASK',
              link: '/company/tasks',
              isRead: false
            }
          }).catch((e) => console.debug('Task completion notification error:', e));
        } else if (status === 'BLOCKED') {
          await prisma.notification.create({
            data: {
              recipientId: task.booking.assignedCoordinatorId,
              title: 'Task Flagged as Blocked',
              message: `Urgent: Task "${task.title}" for event ${task.booking.reference} was marked BLOCKED by ${req.user.fullName || 'Staff'}.`,
              type: 'TASK',
              link: '/company/tasks',
              isRead: false
            }
          }).catch((e) => console.debug('Task blocked notification error:', e));
        }
      }

      return sendSuccess(res, 200, 'Task status updated.', { task });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/operations/tasks/:id/notes
   * Append a timestamped progress note to task description
   */
  static async addTaskNote(req, res, next) {
    try {
      const { id } = req.params;
      const { note } = req.body;

      if (!note || !note.trim()) {
        throw new AppError('Progress note cannot be empty.', 400);
      }

      const existingTask = await prisma.staffTask.findUnique({
        where: { id },
        include: {
          booking: { select: { id: true, reference: true, title: true, assignedCoordinatorId: true } }
        }
      });
      if (!existingTask) {
        throw new AppError('Task not found.', 404);
      }

      if (req.user.role === 'STAFF' && existingTask.assignedStaffId !== req.user.id) {
        throw new AppError('Access denied: You can only add notes to tasks assigned to your account.', 403);
      }

      const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const noteEntry = `\n\n[Progress Note - ${timestamp} by ${req.user.fullName}]: ${note.trim()}`;
      const newDescription = (existingTask.description || '') + noteEntry;

      const task = await prisma.staffTask.update({
        where: { id },
        data: { description: newDescription },
        include: {
          booking: { select: { id: true, reference: true, title: true } },
          assignedStaff: { select: { id: true, fullName: true, email: true, phone: true } },
          createdBy: { select: { id: true, fullName: true } },
          incidentReports: true
        }
      });

      return sendSuccess(res, 200, 'Progress note added to task.', { task });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/operations/tasks/:id
   * Edit task title, description, priority, dueDate, assignedStaffId, status
   */
  static async updateTask(req, res, next) {
    try {
      const { id } = req.params;
      const { title, description, assignedStaffId, priority, dueDate, status } = req.body;

      const existingTask = await prisma.staffTask.findUnique({ where: { id } });
      if (!existingTask) {
        throw new AppError('Task not found.', 404);
      }

      // Enforce: Staff cannot change ownership or reassign tasks
      if (req.user.role === 'STAFF') {
        if (existingTask.assignedStaffId !== req.user.id) {
          throw new AppError('Access denied: You can only update tasks assigned to your account.', 403);
        }
        if (assignedStaffId !== undefined && assignedStaffId !== existingTask.assignedStaffId) {
          throw new AppError('Staff members cannot change task ownership or reassign tasks.', 403);
        }
        if (title !== undefined && title !== existingTask.title) {
          throw new AppError('Staff members cannot alter official task titles.', 403);
        }
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description ? description.trim() : null;
      if (assignedStaffId !== undefined) updateData.assignedStaffId = assignedStaffId || null;
      if (priority) updateData.priority = priority;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (status) {
        if (!['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'].includes(status)) {
          throw new AppError('Valid status is required (PENDING, IN_PROGRESS, COMPLETED, BLOCKED)', 400);
        }
        updateData.status = status;
        updateData.completedAt = status === 'COMPLETED' ? new Date() : null;
      }

      const task = await prisma.staffTask.update({
        where: { id },
        data: updateData,
        include: {
          booking: { select: { id: true, reference: true, title: true, preferredDate: true, locationName: true } },
          assignedStaff: { select: { id: true, fullName: true, email: true, phone: true } },
          createdBy: { select: { id: true, fullName: true } },
          incidentReports: {
            include: {
              reportedBy: { select: { id: true, fullName: true } }
            }
          }
        }
      });

      return sendSuccess(res, 200, 'Task updated successfully.', { task });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/operations/tasks/:id
   */
  static async deleteTask(req, res, next) {
    try {
      const { id } = req.params;
      if (req.user.role === 'STAFF') {
        throw new AppError('Access denied: Staff members cannot delete tasks.', 403);
      }
      await prisma.staffTask.delete({ where: { id } });
      return sendSuccess(res, 200, 'Task deleted successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/operations/tasks/:id/incidents
   * File an incident report attached to this task and booking
   */
  static async createTaskIncident(req, res, next) {
    try {
      const { id } = req.params;
      const { incidentType, description, severity = 'MEDIUM' } = req.body;

      if (!incidentType || !description) {
        throw new AppError('incidentType and description are required.', 400);
      }

      const task = await prisma.staffTask.findUnique({
        where: { id },
        include: {
          booking: { select: { id: true, reference: true, title: true, assignedCoordinatorId: true } }
        }
      });
      if (!task) {
        throw new AppError('Task not found.', 404);
      }

      if (req.user.role === 'STAFF' && task.assignedStaffId && task.assignedStaffId !== req.user.id) {
        throw new AppError('Access denied: You can only report issues on tasks assigned to you.', 403);
      }

      const incident = await prisma.incidentReport.create({
        data: {
          bookingId: task.bookingId,
          taskId: task.id,
          reportedById: req.user.id,
          incidentType: incidentType.trim(),
          description: description.trim(),
          severity: severity.toUpperCase()
        },
        include: {
          reportedBy: { select: { id: true, fullName: true, email: true } }
        }
      });

      // Auto-flag task as BLOCKED if severe incident
      if (['HIGH', 'CRITICAL', 'URGENT'].includes(severity.toUpperCase())) {
        await prisma.staffTask.update({
          where: { id },
          data: { status: 'BLOCKED' }
        });
      }

      // Dispatch 6-Actor Category 8: Important Event Issue Reported & Critical Operational Alert
      emailNotificationService.sendImportantEventIssueReported({
        incident,
        booking: task.booking,
        operationsStaff: req.user
      }).catch(() => {});

      if (['CRITICAL', 'URGENT'].includes(severity.toUpperCase())) {
        emailNotificationService.sendCriticalOperationalAlert({
          alertDetails: incident,
          booking: task.booking
        }).catch(() => {});
      }

      // Notify the Lead Coordinator
      if (task.booking?.assignedCoordinatorId) {
        await prisma.notification.create({
          data: {
            recipientId: task.booking.assignedCoordinatorId,
            title: `Blocker/Issue Reported: ${incidentType.trim()}`,
            message: `${req.user.fullName || 'Staff'} reported an issue on "${task.title}" (${task.booking.reference}): "${description.trim()}". Severity: ${severity.toUpperCase()}`,
            type: 'INCIDENT',
            link: '/company/tasks',
            isRead: false
          }
        }).catch((e) => console.debug('Incident notification dispatch error:', e));
      }

      return sendSuccess(res, 201, 'Incident report filed successfully.', { incident });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/staff/my-events
   * Returns events where the authenticated staff member has an assignment
   */
  static async getMyEvents(req, res, next) {
    try {
      const staffId = req.user.id;

      const assignments = await prisma.staffAssignment.findMany({
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
              eventStatus: true,
              status: true,
              assignedCoordinator: {
                select: { id: true, fullName: true, phone: true, email: true }
              },
              milestones: {
                select: { id: true, title: true, targetDate: true, isCompleted: true, order: true },
                orderBy: { order: 'asc' }
              }
            }
          }
        },
        orderBy: { startTime: 'asc' }
      });

      // Related staff tasks for these events
      const bookingIds = assignments.map((a) => a.bookingId);
      const staffTasks = await prisma.staffTask.findMany({
        where: {
          bookingId: { in: bookingIds },
          assignedStaffId: staffId
        },
        orderBy: { dueDate: 'asc' }
      });

      const events = assignments.map((a) => {
        const relatedTasks = staffTasks.filter((t) => t.bookingId === a.bookingId);
        return {
          id: a.id,
          assignmentId: a.id,
          role: a.role,
          assignmentStartTime: a.startTime,
          assignmentEndTime: a.endTime,
          assignmentLocation: a.location,
          assignmentStatus: a.status,
          booking: a.booking,
          tasks: relatedTasks
        };
      });

      return sendSuccess(res, 200, 'Assigned staff events retrieved.', {
        count: events.length,
        events
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/staff/my-schedule
   * Returns chronological personal schedule combining event duties & task deadlines
   */
  static async getMySchedule(req, res, next) {
    try {
      const staffId = req.user.id;

      const [assignments, tasks] = await Promise.all([
        prisma.staffAssignment.findMany({
          where: { staffId },
          include: {
            booking: {
              select: {
                id: true,
                reference: true,
                title: true,
                eventType: true,
                locationName: true,
                locationAddress: true,
                city: true,
                eventStatus: true,
                status: true,
                assignedCoordinator: { select: { fullName: true, phone: true } }
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
                locationName: true
              }
            }
          },
          orderBy: { dueDate: 'asc' }
        })
      ]);

      // 1. Deduplicate assignments and tasks to guard against duplicate database records
      const seenAssignments = new Set();
      const uniqueAssignments = [];
      for (const a of assignments) {
        const key = `${a.bookingId || a.booking?.reference}-${a.role}-${new Date(a.startTime).toISOString()}`;
        if (!seenAssignments.has(key)) {
          seenAssignments.add(key);
          uniqueAssignments.push(a);
        }
      }

      const seenTasks = new Set();
      const uniqueTasks = [];
      for (const t of tasks) {
        const key = `${t.bookingId || 'general'}-${t.title}-${t.dueDate ? new Date(t.dueDate).toISOString() : 'no-due'}`;
        if (!seenTasks.has(key)) {
          seenTasks.add(key);
          uniqueTasks.push(t);
        }
      }

      // 2. Accurate Conflict Detection: Only report genuine overlapping time intervals between active assignments
      const conflictMap = new Set();
      const conflicts = [];

      for (let i = 0; i < uniqueAssignments.length; i++) {
        for (let j = i + 1; j < uniqueAssignments.length; j++) {
          const a = uniqueAssignments[i];
          const b = uniqueAssignments[j];

          // Ignore cancelled assignments
          if (a.status === 'CANCELLED' || b.status === 'CANCELLED') continue;

          const aStart = new Date(a.startTime);
          const aEnd = new Date(a.endTime);
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);

          if (aStart < bEnd && aEnd > bStart) {
            conflictMap.add(a.id);
            conflictMap.add(b.id);

            const overlapStart = new Date(Math.max(aStart.getTime(), bStart.getTime()));
            const overlapEnd = new Date(Math.min(aEnd.getTime(), bEnd.getTime()));

            conflicts.push({
              id: `conflict-${a.id}-${b.id}`,
              assignmentA: {
                id: a.id,
                title: a.booking?.title || 'Event Duty',
                role: a.role,
                startTime: a.startTime,
                endTime: a.endTime,
                location: a.location || a.booking?.locationName || 'Venue TBD'
              },
              assignmentB: {
                id: b.id,
                title: b.booking?.title || 'Event Duty',
                role: b.role,
                startTime: b.startTime,
                endTime: b.endTime,
                location: b.location || b.booking?.locationName || 'Venue TBD'
              },
              overlapStart: overlapStart.toISOString(),
              overlapEnd: overlapEnd.toISOString(),
              message: `Overlapping duty shifts: "${a.role}" and "${b.role}" conflict`
            });
          }
        }
      }

      const scheduleItems = [
        ...uniqueAssignments.map((a) => ({
          id: a.id,
          type: 'EVENT_DUTY',
          title: `${a.role} — ${a.booking?.title || 'Event Duty'}`,
          reference: a.booking?.reference,
          eventType: a.booking?.eventType,
          startTime: a.startTime,
          endTime: a.endTime,
          date: a.startTime,
          location: a.location || a.booking?.locationName || 'Venue TBD',
          assignedRole: a.role,
          status: a.status,
          hasConflict: conflictMap.has(a.id),
          isAllDay: false,
          booking: a.booking
        })),
        ...uniqueTasks
          .filter((t) => t.dueDate)
          .map((t) => {
            const due = new Date(t.dueDate);
            const isAllDay = due.getUTCHours() === 0 && due.getUTCMinutes() === 0 && due.getUTCSeconds() === 0;
            return {
              id: t.id,
              type: 'TASK_DEADLINE',
              title: `Task: ${t.title}`,
              rawTitle: t.title,
              reference: t.booking?.reference,
              eventType: t.booking?.eventType,
              startTime: t.dueDate,
              endTime: t.dueDate,
              date: t.dueDate,
              location: t.booking?.locationName || 'On-site',
              priority: t.priority,
              status: t.status,
              isAllDay,
              task: t
            };
          })
      ].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      return sendSuccess(res, 200, 'Personal staff schedule retrieved.', {
        totalItems: scheduleItems.length,
        schedule: scheduleItems,
        conflicts
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/partners
   */
  static async listPartners(req, res, next) {
    try {
      const partners = await prisma.partner.findMany({
        include: {
          services: true,
          assignments: {
            include: {
              booking: {
                select: {
                  id: true,
                  reference: true,
                  title: true,
                  preferredDate: true,
                  startTime: true,
                  endTime: true,
                  locationName: true,
                  eventType: true,
                  eventStatus: true
                }
              },
              partnerService: true,
              payable: true
            },
            orderBy: { startTime: 'desc' }
          },
          payables: true,
          _count: {
            select: {
              assignments: true,
              services: true
            }
          }
        },
        orderBy: { businessName: 'asc' }
      });

      return sendSuccess(res, 200, 'Partners retrieved.', { partners });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/operations/partners
   */
  static async createPartner(req, res, next) {
    try {
      const {
        businessName,
        name,
        contactPerson,
        phone,
        email,
        serviceCategories,
        category,
        coverageAreas,
        city,
        bankDetails,
        terms,
        notes
      } = req.body;

      const finalName = (businessName || name || '').trim();
      if (!finalName || !phone) {
        throw new AppError('Business name and phone number are required.', 400);
      }

      let categories = [];
      if (Array.isArray(serviceCategories) && serviceCategories.length > 0) {
        categories = serviceCategories;
      } else if (category) {
        categories = [category];
      } else if (serviceCategories && typeof serviceCategories === 'string') {
        categories = [serviceCategories];
      } else {
        categories = ['OTHER'];
      }

      const partner = await prisma.partner.create({
        data: {
          businessName: finalName,
          contactPerson: (contactPerson || 'Office Liaison').trim(),
          phone: phone.trim(),
          email: email ? email.trim() : null,
          serviceCategories: categories,
          coverageAreas: coverageAreas || (city ? [city] : ['Addis Ababa']),
          bankDetails: bankDetails || null,
          terms: terms || null,
          notes: notes || null,
          isActive: true
        },
        include: {
          services: true,
          assignments: true,
          payables: true
        }
      });

      return sendSuccess(res, 201, 'Partner created successfully.', { partner });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/operations/partners/:id
   */
  static async updatePartner(req, res, next) {
    try {
      const { id } = req.params;
      const {
        businessName,
        contactPerson,
        phone,
        email,
        serviceCategories,
        coverageAreas,
        bankDetails,
        terms,
        notes,
        isActive
      } = req.body;

      const updateData = {};
      if (businessName) updateData.businessName = businessName.trim();
      if (contactPerson !== undefined) updateData.contactPerson = contactPerson.trim();
      if (phone !== undefined) updateData.phone = phone.trim();
      if (email !== undefined) updateData.email = email ? email.trim() : null;
      if (serviceCategories !== undefined) {
        updateData.serviceCategories = Array.isArray(serviceCategories) ? serviceCategories : [serviceCategories];
      }
      if (coverageAreas !== undefined) updateData.coverageAreas = coverageAreas;
      if (bankDetails !== undefined) updateData.bankDetails = bankDetails;
      if (terms !== undefined) updateData.terms = terms;
      if (notes !== undefined) updateData.notes = notes;
      if (typeof isActive === 'boolean') updateData.isActive = isActive;

      const partner = await prisma.partner.update({
        where: { id },
        data: updateData,
        include: {
          services: true,
          assignments: {
            include: {
              booking: {
                select: {
                  id: true,
                  reference: true,
                  title: true,
                  preferredDate: true,
                  startTime: true,
                  endTime: true,
                  locationName: true,
                  eventType: true,
                  eventStatus: true
                }
              },
              partnerService: true,
              payable: true
            },
            orderBy: { startTime: 'desc' }
          },
          payables: true,
          _count: { select: { assignments: true, services: true } }
        }
      });

      return sendSuccess(res, 200, 'Partner updated successfully.', { partner });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/operations/partners/:id/services
   */
  static async addPartnerService(req, res, next) {
    try {
      const { id } = req.params;
      const {
        title,
        rateCostBasis,
        rateUnit = 'FLAT_PER_EVENT',
        dailyCapacity = 1,
        simultaneousCapacity = 1,
        minimumLeadTimeDays = 7,
        isExclusiveResource = true
      } = req.body;

      if (!title || rateCostBasis === undefined) {
        throw new AppError('Service title and rate cost basis are required.', 400);
      }

      const service = await prisma.partnerService.create({
        data: {
          partnerId: id,
          title: title.trim(),
          rateCostBasis: new Prisma.Decimal(rateCostBasis),
          rateUnit,
          dailyCapacity: parseInt(dailyCapacity, 10) || 1,
          simultaneousCapacity: parseInt(simultaneousCapacity, 10) || 1,
          minimumLeadTimeDays: parseInt(minimumLeadTimeDays, 10) || 7,
          isExclusiveResource: Boolean(isExclusiveResource)
        }
      });

      return sendSuccess(res, 201, 'Partner service registered successfully.', { service });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/operations/partners/assignments/:id/status
   */
  static async updateAssignmentStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = [
        'NOT_REQUESTED',
        'AVAILABILITY_REQUESTED',
        'TENTATIVE',
        'CONFIRMED',
        'DECLINED',
        'CANCELLED',
        'COMPLETED'
      ];
      if (!status || !validStatuses.includes(status)) {
        throw new AppError(`Valid status required: ${validStatuses.join(', ')}`, 400);
      }

      const assignment = await prisma.partnerAssignment.update({
        where: { id },
        data: { status },
        include: {
          partner: true,
          booking: { select: { id: true, reference: true, title: true } }
        }
      });

      return sendSuccess(res, 200, `Partner assignment status updated to ${status}.`, { assignment });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/operations/audit-logs
   */
  static async listAuditLogs(req, res, next) {
    try {
      const { page = 1, limit = 25 } = req.query;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          include: {
            actor: { select: { id: true, fullName: true, email: true, role: true } }
          },
          orderBy: { timestamp: 'desc' },
          skip,
          take: limitNum
        }),
        prisma.auditLog.count()
      ]);

      return sendSuccess(res, 200, 'Audit logs retrieved.', {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List staff accounts (Admin & Coordinator)
   */
  static async listStaff(req, res, next) {
    try {
      const staffUsers = await prisma.user.findMany({
        where: {
          role: {
            in: [ROLES.COORDINATOR, ROLES.FINANCE, ROLES.STAFF, ROLES.INVENTORY, ROLES.ADMIN_DIRECTOR]
          }
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          lastLogin: true,
          staffProfile: true,
          _count: {
            select: {
              assignedTasks: true,
              coordinatedBookings: true
            }
          }
        },
        orderBy: { fullName: 'asc' }
      });

      return sendSuccess(res, 200, 'Staff accounts retrieved.', { staff: staffUsers });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update staff role or status (Strictly Admin Director)
   */
  static async updateStaffRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role, status } = req.body;

      const validRoles = [ROLES.COORDINATOR, ROLES.FINANCE, ROLES.STAFF, ROLES.INVENTORY, ROLES.ADMIN_DIRECTOR];
      if (role && !validRoles.includes(role)) {
        throw new AppError('Invalid role specified.', 400);
      }

      const updateData = {};
      if (role) updateData.role = role;
      if (status) updateData.status = status;

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true
        }
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          action: 'UPDATE_STAFF_ROLE',
          entity: 'USER',
          entityId: id,
          newState: updateData,
          ipAddress: req.ip
        }
      });

      return sendSuccess(res, 200, 'Staff account updated successfully.', { user: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get company settings
   */
  static async getSettings(req, res, next) {
    try {
      let settings = await prisma.companySettings.findFirst();
      if (!settings) {
        settings = await prisma.companySettings.create({
          data: {
            companyName: 'Eventora Event Management',
            defaultCurrency: 'ETB',
            initialPaymentPercent: 50.00,
            finalPaymentPercent: 50.00,
            contactEmail: 'contact@eventora.et',
            contactPhone: '+251 911 234 567',
            officeAddress: 'Bole Road, Morning Star Mall 4th Floor, Addis Ababa'
          }
        });
      }
      return sendSuccess(res, 200, 'Settings retrieved.', { settings });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update company settings (Strictly Admin Director)
   */
  static async updateSettings(req, res, next) {
    try {
      let settings = await prisma.companySettings.findFirst();
      const updateData = req.body;

      let updated;
      if (settings) {
        updated = await prisma.companySettings.update({
          where: { id: settings.id },
          data: updateData
        });
      } else {
        updated = await prisma.companySettings.create({
          data: updateData
        });
      }

      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          action: 'UPDATE_COMPANY_SETTINGS',
          entity: 'COMPANY_SETTINGS',
          entityId: updated.id,
          newState: updateData,
          ipAddress: req.ip
        }
      });

      return sendSuccess(res, 200, 'Settings updated.', { settings: updated });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = OperationsController;
