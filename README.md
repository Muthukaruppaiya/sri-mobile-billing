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
# API
cd server
npm install
npx prisma db push
npm run seed
npm run dev

# UI (new terminal, repo root)
npm install
npm run dev
```

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
