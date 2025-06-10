import dotenv from 'dotenv';
import assert from 'assert';

dotenv.config();

const { DATABASE_URL, JWT_SECRET } = process.env;

assert(DATABASE_URL, 'DATABASE_URL is required');
assert(JWT_SECRET, 'JWT_SECRET is required');

export const config = {
  databaseUrl: DATABASE_URL as string,
  jwtSecret: JWT_SECRET as string,
};
