# WorkOrderOps

WorkOrderOps is a full-stack field service operations platform for managing work orders, technician dispatch, SLA risk, parts usage, inventory, and audit history.

The project models an internal operations dashboard used by field service, facilities, maintenance, and support teams. It is built around practical dispatch workflows: creating work orders, assigning technicians, tracking SLA status, recording parts usage, decrementing inventory, and maintaining an audit trail for operational changes.

## Features

### Work Order Operations

- Create new work orders with customer, site, technician, priority, and SLA details
- View work order details with customer, site, technician, status, SLA, and completion data
- Update work order status through server-side workflows
- Reassign technicians from the work order detail page
- Automatically move newly assigned work orders from `CREATED` to `ASSIGNED`

### SLA and Dispatch

- Recalculate SLA status for open work orders
- Classify work orders as `ON_TRACK`, `AT_RISK`, or `BREACHED`
- Display SLA risk on the dashboard and detail pages
- Track technician workload by active work orders

### Parts and Inventory

- Record parts used on a work order
- Decrement inventory when parts are used
- Display low-stock parts based on reorder thresholds
- Prevent invalid part usage when inventory is insufficient

### Auditability

- Record audit logs for status updates
- Record audit logs for SLA recalculation
- Record audit logs for technician reassignment
- Record audit logs for parts usage

### Engineering

- PostgreSQL and Redis with Docker Compose
- Prisma 7 schema, migrations, and generated client
- Runtime Prisma client configured with `@prisma/adapter-pg`
- Server actions for operational workflows
- TypeScript strict mode
- GitHub Actions CI for install, Prisma generate, migrations, seed, lint, and build validation

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Runtime DB Adapter | `@prisma/adapter-pg` |
| Services | Docker Compose |
| Cache or Queue Service | Redis |
| CI | GitHub Actions |
| Tooling | ESLint, npm, Prisma CLI |

## Architecture Overview

WorkOrderOps uses the Next.js App Router with server actions for backend workflows. Data is stored in PostgreSQL and accessed through Prisma 7. Docker Compose provides local PostgreSQL and Redis services.

Core domain models include:

- `User`
- `Customer`
- `Site`
- `Technician`
- `WorkOrder`
- `Part`
- `WorkOrderPart`
- `AuditLog`

Prisma 7 is configured with the datasource URL in `prisma.config.ts`. The Prisma schema intentionally does not contain the datasource URL. The generated client is output to `src/generated/prisma`, and runtime access uses `@prisma/adapter-pg`.

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/ma-dev-usa/WorkOrderOps.git
cd WorkOrderOps
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

```bash
cp .env.example .env
```

Expected local `.env` value:

```bash
DATABASE_URL="postgresql://workorderops:workorderops@localhost:5432/workorderops"
```

### 4. Start PostgreSQL and Redis

```bash
docker compose up -d
```

### 5. Confirm containers are running

```bash
docker ps
```

Expected services:

```bash
workorderops-postgres
workorderops-redis
```

### 6. Generate Prisma client

```bash
npx prisma generate
```

### 7. Apply database migrations

```bash
npx prisma migrate dev
```

### 8. Seed demo data

```bash
npx prisma db seed
```

### 9. Start the development server

```bash
npm run dev
```

Open the app:

```bash
open http://localhost:3000
```

## Validation Commands

Run these before committing changes:

```bash
npm run lint
npm run build
npx prisma migrate status
```

Expected result:

```bash
npm run lint        # passes
npm run build       # passes
prisma migrate      # database schema is up to date
```

## Useful Development Commands

### Open Prisma Studio

```bash
npx prisma studio
```

### Reset and reseed the database

```bash
npx prisma migrate reset
```

This command drops the local database, reapplies migrations, and runs the seed script.

### Stop local services

```bash
docker compose down
```

### Stop services and remove local database volume

```bash
docker compose down -v
```

Use this only when you want to fully delete the local PostgreSQL data volume.

### Check Git status

```bash
git status --short
```

### View recent commits

```bash
git log --oneline --decorate -10
```

## GitHub Actions CI

The CI workflow validates the project on push and pull request by running:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run lint
npm run build
```

The workflow also starts PostgreSQL and Redis service containers for database-backed validation.

## Project Structure

```bash
.
├── docker-compose.yml
├── prisma
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations
├── src
│   ├── app
│   │   ├── actions
│   │   ├── page.tsx
│   │   └── work-orders
│   ├── generated
│   │   └── prisma
│   └── lib
│       ├── prisma.ts
│       └── sla.ts
├── .github
│   └── workflows
│       └── ci.yml
└── README.md
```

## Main Workflows

### Dashboard

The dashboard displays live operational metrics from PostgreSQL:

- Total work orders
- Open work orders
- At-risk work orders
- SLA-breached work orders
- Recent work orders
- Low-stock parts
- Technician workload

### Work Order Creation

Dispatchers can create work orders with:

- Customer
- Site
- Optional technician assignment
- Priority
- SLA window
- Title and description

If a technician is assigned during creation, the work order starts as `ASSIGNED`. Otherwise, it starts as `CREATED`.

### SLA Recalculation

Open work orders can be recalculated against their SLA deadline. The system updates the stored SLA status and records changes in the audit log.

SLA statuses:

```bash
ON_TRACK
AT_RISK
BREACHED
```

### Technician Reassignment

Technicians can be reassigned from the work order detail page. The reassignment workflow updates the work order, refreshes dashboard technician load, and records the change in the audit log.

### Parts Usage

Parts can be attached to a work order. The system validates requested quantity, decrements inventory, creates a work order part record, and logs the event.

## Demo Data

The seed script creates sample records for:

- Users
- Customers
- Sites
- Technicians
- Parts
- Work orders
- Audit logs

Run the seed script with:

```bash
npx prisma db seed
```

## Screenshots

### Dashboard

![WorkOrderOps dashboard](docs/screenshots/dashboard.png)

### Work Order Detail

![Work order detail page](docs/screenshots/work-order-detail.png)

### Create Work Order

![Create work order page](docs/screenshots/create-work-order.png)

### Audit Log

![Audit log workflow](docs/screenshots/audit-log.png)

## Resume Bullets

- Built WorkOrderOps, a full-stack field service operations platform using Next.js, TypeScript, PostgreSQL, Prisma 7, Docker, and Tailwind, enabling dispatchers to create work orders, track SLA risk, reassign technicians, record parts usage, decrement inventory, and audit operational changes.
- Implemented database-backed workflows for SLA recalculation, technician reassignment, status updates, parts usage, and inventory management using Prisma transactions and server actions.
- Added CI validation with GitHub Actions to run dependency installation, Prisma client generation, database migrations, seed validation, linting, and production builds.

## Current Limitations

- Redis is included in the local service stack but is not yet used for background jobs or caching.
- Authentication and role-based access control are not implemented.
- Automated tests are not yet included.
- Deployment is not yet configured.

## Planned Improvements

- Dashboard filtering by status, priority, SLA status, and technician
- Search across work orders, customers, sites, and technicians
- Unit tests for SLA calculation and inventory workflows
- Playwright smoke tests for core workflows
- Background SLA checks using Redis-backed job processing
- Authentication and role-based access control
- Production deployment
