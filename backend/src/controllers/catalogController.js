const { prisma } = require('../config/prisma');
const { sendSuccess, AppError } = require('../utils/response');

class CatalogController {
  /**
   * GET /api/catalog/services
   * List all published services (categorized, optional filter)
   */
  static async getServices(req, res, next) {
    try {
      const { category, search } = req.query;

      const where = { isPublished: true };
      if (category) {
        where.category = category;
      }
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } }
        ];
      }

      const services = await prisma.service.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
      });

      return sendSuccess(res, 200, 'Services retrieved successfully.', {
        count: services.length,
        services
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/catalog/services/:id
   */
  static async getServiceById(req, res, next) {
    try {
      const { id } = req.params;
      const service = await prisma.service.findUnique({
        where: { id }
      });

      if (!service || !service.isPublished) {
        throw new AppError('Service not found or is not currently active.', 404);
      }

      return sendSuccess(res, 200, 'Service retrieved successfully.', { service });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/catalog/packages
   * List curated packages (Shimglina, Weddings, Corporate, etc.)
   */
  static async getPackages(req, res, next) {
    try {
      const { eventType } = req.query;

      const where = { isPublished: true };
      if (eventType) {
        where.eventType = eventType;
      }

      const packages = await prisma.package.findMany({
        where,
        include: {
          items: {
            include: {
              service: true
            }
          }
        },
        orderBy: { price: 'asc' }
      });

      return sendSuccess(res, 200, 'Packages retrieved successfully.', {
        count: packages.length,
        packages
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/catalog/packages/:id
   */
  static async getPackageById(req, res, next) {
    try {
      const { id } = req.params;
      const packageItem = await prisma.package.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              service: true
            }
          }
        }
      });

      if (!packageItem || !packageItem.isPublished) {
        throw new AppError('Package not found.', 404);
      }

      return sendSuccess(res, 200, 'Package retrieved successfully.', { package: packageItem });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/catalog/packages
   * Authorized Coordinator or Admin creates a new package with items
   */
  static async createPackage(req, res, next) {
    try {
      const {
        name,
        eventType,
        description,
        durationHours,
        guestCapacityMin,
        guestCapacityMax,
        inclusions,
        exclusions,
        price,
        currency = 'ETB',
        isPublished = true,
        images,
        items = []
      } = req.body;

      if (!name || !eventType || price === undefined) {
        throw new AppError('name, eventType, and price are required.', 400);
      }

      const createdPackage = await prisma.$transaction(async (tx) => {
        const pkg = await tx.package.create({
          data: {
            name,
            eventType,
            description: description || '',
            durationHours: durationHours ? parseInt(durationHours, 10) : null,
            guestCapacityMin: guestCapacityMin ? parseInt(guestCapacityMin, 10) : null,
            guestCapacityMax: guestCapacityMax ? parseInt(guestCapacityMax, 10) : null,
            inclusions: inclusions || null,
            exclusions: exclusions || null,
            price: Number(price),
            currency,
            isPublished: Boolean(isPublished),
            images: images || null
          }
        });

        if (Array.isArray(items) && items.length > 0) {
          for (const it of items) {
            if (it.serviceId) {
              await tx.packageItem.create({
                data: {
                  packageId: pkg.id,
                  serviceId: it.serviceId,
                  quantity: it.quantity ? parseInt(it.quantity, 10) : 1,
                  notes: it.notes || null
                }
              });
            }
          }
        }

        return tx.package.findUnique({
          where: { id: pkg.id },
          include: {
            items: { include: { service: true } }
          }
        });
      });

      return sendSuccess(res, 201, 'Package created successfully.', { package: createdPackage });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/catalog/packages/:id
   * Update existing package
   */
  static async updatePackage(req, res, next) {
    try {
      const { id } = req.params;
      const {
        name,
        eventType,
        description,
        durationHours,
        guestCapacityMin,
        guestCapacityMax,
        inclusions,
        exclusions,
        price,
        currency,
        isPublished,
        images,
        items
      } = req.body;

      const existing = await prisma.package.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Package not found.', 404);
      }

      const updated = await prisma.$transaction(async (tx) => {
        const data = {};
        if (name !== undefined) data.name = name;
        if (eventType !== undefined) data.eventType = eventType;
        if (description !== undefined) data.description = description;
        if (durationHours !== undefined) data.durationHours = durationHours ? parseInt(durationHours, 10) : null;
        if (guestCapacityMin !== undefined) data.guestCapacityMin = guestCapacityMin ? parseInt(guestCapacityMin, 10) : null;
        if (guestCapacityMax !== undefined) data.guestCapacityMax = guestCapacityMax ? parseInt(guestCapacityMax, 10) : null;
        if (inclusions !== undefined) data.inclusions = inclusions;
        if (exclusions !== undefined) data.exclusions = exclusions;
        if (price !== undefined) data.price = Number(price);
        if (currency !== undefined) data.currency = currency;
        if (isPublished !== undefined) data.isPublished = Boolean(isPublished);
        if (images !== undefined) data.images = images;

        await tx.package.update({
          where: { id },
          data
        });

        if (Array.isArray(items)) {
          await tx.packageItem.deleteMany({ where: { packageId: id } });
          for (const it of items) {
            if (it.serviceId) {
              await tx.packageItem.create({
                data: {
                  packageId: id,
                  serviceId: it.serviceId,
                  quantity: it.quantity ? parseInt(it.quantity, 10) : 1,
                  notes: it.notes || null
                }
              });
            }
          }
        }

        return tx.package.findUnique({
          where: { id },
          include: { items: { include: { service: true } } }
        });
      });

      return sendSuccess(res, 200, 'Package updated successfully.', { package: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/catalog/packages/:id
   * Soft-deactivate or delete package (Admin only)
   */
  static async deletePackage(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await prisma.package.findUnique({
        where: { id },
        include: { bookings: { select: { id: true }, take: 1 } }
      });

      if (!existing) {
        throw new AppError('Package not found.', 404);
      }

      // If existing bookings reference this package, soft-deactivate to protect integrity
      if (existing.bookings && existing.bookings.length > 0) {
        await prisma.package.update({
          where: { id },
          data: { isPublished: false }
        });
        return sendSuccess(res, 200, 'Package has active historical bookings; unpublished successfully.');
      }

      await prisma.packageItem.deleteMany({ where: { packageId: id } });
      await prisma.package.delete({ where: { id } });

      return sendSuccess(res, 200, 'Package deleted successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/catalog/gallery
   * Public gallery of past events
   */
  static async getGallery(req, res, next) {
    try {
      const { eventType, featured } = req.query;

      const where = { isPublished: true };
      if (eventType) {
        where.eventType = eventType;
      }
      if (featured === 'true') {
        where.featured = true;
      }

      const items = await prisma.eventGallery.findMany({
        where,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }]
      });

      return sendSuccess(res, 200, 'Gallery items retrieved successfully.', {
        count: items.length,
        items
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/catalog/reviews
   * Public approved customer reviews/testimonials
   */
  static async getReviews(req, res, next) {
    try {
      const reviews = await prisma.review.findMany({
        where: { isApprovedForPublic: true },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          booking: {
            select: {
              eventType: true,
              city: true
            }
          },
          customer: {
            select: {
              fullName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      // Anonymize/Format customer names (e.g., Abebe B.) for privacy
      const formatted = reviews.map((r) => {
        const parts = r.customer.fullName.split(' ');
        const displayName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          eventType: r.booking.eventType,
          city: r.booking.city,
          customerName: displayName,
          createdAt: r.createdAt
        };
      });

      return sendSuccess(res, 200, 'Public reviews retrieved successfully.', {
        count: formatted.length,
        reviews: formatted
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CatalogController;
