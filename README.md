# Refrigerant Bottle Ledger (MVP)

A minimal, working system to log refrigerant transactions by bottle serial, infer/lock gas type, and compute live balances.

## Features
- Create/lookup bottles by **serial**
- Log transactions: fill, recover, charge, transfer_in/out, return
- Gas validation: first positive inflow locks bottle gas; mismatches blocked
- Prevent negative balances
- Live projected balance preview on the form
- SQLite via Prisma for quick setup

## Quick Start
1. **Install deps**
   ```bash
   npm i
   ```
2. **Generate Prisma client & run migrations**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```
3. **Seed demo data (optional)**
   ```bash
   npm run seed
   ```
4. **Run the app**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## Usage
- Try existing demo bottle: `CYL-001928`
- Choose gas `R410A`, set type `charge`, qty `2.5`, click **Log Transaction**.
- The badge shows current and projected balances; ledger updates below.

## Notes / Next Steps
- Add auth & multi-org tenancy (JWT/OIDC)
- Add QR scanning (use getUserMedia in a client component)
- Add reports and exports
- Add admin UI for gases and bottle statuses
- Switch to Postgres in `.env` when deploying
