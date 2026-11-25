const approvalService = require('../services/approvalService');
const { sendSuccess, AppError } = require('../utils/response');
const logger = require('../utils/logger');

class ApprovalController {
  /**
   * GET /api/approvals
   */
  static async listApprovals(req, res, next) {
    try {
      const { status, type, page, limit } = req.query;
      const result = await approvalService.listApprovals({ status, type, page, limit });
      return sendSuccess(res, 200, 'Approval requests retrieved successfully', result);
    } catch (err) {
      logger.error('Error listing approvals:', err);
      next(err);
    }
  }

  /**
   * GET /api/approvals/:id
   */
  static async getApproval(req, res, next) {
    try {
      const { id } = req.params;
      const approval = await approvalService.getApprovalById(id);
      if (!approval) {
        throw new AppError('Approval request not found', 404);
      }
      return sendSuccess(res, 200, 'Approval request details retrieved', approval);
    } catch (err) {
      logger.error('Error retrieving approval:', err);
      next(err);
    }
  }

  /**
   * POST /api/approvals
   * Allowed for Coordinator and Finance Officer
   */
  static async createApproval(req, res, next) {
    try {
      const user = req.user;
      const { type, bookingId, bookingRef, description, reason, amount, supportingDocs } = req.body;

      if (!type || !description || !reason) {
        throw new AppError('Type, description, and reason are mandatory fields', 400);
      }

      const created = await approvalService.createApproval({
        type,
        bookingId: bookingId || null,
        bookingRef: bookingRef || null,
        description,
        reason,
        amount: amount ? Number(amount) : null,
        supportingDocs: Array.isArray(supportingDocs) ? supportingDocs : [],
        requestedBy: {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
          email: user.email
        }
      });

      return sendSuccess(res, 201, 'Approval request submitted successfully', created);
    } catch (err) {
      logger.error('Error submitting approval request:', err);
      next(err);
    }
  }

  /**
   * PATCH /api/approvals/:id/decision
   * Strictly Executive Administration (ADMIN_DIRECTOR)
   */
  static async decideApproval(req, res, next) {
    try {
      const { id } = req.params;
      const { decision, comment } = req.body;
      const decider = req.user;

      if (!['APPROVED', 'REJECTED', 'INFO_REQUESTED'].includes(decision)) {
        throw new AppError('Invalid decision. Must be APPROVED, REJECTED, or INFO_REQUESTED', 400);
      }

      const updated = await approvalService.decideApproval(id, {
        decision,
        comment: comment || '',
        decidedBy: {
          id: decider.id,
          fullName: decider.fullName,
          role: decider.role
        }
      });

      return sendSuccess(res, 200, `Approval request ${decision.toLowerCase()} successfully`, updated);
    } catch (err) {
      logger.error('Error deciding approval request:', err);
      next(err);
    }
  }

  /**
   * POST /api/approvals/:id/comments
   */
  static async addComment(req, res, next) {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const user = req.user;

      if (!comment || !comment.trim()) {
        throw new AppError('Comment text cannot be empty', 400);
      }

      const updated = await approvalService.addComment(id, {
        authorId: user.id,
        authorName: user.fullName,
        authorRole: user.role,
        message: comment.trim()
      });

      return sendSuccess(res, 200, 'Comment recorded successfully', updated);
    } catch (err) {
      logger.error('Error adding comment to approval:', err);
      next(err);
    }
  }
}

module.exports = ApprovalController;

