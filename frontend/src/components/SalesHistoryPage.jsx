import { useMemo, useState } from "react";
import TransactionTable from "./TransactionTable";

const statusOptions = ["draft", "packed", "shipped", "delivered", "cancelled"];

function normalize(value) {
  return `${value ?? ""}`.toLowerCase();
}

function saleMatchesQuery(sale, query) {
  const searchableText = [
    sale.reference_no,
    sale.customer_name,
    sale.status,
    sale.transaction_date,
    sale.payment_received_date,
    sale.note,
    ...(sale.items || []).flatMap((item) => [
      item.product_name,
      item.sku,
      item.category,
      item.quantity,
      item.unit_price,
    ]),
  ]
    .map(normalize)
    .join(" ");

  return searchableText.includes(query);
}

function SalesHistoryPage({ sales, onSaleStatusChange }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(statusOptions);
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const matchesSearch = normalizedSearch
        ? saleMatchesQuery(sale, normalizedSearch)
        : true;
      const matchesStatus = selectedStatuses.includes(sale.status);

      return matchesSearch && matchesStatus;
    });
  }, [normalizedSearch, sales, selectedStatuses]);

  function toggleStatus(status) {
    setSelectedStatuses((currentStatuses) =>
      currentStatuses.includes(status)
        ? currentStatuses.filter((currentStatus) => currentStatus !== status)
        : [...currentStatuses, status]
    );
  }

  function resetFilters() {
    setSearchTerm("");
    setSelectedStatuses(statusOptions);
    setFilterOpen(false);
  }

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">History Search</p>
            <h3>Find Sales Records</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search reference, customer, status, date, note, or item"
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {filteredSales.length} of {sales.length} sales shown
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setFilterOpen((currentValue) => !currentValue)}
          >
            Filter
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            Reset Filter
          </button>
        </div>

        {filterOpen ? (
          <div className="history-filter-panel">
            <p className="history-filter-title">Sales Status</p>
            <div className="history-filter-options">
              {statusOptions.map((status) => (
                <label className="history-filter-option" key={status}>
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => toggleStatus(status)}
                  />
                  <span>{status}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <TransactionTable
        rows={filteredSales}
        type="sale"
        onSaleStatusChange={onSaleStatusChange}
      />
    </div>
  );
}

export default SalesHistoryPage;
