// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed Tiers
  console.log('📊 Seeding tiers...');
  
  const bronze = await prisma.tier.upsert({
    where: { slug: 'bronze' },
    update: {},
    create: {
      slug: 'bronze',
      name: 'Bronze',
      colorHex: '#CD7F32',
      minDepositUsd: 0,
      requiredReferrals: 0,
      spinWinRate: 30,
      gameWinRate: 30,
      coinMultiplier: 1.0,
      referralPayoutCount: 7,
      eligibleForGrandPrize: false,
      sortOrder: 1,
    },
  });
  console.log(`  ✅ Created tier: ${bronze.name}`);

  const silver = await prisma.tier.upsert({
    where: { slug: 'silver' },
    update: {},
    create: {
      slug: 'silver',
      name: 'Silver',
      colorHex: '#C0C0C0',
      minDepositUsd: 5,
      requiredReferrals: 3,
      spinWinRate: 50,
      gameWinRate: 50,
      coinMultiplier: 1.5,
      referralPayoutCount: 0,
      eligibleForGrandPrize: false,
      sortOrder: 2,
    },
  });
  console.log(`  ✅ Created tier: ${silver.name}`);

  const platinum = await prisma.tier.upsert({
    where: { slug: 'platinum' },
    update: {},
    create: {
      slug: 'platinum',
      name: 'Platinum',
      colorHex: '#E5E4E2',
      minDepositUsd: 10,
      requiredReferrals: 0,
      spinWinRate: 75,
      gameWinRate: 75,
      coinMultiplier: 2.0,
      referralPayoutCount: 0,
      eligibleForGrandPrize: true,
      sortOrder: 3,
    },
  });
  console.log(`  ✅ Created tier: ${platinum.name}`);

  // Seed Admin User
  console.log('👑 Seeding admin user...');
  const adminPassword = await bcrypt.hash('admin123', 12);
  
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@starworld.com' },
    update: {},
    create: {
      username: 'superadmin',
      email: 'admin@starworld.com',
      passwordHash: adminPassword,
      role: 'admin',
    },
  });
  console.log(`  ✅ Created admin: ${admin.email} (password: admin123)`);

  // Seed Sample Celebrities
  console.log('⭐ Seeding celebrities...');
  
  const celebrities = [
    { name: 'Taylor Swift', slug: 'taylor-swift', bio: 'Grammy-winning singer-songwriter, known for storytelling and pop anthems.' },
    { name: 'Drake', slug: 'drake', bio: 'Multi-platinum recording artist, rapper, and global hip-hop icon.' },
    { name: 'Beyoncé', slug: 'beyonce', bio: 'Iconic singer, performer, and cultural force.' },
    { name: 'The Weeknd', slug: 'the-weeknd', bio: 'Award-winning R&B artist known for his unique voice and dark production.' },
    { name: 'Bad Bunny', slug: 'bad-bunny', bio: 'Latin trap and reggaeton superstar, global streaming phenomenon.' },
    { name: 'Ariana Grande', slug: 'ariana-grande', bio: 'Pop and R&B vocal powerhouse with multiple #1 hits.' },
    { name: 'Ed Sheeran', slug: 'ed-sheeran', bio: 'Singer-songwriter known for heartfelt lyrics and acoustic sound.' },
    { name: 'Billie Eilish', slug: 'billie-eilish', bio: 'Genre-bending pop star with multiple Grammys.' },
  ];

  for (const celeb of celebrities) {
    await prisma.celebrity.upsert({
      where: { slug: celeb.slug },
      update: {},
      create: {
        name: celeb.name,
        slug: celeb.slug,
        bio: celeb.bio,
        isPublished: true,
      },
    });
  }
  console.log(`  ✅ Created ${celebrities.length} celebrities`);

  // Seed some deposit addresses
  console.log('🏦 Seeding deposit addresses...');
  
  const depositAddresses = [
    { method: 'BTC', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', sortOrder: 1 },
    { method: 'ETH', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb6', sortOrder: 2 },
    { method: 'USDT_TRC20', address: 'TQYxY9aJgYxYxYxYxYxYxYxYxYxYxYxYxY', sortOrder: 3 },
    { method: 'BNB', address: 'bnb1xqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqx', sortOrder: 4 },
    { method: 'amazon', address: null, sortOrder: 5 },
    { method: 'google', address: null, sortOrder: 6 },
    { method: 'apple', address: null, sortOrder: 7 },
    { method: 'steam', address: null, sortOrder: 8 },
  ];

  for (const addr of depositAddresses) {
    await prisma.depositAddress.upsert({
      where: { id: `${addr.method}-id` },
      update: {},
      create: {
        method: addr.method,
        address: addr.address,
        isActive: true,
        sortOrder: addr.sortOrder,
      },
    });
  }
  console.log(`  ✅ Created ${depositAddresses.length} deposit addresses`);

  console.log('\n🎉 Seeding complete!');
  console.log('====================================');
  console.log('✨ Admin Login: admin@starworld.com');
  console.log('🔑 Admin Password: admin123');
  console.log('====================================');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });