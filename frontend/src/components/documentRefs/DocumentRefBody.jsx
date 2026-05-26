import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import DocumentRefChip from "../DocumentRefChip";
import { buildDocConfig } from "./documentRefConfig";

function DocumentRefBody({ entry, onOpenRef }) {
  const { t } = useLanguage();
  const docConfig = useMemo(() => buildDocConfig(t), [t]);
  const config = docConfig[entry.docType];
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!config || !entry.docId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    config
      .fetch(entry.docId)
      .then((data) => {
        if (active) {
          setDoc(data);
        }
      })
      .catch(() => {
        if (active) {
          setError(t("documentRef.failed"));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [config, entry.docId, t]);

  if (!config) return null;
  if (loading) return <p className="doc-ref-modal-loading">{t("documentRef.loading")}</p>;
  if (error) return <p className="doc-ref-modal-error">{error}</p>;
  if (!doc) return null;

  const itemTable = config.items(doc);
  const totals = config.totals ? config.totals(doc) : [];
  const refGroups = config.refs ? config.refs(doc) : [];

  return (
    <>
      <div className="detail-grid">
        {config.header(doc).map((field) => (
          <div key={field.label} className={field.fullWidth ? "full-width" : undefined}>
            <p className="detail-label">{field.label}</p>
            {field.status !== undefined ? (
              <strong>
                <span className={`status-badge status-${field.status}`}>
                  {getStatusLabel(t, field.status)}
                </span>
              </strong>
            ) : (
              <strong>{field.value || "—"}</strong>
            )}
          </div>
        ))}
      </div>

      {itemTable.rows.length > 0 ? (
        <div className="detail-items">
          <div className="table-scroll">
            <table className="detail-item-table">
              <thead>
                <tr>
                  {itemTable.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itemTable.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className={itemTable.rowClassNames?.[rowIndex]}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {totals.length > 0 ? (
        <div className="tx-sales-summary">
          {totals.map(({ label, value, strong, className }) => (
            <div
              key={label}
              className={`${
                strong ? "tx-summary-row tx-summary-grand" : "tx-summary-row"
              }${className ? ` ${className}` : ""}`}
            >
              {strong ? (
                <>
                  <strong>{label}</strong>
                  <strong>{value}</strong>
                </>
              ) : (
                <>
                  <span>{label}</span>
                  <span>{value}</span>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {refGroups.length > 0 ? (
        <div className="doc-ref-modal-related">
          {refGroups.map((group) => {
            const validLinks = group.links.filter((link) => link && link.id);
            return (
              <div key={group.label} className="doc-ref-related-group">
                <p className="doc-ref-group-label">{group.label}</p>
                {validLinks.length > 0 ? (
                  <div className="doc-ref-chips">
                    {validLinks.map((link) => (
                      <DocumentRefChip
                        key={`${group.docType}-${link.id}`}
                        label={link.reference_no || link.id}
                        docType={group.docType}
                        onClick={() =>
                          onOpenRef({
                            docType: group.docType,
                            docId: link.id,
                            referenceNo: link.reference_no || link.id,
                          })
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <span className="doc-ref-empty">—</span>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

export default DocumentRefBody;
