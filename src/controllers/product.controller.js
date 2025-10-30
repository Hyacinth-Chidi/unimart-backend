const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// === SECURE IMPORT: upload middleware ===
const uploadMiddlewarePath = path.join(__dirname, '../middleware/upload.middleware.js');
let uploadMultipleImages, deleteFromCloudinary;

try {
  const middleware = require(uploadMiddlewarePath);
  uploadMultipleImages = middleware.uploadMultipleImages;
  deleteFromCloudinary = middleware.deleteFromCloudinary;
  console.log('upload middleware loaded successfully');
} catch (err) {
  console.error('Failed to load upload.middleware.js:', err.message);
  process.exit(1); // Critical error
}

// Create product
const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, images } = req.body;
    const vendorId = req.user.id;
    const school = req.user.school;

    if (!name || !description || !price || !category) {
      return res.status(400).json({ message: 'Name, description, price, and category are required' });
    }

    if (price < 0) {
      return res.status(400).json({ message: 'Price must be a positive number' });
    }

    let uploadedImages = [];
    if (images && images.length > 0) {
      try {
        uploadedImages = await uploadMultipleImages(images, `unimart/products/${vendorId}`);
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        category,
        images: uploadedImages.length > 0 ? uploadedImages : null, // ← Store {url, publicId}
        mainImage: uploadedImages[0]?.url || null,
        school,
        vendorId,
        isAvailable: true,
      },
    });

    res.status(201).json({
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      message: 'Failed to create product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get vendor's products
const getVendorProducts = async (req, res) => {
  try {
    const vendorId = req.user.id;

    const products = await prisma.product.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      message: 'Vendor products retrieved successfully',
      count: products.length,
      products,
    });
  } catch (error) {
    console.error('Get vendor products error:', error);
    res.status(500).json({ message: 'Failed to retrieve products' });
  }
};

// Get single product
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.user.id;

    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(id)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { id: true, name: true, email: true, whatsappNumber: true, school: true },
        },
      },
    });

    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.vendorId !== vendorId) return res.status(403).json({ message: 'Unauthorized' });

    res.status(200).json({
      message: 'Product retrieved successfully',
      product,
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Failed to retrieve product' });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, images: newImagesDataUrls, existingImages, isAvailable } = req.body;
    const vendorId = req.user.id;

    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(id)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const currentProduct = await prisma.product.findUnique({ where: { id } });
    if (!currentProduct) return res.status(404).json({ message: 'Product not found' });
    if (currentProduct.vendorId !== vendorId) return res.status(403).json({ message: 'Unauthorized' });

    // === PRESERVE EXISTING IMAGES WITH publicId ===
    let finalImages = [];
    if (existingImages && Array.isArray(existingImages)) {
      finalImages = existingImages
        .filter(img => img && img.url && img.publicId)
        .map(img => ({ url: img.url, publicId: img.publicId }));
    }

    // === UPLOAD NEW IMAGES ===
    if (newImagesDataUrls && Array.isArray(newImagesDataUrls)) {
      try {
        const newUploaded = await uploadMultipleImages(newImagesDataUrls, `unimart/products/${vendorId}`);
        finalImages = [...finalImages, ...newUploaded];
      } catch (uploadError) {
        console.error('New image upload error:', uploadError);
        return res.status(500).json({ message: 'Product updated but image upload failed' });
      }
    }

    finalImages = finalImages.slice(0, 3); // Max 3

    const updateData = {
      ...(name?.trim() && { name }),
      ...(description?.trim() && { description }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(category?.trim() && { category }),
      ...(isAvailable !== undefined && { isAvailable }),
      images: finalImages.length > 0 ? finalImages : null,
      mainImage: finalImages[0]?.url || null,
    };

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        vendor: {
          select: { id: true, name: true, email: true, whatsappNumber: true, school: true },
        },
      },
    });

    res.status(200).json({
      message: 'Product updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      message: 'Failed to update product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// DELETE PRODUCT + CLOUDINARY IMAGES
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.user.id;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, vendorId: true, images: true },
    });

    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.vendorId !== vendorId) return res.status(403).json({ message: 'Unauthorized' });

    // === DELETE FROM CLOUDINARY ===
    if (product.images && Array.isArray(product.images)) {
      const deletePromises = product.images.map(async (img) => {
        if (img.publicId && deleteFromCloudinary) {
          try {
            await deleteFromCloudinary(img.publicId);
            console.log(`Deleted from Cloudinary: ${img.publicId}`);
          } catch (err) {
            console.warn(`Failed to delete image: ${img.publicId}`, err.message);
          }
        }
      });
      await Promise.all(deletePromises);
    }

    // === DELETE FROM DB ===
    await prisma.product.delete({ where: { id } });

    res.status(200).json({
      message: 'Product and images deleted successfully',
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
};

// Get products by school
const getProductsBySchool = async (req, res) => {
  try {
    const { school } = req.params;
    const products = await prisma.product.findMany({
      where: { school: school.replace(/_/g, ' '), isAvailable: true },
      include: {
        vendor: { select: { id: true, name: true, email: true, whatsappNumber: true, school: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const validProducts = products.filter(p => p.vendor !== null);

    res.status(200).json({
      message: 'Products retrieved successfully',
      count: validProducts.length,
      products: validProducts,
    });
  } catch (error) {
    console.error('Get products by school error:', error);
    res.status(500).json({
      message: 'Failed to retrieve products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get products by category
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const products = await prisma.product.findMany({
      where: { category: category.replace(/_/g, ' '), isAvailable: true },
      include: { vendor: { select: { id: true, name: true, email: true, whatsappNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      message: 'Products retrieved successfully',
      count: products.length,
      products,
    });
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({ message: 'Failed to retrieve products' });
  }
};

// Get all products (public)
const getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isAvailable: true },
      include: {
        vendor: { select: { id: true, name: true, email: true, whatsappNumber: true, school: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const validProducts = products.filter(p => p.vendor !== null);

    res.status(200).json({
      message: 'All products retrieved successfully',
      count: validProducts.length,
      products: validProducts,
    });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({
      message: 'Failed to retrieve all products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  createProduct,
  getVendorProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsBySchool,
  getProductsByCategory,
  getAllProducts,
};