import { useState } from "react";
//Pannawish
function ChatPanel({ messages, onAsk, busy }) {
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
          <p className="eyebrow">Natural Language Query</p>
          <h3>AI Inventory Assistant</h3>
        </div>
      </div>

      <div className="prompt-list">
        <span>Example:</span>
        <button type="button" className="prompt-chip" onClick={() => setQuestion("Which items are low stock?")}>
          Which items are low stock?
        </button>
        <button type="button" className="prompt-chip" onClick={() => setQuestion("What are the latest sales transactions?")}>
          What are the latest sales transactions?
        </button>
        <button type="button" className="prompt-chip" onClick={() => setQuestion("Which product should I restock first?")}>
          Which product should I restock first?
        </button>
      </div>

      <div className="chat-thread">
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={message.role === "user" ? "chat-bubble user" : "chat-bubble assistant"}
          >
            <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
            <p>{message.content}</p>
            {message.model ? <span>Model: {message.model}</span> : null}
          </article>
        ))}

        {busy ? <p className="busy-copy">Generating answer...</p> : null}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea
          rows="4"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question about stock, purchases, sales, or restocking."
        />
        <button className="primary-button" type="submit" disabled={busy}>
          Ask Assistant
        </button>
      </form>
    </section>
  );
}

export default ChatPanel;
