import React, { useState } from 'react';
import { Sparkles, Globe, Compass, Target, ArrowRight, Check } from 'lucide-react';
import { UserProfile } from '../types';
import { SUPPORTED_LANGUAGES } from '../data/mockAndDefaults';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (updatedProfile: Partial<UserProfile>, initialPrompt?: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  if (!isOpen) return null;

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [region, setRegion] = useState('Global');
  const [goal, setGoal] = useState('Daily productivity & organization');

  const goalsList = [
    'Daily productivity & organization',
    'Exam & academic study planning',
    'Language learning & translation',
    'Financial budgeting & savings',
    'Work tasks & professional emails',
  ];

  const handleFinish = (initialAction?: string) => {
    onComplete(
      {
        name: name.trim() || 'Explorer',
        preferredLanguage: language,
        country: region,
        goals: goal,
      },
      initialAction
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col relative">
        {/* Progress dots */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                step >= 1 ? 'bg-indigo-500' : 'bg-slate-700'
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full ${
                step >= 2 ? 'bg-indigo-500' : 'bg-slate-700'
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full ${
                step >= 3 ? 'bg-indigo-500' : 'bg-slate-700'
              }`}
            />
          </div>
          <span className="text-[11px] font-semibold text-indigo-400">
            Step {step} of 3
          </span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-400 p-[1px] mb-3 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[15px] flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
              </div>
              <h2 className="text-lg font-bold text-slate-100">
                Welcome to LifeOS
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Your universal everyday AI assistant. Ask. Plan. Learn. Do.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                What should LifeOS call you?
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-indigo-400" /> Preferred Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name} ({l.native})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-1.5"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2">
                <Target className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-100">
                What is your primary goal?
              </h2>
              <p className="text-xs text-slate-400">
                LifeOS tailors its daily responses to help you achieve it.
              </p>
            </div>

            <div className="space-y-2">
              {goalsList.map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs transition-all flex items-center justify-between ${
                    goal === g
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-medium'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span>{g}</span>
                  {goal === g && <Check className="w-4 h-4 text-indigo-400" />}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-indigo-400" /> Country / Region (Optional)
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Kenya, Nigeria, Brazil, US..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-2/3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-1.5"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-100">
                You're all set, {name || 'Explorer'}!
              </h2>
              <p className="text-xs text-slate-400">
                Try one of these quick everyday actions to start:
              </p>
            </div>

            <div className="space-y-2">
              {[
                { label: 'Plan my day', prompt: 'Plan my day with balanced study, work, and wellness.' },
                { label: 'Teach me something', prompt: 'Teach me the basics of how neural networks learn.' },
                { label: 'Translate a message', prompt: 'Translate "Good morning, my friend" into Swahili.' },
                { label: 'Help me save money', prompt: 'Give me 3 realistic budgeting habits to save money each month.' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleFinish(item.prompt)}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/60 hover:bg-indigo-950/20 text-xs text-slate-200 transition-all flex items-center justify-between group"
                >
                  <span className="font-medium text-indigo-300">"{item.label}"</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </button>
              ))}
            </div>

            <button
              onClick={() => handleFinish()}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              Skip to Home Screen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
