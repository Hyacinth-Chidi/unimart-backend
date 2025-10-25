const asyncHandler = require('express-async-handler');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate JWT Token
const generateToken = (userId, rememberMe = false) => {
  const expiresIn = rememberMe ? '30d' : '7d';
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
};

// Set cookie helper
const setAuthCookie = (res, token, rememberMe = false) => {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  console.log('Setting cookie with token:', token); // Debug
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge
  });
};

// Sign Up
const signUp = asyncHandler(async (req, res) => {
  const { name, email, password, isVendor = true } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ 
      message: 'Name, email, and password are required' 
    });
  }

  if (password.length < 8) {
    return res.status(400).json({ 
      message: 'Password must be at least 8 characters' 
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    return res.status(400).json({ 
      message: 'Email already registered' 
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      isVendor,
      profileComplete: false,
      school: '',
      whatsappNumber: '',
    }
  });

  const token = generateToken(user.id);
  setAuthCookie(res, token);

  res.status(201).json({
    message: 'Account created. Please complete your profile.',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isVendor: user.isVendor,
      profileComplete: user.profileComplete
    }
  });
});

// Complete Profile
const completeProfile = asyncHandler(async (req, res) => {
  const { email, school, whatsappNumber } = req.body;

  if (!email || !school || !whatsappNumber) {
    return res.status(400).json({ 
      message: 'Email, school, and WhatsApp number are required' 
    });
  }

  const whatsappRegex = /^(\+234|0)[0-9]{10}$/;
  if (!whatsappRegex.test(whatsappNumber.replace(/\s/g, ''))) {
    return res.status(400).json({ 
      message: 'Invalid WhatsApp number format' 
    });
  }

  const user = await prisma.user.update({
    where: { email },
    data: {
      school,
      whatsappNumber: whatsappNumber.replace(/\s/g, ''),
      profileComplete: true
    }
  });

  const token = generateToken(user.id);
  setAuthCookie(res, token);

  console.log('✅ Profile completed for:', user.email);

  res.status(200).json({
    message: 'Profile completed successfully',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      school: user.school,
      whatsappNumber: user.whatsappNumber,
      isVendor: user.isVendor,
      profileComplete: user.profileComplete
    }
  });
});

// Login
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      message: 'Email and password are required' 
    });
  }

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user || !user.password) {
    return res.status(401).json({ 
      message: 'Invalid email or password' 
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ 
      message: 'Invalid email or password' 
    });
  }

  if (!user.profileComplete) {
    return res.status(403).json({ 
      message: 'Please complete your profile first',
      needsProfileCompletion: true,
      email: user.email
    });
  }

  const token = generateToken(user.id, rememberMe);
  setAuthCookie(res, token, rememberMe);

  res.status(200).json({
    message: 'Login successful',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      school: user.school,
      whatsappNumber: user.whatsappNumber,
      isVendor: user.isVendor,
      profileComplete: user.profileComplete
    }
  });
});

// Logout
const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  res.status(200).json({
    message: 'Logout successful'
  });
});

// Get current user
const getCurrentUser = asyncHandler(async (req, res) => {
  console.log('Cookies received:', req.cookies); // Debug
  const token = req.cookies?.token;

  if (!token) {
    console.log('No token found in cookies'); // Debug
    return res.status(401).json({ 
      message: 'Not authenticated' 
    });
  }

  const decoded = jwt.verify(token, JWT_SECRET);
  
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      name: true,
      email: true,
      school: true,
      whatsappNumber: true,
      isVendor: true,
      profileComplete: true
    }
  });

  if (!user) {
    console.log('User not found for ID:', decoded.userId); // Debug
    return res.status(404).json({ 
      message: 'User not found' 
    });
  }

  console.log('User authenticated:', user.email); // Debug
  res.status(200).json({
    user
  });
});

// Forgot Password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ 
      message: 'Email is required' 
    });
  }

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    return res.status(200).json({ 
      message: 'If email exists, a reset code will be sent' 
    });
  }

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  try {
    await resend.emails.send({
      from: 'Unimart <noreply@yourdomain.com>',
      to: email,
      subject: 'Reset Your Password',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Here is your verification code:</p>
        <h3 style="font-size: 24px; letter-spacing: 2px; background: #f4f4f4; padding: 10px; text-align: center;">${resetCode}</h3>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `
    });

    res.status(200).json({ 
      message: 'Reset code sent to email',
      resetCode: process.env.NODE_ENV === 'development' ? resetCode : undefined
    });
  } catch (error) {
    console.error('Error sending reset email:', error);
    res.status(500).json({ 
      message: 'Failed to send reset code. Please try again later.' 
    });
  }
});

// Reset Password
const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ 
      message: 'Email, code, and new password are required' 
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ 
      message: 'Password must be at least 8 characters' 
    });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const user = await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword
    }
  });

  res.status(200).json({
    message: 'Password reset successful',
    user: {
      id: user.id,
      email: user.email
    }
  });
});

// Google Auth Callback
const googleAuthCallback = asyncHandler(async (req, res) => {
  const { googleId, name, email } = req.body;

  if (!googleId || !name || !email) {
    return res.status(400).json({ 
      message: 'Google ID, name, and email are required' 
    });
  }

  let user = await prisma.user.findUnique({
    where: { email }
  });

  if (user) {
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { email },
        data: { googleId }
      });
    }
  } else {
    user = await prisma.user.create({
      data: {
        name,
        email,
        googleId,
        school: '',
        whatsappNumber: '',
        isVendor: true,
        profileComplete: false
      }
    });
  }

  const token = generateToken(user.id);
  setAuthCookie(res, token);

  res.status(200).json({
    message: 'Google authentication successful',
    needsProfileCompletion: !user.profileComplete,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      profileComplete: user.profileComplete
    }
  });
});

module.exports = {
  signUp,
  completeProfile,
  login,
  logout,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  googleAuthCallback
};