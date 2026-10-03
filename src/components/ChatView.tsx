import React, {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bot,
  Check,
  ChevronDown,
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

const MAX_MESSAGE_LENGTH = 2000;

const suggestions = [
  {
    title: "Plan my day",
    text: "Help me plan my day",
    description: "Create a simple and productive daily plan",
  },
  {
    title: "Explain something",
    text: "Explain something to me",
    description: "Learn a topic in a simple way",
  },
  {
    title: "Learn a skill",
    text: "Help me learn a new skill",
    description: "Build a step-by-step learning plan",
  },
  {
    title: "Find opportunities",
    text: "Search for useful opportunities",
    description: "Discover useful opportunities and resources",
  },
];

function formatTime(timestamp?: string) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderInlineMarkdown(
  content: string
): React.ReactNode[] {
  const parts = content.split(
    /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  );

  return parts.map((part, index) => {
    if (
      part.startsWith("**") &&
      part.endsWith("**") &&
      part.length > 4
    ) {
      return (
        <strong
          key={index}
          className="font-bold text-white"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (
      part.startsWith("`") &&
      part.endsWith("`") &&
      part.length > 2
    ) {
      return (
        <code
          key={index}
          className="rounded-md border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[0.9em] text-cyan-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (
      part.startsWith("*") &&
      part.endsWith("*") &&
      part.length > 2
    ) {
      return (
        <em key={index}>
          {part.slice(1, -1)}
        </em>
      );
    }

    return (
      <React.Fragment key={index}>
        {part}
      </React.Fragment>
    );
  });
}

function renderMessage(content: string) {
  const lines = content.split("\n");

  return lines.map((line, index) => {
    const trimmed = line.trim();

    if (
      trimmed.startsWith("### ")
    ) {
      return (
        <div
          key={index}
          className="mb-2 mt-3 text-sm font-bold text-white first:mt-0"
        >
          {renderInlineMarkdown(
            trimmed.replace(/^### /, "")
          )}
        </div>
      );
    }

    if (
      trimmed.startsWith("## ")
    ) {
      return (
        <div
          key={index}
          className="mb-2 mt-3 text-base font-bold text-white first:mt-0"
        >
          {renderInlineMarkdown(
            trimmed.replace(/^## /, "")
          )}
        </div>
      );
    }

    if (
      trimmed.startsWith("# ")
    ) {
      return (
        <div
          key={index}
          className="mb-2 mt-3 text-lg font-bold text-white first:mt-0"
        >
          {renderInlineMarkdown(
            trimmed.replace(/^# /, "")
          )}
        </div>
      );
    }

    if (
      trimmed.startsWith("- ") ||
      trimmed.startsWith("* ")
    ) {
      return (
        <div
          key={index}
          className="flex gap-2 py-0.5"
        >
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
          <span>
            {renderInlineMarkdown(
              trimmed.slice(2)
            )}
          </span>
        </div>
      );
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const match =
        trimmed.match(/^(\d+)\.\s(.*)$/);

      return (
        <div
          key={index}
          className="flex gap-2 py-0.5"
        >
          <span className="min-w-[20px] font-semibold text-cyan-400">
            {match?.[1]}.
          </span>

          <span>
            {renderInlineMarkdown(
              match?.[2] || ""
            )}
          </span>
        </div>
      );
    }

    if (trimmed === "") {
      return (
        <div
          key={index}
          className="h-2"
        />
      );
    }

    return (
      <div
        key={index}
        className="min-h-[1.5rem]"
      >
        {renderInlineMarkdown(line)}
      </div>
    );
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
  const [copiedId, setCopiedId] =
    useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] =
    useState(true);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null);

  const bottomRef =
    useRef<HTMLDivElement | null>(null);

  const visibleMessages = useMemo(
    () =>
      chatHistory.filter(
        (item) => item.role !== "system"
      ),
    [chatHistory]
  );

  const displayName =
    user?.name?.trim() || "there";

  const firstName =
    displayName.split(/\s+/)[0] || "there";

  const remainingCharacters =
    MAX_MESSAGE_LENGTH - message.length;

  useEffect(() => {
    if (visibleMessages.length > 0) {
      setShowSuggestions(false);
    }
  }, [visibleMessages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [
    visibleMessages.length,
    isLoading,
  ]);

  const resizeTextarea = () => {
    const textarea =
      textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    const nextHeight = Math.min(
      textarea.scrollHeight,
      180
    );

    textarea.style.height = `${Math.max(
      nextHeight,
      46
    )}px`;
  };

  const submitMessage = (
    event: FormEvent
  ) => {
    event.preventDefault();

    const text = message.trim();

    if (!text || isLoading) {
      return;
    }

    onSendMessage(text);
    setMessage("");

    if (textareaRef.current) {
      textareaRef.current.style.height =
        "46px";
    }

    setShowSuggestions(false);
  };

  const handleSuggestion = (
    text: string
  ) => {
    if (isLoading) {
      return;
    }

    onSendMessage(text);
    setShowSuggestions(false);
  };

  const handleNewChat = () => {
    if (isLoading) {
      return;
    }

    setMessage("");
    setCopiedId(null);
    setShowSuggestions(true);

    if (textareaRef.current) {
      textareaRef.current.style.height =
        "46px";
    }

    onNewChat?.();
  };

  const copyMessage = async (
    item: ChatMessage
  ) => {
    try {
      if (
        !navigator.clipboard ||
        typeof navigator.clipboard.writeText !==
          "function"
      ) {
        return;
      }

      await navigator.clipboard.writeText(
        item.content
      );

      setCopiedId(item.id);

      window.setTimeout(() => {
        setCopiedId((current) =>
          current === item.id
            ? null
            : current
        );
      }, 1500);
    } catch {
      // Clipboard may not be available
      // on some browsers or devices.
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      submitMessage(event);
      return;
    }
  };

  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-70px)] w-full max-w-6xl flex-col px-3 pb-28 pt-3 sm:px-5 sm:pb-32 lg:px-8">

      {/* BACKGROUND GLOW */}
      <div className="pointer-events-none fixed left-1/2 top-24 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-500/[0.06] blur-3xl" />

      {/* CHAT HEADER */}
      <header className="sticky top-0 z-30 mb-3 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-slate-950/90 px-3 py-3 shadow-xl shadow-black/20 backdrop-blur-2xl sm:px-4">

        <div className="flex min-w-0 items-center gap-3">

          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 shadow-lg shadow-indigo-500/20">
              <Sparkles
                size={19}
                className="text-white"
              />
            </div>

            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-bold text-white sm:text-base">
                Nodysom AI
              </h1>

              <span className="hidden rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-indigo-300 sm:inline-flex">
                AI
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

              <span className="text-[10px] font-medium text-slate-500 sm:text-xs">
                AI Assistant
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">

          {visibleMessages.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setShowSuggestions(
                  (current) => !current
                )
              }
              disabled={isLoading}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
              aria-label="Toggle suggestions"
            >
              <Sparkles size={14} />

              <span className="hidden sm:inline">
                Prompts
              </span>

              <ChevronDown
                size={13}
                className={`transition-transform ${
                  showSuggestions
                    ? "rotate-180"
                    : ""
                }`}
              />
            </button>
          )}

          <button
            type="button"
            onClick={handleNewChat}
            disabled={isLoading}
            className="flex h-9 items-center gap-2 rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-3 text-xs font-semibold text-indigo-200 shadow-sm transition hover:border-indigo-400/40 hover:bg-indigo-500/20 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} />

            <span className="hidden sm:inline">
              New Chat
            </span>
          </button>
        </div>
      </header>

      {/* SUGGESTIONS */}
      {showSuggestions && (
        <div
          className={`mb-4 ${
            visibleMessages.length === 0
              ? "mt-2"
              : "mt-1"
          }`}
        >
          {visibleMessages.length === 0 && (
            <div className="mb-5 flex flex-col items-center justify-center px-2 pt-8 text-center sm:pt-12">

              <div className="relative mb-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-cyan-400/10 ring-1 ring-indigo-400/20 shadow-2xl shadow-indigo-500/10">
                  <MessageCircle
                    size={37}
                    className="text-indigo-300"
                  />
                </div>

                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-950 bg-indigo-500 shadow-lg shadow-indigo-500/30">
                  <Sparkles
                    size={12}
                    className="text-white"
                  />
                </span>
              </div>

              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-400">
                Personal AI Assistant
              </p>

              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                Hello, {firstName}
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
                I’m Nodysom AI. Ask me anything,
                plan your day, learn something new,
                search for information, or organize
                your tasks.
              </p>
            </div>
          )}

          <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2">
            {suggestions.map(
              (suggestion) => (
                <button
                  key={suggestion.text}
                  type="button"
                  onClick={() =>
                    handleSuggestion(
                      suggestion.text
                    )
                  }
                  disabled={isLoading}
                  className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-left transition-all duration-200 hover:border-indigo-400/30 hover:bg-indigo-500/[0.07] hover:shadow-lg hover:shadow-indigo-500/[0.05] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300 transition group-hover:bg-indigo-500/20">
                      <Sparkles
                        size={15}
                      />
                    </span>

                    <span className="text-sm font-semibold text-slate-200 group-hover:text-white">
                      {suggestion.title}
                    </span>
                  </div>

                  <p className="pl-10 text-xs leading-5 text-slate-500 group-hover:text-slate-400">
                    {suggestion.description}
                  </p>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* CHAT AREA */}
      <main className="min-h-0 flex-1">

        {visibleMessages.length > 0 ? (
          <div className="mx-auto w-full max-w-4xl space-y-6 py-3 sm:space-y-7 sm:py-5">

            {visibleMessages.map(
              (item) => {
                const isUser =
                  item.role === "user";

                return (
                  <div
                    key={item.id}
                    className={`group flex w-full gap-2.5 sm:gap-3 ${
                      isUser
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >

                    {/* ASSISTANT AVATAR */}
                    {!isUser && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 shadow-lg shadow-indigo-500/10 sm:h-9 sm:w-9">
                        <Bot
                          size={17}
                          className="text-white"
                        />
                      </div>
                    )}

                    <div
                      className={`flex max-w-[88%] flex-col sm:max-w-[78%] ${
                        isUser
                          ? "items-end"
                          : "items-start"
                      }`}
                    >

                      {/* MESSAGE */}
                      <div
                        className={`relative rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:px-5 sm:py-3.5 ${
                          isUser
                            ? "rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-500/10"
                            : "rounded-bl-md border border-white/[0.08] bg-white/[0.035] text-slate-200 shadow-black/10"
                        }`}
                      >
                        <div
                          className={`whitespace-pre-wrap break-words ${
                            !isUser
                              ? "prose-invert"
                              : ""
                          }`}
                        >
                          {renderMessage(
                            item.content
                          )}
                        </div>
                      </div>

                      {/* MESSAGE FOOTER */}
                      <div
                        className={`mt-1.5 flex items-center gap-2 px-1 ${
                          isUser
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        {item.timestamp && (
                          <span className="text-[10px] text-slate-600">
                            {formatTime(
                              item.timestamp
                            )}
                          </span>
                        )}

                        {!isUser && (
                          <>
                            <span className="text-slate-700">
                              ·
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                copyMessage(
                                  item
                                )
                              }
                              className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-medium text-slate-600 opacity-70 transition hover:bg-white/[0.05] hover:text-slate-300 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              {copiedId ===
                              item.id ? (
                                <>
                                  <Check
                                    size={11}
                                  />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy
                                    size={11}
                                  />
                                  Copy
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* USER AVATAR */}
                    {isUser && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-slate-700 to-slate-900 shadow-inner sm:h-9 sm:w-9">
                        <User
                          size={17}
                          className="text-slate-300"
                        />
                      </div>
                    )}
                  </div>
                );
              }
            )}

            {/* THINKING INDICATOR */}
            {isLoading && (
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 shadow-lg shadow-indigo-500/10 sm:h-9 sm:w-9">
                  <Bot
                    size={17}
                    className="text-white"
                  />
                </div>

                <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-slate-400">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />

                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400 [animation-delay:150ms]" />

                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 [animation-delay:300ms]" />
                  </div>

                  <span>
                    Nodysom is thinking...
                  </span>

                  <Loader2
                    size={15}
                    className="animate-spin text-indigo-400"
                  />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        ) : (
          <div className="min-h-4" />
        )}
      </main>

      {/* COMPOSER */}
      <div className="sticky bottom-2 z-40 mx-auto mt-4 w-full max-w-4xl sm:bottom-3">

        <form
          onSubmit={submitMessage}
          className="overflow-hidden rounded-2xl border border-white/[0.1] bg-slate-900/95 shadow-2xl shadow-black/30 backdrop-blur-2xl transition focus-within:border-indigo-400/30 focus-within:shadow-indigo-500/[0.05]"
        >

          {/* INPUT AREA */}
          <div className="flex items-end gap-2 p-2">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(event) => {
                setMessage(
                  event.target.value
                );
                resizeTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message Nodysom AI..."
              rows={1}
              maxLength={
                MAX_MESSAGE_LENGTH
              }
              disabled={isLoading}
              aria-label="Message Nodysom AI"
              className="max-h-[180px] min-h-[46px] flex-1 resize-none overflow-y-auto bg-transparent px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={
                !message.trim() ||
                isLoading
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 transition-all duration-200 hover:from-indigo-500 hover:to-violet-500 active:scale-95 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:shadow-none"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2
                  size={19}
                  className="animate-spin"
                />
              ) : (
                <Send size={19} />
              )}
            </button>
          </div>

          {/* COMPOSER FOOTER */}
          <div className="flex items-center justify-between border-t border-white/[0.05] px-3 py-1.5">

            <div className="flex items-center gap-2 text-[10px] text-slate-600">
              <span className="hidden sm:inline">
                Enter to send
              </span>

              <span className="hidden sm:inline text-slate-700">
                ·
              </span>

              <span className="hidden sm:inline">
                Shift + Enter for new line
              </span>

              <span className="sm:hidden">
                Enter to send
              </span>
            </div>

            <span
              className={`text-[10px] transition-colors ${
                remainingCharacters <
                200
                  ? "text-amber-400"
                  : "text-slate-600"
              }`}
            >
              {message.length}/
              {MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </form>

        <p className="mt-1.5 text-center text-[9px] text-slate-700">
          Nodysom AI can make mistakes. Check
          important information when needed.
        </p>
      </div>
    </section>
  );
}

export default ChatView;
