import React, { useState } from 'react';
import {
  User,
  Mail,
  Globe2,
  Target,
  Brain,
  Trash2,
  Download,
  Save,
  Cloud,
  CloudOff,
  LogIn,
  UserPlus,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import {
  UserProfile,
  MemoryItem,
} from '../types';

import { LANGUAGES } from '../data/mockAndDefaults';

interface AuthResult {
  success: boolean;
  message: string;
}

interface ProfileViewProps {
  user: UserProfile;
  memories: MemoryItem[];

  onUpdateUser: (
    updated: Partial<UserProfile>
  ) => void;

  onAddMemory: (
    content: string,
    category: any
  ) => void;

  onDeleteMemory: (
    id: string
  ) => void;

  onExportData: () => void;

  onClearAllData: () => void;

  cloudEnabled?: boolean;
  cloudEmail?: string;
  cloudBusy?: boolean;

  onSignIn?: (
    email: string,
    password: string
  ) => Promise<AuthResult>;

  onSignUp?: (
    email: string,
    password: string
  ) => Promise<AuthResult>;

  onSignOut?: () => Promise<void>;
}

export function ProfileView({
  user,
  memories,
  onUpdateUser,
  onAddMemory,
  onDeleteMemory,
  onExportData,
  onClearAllData,

  cloudEnabled = false,
  cloudEmail = '',
  cloudBusy = false,

  onSignIn,
  onSignUp,
  onSignOut,
}: ProfileViewProps) {
  const [name, setName] = useState(
    user.name || ''
  );

  const [language, setLanguage] =
    useState(
      user.preferredLanguage || 'en'
    );

  const [country, setCountry] =
    useState(
      user.country || ''
    );

  const [goals, setGoals] =
    useState(
      user.goals || ''
    );

  const [memoryText, setMemoryText] =
    useState('');

  const [memoryCategory, setMemoryCategory] =
    useState<
      'preference' |
      'goal' |
      'habit' |
      'fact' |
      'work'
    >('fact');

  const [authMode, setAuthMode] =
    useState<'login' | 'signup'>(
      'login'
    );

  const [authEmail, setAuthEmail] =
    useState('');

  const [authPassword, setAuthPassword] =
    useState('');

  const [authMessage, setAuthMessage] =
    useState('');

  const [authError, setAuthError] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const isLoggedIn =
    Boolean(cloudEmail);

  /*
   * ---------------------------------------------------------
   * PROFILE
   * ---------------------------------------------------------
   */

  const handleSaveProfile = () => {
    onUpdateUser({
      name: name.trim(),
      preferredLanguage: language,
      country: country.trim(),
      goals: goals.trim(),
    });

    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  /*
   * ---------------------------------------------------------
   * MEMORY
   * ---------------------------------------------------------
   */

  const handleAddMemoryClick = () => {
    const clean =
      memoryText.trim();

    if (!clean) return;

    onAddMemory(
      clean,
      memoryCategory
    );

    setMemoryText('');
  };

  /*
   * ---------------------------------------------------------
   * AUTH
   * ---------------------------------------------------------
   */

  const handleAuth = async () => {
    setAuthMessage('');
    setAuthError(false);

    const email =
      authEmail.trim();

    const password =
      authPassword;

    if (!email) {
      setAuthError(true);
      setAuthMessage(
        'Please enter your email.'
      );
      return;
    }

    if (!email.includes('@')) {
      setAuthError(true);
      setAuthMessage(
        'Please enter a valid email address.'
      );
      return;
    }

    if (password.length < 6) {
      setAuthError(true);
      setAuthMessage(
        'Password must contain at least 6 characters.'
      );
      return;
    }

    if (
      !onSignIn ||
      !onSignUp
    ) {
      setAuthError(true);
      setAuthMessage(
        'Cloud authentication is not available.'
      );
      return;
    }

    try {
      const result =
        authMode === 'login'
          ? await onSignIn(
              email,
              password
            )
          : await onSignUp(
              email,
              password
            );

      setAuthMessage(
        result.message
      );

      setAuthError(
        !result.success
      );

      if (result.success) {
        setAuthPassword('');

        if (authMode === 'signup') {
          setAuthEmail('');
        }
      }
    } catch (error: any) {
      setAuthError(true);

      setAuthMessage(
        error?.message ||
          'Something went wrong. Please try again.'
      );
    }
  };

  const handleLogout = async () => {
    setAuthMessage('');
    setAuthError(false);

    if (!onSignOut) return;

    try {
      await onSignOut();

      setAuthMessage(
        'You have been signed out.'
      );
    } catch {
      setAuthError(true);

      setAuthMessage(
        'Could not sign out. Please try again.'
      );
    }
  };

  return (
    <div className="px-4 pb-32 pt-4 space-y-5">

      {/* ------------------------------------------------ */}
      {/* HEADER */}
      {/* ------------------------------------------------ */}

      <section>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center">
            <User
              size={24}
              className="text-indigo-300"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white">
              Profile
            </h1>

            <p className="text-sm text-slate-400">
              Manage your Nodysom AI account
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ */}
      {/* CLOUD ACCOUNT */}
      {/* ------------------------------------------------ */}

      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">

        <div className="flex items-start justify-between gap-3 mb-5">

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              {isLoggedIn ? (
                <Cloud
                  size={22}
                  className="text-emerald-400"
                />
              ) : (
                <CloudOff
                  size={22}
                  className="text-slate-400"
                />
              )}
            </div>

            <div>
              <h2 className="font-bold text-white">
                Cloud Account
              </h2>

              <p className="text-xs text-slate-400">
                {isLoggedIn
                  ? 'Your data can sync across devices.'
                  : 'Sign in to sync your data.'}
              </p>
            </div>
          </div>

          <div
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              isLoggedIn
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isLoggedIn
              ? 'Connected'
              : 'Offline account'}
          </div>
        </div>

        {isLoggedIn ? (
          <div className="space-y-4">

            <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">
              <div className="flex items-center gap-3">
                <Mail
                  size={18}
                  className="text-indigo-400"
                />

                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    Signed in as
                  </p>

                  <p className="text-sm text-white truncate">
                    {cloudEmail}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 size={15} />
              <span>
                Cloud sync is active
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={cloudBusy}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 transition"
            >
              {cloudBusy ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <LogOut size={18} />
              )}

              Sign Out
            </button>
          </div>
        ) : cloudEnabled ? (
          <div className="space-y-4">

            <div className="flex gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthMessage('');
                }}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  authMode === 'login'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <LogIn size={16} />
                  Login
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthMessage('');
                }}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  authMode === 'signup'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <UserPlus size={16} />
                  Create Account
                </span>
              </button>
            </div>

            <div className="space-y-3">

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Email
                </label>

                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) =>
                    setAuthEmail(
                      e.target.value
                    )
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Password
                </label>

                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) =>
                    setAuthPassword(
                      e.target.value
                    )
                  }
                  placeholder="Minimum 6 characters"
                  autoComplete={
                    authMode === 'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={handleAuth}
                disabled={cloudBusy}
                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2 transition"
              >
                {cloudBusy ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : authMode === 'login' ? (
                  <LogIn size={18} />
                ) : (
                  <UserPlus size={18} />
                )}

                {authMode === 'login'
                  ? 'Login'
                  : 'Create Account'}
              </button>
            </div>

            {authMessage && (
              <div
                className={`rounded-2xl border p-3 text-xs flex items-start gap-2 ${
                  authError
                    ? 'border-red-500/20 bg-red-500/10 text-red-300'
                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {authError ? (
                  <AlertCircle
                    size={16}
                    className="shrink-0 mt-0.5"
                  />
                ) : (
                  <CheckCircle2
                    size={16}
                    className="shrink-0 mt-0.5"
                  />
                )}

                <span>
                  {authMessage}
                </span>
              </div>
            )}

            <p className="text-[11px] leading-5 text-slate-500">
              Your password is handled by Supabase authentication.
              Nodysom AI does not store your password in local storage.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 text-sm text-slate-400">
            Cloud account is not configured yet.
          </div>
        )}
      </section>

      {/* ------------------------------------------------ */}
      {/* PROFILE DETAILS */}
      {/* ------------------------------------------------ */}

      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <User
              size={20}
              className="text-indigo-400"
            />
          </div>

          <div>
            <h2 className="font-bold text-white">
              Personal Information
            </h2>

            <p className="text-xs text-slate-400">
              Customize your AI experience
            </p>
          </div>
        </div>

        <div className="space-y-4">

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Name
            </label>

            <div className="relative">
              <User
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Your name"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Preferred Language
            </label>

            <div className="relative">
              <Globe2
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <select
                value={language}
                onChange={(e) =>
                  setLanguage(
                    e.target.value
                  )
                }
                className="w-full appearance-none rounded-2xl border border-slate-700 bg-slate-950 pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
              >
                {Array.isArray(
                  LANGUAGES
                ) &&
                  LANGUAGES.map(
                    (item: any) => (
                      <option
                        key={
                          item.code ||
                          item.value
                        }
                        value={
                          item.code ||
                          item.value
                        }
                      >
                        {item.name ||
                          item.label}
                      </option>
                    )
                  )}
              </select>
            </div>
          </div>

          {/* Country */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Country
            </label>

            <div className="relative">
              <Globe2
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                value={country}
                onChange={(e) =>
                  setCountry(
                    e.target.value
                  )
                }
                placeholder="Tanzania"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Goals */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Goals
            </label>

            <div className="relative">
              <Target
                size={17}
                className="absolute left-4 top-4 text-slate-500"
              />

              <textarea
                value={goals}
                onChange={(e) =>
                  setGoals(
                    e.target.value
                  )
                }
                placeholder="What are you working toward?"
                rows={4}
                className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={
              handleSaveProfile
            }
            className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2 transition"
          >
            {saved ? (
              <>
                <CheckCircle2
                  size={18}
                />
                Saved
              </>
            ) : (
              <>
                <Save size={18} />
                Save Profile
              </>
            )}
          </button>
        </div>
      </section>

      {/* ------------------------------------------------ */}
      {/* MEMORIES */}
      {/* ------------------------------------------------ */}

      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Brain
              size={20}
              className="text-purple-400"
            />
          </div>

          <div>
            <h2 className="font-bold text-white">
              AI Memories
            </h2>

            <p className="text-xs text-slate-400">
              Information Nodysom AI remembers
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-5">

          <textarea
            value={memoryText}
            onChange={(e) =>
              setMemoryText(
                e.target.value
              )
            }
            placeholder="Add something you want Nodysom AI to remember..."
            rows={3}
            maxLength={500}
            className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
          />

          <div className="flex gap-2">

            <select
              value={memoryCategory}
              onChange={(e) =>
                setMemoryCategory(
                  e.target.value as any
                )
              }
              className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-indigo-500"
            >
              <option value="fact">
                Fact
              </option>

              <option value="preference">
                Preference
              </option>

              <option value="goal">
                Goal
              </option>

              <option value="habit">
                Habit
              </option>

              <option value="work">
                Work
              </option>
            </select>

            <button
              type="button"
              onClick={
                handleAddMemoryClick
              }
              disabled={
                !memoryText.trim()
              }
              className="rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-5 py-3 text-sm font-bold text-white transition"
            >
              Add
            </button>
          </div>
        </div>

        {memories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-center">
            <Brain
              size={24}
              className="mx-auto mb-2 text-slate-600"
            />

            <p className="text-sm text-slate-500">
              No memories yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {memories.map(
              (memory) => (
                <div
                  key={memory.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-wide text-purple-400 font-bold">
                          {
                            memory.category
                          }
                        </span>

                        <span className="text-[10px] text-slate-600">
                          {
                            memory.createdAt
                          }
                        </span>
                      </div>

                      <p className="text-sm text-slate-200 break-words">
                        {
                          memory.content
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onDeleteMemory(
                          memory.id
                        )
                      }
                      className="shrink-0 w-9 h-9 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition"
                      aria-label="Delete memory"
                    >
                      <Trash2
                        size={16}
                      />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ */}
      {/* DATA */}
      {/* ------------------------------------------------ */}

      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">

        <h2 className="font-bold text-white mb-1">
          Your Data
        </h2>

        <p className="text-xs text-slate-400 mb-4">
          Keep a backup or remove local app data.
        </p>

        <div className="space-y-3">

          <button
            type="button"
            onClick={
              onExportData
            }
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 hover:bg-slate-800 px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 transition"
          >
            <Download
              size={18}
            />
            Export My Data
          </button>

          <button
            type="button"
            onClick={() => {
              const confirmed =
                window.confirm(
                  'Are you sure you want to clear your local Nodysom AI data?'
                );

              if (confirmed) {
                onClearAllData();
              }
            }}
            className="w-full rounded-2xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 flex items-center justify-center gap-2 transition"
          >
            <Trash2
              size={18}
            />
            Clear Local Data
          </button>
        </div>
      </section>

      {/* ------------------------------------------------ */}
      {/* FOOTER */}
      {/* ------------------------------------------------ */}

      <footer className="text-center pt-2 pb-6">
        <p className="text-xs text-slate-600">
          Nodysom AI v1.0.0
        </p>

        <p className="text-[11px] text-slate-700 mt-1">
          Plan Your Day. Live Smarter.
        </p>
      </footer>

    </div>
  );
}
