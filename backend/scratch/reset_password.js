const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const password = '123456';
  const hash = await bcrypt.hash(password, 10);
  
  await prisma.user.update({
    where: { email: 'admin@uris.com' },
    data: { password: hash }
  });
  
  console.log('Password for admin@uris.com has been reset to "123456"');
}

main().finally(() => prisma.$disconnect());
