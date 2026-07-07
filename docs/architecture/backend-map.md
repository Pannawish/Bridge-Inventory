# Backend Map

This document explains where backend behavior lives after the backend was split
into focused modules.

Related docs:

- [Codebase Study Guide](../codebase-study-guide.md)
- [Business Rules Reference](../business/business-rules-reference.md)
- [Database Schema](./database-schema.md)

## Backend Layers

The backend is a Django + Django REST Framework app under
[backend/inventory/](../../backend/inventory/).

Request path:

1. [backend/config/urls.py](../../backend/config/urls.py) routes `/api/` into the inventory app.
2. [backend/inventory/urls.py](../../backend/inventory/urls.py) registers viewsets and focused endpoints.
3. [backend/inventory/views/](../../backend/inventory/views/) handles HTTP concerns: routing, filters, pagination, permissions, and response shape.
4. [backend/inventory/serializers/](../../backend/inventory/serializers/) validates payloads and maps API fields to models.
5. [backend/inventory/services/](../../backend/inventory/services/) owns shared business rules such as stock, dashboard summaries, payment totals, and chat context.
6. [backend/inventory/models.py](../../backend/inventory/models.py) defines durable database tables.

## Data Model Groups

[models.py](../../backend/inventory/models.py) contains these main groups:

- Master data: `Category`, `Product`, `ProductSupplier`, `Supplier`, `Customer`
- Purchase flow: `Purchase`, `PurchaseItem`, `PurchaseDocument`
- Sale flow: `Sale`, `SaleItem`, `SaleDocument`, `SaleItemAllocation`
- Quotation flow: `Quotation`, `QuotationItem`, `QuotationItemSupplier`
- Finance flow: `BillingNote`, `BillingNoteLine`, `PaymentBatch`, `PaymentBatchLine`, `CreditNote`, `CreditNoteLine`
- Media and audit: `ProductPicture`, `ActivityLog`

Historical snapshot fields such as names, SKUs, prices, totals, and tax values
are intentional. They keep old business documents readable even when master data
changes later.

## Views

View modules live under [backend/inventory/views/](../../backend/inventory/views/).

- [common.py](../../backend/inventory/views/common.py): shared request normalization, filters, reference number generation, base viewset, audit logging
- [master_data.py](../../backend/inventory/views/master_data.py): categories, products, suppliers, customers, product lookups, product history, stock layers
- [transactions.py](../../backend/inventory/views/transactions.py): purchases, sales, quotations, credit notes, credit-note eligibility
- [finance.py](../../backend/inventory/views/finance.py): billing notes, payment batches, finance summaries, eligibility endpoints
- [dashboard.py](../../backend/inventory/views/dashboard.py): dashboard summary and segment endpoints
- [ai.py](../../backend/inventory/views/ai.py): AI chat and AI report endpoints
- [access.py](../../backend/inventory/views/access.py): admin users, roles, and activity logs
- [_legacy.py](../../backend/inventory/views/_legacy.py): compatibility exports for the old `inventory.views` import path

Views should stay thin. If a rule affects validation, stock, eligibility, or
money, it should usually live in serializers or services.

## Serializers

Serializer modules live under [backend/inventory/serializers/](../../backend/inventory/serializers/).

- [common.py](../../backend/inventory/serializers/common.py): shared helpers for Decimal handling, partner/product resolution, file payloads, print profiles
- [master_data.py](../../backend/inventory/serializers/master_data.py): master-data payloads and product attachment fields
- [transactions.py](../../backend/inventory/serializers/transactions.py): purchases, sales, quotations, credit notes, line item replacement, stock validation calls
- [finance.py](../../backend/inventory/serializers/finance.py): billing notes, payment batches, finance grouping and duplicate prevention
- [access.py](../../backend/inventory/serializers/access.py): user, role, permission, and activity-log payloads
- [_legacy.py](../../backend/inventory/serializers/_legacy.py): compatibility exports for the old `inventory.serializers` import path

Serializers are where most direct API safety belongs. Frontend validation is
helpful, but serializers must still reject invalid direct API requests.

## Services

Service modules live under [backend/inventory/services/](../../backend/inventory/services/).

- [common.py](../../backend/inventory/services/common.py): small formatting, date, text, and chat helper functions
- [transactions.py](../../backend/inventory/services/transactions.py): purchase/sale status derivation, payable totals, payment line syncing
- [stock.py](../../backend/inventory/services/stock.py): available stock, FIFO/manual allocation, sale stock issues, stock report rows
- [dashboard.py](../../backend/inventory/services/dashboard.py): dashboard summary, trend, finance, product, cashflow, and order coverage segments
- [chat.py](../../backend/inventory/services/chat.py): AI chat context and deterministic response preparation
- [_legacy.py](../../backend/inventory/services/_legacy.py): compatibility exports for the old `inventory.services` import path

Services are used when the same business rule must be shared by multiple
serializers, views, tests, or seed data.

## Validation Ownership

Use this ownership rule when studying the backend:

- Model fields define what can be stored.
- Serializers decide whether an API payload is valid.
- Services calculate shared business state.
- Views decide how HTTP requests are filtered, paginated, and returned.
- Tests document expected behavior.

Examples:

- Stock availability: [services/stock.py](../../backend/inventory/services/stock.py)
- Sale status normalization: [services/transactions.py](../../backend/inventory/services/transactions.py)
- Billing note duplicate prevention: [serializers/finance.py](../../backend/inventory/serializers/finance.py)
- Product delete guard: [views/master_data.py](../../backend/inventory/views/master_data.py)

## Important API Groups

Routes are defined in [backend/inventory/urls.py](../../backend/inventory/urls.py).

- `/api/products/`, `/api/suppliers/`, `/api/customers/`, `/api/categories/`
- `/api/purchases/`, `/api/sales/`, `/api/quotations/`, `/api/credit-notes/`
- `/api/billing-notes/`, `/api/payment-batches/`
- `/api/dashboard/`, `/api/dashboard/segment/`
- `/api/lookups/products/`, `/api/lookups/suppliers/`, `/api/lookups/customers/`
- `/api/eligibility/billing-note-sales/`
- `/api/eligibility/payment-batch-purchases/`
- `/api/eligibility/credit-note-sales/`
- `/api/chat/`, `/api/ai-reports/`
- `/api/admin/users/`, `/api/admin/roles/`, `/api/activity-logs/`

## Compatibility Notes

The backend still supports old imports such as `from inventory.views import
ProductViewSet` and `from inventory.serializers import ProductSerializer`.
The package `__init__.py` files import from `_legacy.py`, and `_legacy.py`
re-exports the focused modules. New code should prefer focused imports.

## Tests

The main backend regression suite is [backend/inventory/tests.py](../../backend/inventory/tests.py).

Use these checks after backend changes:

```bash
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test inventory
```

The tests are especially useful for studying stock allocation, finance
eligibility, dashboard/AI behavior, and permission-sensitive API behavior.
