# Bridge Inventory Backend

Django + Django REST Framework backend for Bridge Inventory.

This backend supports a middle-man SME workflow: products, categories, suppliers, customers, quotations, purchases, sales, billing notes, payment batches, credit notes, dashboard summaries, and an AI inventory assistant.

## Stack

- Python + Django
- Django REST Framework
- MySQL
- `django-cors-headers`
- Optional OpenAI-powered chat answer generation with local fallback

## Current Domain Model

Master data:

- `Category`
- `Product`
- `Supplier`
- `Customer`

Transactions and finance:

- `Quotation` with normalized `QuotationItem` and `QuotationItemSupplier`
- `Purchase` with `PurchaseItem` and `PurchaseDocument`
- `Sale` with `SaleItem` and `SaleDocument`
- `BillingNote` with lines linked to eligible sales
- `PaymentBatch` with lines linked to eligible purchases
- `CreditNote` with lines linked to cancelled sale items

Important data rules:

- Products do not store mutable stock as a source of truth. Available stock is derived from received purchase items minus stock-deducted sale items.
- Historical transaction snapshots such as `supplier_name`, `customer_name`, `product_name`, `sku`, prices, and totals are intentionally preserved on transaction rows.
- Quotation lines are stored in `QuotationItem`. The quotation API still exposes an `items` array for frontend compatibility, but that array is serialized from normalized quotation line tables.

## Project Layout

```text
backend/
├── config/                     Django project settings and URL config
├── inventory/                  App models, serializers, views, services, tests
├── inventory/management/commands/
│   ├── seed_operational_data.py
│   └── clear_operational_data.py
├── media/                      Uploaded transaction and product files in local dev
├── manage.py
├── requirements.txt
└── README.md
```

## Environment Variables

Copy the example file first:

```bash
cd backend
cp .env.example .env
```

Current `.env.example` variables:

```env
DJANGO_SECRET_KEY=change-this-development-secret
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
DJANGO_TIME_ZONE=Asia/Bangkok
INVENTORY_REQUIRE_AUTH=False
INVENTORY_DEFAULT_PAGE_SIZE=25
INVENTORY_MAX_PAGE_SIZE=100

MYSQL_DATABASE=inventory_db
MYSQL_USER=inventory_user
MYSQL_PASSWORD=inventory_password
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306

CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
```

Notes:

- `INVENTORY_REQUIRE_AUTH=False` keeps the API open in local development.
- When `INVENTORY_REQUIRE_AUTH=True`, DRF switches to `IsAuthenticated`.
- If `OPENAI_API_KEY` is empty, `/api/chat/` still works using a local summary fallback instead of calling OpenAI.
- `INVENTORY_DEFAULT_PAGE_SIZE` and `INVENTORY_MAX_PAGE_SIZE` control opt-in pagination limits.

## MySQL Setup

Use `utf8mb4` so Thai and English text both store correctly.

```sql
CREATE DATABASE inventory_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE USER 'inventory_user'@'localhost' IDENTIFIED BY 'inventory_password';
GRANT ALL PRIVILEGES ON inventory_db.* TO 'inventory_user'@'localhost';
GRANT ALL PRIVILEGES ON test_inventory_db.* TO 'inventory_user'@'localhost';
FLUSH PRIVILEGES;
```

If you use different credentials, update `.env`.

## Local Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
```

Run the API:

```bash
python manage.py runserver 127.0.0.1:8000
```

Admin and API URLs:

- Admin: `http://127.0.0.1:8000/admin/`
- API root: `http://127.0.0.1:8000/api/`

## Seed And Reset Commands

Seed realistic operational data:

```bash
python manage.py seed_operational_data
```

Useful options:

```bash
python manage.py seed_operational_data --skip-documents
python manage.py seed_operational_data --keep-previous-demo
```

Clear operational data while keeping master data:

```bash
python manage.py clear_operational_data
```

Clear everything including master data:

```bash
python manage.py clear_operational_data --include-master-data
```

Preview what would be removed:

```bash
python manage.py clear_operational_data --dry-run
```

`clear_operational_data` deletes operational transactions and linked documents by default while keeping categories, products, suppliers, customers, migrations, and other master data intact. Add `--include-master-data` for a full data reset that also removes master records and linked product pictures.

## Testing And Verification

Core checks used in this repository:

```bash
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test inventory
```

If you are already inside `backend/` with the virtualenv active:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test inventory
```

## API Overview

Resource endpoints:

- `/api/categories/`
- `/api/suppliers/`
- `/api/product-suppliers/`
- `/api/customers/`
- `/api/products/`
- `/api/purchases/`
- `/api/sales/`
- `/api/quotations/`
- `/api/billing-notes/`
- `/api/payment-batches/`
- `/api/credit-notes/`

Utility endpoints:

- `/api/dashboard/`
- `/api/dashboard/segment/`
- `/api/lookups/products/`
- `/api/lookups/suppliers/`
- `/api/lookups/customers/`
- `/api/products/<product_id>/history/`
- `/api/products/<product_id>/stock-layers/`
- `/api/eligibility/billing-note-sales/`
- `/api/eligibility/payment-batch-purchases/`
- `/api/eligibility/credit-note-sales/`
- `/api/chat/`

Authentication endpoints:

- `/api/auth/login/` (Simple JWT login, returns access/refresh token pair)
- `/api/auth/refresh/` (Simple JWT token refresh, returns new access token)
- `/api/auth/me/` (User profile details endpoint)

## Pagination

Pagination is opt-in. If a request does not ask for paging, list endpoints return arrays.

Accepted pagination params:

- `page`
- `page_size`
- `pageSize`
- `limit`

Example:

```text
/api/products/?page=1&page_size=25
```

Paginated responses use:

- `count`
- `next`
- `previous`
- `page`
- `page_size`
- `total_pages`
- `results`

Page size is capped by `INVENTORY_MAX_PAGE_SIZE`.

## Common Filters

Supported broadly across paginated transaction endpoints:

- `search` or `q`
- `status` or `statuses`
- `date_from` or `from`
- `date_to` or `to`
- `amount_min`
- `amount_max`
- `vat_mode`

Partner filters:

- Purchases and payment batches: `supplier`
- Sales, billing notes, and credit notes: `customer`

Product-specific filters:

- `category`
- `stock_filter=in-stock`
- `stock_filter=out-of-stock`
- `stock_filter=low-stock`
- `stock_filter=selling`
- `stock_filter=no-sales`
- `stock_filter=no-purchases`

Supplier and customer profile filters:

- `profile_filter=missing-tax-id`
- `profile_filter=has-email`
- `profile_filter=has-phone`
- `profile_filter=has-note`

Lookup endpoint note:

- `/api/lookups/products/` supports `include_disabled=true` to include inactive products.

## Business Rules Reflected In The Backend

Stock:

- Purchase stock contributes only when purchase items are `received`.
- Sale stock is deducted only when sale items are `packed`, `shipped`, or `delivered`.
- Stock validation is server-side. Frontend previews are not authoritative.

Eligibility:

- Billing note creation uses the backend eligibility endpoint and excludes sales already linked to active billing notes.
- Payment batch creation uses the backend eligibility endpoint and excludes purchases already linked to active payment batches.
- Credit note creation is limited to cancelled sale items not already credited by active credit notes.

Reference numbers:

- Purchases use `PO`
- Sales use `TI`
- Quotations use `QT`
- Billing notes use `BN`
- Payment batches use `PMT`
- Credit notes use `CN`

Quotations:

- Quotations can link forward into derived purchases and derived sales.
- Supplier comparison per quotation line is stored in `QuotationItemSupplier`.

## AI Inventory Assistant

`POST /api/chat/`

Behavior:

- If `OPENAI_API_KEY` is set, the backend calls the configured `OPENAI_MODEL`.
- If `OPENAI_API_KEY` is empty, the backend returns a local read-only summary built from current inventory data.

The assistant is intended for concise operational questions about stock, products, and transaction summaries. It is read-only and does not mutate inventory data.

## Frontend Connection

The frontend defaults to:

```text
http://127.0.0.1:8000/api
```

If needed, set this in `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

## Production Notes

Before deploying beyond local development:

- Set a real `DJANGO_SECRET_KEY`
- Set `DJANGO_DEBUG=False`
- Set `DJANGO_ALLOWED_HOSTS`
- Restrict `CORS_ALLOWED_ORIGINS`
- Enable `INVENTORY_REQUIRE_AUTH=True` only when an auth flow is in place
- Configure MySQL credentials for the target environment
- Serve `MEDIA_ROOT` and `STATIC_ROOT` appropriately
