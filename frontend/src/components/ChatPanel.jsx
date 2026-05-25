import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

function ChatPanel({ messages, onAsk, busy }) {
  const { t } = useLanguage();
  const [question, setQuestion] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!question.trim() || busy) {
      return;
    }

    const submittedQuestion = question;
    setQuestion("");
    await onAsk(submittedQuestion);
  }

  return (
    <section className="section-card chat-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("chat.eyebrow")}</p>
          <h3>{t("chat.title")}</h3>
        </div>
      </div>

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
      </div>

      <div className="chat-thread">
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={message.role === "user" ? "chat-bubble user" : "chat-bubble assistant"}
          >
            <strong>{message.role === "user" ? t("chat.you") : t("chat.assistant")}</strong>
            <p>{message.content}</p>
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
    </section>
  );
}

export default ChatPanel;
