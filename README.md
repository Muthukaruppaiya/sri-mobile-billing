# SRI MOBILES — Billing Software

Phase 1: **Auth + PostgreSQL + Purchase** (new mobile / spares / used phone) with live stock.

## Stack

- React + TypeScript (Vite)
- Node.js (Express) + Prisma
- PostgreSQL (local or Docker)

## Demo logins

| User | Password | Role |
|------|----------|------|
| `admin` | `admin123` | Admin |
| `counter1` | `emp123` | Employee |
| `counter2` | `emp123` | Employee |

## Setup (Windows — local Postgres 16)

Database was created as:

- DB: `sri_mobiles`
- User: `sri` / `sri123`

If needed:

```sql
CREATE ROLE sri LOGIN PASSWORD 'sri123' CREATEDB;
CREATE DATABASE sri_mobiles OWNER sri;
```

Or with Docker (if installed):

```bash
docker compose up -d
```

## Run

```bash
# repo root — installs UI + server deps (and generates Prisma client)
npm install

# first time only: create tables + seed logins
cd server
copy .env.example .env
npx prisma db push
npm run seed
cd ..

# starts API + UI together
npm run dev
```

`npm run dev:api` / `npm run dev:web` start either one alone.

- Frontend: http://localhost:5173  
- API: http://localhost:4000/api/health  

Vite proxies `/api` → `http://localhost:4000`.

## Phase 1 features

- Login (admin / employee)
- Purchase: New mobile, Spares, Used phone (bulk IMEI, tax, discount, credit)
- Stock (products + phone units)
- Suppliers
- Employees (admin)
- Reports: stock value + today’s purchase summary

## Next phases

- **Phase 2:** Sale (new/used, exchange, finance)
- **Phase 3:** Service (self spares / labour / subcontract)
- **Reports:** P&L, ageing, daily expenses
