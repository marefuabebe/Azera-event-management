const { prisma } = require('../config/prisma');
const { sendSuccess, AppError } = require('../utils/response');
const { ROLES } = require('../config/roles');
const logger = require('../utils/logger');

class MessageController {
  /**
   * Helper: Ensure empty planning channel conversations exist for customer bookings
   * without injecting any fake or hardcoded demo messages.
   */
  static async ensureConversationsForCustomer(customerId) {
    try {
      const customerBookings = await prisma.booking.findMany({
        where: { customerId },
        include: {
          conversations: true
        }
      });

      for (const booking of customerBookings) {
        if (!booking.conversations || booking.conversations.length === 0) {
          await prisma.conversation.create({
            data: {
              bookingId: booking.id,
              title: `${booking.title || 'Event'} - Direct Planning Channel`
            }
          });
        }
      }
    } catch (err) {
      logger.error('Failed to ensure customer conversation channels:', err);
    }
  }

  /**
   * GET /api/messages/conversations
   * Fetch all conversations for the authenticated user
   */
  static async getConversations(req, res, next) {
    try {
      const user = req.user;

      if (user.role === ROLES.CUSTOMER) {
        await MessageController.ensureConversationsForCustomer(user.id);
      }

      // Query conversations based on authenticated role
      const whereClause = user.role === ROLES.CUSTOMER
        ? { booking: { customerId: user.id } }
        : (user.role === ROLES.COORDINATOR
          ? { booking: { assignedCoordinatorId: user.id } }
          : (user.role === ROLES.STAFF
            ? {
                booking: {
                  OR: [
                    { staffAssignments: { some: { staffId: user.id } } },
                    { staffTasks: { some: { assignedStaffId: user.id } } }
                  ]
                }
              }
            : {})); // Director/Admin can see all

      const conversations = await prisma.conversation.findMany({
        where: whereClause,
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              title: true,
              eventType: true,
              preferredDate: true,
              locationName: true,
              status: true,
              eventStatus: true,
              customer: {
                select: { id: true, fullName: true, email: true, phone: true }
              },
              assignedCoordinator: {
                select: { id: true, fullName: true, email: true, phone: true, role: true }
              }
            }
          },
          messages: {
            where: user.role === ROLES.CUSTOMER ? { isInternalOnly: false } : {},
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: { id: true, fullName: true, email: true, role: true }
              }
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      // Augment each conversation with unreadCount
      const augmented = await Promise.all(
        conversations.map(async (conv) => {
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              senderId: { not: user.id },
              isRead: false,
              ...(user.role === ROLES.CUSTOMER ? { isInternalOnly: false } : {})
            }
          });

          return {
            ...conv,
            unreadCount,
            lastMessage: conv.messages[0] || null
          };
        })
      );

      return sendSuccess(res, augmented, 'Conversations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/messages/conversations/:id
   * Fetch full message history for a conversation
   */
  static async getConversationById(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          booking: {
            include: {
              customer: { select: { id: true, fullName: true, email: true, phone: true } },
              assignedCoordinator: { select: { id: true, fullName: true, email: true, phone: true, role: true } }
            }
          }
        }
      });

      if (!conversation) {
        throw new AppError('Conversation thread not found', 404);
      }

      // Authorization check
      if (user.role === ROLES.CUSTOMER && conversation.booking.customerId !== user.id) {
        throw new AppError('You are not authorized to access this conversation', 403);
      }

      const messages = await prisma.message.findMany({
        where: {
          conversationId: id,
          ...(user.role === ROLES.CUSTOMER ? { isInternalOnly: false } : {})
        },
        include: {
          sender: {
            select: { id: true, fullName: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      // Mark unread incoming messages as read
      await prisma.message.updateMany({
        where: {
          conversationId: id,
          senderId: { not: user.id },
          isRead: false
        },
        data: { isRead: true }
      });

      return sendSuccess(res, 200, 'Conversation loaded successfully', { conversation, messages });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/messages/conversations/:id/messages
   * Send a new message to a conversation
   */
  static async sendMessage(req, res, next) {
    try {
      const { id } = req.params;
      const { content, attachments } = req.body;
      const user = req.user;

      if (!content || !content.trim()) {
        throw new AppError('Message text is required', 400);
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          booking: true
        }
      });

      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }

      // Authorization check
      if (user.role === ROLES.CUSTOMER && conversation.booking.customerId !== user.id) {
        throw new AppError('You are not authorized to post in this conversation', 403);
      }

      const message = await prisma.message.create({
        data: {
          conversationId: id,
          senderId: user.id,
          content: content.trim(),
          attachments: attachments || null,
          isInternalOnly: false,
          isRead: false
        },
        include: {
          sender: {
            select: { id: true, fullName: true, email: true, role: true }
          }
        }
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id },
        data: { updatedAt: new Date() }
      });

      return sendSuccess(res, message, 'Message sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/messages/conversations
   * Start a new conversation for a booking
   */
  static async startConversation(req, res, next) {
    try {
      const { bookingId, title, initialMessage } = req.body;
      const user = req.user;

      if (!bookingId) {
        throw new AppError('bookingId is required to start a conversation', 400);
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId }
      });

      if (!booking) {
        throw new AppError('Booking not found', 404);
      }

      if (user.role === ROLES.CUSTOMER && booking.customerId !== user.id) {
        throw new AppError('You can only start conversations for your own bookings', 403);
      }

      let conversation = await prisma.conversation.findFirst({
        where: { bookingId }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            bookingId,
            title: title || `${booking.title || 'Event'} Direct Channel`
          }
        });
      }

      if (initialMessage && initialMessage.trim()) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: user.id,
            content: initialMessage.trim()
          }
        });
      }

      return sendSuccess(res, conversation, 'Conversation thread initialized', 201);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MessageController;
