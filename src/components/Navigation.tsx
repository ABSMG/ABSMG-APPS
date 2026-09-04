import React from 'react';
import { Home, Search, BookOpen, Calendar, User, Mic, Wifi, WifiOff, Smartphone, Monitor } from 'lucide-react';
import { TabType, UserProfile } from '../types';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenVoice: () => void;
  user: UserProfile;
  isOnline: boolean;
  isPhoneFrame: boolean;
  onTogglePhoneFrame: () => void;
  onOpenTranslator: () => void;
}

export const TopHeader: React.FC<{
  user: UserProfile;
  isOnline: boolean;
  isPhoneFrame: boolean;
  onTogglePhoneFrame: () => void;
  onOpenVoice: () => void;
  onOpenTranslator: () => void;
}> = ({ user, isOnline, isPhoneFrame, onTogglePhoneFrame, onOpenVoice, onOpenTranslator }) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-2.5">
        {/* LifeOS Stylized Brand Icon */}
        <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-sm shadow-indigo-500/20 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
            <span className="font-mono text-sm font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
              L
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-100 tracking-tight text-base font-sans">
              LifeOS
            </span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {user.tier}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Ask. Plan. Learn. Do.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Low-data / Connectivity indicator */}
        <div
          title={isOnline ? (user.lowDataMode ? 'Low Data Mode Active' : 'Online') : 'Offline Mode Active'}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
            !isOnline
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : user.lowDataMode
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}
        >
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          <span className="text-[10px] font-medium hidden xs:inline">
            {!isOnline ? 'Offline' : user.lowDataMode ? 'Low-Data' : 'Sync'}
          </span>
        </div>

        {/* Quick Translate Button */}
        <button
          onClick={onOpenTranslator}
          className="p-1.5 text-xs rounded-lg text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
          title="Instant Translator"
        >
          <span className="text-xs">🌐</span>
        </button>

        {/* Voice Trigger */}
        <button
          onClick={onOpenVoice}
          className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 transition-all flex items-center justify-center active:scale-95"
          title="Voice Assistant"
        >
          <Mic className="w-4 h-4 text-indigo-400" />
        </button>

        {/* Frame Toggle (For mobile app feel on desktop) */}
        <button
          onClick={onTogglePhoneFrame}
          className="hidden md:flex p-2 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800 transition-colors"
          title={isPhoneFrame ? 'Switch to Full-Width View' : 'Preview as Mobile Device'}
        >
          {isPhoneFrame ? (
            <Monitor className="w-4 h-4" />
          ) : (
            <Smartphone className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};

export const BottomNav: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'learn', label: 'Learn', icon: BookOpen },
    { id: 'planner', label: 'Planner', icon: Calendar },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 max-w-md mx-auto md:max-w-none md:static bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 transition-colors">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id as TabType)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-200 min-w-[58px] ${
                isActive
                  ? 'text-indigo-400 font-semibold scale-105'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full" />
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
