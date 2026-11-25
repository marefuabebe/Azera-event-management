const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { prisma } = require('../config/prisma');
const { ROLES, STAFF_ROLES } = require('../config/roles');
const { AppError, successResponse, createdResponse } = require('../utils/response');
const {
  startCustomerEmailVerification,
  verifyEmailToken,
  resendVerificationEmail
} = require('../services/emailVerificationService');
const logger = require('../utils/logger');

const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
};

const getCookieOptions = () => ({
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
  maxAge: config.jwtCookieExpiresDays * 24 * 60 * 60 * 1000,
  path: '/'
});

const SENSITIVE_USER_FIELDS = [
  'password',
  'emailVerificationTokenHash',
  'passwordResetTokenHash'
];

const sanitizeUser = (user) => {
  if (!user) return null;
  const sanitized = { ...user };
  SENSITIVE_USER_FIELDS.forEach((field) => {
    delete sanitized[field];
  });
  return sanitized;
};

const register = async (req, res, next) => {
  try {
    const { fullName, email, phone, password, preferences, profile } = req.body;

    if (!fullName || !email || !phone || !password) {
      throw new AppError('Full name, email, phone number, and password are required', 400);
    }

    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters long', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      throw new AppError('An account with this email address already exists', 409, null, 'EMAIL_IN_USE');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Public registration is strictly CUSTOMER role, regardless of request payload
    const newUser = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        password: hashedPassword,
        role: ROLES.CUSTOMER,
        status: 'ACTIVE',
        emailStatus: 'UNVERIFIED',
        emailVerified: false,
        preferences: preferences || {},
        profile: profile || {}
      }
    });

    try {
      await startCustomerEmailVerification(newUser);
    } catch (emailErr) {
      logger.error(`Failed to send verification email to ${normalizedEmail}: ${emailErr.message}`);
    }

    // Set secure HTTP-only cookie
    const token = generateToken(newUser.id, newUser.role);
    res.cookie('token', token, getCookieOptions());

    // Secure browser response: never expose raw JWT or verification token
    return createdResponse(
      res,
      {
        user: sanitizeUser(newUser),
        emailVerification: {
          required: true,
          status: 'UNVERIFIED'
        }
      },
      'Registration successful. Please verify your email address to unlock bookings, messages, contracts, and payments.'
    );
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password, portal } = req.body;

    if (!email || !password) {
      throw new AppError('Please provide both email and password', 400, null, 'MISSING_CREDENTIALS');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401, null, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, null, 'INVALID_CREDENTIALS');
    }

    // Portal Separation Enforcement (Rule 1 & Rule 2)
    const normalizedPortal = portal ? String(portal).toUpperCase().trim() : null;
    const referer = req.headers.referer || '';

    let isCompanyPortal = false;
    let isCustomerPortal = false;

    if (normalizedPortal === 'COMPANY') {
      isCompanyPortal = true;
    } else if (normalizedPortal === 'CUSTOMER' || normalizedPortal === 'CLIENT') {
      isCustomerPortal = true;
    } else if (referer.includes('/company')) {
      isCompanyPortal = true;
    } else {
      isCustomerPortal = true;
    }

    // Rule 4: Customers cannot sign in through the Company Portal
    if (isCompanyPortal && user.role === ROLES.CUSTOMER) {
      throw new AppError(
        'This account is registered as a customer. Please sign in through the Client Portal at /login.',
        403,
        null,
        'CUSTOMER_PORTAL_REQUIRED'
      );
    }

    // Rule 3: Employees (ADMIN_DIRECTOR, COORDINATOR, FINANCE, STAFF) cannot sign in through the Customer Portal
    if (isCustomerPortal && user.role !== ROLES.CUSTOMER) {
      throw new AppError(
        'This is a company employee account. Please sign in through the Employee Portal.',
        403,
        null,
        'EMPLOYEE_PORTAL_REQUIRED'
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError(`Your account is ${user.status.toLowerCase()}. Please contact Azera administration.`, 403, null, 'ACCOUNT_SUSPENDED');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Set secure HTTP-only cookie
    const token = generateToken(user.id, user.role);
    res.cookie('token', token, getCookieOptions());

    // Secure browser response: never expose raw JWT in JSON body
    return successResponse(res, { user: sanitizeUser(user) }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res) => {
  res.clearCookie('token', {
    ...getCookieOptions(),
    maxAge: 0
  });
  return successResponse(res, null, 'Logout successful');
};

const getMe = async (req, res, next) => {
  try {
    return successResponse(res, { user: req.user }, 'Current user profile retrieved');
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { fullName, phone, preferences, profile } = req.body;
    const updateData = {};

    if (fullName) updateData.fullName = fullName.trim();
    if (phone) updateData.phone = phone.trim();
    if (preferences) updateData.preferences = preferences;
    if (profile) updateData.profile = profile;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    return successResponse(res, { user: sanitizeUser(updatedUser) }, 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Please provide both current and new password', 400);
    }

    if (newPassword.length < 6) {
      throw new AppError('New password must be at least 6 characters long', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 400, null, 'INCORRECT_PASSWORD');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    return successResponse(res, null, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};

const createStaffUser = async (req, res, next) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    if (!STAFF_ROLES.includes(role)) {
      throw new AppError(`Role must be one of the staff roles: ${STAFF_ROLES.join(', ')}`, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const staffUser = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        password: hashedPassword,
        role,
        status: 'ACTIVE',
        emailStatus: 'VERIFIED',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    return createdResponse(res, { user: sanitizeUser(staffUser) }, `${role} account created successfully`);
  } catch (err) {
    next(err);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const where = {};

    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          emailStatus: true,
          emailVerifiedAt: true,
          lastLogin: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.user.count({ where })
    ]);

    return successResponse(res, { users }, 'Users list retrieved', 200, {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    });
  } catch (err) {
    next(err);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const rawToken = req.body?.token || req.query?.token;
    const result = await verifyEmailToken(rawToken);

    if (result.alreadyVerified) {
      return successResponse(
        res,
        { status: 'ALREADY_VERIFIED', user: sanitizeUser(result.user) },
        'This email address is already verified. You can sign in to Eventora.'
      );
    }

    return successResponse(
      res,
      { status: 'VERIFIED', user: sanitizeUser(result.user) },
      'Your email has been verified. Welcome to Eventora.'
    );
  } catch (err) {
    next(err);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const email = req.body?.email || req.user?.email;
    const result = await resendVerificationEmail({
      email,
      actorUser: req.user || null
    });

    if (result.alreadyVerified) {
      return successResponse(
        res,
        { status: 'ALREADY_VERIFIED' },
        'This email address is already verified. You can sign in to Eventora.'
      );
    }

    return successResponse(
      res,
      { status: 'SENT' },
      'If an Eventora customer account exists for this email, a new verification message has been sent.'
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  generateToken,
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  createStaffUser,
  listUsers,
  verifyEmail,
  resendVerification
};
