// React component for shared component: multi purchase wizard.

import { useMemo, useState } from "react";
import PurchaseForm from "./PurchaseForm";
import { useLanguage } from "../i18n/LanguageContext";
import {
  getNextPurchaseReference,
  getNextPurchaseReferenceAfter,
} from "./purchases/purchaseFormUtils";

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
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [createdIndexes, setCreatedIndexes] = useState(() => new Set());

  const groupsWithRefs = useMemo(() => {
    let ref = getNextPurchaseReference(purchases);
    return groups.map((group, index) => {
      if (index > 0) ref = getNextPurchaseReferenceAfter(ref);
      return { ...group, reference_no: ref };
    });
  }, [groups, purchases]);

  const allCreated = groupsWithRefs.length > 0 && createdIndexes.size === groupsWithRefs.length;

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
            <p className="eyebrow">{t("multiPurchase.eyebrow")}</p>
            <h3>
              {t("multiPurchase.title", { current: currentIndex + 1, total: groupsWithRefs.length })}
            </h3>
          </div>
          <button
            className="secondary-button table-action-button"
            type="button"
            onClick={onCancel}
          >
            {t("multiPurchase.cancelButton")}
          </button>
        </div>

        <div className="wizard-step-list">
          {groupsWithRefs.map((group, index) => (
            <button
              key={`${group.supplier_name}-${index}`}
              type="button"
              className={index === currentIndex ? "wizard-step active" : "wizard-step"}
              onClick={() => setCurrentIndex(index)}
            >
              <span className="wizard-step-index">{index + 1}</span>
              <span className="wizard-step-name">{group.supplier_name}</span>
              <span className="wizard-step-state">
                {createdIndexes.has(index) ? t("multiPurchase.stepCreated") : t("multiPurchase.stepDraft")}
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
            {t("common.previous")}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={currentIndex >= groupsWithRefs.length - 1}
            onClick={() =>
              setCurrentIndex((value) => Math.min(groupsWithRefs.length - 1, value + 1))
            }
          >
            {t("common.next")}
          </button>
        </div>

        {allCreated ? (
          <div className="wizard-finish">
            <div className="notice-banner">
              {t("multiPurchase.allCreated", { total: groupsWithRefs.length })}
            </div>
            <button className="primary-button" type="button" onClick={onViewPurchases}>
              {t("multiPurchase.goToPurchases")}
            </button>
          </div>
        ) : null}
      </section>

      {groupsWithRefs.map((group, index) => (
        <div key={`${group.supplier_name}-${index}`} hidden={index !== currentIndex}>
          {createdIndexes.has(index) ? (
            <section className="section-card">
              <div className="notice-banner">
                {t("multiPurchase.orderCreated", { supplier: group.supplier_name })}
              </div>
            </section>
          ) : (
            <PurchaseForm
              products={products}
              suppliers={suppliers}
              purchases={purchases}
              prefill={group}
              onSubmit={(formData) => handleCreateGroup(index, formData)}
              onCancel={onCancel}
            />
          )}
        </div>
      ))}
    </div>
  );
}
