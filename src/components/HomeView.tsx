import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Mic,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Volume2,
  VolumeX,
  Share2,
  Bookmark,
  Zap,
  Tag,
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
    if (e) e.preventDefault();
    const query = inputText.trim();
    if (!query || isLoading) return;
    setInputText('');
    await onSendMessage(query);
  };

  const handleSpeak = (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      speechService.stopSpeaking();
      setSpeakingMsgId(null);
    } else {
      setSpeakingMsgId(msgId);
      speechService.speak(text, 'en-US', () => setSpeakingMsgId(null));
    }
  };

  // Auto-scroll chat when history updates
  useEffect(() => {
    if (chatHistory.length > 2) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isLoading]);

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto px-4 pt-3">
      {/* 1. Header Greeting & Intent Prompt */}
      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            {getGreeting()}, {user.name || 'Friend'}
          </span>
          <span className="text-[11px] text-slate-400">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          What do you want to do?
        </h1>
        <p className="text-xs text-slate-400">
          Tell LifeOS what you need in natural language or voice.
        </p>
      </section>

      {/* 2. Large Central AI Input Box */}
      <section className="relative">
        <form
          onSubmit={handleSubmit}
          className="relative bg-slate-900 border border-slate-750 focus-within:border-indigo-500/80 rounded-2xl p-2 shadow-xl shadow-black/40 transition-all"
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
            placeholder="Ask anything, plan a schedule, create a budget, or translate..."
            rows={2}
            className="w-full bg-transparent px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none font-sans"
          />

          <div className="flex items-center justify-between pt-1 px-2 border-t border-slate-800/60">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenVoice}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Speak to LifeOS"
              >
                <Mic className="w-4 h-4" />
                <span className="text-[11px] hidden xs:inline">Voice</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('search')}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors"
                title="Universal Search Mode"
              >
                Universal Search
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="p-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 active:scale-95"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* 3. Suggested Action Chips */}
      <section className="space-y-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
          Suggested Actions
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SUGGESTED_ACTIONS.map((item) => (
            <button
              key={item.label}
              onClick={() => onSendMessage(item.prompt)}
              className="text-left p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 hover:border-indigo-500/40 hover:bg-slate-850 transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  {item.badge}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs font-semibold text-slate-200 group-hover:text-white line-clamp-1">
                {item.label}
              </p>
              <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                {item.prompt}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Active Conversation / Assistant Feed */}
      {chatHistory.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Recent Activity & Conversation
            </span>
            <span className="text-[11px] text-slate-400">
              {chatHistory.length} messages
            </span>
          </div>

          <div className="space-y-3">
            {chatHistory.slice(-6).map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-2xl border text-xs leading-relaxed transition-all ${
                    isAssistant
                      ? 'bg-slate-900/90 border-slate-800 text-slate-200'
                      : 'bg-indigo-950/40 border-indigo-500/20 text-indigo-100 ml-6'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      {isAssistant ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          LifeOS Assistant
                        </>
                      ) : (
                        'You'
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span>{msg.timestamp}</span>
                      {isAssistant && (
                        <button
                          onClick={() => handleSpeak(msg.id, msg.content)}
                          className="p-1 text-slate-400 hover:text-slate-200"
                          title="Listen to response"
                        >
                          {speakingMsgId === msg.id ? (
                            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap font-sans text-xs text-slate-200">
                    {msg.content}
                  </p>

                  {/* Smart Action Detected Card */}
                  {msg.detectedAction && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-indigo-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-indigo-300 block">
                            Structured Action Detected
                          </span>
                          <span className="text-xs font-semibold text-slate-100">
                            {msg.detectedAction.type}: {msg.detectedAction.title}
                          </span>
                          {msg.detectedAction.time && (
                            <span className="text-[10px] text-slate-400 block">
                              Scheduled for {msg.detectedAction.date || 'Today'} at {msg.detectedAction.time}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => onSelectAction(msg.detectedAction!)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all active:scale-95"
                      >
                        Confirm
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </section>
      )}

      {/* 5. Today's Agenda & Planner Snapshot */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-200">
              Today's Daily Plan
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('planner')}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            Open Planner <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {todayTasks.length === 0 ? (
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center">
            <p className="text-xs text-slate-400">
              No tasks scheduled for today.
            </p>
            <button
              onClick={() => onSendMessage('Create a balanced study and task schedule for today')}
              className="mt-2 text-xs text-indigo-400 hover:underline font-medium"
            >
              Ask LifeOS to generate a schedule →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between group hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => onToggleTask(task.id)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      task.completed
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'border-slate-700 hover:border-slate-500 bg-slate-950'
                    }`}
                  >
                    {task.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-medium truncate ${
                        task.completed
                          ? 'line-through text-slate-500'
                          : 'text-slate-200'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 flex-wrap">
                      {task.time && (
                        <span className="flex items-center gap-1 font-mono mr-1">
                          <Clock className="w-3 h-3" /> {task.time}
                        </span>
                      )}
                      {(task.tags && task.tags.length > 0 ? task.tags : (task.category ? [task.category] : [])).map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold border ${getTagBadgeStyle(tag)}`}
                        >
                          <Tag className="w-2 h-2 opacity-70" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    task.priority === 'high'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
