const express = require('express');
const productController = require('../controllers/product.controller');
const { authenticateToken, requireVendor, requireCompleteProfile } = require('../middleware/auth.middleware');

const router = express.Router();

// Create product (vendor only, authenticated)
router.post(
  '/create',
  authenticateToken,
  requireVendor,
  requireCompleteProfile,
  productController.createProduct
);

// Get vendor's products (vendor only, authenticated)
router.get(
  '/my-products',
  authenticateToken,
  requireVendor,
  productController.getVendorProducts
);

// Get all products (public)
router.get('/', productController.getAllProducts);

// Get products by school (public)
router.get('/school/:school', productController.getProductsBySchool);

// Get products by category (public)
router.get('/category/:category', productController.getProductsByCategory);

// Get single product (vendor only, authenticated)
router.get(
  '/:id',
  authenticateToken,
  requireVendor,
  productController.getProductById
);

// Update product (vendor only, authenticated)
router.put(
  '/:id',
  authenticateToken,
  requireVendor,
  productController.updateProduct
);

// Delete product (vendor only, authenticated)
router.delete(
  '/:id',
  authenticateToken,
  requireVendor,
  productController.deleteProduct
);

module.exports = router;