# Databuff Skeleton

This repository contains a minimal backend skeleton for the Databuff project described in the design document. The server is built with Node.js, TypeScript and Express. Prisma is used as the ORM for a SQL Server 2012 database.

## Development

1. Install dependencies:

```bash
npm install
```

2. Configure the database connection by creating a `.env` file with a `DATABASE_URL` variable pointing to your SQL Server instance.

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

Update `DATABASE_URL` to point to your SQL Server instance and set a strong `JWT_SECRET`.

## Windows Quick Start

These steps assume you have **Node.js 18+** installed on Windows.

1. Open **Command Prompt** or **PowerShell** and clone the repository.
2. Inside the project folder run:

   ```cmd
   npm install
   cp .env.example .env
   npx prisma generate
   npm run build
   npm start
   ```

3. Adjust `DATABASE_URL` in `.env` to your SQL Server connection string. The server
   will start on port 3000 and can be accessed at `http://localhost:3000`.

## API Usage

After starting the server you can register and login:

```
curl -X POST http://localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"alice","email":"alice@example.com","password":"password123"}'

curl -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"usernameOrEmail":"alice","password":"password123"}'
```
