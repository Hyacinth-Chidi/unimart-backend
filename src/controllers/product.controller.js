const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Create product
const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, images } = req.body;
    const vendorId = req.user.id;
    const school = req.user.school;

    // Validate input
    if (!name || !description || !price || !category) {
      return res.status(400).json({ 
        message: 'Name, description, price, and category are required' 
      });
    }

    if (price < 0) {
      return res.status(400).json({ 
        message: 'Price must be a positive number' 
      });
    }

    // Handle image uploads if provided
    let uploadedImages = [];
    if (images && images.length > 0) {
      try {
        const { uploadMultipleImages } = require('../middleware/upload.middleware');
        uploadedImages = await uploadMultipleImages(images, `unimart/products/${vendorId}`);
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        // Continue without images if upload fails
      }
    }

    // Create product with images
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        category,
        images: uploadedImages.length > 0 ? uploadedImages.map(img => img.url) : [], // Store URLs
        mainImage: uploadedImages.length > 0 ? uploadedImages[0].url : null,
        school,
        vendorId,
        isAvailable: true
      }
    });

    console.log('Product created:', product.id); // Debug
    res.status(201).json({
      message: 'Product created successfully',
      product
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ 
      message: 'Failed to create product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get vendor's products
const getVendorProducts = async (req, res) => {
  try {
    const vendorId = req.user.id;

    const products = await prisma.product.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' }
    });

    console.log('Vendor products fetched:', products.length); // Debug
    res.status(200).json({
      message: 'Vendor products retrieved successfully',
      count: products.length,
      products
    });

  } catch (error) {
    console.error('Get vendor products error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve products' 
    });
  }
};

// Get single product
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.user.id;

    // Validate MongoDB ObjectId format (24 hex characters)
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(id)) {
      return res.status(400).json({ 
        message: 'Invalid product ID format',
        error: 'Product ID must be a valid MongoDB ObjectId'
      });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            whatsappNumber: true,
            school: true
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ 
        message: 'Product not found' 
      });
    }

    // Check if product belongs to the authenticated vendor
    if (product.vendorId !== vendorId) {
      return res.status(403).json({ 
        message: 'Unauthorized to access this product' 
      });
    }

    console.log('Product fetched:', product.id); // Debug
    res.status(200).json({
      message: 'Product retrieved successfully',
      product
    });

  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve product' 
    });
  }
};

// Update product
// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, images: newImagesDataUrls, existingImages, isAvailable } = req.body;
    const vendorId = req.user.id;

    // Validate MongoDB ObjectId format
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(id)) {
      return res.status(400).json({ 
        message: 'Invalid product ID format',
        error: 'Product ID must be a valid MongoDB ObjectId'
      });
    }

    // Check if product exists and belongs to vendor
    const currentProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!currentProduct) {
      return res.status(404).json({ 
        message: 'Product not found' 
      });
    }

    if (currentProduct.vendorId !== vendorId) {
      return res.status(403).json({ 
        message: 'You can only update your own products' 
      });
    }

    console.log('Current product images:', currentProduct.images?.length || 0);
    console.log('Received existingImages:', existingImages?.length || 0);
    console.log('Received newImagesDataUrls:', newImagesDataUrls?.length || 0);

    // Step 1: Build final images array starting with existing images from frontend
    let finalImages = []; // Will store URLs as strings to match your schema

    // Use existingImages from frontend (filtered valid ones)
    if (existingImages && Array.isArray(existingImages) && existingImages.length > 0) {
      // Filter valid existing images and extract URLs
      finalImages = existingImages
        .filter(img => img && typeof img === 'object' && img.url && typeof img.url === 'string')
        .map(img => img.url);
      console.log('Valid existing image URLs:', finalImages.length);
    } else {
      // Fallback to current product images if no existingImages sent
      if (currentProduct.images && Array.isArray(currentProduct.images)) {
        finalImages = currentProduct.images.filter(url => url && typeof url === 'string');
      }
    }

    // Step 2: Handle new image uploads
    let newUploadedImages = [];
    if (newImagesDataUrls && Array.isArray(newImagesDataUrls) && newImagesDataUrls.length > 0) {
      try {
        const { uploadMultipleImages } = require('../middleware/upload.middleware');
        // uploadMultipleImages expects Data URLs or file buffers - pass as-is
        newUploadedImages = await uploadMultipleImages(newImagesDataUrls, `unimart/products/${vendorId}`);
        
        if (newUploadedImages && Array.isArray(newUploadedImages)) {
          // Extract URLs from uploaded images (assuming uploadMultipleImages returns [{url, publicId}])
          const newImageUrls = newUploadedImages
            .filter(img => img && img.url && typeof img.url === 'string')
            .map(img => img.url);
          
          // Append new images to existing
          finalImages = [...finalImages, ...newImageUrls];
          console.log('New uploaded image URLs:', newImageUrls.length);
        }
      } catch (uploadError) {
        console.error('New image upload error:', uploadError);
        // Don't fail entire update if image upload fails - log and continue
        return res.status(500).json({ 
          message: 'Product updated but image upload failed',
          error: 'Some images could not be uploaded'
        });
      }
    }

    // Step 3: Limit to maximum 3 images
    finalImages = finalImages.slice(0, 3);
    console.log('Final images count:', finalImages.length);

    // Step 4: Prepare update data
    const updateData = {
      ...(name && name.trim() && { name }),
      ...(description && description.trim() && { description }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(category && category.trim() && { category }),
      ...(isAvailable !== undefined && { isAvailable }),
      images: finalImages.length > 0 ? finalImages : [], // String array of URLs
      mainImage: finalImages.length > 0 ? finalImages[0] : null,
    };

    console.log('Update data images:', updateData.images.length);

    // Step 5: Update product in database
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            whatsappNumber: true,
            school: true
          }
        }
      }
    });

    console.log('Product updated successfully:', updatedProduct.id);
    console.log('Updated product images:', updatedProduct.images?.length || 0);

    res.status(200).json({
      message: 'Product updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ 
      message: 'Failed to update product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.user.id;

    // Validate MongoDB ObjectId format
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(id)) {
      return res.status(400).json({ 
        message: 'Invalid product ID format',
        error: 'Product ID must be a valid MongoDB ObjectId'
      });
    }

    // Check if product exists and belongs to vendor
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({ 
        message: 'Product not found' 
      });
    }

    if (product.vendorId !== vendorId) {
      return res.status(403).json({ 
        message: 'You can only delete your own products' 
      });
    }

    // Delete product
    await prisma.product.delete({
      where: { id }
    });

    console.log('Product deleted:', id); // Debug
    res.status(200).json({
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ 
      message: 'Failed to delete product' 
    });
  }
};

// Get products by school
const getProductsBySchool = async (req, res) => {
  try {
    const { school } = req.params;

    const products = await prisma.product.findMany({
      where: {
        school: school.replace(/_/g, ' '),
        isAvailable: true
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            whatsappNumber: true,
            school: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter out products with null vendors (deleted users)
    const validProducts = products.filter(product => product.vendor !== null);

    res.status(200).json({
      message: 'Products retrieved successfully',
      count: validProducts.length,
      products: validProducts
    });

  } catch (error) {
    console.error('Get products by school error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get products by category
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const products = await prisma.product.findMany({
      where: {
        category: category.replace(/_/g, ' '),
        isAvailable: true
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            whatsappNumber: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      message: 'Products retrieved successfully',
      count: products.length,
      products
    });

  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve products' 
    });
  }
};

// Get all products (public)
const getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isAvailable: true },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            whatsappNumber: true,
            school: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const validProducts = products.filter(p => p.vendor !== null);

    res.status(200).json({
      message: 'All products retrieved successfully',
      count: validProducts.length,
      products: validProducts
    });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({
      message: 'Failed to retrieve all products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
  getAllProducts
};