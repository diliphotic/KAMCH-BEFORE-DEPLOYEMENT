# Krishna Ayurvedic Medical College & Hospital (KAMCH) ERP
## Fees Management Module — Stage 3 Final Implementation & Setup Guide

### 1. System Overview
KAMCH ERP includes an institutional fee management engine featuring:
- **4-Component Accounting**:
  - `COLLEGE` (Academic tuition fees $\rightarrow$ credited to `COLLEGE_ACCOUNT`)
  - `DEVELOPMENT` (Institutional development fees $\rightarrow$ credited to `SECRETARY_DEV_ACCOUNT`)
  - `HOSTEL` (Residential accommodation fees $\rightarrow$ credited to `COLLEGE_ACCOUNT`)
  - `MESS` (Campus dining operations $\rightarrow$ credited to `COLLEGE_ACCOUNT`)
- **Strict Role Boundaries**:
  - **Super Administrator**: Full system configuration, governance, and audit operations.
  - **Principal**: Rate structures, single-component concessions, payment reversals, service terminations.
  - **Office Accounts Staff**: Single-component payment entry, bank verification, assessment initializations, and academic-year cutoff configuration.
  - **Secretary**: Strictly restricted to Development Fee collection into `SECRETARY_DEV_ACCOUNT` and viewing associated development receipts. Strictly blocked from College, Hostel, Mess, Concessions, Reversals, and Academic Settings.
  - **Faculty / Students / HODs**: Non-financial roles, zero access to Fees Management.
- **Dual Receipt Series**:
  - College Series: `KAMCH/RCP/COLLEGE/{YYYY}/{0001}`
  - Development Series: `KAMCH/RCP/DEV/{YYYY}/{0001}`
  - Print Queue Lifecycle: Pending print queue (`print_count = 0`), explicit "Mark as Printed" confirmation, and watermarked `REPRINT` display (`print_count > 0`).

---

### 2. Database Migration Information
- **Migration File**: `server/db/migrations/018_fees_single_component_architecture_v1.sql`
- **Execution Confirmation**: This migration **HAS NOT BEEN AUTOMATICALLY EXECUTED** against any production database and will **NEVER** run automatically on application startup.
- **Application Instructions**:
  When deploying to a live MySQL 8.0+ or MariaDB 10.5+ instance on XAMPP or Linux:
  ```bash
  mysql -u root -p kamch_erp < server/db/migrations/018_fees_single_component_architecture_v1.sql
  ```
  The migration script is fully idempotent with `ADD COLUMN IF NOT EXISTS`, `INSERT IGNORE`, and `CHECK (id = 1)` constraints.

---

### 3. Quickstart & Deployment Instructions

#### Prerequisites
- Node.js 18.x or 20.x
- npm 9+
- MySQL 8.0+ or MariaDB 10.5+ (Optional: set `DB_MEMORY=true` to run with built-in memory store)

#### Installation
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials and session secrets

# 3. Build and run
npm run build
npm start
```

#### Running Tests
```bash
# Stage 1 Backend Financial Rules Test (47 assertions)
npx tsx scripts/test-fees-stage1-backend.ts

# Stage 2 Ledger Verification Test (17 assertions)
npx tsx scripts/test-fees-stage2.ts

# Stage 3 Verification & Reversal Security Suite (22 assertions)
npx tsx scripts/test-fees-stage3.ts

# Stage 4 Integration Test (10 assertions)
npx tsx scripts/test-fees-stage4.ts

# Stage 5 Financial Integrity & Reports Suite (42 assertions)
npx tsx scripts/test-fees-stage5.ts
```
