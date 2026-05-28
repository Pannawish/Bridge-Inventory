# Bridge Inventory

Bridge Inventory is a full-stack inventoy management system operations app for SME trading businesses that buy from suppliers, hold stock, and resell to customers. It focuses on the workflows that matter in day-to-day operations: products, quotations, purchases, sales, billing notes, payment batches, stock visibility, and margin awareness.

This repository is built for teams that need something more practical than a generic stock tracker. It combines transaction history, supplier sourcing, stock validation, finance flows, and an AI inventory assistant in one system.

If this project is useful to you, give it a star. That helps more builders and operators find it.

## Preview The App

Want to see the UI before setting anything up locally?

Preview the frontend here: [bridge-inventory.netlify.app](https://bridge-inventory.netlify.app)

> [!NOTE]
> When the login page appears, simply click the **"Continue as Guest"** button to bypass authentication and preview the full app.

This preview is a frontend-only deployment, which makes it useful for exploring the interface, navigation, and offline/mock-data flows quickly.

For a frontend-only deploy, leave `VITE_API_BASE_URL` unset so the app stays in safe mock fallback mode instead of probing a live backend.

## Feature Snapshot

| Area | What is implemented |
| --- | --- |
| Products and stock | Product master data, categories, images, supplier options, base units, unit conversions, current stock, and on-demand transaction history. |
| Quotations | Customer quotations with supplier sourcing, base-unit quantities, stock sufficiency indicators, and conversion into sales or purchase orders. |
| Purchases | Purchase orders, receiving statuses, expected delivery dates, supplier tax invoice tracking, attachments, base quantity, and base unit cost visibility. |
| Sales | Stock-aware sales creation, delivery progress, item-level statuses, returned/cancelled flows, average unit cost guidance, and FIFO-based stock allocation with automatic or manual source selection. |
| Finance | Billing notes for customer receivables, payment batches for supplier payables, and credit notes for cancelled or returned sale items. |
| Dashboard and assistant | Backend-calculated stock metrics, demand and pipeline visibility, and an optional OpenAI-powered inventory assistant. |

## Why This Project Exists

Many inventory tools handle only one slice of the business well: stock, or purchasing, or invoicing. Real businesses need those pieces to work together.

This project is designed around a middle-man business model:

- buy from suppliers
- keep stock in base units
- quote customers before purchase or sale
- convert quotations into purchase orders or sales transactions
- monitor stock shortages and committed stock
- track billing notes, payment batches, and credit notes
- keep document history readable even after master data changes

## What The System Covers

- Product catalog with categories, unit conversions, supplier references, pictures, and stock base units
- Purchase workflow with item receiving status, expected delivery dates, supplier tax invoice tracking, and document attachments
- Sales workflow with item-level packed, shipped, delivered, cancelled, and returned statuses
- Quotation workflow with supplier options, cost references, base-unit conversions, and conversion into purchase or sale
- Billing note workflow for customer receivables
- Payment batch workflow for supplier payables
- Credit note workflow for cancelled or returned sales items
- Backend-calculated dashboard metrics and stock report
- On-demand product transaction history
- AI inventory assistant for stock, sales, purchases, and operational questions
- Bilingual UI support for English and Thai

## Highlights

- Backend-authoritative stock validation for sales
- Base-unit quantity normalization across purchases, sales, and quotations
- Product average unit cost derived from the latest received purchase history
- FIFO-based stock allocation for sales, with automatic allocation or manual purchase-layer selection
- Eligibility endpoints for billing notes, payment batches, and credit notes
- Opt-in pagination for large directories and history pages
- Lookup endpoints so forms do not need to load full datasets blindly
- Transaction snapshots preserved for audit-friendly historical records

## Stack

### Frontend

- React 18
- Vite

### Backend

- Django
- Django REST Framework
- MySQL

## Requirements

- Python 3.12 is recommended for local development.
- MySQL database using `utf8mb4` so Thai and English text are stored safely.
- Node.js and npm for the React + Vite frontend.
- Optional `OPENAI_API_KEY` if you want to use the AI inventory assistant.

## Repository Structure

```text
frontend/   React + Vite application
backend/    Django + DRF API
docs/       Extended reference docs for maintainers, trainers, and process owners
AGENTS.md   Project engineering standards for contributors and coding agents
```

## Documentation

- [HANDOUT.md](./HANDOUT.md) - end-user training manual
- [docs/business-rules-reference.md](./docs/business-rules-reference.md) - detailed business-logic reference for exact status, FIFO, and eligibility behavior
- [docs/codebase-structure.md](./docs/codebase-structure.md) - current project source tree and navigation map
- [docs/frontend-refactor-handoff.md](./docs/frontend-refactor-handoff.md) - frontend maintainability handoff notes
- [docs/login_system.md](./docs/login_system.md) - developer guide for the JWT authentication and guest mode

## Main Workflows

### Products

- Manage products, categories, units, supplier options, and images
- Track current stock and operational metrics
- View purchase and sales history on demand

### Quotations

- Build quotations with unit-aware quantities and supplier cost options
- Show stock sufficiency against actual product stock
- Convert only short-stock lines into purchase orders
- Convert quoted items into sales with recorded sourcing context

### Purchases

- Create purchase orders from scratch or from quotations
- Receive items partially or fully
- Keep base quantity and base cost visibility per line

### Sales

- Create sales with stock-aware validation
- Track item-level delivery progress
- Support cancelled and returned flows
- Show average unit cost guidance during line entry

### Finance

- Create billing notes from eligible sales
- Create payment batches from eligible purchases
- Generate credit notes from cancelled or returned sale items

## Quick Start

### 1. Backend setup

Read the full backend setup guide in [backend/README.md](backend/README.md).

Before running migrations, create the MySQL database and user described in the backend guide. The default `.env.example` expects:

```env
MYSQL_DATABASE=inventory_db
MYSQL_USER=inventory_user
MYSQL_PASSWORD=inventory_password
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
```

Typical local flow:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

### 2. Frontend setup

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Frontend default API base:

```text
http://127.0.0.1:8000/api
```

If needed, set:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

## Configuration Notes

Backend configuration starts from `backend/.env.example` and lives in `backend/.env`. Important local settings include:

- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `INVENTORY_REQUIRE_AUTH`
- `INVENTORY_DEFAULT_PAGE_SIZE`
- `INVENTORY_MAX_PAGE_SIZE`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (defaults to `gpt-5-mini`)

The AI assistant is optional. Leave `OPENAI_API_KEY` empty if you only need the core inventory workflows.

Frontend configuration can use `frontend/.env` with `VITE_API_BASE_URL` when the API is not running at the default local backend URL.

## Useful Commands

Run checks:

```bash
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test inventory
```

Run frontend verification:

```bash
cd frontend
npm run build
npm audit --audit-level=moderate
```

Seed operational data:

```bash
backend/.venv/bin/python backend/manage.py seed_operational_data
```

Clear operational data while preserving master data:

```bash
backend/.venv/bin/python backend/manage.py clear_operational_data
```

Clear all operational and master data:

```bash
backend/.venv/bin/python backend/manage.py clear_operational_data --include-master-data
```

## API Notes

Key API capabilities already implemented:

- `/api/dashboard/`
- `/api/dashboard/segment/`
- `/api/lookups/products/`
- `/api/lookups/suppliers/`
- `/api/lookups/customers/`
- `/api/eligibility/billing-note-sales/`
- `/api/eligibility/payment-batch-purchases/`
- `/api/eligibility/credit-note-sales/`

List endpoints stay unpaginated unless pagination is requested. Supported response fields for paginated endpoints include:

- `count`
- `next`
- `previous`
- `page`
- `page_size`
- `total_pages`
- `results`

## What Makes This Repo Worth Studying

- It models real operations instead of demo-only CRUD
- It keeps stock logic in the backend where it belongs
- It uses normalized quotation line items while preserving frontend compatibility
- It balances transactional history, operational dashboards, and finance workflows in one codebase
- It is practical for contributors who want to study business workflow design in Django + React

## Contributing

This repository is intended to be usable by future developers who download, clone, or fork it and continue development for their own business, internal tooling, learning, or personal use.

If you adopt this codebase as the starting point for your own program, read [AGENTS.md](AGENTS.md) before making major changes. It captures the project standards, architecture constraints, validation rules, UI expectations, pagination conventions, and current refactor direction.

Future developers should understand these project assumptions before extending it:

- the system is built for an SME trading workflow that buys from suppliers and resells to customers
- stock validation and transaction eligibility rules are enforced primarily in the backend
- the frontend is bilingual and new UI strings must be added through `t()` and `frontend/src/i18n/translations.js`
- mock-data fallbacks still exist in parts of the frontend and should not be removed casually
- historical transaction snapshot fields are intentional and should be preserved unless you are doing a deliberate data-model change

Common extension areas usually include:

- workflow polish for quotations, purchases, sales, billing notes, payment batches, and credit notes
- maintainability improvements in large frontend modules and orchestration hooks
- backend tests for stock rules, finance logic, reference handling, and eligibility validation
- UX improvements for compact operational tables, forms, and transaction detail views

When continuing development, assume the next developer may inherit your version of the project without any extra context. Keep changes scoped, preserve existing workflows unless you are intentionally redesigning them, avoid unrelated formatting churn, and update documentation when behavior, architecture expectations, or setup steps change.

Before considering a change complete, future developers should:

- run the backend checks and tests listed in this README
- run the frontend build and audit commands listed in this README
- keep frontend strings bilingual through `t()` and `frontend/src/i18n/translations.js` unless you are intentionally converting the project to a single-language app
- preserve mock-data fallbacks unless the change explicitly replaces them
- leave clear file boundaries and names when refactoring large modules

## Roadmap Direction

Current improvement direction in this repository includes:

- finishing the remaining mixed frontend components, especially `Dashboard.jsx`
- preventing large orchestration hooks from becoming the next monoliths
- strengthening reusable transaction detail and directory UI
- preserving behavior while improving maintainability
- continuing to tighten stock, pricing, reference handling, and finance accuracy

## Audience

This project is a strong fit for:

- SME operators
- developers building ERP-lite or operations software
- contributors interested in inventory, purchasing, sales, and receivable/payable workflows
- teams that need bilingual operational software patterns
