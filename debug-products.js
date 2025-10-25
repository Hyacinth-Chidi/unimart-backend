// debug-products.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugProducts() {
  try {
    console.log('🔍 Debugging products and users...\n');

    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        school: true,
        profileComplete: true
      }
    });

    console.log('👥 USERS:');
    users.forEach(user => {
      console.log(`  - ${user.name} (${user.email})`);
      console.log(`    School: "${user.school}"`);
      console.log(`    Profile Complete: ${user.profileComplete}`);
      console.log(`    ID: ${user.id}\n`);
    });

    // Get all products
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        school: true,
        vendorId: true,
        isAvailable: true,
        price: true
      }
    });

    console.log('📦 PRODUCTS:');
    if (products.length === 0) {
      console.log('  ❌ No products found!\n');
    } else {
      products.forEach(product => {
        console.log(`  - ${product.name}`);
        console.log(`    School: "${product.school}"`);
        console.log(`    VendorId: ${product.vendorId}`);
        console.log(`    Available: ${product.isAvailable}`);
        console.log(`    Price: ₦${product.price}\n`);
      });
    }

    // Check if vendorIds match
    console.log('🔗 CHECKING VENDOR RELATIONSHIPS:');
    const userIds = users.map(u => u.id);
    products.forEach(product => {
      const vendorExists = userIds.includes(product.vendorId);
      console.log(`  ${product.name} -> Vendor ${vendorExists ? '✅ EXISTS' : '❌ MISSING'}`);
    });

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugProducts();