import React, { useState } from 'react';
import {
  User,
  Shield,
  Brain,
  Trash2,
  Download,
  Plus,
  Globe,
  Wifi,
  Check,
  AlertTriangle,
  Sparkles,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { UserProfile, MemoryItem } from '../types';
import { SUPPORTED_LANGUAGES } from '../data/mockAndDefaults';

interface ProfileViewProps {
  user: UserProfile;
  memories: MemoryItem[];
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onAddMemory: (content: string, category: any) => void;
  onDeleteMemory: (id: string) => void;
  onExportData: () => void;
  onClearAllData: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  memories,
  onUpdateUser,
  onAddMemory,
  onDeleteMemory,
  onExportData,
  onClearAllData,
}) => {
  const [name, setName] = useState(user.name);
  const [country, setCountry] = useState(user.country);
  const [goals, setGoals] = useState(user.goals);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<'preference' | 'goal' | 'habit' | 'fact'>('preference');
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      name,
      country,
      goals,
    });
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2000);
  };

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;
    onAddMemory(newMemoryText.trim(), newMemoryCategory);
    setNewMemoryText('');
  };

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto px-4 pt-3">
      {/* Header */}
      <section className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <User className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            Personalization & Security
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
          User Profile & Memory Control
        </h1>
        <p className="text-xs text-slate-400">
          Manage your personal settings, language preferences, and user-controlled memories.
        </p>
      </section>

      {/* Account Card */}
      <section className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-[1px] flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[15px] flex items-center justify-center font-bold text-indigo-400 text-lg">
                {user.name.charAt(0) || 'U'}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{user.name}</h3>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {user.tier} Tier
            </span>
          </div>
        </div>

        {/* Tier Benefits Glance */}
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-850 text-xs space-y-1">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span>Free Tier Features</span>
            <span className="text-emerald-400 text-[11px]">Active</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Full access to AI Assistant, Daily Planner, Universal Search, and Learning Hub. No artificial throttling.
          </p>
        </div>
      </section>

      {/* Profile Form */}
      <section className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
          Personal Preferences
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-750 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Globe className="w-3 h-3 text-indigo-400" /> Preferred Language
              </label>
              <select
                value={user.preferredLanguage}
                onChange={(e) => onUpdateUser({ preferredLanguage: e.target.value })}
                className="w-full bg-slate-950 border border-slate-750 focus:border-indigo-500 rounded-xl px-2.5 py-2 text-xs text-slate-100"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name} ({l.native})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Country / Region
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Kenya, Nigeria, Brazil"
                className="w-full bg-slate-950 border border-slate-750 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Primary Goal / Focus Area
            </label>
            <input
              type="text"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="e.g. Study Computer Science & Save money"
              className="w-full bg-slate-950 border border-slate-750 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100"
            />
          </div>

          {/* Low-Data Mode Toggle */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-between">
            <div className="pr-4">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-blue-400" />
                Low-Data Mode (Slow Internet / 2G / 3G)
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Compresses network payloads and prioritizes local cache. Ideal for developing countries and low-bandwidth connections.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateUser({ lowDataMode: !user.lowDataMode })}
              className={`w-11 h-6 rounded-full p-1 transition-colors ${
                user.lowDataMode ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  user.lowDataMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center justify-center gap-1.5"
          >
            {isSavedToast ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                Saved Changes
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </form>
      </section>

      {/* User-Controlled Memory Manager */}
      <section className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              User-Controlled Memory ({memories.length})
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">
            Privacy First • Delete Anytime
          </span>
        </div>

        <p className="text-xs text-slate-400">
          LifeOS uses these memories to personalize your conversations and schedules. You have 100% control to view, add, or delete any item.
        </p>

        {/* Memories List */}
        <div className="space-y-2">
          {memories.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              No memories stored. You can add one below.
            </p>
          ) : (
            memories.map((mem) => (
              <div
                key={mem.id}
                className="p-3 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-between group hover:border-slate-700"
              >
                <div className="min-w-0 pr-3">
                  <span className="text-[9px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                    {mem.category}
                  </span>
                  <p className="text-xs text-slate-200 mt-1">{mem.content}</p>
                </div>
                <button
                  onClick={() => onDeleteMemory(mem.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                  title="Delete memory"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Memory Form */}
        <form onSubmit={handleCreateMemory} className="pt-2 border-t border-slate-800 space-y-2">
          <span className="text-[11px] font-semibold text-slate-300 block">
            Add New Fact to Remember
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={newMemoryText}
              onChange={(e) => setNewMemoryText(e.target.value)}
              placeholder="e.g. 'I work night shifts from 10 PM to 6 AM'..."
              className="flex-1 bg-slate-950 border border-slate-750 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100"
            />
            <select
              value={newMemoryCategory}
              onChange={(e) => setNewMemoryCategory(e.target.value as any)}
              className="bg-slate-950 border border-slate-750 rounded-xl px-2 text-xs text-slate-300"
            >
              <option value="preference">Preference</option>
              <option value="goal">Goal</option>
              <option value="habit">Habit</option>
              <option value="fact">Fact</option>
            </select>
            <button
              type="submit"
              disabled={!newMemoryText.trim()}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </form>
      </section>

      {/* Data Export & Wipe Security Controls */}
      <section className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Data Ownership & Privacy
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          Your data belongs entirely to you. You can export all tasks, memories, and schedules to a local JSON backup at any time.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={onExportData}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            Export Data Backup (JSON)
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="py-2.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Data
          </button>
        </div>

        {showClearConfirm && (
          <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 text-rose-300 font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>Are you sure? This action is irreversible.</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              All local planner tasks, habits, and user-controlled memories will be wiped from this device.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearAllData();
                  setShowClearConfirm(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                Yes, Wipe Everything
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Brand & Footer Info */}
      <footer className="text-center text-xs text-slate-400 space-y-1 pt-4">
        <p className="font-semibold text-slate-400">LifeOS v1.0.0 (Global MVP)</p>
        <p className="text-[11px] text-slate-400">
          "Ask. Plan. Learn. Do."
        </p>
      </footer>
    </div>
  );
};
