const { prisma } = require('../config/prisma');
const { sendSuccess, AppError } = require('../utils/response');
const { ROLES } = require('../config/roles');
const emailNotificationService = require('../services/emailNotificationService');

class ReviewController {
  /**
   * POST /api/reviews
   * Customer submits review for a completed event
   */
  static async submitReview(req, res, next) {
    try {
      const { bookingId, rating, comment } = req.body;

      if (!bookingId || !rating || !comment) {
        throw new AppError('bookingId, rating (1-5), and comment are required.', 400);
      }

      const ratingNum = parseInt(rating, 10);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        throw new AppError('Rating must be an integer between 1 and 5.', 400);
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId }
      });

      if (!booking) {
        throw new AppError('Booking not found.', 404);
      }

      if (req.user.role === ROLES.CUSTOMER && booking.customerId !== req.user.id) {
        throw new AppError('Unauthorized: You can only submit reviews for your own bookings.', 403);
      }

      if (booking.eventStatus !== 'COMPLETED' && booking.status !== 'COMPLETED') {
        throw new AppError(
          'Reviews can only be submitted after event execution has been completed.',
          400
        );
      }

      // Check if review already exists for this booking
      const existing = await prisma.review.findUnique({
        where: { bookingId }
      });

      if (existing) {
        throw new AppError('A review has already been submitted for this booking.', 409);
      }

      const review = await prisma.review.create({
        data: {
          bookingId,
          customerId: req.user.id,
          rating: ratingNum,
          comment: comment.trim(),
          isApprovedForPublic: false
        }
      });

      // Dispatch 6-Actor Category 9: Review Notifications (Review Submitted to Exec/Coord, Feedback Confirmed & Thank You to Customer)
      emailNotificationService.sendReviewSubmitted({
        review,
        customer: req.user,
        booking
      }).catch(() => {});

      return sendSuccess(res, 201, 'Thank you! Your review has been submitted.', { review });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reviews
   * Coordinators / Admin list all reviews
   */
  static async getAllReviews(req, res, next) {
    try {
      const { isApproved } = req.query;

      const where = {};
      if (isApproved !== undefined) {
        where.isApprovedForPublic = isApproved === 'true';
      }

      const reviews = await prisma.review.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          booking: { select: { id: true, reference: true, eventType: true, title: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      return sendSuccess(res, 200, 'Reviews retrieved.', {
        count: reviews.length,
        reviews
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reviews/my
   * Authenticated customer retrieves their own submitted reviews and eligible completed bookings
   */
  static async getMyReviews(req, res, next) {
    try {
      const customerId = req.user.id;
      const {
        page = 1,
        limit = 6,
        rating,
        search,
        eventType,
        sort = 'recent'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 6));
      const skip = (pageNum - 1) * limitNum;

      // Base query for customer reviews
      const where = { customerId };
      if (rating) {
        where.rating = parseInt(rating, 10);
      }
      if (search) {
        where.OR = [
          { comment: { contains: search } },
          { booking: { title: { contains: search } } },
          { booking: { reference: { contains: search } } }
        ];
      }
      if (eventType && eventType !== 'ALL') {
        where.booking = { ...where.booking, eventType };
      }

      let orderBy = { createdAt: 'desc' };
      if (sort === 'highest') orderBy = { rating: 'desc' };
      if (sort === 'lowest') orderBy = { rating: 'asc' };

      const [myReviews, totalCount] = await Promise.all([
        prisma.review.findMany({
          where,
          include: {
            booking: {
              select: {
                id: true,
                reference: true,
                title: true,
                eventType: true,
                locationName: true,
                preferredDate: true,
                assignedCoordinator: { select: { id: true, fullName: true, role: true } }
              }
            }
          },
          orderBy,
          skip,
          take: limitNum
        }),
        prisma.review.count({ where })
      ]);

      // Star breakdown counts
      const [star5, star4, star3, star2, star1] = await Promise.all([
        prisma.review.count({ where: { rating: 5 } }),
        prisma.review.count({ where: { rating: 4 } }),
        prisma.review.count({ where: { rating: 3 } }),
        prisma.review.count({ where: { rating: 2 } }),
        prisma.review.count({ where: { rating: 1 } })
      ]);

      // Completed bookings without reviews
      const completedBookings = await prisma.booking.findMany({
        where: {
          customerId,
          OR: [{ status: 'COMPLETED' }, { eventStatus: 'COMPLETED' }],
          reviews: { none: {} }
        },
        select: {
          id: true,
          reference: true,
          title: true,
          eventType: true,
          locationName: true,
          preferredDate: true,
          assignedCoordinator: { select: { id: true, fullName: true, role: true } }
        }
      });

      return sendSuccess(res, 200, 'Customer reviews retrieved.', {
        myReviews,
        eligibleBookings: completedBookings,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum) || 1
        },
        ratingDistribution: {
          5: star5,
          4: star4,
          3: star3,
          2: star2,
          1: star1
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/reviews/:id/approve
   * Admin approves review for public showcase
   */
  static async approveReview(req, res, next) {
    try {
      const { id } = req.params;
      const { isApproved = true } = req.body;

      const review = await prisma.review.update({
        where: { id },
        data: { isApprovedForPublic: Boolean(isApproved) }
      });

      return sendSuccess(res, 200, `Review public status updated to ${review.isApprovedForPublic}.`, {
        review
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ReviewController;
