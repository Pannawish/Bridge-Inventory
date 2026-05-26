import { useLanguage } from "../../i18n/LanguageContext";

function TransactionDocumentsPanel({
  documentLabelKey,
  summaryCountKey,
  summaryEmptyKey,
  addFilesLabelKey,
  emptyMessageKey,
  pendingDocuments = [],
  visibleDocuments = [],
  removedDocumentIds = [],
  removePendingLabelKey,
  deleteVisibleLabelKey,
  removeAllLabelKey,
  markedDeletionTitleKey,
  markedDeletionHelpKey,
  undoLabelKey,
  onAddDocuments,
  onRemovePendingDocument,
  onDeleteVisibleDocument,
  onRemoveAllDocuments,
  onUndoRemoveDocuments,
}) {
  const { t } = useLanguage();
  const totalDocuments = visibleDocuments.length + pendingDocuments.length;
  const hasDocuments = totalDocuments > 0;

  return (
    <div className="transaction-document-panel full-width">
      <div className="transaction-document-panel-header">
        <div>
          <strong>{t(documentLabelKey)}</strong>
          <span>
            {hasDocuments
              ? t(summaryCountKey, { count: totalDocuments })
              : t(summaryEmptyKey)}
          </span>
        </div>
        <label className="document-upload-button">
          {t(addFilesLabelKey)}
          <input
            type="file"
            multiple
            onChange={(event) => onAddDocuments?.(Array.from(event.target.files || []))}
          />
        </label>
      </div>

      {hasDocuments ? (
        <>
          <div className="transaction-document-list">
            {visibleDocuments.map((document) => (
              <span className="transaction-document-row" key={document.id}>
                <a href={document.url} target="_blank" rel="noreferrer">
                  {document.name}
                </a>
                {onDeleteVisibleDocument ? (
                  <button
                    className="text-danger-button"
                    type="button"
                    onClick={() => onDeleteVisibleDocument(document.id)}
                  >
                    {t(deleteVisibleLabelKey)}
                  </button>
                ) : null}
              </span>
            ))}
            {pendingDocuments.map((document, index) => (
              <span className="transaction-document-row" key={`${document.name}-${index}`}>
                <span>{document.name}</span>
                <button
                  className="text-danger-button"
                  type="button"
                  onClick={() => onRemovePendingDocument?.(index)}
                >
                  {t(removePendingLabelKey)}
                </button>
              </span>
            ))}
          </div>
          {onRemoveAllDocuments ? (
            <div className="transaction-document-actions">
              <button className="secondary-button" type="button" onClick={onRemoveAllDocuments}>
                {t(removeAllLabelKey)}
              </button>
            </div>
          ) : null}
        </>
      ) : removedDocumentIds.length && onUndoRemoveDocuments ? (
        <div className="transaction-document-state">
          <div>
            <strong>{t(markedDeletionTitleKey)}</strong>
            <span>{t(markedDeletionHelpKey)}</span>
          </div>
          <button className="secondary-button" type="button" onClick={onUndoRemoveDocuments}>
            {t(undoLabelKey)}
          </button>
        </div>
      ) : (
        <p className="transaction-document-empty">{t(emptyMessageKey)}</p>
      )}
    </div>
  );
}

export default TransactionDocumentsPanel;
