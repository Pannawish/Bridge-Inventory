import { useEffect, useState } from "react";

export function useAppChat({ api, t, setError }) {
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: t("app.messages.chatIntro") },
  ]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.role !== "assistant") {
        return current;
      }

      const nextContent = t("app.messages.chatIntro");

      if (current[0].content === nextContent) {
        return current;
      }

      return [{ role: "assistant", content: nextContent }];
    });
  }, [t]);

  async function handleAskChat(question) {
    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setChatBusy(true);
    setError("");

    try {
      const response = await api.askChat(question);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: response.answer || "No answer returned.",
          model: response.used_model,
          presentation: response.presentation || null,
        },
      ]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setChatBusy(false);
    }
  }

  return {
    chatBusy,
    messages,
    handleAskChat,
  };
}
