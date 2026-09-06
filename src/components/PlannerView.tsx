import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Flame,
  Sparkles,
  Tag,
  ArrowRight,
  ListTodo,
  Check,
  X,
  Trash2,
  RefreshCw,
  Target,
  Zap,
} from 'lucide-react';

import {
  PlannerItem,
  HabitItem,
  ScheduleBlock,
} from '../types';

export const PRESET_TAGS = [
  'Work',
  'Personal',
  'Urgent',
  'Study',
  'Health',
  'Finance',
];

export const getTagBadgeStyle = (tag: string) => {
  const lower = tag.toLowerCase();

  if (lower === 'urgent') {
    return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  }

  if (lower === 'work') {
    return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  }

  if (lower === 'personal' || lower === 'family') {
    return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
  }

  if (lower === 'study' || lower === 'learning') {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }

  if (
    lower === 'health' ||
    lower === 'wellness' ||
    lower === 'fitness'
  ) {
    return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
  }

  if (lower === 'finance' || lower === 'budget') {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }

  return 'bg-slate-800 text-slate-300 border-slate-700';
};

interface PlannerViewProps {
  plannerItems: PlannerItem[];
  habits: HabitItem[];
  onToggleTask: (id: string) => void;
  onAddTask: (item: Omit<PlannerItem, 'id'>) => void;
  onToggleHabit: (id: string) => void;
}

const DEFAULT_SCHEDULE: ScheduleBlock[] = [
  {
    time: '08:00 AM - 09:00 AM',
    title: 'Morning Focus & Planning',
    category: 'Study',
    durationMinutes: 60,
  },
  {
    time: '09:00 AM - 12:00 PM',
    title: 'Deep Work & Projects',
    category: 'Work',
    durationMinutes: 180,
  },
  {
    time: '12:00 PM - 01:00 PM',
    title: 'Lunch & Break',
    category: 'Health',
    durationMinutes: 60,
  },
  {
    time: '01:00 PM - 04:00 PM',
    title: 'Classes, Meetings & Tasks',
    category: 'Work',
    durationMinutes: 180,
  },
  {
    time: '04:30 PM - 05:30 PM',
    title: 'Wellness & Exercise',
    category: 'Health',
    durationMinutes: 60,
  },
  {
    time: '07:00 PM - 08:30 PM',
    title: 'Language Practice & Review',
    category: 'Study',
    durationMinutes: 90,
  },
];

export const PlannerView: React.FC<PlannerViewProps> = ({
  plannerItems,
  habits,
  onToggleTask,
  onAddTask,
  onToggleHabit,
}) => {
  const [activeTab, setActiveTab] = useState<
    'schedule' | 'tasks' | 'habits'
  >('schedule');

  const [isGenerating, setIsGenerating] = useState(false);
  const [schedulePrompt, setSchedulePrompt] = useState('');
  const [generatedSchedule, setGeneratedSchedule] =
    useState<ScheduleBlock[]>(DEFAULT_SCHEDULE);

  const [selectedFilterTag, setSelectedFilterTag] =
    useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] =
    useState<'task' | 'reminder'>('task');

  const [newTime, setNewTime] = useState('09:00 AM');

  const [newPriority, setNewPriority] =
    useState<'low' | 'normal' | 'high'>('normal');

  const [selectedTags, setSelectedTags] =
    useState<string[]>(['Work']);

  const [customTagInput, setCustomTagInput] = useState('');

  const today = new Date();

  const formattedDate = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const todayISO = today.toISOString().split('T')[0];

  /* -----------------------------
     AI SMART SCHEDULER
  ----------------------------- */

  const handleGenerateSchedule = async () => {
    if (!schedulePrompt.trim() || isGenerating) return;

    setIsGenerating(true);

    try {
      const response = await fetch('/api/ai/smart-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: schedulePrompt.trim(),
          date: todayISO,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (
        Array.isArray(data?.schedule) &&
        data.schedule.length > 0
      ) {
        setGeneratedSchedule(data.schedule);
      }
    } catch (error) {
      console.error(
        'Nodysom AI schedule generation failed:',
        error
      );
    } finally {
      setIsGenerating(false);
    }
  };

  /* -----------------------------
     TAGS
  ----------------------------- */

  const handleTogglePresetTag = (tag: string) => {
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }

      return [...current, tag];
    });
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();

    if (!trimmed) return;

    setSelectedTags((current) => {
      const exists = current.some(
        (tag) =>
          tag.toLowerCase() === trimmed.toLowerCase()
      );

      return exists ? current : [...current, trimmed];
    });

    setCustomTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags((current) =>
      current.filter((item) => item !== tag)
    );
  };

  /* -----------------------------
     CREATE TASK / REMINDER
  ----------------------------- */

  const handleCreateTask = (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const title = newTitle.trim();

    if (!title) return;

    const finalTags = [...selectedTags];

    if (customTagInput.trim()) {
      const extra = customTagInput.trim();

      if (
        !finalTags.some(
          (tag) =>
            tag.toLowerCase() === extra.toLowerCase()
        )
      ) {
        finalTags.push(extra);
      }
    }

    const primaryCategory =
      finalTags[0] || 'General';

    onAddTask({
      title,
      type: newType,
      date: todayISO,
      time: newTime,
      completed: false,
      priority: newPriority,
      category: primaryCategory,
      tags:
        finalTags.length > 0
          ? finalTags
          : [primaryCategory],
    });

    setNewTitle('');
    setNewType('task');
    setNewTime('09:00 AM');
    setNewPriority('normal');
    setSelectedTags(['Work']);
    setCustomTagInput('');
    setShowAddModal(false);
  };

  /* -----------------------------
     TAG FILTER
  ----------------------------- */

  const allAvailableTags = useMemo(() => {
    const tagSet = new Set<string>();

    PRESET_TAGS.forEach((tag) =>
      tagSet.add(tag)
    );

    plannerItems.forEach((item) => {
      if (item.category) {
        tagSet.add(item.category);
      }

      if (item.tags) {
        item.tags.forEach((tag) =>
          tagSet.add(tag)
        );
      }
    });

    return Array.from(tagSet);
  }, [plannerItems]);

  const filteredTasks = useMemo(() => {
    if (!selectedFilterTag) {
      return plannerItems;
    }

    const filter =
      selectedFilterTag.toLowerCase();

    return plannerItems.filter((item) => {
      const tags =
        item.tags && item.tags.length > 0
          ? item.tags
          : item.category
            ? [item.category]
            : [];

      return (
        tags.some(
          (tag) =>
            tag.toLowerCase() === filter
        ) ||
        item.category?.toLowerCase() === filter
      );
    });
  }, [plannerItems, selectedFilterTag]);

  /* -----------------------------
     TASK STATS
  ----------------------------- */

  const completedTasks = plannerItems.filter(
    (item) => item.completed
  ).length;

  const pendingTasks =
    plannerItems.length - completedTasks;

  const completionRate =
    plannerItems.length > 0
      ? Math.round(
          (completedTasks /
            plannerItems.length) *
            100
        )
      : 0;

  const habitStreak = habits.reduce(
    (max, habit) =>
      Math.max(max, habit.streak || 0),
    0
  );

  const completedHabits = habits.filter(
    (habit) => habit.completedToday
  ).length;

  /* -----------------------------
     RENDER
  ----------------------------- */

  return (
    <div className="min-h-full max-w-3xl mx-auto px-4 pt-4 pb-28 space-y-6">

      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-slate-950 via-indigo-950/60 to-slate-950 p-5 shadow-2xl">

        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative">

          <div className="flex items-center justify-between gap-3">

            <div className="flex items-center gap-2">

              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/15">
                <Calendar className="h-5 w-5 text-indigo-400" />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-400">
                  Nodysom Planner
                </p>

                <p className="text-xs text-slate-400">
                  {formattedDate}
                </p>
              </div>

            </div>

            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
              {completionRate}% complete
            </div>

          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
            Plan your day.
          </h1>

          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
            Organize tasks, build habits and let Nodysom AI help structure your time.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">

            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
              <p className="text-lg font-bold text-white">
                {plannerItems.length}
              </p>
              <p className="text-[10px] text-slate-500">
                Total items
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
              <p className="text-lg font-bold text-emerald-300">
                {completedTasks}
              </p>
              <p className="text-[10px] text-slate-500">
                Completed
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
              <p className="text-lg font-bold text-orange-300">
                {habitStreak}
              </p>
              <p className="text-[10px] text-slate-500">
                Best streak
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* MAIN TABS */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-800 bg-slate-950/80 p-1 backdrop-blur">

        {[
          {
            id: 'schedule',
            label: 'Schedule',
            icon: Clock,
          },
          {
            id: 'tasks',
            label: 'Tasks',
            icon: ListTodo,
          },
          {
            id: 'habits',
            label: 'Habits',
            icon: Flame,
          },
        ].map((tab) => {

          const Icon = tab.icon;
          const active =
            activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveTab(
                  tab.id as
                    | 'schedule'
                    | 'tasks'
                    | 'habits'
                )
              }
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                  : 'text-slate-400 hover:bg-white/[0.03] hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}

      </div>

      {/* =========================
          SCHEDULE
      ========================== */}

      {activeTab === 'schedule' && (
        <section className="space-y-5">

          {/* AI SCHEDULER */}
          <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/50 to-slate-950 p-4 shadow-xl">

            <div className="flex items-start gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15">
                <Sparkles className="h-5 w-5 text-indigo-400" />
              </div>

              <div>
                <h2 className="text-sm font-bold text-white">
                  AI Smart Scheduler
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Tell Nodysom what your day looks like and generate a balanced timetable.
                </p>
              </div>

            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">

              <input
                value={schedulePrompt}
                onChange={(event) =>
                  setSchedulePrompt(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    schedulePrompt.trim()
                  ) {
                    handleGenerateSchedule();
                  }
                }}
                placeholder="e.g. School 8 AM–2 PM, study 2 hours..."
                className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none transition focus:border-indigo-500"
              />

              <button
                type="button"
                onClick={handleGenerateSchedule}
                disabled={
                  isGenerating ||
                  !schedulePrompt.trim()
                }
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>

            </div>

            <div className="mt-3 flex flex-wrap gap-2">

              {[
                'Study-focused day',
                'Work + study',
                'Balanced day',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() =>
                    setSchedulePrompt(
                      suggestion
                    )
                  }
                  className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-[10px] font-medium text-slate-400 transition hover:border-indigo-500/40 hover:text-indigo-300"
                >
                  {suggestion}
                </button>
              ))}

            </div>

          </div>

          {/* TIMELINE */}
          <div>

            <div className="mb-3 flex items-center justify-between">

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Today's timetable
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Your AI-generated daily flow
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2">
                <Clock className="h-4 w-4 text-indigo-400" />
              </div>

            </div>

            <div className="relative space-y-3 pl-6">

              <div className="absolute bottom-3 left-[9px] top-3 w-px bg-gradient-to-b from-indigo-500/70 via-slate-700 to-transparent" />

              {generatedSchedule.map(
                (block, index) => (
                  <div
                    key={`${block.time}-${index}`}
                    className="relative rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm transition hover:border-indigo-500/20"
                  >

                    <span className="absolute -left-[23px] top-5 h-3.5 w-3.5 rounded-full border-2 border-indigo-400 bg-slate-950 shadow-[0_0_12px_rgba(99,102,241,0.35)]" />

                    <div className="flex flex-wrap items-center justify-between gap-2">

                      <span className="text-[11px] font-bold text-indigo-400">
                        {block.time}
                      </span>

                      <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${getTagBadgeStyle(block.category)}`}>
                        {block.category}
                      </span>

                    </div>

                    <h3 className="mt-2 text-sm font-bold text-white">
                      {block.title}
                    </h3>

                    {block.durationMinutes && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {block.durationMinutes} minutes
                      </p>
                    )}

                    {block.notes && (
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        {block.notes}
                      </p>
                    )}

                  </div>
                )
              )}

            </div>

          </div>

        </section>
      )}

      {/* =========================
          TASKS
      ========================== */}

      {activeTab === 'tasks' && (
        <section className="space-y-4">

          <div className="flex items-center justify-between gap-3">

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Tasks & Reminders
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {pendingTasks} pending · {completedTasks} completed
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedTags(['Work']);
                setCustomTagInput('');
                setShowAddModal(true);
              }}
              className="flex min-h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>

          </div>

          {/* FILTERS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">

            <div className="mb-2 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Filter
              </span>

              {selectedFilterTag && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedFilterTag(null)
                  }
                  className="ml-auto text-[10px] font-semibold text-indigo-400"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">

              <button
                type="button"
                onClick={() =>
                  setSelectedFilterTag(null)
                }
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${
                  selectedFilterTag === null
                    ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                All ({plannerItems.length})
              </button>

              {allAvailableTags.map(
                (tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setSelectedFilterTag(
                        tag
                      )
                    }
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${
                      selectedFilterTag?.toLowerCase() ===
                      tag.toLowerCase()
                        ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300'
                        : getTagBadgeStyle(
                            tag
                          )
                    }`}
                  >
                    {tag}
                  </button>
                )
              )}

            </div>

          </div>

          {/* TASK LIST */}
          {filteredTasks.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-950/50 p-8 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
                <ListTodo className="h-5 w-5 text-slate-500" />
              </div>

              <h3 className="mt-4 text-sm font-bold text-slate-300">
                No items yet
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Add a task or reminder to start organizing your day.
              </p>

              <button
                type="button"
                onClick={() =>
                  setShowAddModal(true)
                }
                className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white"
              >
                Add your first item
              </button>

            </div>

          ) : (

            <div className="space-y-2.5">

              {filteredTasks.map(
                (item) => {

                  const tags =
                    item.tags &&
                    item.tags.length > 0
                      ? item.tags
                      : item.category
                        ? [item.category]
                        : [];

                  return (
                    <div
                      key={item.id}
                      className={`group rounded-2xl border p-4 transition ${
                        item.completed
                          ? 'border-emerald-500/10 bg-emerald-500/[0.03]'
                          : 'border-slate-800 bg-slate-900/80 hover:border-indigo-500/20'
                      }`}
                    >

                      <div className="flex items-start gap-3">

                        <button
                          type="button"
                          onClick={() =>
                            onToggleTask(
                              item.id
                            )
                          }
                          aria-label={
                            item.completed
                              ? 'Mark incomplete'
                              : 'Mark complete'
                          }
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                            item.completed
                              ? 'border-emerald-400 bg-emerald-500 text-white'
                              : 'border-slate-700 bg-slate-950 text-transparent hover:border-indigo-400'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>

                        <div className="min-w-0 flex-1">

                          <div className="flex flex-wrap items-center gap-2">

                            <h3
                              className={`text-sm font-bold ${
                                item.completed
                                  ? 'text-slate-500 line-through'
                                  : 'text-white'
                              }`}
                            >
                              {item.title}
                            </h3>

                            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase ${
                              item.type === 'reminder'
                                ? 'border-purple-500/20 bg-purple-500/10 text-purple-300'
                                : 'border-sky-500/20 bg-sky-500/10 text-sky-300'
                            }`}>
                              {item.type}
                            </span>

                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">

                            {item.time && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Clock className="h-3 w-3" />
                                {item.time}
                              </span>
                            )}

                            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase ${
                              item.priority === 'high'
                                ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                                : item.priority === 'low'
                                  ? 'border-slate-700 bg-slate-800 text-slate-400'
                                  : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                            }`}>
                              {item.priority}
                            </span>

                          </div>

                          {tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${getTagBadgeStyle(tag)}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                        </div>

                        {item.completed && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        )}

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          )}

        </section>
      )}

      {/* =========================
          HABITS
      ========================== */}

      {activeTab === 'habits' && (
        <section className="space-y-4">

          <div className="rounded-3xl border border-orange-500/15 bg-gradient-to-br from-orange-950/30 to-slate-950 p-5">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10">
                <Flame className="h-5 w-5 text-orange-400" />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-orange-400">
                  Habit Momentum
                </p>

                <h2 className="mt-1 text-xl font-bold text-white">
                  Keep the streak alive.
                </h2>
              </div>

            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">

              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-400" />
                  <span className="text-[10px] text-slate-500">
                    Best streak
                  </span>
                </div>

                <p className="mt-2 text-2xl font-bold text-white">
                  {habitStreak}
                </p>
                <p className="text-[10px] text-slate-500">
                  days
                </p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-400" />
                  <span className="text-[10px] text-slate-500">
                    Today
                  </span>
                </div>

                <p className="mt-2 text-2xl font-bold text-white">
                  {completedHabits}/{habits.length}
                </p>
                <p className="text-[10px] text-slate-500">
                  completed
                </p>
              </div>

            </div>

          </div>

          {habits.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-950/50 p-8 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
                <Flame className="h-5 w-5 text-slate-500" />
              </div>

              <h3 className="mt-4 text-sm font-bold text-slate-300">
                No habits yet
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Your habits will appear here once they are added.
              </p>

            </div>

          ) : (

            <div className="space-y-2.5">

              {habits.map((habit) => (

                <div
                  key={habit.id}
                  className={`rounded-2xl border p-4 transition ${
                    habit.completedToday
                      ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                      : 'border-slate-800 bg-slate-900/80'
                  }`}
                >

                  <div className="flex items-center gap-3">

                    <button
                      type="button"
                      onClick={() =>
                        onToggleHabit(
                          habit.id
                        )
                      }
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition ${
                        habit.completedToday
                          ? 'border-emerald-400 bg-emerald-500 text-white'
                          : 'border-slate-700 bg-slate-950 text-slate-500 hover:border-orange-400 hover:text-orange-400'
                      }`}
                    >
                      {habit.completedToday ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Zap className="h-5 w-5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">

                      <h3 className="text-sm font-bold text-white">
                        {habit.name}
                      </h3>

                      <p className="mt-1 text-[10px] text-slate-500">
                        {habit.category}
                      </p>

                    </div>

                    <div className="text-right">

                      <div className="flex items-center gap-1">
                        <Flame className="h-4 w-4 text-orange-400" />
                        <span className="text-sm font-bold text-orange-300">
                          {habit.streak}
                        </span>
                      </div>

                      <p className="text-[9px] text-slate-600">
                        day streak
                      </p>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          )}

        </section>
      )}

      {/* =========================
          ADD ITEM MODAL
      ========================== */}

      {showAddModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowAddModal(false);
            }
          }}
        >

          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl"
          >

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-400">
                  Planner
                </p>

                <h2 className="mt-1 text-lg font-bold text-white">
                  Add {newType === 'task' ? 'Task' : 'Reminder'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAddModal(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-slate-400 transition hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

            </div>

            <div className="space-y-4 p-5">

              {/* TYPE */}
              <div className="grid grid-cols-2 gap-2">

                {[
                  {
                    id: 'task',
                    label: 'Task',
                  },
                  {
                    id: 'reminder',
                    label: 'Reminder',
                  },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() =>
                      setNewType(
                        type.id as
                          | 'task'
                          | 'reminder'
                      )
                    }
                    className={`rounded-xl border py-2.5 text-xs font-bold transition ${
                      newType === type.id
                        ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}

              </div>

              {/* TITLE */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Title
                </label>

                <input
                  autoFocus
                  value={newTitle}
                  onChange={(event) =>
                    setNewTitle(
                      event.target.value
                    )
                  }
                  placeholder="What do you need to do?"
                  className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* TIME + PRIORITY */}
              <div className="grid grid-cols-2 gap-3">

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Time
                  </label>

                  <input
                    value={newTime}
                    onChange={(event) =>
                      setNewTime(
                        event.target.value
                      )
                    }
                    className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Priority
                  </label>

                  <select
                    value={newPriority}
                    onChange={(event) =>
                      setNewPriority(
                        event.target.value as
                          | 'low'
                          | 'normal'
                          | 'high'
                      )
                    }
                    className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="low">
                      Low
                    </option>
                    <option value="normal">
                      Normal
                    </option>
                    <option value="high">
                      High
                    </option>
                  </select>
                </div>

              </div>

              {/* TAGS */}
              <div>

                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tags
                </label>

                <div className="flex flex-wrap gap-1.5">

                  {PRESET_TAGS.map((tag) => {

                    const active =
                      selectedTags.includes(
                        tag
                      );

                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          handleTogglePresetTag(
                            tag
                          )
                        }
                        className={`rounded-full border px-2.5 py-1.5 text-[9px] font-bold transition ${
                          active
                            ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                            : getTagBadgeStyle(
                                tag
                              )
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}

                </div>

                {/* SELECTED CUSTOM TAGS */}
                {selectedTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">

                    {selectedTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          handleRemoveTag(
                            tag
                          )
                        }
                        className="flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[9px] font-semibold text-indigo-300"
                      >
                        {tag}
                        <X className="h-2.5 w-2.5" />
                      </button>
                    ))}

                  </div>
                )}

                <div className="mt-2 flex gap-2">

                  <input
                    value={customTagInput}
                    onChange={(event) =>
                      setCustomTagInput(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter'
                      ) {
                        event.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                    placeholder="Custom tag..."
                    className="min-h-10 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs text-white outline-none focus:border-indigo-500"
                  />

                  <button
                    type="button"
                    onClick={
                      handleAddCustomTag
                    }
                    className="rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-bold text-slate-300 hover:text-white"
                  >
                    Add
                  </button>

                </div>

              </div>

              {/* ACTIONS */}
              <div className="flex gap-2 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setShowAddModal(false)
                  }
                  className="min-h-11 flex-1 rounded-xl border border-slate-800 bg-slate-900 text-xs font-bold text-slate-400 transition hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="min-h-11 flex-1 rounded-xl bg-indigo-600 text-xs font-bold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 disabled:opacity-40"
                >
                  Create Item
                </button>

              </div>

            </div>

          </form>

        </div>
      )}

    </div>
  );
};
