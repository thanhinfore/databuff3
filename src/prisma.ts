let PrismaClient: typeof import('@prisma/client').PrismaClient;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  PrismaClient = require('@prisma/client').PrismaClient;
} catch (err) {
  console.error('Prisma client not generated. Run "npx prisma generate" first.');
  process.exit(1);
}

export const prisma = new PrismaClient();
