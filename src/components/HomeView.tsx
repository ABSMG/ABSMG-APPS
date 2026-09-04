import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Mic,
  Send,
  Sparkles,
  Tag,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

import {
  UserProfile,
  ChatMessage,
  PlannerItem,
  SmartAction,
} from '../types';

import { SUGGESTED_ACTIONS } from '../data/mockAndDefaults';
import { speechService } from '../lib/speech';
import { getTagBadgeStyle } from './PlannerView';

interface HomeViewProps {
  user: UserProfile;
  chatHistory: ChatMessage[];
  plannerItems: PlannerItem[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  onOpenVoice: () => void;
  onToggleTask: (taskId: string) => void;
  onSelectAction: (action: SmartAction) => void;
  onNavigateTab: (tab: any) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  chatHistory,
  plannerItems,
  onSendMessage,
  isLoading,
  onOpenVoice,
  onToggleTask,
  onSelectAction,
  onNavigateTab,
}) => {
  const [inputText, setInputText] = useState('');
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';

    return 'Good evening';
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const todayTasks = plannerItems
    .filter((item) => !item.date || item.date === todayStr)
    .slice(0, 4);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const query = inputText.trim();

    if (!query || isLoading) return;

    setInputText('');

    await onSendMessage(query);
  };

  const handleSpeak = (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      speechService.stopSpeaking();
      setSpeakingMsgId(null);
      return;
    }

    setSpeakingMsgId(msgId);

    speechService.speak(
      text,
      'en-US',
      () => setSpeakingMsgId(null)
    );
  };

  useEffect(() => {
    if (chatHistory.length > 0) {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
      });
    }
  }, [chatHistory, isLoading]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">

      {/* HERO */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-7">

        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative">

          <div className="mb-4 flex items-center justify-between gap-3">

            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20">
                <Sparkles className="h-5 w-5 text-indigo-400" />
              </div>

              <div>
                <p className="text-xs font-semibold text-indigo-300">
                  {getGreeting()}
                </p>

                <p className="text-sm font-bold text-white">
                  {user.name || 'Friend'}
                </p>
              </div>
            </div>

            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-slate-400">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </div>

          </div>

          <h1 className="max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
            What can I help you with today?
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Ask questions, plan your day, learn something new,
            translate text or search for information.
          </p>

          {/* AI INPUT */}
          <form
            onSubmit={handleSubmit}
            className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-2 backdrop-blur-xl focus-within:border-indigo-500/60"
          >

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={3}
              placeholder="Ask ABSMG AI anything..."
              className="w-full resize-none bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">

              <div className="flex items-center gap-1">

                <button
                  type="button"
                  onClick={onOpenVoice}
                  className="flex h-10 items-center gap-2 rounded-xl bg-white/5 px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95"
                >
                  <Mic className="h-4 w-4 text-indigo-400" />
                  <span className="hidden sm:inline">
                    Voice
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab('search')}
                  className="hidden h-10 rounded-xl px-3 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white sm:block"
                >
                  Search
                </button>

              </div>

              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <span>Ask AI</span>
                    <Send className="h-4 w-4" />
                  </>
                )}
              </button>

            </div>
          </form>

        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="mt-7">

        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Quick Actions
            </p>

            <h2 className="mt-1 text-lg font-bold text-white">
              Start something useful
            </h2>
          </div>

          <Zap className="h-5 w-5 text-indigo-400" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">

          {SUGGESTED_ACTIONS.map((item) => (
            <button
              key={item.label}
              onClick={() => onSendMessage(item.prompt)}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-500/40 hover:bg-slate-900 active:scale-[0.98]"
            >

              <div className="mb-4 flex items-center justify-between">

                <span className="rounded-lg bg-indigo-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-indigo-400">
                  {item.badge}
                </span>

                <ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-indigo-400" />

              </div>

              <p className="text-sm font-bold text-slate-100">
                {item.label}
              </p>

              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">
                {item.prompt}
              </p>

            </button>
          ))}

        </div>

      </section>

      {/* CONVERSATION */}
      {chatHistory.length > 0 && (
        <section className="mt-8">

          <div className="mb-3 flex items-center justify-between">

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                AI Conversation
              </p>

              <h2 className="mt-1 text-lg font-bold text-white">
                Recent activity
              </h2>
            </div>

            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-500">
              {chatHistory.length} messages
            </span>

          </div>

          <div className="space-y-3">

            {chatHistory.slice(-6).map((msg) => {

              const isAssistant = msg.role === 'assistant';

              return (
                <article
                  key={msg.id}
                  className={`rounded-2xl border p-4 ${
                    isAssistant
                      ? 'border-white/10 bg-slate-900/80'
                      : 'ml-4 border-indigo-500/20 bg-indigo-950/30 sm:ml-12'
                  }`}
                >

                  <div className="mb-3 flex items-center justify-between">

                    <div className="flex items-center gap-2">

                      {isAssistant ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15">
                          <Sparkles className="h-4 w-4 text-indigo-400" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-white">
                          You
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-bold text-slate-200">
                          {isAssistant ? 'ABSMG AI' : 'You'}
                        </p>

                        <p className="text-[9px] text-slate-500">
                          {msg.timestamp}
                        </p>
                      </div>

                    </div>

                    {isAssistant && (
                      <button
                        onClick={() =>
                          handleSpeak(msg.id, msg.content)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                      >
                        {speakingMsgId === msg.id ? (
                          <VolumeX className="h-4 w-4 text-rose-400" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </button>
                    )}

                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                    {msg.content}
                  </p>

                  {/* SMART ACTION */}
                  {msg.detectedAction && (
                    <div className="mt-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-3">

                      <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15">
                          <CheckCircle2 className="h-5 w-5 text-indigo-400" />
                        </div>

                        <div className="min-w-0 flex-1">

                          <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-400">
                            Action detected
                          </p>

                          <p className="mt-1 truncate text-xs font-bold text-white">
                            {msg.detectedAction.type}:{' '}
                            {msg.detectedAction.title}
                          </p>

                          {msg.detectedAction.time && (
                            <p className="mt-1 text-[10px] text-slate-500">
                              {msg.detectedAction.date || 'Today'} ·{' '}
                              {msg.detectedAction.time}
                            </p>
                          )}

                        </div>

                        <button
                          onClick={() =>
                            onSelectAction(msg.detectedAction!)
                          }
                          className="rounded-xl bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-indigo-500 active:scale-95"
                        >
                          Confirm
                        </button>

                      </div>

                    </div>
                  )}

                </article>
              );
            })}

            <div ref={messagesEndRef} />

          </div>

        </section>
      )}

      {/* TODAY'S PLAN */}
      <section className="mt-8">

        <div className="mb-3 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10">
              <Calendar className="h-5 w-5 text-indigo-400" />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Planner
              </p>

              <h2 className="mt-0.5 text-lg font-bold text-white">
                Today's plan
              </h2>
            </div>

          </div>

          <button
            onClick={() => onNavigateTab('planner')}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

        </div>

        {todayTasks.length === 0 ? (

          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-6 text-center">

            <Calendar className="mx-auto h-8 w-8 text-slate-600" />

            <p className="mt-3 text-sm font-semibold text-slate-300">
              Nothing planned yet
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Let ABSMG AI organize your day.
            </p>

            <button
              onClick={() =>
                onSendMessage(
                  'Create a balanced schedule for today'
                )
              }
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-500"
            >
              Create my plan
            </button>

          </div>

        ) : (

          <div className="space-y-2">

            {todayTasks.map((task) => (

              <div
                key={task.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-3 transition hover:border-white/20"
              >

                <button
                  onClick={() => onToggleTask(task.id)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition ${
                    task.completed
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                      : 'border-slate-700 bg-slate-950 text-transparent hover:border-indigo-500'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>

                <div className="min-w-0 flex-1">

                  <p
                    className={`truncate text-sm font-semibold ${
                      task.completed
                        ? 'text-slate-500 line-through'
                        : 'text-slate-200'
                    }`}
                  >
                    {task.title}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-2">

                    {task.time && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock className="h-3 w-3" />
                        {task.time}
                      </span>
                    )}

                    {(task.tags?.length
                      ? task.tags
                      : task.category
                        ? [task.category]
                        : []
                    ).map((tag) => (

                      <span
                        key={tag}
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${getTagBadgeStyle(
                          tag
                        )}`}
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </span>

                    ))}

                  </div>

                </div>

                <span
                  className={`rounded-lg px-2 py-1 text-[9px] font-bold uppercase ${
                    task.priority === 'high'
                      ? 'bg-rose-500/10 text-rose-400'
                      : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {task.priority}
                </span>

              </div>

            ))}

          </div>

        )}

      </section>

    </main>
  );
};
