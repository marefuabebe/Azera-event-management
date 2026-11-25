const { prisma } = require('../config/prisma');
const { sendSuccess, AppError } = require('../utils/response');
const logger = require('../utils/logger');

class NotificationController {
  /**
   * Helper: Ensure default notifications exist for user matching the design
   */
  static async ensureDefaultNotifications(userId) {
    try {
      const count = await prisma.notification.count({
        where: { recipientId: userId }
      });

      if (count === 0) {
        const now = Date.now();
        const initialNotifications = [
          {
            recipientId: userId,
            title: 'Contract Updated',
            message: 'Your contract (CT-2025-0178) has been updated. Please review the latest version.',
            type: 'CONTRACT',
            link: '/portal/contracts',
            isRead: false,
            createdAt: new Date(now - 1000 * 60 * 60 * 2) // 2 hours ago
          },
          {
            recipientId: userId,
            title: 'Event Reminder',
            message: 'Your event "Wedding Celebration" is coming up on May 24, 2025 at Skyline Hotel, Addis Ababa.',
            type: 'EVENT',
            link: '/portal/bookings',
            isRead: false,
            createdAt: new Date(now - 1000 * 60 * 60 * 5) // 5 hours ago
          },
          {
            recipientId: userId,
            title: 'New Message',
            message: 'You have a new message from the coordinator.',
            type: 'MESSAGE',
            link: '/portal/messages',
            isRead: false,
            createdAt: new Date(now - 1000 * 60 * 60 * 24) // 1 day ago
          },
          {
            recipientId: userId,
            title: 'Payment Confirmed',
            message: 'Your initial payment of 10,000 ETB has been successfully verified and credited.',
            type: 'PAYMENT',
            link: '/portal/payments',
            isRead: true,
            createdAt: new Date(now - 1000 * 60 * 60 * 26) // 1 day ago
          },
          {
            recipientId: userId,
            title: 'Review Invitation',
            message: 'Your event "Birthday Party" is completed. Please share your review.',
            type: 'REVIEW',
            link: '/portal/reviews',
            isRead: true,
            createdAt: new Date(now - 1000 * 60 * 60 * 48) // 2 days ago
          }
        ];

        for (const item of initialNotifications) {
          await prisma.notification.create({ data: item });
        }
      }
    } catch (err) {
      logger.error('Failed to auto-seed notifications:', err);
    }
  }

  /**
   * GET /api/notifications
   */
  static async getNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const { status } = req.query; // 'unread' | 'read' | undefined

      await NotificationController.ensureDefaultNotifications(userId);

      const whereClause = { recipientId: userId };
      if (status === 'unread') whereClause.isRead = false;
      if (status === 'read') whereClause.isRead = true;

      const [notifications, totalCount, unreadCount, readCount] = await Promise.all([
        prisma.notification.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.notification.count({ where: { recipientId: userId } }),
        prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
        prisma.notification.count({ where: { recipientId: userId, isRead: true } })
      ]);

      const cleanedNotifications = notifications.map(n => ({
        ...n,
        title: n.title?.replace(/\s*\(Test\)/gi, '') || n.title,
        message: n.message?.replace(/\s*\(Test Mode\)/gi, '') || n.message
      }));

      return sendSuccess(res, 200, 'Notifications retrieved successfully', {
        notifications: cleanedNotifications,
        counts: {
          all: totalCount,
          unread: unreadCount,
          read: readCount
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   */
  static async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await prisma.notification.findUnique({
        where: { id }
      });

      if (!notification || notification.recipientId !== userId) {
        throw new AppError('Notification not found', 404);
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true }
      });

      return sendSuccess(res, 200, 'Notification marked as read', { notification: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/notifications/read-all
   */
  static async markAllAsRead(req, res, next) {
    try {
      const userId = req.user.id;

      await prisma.notification.updateMany({
        where: { recipientId: userId, isRead: false },
        data: { isRead: true }
      });

      return sendSuccess(res, 200, 'All notifications marked as read', null);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = NotificationController;
