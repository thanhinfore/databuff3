# Databuff Skeleton

This repository contains a minimal backend skeleton for the Databuff project described in the design document. The server is built with Node.js, TypeScript and Express. Prisma is used as ORM for a PostgreSQL database.

## Development

1. Install dependencies:

```bash
npm install
```

2. Configure the database connection by creating a `.env` file with a `DATABASE_URL` variable pointing to your PostgreSQL instance.

3. Generate Prisma client (requires internet access to fetch engines):

```bash
npx prisma generate
```

4. Run in development mode:

```bash
npm run dev
```

5. Build and start:

```bash
npm run build
npm start
```

The API currently exposes a health check at `/api/health`.

## Environment

Copy `.env.example` to `.env` and update the variables for your environment.

```
cp .env.example .env
```

Update `DATABASE_URL` to point to your PostgreSQL instance and set a strong `JWT_SECRET`.

## API Usage

After starting the server you can register and login:

```
curl -X POST http://localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"alice","email":"alice@example.com","password":"password123"}'

curl -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"usernameOrEmail":"alice","password":"password123"}'
```
