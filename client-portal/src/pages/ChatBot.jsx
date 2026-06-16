import { useState, useRef, useEffect } from "react";
import Layout from "../components/Layout";
import ChatBubble from "../components/ChatBubble";
import TypingIndicator from "../components/TypingIndicator";
import useChatHistory from "../hooks/useChatHistory";
import { getChatResponse } from "../services/openai";
import { Bot, Send, Loader2, AlertCircle, Zap } from "lucide-react";

const QUICK_QUESTIONS = [
  "What documents do I need for ITR filing?",
  "What is the GST return filing deadline?",
  "How do I calculate TDS on salary?",
  "What are the tax slabs for FY 2024-25?",
  "How to register a company in India?",
];

const ChatBot = () => {
  const { messages, loading, saveMessage } = useChatHistory();
  const [input,    setInput]    = useState("");
  const [thinking, setThinking] = useState(false);
  const [error,    setError]    = useState("");
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const handleSend = async (text) => {
    const message = text || input.trim();
    if (!message || thinking) return;
    setInput("");
    setError("");
    await saveMessage("user", message);
    setThinking(true);
    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: message });
      const reply = await getChatResponse(history);
      await saveMessage("assistant", reply);
    } catch {
      setError("Failed to get a response. Please try again.");
    }
    setThinking(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <Layout title="AI Assistant">
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">

        {/* Header */}
        <div className="bg-[#1D7872] rounded-2xl p-5 mb-4 text-white flex items-center gap-4 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center border border-white/20 flex-shrink-0">
            <Bot size={24} className="text-white" />
          </div>
          <div className="relative">
            <h2 className="font-black text-lg tracking-tight">CA AI Assistant</h2>
            <p className="text-white text-sm font-medium">
              Ask me anything about taxes, GST, ITR, TDS, and more.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 relative">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-white text-xs font-medium">Online</span>
          </div>
        </div>

        {/* Chat Window */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] overflow-y-auto p-4 space-y-4 mb-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={28} className="animate-spin text-white" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1D7872] flex items-center justify-center mb-4">
                <Bot size={30} className="text-white" />
              </div>
              <p className="text-gray-700 font-bold text-lg mb-1">How can I help you today?</p>
              <p className="text-gray-400 text-sm mb-6 max-w-sm font-medium">
                Ask me about Indian taxes, GST, ITR, TDS, or any CA-related queries.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border  text-white  transition-all font-medium"
                  >
                    <Zap size={11} /> {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)}
              {thinking && <TypingIndicator />}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-2.5 mb-3">
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Quick chips when chat active */}
        {messages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-500   whitespace-nowrap transition-all flex-shrink-0 font-medium"
              >
                <Zap size={10} /> {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex items-end gap-3 bg-white rounded-2xl border border-gray-200 p-3 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question... (Enter to send)"
            className="flex-1 text-sm text-gray-700 resize-none focus:outline-none max-h-28 leading-relaxed font-medium"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || thinking}
            className="w-10 h-10 rounded-xl bg-[#1D7872] text-white flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-md"
          >
            {thinking
              ? <Loader2 size={16} className="animate-spin" />
              : <Send size={16} />
            }
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default ChatBot;
