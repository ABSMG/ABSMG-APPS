import React from 'react';
import {
  Home,
  Search,
  BookOpen,
  Calendar,
  User,
  Mic,
  Wifi,
  WifiOff,
  Smartphone,
  Monitor,
  Languages,
  Sparkles,
} from 'lucide-react';
import { TabType, UserProfile } from '../types';

interface TopHeaderProps {
  user?: UserProfile;
  isOnline: boolean;
  onOpenTranslator: () => void;
  onOpenVoice: () => void;
  isPhoneFrame: boolean;
  onTogglePhoneFrame: () => void;
}

export function TopHeader({
  user,
  isOnline,
  onOpenTranslator,
  onOpenVoice,
  isPhoneFrame,
  onTogglePhoneFrame,
}: TopHeaderProps) {
  const displayName =
    user?.name?.trim() || 'Nodysom User';

  const initial =
    displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* BRAND */}
        <div className="flex min-w-0 items-center gap-3">

          <div className="relative shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-xl shadow-indigo-500/20 ring-1 ring-white/10">
              <Sparkles
                size={20}
                className="text-white"
              />
            </div>

            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400 shadow-lg shadow-emerald-400/40" />
          </div>

          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-extrabold tracking-tight text-white sm:text-base">
                Nodysom AI
              </h1>

              <span className="hidden rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-indigo-300 sm:inline-flex">
                AI
              </span>
            </div>

            <p className="hidden truncate text-[10px] font-medium text-slate-500 sm:block">
              Your intelligent daily life assistant
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* ONLINE STATUS */}
          <div
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold sm:flex ${
              isOnline
                ? 'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300'
                : 'border-rose-400/15 bg-rose-400/[0.07] text-rose-300'
            }`}
          >
            {isOnline ? (
              <Wifi size={12} />
            ) : (
              <WifiOff size={12} />
            )}

            <span>
              {isOnline
                ? 'Online'
                : 'Offline'}
            </span>
          </div>

          {/* TRANSLATOR */}
          <button
            type="button"
            onClick={onOpenTranslator}
            className="group hidden h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 shadow-sm transition-all duration-200 hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-white active:scale-95 sm:flex"
          >
            <Languages
              size={15}
              className="text-indigo-300 transition-transform duration-200 group-hover:scale-110"
            />

            <span>
              Translate
            </span>
          </button>

          {/* VOICE */}
          <button
            type="button"
            onClick={onOpenVoice}
            aria-label="Open voice assistant"
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-200 shadow-lg shadow-indigo-500/5 transition-all duration-200 hover:border-indigo-400/40 hover:bg-indigo-500/20 hover:text-white active:scale-90"
          >
            <span className="absolute inset-0 rounded-xl bg-indigo-400/10 opacity-0 blur-md transition-opacity group-hover:opacity-100" />

            <Mic
              size={17}
              className="relative transition-transform duration-200 group-hover:scale-110"
            />
          </button>

          {/* DEVICE PREVIEW */}
          <button
            type="button"
            onClick={onTogglePhoneFrame}
            aria-label="Toggle device preview"
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-all duration-200 hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-white active:scale-90 lg:flex"
          >
            {isPhoneFrame ? (
              <Monitor size={17} />
            ) : (
              <Smartphone size={17} />
            )}
          </button>

          {/* USER */}
          <div
            title={displayName}
            className="ml-1 hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-slate-200 shadow-inner sm:flex"
          >
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenVoice?: () => void;
  user?: UserProfile;
  isOnline?: boolean;
  isPhoneFrame?: boolean;
  onTogglePhoneFrame?: () => void;
  onOpenTranslator?: () => void;
}

export function BottomNav({
  currentTab,
  onSelectTab,
}: BottomNavProps) {

  const tabs = [
    {
      id: 'home' as TabType,
      label: 'Home',
      icon: Home,
    },
    {
      id: 'search' as TabType,
      label: 'Search',
      icon: Search,
    },
    {
      id: 'learn' as TabType,
      label: 'Learn',
      icon: BookOpen,
    },
    {
      id: 'planner' as TabType,
      label: 'Planner',
      icon: Calendar,
    },
    {
      id: 'profile' as TabType,
      label: 'Profile',
      icon: User,
    },
  ];

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-[99999] border-t border-white/[0.08] bg-slate-950/90 backdrop-blur-2xl"
      style={{
        touchAction: 'manipulation',
        WebkitTapHighlightColor:
          'transparent',
      }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-around gap-1 px-2 py-2 sm:px-4">

        {tabs.map((tab) => {
          const Icon = tab.icon;

          const active =
            currentTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              aria-current={
                active
                  ? 'page'
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectTab(tab.id);
              }}
              className={`group relative z-[100000] flex min-w-[62px] flex-1 cursor-pointer flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold transition-all duration-200 active:scale-90 sm:min-w-[72px] sm:text-[11px] ${
                active
                  ? 'bg-indigo-500/[0.12] text-indigo-300'
                  : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
              }`}
            >

              <span
                className={`flex h-8 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-indigo-500/15 shadow-sm shadow-indigo-500/10'
                    : 'group-hover:bg-white/[0.04]'
                }`}
              >
                <Icon
                  size={18}
                  strokeWidth={
                    active
                      ? 2.5
                      : 1.9
                  }
                  className="transition-transform duration-200 group-hover:-translate-y-0.5"
                />
              </span>

              <span>
                {tab.label}
              </span>

              {active && (
                <span className="absolute bottom-0.5 h-0.5 w-7 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.6)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
