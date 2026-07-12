# Ajo App

Built for the Nomba Hackathon 2026 🚀

A full-stack digital Ajo (savings contribution) platform that allows users to create savings groups, contribute funds, track transactions, and manage their wallets securely.

This repository is a monorepo containing both the frontend client and backend API.

## 0. User Flow Video recording

link: https://youtu.be/TKKkUZBGxls?si=bgwSOkAcPeZR-6TM

---

## Features

- User authentication and authorization
- Create and manage Ajo savings groups
- Track contributions and withdrawals
- Wallet and transaction management
- Secure API communication
- Database management with Prisma ORM
- Payment integration support
- Webhook handling

## Tech Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS

### Backend
- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL

### Infrastructure
- Neon PostgreSQL
- REST API
- Webhooks

## Project Structure

```
ajo-app/
│
├── ajo-client/     # Frontend application
│
├── ajo-server/     # Backend API
│
└── README.md
```

## Getting Started

### Clone the repository

```bash
git clone <repository-url>

cd ajo-app
```

---

## Frontend Setup

Navigate to the frontend folder:

```bash
cd ajo-client
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Frontend runs on:

```
http://localhost:3000
```

---

## Backend Setup

Navigate to the backend folder:

```bash
cd ajo-server
```

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

Run database migrations:

```bash
npx prisma migrate dev
```

Start the backend:

```bash
npm run start:dev
```

---

## Environment Variables

Backend environment variables:

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL database connection string |
| DIRECT_URL | Direct database connection for Prisma migrations |
| JWT_SECRET | Secret key for authentication |
| Payment keys | Payment provider credentials |

---

## Development

Run the frontend:

```bash
cd ajo-client
npm run dev
```

Run the backend:

```bash
cd ajo-server
npm run start:dev
```

---

## Database

This project uses Prisma ORM.

Useful Prisma commands:

Generate Prisma client:

```bash
npx prisma generate
```

Create migration:

```bash
npx prisma migrate dev
```

Open Prisma Studio:

```bash
npx prisma studio
```