// src/middleware/upload.middleware.js
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload image to Cloudinary
const uploadToCloudinary = async (base64Image, folder = 'unimart') => {
  try {
    if (!base64Image) {
      throw new Error('No image provided');
    }

    // Remove data:image/jpeg;base64, prefix if present
    const base64Data = base64Image.includes('base64,') 
      ? base64Image.split('base64,')[1] 
      : base64Image;

    const result = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${base64Data}`,
      {
        folder: folder,
        resource_type: 'auto',
        quality: 'auto',
        fetch_format: 'auto'
      }
    );

    return {
      url: result.secure_url,
      publicId: result.public_id
    };

  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Image upload failed: ' + error.message);
  }
};

// Upload multiple images
const uploadMultipleImages = async (imageArray, folder = 'unimart') => {
  try {
    if (!imageArray || imageArray.length === 0) {
      return [];
    }

    // Limit to 3 images
    const imagesToUpload = imageArray.slice(0, 3);

    const uploadPromises = imagesToUpload.map(image =>
      uploadToCloudinary(image, folder)
    );

    const results = await Promise.all(uploadPromises);
    return results;

  } catch (error) {
    console.error('Multiple upload error:', error);
    throw new Error('Multiple image upload failed: ' + error.message);
  }
};

// Delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      throw new Error('Public ID required');
    }

    await cloudinary.uploader.destroy(publicId);
    return true;

  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Image deletion failed: ' + error.message);
  }
};

module.exports = {
  uploadToCloudinary,
  uploadMultipleImages,
  deleteFromCloudinary
};