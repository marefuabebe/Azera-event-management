const ChapaService = require('../services/chapaService');
const { sendSuccess, AppError } = require('../utils/response');
const { ROLES } = require('../config/roles');

class PaymentController {
  /**
   * GET /api/payments/context/:bookingId
   * Retrieves full payment context: contract amounts, verified payments, remaining balance,
   * amount due now, and Chapa test mode status.
   */
  static async getPaymentContext(req, res, next) {
    try {
      const { bookingId } = req.params;
      const customerId = req.user.role === ROLES.CUSTOMER ? req.user.id : null;

      const context = await ChapaService.getPaymentContext({
        bookingId,
        customerId
      });

      return sendSuccess(res, 200, 'Payment context retrieved successfully.', context);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/payments/chapa/initialize
   * Initiates a Chapa TEST MODE checkout session.
   * Strictly computes amount on server and returns the hosted checkout URL.
   */
  static async initializeChapaPayment(req, res, next) {
    try {
      const { bookingId, paymentType = 'INITIAL_50_PERCENT' } = req.body;

      if (!bookingId) {
        throw new AppError('bookingId is required to initialize payment.', 400);
      }

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

      const result = await ChapaService.initializeTestPayment({
        bookingId,
        customerId: req.user.id,
        paymentType,
        ipAddress: typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : clientIp
      });

      return sendSuccess(res, 201, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/payments/chapa/verify/:txRef
   * Verifies the Chapa test payment with Chapa's servers.
   * Enforces exact data matching, updates status to VERIFIED (environment: TEST),
   * and issues a test receipt.
   */
  static async verifyChapaPayment(req, res, next) {
    try {
      const { txRef } = req.params;

      if (!txRef) {
        throw new AppError('Transaction reference (txRef) is required.', 400);
      }

      const customerId = req.user.role === ROLES.CUSTOMER ? req.user.id : null;

      const result = await ChapaService.verifyTestTransaction({
        txRef,
        customerId
      });

      return sendSuccess(res, 200, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/payments/chapa/webhook
   * Public webhook endpoint from Chapa.
   * Validates HMAC SHA256 signature against CHAPA_WEBHOOK_SECRET,
   * performs idempotent processing, and records event audit trail.
   */
  static async handleChapaWebhook(req, res, next) {
    try {
      const signature =
        req.headers['x-chapa-signature'] ||
        req.headers['chapa-signature'] ||
        req.headers['x-chapa-webhook-signature'];

      const result = await ChapaService.handleWebhook({
        rawBody: req.rawBody,
        signature,
        payload: req.body
      });

      return res.status(200).json(result);
    } catch (err) {
      // In webhooks, return appropriate HTTP status
      if (err.statusCode === 401) {
        return res.status(401).json({ error: 'Invalid webhook signature', message: err.message });
      }
      return res.status(err.statusCode || 500).json({ error: err.message });
    }
  }
}

module.exports = PaymentController;
