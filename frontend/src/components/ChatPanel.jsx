// React component for shared component: chat panel.

import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import ChatMessageBody from "./chat/ChatMessageBody";
import ChatRecordDetailModal from "./chat/ChatRecordDetailModal";

function ChatPanel({ messages, onAsk, onClear, onOpenRecord, detail, onCloseDetail, busy }) {
  const { t } = useLanguage();
  const [question, setQuestion] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const instructionUseCases = t("chat.instructionUseCases");
  const unsupportedItems = t("chat.unsupportedItems");
  const canClear = !busy && messages.length > 1;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!question.trim() || busy) {
      return;
    }

    const submittedQuestion = question;
    setQuestion("");
    await onAsk(submittedQuestion);
  }

  function handleClear() {
    if (!canClear) {
      return;
    }
    onClear?.();
  }

  return (
    <section className="section-card chat-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("chat.eyebrow")}</p>
          <h3>{t("chat.title")}</h3>
          <p className="chat-scope-note">{t("chat.scopeNote")}</p>
        </div>
        <div className="chat-actions">
          <button
            type="button"
            className="secondary-button chat-action-button"
            aria-expanded={showInstructions}
            aria-controls="chat-instructions"
            onClick={() => setShowInstructions((current) => !current)}
          >
            {showInstructions ? t("chat.hideInstructionsButton") : t("chat.instructionsButton")}
          </button>
          <button
            type="button"
            className="danger-button chat-action-button"
            onClick={handleClear}
            disabled={!canClear}
            title={busy ? t("chat.clearHistoryBusy") : t("chat.clearHistoryButton")}
          >
            {t("chat.clearHistoryButton")}
          </button>
        </div>
      </div>

      {showInstructions ? (
        <div className="chat-instructions" id="chat-instructions">
          <div className="chat-instruction-header">
            <h4>{t("chat.instructionsTitle")}</h4>
            <p>{t("chat.instructionsIntro")}</p>
          </div>

          <div className="chat-instruction-grid">
            {Array.isArray(instructionUseCases)
              ? instructionUseCases.map((group) => (
                  <section className="chat-instruction-card" key={group.title}>
                    <h5>{group.title}</h5>
                    <p>{group.description}</p>
                    <div className="chat-use-case-list">
                      {(group.examples || []).map((example) => (
                        <button
                          type="button"
                          className="prompt-chip chat-use-case-chip"
                          key={example}
                          onClick={() => setQuestion(example)}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              : null}
          </div>

          <section className="chat-instruction-card chat-instruction-card-wide">
            <h5>{t("chat.unsupportedTitle")}</h5>
            <ul className="chat-inline-list">
              {Array.isArray(unsupportedItems)
                ? unsupportedItems.map((item) => <li key={item}>{item}</li>)
                : null}
            </ul>
          </section>
        </div>
      ) : null}

      <div className="prompt-list">
        <span>{t("chat.exampleLabel")}</span>
        <button type="button" className="prompt-chip" onClick={() => setQuestion(t("chat.prompt1"))}>
          {t("chat.prompt1")}
        </button>
        <button type="button" className="prompt-chip" onClick={() => setQuestion(t("chat.prompt2"))}>
          {t("chat.prompt2")}
        </button>
        <button type="button" className="prompt-chip" onClick={() => setQuestion(t("chat.prompt3"))}>
          {t("chat.prompt3")}
        </button>
        <button type="button" className="prompt-chip" onClick={() => setQuestion(t("chat.prompt4"))}>
          {t("chat.prompt4")}
        </button>
      </div>

      <div className="chat-thread">
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={message.role === "user" ? "chat-bubble user" : "chat-bubble assistant"}
          >
            <strong>{message.role === "user" ? t("chat.you") : t("chat.assistant")}</strong>
            <ChatMessageBody message={message} onOpenRecord={onOpenRecord} />
            {message.model ? <span>{t("chat.model", { model: message.model })}</span> : null}
          </article>
        ))}

        {busy ? <p className="busy-copy">{t("chat.generating")}</p> : null}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea
          rows="4"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("chat.placeholder")}
        />
        <button className="primary-button" type="submit" disabled={busy}>
          {t("chat.askButton")}
        </button>
      </form>

      <ChatRecordDetailModal detail={detail} onClose={onCloseDetail} />
    </section>
  );
}

export default ChatPanel;
