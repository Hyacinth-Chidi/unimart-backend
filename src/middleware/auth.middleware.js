const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Verify JWT Token from httpOnly cookie
const authenticateToken = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.token;
  
  // Check Authorization header if no cookie token
  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    console.log('No token found in cookies or Authorization header'); // Debug
    return res.status(401).json({ 
      message: 'Access token required. Please login.' 
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
  req.user = user;
  next();
});

// Verify that user is a vendor
const requireVendor = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required' 
    });
  }

  if (!req.user.isVendor) {
    return res.status(403).json({ 
      message: 'Vendor access required' 
    });
  }

  next();
});

// Verify profile is complete
const requireCompleteProfile = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required' 
    });
  }

  if (!req.user.profileComplete) {
    return res.status(403).json({ 
      message: 'Please complete your profile first' 
    });
  }

  next();
});

module.exports = {
  authenticateToken,
  requireVendor,
  requireCompleteProfile
};