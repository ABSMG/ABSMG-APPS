import React, { FormEvent, useMemo, useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { ChatMessage, UserProfile } from "../types";

interface ChatViewProps {
  user?: UserProfile;
  chatHistory: ChatMessage[];
  isLoading?: boolean;
  onSendMessage: (text: string) => void;
  onNewChat?: () => void;
}

const suggestions = [
  "Help me plan my day",
  "Explain something to me",
  "Help me learn a new skill",
  "Search for useful opportunities",
];

function renderMessage(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function ChatView({
  user,
  chatHistory,
  isLoading = false,
  onSendMessage,
  onNewChat,
}: ChatViewProps) {
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const visibleMessages = useMemo(
    () => chatHistory.filter((item) => item.role !== "system"),
    [chatHistory]
  );

  const displayName = user?.name?.trim() || "there";

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();

    const text = message.trim();

    if (!text || isLoading) return;

    onSendMessage(text);
    setMessage("");
  };

  const handleSuggestion = (text: string) => {
    if (isLoading) return;

    onSendMessage(text);
  };

  const copyMessage = async (item: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(item.content);

      setCopiedId(item.id);

      window.setTimeout(() => {
        setCopiedId((current) =>
          current === item.id ? null : current
        );
      }, 1500);
    } catch {
      // Clipboard may not be available on some browsers/devices.
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 pb-28 pt-3 sm:px-6">
      {/* Header */}
      <header className="sticky top-0 z-30 mb-4 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-slate-950/90 px-4 py-3 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20">
            <Sparkles size={20} className="text-white" />
          </div>

          <div>
            <h1 className="text-sm font-bold text-white sm:text-base">
              Nodysom AI
            </h1>

            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-slate-400">
                AI Assistant
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onNewChat}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </header>

      {/* Chat area */}
      <main className="flex-1">
        {visibleMessages.length === 0 ? (
          <div className="flex min-h-[65vh] flex-col items-center justify-center px-2 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-400/10 ring-1 ring-blue-400/20">
              <MessageCircle
                size={38}
                className="text-blue-400"
              />
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
              Hello, {displayName}
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
              I’m Nodysom AI. Ask me anything, plan your day,
              learn something new, search for information, or
              organize your tasks.
            </p>

            <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestion(suggestion)}
                  disabled={isLoading}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left text-sm text-slate-300 transition hover:border-blue-400/30 hover:bg-blue-500/[0.07] disabled:opacity-50"
                >
                  <Sparkles
                    size={16}
                    className="mb-2 text-blue-400"
                  />

                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {visibleMessages.map((item) => {
              const isUser = item.role === "user";

              return (
                <div
                  key={item.id}
                  className={`flex gap-3 ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isUser && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
                      <Bot size={17} className="text-white" />
                    </div>
                  )}

                  <div
                    className={`group max-w-[88%] sm:max-w-[75%] ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                        isUser
                          ? "rounded-br-md bg-blue-600 text-white"
                          : "rounded-bl-md border border-white/[0.08] bg-white/[0.04] text-slate-200"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {renderMessage(item.content)}
                      </div>
                    </div>

                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => copyMessage(item)}
                        className="mt-1 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-500 opacity-0 transition hover:bg-white/[0.05] hover:text-slate-300 group-hover:opacity-100"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check size={12} />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            Copy
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {isUser && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08]">
                      <User size={17} className="text-slate-300" />
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
                  <Bot size={17} className="text-white" />
                </div>

                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
                  <Loader2
                    size={16}
                    className="animate-spin text-blue-400"
                  />
                  <span>Nodysom is thinking...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Composer */}
      <div className="sticky bottom-3 z-30 mt-5">
        <form
          onSubmit={submitMessage}
          className="rounded-2xl border border-white/[0.1] bg-slate-900/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  submitMessage(event);
                }
              }}
              placeholder="Message Nodysom AI..."
              rows={1}
              maxLength={2000}
              disabled={isLoading}
              className="max-h-40 min-h-[46px] flex-1 resize-none bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
            />

            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 size={19} className="animate-spin" />
              ) : (
                <Send size={19} />
              )}
            </button>
          </div>

          <div className="px-3 pb-1 pt-1 text-[10px] text-slate-600">
            Enter to send · Shift + Enter for new line
          </div>
        </form>
      </div>
    </section>
  );
}

export default ChatView;
