// Page component for shared component workflows.

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { getProductDisplayName } from "./products/productUtils";

const SCOPE_OPTIONS = [
  { value: "supplier", labelKey: "aiReport.scopeSupplier" },
  { value: "customer", labelKey: "aiReport.scopeCustomer" },
  { value: "product", labelKey: "aiReport.scopeProduct" },
];

function escapeHtml(value) {
  return `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPartnerName(partner) {
  return `${partner?.companyName ?? partner?.company_name ?? partner?.name ?? ""}`.trim();
}

function getProductLabel(product, fallback) {
  const productName = getProductDisplayName(product, fallback);
  return product?.sku ? `${productName} (${product.sku})` : productName;
}

function buildOptions(rows, labelResolver) {
  return rows
    .map((row) => ({
      id: `${row?.id ?? ""}`.trim(),
      label: labelResolver(row),
    }))
    .filter((option) => option.id && option.label)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function resolveSelection(currentId, options) {
  if (options.some((option) => option.id === currentId)) {
    return currentId;
  }
  return options[0]?.id || "";
}

function writeWindowDocument(reportWindow, html) {
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
}

function buildStatusDocument(title, message) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { font-family: Inter, Arial, sans-serif; color: #172033; background: #eef2f6; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(520px, 100%); padding: 24px; border: 1px solid #dfe5ee; border-radius: 4px; background: #fff; box-shadow: 0 12px 26px rgba(24, 33, 50, 0.08); }
    h1 { margin: 0 0 10px; font-size: 22px; }
    p { margin: 0; color: #647085; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </main>
</body>
</html>`;
}

function AiReportPage({
  suppliers = [],
  customers = [],
  products = [],
  onGenerateReport,
}) {
  const { language, t } = useLanguage();
  const [scopeType, setScopeType] = useState("supplier");
  const [selectedIds, setSelectedIds] = useState({
    supplier: "",
    customer: "",
    product: "",
  });
  const [periodType, setPeriodType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const supplierOptions = useMemo(
    () => buildOptions(suppliers, getPartnerName),
    [suppliers]
  );
  const customerOptions = useMemo(
    () => buildOptions(customers, getPartnerName),
    [customers]
  );
  const productOptions = useMemo(
    () => buildOptions(products, (product) => getProductLabel(product, t("aiReport.unnamedProduct"))),
    [products, t]
  );

  const optionsByScope = {
    supplier: supplierOptions,
    customer: customerOptions,
    product: productOptions,
  };
  const activeOptions = optionsByScope[scopeType] || [];
  const activeSelection = selectedIds[scopeType] || "";
  const selectedOption = activeOptions.find((option) => option.id === activeSelection);
  const selectedLabel = selectedOption?.label || "";
  const customPeriod = periodType === "custom";
  const canGenerate =
    Boolean(selectedOption) &&
    (!customPeriod || (Boolean(dateFrom) && Boolean(dateTo))) &&
    !generating;

  useEffect(() => {
    setSelectedIds((current) => {
      return {
        supplier: resolveSelection(current.supplier, supplierOptions),
        customer: resolveSelection(current.customer, customerOptions),
        product: resolveSelection(current.product, productOptions),
      };
    });
  }, [customerOptions, productOptions, supplierOptions]);

  function handleScopeChange(nextScope) {
    setScopeType(nextScope);
    setError("");
  }

  function handleSelectionChange(value) {
    setSelectedIds((current) => ({
      ...current,
      [scopeType]: value,
    }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canGenerate) {
      setError(t("aiReport.validationMissing"));
      return;
    }

    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setError(t("aiReport.popupBlocked"));
      return;
    }

    writeWindowDocument(
      reportWindow,
      buildStatusDocument(t("aiReport.generatingTitle"), t("aiReport.generatingWindow"))
    );
    setGenerating(true);
    setError("");

    try {
      const payload = {
        scope_type: scopeType,
        entity_id: activeSelection,
        period_type: periodType,
        language,
      };
      if (customPeriod) {
        payload.date_from = dateFrom;
        payload.date_to = dateTo;
      }

      const response = await onGenerateReport(payload);
      if (!response?.html) {
        throw new Error(t("aiReport.emptyResponse"));
      }
      writeWindowDocument(reportWindow, response.html);
      reportWindow.opener = null;
      reportWindow.focus();
    } catch (requestError) {
      const message = requestError.message || t("aiReport.generateFailed");
      setError(message);
      writeWindowDocument(
        reportWindow,
        buildStatusDocument(t("aiReport.failedTitle"), message)
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="stack-layout ai-report-page">
      <section className="section-card ai-report-setup-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("aiReport.eyebrow")}</p>
            <h3>{t("aiReport.title")}</h3>
          </div>
        </div>

        <form className="ai-report-form" onSubmit={handleSubmit}>
          <div
            className="ai-report-scope-toggle"
            role="radiogroup"
            aria-label={t("aiReport.scopeLabel")}
          >
            {SCOPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={scopeType === option.value}
                className={
                  scopeType === option.value
                    ? "ai-report-scope-option active"
                    : "ai-report-scope-option"
                }
                onClick={() => handleScopeChange(option.value)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>

          <div className="form-grid ai-report-form-grid">
            <label>
              <span className="required-label">{t(`aiReport.${scopeType}Label`)}</span>
              <select
                value={activeSelection}
                onChange={(event) => handleSelectionChange(event.target.value)}
              >
                {activeOptions.length ? (
                  <option value="" disabled>
                    {t("aiReport.selectPlaceholder")}
                  </option>
                ) : (
                  <option value="">{t("aiReport.noOptions")}</option>
                )}
                {activeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="required-label">{t("aiReport.periodLabel")}</span>
              <select
                value={periodType}
                onChange={(event) => {
                  setPeriodType(event.target.value);
                  setError("");
                }}
              >
                <option value="all">{t("aiReport.periodAll")}</option>
                <option value="custom">{t("aiReport.periodCustom")}</option>
              </select>
            </label>

            {customPeriod ? (
              <>
                <label>
                  <span className="required-label">{t("aiReport.dateFromLabel")}</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      setError("");
                    }}
                  />
                </label>
                <label>
                  <span className="required-label">{t("aiReport.dateToLabel")}</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      setDateTo(event.target.value);
                      setError("");
                    }}
                  />
                </label>
              </>
            ) : null}
          </div>

          <div className="ai-report-preview" aria-live="polite">
            <span>{t("aiReport.previewTarget")}</span>
            <strong>{selectedLabel || t("aiReport.noSelection")}</strong>
            <span>
              {customPeriod && dateFrom && dateTo
                ? t("aiReport.previewCustomPeriod", { from: dateFrom, to: dateTo })
                : t("aiReport.periodAll")}
            </span>
          </div>

          {error ? <p className="field-error-text ai-report-error">{error}</p> : null}

          <div className="ai-report-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setPeriodType("all");
                setDateFrom("");
                setDateTo("");
                setError("");
              }}
              disabled={generating}
            >
              {t("common.reset")}
            </button>
            <button type="submit" className="primary-button" disabled={!canGenerate}>
              {generating ? t("aiReport.generatingButton") : t("aiReport.generateButton")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default AiReportPage;
