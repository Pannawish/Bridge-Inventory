// Modal component for inventory control workflows.

import { useLanguage } from "../../i18n/LanguageContext";

// Math symbols that render as plain operators between formula "pills".
const FORMULA_OPS = new Set(["+", "−", "-", "×", "÷", "/", "="]);

// A formula shown as visual chips instead of a prose sentence — operands become
// pills, operators sit plainly between them (e.g. [units sold] ÷ [days selling]).
function RefFormula({ tokens }) {
  return (
    <p className="inv-ref-formula">
      {tokens.map((token, index) =>
        FORMULA_OPS.has(token) ? (
          <span className="inv-ref-op" key={index}>
            {token}
          </span>
        ) : (
          <span className="inv-ref-pill" key={index}>
            {token}
          </span>
        )
      )}
    </p>
  );
}

// One plain-language definition: an icon + term, a short "what it means" line,
// then an optional visual formula and a tiny example. Starred terms (reorder
// point, safety stock) are the headline numbers.
function RefTerm({ icon, term, plain, formula, example, star, egLabel }) {
  return (
    <div className={`inv-ref-term${star ? " is-key" : ""}`}>
      <p className="inv-ref-term-name">
        {icon ? <span className="inv-ref-term-icon" aria-hidden="true">{icon}</span> : null}
        <span>{term}</span>
        {star ? <span className="inv-ref-term-star" aria-hidden="true">★</span> : null}
      </p>
      <p className="inv-ref-term-plain">{plain}</p>
      {Array.isArray(formula) && formula.length ? <RefFormula tokens={formula} /> : null}
      {example ? (
        <p className="inv-ref-term-eg">
          <span className="inv-ref-eg-tag">{egLabel}</span>
          {example}
        </p>
      ) : null}
    </div>
  );
}

function RefSection({ title, subtitle, children }) {
  return (
    <section className="inv-ref-section">
      <div className="inv-ref-section-head">
        <h4>{title}</h4>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

// Plain-language guide to every figure on the dashboard and inventory page.
// Designed to be skimmable: short "what it means" first, optional "how" second.
// The stock-cycling band dots reuse the dashboard's seg-* colors so the two
// pages read as one system.
function InventoryReferenceModal({ onClose }) {
  const { t } = useLanguage();
  const egLabel = t("inventory.refEgLabel");
  const reorderRows = t("inventory.refReorderRows");
  const stockRows = t("inventory.refStockRows");
  const popularity = t("inventory.refPopularity");
  const bands = t("inventory.refBands");

  const renderTerms = (rows) =>
    (Array.isArray(rows) ? rows : []).map((row) => (
      <RefTerm key={row.term} {...row} egLabel={egLabel} />
    ));

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal inv-ref-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-ref-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("inventory.refEyebrow")}</p>
            <h3 id="inv-ref-title">{t("inventory.refTitle")}</h3>
            <p className="inv-ref-subtitle">{t("inventory.refSubtitle")}</p>
          </div>
          <button
            type="button"
            className="secondary-button table-action-button"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>

        <div className="inv-ref-stack">
          <RefSection
            title={t("inventory.refReorderTitle")}
            subtitle={t("inventory.refReorderSubtitle")}
          >
            <div className="inv-ref-terms">{renderTerms(reorderRows)}</div>
          </RefSection>

          <RefSection
            title={t("inventory.refSellTitle")}
            subtitle={t("inventory.refSellSubtitle")}
          >
            <div className="inv-ref-terms">
              <RefTerm {...popularity} egLabel={egLabel} />
            </div>
            <p className="inv-ref-bands-intro">{t("inventory.refBandsIntro")}</p>
            <ul className="inv-ref-bands">
              {(Array.isArray(bands) ? bands : []).map((band) => (
                <li className="inv-ref-band" key={band.klass}>
                  <span className={`inv-ref-band-dot seg-${band.klass}`} aria-hidden="true" />
                  <span className="inv-ref-band-name">{band.label}</span>
                  <span className="inv-ref-band-rule">{band.rule}</span>
                </li>
              ))}
            </ul>
          </RefSection>

          <RefSection
            title={t("inventory.refStockTitle")}
            subtitle={t("inventory.refStockSubtitle")}
          >
            <div className="inv-ref-terms">{renderTerms(stockRows)}</div>
          </RefSection>
        </div>
      </div>
    </div>
  );
}

export default InventoryReferenceModal;
