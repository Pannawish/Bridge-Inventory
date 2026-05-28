# Workflow Reference

This document describes the business workflow of Bridge Inventory in a form that is easy to reuse for:

- diagrams
- presentation scripts
- onboarding summaries
- workflow reviews

Use [business-rules-reference.md](/Users/peto/Documents/Inventory-Management-frontend/docs/business-rules-reference.md) when you need exact status, eligibility, FIFO, and stock-behavior rules. Use this file when you need the end-to-end operational story.

## 1. Workflow Summary

Bridge Inventory is built for a middle-man SME business model:

1. maintain master data
2. prepare quotations
3. decide whether stock is sufficient
4. buy from suppliers when stock is short
5. sell to customers when stock is available
6. update stock through transaction statuses
7. follow receivables through billing notes
8. follow payables through payment batches
9. handle cancelled or returned sale items through credit notes
10. monitor the full operation through dashboard summaries and the AI assistant

## 2. Detailed Workflow Text

### 2.1 Master Data Setup

- Create and maintain `Categories`
- Create and maintain `Products`
- Define each product's `base unit`, `unit conversions`, and supplier sourcing options
- Create and maintain `Suppliers`
- Create and maintain `Customers`
- Master data supports all later transaction workflows

### 2.2 Quotation Workflow

- User creates a `Quotation` for a customer
- Quotation contains product lines, quantities, prices, and optional supplier cost references
- Quotation checks `current stock sufficiency` for each line
- Quotation does not reserve stock
- Quotation does not deduct stock
- Quotation remains a commercial proposal and historical record

### 2.3 Quotation Decision Branch

- If stock is sufficient, quotation lines can be converted into a `Sale`
- If stock is not sufficient, selected quotation lines can be converted into a `Purchase`
- A quotation may feed one side only or both sides depending on business need
- Users can also create `Purchases` or `Sales` directly without starting from a quotation

### 2.4 Purchase Workflow

- Create a `Purchase Order` for a supplier
- Purchase may come from quotation shortage lines or be created directly
- Purchase lines start as pending procurement lines
- Purchase status progresses through `draft`, `ordered`, `partially_received`, `received`, or `cancelled`
- Purchase item status is the true operational driver
- Only purchase items marked `received` increase stock
- Pending or cancelled purchase items do not increase stock
- When items are received, they become available stock layers for later sales and cost tracking

### 2.5 Stock Update From Purchases

- `Received purchase items` increase available stock
- Stock is derived from transaction history, not typed manually into the product record
- Current stock is based on `received purchases minus committed sales`
- Purchase history also supports cost visibility and FIFO layer tracking

### 2.6 Sale Workflow

- Create a `Sale` for a customer
- Sale may come from a quotation or be created directly
- Sale lines are validated by backend stock rules
- Draft sales may exist before stock is committed
- Stock is reduced only when sale items reach `packed`, `shipped`, or `delivered`
- Sale statuses are derived from line statuses
- Cancelled or returned sale lines release active demand
- Sale records preserve historical snapshots such as customer name, product name, SKU, and pricing

### 2.7 Operational Stock Logic

- `Quotation` checks stock but does not move stock
- `Purchase received` increases stock
- `Sale packed/shipped/delivered` decreases stock
- `Sale cancelled/returned` removes or releases active demand
- Backend is authoritative for stock validation and prevents invalid stock-deducting sales

### 2.8 Billing Note Workflow

- A `Billing Note` is created from `eligible sales`
- Eligible sales must already be in fulfillment states allowed by backend rules
- In current backend logic, billing-note-eligible sale statuses are `shipped`, `partially_delivered`, and `delivered`
- Sales already linked to another active billing note are not eligible
- Billing notes group receivables for the same customer
- Billing note status is driven by line payment-received progress

### 2.9 Payment Batch Workflow

- A `Payment Batch` is created from `eligible purchases`
- Eligible purchases must already be `received` or `partially_received`
- Purchases already linked to another active payment batch are not eligible
- Payment batches group payables for the same supplier
- Payment batch status is driven by line paid progress

### 2.10 Credit Note Workflow

- A `Credit Note` is created from `cancelled` or `returned` sale items
- Credit notes reduce receivable value
- Credit notes are line-driven, not just sale-header-driven
- Sale items already used in another active credit note are not eligible again unless that earlier credit note is cancelled

### 2.11 Dashboard And Reporting Workflow

- Dashboard values are calculated by the backend
- Dashboard summarizes stock position, demand, purchase pipeline, receivables, payables, and operational health
- Product transaction history can be viewed on demand
- The frontend does not calculate full stock truth independently from partial page data

### 2.12 AI Assistant Workflow

- AI assistant reads existing inventory, purchase, sale, quotation, billing note, and payment batch data
- It helps answer operational questions such as low stock, recent sales, recent purchases, and stock value
- It is an analysis layer, not the source of truth for transactions

## 3. Compact Diagram Prompt

Use this text if you want a shorter prompt for a diagram generator:

- Start with `Master Data`
- `Master Data` includes `Categories`, `Products`, `Suppliers`, and `Customers`
- `Products` store units, conversions, supplier options, and historical references
- `Quotation` is created for a customer using products and pricing
- `Quotation` checks stock sufficiency but does not reserve or deduct stock
- `Quotation` can branch into `Sale` if stock is enough
- `Quotation` can branch into `Purchase` if stock is short
- `Purchase` can also be created directly
- `Sale` can also be created directly
- `Purchase item received` increases stock
- `Sale item packed/shipped/delivered` decreases stock
- `Cancelled or returned sale items` create `Credit Notes`
- `Eligible shipped/partially delivered/delivered sales` create `Billing Notes`
- `Eligible received/partially received purchases` create `Payment Batches`
- `Dashboard` reads backend-calculated stock, demand, pipeline, receivables, and payables
- `AI Assistant` reads system data for operational Q&A

## 4. Recommended Diagram Nodes

- `Master Data`
- `Quotation`
- `Stock Sufficiency Check`
- `Purchase Order`
- `Received Purchase Items`
- `Available Stock`
- `Sale Order`
- `Packed / Shipped / Delivered Sale Items`
- `Billing Notes`
- `Eligible Purchases`
- `Payment Batches`
- `Cancelled / Returned Sale Items`
- `Credit Notes`
- `Dashboard`
- `AI Assistant`

## 5. Recommended Diagram Connections

- `Master Data -> Quotation`
- `Master Data -> Purchase Order`
- `Master Data -> Sale Order`
- `Quotation -> Stock Sufficiency Check`
- `Stock Sufficiency Check -> Sale Order`
- `Stock Sufficiency Check -> Purchase Order`
- `Purchase Order -> Received Purchase Items`
- `Received Purchase Items -> Available Stock`
- `Available Stock -> Sale Order`
- `Sale Order -> Packed / Shipped / Delivered Sale Items`
- `Packed / Shipped / Delivered Sale Items -> Billing Notes`
- `Purchase Order -> Eligible Purchases`
- `Eligible Purchases -> Payment Batches`
- `Sale Order -> Cancelled / Returned Sale Items`
- `Cancelled / Returned Sale Items -> Credit Notes`
- `Received Purchase Items -> Dashboard`
- `Packed / Shipped / Delivered Sale Items -> Dashboard`
- `Billing Notes -> Dashboard`
- `Payment Batches -> Dashboard`
- `Credit Notes -> Dashboard`
- `Dashboard -> AI Assistant`
