import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import EligiblePartyCombobox from "../EligiblePartyCombobox";
import {
  buildBillingNoteLinesFromSales,
  filterLinkableCreditNotesForCustomer,
  getNextBillingNoteReferenceNo,
  getToday,
  isSaleAvailableForBillingNote,
} from "./billingNoteUtils";

function CreateBillingNoteModal({
  sales,
  billingNotes,
  creditNotes = [],
  usingMockCreditNotes = false,
  nextReferenceNo = "",
  onClose,
  onCreate,
}) {
  const { t } = useLanguage();
  const [customerName, setCustomerName] = useState("");
  const [billingNoteDate, setBillingNoteDate] = useState(getToday());
  const [expectedPaymentDate, setExpectedPaymentDate] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [note, setNote] = useState("");
  const [selectedSaleIds, setSelectedSaleIds] = useState(new Set());
  const [availableCreditNotes, setAvailableCreditNotes] = useState([]);
  const [availableCreditNotesLoading, setAvailableCreditNotesLoading] = useState(false);
  const [availableCreditNotesError, setAvailableCreditNotesError] = useState("");
  const [selectedCreditNoteIds, setSelectedCreditNoteIds] = useState(new Set());
  const [error, setError] = useState("");

  const customerOptions = useMemo(() => {
    const set = new Set(
      sales
        .filter((sale) => isSaleAvailableForBillingNote(sale, billingNotes))
        .map((sale) => `${sale.customer_name ?? ""}`.trim())
        .filter(Boolean)
    );
    return Array.from(set).sort();
  }, [sales, billingNotes]);
  const hasSelectedEligibleCustomer = customerOptions.includes(customerName);

  const eligibleSales = useMemo(() => {
    if (!customerName) return [];
    return sales.filter(
      (sale) =>
        sale.customer_name === customerName &&
        isSaleAvailableForBillingNote(sale, billingNotes)
    );
  }, [customerName, sales, billingNotes]);

  useEffect(() => {
    if (!customerName || !hasSelectedEligibleCustomer) {
      setAvailableCreditNotes([]);
      setAvailableCreditNotesLoading(false);
      setAvailableCreditNotesError("");
      setSelectedCreditNoteIds(new Set());
      return;
    }

    if (usingMockCreditNotes) {
      setAvailableCreditNotes(
        filterLinkableCreditNotesForCustomer(creditNotes, customerName)
      );
      setAvailableCreditNotesLoading(false);
      setAvailableCreditNotesError("");
      return;
    }

    let ignore = false;

    async function loadAvailableCreditNotes() {
      setAvailableCreditNotesLoading(true);
      setAvailableCreditNotesError("");

      try {
        let currentPage = 1;
        let totalPages = 1;
        const rows = [];

        do {
          const response = await api.getCreditNotes({
            customer: customerName,
            page: currentPage,
            page_size: 100,
          });
          const batch = Array.isArray(response?.results)
            ? response.results
            : Array.isArray(response)
              ? response
              : [];
          rows.push(...batch);
          totalPages = Math.max(1, Number(response?.total_pages) || 1);
          currentPage += 1;
        } while (currentPage <= totalPages);

        if (!ignore) {
          setAvailableCreditNotes(
            filterLinkableCreditNotesForCustomer(rows, customerName)
          );
        }
      } catch (requestError) {
        if (!ignore) {
          setAvailableCreditNotes([]);
          setAvailableCreditNotesError(requestError.message || "");
        }
      } finally {
        if (!ignore) {
          setAvailableCreditNotesLoading(false);
        }
      }
    }

    loadAvailableCreditNotes();

    return () => {
      ignore = true;
    };
  }, [creditNotes, customerName, hasSelectedEligibleCustomer, usingMockCreditNotes]);

  function toggleSale(saleId) {
    setSelectedSaleIds((current) => {
      const next = new Set(current);
      if (next.has(saleId)) {
        next.delete(saleId);
      } else {
        next.add(saleId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedSaleIds(new Set(eligibleSales.map((sale) => sale.id)));
  }

  function clearAll() {
    setSelectedSaleIds(new Set());
  }

  function toggleCreditNote(creditNoteId) {
    setSelectedCreditNoteIds((current) => {
      const next = new Set(current);
      if (next.has(creditNoteId)) {
        next.delete(creditNoteId);
      } else {
        next.add(creditNoteId);
      }
      return next;
    });
  }

  function selectAllCreditNotes() {
    setSelectedCreditNoteIds(new Set(availableCreditNotes.map((note) => note.id)));
  }

  function clearAllCreditNotes() {
    setSelectedCreditNoteIds(new Set());
  }

  const billedAmount = useMemo(
    () =>
      eligibleSales
        .filter((sale) => selectedSaleIds.has(sale.id))
        .reduce((acc, sale) => acc + (Number(sale.grand_total) || 0), 0),
    [eligibleSales, selectedSaleIds]
  );

  const selectedCreditNotes = useMemo(
    () =>
      availableCreditNotes.filter((creditNote) => selectedCreditNoteIds.has(creditNote.id)),
    [availableCreditNotes, selectedCreditNoteIds]
  );

  const creditAmount = useMemo(
    () =>
      selectedCreditNotes.reduce(
        (acc, creditNote) => acc + (Number(creditNote.total_amount) || 0),
        0
      ),
    [selectedCreditNotes]
  );

  const netPayable = Math.max(0, billedAmount - creditAmount);

  function handleSubmit(event) {
    event.preventDefault();

    if (!customerName) {
      setError(t("billingNote.selectCustomerFirst"));
      return;
    }

    const chosenSales = eligibleSales.filter((sale) => selectedSaleIds.has(sale.id));

    if (!chosenSales.length) {
      setError(t("billingNote.noEligibleSales"));
      return;
    }

    const referenceNo =
      nextReferenceNo || getNextBillingNoteReferenceNo(billingNotes);
    const lines = buildBillingNoteLinesFromSales(chosenSales);

    onCreate({
      reference_no: referenceNo,
      customer_name: customerName,
      billing_note_date: billingNoteDate || getToday(),
      expected_payment_date: expectedPaymentDate || null,
      actual_payment_date: null,
      status: "issued",
      bank_reference: bankReference,
      note,
      total_amount: billedAmount,
      lines,
      selected_credit_notes: selectedCreditNotes,
    });
  }

  return (
    <section className="section-card billing-note-create-card" aria-labelledby="bn-create-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("billingNote.eyebrow")}</p>
          <h3 id="bn-create-title">{t("billingNote.createTitle")}</h3>
        </div>
        <button
          className="secondary-button table-action-button"
          type="button"
          onClick={onClose}
        >
          {t("common.cancel")}
        </button>
      </div>

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <EligiblePartyCombobox
            id="billing-note-customer"
            label={t("billingNote.customerLabel")}
            value={customerName}
            options={customerOptions}
            placeholder={t("billingNote.searchPlaceholder")}
            emptyMessage={t("billingNote.noEligibleSales")}
            onChange={(nextCustomerName) => {
              setCustomerName(nextCustomerName);
              setSelectedSaleIds(new Set());
              setSelectedCreditNoteIds(new Set());
              setError("");
            }}
          />

          <label>
            {t("billingNote.dateLabel")}
            <input
              type="date"
              value={billingNoteDate}
              onChange={(event) => setBillingNoteDate(event.target.value)}
            />
          </label>

          <label>
            {t("billingNote.expectedPaymentDate")}
            <input
              type="date"
              value={expectedPaymentDate}
              onChange={(event) => setExpectedPaymentDate(event.target.value)}
            />
          </label>

          <label>
            {t("billingNote.bankReference")}
            <input
              value={bankReference}
              onChange={(event) => setBankReference(event.target.value)}
              placeholder={t("common.optional")}
            />
          </label>

          <label className="full-width">
            {t("billingNote.noteLabel")}
            <textarea
              rows="2"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("common.optional")}
            />
          </label>
        </div>

        <div className="line-items-header">
          <div>
            <p className="eyebrow">{t("billingNote.step2")}</p>
            <h4>{t("billingNote.chooseSales")}</h4>
          </div>
          <span>{t("billingNote.selectedCount", { count: selectedSaleIds.size })}</span>
        </div>

        {customerName ? (
          eligibleSales.length === 0 ? (
            <p className="empty-copy">{t("billingNote.noEligibleSales")}</p>
          ) : (
            <>
              <div className="history-filter-actions">
                <button className="secondary-button" type="button" onClick={selectAll}>
                  {t("common.selectAll")}
                </button>
                <button className="secondary-button" type="button" onClick={clearAll}>
                  {t("common.clear")}
                </button>
              </div>

              <div className="transaction-table-window billing-note-create-table-window">
                <div className="table-scroll billing-note-create-scroll">
                  <table className="transaction-history-table partner-line-table billing-note-create-table">
                    <colgroup>
                      <col className="billing-note-select-col" />
                      <col className="billing-note-reference-col" />
                      <col className="billing-note-date-col" />
                      <col className="billing-note-status-col" />
                      <col className="billing-note-term-col" />
                      <col className="billing-note-date-col" />
                      <col className="billing-note-amount-col" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th />
                        <th>{t("billingNote.colReference")}</th>
                        <th>{t("billingNote.colSaleDate")}</th>
                        <th>{t("common.status")}</th>
                        <th>{t("billingNote.colPaymentTerm")}</th>
                        <th>{t("billingNote.colPaymentDue")}</th>
                        <th>{t("billingNote.colAmount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleSales.map((sale) => {
                        const checked = selectedSaleIds.has(sale.id);
                        return (
                          <tr
                            key={sale.id}
                            className={checked ? "partner-table-row active" : "partner-table-row"}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSale(sale.id)}
                              />
                            </td>
                            <td>{sale.reference_no || sale.id}</td>
                            <td>{formatDate(sale.transaction_date)}</td>
                            <td>
                              <span className={`status-badge status-${sale.status}`}>
                                {sale.status?.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td>
                              {sale.payment_term_type === "credit"
                                ? t("billingNote.paymentCreditTerm", {
                                    days: sale.payment_term_days || "",
                                  })
                                : sale.payment_term_type === "cash"
                                  ? t("billingNote.paymentDebitTerm")
                                  : "—"}
                            </td>
                            <td>{formatDate(sale.payment_date)}</td>
                            <td>{fmt(sale.grand_total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )
        ) : (
          <p className="empty-copy">{t("billingNote.selectCustomerFirst")}</p>
        )}

        <div className="line-items-header">
          <div>
            <p className="eyebrow">{t("billingNote.step3")}</p>
            <h4>{t("billingNote.chooseCreditNotes")}</h4>
          </div>
          <span>{t("billingNote.creditSelectedCount", { count: selectedCreditNoteIds.size })}</span>
        </div>

        {!customerName ? (
          <p className="empty-copy">{t("billingNote.selectCustomerFirst")}</p>
        ) : availableCreditNotesLoading ? (
          <p className="empty-copy">{t("common.loading")}</p>
        ) : availableCreditNotesError ? (
          <p className="empty-copy">{t("billingNote.availableCreditsLoadError")}</p>
        ) : availableCreditNotes.length === 0 ? (
          <p className="empty-copy">{t("billingNote.noAvailableCreditNotes")}</p>
        ) : (
          <>
            <div className="history-filter-actions">
              <button className="secondary-button" type="button" onClick={selectAllCreditNotes}>
                {t("common.selectAll")}
              </button>
              <button className="secondary-button" type="button" onClick={clearAllCreditNotes}>
                {t("common.clear")}
              </button>
            </div>

            <div className="transaction-table-window billing-note-create-table-window">
              <div className="table-scroll billing-note-create-scroll">
                <table className="transaction-history-table partner-line-table billing-note-create-table">
                  <thead>
                    <tr>
                      <th />
                      <th>{t("billingNote.colReference")}</th>
                      <th>{t("billingNote.colIssued")}</th>
                      <th>{t("billingNote.colStatus")}</th>
                      <th>{t("billingNote.colAmount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableCreditNotes.map((creditNote) => {
                      const checked = selectedCreditNoteIds.has(creditNote.id);
                      return (
                        <tr
                          key={creditNote.id}
                          className={checked ? "partner-table-row active" : "partner-table-row"}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCreditNote(creditNote.id)}
                            />
                          </td>
                          <td>{creditNote.reference_no || creditNote.id}</td>
                          <td>{formatDate(creditNote.credit_note_date)}</td>
                          <td>
                            <span className={`status-badge status-${creditNote.status || "issued"}`}>
                              {creditNote.status?.replace(/_/g, " ") || "issued"}
                            </span>
                          </td>
                          <td>{fmt(creditNote.total_amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="sales-summary-card">
          <div className="sales-summary-row">
            <span>{t("billingNote.totalBilled")}</span>
            <span>{fmt(billedAmount)}</span>
          </div>
          <div className="sales-summary-row">
            <span>{t("billingNote.lessCredits")}</span>
            <span>{fmt(creditAmount)}</span>
          </div>
          <div className="sales-summary-row sales-summary-grand">
            <strong>{t("billingNote.netPayable")}</strong>
            <strong>{fmt(netPayable)}</strong>
          </div>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="primary-button" type="submit">
            {t("billingNote.createButton")}
          </button>
        </div>
      </form>
    </section>
  );
}

export default CreateBillingNoteModal;
