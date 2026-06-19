import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

const INITIAL_VISIBLE_RECORDS = 5;

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

function ChatRecordList({ section, onOpenRecord }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const records = section.records || [];
  const hasMore = records.length > INITIAL_VISIBLE_RECORDS;
  const visibleRecords = expanded ? records : records.slice(0, INITIAL_VISIBLE_RECORDS);
  const hiddenCount = Math.max(0, records.length - INITIAL_VISIBLE_RECORDS);

  return (
    <>
      <div className={expanded && hasMore ? "chat-record-list expanded" : "chat-record-list"}>
        {visibleRecords.map((record, recordIndex) => (
          <div key={`${record.label}-${recordIndex}`} className="chat-record-row">
            <div>
              <strong>{record.label}</strong>
              {record.meta ? <p>{record.meta}</p> : null}
            </div>
            {record.value ? (
              <span className="chat-record-value">
                {record.value_label ? <small>{record.value_label}</small> : null}
                <strong>{record.value}</strong>
              </span>
            ) : null}
            {record.target ? (
              <button
                type="button"
                className="chat-record-open"
                onClick={() => onOpenRecord?.(record.target)}
              >
                {t("chat.openRecord")}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {hasMore ? (
        <button
          type="button"
          className="chat-section-toggle"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? t("chat.showLessRecords")
            : t("chat.showMoreRecords", { count: hiddenCount })}
        </button>
      ) : null}
    </>
  );
}

function ChatPresentationSection({ section, index, onOpenRecord }) {
  return (
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
        <ChatRecordList section={section} onOpenRecord={onOpenRecord} />
      ) : null}
    </section>
  );
}

function ChatPresentation({ presentation, onOpenRecord }) {
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
            <ChatPresentationSection
              key={`${section.title}-${index}`}
              section={section}
              index={index}
              onOpenRecord={onOpenRecord}
            />
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

function ChatMessageBody({ message, onOpenRecord }) {
  const showText = message.content && (!message.presentation || message.model !== "local-summary");

  return (
    <div className="chat-message-body">
      {message.presentation ? (
        <ChatPresentation presentation={message.presentation} onOpenRecord={onOpenRecord} />
      ) : null}
      {showText ? <ChatTextContent content={message.content} /> : null}
    </div>
  );
}

export default ChatMessageBody;
