import React, {
  FormEvent,
  useState,
} from 'react';

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';

import {
  ChatMessage,
  PlannerItem,
} from '../types';

interface HomeViewProps {
  user?: {
    name?: string;
  };

  chatHistory?: ChatMessage[];

  plannerItems?: PlannerItem[];

  onSendMessage?: (
    text: string
  ) => void;

  isLoading?: boolean;

  onOpenVoice?: () => void;

  onToggleTask?: (
    id: string
  ) => void;

  onSelectAction?: (
    action: any
  ) => void;

  onNavigate?: (
    tab: string
  ) => void;
}

/* =========================================================
   AI RESPONSE RENDERER
   ========================================================= */

function renderInlineText(
  text: string
) {
  const parts = text.split(
    /(\*\*[^*]+\*\*|`[^`]+`)/g
  );

  return parts.map(
    (part, index) => {
      if (
        part.startsWith('**') &&
        part.endsWith('**')
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
        part.startsWith('`') &&
        part.endsWith('`')
      ) {
        return (
          <code
            key={index}
            className="rounded-md border border-white/[0.08] bg-slate-950/70 px-1.5 py-0.5 text-[12px] text-indigo-300"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return (
        <React.Fragment key={index}>
          {part}
        </React.Fragment>
      );
    }
  );
}

function renderAssistantContent(
  content: string
) {
  const lines = content
    .replace(/\r/g, '')
    .split('\n');

  const elements: React.ReactNode[] = [];

  let listItems: string[] = [];

  let listType:
    | 'bullet'
    | 'number'
    | null = null;

  let codeLines: string[] = [];

  let inCode = false;

  const flushList = () => {
    if (
      !listItems.length ||
      !listType
    ) {
      return;
    }

    const items = [
      ...listItems,
    ];

    const type = listType;

    if (type === 'number') {
      elements.push(
        <ol
          key={`list-${elements.length}`}
          className="ml-5 list-decimal space-y-2 marker:text-indigo-400"
        >
          {items.map(
            (
              item,
              index
            ) => (
              <li
                key={index}
                className="pl-1 text-slate-300"
              >
                {renderInlineText(
                  item
                )}
              </li>
            )
          )}
        </ol>
      );
    } else {
      elements.push(
        <ul
          key={`list-${elements.length}`}
          className="ml-5 list-disc space-y-2 marker:text-indigo-400"
        >
          {items.map(
            (
              item,
              index
            ) => (
              <li
                key={index}
                className="pl-1 text-slate-300"
              >
                {renderInlineText(
                  item
                )}
              </li>
            )
          )}
        </ul>
      );
    }

    listItems = [];
    listType = null;
  };

  const flushCode = () => {
    if (!codeLines.length) {
      return;
    }

    elements.push(
      <div
        key={`code-${elements.length}`}
        className="overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-950/90"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">
            Code
          </span>

          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
          </span>
        </div>

        <pre className="overflow-x-auto p-4 text-xs leading-6 text-slate-300">
          <code>
            {codeLines.join('\n')}
          </code>
        </pre>
      </div>
    );

    codeLines = [];
  };

  lines.forEach(
    (
      rawLine,
      index
    ) => {
      const line =
        rawLine.trimEnd();

      const trimmed =
        line.trim();

      /* CODE BLOCK */

      if (
        trimmed.startsWith(
          '```'
        )
      ) {
        flushList();

        if (inCode) {
          flushCode();
        }

        inCode = !inCode;

        return;
      }

      if (inCode) {
        codeLines.push(
          line
        );

        return;
      }

      /* EMPTY LINE */

      if (!trimmed) {
        flushList();

        return;
      }

      /* HEADINGS */

      const heading =
        trimmed.match(
          /^(#{1,3})\s+(.+)$/
        );

      if (heading) {
        flushList();

        const level =
          heading[1].length;

        const headingText =
          heading[2]
            .replace(
              /\*\*/g,
              ''
            )
            .replace(
              /__/g,
              ''
            );

        elements.push(
          <div
            key={`heading-${index}`}
            className={
              level === 1
                ? 'pt-2 text-xl font-black tracking-tight text-white'
                : level === 2
                  ? 'pt-2 text-lg font-extrabold text-white'
                  : 'pt-1 text-sm font-bold text-indigo-200'
            }
          >
            {renderInlineText(
              headingText
            )}
          </div>
        );

        return;
      }

      /* BULLET LIST */

      const bullet =
        trimmed.match(
          /^(?:[-*•])\s+(.+)$/
        );

      if (bullet) {
        if (
          listType &&
          listType !==
            'bullet'
        ) {
          flushList();
        }

        listType = 'bullet';

        listItems.push(
          bullet[1]
        );

        return;
      }

      /* NUMBERED LIST */

      const numbered =
        trimmed.match(
          /^\d+[.)]\s+(.+)$/
        );

      if (numbered) {
        if (
          listType &&
          listType !==
            'number'
        ) {
          flushList();
        }

        listType = 'number';

        listItems.push(
          numbered[1]
        );

        return;
      }

      /* QUOTE */

      const quote =
        trimmed.match(
          /^>\s*(.+)$/
        );

      if (quote) {
        flushList();

        elements.push(
          <blockquote
            key={`quote-${index}`}
            className="rounded-r-xl border-l-2 border-indigo-400/50 bg-indigo-500/[0.05] px-4 py-3 text-sm italic leading-6 text-slate-400"
          >
            {renderInlineText(
              quote[1]
            )}
          </blockquote>
        );

        return;
      }

      /* SIMPLE TABLE */

      if (
        trimmed.includes('|') &&
        trimmed
          .split('|')
          .filter(Boolean)
          .length >= 2
      ) {
        const cells =
          trimmed
            .split('|')
            .map(
              (cell) =>
                cell.trim()
            )
            .filter(Boolean);

        const isSeparator =
          cells.every(
            (cell) =>
              /^:?-{2,}:?$/.test(
                cell
              )
          );

        if (!isSeparator) {
          flushList();

          elements.push(
            <div
              key={`table-${index}`}
              className="grid gap-2 border-b border-white/[0.05] py-2"
              style={{
                gridTemplateColumns:
                  `repeat(${cells.length}, minmax(0, 1fr))`,
              }}
            >
              {cells.map(
                (
                  cell,
                  cellIndex
                ) => (
                  <div
                    key={
                      cellIndex
                    }
                    className="min-w-0 break-words text-xs leading-5 text-slate-300"
                  >
                    {renderInlineText(
                      cell
                    )}
                  </div>
                )
              )}
            </div>
          );

          return;
        }
      }

      /* NORMAL PARAGRAPH */

      flushList();

      elements.push(
        <p
          key={`paragraph-${index}`}
          className="whitespace-pre-wrap text-sm leading-7 text-slate-300"
        >
          {renderInlineText(
            trimmed
          )}
        </p>
      );
    }
  );

  flushList();
  flushCode();

  return elements;
}

/* =========================================================
   HOME VIEW
   ========================================================= */

export function HomeView({
  user,
  chatHistory = [],
  plannerItems = [],
  onSendMessage,
  isLoading = false,
  onOpenVoice,
  onToggleTask,
  onSelectAction,
  onNavigate,
}: HomeViewProps) {
  const [message, setMessage] =
    useState('');

  const [
    copiedMessageId,
    setCopiedMessageId,
  ] = useState<
    string | null
  >(null);

  const name =
    user?.name?.trim() ||
    'there';

  /* =======================================================
     SEND MESSAGE
     ======================================================= */

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const cleanMessage =
      message.trim();

    if (
      !cleanMessage ||
      isLoading
    ) {
      return;
    }

    onSendMessage?.(
      cleanMessage
    );

    setMessage('');
  };

  /* =======================================================
     QUICK PROMPT
     ======================================================= */

  const handleQuickPrompt = (
    prompt: string
  ) => {
    if (
      !prompt.trim() ||
      isLoading
    ) {
      return;
    }

    onSendMessage?.(
      prompt.trim()
    );
  };

  /* =======================================================
     COPY AI RESPONSE
     ======================================================= */

  const handleCopy = async (
    item: ChatMessage
  ) => {
    try {
      await navigator.clipboard.writeText(
        item.content
      );

      setCopiedMessageId(
        item.id
      );

      window.setTimeout(
        () => {
          setCopiedMessageId(
            (current) =>
              current ===
              item.id
                ? null
                : current
          );
        },
        1600
      );
    } catch (error) {
      console.warn(
        'Could not copy message:',
        error
      );
    }
  };

  /* =======================================================
     QUICK ACTIONS
     ======================================================= */

  const actions = [
    {
      title: 'Ask Nodysom',
      description:
        'Get intelligent help instantly',
      icon: MessageCircle,
      action: () =>
        onOpenVoice?.(),
      primary: true,
    },
    {
      title: 'Search',
      description:
        'Find verified information',
      icon: Search,
      action: () =>
        onNavigate?.(
          'search'
        ),
    },
    {
      title: 'Learn',
      description:
        'Study smarter every day',
      icon: BookOpen,
      action: () =>
        onNavigate?.(
          'learn'
        ),
    },
    {
      title: 'Planner',
      description:
        'Organize your day',
      icon: CalendarDays,
      action: () =>
        onNavigate?.(
          'planner'
        ),
    },
  ];

  /* =======================================================
     RECENT MESSAGES
     ======================================================= */

  const recentMessages =
    chatHistory.slice(-6);

  /* =======================================================
     TODAY TASKS
     ======================================================= */

  const todayTasks =
    plannerItems
      .filter(
        (item) =>
          item.date ===
          new Date()
            .toISOString()
            .split('T')[0]
      )
      .slice(0, 4);

  return (
    <main className="nodysom-fade-up mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:px-8">

      {/* =================================================
          HERO
          ================================================= */}

      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-indigo-500/[0.16] via-violet-500/[0.08] to-transparent p-5 shadow-2xl shadow-indigo-950/20 sm:p-8">

        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative">

          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-300">
            <Sparkles size={13} />
            Personal AI Assistant
          </div>

          <h2 className="max-w-2xl text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
            Welcome back,

            <span className="block bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              {name}.
            </span>
          </h2>

          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Ask questions, learn new
            things, plan your day,
            and get things done with
            Nodysom AI.
          </p>

          {/* AI INPUT */}

          <form
            onSubmit={
              handleSubmit
            }
            className="mt-7 max-w-2xl"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-white/[0.10] bg-slate-950/60 p-2 shadow-xl backdrop-blur-xl">

              <MessageCircle
                size={18}
                className="ml-2 shrink-0 text-indigo-300"
              />

              <input
                type="text"
                value={message}
                onChange={(
                  event
                ) =>
                  setMessage(
                    event.target
                      .value
                  )
                }
                placeholder={
                  isLoading
                    ? 'Nodysom is thinking...'
                    : 'Ask Nodysom anything...'
                }
                disabled={
                  isLoading
                }
                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-slate-600 disabled:cursor-not-allowed"
              />

              <button
                type="submit"
                disabled={
                  isLoading ||
                  !message.trim()
                }
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
              >
                {isLoading ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Send
                    size={17}
                  />
                )}
              </button>
            </div>
          </form>

          {/* QUICK PROMPTS */}

          <div className="mt-3 flex flex-wrap gap-2">

            {[
              'Help me plan my day',
              'Explain something to me',
              'Give me useful ideas',
            ].map(
              (prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={
                    isLoading
                  }
                  onClick={() =>
                    handleQuickPrompt(
                      prompt
                    )
                  }
                  className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[10px] font-semibold text-slate-400 transition hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {prompt}
                </button>
              )
            )}

          </div>

          {/* MAIN ACTIONS */}

          <div className="mt-7 flex flex-wrap gap-3">

            <button
              type="button"
              onClick={
                onOpenVoice
              }
              className="nodysom-btn nodysom-btn-primary group"
            >
              <MessageCircle
                size={17}
              />

              <span>
                Start with Nodysom
              </span>

              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>

            <button
              type="button"
              onClick={() =>
                onNavigate?.(
                  'learn'
                )
              }
              className="nodysom-btn nodysom-btn-secondary"
            >
              <BookOpen
                size={16}
              />

              Explore Learning
            </button>

          </div>
        </div>
      </section>

      {/* =================================================
          AI CONVERSATION
          ================================================= */}

      {(recentMessages.length >
        0 ||
        isLoading) && (
        <section className="mt-7">

          <div className="mb-4 flex items-end justify-between">

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-400">
                AI conversation
              </p>

              <h3 className="mt-1 nodysom-section-title">
                Your conversation
                with Nodysom
              </h3>
            </div>

            <span className="rounded-full border border-indigo-400/15 bg-indigo-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-indigo-300">
              {isLoading
                ? 'Thinking'
                : 'Ready'}
            </span>

          </div>

          <div className="space-y-3">

            {recentMessages.map(
              (item) => {
                const isUser =
                  item.role ===
                  'user';

                return (
                  <div
                    key={item.id}
                    className={
                      isUser
                        ? 'flex justify-end'
                        : 'flex justify-start'
                    }
                  >

                    <div
                      className={
                        isUser
                          ? 'w-[92%] max-w-2xl rounded-[22px] rounded-br-md border border-indigo-400/15 bg-indigo-500/[0.10] px-4 py-3.5 sm:w-[82%]'
                          : 'w-full max-w-3xl rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-4 shadow-lg shadow-black/10 sm:p-5'
                      }
                    >

                      <div className="flex items-start gap-3">

                        {/* AVATAR */}

                        <div
                          className={
                            isUser
                              ? 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300'
                              : 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-300 ring-1 ring-indigo-400/10'
                          }
                        >
                          {isUser ? (
                            <MessageCircle
                              size={14}
                            />
                          ) : (
                            <Sparkles
                              size={14}
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">

                          {/* HEADER */}

                          <div className="flex items-center justify-between gap-3">

                            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                              {isUser
                                ? 'You'
                                : 'Nodysom AI'}
                            </p>

                            {!isUser && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(
                                    item
                                  )
                                }
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[9px] font-semibold text-slate-500 transition hover:border-indigo-400/20 hover:bg-indigo-500/10 hover:text-indigo-300"
                                aria-label="Copy AI response"
                              >
                                {copiedMessageId ===
                                item.id ? (
                                  <>
                                    <Check
                                      size={
                                        11
                                      }
                                    />

                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy
                                      size={
                                        11
                                      }
                                    />

                                    Copy
                                  </>
                                )}
                              </button>
                            )}

                          </div>

                          {/* MESSAGE */}

                          {isUser ? (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-indigo-50">
                              {
                                item.content
                              }
                            </p>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {renderAssistantContent(
                                item.content
                              )}
                            </div>
                          )}

                          {/* TIME */}

                          <p className="mt-3 text-[9px] font-medium text-slate-600">
                            {
                              item.timestamp
                            }
                          </p>

                        </div>

                      </div>
                    </div>
                  </div>
                );
              }
            )}

            {/* THINKING */}

            {isLoading && (
              <div className="flex justify-start">

                <div className="w-full max-w-3xl rounded-[24px] border border-indigo-400/10 bg-indigo-500/[0.045] p-4 sm:p-5">

                  <div className="flex items-center gap-3">

                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                      <Sparkles
                        size={14}
                        className="animate-pulse"
                      />
                    </div>

                    <div>

                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-indigo-300">
                        Nodysom AI
                      </p>

                      <div className="mt-2 flex items-center gap-1.5">

                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />

                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:120ms]" />

                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:240ms]" />

                        <span className="ml-1 text-[11px] text-slate-500">
                          Thinking...
                        </span>

                      </div>

                    </div>

                  </div>

                </div>

              </div>
            )}

          </div>
        </section>
      )}

      {/* =================================================
          QUICK ACTIONS
          ================================================= */}

      <section className="mt-7">

        <div className="mb-4 flex items-end justify-between">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-400">
              Quick access
            </p>

            <h3 className="mt-1 nodysom-section-title">
              What do you want
              to do?
            </h3>
          </div>

        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

          {actions.map(
            (item) => {
              const Icon =
                item.icon;

              return (
                <button
                  key={
                    item.title
                  }
                  type="button"
                  onClick={
                    item.action
                  }
                  className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
                    item.primary
                      ? 'border-indigo-400/20 bg-indigo-500/[0.10] hover:border-indigo-400/35 hover:bg-indigo-500/[0.15]'
                      : 'border-white/[0.07] bg-white/[0.035] hover:border-white/[0.13] hover:bg-white/[0.06]'
                  }`}
                >

                  <div className="mb-5 flex items-center justify-between">

                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        item.primary
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : 'bg-white/[0.06] text-slate-300'
                      }`}
                    >
                      <Icon
                        size={18}
                      />
                    </span>

                    <ArrowRight
                      size={15}
                      className="text-slate-600 transition-all duration-200 group-hover:translate-x-1 group-hover:text-indigo-300"
                    />

                  </div>

                  <h4 className="text-sm font-bold text-white">
                    {
                      item.title
                    }
                  </h4>

                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    {
                      item.description
                    }
                  </p>

                </button>
              );
            }
          )}

        </div>
      </section>

      {/* =================================================
          DAILY FOCUS
          ================================================= */}

      <section className="mt-7 grid gap-4 lg:grid-cols-3">

        <div className="nodysom-card p-5 lg:col-span-2">

          <div className="flex items-start justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                <Target
                  size={20}
                />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Daily focus
                </p>

                <h3 className="mt-1 text-base font-extrabold text-white">
                  Make today
                  productive
                </h3>
              </div>

            </div>

            <span className="nodysom-badge nodysom-badge-success">
              Ready
            </span>

          </div>

          <div className="mt-6 space-y-3">

            {todayTasks.length >
            0 ? (
              todayTasks.map(
                (task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() =>
                      onToggleTask?.(
                        task.id
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-3 text-left transition hover:bg-white/[0.05]"
                  >

                    <CheckCircle2
                      size={17}
                      className={
                        task.completed
                          ? 'text-emerald-400'
                          : 'text-slate-600'
                      }
                    />

                    <span
                      className={`text-xs font-medium ${
                        task.completed
                          ? 'text-slate-500 line-through'
                          : 'text-slate-300'
                      }`}
                    >
                      {
                        task.title
                      }
                    </span>

                  </button>
                )
              )
            ) : (
              [
                'Review your priorities',
                'Complete one important task',
                'Spend time learning something new',
              ].map(
                (
                  task,
                  index
                ) => (
                  <div
                    key={task}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-3"
                  >

                    <CheckCircle2
                      size={17}
                      className={
                        index ===
                        0
                          ? 'text-emerald-400'
                          : 'text-slate-600'
                      }
                    />

                    <span className="text-xs font-medium text-slate-300">
                      {task}
                    </span>

                  </div>
                )
              )
            )}

          </div>

          <button
            type="button"
            onClick={() =>
              onNavigate?.(
                'planner'
              )
            }
            className="mt-5 flex items-center gap-2 text-[11px] font-bold text-indigo-300 transition hover:text-white"
          >
            Open Planner

            <ArrowRight
              size={14}
            />
          </button>

        </div>

        {/* AI STATUS */}

        <div className="relative overflow-hidden rounded-[22px] border border-indigo-400/15 bg-indigo-500/[0.07] p-5">

          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-indigo-500/15 blur-3xl" />

          <div className="relative">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
              <Zap
                size={19}
                className="text-white"
              />
            </div>

            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-300">
              Nodysom AI
            </p>

            <h3 className="mt-2 text-lg font-extrabold text-white">
              {isLoading
                ? 'Thinking...'
                : 'Your AI is ready.'}
            </h3>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Ask anything, get
              help with your plans,
              or continue learning.
            </p>

            <button
              type="button"
              onClick={
                onOpenVoice
              }
              disabled={
                isLoading
              }
              className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/20 bg-indigo-500/10 text-xs font-bold text-indigo-200 transition-all hover:bg-indigo-500/20 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircle
                size={15}
              />

              Talk to Nodysom
            </button>

          </div>
        </div>

      </section>

      {/* =================================================
          FOOTER STATUS
          ================================================= */}

      <div className="mt-7 flex items-center justify-center gap-2 text-[10px] font-medium text-slate-600">

        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

        Nodysom AI is ready
        to assist you

      </div>

    </main>
  );
}
