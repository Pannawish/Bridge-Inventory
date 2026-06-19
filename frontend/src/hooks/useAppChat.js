import { useEffect, useState } from "react";

function buildIntroMessage(t) {
  return { role: "assistant", content: t("app.messages.chatIntro") };
}

export function useAppChat({ api, t, setError }) {
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState([buildIntroMessage(t)]);
  const [chatDetail, setChatDetail] = useState({
    open: false,
    loading: false,
    error: "",
    target: null,
    data: null,
  });

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.role !== "assistant") {
        return current;
      }

      const nextContent = t("app.messages.chatIntro");

      if (current[0].content === nextContent) {
        return current;
      }

      return [buildIntroMessage(t)];
    });
  }, [t]);

  function handleClearChat() {
    setError("");
    setMessages([buildIntroMessage(t)]);
  }

  function closeChatDetail() {
    setChatDetail({
      open: false,
      loading: false,
      error: "",
      target: null,
      data: null,
    });
  }

  async function handleOpenChatRecord(target) {
    if (!target?.type || !target?.id) {
      return;
    }

    const fetchers = {
      product: api.getProduct,
      purchase: api.getPurchase,
      sale: api.getSale,
      quotation: api.getQuotation,
      billing_note: api.getBillingNote,
      payment_batch: api.getPaymentBatch,
      credit_note: api.getCreditNote,
    };
    const fetchRecord = fetchers[target.type];
    if (!fetchRecord) {
      return;
    }

    setChatDetail({ open: true, loading: true, error: "", target, data: null });

    try {
      const data = await fetchRecord(target.id);
      setChatDetail({ open: true, loading: false, error: "", target, data });
    } catch (requestError) {
      setChatDetail({
        open: true,
        loading: false,
        error: requestError.message || t("chatDetail.loadFailed"),
        target,
        data: null,
      });
    }
  }

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
    chatDetail,
    messages,
    handleAskChat,
    handleClearChat,
    handleOpenChatRecord,
    closeChatDetail,
  };
}
