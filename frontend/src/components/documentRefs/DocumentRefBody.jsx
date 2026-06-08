import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { buildDocConfig } from "./documentRefConfig";
import DocumentRefContent from "./DocumentRefContent";

function DocumentRefBody({ entry, onOpenRef, onLoadedDoc = null }) {
  const { t } = useLanguage();
  const docConfig = useMemo(() => buildDocConfig(t), [t]);
  const config = docConfig[entry.docType];
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    onLoadedDoc?.(null);
    if (!config || !entry.docId) {
      setDoc(null);
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
          onLoadedDoc?.(data);
        }
      })
      .catch(() => {
        if (active) {
          setDoc(null);
          setError(t("documentRef.failed"));
          onLoadedDoc?.(null);
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

  return (
    <DocumentRefContent config={config} doc={doc} t={t} onOpenRef={onOpenRef} />
  );
}

export default DocumentRefBody;
