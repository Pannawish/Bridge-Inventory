# 📦 Bridge Inventory

<p align="left">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-7.3-646CFF?style=flat-square&logo=vite" alt="Vite 7.3" />
  <img src="https://img.shields.io/badge/Django-5.1-092E20?style=flat-square&logo=django&logoColor=white" alt="Django 5.1" />
  <img src="https://img.shields.io/badge/MySQL-8-00758F?style=flat-square&logo=mysql&logoColor=white" alt="MySQL 8" />
  <img src="https://img.shields.io/badge/OpenAI-GPT--5-412991?style=flat-square&logo=openai" alt="OpenAI GPT" />
  <img src="https://img.shields.io/badge/Language-EN%20%7C%20TH-714b67?style=flat-square" alt="Bilingual" />
</p>

Bridge Inventory is a full-stack, enterprise-lite inventory management system tailored for SME trading businesses. It is built specifically for **middle-man business models** that buy from suppliers, hold stock, and resell to customers. 

Instead of a generic stock tracker, this platform coordinates actual day-to-day operations: **Quotations, Purchases, Sales, Billing Notes, Payment Batches, Stock normalizations, and an AI inventory assistant**—all unified under authoritative backend calculations.

---

## 🚀 Preview The App

Want to explore the user interface without running any local databases? 

👉 **Explore the Live Demo:** [bridge-inventory.netlify.app](https://bridge-inventory.netlify.app)

> [!TIP]
> **To Preview the App:**  
> When the login page appears, simply click the secondary **"Continue as Guest"** button to instantly bypass credentials and explore the full app with pre-loaded mock datasets.

*This preview is a frontend-only deployment, perfect for exploring the interface, navigation, and offline mock-data flows.*

---

## ⚡ Feature Snapshot

| Functional Area | Implemented Operational Capabilities |
| :--- | :--- |
| **📦 Products & Stock** | Product master setups, nested categories, multi-image uploads, supplier-specific sourcing options, unit conversions, and on-demand FIFO stock history. |
| **📄 Quotations** | Customer billing quotes with unit-aware quantities, live stock-sufficiency indicators, and one-click conversion into sales orders or purchase lines. |
| **🛒 Purchases** | Detailed PO setups, partial/full receiving updates, expected arrival schedules, supplier tax invoice tracking, base quantity normalization, and cost snapshotting. |
| **💼 Sales** | Stock-aware sales validation, live delivery trackers, cancelled/returned flows, average cost references, and automatic/manual FIFO purchase layer allocation. |
| **💰 Finance (BN / PB / CN)** | Billing Notes for receivables, Payment Batches for payables, and Credit Notes for cancelled/returned goods, with server-validated transaction eligibility checks. |
| **🤖 AI Assistant** | OpenAI-powered bilingual natural language query assistant for checking low stocks, recent orders, product value, and margins. |

---

## 🧠 Why This Project Exists

Most free inventory tools handle only one slice of the business: simple ledger tracking, simple invoicing, or basic purchasing. In the real world, **these workflows must be integrated relational cycles**:

```mermaid
graph TD
    A[Supplier Catalog] -->|Purchase Order| B[FIFO Stock Layers]
    B -->|Live Sufficiency Check| C[Quotation Form]
    C -->|Sales Invoice| D[Committed Stock]
    D -->|Receivables| E[Billing Notes]
    A -->|Payables| F[Payment Batches]
    D -->|Returns/Cancellations| G[Credit Notes]
    
    style B fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#bbf,stroke:#333,stroke-width:1px
    style E fill:#bfb,stroke:#333,stroke-width:1px
    style F fill:#fbb,stroke:#333,stroke-width:1px
```

---

## 🛠️ Technology Stack

*   **Frontend**: React 18, Vite 7.3, Vanilla CSS custom design tokens (4px square system)
*   **Backend**: Django 5.1, Django REST Framework 3.15, JWT-based security (Simple JWT)
*   **Database**: MySQL (relational 3NF with audit-friendly historical snapshots)
*   **Core Concepts**: Relational master records, derived FIFO layers, opt-in backend pagination, lookup endpoints, and bilingual context dictionaries.

---

## 📂 Repository Structure

```text
├── frontend/     # React + Vite single-page application
├── backend/      # Django + DRF REST API
├── docs/         # Extended reference files for maintainers & devs
│   ├── business-rules-reference.md  # Status mappings, FIFO layer calculations
│   ├── codebase-structure.md         # Source tree navigation map
│   ├── frontend-refactor-handoff.md  # Maintainability splits and hooks details
│   └── login_system.md               # JWT & Guest Mode developer guide
└── AGENTS.md     # Engineering standards & constraints for contributors
```

---

## 📋 Documentation Reference

For deeper codebase context and engineering rules, check out the specialized guides:
*   [HANDOUT.md](./HANDOUT.md) — End-user training manual and user workflows.
*   [docs/business-rules-reference.md](./docs/business-rules-reference.md) — Master business logic for exact status, FIFO, and eligibility behaviors.
*   [docs/codebase-structure.md](./docs/codebase-structure.md) — Navigation maps for the source tree and modular splits.
*   [docs/frontend-refactor-handoff.md](./docs/frontend-refactor-handoff.md) — Frontend split structures and state hooks details.
*   [docs/login_system.md](./docs/login_system.md) — Comprehensive guide on the backend JWT configuration and frontend 401 retry interceptor.

---

## 🚀 Local Quick Start

### 1. Backend Setup

Read the comprehensive backend instructions in [backend/README.md](backend/README.md).

> [!IMPORTANT]
> Create your MySQL database and user before running migrations. The default backend `.env` expects:
> ```env
> MYSQL_DATABASE=inventory_db
> MYSQL_USER=inventory_user
> MYSQL_PASSWORD=inventory_password
> MYSQL_HOST=127.0.0.1
> MYSQL_PORT=3306
> ```

Run the setup commands in your terminal:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

### 2. Frontend Setup

In a new terminal window:
```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Once both servers are running, access the local system at [http://127.0.0.1:5173/](http://127.0.0.1:5173/).

---

## ⚙️ Key Configuration Options

Backend configurations live in `backend/.env`. Important operational switches:
*   `INVENTORY_REQUIRE_AUTH`: Set to `True` to enforce global API JWT validation (all unauthenticated calls will be rejected with `401 Unauthorized`). Defaults to `False` for easy guest development.
*   `CORS_ALLOWED_ORIGINS`: Allowed frontends (defaults to local Vite URLs).
*   `OPENAI_API_KEY` & `OPENAI_MODEL`: Optional credentials for the AI Inventory Assistant.

---

## 🔧 Useful Commands

### Running Project Verification
```bash
# Backend checks & unit tests
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test inventory

# Frontend build & audit
cd frontend && npm run build && npm audit --audit-level=moderate
```

### Data Seeding & Operations
```bash
# Seed realistic, balanced business records
backend/.venv/bin/python backend/manage.py seed_operational_data

# Clear transactions while preserving catalog master data
backend/.venv/bin/python backend/manage.py clear_operational_data

# Wipe EVERYTHING (Operational + master catalog data)
backend/.venv/bin/python backend/manage.py clear_operational_data --include-master-data
```

---

## 🤝 Contributing & Extension Rules

If you adopt this repository to learn or to construct your own custom ERP program, please read [AGENTS.md](AGENTS.md) carefully.

> [!WARNING]
> **Critical Codebase Commitments:**
> 1.  **Keep it Relational**: Use MySQL migration schemas. Prefer Relational/3NF links for master catalog variables over large ad-hoc JSON blobs.
> 2.  **Audit Snapshots**: Never remove historical snapshot variables (e.g. `supplier_name`, prices, SKUs) from transaction tables—these act as durable financial logs even if master objects are edited.
> 3.  **No Monoliths**: Preserve the split components architecture. Put business rules in named helpers or hooks rather than growing large view files.
> 4.  **Stay Bilingual (Optional for Self-Extensions)**: By default, the app supports English and Thai through the `t()` helper. If you are extending the app for your own private use or business, maintaining the bilingual dictionary is not strictly required.
