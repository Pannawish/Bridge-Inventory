function normalizeBulletText(line) {
  return line.replace(/^[-*]\s+/, "").trim();
}

function buildContentBlocks(content) {
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim());
  const blocks = [];
  let paragraphLines = [];
  let bulletLines = [];

  function flushParagraph() {
    if (!paragraphLines.length) {
      return;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    paragraphLines = [];
  }

  function flushBullets() {
    if (!bulletLines.length) {
      return;
    }
    blocks.push({ type: "list", items: [...bulletLines] });
    bulletLines = [];
  }

  lines.forEach((line) => {
    if (!line) {
      flushParagraph();
      flushBullets();
      return;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      bulletLines.push(normalizeBulletText(line));
      return;
    }

    flushBullets();
    paragraphLines.push(line.replace(/^#{1,6}\s+/, ""));
  });

  flushParagraph();
  flushBullets();
  return blocks;
}

function ChatPresentation({ presentation }) {
  if (!presentation) {
    return null;
  }

  return (
    <div className="chat-presentation">
      <div className="chat-presentation-header">
        <h4>{presentation.title}</h4>
        {presentation.subtitle ? <p>{presentation.subtitle}</p> : null}
      </div>

      {presentation.metrics?.length ? (
        <div className="chat-metric-grid">
          {presentation.metrics.map((metric, index) => (
            <div key={`${metric.label}-${index}`} className={`chat-metric-card tone-${metric.tone || "default"}`}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {presentation.sections?.length ? (
        <div className="chat-section-list">
          {presentation.sections.map((section, index) => (
            <section key={`${section.title}-${index}`} className="chat-section-card">
              <h5>{section.title}</h5>

              {section.items?.length ? (
                <ul className="chat-inline-list">
                  {section.items.map((item, itemIndex) => (
                    <li key={`${section.title}-item-${itemIndex}`}>{item}</li>
                  ))}
                </ul>
              ) : null}

              {section.records?.length ? (
                <div className="chat-record-list">
                  {section.records.map((record, recordIndex) => (
                    <div key={`${record.label}-${recordIndex}`} className="chat-record-row">
                      <div>
                        <strong>{record.label}</strong>
                        {record.meta ? <p>{record.meta}</p> : null}
                      </div>
                      {record.value ? <span>{record.value}</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChatTextContent({ content }) {
  const blocks = buildContentBlocks(content);

  if (!blocks.length) {
    return null;
  }

  return (
    <div className="chat-copy">
      {blocks.map((block, index) => {
        if (block.type === "list") {
          return (
            <ul key={`list-${index}`} className="chat-inline-list">
              {block.items.map((item, itemIndex) => (
                <li key={`list-item-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return <p key={`paragraph-${index}`}>{block.text}</p>;
      })}
    </div>
  );
}

function ChatMessageBody({ message }) {
  const showText = message.content && (!message.presentation || message.model !== "local-summary");

  return (
    <div className="chat-message-body">
      {message.presentation ? <ChatPresentation presentation={message.presentation} /> : null}
      {showText ? <ChatTextContent content={message.content} /> : null}
    </div>
  );
}

export default ChatMessageBody;
