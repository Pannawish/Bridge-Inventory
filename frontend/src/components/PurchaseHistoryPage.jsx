import { useMemo, useState } from "react";
import TransactionTable from "./TransactionTable";

const statusOptions = ["draft", "ordered", "received", "cancelled"];

function normalize(value) {
  return `${value ?? ""}`.toLowerCase();
}

function purchaseMatchesQuery(purchase, query) {
  const searchableText = [
    purchase.reference_no,
    purchase.supplier_name,
    purchase.status,
    purchase.transaction_date,
    purchase.note,
    ...(purchase.items || []).flatMap((item) => [
      item.product_name,
      item.sku,
      item.category,
      item.quantity,
      item.unit_cost,
    ]),
  ]
    .map(normalize)
    .join(" ");

  return searchableText.includes(query);
}

function PurchaseHistoryPage({ purchases, onPurchaseStatusChange }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(statusOptions);
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredPurchases = useMemo(() => {
    return purchases.filter((purchase) => {
      const matchesSearch = normalizedSearch
        ? purchaseMatchesQuery(purchase, normalizedSearch)
        : true;
      const matchesStatus = selectedStatuses.includes(purchase.status);

      return matchesSearch && matchesStatus;
    });
  }, [normalizedSearch, purchases, selectedStatuses]);

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
            <h3>Find Purchase Records</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search reference, supplier, status, date, note, or item"
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {filteredPurchases.length} of {purchases.length} purchases shown
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
            <p className="history-filter-title">Purchase Status</p>
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
        rows={filteredPurchases}
        type="purchase"
        onPurchaseStatusChange={onPurchaseStatusChange}
      />
    </div>
  );
}

export default PurchaseHistoryPage;
