import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

async function ensureAdmin() {
  const email = 'admin@starworld.com';
  const password = 'voldermot123'; // <-- change to your desired password

  const hash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash: hash },
    create: {
      email,
      username: 'superadmin',
      passwordHash: hash,
      role: 'admin',
    },
  });

  console.log(`✅ Admin user ready: ${admin.email}`);
}

ensureAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());