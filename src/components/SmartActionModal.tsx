import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Calendar, Clock, Tag, X } from 'lucide-react';
import { SmartAction } from '../types';

interface SmartActionModalProps {
  action: SmartAction | null;
  onConfirm: (finalAction: SmartAction) => void;
  onCancel: () => void;
}

export const SmartActionModal: React.FC<SmartActionModalProps> = ({
  action,
  onConfirm,
  onCancel,
}) => {
  if (!action) return null;

  const [title, setTitle] = useState(action.title || '');
  const [date, setDate] = useState(action.date || 'Today');
  const [time, setTime] = useState(action.time || '10:00 AM');
  const [category, setCategory] = useState(action.category || 'General');

  const handleSave = () => {
    onConfirm({
      ...action,
      title,
      date,
      time,
      category,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 text-slate-100 relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Action Detected
            </h3>
            <p className="text-xs text-slate-400">
              Confirm before LifeOS schedules this
            </p>
          </div>
        </div>

        <div className="space-y-3 my-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Title / Action
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-400" /> Date
              </label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g. Tomorrow"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-400" /> Time
              </label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 08:00 AM"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-indigo-400" /> Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2 mb-4">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            This will be securely saved into your local Daily Planner and Reminders list.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
          >
            Confirm & Save
          </button>
        </div>
      </div>
    </div>
  );
};
