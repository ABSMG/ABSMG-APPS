import React, {
  FormEvent,
  useState,
} from 'react';

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
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

  const name =
    user?.name?.trim() ||
    'there';

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

    if (onSendMessage) {
      onSendMessage(
        cleanMessage
      );

      setMessage('');
    }
  };

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
        onNavigate?.('search'),
    },
    {
      title: 'Learn',
      description:
        'Study smarter every day',
      icon: BookOpen,
      action: () =>
        onNavigate?.('learn'),
    },
    {
      title: 'Planner',
      description:
        'Organize your day',
      icon: CalendarDays,
      action: () =>
        onNavigate?.('planner'),
    },
  ];

  const recentMessages =
    chatHistory.slice(-4);

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

      {/* HERO */}
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
            Ask questions, learn new things,
            plan your day, and get things done
            with Nodysom AI.
          </p>

          {/* AI INPUT */}
          <form
            onSubmit={handleSubmit}
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
                onChange={(event) =>
                  setMessage(
                    event.target.value
                  )
                }
                placeholder={
                  isLoading
                    ? 'Nodysom is thinking...'
                    : 'Ask Nodysom anything...'
                }
                disabled={isLoading}
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
                  <Send size={17} />
                )}
              </button>
            </div>
          </form>

          {/* QUICK AI PROMPTS */}
          <div className="mt-3 flex flex-wrap gap-2">

            {[
              'Help me plan my day',
              'Explain something to me',
              'Give me useful ideas',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isLoading}
                onClick={() =>
                  handleQuickPrompt(
                    prompt
                  )
                }
                className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[10px] font-semibold text-slate-400 transition hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {prompt}
              </button>
            ))}

          </div>

          {/* MAIN ACTIONS */}
          <div className="mt-7 flex flex-wrap gap-3">

            <button
              type="button"
              onClick={onOpenVoice}
              className="nodysom-btn nodysom-btn-primary group"
            >
              <MessageCircle size={17} />

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
                onNavigate?.('learn')
              }
              className="nodysom-btn nodysom-btn-secondary"
            >
              <BookOpen size={16} />

              Explore Learning
            </button>

          </div>
        </div>
      </section>

      {/* RECENT AI CONVERSATION */}
      {recentMessages.length > 0 && (
        <section className="mt-7">

          <div className="mb-4 flex items-center justify-between">

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-400">
                Recent activity
              </p>

              <h3 className="mt-1 nodysom-section-title">
                Continue with Nodysom
              </h3>
            </div>

            <button
              type="button"
              onClick={() =>
                handleQuickPrompt(
                  'Continue our conversation and help me with my next step.'
                )
              }
              disabled={isLoading}
              className="text-[10px] font-bold text-indigo-300 transition hover:text-white disabled:opacity-40"
            >
              Continue
            </button>

          </div>

          <div className="space-y-2">

            {recentMessages.map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    item.role ===
                    'user'
                      ? handleQuickPrompt(
                          item.content
                        )
                      : undefined
                  }
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    item.role ===
                    'user'
                      ? 'border-indigo-400/10 bg-indigo-500/[0.06] hover:bg-indigo-500/[0.10]'
                      : 'border-white/[0.06] bg-white/[0.025]'
                  }`}
                >

                  <div className="flex items-start gap-3">

                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                      {item.role ===
                      'user' ? (
                        <MessageCircle
                          size={14}
                          className="text-indigo-300"
                        />
                      ) : (
                        <Sparkles
                          size={14}
                          className="text-violet-300"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">

                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        {item.role ===
                        'user'
                          ? 'You'
                          : 'Nodysom AI'}
                      </p>

                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">
                        {item.content}
                      </p>

                    </div>

                  </div>

                </button>
              )
            )}

          </div>
        </section>
      )}

      {/* QUICK ACTIONS */}
      <section className="mt-7">

        <div className="mb-4 flex items-end justify-between">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-400">
              Quick access
            </p>

            <h3 className="mt-1 nodysom-section-title">
              What do you want to do?
            </h3>
          </div>

        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

          {actions.map((item) => {
            const Icon =
              item.icon;

            return (
              <button
                key={item.title}
                type="button"
                onClick={item.action}
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
                    <Icon size={18} />
                  </span>

                  <ArrowRight
                    size={15}
                    className="text-slate-600 transition-all duration-200 group-hover:translate-x-1 group-hover:text-indigo-300"
                  />

                </div>

                <h4 className="text-sm font-bold text-white">
                  {item.title}
                </h4>

                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {item.description}
                </p>

              </button>
            );
          })}

        </div>
      </section>

      {/* DAILY FOCUS */}
      <section className="mt-7 grid gap-4 lg:grid-cols-3">

        <div className="nodysom-card p-5 lg:col-span-2">

          <div className="flex items-start justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                <Target size={20} />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Daily focus
                </p>

                <h3 className="mt-1 text-base font-extrabold text-white">
                  Make today productive
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
                      {task.title}
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
                (task, index) => (
                  <div
                    key={task}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-3"
                  >
                    <CheckCircle2
                      size={17}
                      className={
                        index === 0
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
              onNavigate?.('planner')
            }
            className="mt-5 flex items-center gap-2 text-[11px] font-bold text-indigo-300 transition hover:text-white"
          >
            Open Planner
            <ArrowRight size={14} />
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
              Ask anything, get help with
              your plans, or continue
              learning.
            </p>

            <button
              type="button"
              onClick={
                onOpenVoice
              }
              disabled={isLoading}
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

      {/* FOOTER STATUS */}
      <div className="mt-7 flex items-center justify-center gap-2 text-[10px] font-medium text-slate-600">

        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

        Nodysom AI is ready to assist you

      </div>

    </main>
  );
}
