import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { PlannerItem, HabitItem, ScheduleBlock } from '../types';

export const PRESET_TAGS = ['Work', 'Personal', 'Urgent', 'Study', 'Health', 'Finance'];

export const getTagBadgeStyle = (tag: string) => {
  const lower = tag.toLowerCase();
  if (lower === 'urgent') {
    return 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25';
  }
  if (lower === 'work') {
    return 'bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25';
  }
  if (lower === 'personal' || lower === 'family') {
    return 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25';
  }
  if (lower === 'study' || lower === 'learning') {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25';
  }
  if (lower === 'health' || lower === 'wellness' || lower === 'fitness') {
    return 'bg-teal-500/15 text-teal-300 border-teal-500/30 hover:bg-teal-500/25';
  }
  if (lower === 'finance' || lower === 'budget') {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25';
  }
  return 'bg-slate-800/90 text-slate-300 border-slate-700/80 hover:bg-slate-800';
};

interface PlannerViewProps {
  plannerItems: PlannerItem[];
  habits: HabitItem[];
  onToggleTask: (id: string) => void;
  onAddTask: (item: Omit<PlannerItem, 'id'>) => void;
  onToggleHabit: (id: string) => void;
}

export const PlannerView: React.FC<PlannerViewProps> = ({
  plannerItems,
  habits,
  onToggleTask,
  onAddTask,
  onToggleHabit,
}) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'tasks' | 'habits'>('schedule');
  const [isGenerating, setIsGenerating] = useState(false);
  const [schedulePrompt, setSchedulePrompt] = useState('');
  const [generatedSchedule, setGeneratedSchedule] = useState<ScheduleBlock[]>([
    { time: '08:00 AM - 09:00 AM', title: 'Morning Focus & Planning', category: 'Study', durationMinutes: 60 },
    { time: '09:00 AM - 12:00 PM', title: 'Deep Technical Work & Projects', category: 'Work', durationMinutes: 180 },
    { time: '12:00 PM - 01:00 PM', title: 'Lunch & Fresh Air Break', category: 'Health', durationMinutes: 60 },
    { time: '01:00 PM - 04:00 PM', title: 'Classes, Meetings & Team Sync', category: 'Work', durationMinutes: 180 },
    { time: '04:30 PM - 05:30 PM', title: 'Exercise / Running / Wellness', category: 'Health', durationMinutes: 60 },
    { time: '07:00 PM - 08:30 PM', title: 'Language Practice & Review', category: 'Study', durationMinutes: 90 },
  ]);

  // Tag filter state
  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(null);

  // New task form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'task' | 'reminder'>('task');
  const [newTime, setNewTime] = useState('09:00 AM');
  const [newPriority, setNewPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Work']);
  const [customTagInput, setCustomTagInput] = useState('');

  const handleGenerateSchedule = async () => {
    if (!schedulePrompt.trim() || isGenerating) return;
    setIsGenerating(true);

    try {
      const res = await fetch('/api/ai/smart-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: schedulePrompt,
          date: new Date().toISOString().split('T')[0],
        }),
      });
      const data = await res.json();
      if (data.schedule && data.schedule.length > 0) {
        setGeneratedSchedule(data.schedule);
      }
    } catch (e) {
      console.error('Failed to generate schedule', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTogglePresetTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!selectedTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedTags([...selectedTags, trimmed]);
    }
    setCustomTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tagToRemove));
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const finalTags = [...selectedTags];
    if (customTagInput.trim()) {
      const extra = customTagInput.trim();
      if (!finalTags.some((t) => t.toLowerCase() === extra.toLowerCase())) {
        finalTags.push(extra);
      }
    }

    const primaryCategory = finalTags[0] || 'General';

    onAddTask({
      title: newTitle.trim(),
      type: newType,
      date: new Date().toISOString().split('T')[0],
      time: newTime,
      completed: false,
      priority: newPriority,
      category: primaryCategory,
      tags: finalTags.length > 0 ? finalTags : [primaryCategory],
    });

    setNewTitle('');
    setSelectedTags(['Work']);
    setCustomTagInput('');
    setShowAddModal(false);
  };

  const allAvailableTags = useMemo(() => {
    const tagSet = new Set<string>();
    PRESET_TAGS.forEach((t) => tagSet.add(t));
    plannerItems.forEach((item) => {
      if (item.category) tagSet.add(item.category);
      if (item.tags) item.tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet);
  }, [plannerItems]);

  const filteredTasks = useMemo(() => {
    if (!selectedFilterTag) return plannerItems;
    const filterLower = selectedFilterTag.toLowerCase();
    return plannerItems.filter((item) => {
      const itemTags = item.tags && item.tags.length > 0
        ? item.tags
        : (item.category ? [item.category] : []);
      return (
        itemTags.some((t) => t.toLowerCase() === filterLower) ||
        (item.category && item.category.toLowerCase() === filterLower)
      );
    });
  }, [plannerItems, selectedFilterTag]);

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto px-4 pt-3">
      {/* Top Header */}
      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              Daily Life Planner
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
          Plan, Organize & Achieve
        </h1>
      </section>

      {/* Segmented Controls */}
      <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800 text-xs">
        {[
          { id: 'schedule', label: 'Timeline & AI', icon: Clock },
          { id: 'tasks', label: 'Tasks & Reminders', icon: ListTodo },
          { id: 'habits', label: 'Habits & Streaks', icon: Flame },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-2 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-indigo-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Schedule Tab */}
      {activeTab === 'schedule' && (
        <section className="space-y-5 animate-in fade-in duration-200">
          {/* Smart AI Scheduler Prompt Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/30 shadow-lg space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200">
                Natural Language Smart Scheduler
              </span>
            </div>
            <p className="text-xs text-slate-400">
              State your day's classes, work shifts, or priorities. LifeOS automatically generates an optimal balanced schedule.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={schedulePrompt}
                onChange={(e) => setSchedulePrompt(e.target.value)}
                placeholder="e.g., School 8 AM to 2 PM, work 4 PM to 7 PM, need 1hr study"
                className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleGenerateSchedule}
                disabled={isGenerating || !schedulePrompt.trim()}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1 shrink-0"
              >
                {isGenerating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Generate</span>
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Timeline View */}
          <div className="space-y-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Today's Timetable
            </span>

            <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800">
              {generatedSchedule.map((block, idx) => (
                <div
                  key={idx}
                  className="relative p-3.5 rounded-2xl bg-slate-900 border border-slate-800/90 shadow-sm hover:border-slate-700 transition-colors"
                >
                  <span className="absolute -left-[23px] top-4 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-indigo-500 shadow-sm" />
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-indigo-400 font-mono">
                      {block.time}
                    </span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {block.category}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-200">
                    {block.title}
                  </h4>
                  {block.notes && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {block.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. Tasks & Reminders Tab */}
      {activeTab === 'tasks' && (
        <section className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {plannerItems.length} Items Scheduled
              </span>
              {selectedFilterTag && (
                <span className="text-[11px] text-indigo-400 font-medium">
                  • Filtered: {filteredTasks.length}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedTags(['Work']);
                setCustomTagInput('');
                setShowAddModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
          </div>

          {/* Tags & Categories Filter Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-indigo-400" /> Filter by Tag / Category
              </span>
              {selectedFilterTag && (
                <button
                  onClick={() => setSelectedFilterTag(null)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
              <button
                onClick={() => setSelectedFilterTag(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                  selectedFilterTag === null
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({plannerItems.length})
              </button>
              {allAvailableTags.map((tag) => {
                const isActive = selectedFilterTag?.toLowerCase() === tag.toLowerCase();
                const count = plannerItems.filter((i) => {
                  const iTags = i.tags && i.tags.length > 0 ? i.tags : (i.category ? [i.category] : []);
                  return (
                    iTags.some((t) => t.toLowerCase() === tag.toLowerCase()) ||
                    i.category?.toLowerCase() === tag.toLowerCase()
                  );
                }).length;

                // Show if count > 0 or if it's one of the common presets
                if (count === 0 && !PRESET_TAGS.slice(0, 3).includes(tag)) return null;

                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedFilterTag(isActive ? null : tag)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 border transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-500 font-semibold shadow-sm'
                        : `${getTagBadgeStyle(tag)} bg-slate-900`
                    }`}
                  >
                    <Tag className="w-2.5 h-2.5 opacity-70" />
                    <span>{tag}</span>
                    {count > 0 && <span className="opacity-70 text-[10px]">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
              <p className="text-xs text-slate-400">
                No tasks found matching tag &ldquo;{selectedFilterTag}&rdquo;.
              </p>
              <button
                onClick={() => setSelectedFilterTag(null)}
                className="text-xs text-indigo-400 hover:underline font-medium"
              >
                Clear filter to view all tasks
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((item) => {
                const itemTags = item.tags && item.tags.length > 0
                  ? item.tags
                  : (item.category ? [item.category] : []);

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-start justify-between group hover:border-slate-700 transition-colors gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => onToggleTask(item.id)}
                        className={`w-5 h-5 mt-0.5 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                          item.completed
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'border-slate-700 hover:border-slate-500 bg-slate-950'
                        }`}
                      >
                        {item.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-medium truncate ${
                            item.completed
                              ? 'line-through text-slate-500'
                              : 'text-slate-200'
                          }`}
                        >
                          {item.title}
                        </p>
                        
                        {/* Meta info & Tags badges */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1.5 flex-wrap">
                          {item.time && (
                            <span className="flex items-center gap-1 font-mono text-slate-400 mr-1">
                              <Clock className="w-3 h-3" /> {item.time}
                            </span>
                          )}
                          <span className="capitalize px-1.5 py-0.5 bg-slate-800/80 rounded text-slate-400">
                            {item.type}
                          </span>

                          {/* Render custom tags and categories */}
                          {itemTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setSelectedFilterTag(selectedFilterTag === tag ? null : tag)}
                              title={`Filter tasks by tag: ${tag}`}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${getTagBadgeStyle(tag)}`}
                            >
                              <Tag className="w-2.5 h-2.5 opacity-70" />
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize shrink-0 ${
                        item.priority === 'high'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : item.priority === 'low'
                          ? 'bg-slate-800 text-slate-500'
                          : 'bg-indigo-500/10 text-indigo-400'
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 3. Habits & Streaks Tab */}
      {activeTab === 'habits' && (
        <section className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Daily Habits
            </span>
            <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
              <Flame className="w-4 h-4 fill-amber-400" />
              Active Streaks
            </span>
          </div>

          <div className="space-y-2.5">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-200">
                    {habit.name}
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {habit.category} • Completed for 3 days this week
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-amber-400 flex items-center gap-0.5">
                      <Flame className="w-3.5 h-3.5 fill-amber-400" />
                      {habit.streak}d
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      streak
                    </span>
                  </div>

                  <button
                    onClick={() => onToggleHabit(habit.id)}
                    className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                      habit.completedToday
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {habit.completedToday ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Done
                      </>
                    ) : (
                      'Mark Today'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 text-slate-100 relative shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-400" />
              Add Planner Item
            </h3>
            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Finish Work Proposal or Buy Groceries"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="task">Task</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Time</label>
                  <input
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="09:00 AM"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              {/* Tags & Categories Section */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-indigo-400" />
                    Tags & Categories (e.g. Work, Personal, Urgent)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {selectedTags.length} selected
                  </span>
                </div>

                {/* Active Selected Tags */}
                <div className="flex flex-wrap gap-1.5 min-h-[28px] p-2 bg-slate-950/70 border border-slate-800 rounded-xl items-center">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getTagBadgeStyle(tag)}`}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-white p-0.5 rounded transition-colors"
                        title="Remove tag"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {selectedTags.length === 0 && (
                    <span className="text-[11px] text-slate-500 italic">
                      Click presets below or type custom tag
                    </span>
                  )}
                </div>

                {/* Presets */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Suggested Categories / Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_TAGS.map((preset) => {
                      const isSelected = selectedTags.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleTogglePresetTag(preset)}
                          className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-500 font-semibold shadow-sm'
                              : `${getTagBadgeStyle(preset)} bg-slate-950`
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Add Custom Tag */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                    placeholder="Add custom tag (e.g. Urgent, Errands)..."
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    disabled={!customTagInput.trim()}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all mt-2 active:scale-98"
              >
                Save Item
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
