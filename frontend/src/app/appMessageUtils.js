import { formatSaleStockIssueMessage } from "../saleStock";

export function buildAppMessageHelpers({ t, language }) {
  function formatMessage(key, values = {}) {
    return t(key, values).replace(/\s{2,}/g, " ").trim();
  }

  function getStatusLabel(status) {
    const key = `common.statusLabels.${status}`;
    const label = t(key);
    return label === key ? status : label;
  }

  function getEntityLabel(entityKey) {
    return t(`app.entities.${entityKey}`);
  }

  function formatSaleStockMessage(issues) {
    return formatSaleStockIssueMessage(issues, {
      t,
      locale: language === "th" ? "th-TH" : "en-US",
    });
  }

  function buildEntityNotice(messageKey, entityKey, ref) {
    return formatMessage(messageKey, {
      entity: getEntityLabel(entityKey),
      ref: ref || "",
    });
  }

  function buildStatusUpdatedNotice(entityKey, ref, status) {
    return formatMessage("app.messages.statusUpdated", {
      entity: getEntityLabel(entityKey),
      ref: ref || "",
      status: getStatusLabel(status),
    });
  }

  function buildStatusChangeConfirm(entityKey, ref, fromStatus, toStatus) {
    return formatMessage("app.messages.statusChangeConfirm", {
      entity: getEntityLabel(entityKey),
      ref: ref || "",
      from: getStatusLabel(fromStatus),
      to: getStatusLabel(toStatus),
    });
  }

  return {
    formatSaleStockMessage,
    buildEntityNotice,
    buildStatusUpdatedNotice,
    buildStatusChangeConfirm,
  };
}
