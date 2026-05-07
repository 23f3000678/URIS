const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing database connection...');
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, status: true }
    });
    console.log('Connection successful. Found users:', JSON.stringify(users, null, 2));
    
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@uris.com' }
    });
    if (admin) {
      console.log('Admin user exists:', JSON.stringify(admin, null, 2));
    } else {
      console.log('Admin user NOT found.');
    }
  } catch (err) {
    console.error('Database connection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
