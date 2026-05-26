import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import DocumentRefBody from "./documentRefs/DocumentRefBody";
import { buildDocConfig } from "./documentRefs/documentRefConfig";

function DocumentRefModal({ docType, docId, referenceNo, onClose }) {
  const { t } = useLanguage();
  const [stack, setStack] = useState([{ docType, docId, referenceNo }]);

  // A fresh open (props change) resets the drill-down stack.
  useEffect(() => {
    setStack([{ docType, docId, referenceNo }]);
  }, [docType, docId, referenceNo]);

  const entry = stack[stack.length - 1];
  const DOC_CONFIG = useMemo(() => buildDocConfig(t), [t]);
  const config = DOC_CONFIG[entry.docType];

  if (!config) return null;

  function openRef(nextEntry) {
    setStack((current) => [...current, nextEntry]);
  }

  function goBack() {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }

  const canGoBack = stack.length > 1;

  return (
    <div className="modal-backdrop doc-ref-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal transaction-detail-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${config.label} ${entry.referenceNo || ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{config.label}</p>
            <h3>{entry.referenceNo || entry.docId}</h3>
          </div>
          <div className="transaction-detail-actions">
            {canGoBack && (
              <button
                type="button"
                className="secondary-button table-action-button"
                onClick={goBack}
              >
                {t("documentRef.back")}
              </button>
            )}
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={onClose}
            >
              {t("common.close")}
            </button>
          </div>
        </div>

        <DocumentRefBody entry={entry} onOpenRef={openRef} />
      </div>
    </div>
  );
}

export default DocumentRefModal;
