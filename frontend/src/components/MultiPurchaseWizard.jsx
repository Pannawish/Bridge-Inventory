import { useState } from "react";
import PurchaseForm from "./PurchaseForm";

/**
 * Wizard for the quotation → purchase conversion. Each supplier group becomes
 * one purchase order; all forms stay mounted so the user can move front/back
 * and adjust each before creating it.
 */
export default function MultiPurchaseWizard({
  groups,
  products,
  suppliers,
  purchases,
  onCreatePurchase,
  onCancel,
  onViewPurchases,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [createdIndexes, setCreatedIndexes] = useState(() => new Set());

  const allCreated = groups.length > 0 && createdIndexes.size === groups.length;

  async function handleCreateGroup(index, formData) {
    const saved = await onCreatePurchase(formData);
    if (saved === false) {
      return false;
    }
    setCreatedIndexes((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
    return saved;
  }

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Quotation → Purchase Orders</p>
            <h3>
              Purchase Order {currentIndex + 1} of {groups.length}
            </h3>
          </div>
          <button
            className="secondary-button table-action-button"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>

        <div className="wizard-step-list">
          {groups.map((group, index) => (
            <button
              key={`${group.supplier_name}-${index}`}
              type="button"
              className={index === currentIndex ? "wizard-step active" : "wizard-step"}
              onClick={() => setCurrentIndex(index)}
            >
              <span className="wizard-step-index">{index + 1}</span>
              <span className="wizard-step-name">{group.supplier_name}</span>
              <span className="wizard-step-state">
                {createdIndexes.has(index) ? "Created" : "Draft"}
              </span>
            </button>
          ))}
        </div>

        <div className="wizard-nav-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
          >
            Previous
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={currentIndex >= groups.length - 1}
            onClick={() =>
              setCurrentIndex((value) => Math.min(groups.length - 1, value + 1))
            }
          >
            Next
          </button>
        </div>

        {allCreated ? (
          <div className="wizard-finish">
            <div className="notice-banner">
              All {groups.length} purchase orders created.
            </div>
            <button className="primary-button" type="button" onClick={onViewPurchases}>
              Go to Purchases
            </button>
          </div>
        ) : null}
      </section>

      {groups.map((group, index) => (
        <div key={`${group.supplier_name}-${index}`} hidden={index !== currentIndex}>
          {createdIndexes.has(index) ? (
            <section className="section-card">
              <div className="notice-banner">
                Purchase order for {group.supplier_name} has been created.
              </div>
            </section>
          ) : (
            <PurchaseForm
              products={products}
              suppliers={suppliers}
              purchases={purchases}
              prefill={group.prefill}
              onSubmit={(formData) => handleCreateGroup(index, formData)}
              onCancel={onCancel}
            />
          )}
        </div>
      ))}
    </div>
  );
}
