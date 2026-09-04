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
  isOnline,
  onOpenTranslator,
  onOpenVoice,
  isPhoneFrame,
  onTogglePhoneFrame,
}: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600">
            <span className="text-lg font-black text-white">N</span>
          </div>

          <div className="leading-tight">
            <h1 className="text-sm font-black tracking-wide text-white sm:text-base">
              Nodysom AI
            </h1>
            <p className="hidden text-[10px] text-slate-400 sm:block">
              Your intelligent daily life assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">

          <div
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:flex ${
              isOnline
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-red-500/20 bg-red-500/10 text-red-400'
            }`}
          >
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <button
            type="button"
            onClick={onOpenTranslator}
            className="hidden h-10 items-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-300 sm:flex"
          >
            Translate
          </button>

          <button
            type="button"
            onClick={onOpenVoice}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300"
            aria-label="Voice assistant"
          >
            <Mic size={18} />
          </button>

          <button
            type="button"
            onClick={onTogglePhoneFrame}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 lg:flex"
            aria-label="Toggle device preview"
          >
            {isPhoneFrame ? <Monitor size={18} /> : <Smartphone size={18} />}
          </button>

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
    { id: 'home' as TabType, label: 'Home', icon: Home },
    { id: 'search' as TabType, label: 'Search', icon: Search },
    { id: 'learn' as TabType, label: 'Learn', icon: BookOpen },
    { id: 'planner' as TabType, label: 'Planner', icon: Calendar },
    { id: 'profile' as TabType, label: 'Profile', icon: User },
  ];

  return (
    <nav
      className="safe-bottom fixed bottom-0 left-0 right-0 z-[99999] pointer-events-auto border-t border-white/10 bg-slate-950"
      style={{
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectTab(tab.id);
              }}
              className={`relative z-[100000] flex min-w-[62px] cursor-pointer flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-medium transition-all active:scale-90 sm:min-w-[72px] sm:text-xs ${
                active
                  ? 'bg-indigo-500/15 text-indigo-400'
                  : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
              }`}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                  active ? 'bg-indigo-500/15' : ''
                }`}
              >
                <Icon
                  size={19}
                  strokeWidth={active ? 2.5 : 2}
                />
              </div>

              <span>{tab.label}</span>

              {active && (
                <span className="absolute bottom-1 h-0.5 w-5 rounded-full bg-indigo-400" />
              )}
            </button>
          );
        })}

      </div>
    </nav>
  );
}
