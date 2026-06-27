import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

async function updateAdmin() {
  const email = 'admin@starworld.com';
  const password = 'voldermot123'; // change to your desired password

  const hash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.update({
    where: { email },
    data: { passwordHash: hash },
  });

  console.log(`✅ Admin password updated for ${admin.email}`);
}

updateAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());