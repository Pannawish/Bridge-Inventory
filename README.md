# Inventory Management System

Inventory Management System is a full-stack operations app for SME trading businesses that buy from suppliers, hold stock, and resell to customers. It focuses on the workflows that matter in day-to-day operations: products, quotations, purchases, sales, billing notes, payment batches, stock visibility, and margin awareness.

This repository is built for teams that need something more practical than a generic stock tracker. It combines transaction history, supplier sourcing, stock validation, finance flows, and an AI inventory assistant in one system.

If this project is useful to you, give it a star. That helps more builders and operators find it.

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

## Repository Structure

```text
frontend/   React + Vite application
backend/    Django + DRF API
AGENTS.md   Project engineering standards for contributors and coding agents
```

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

## Useful Backend Commands

Run checks:

```bash
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test inventory
```

Seed operational data:

```bash
backend/.venv/bin/python backend/manage.py seed_operational_data
```

Clear operational data while preserving master data:

```bash
backend/.venv/bin/python backend/manage.py clear_operational_data
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

Issues, fixes, and workflow improvements are welcome. High-value contributions usually fall into one of these areas:

- workflow polish for quotations, purchases, and sales
- maintainability improvements in large frontend modules
- backend tests around stock, finance, and eligibility rules
- UX improvements for dense operational tables and forms

Before opening major changes, read [AGENTS.md](AGENTS.md). It captures the current architecture constraints and project standards.

## Roadmap Direction

Current improvement direction in this repository includes:

- splitting oversized frontend files into more focused modules
- strengthening reusable transaction detail UI
- preserving behavior while improving maintainability
- continuing to tighten stock, pricing, and finance accuracy

## Audience

This project is a strong fit for:

- SME operators
- developers building ERP-lite or operations software
- contributors interested in inventory, purchasing, sales, and receivable/payable workflows
- teams that need bilingual operational software patterns
