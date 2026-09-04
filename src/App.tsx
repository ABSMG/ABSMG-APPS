import React, { useState, useEffect } from 'react';
import { Storage } from './lib/storage';
import {
  TabType,
  UserProfile,
  MemoryItem,
  PlannerItem,
  HabitItem,
  ChatMessage,
  SmartAction,
} from './types';
import { TopHeader, BottomNav } from './components/Navigation';
import { HomeView } from './components/HomeView';
import { SearchView } from './components/SearchView';
import { PlannerView } from './components/PlannerView';
import { LearnView } from './components/LearnView';
import { ProfileView } from './components/ProfileView';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { TranslatorModal } from './components/TranslatorModal';
import { SmartActionModal } from './components/SmartActionModal';
import { OnboardingModal } from './components/OnboardingModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [user, setUser] = useState<UserProfile>(() => Storage.getUser());
  const [memories, setMemories] = useState<MemoryItem[]>(() => Storage.getMemories());
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>(() => Storage.getPlannerItems());
  const [habits, setHabits] = useState<HabitItem[]>(() => Storage.getHabits());
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => Storage.getChatHistory());

  // App Shell States
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isPhoneFrame, setIsPhoneFrame] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Modals
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isTranslatorOpen, setIsTranslatorOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<SmartAction | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    return !localStorage.getItem('lifeos_onboarding_completed');
  });

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save changes to storage
  const handleUpdateUser = (updated: Partial<UserProfile>) => {
    const nextUser = { ...user, ...updated };
    setUser(nextUser);
    Storage.saveUser(nextUser);
  };

  const handleToggleTask = (id: string) => {
    const updated = plannerItems.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setPlannerItems(updated);
    Storage.savePlannerItems(updated);
  };

  const handleAddTask = (item: Omit<PlannerItem, 'id'>) => {
    const category = item.category?.trim();
    let tags = (item.tags || []).map((t) => t.trim()).filter(Boolean);
    if (category && !tags.includes(category)) {
      tags = [category, ...tags];
    }
    tags = Array.from(new Set(tags));

    const newItem: PlannerItem = {
      ...item,
      id: `task_${Date.now()}`,
      category: category || (tags[0] ?? 'General'),
      tags,
    };
    const updated = [newItem, ...plannerItems];
    setPlannerItems(updated);
    Storage.savePlannerItems(updated);
  };

  const handleToggleHabit = (id: string) => {
    const updated = habits.map((h) => {
      if (h.id === id) {
        const nextState = !h.completedToday;
        return {
          ...h,
          completedToday: nextState,
          streak: nextState ? h.streak + 1 : Math.max(0, h.streak - 1),
        };
      }
      return h;
    });
    setHabits(updated);
    Storage.saveHabits(updated);
  };

  const handleAddMemory = (content: string, category: any) => {
    const newMem: MemoryItem = {
      id: `mem_${Date.now()}`,
      content,
      category,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updated = [newMem, ...memories];
    setMemories(updated);
    Storage.saveMemories(updated);
  };

  const handleDeleteMemory = (id: string) => {
    const updated = memories.filter((m) => m.id !== id);
    setMemories(updated);
    Storage.saveMemories(updated);
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...chatHistory, userMsg];
    setChatHistory(nextHistory);
    Storage.saveChatHistory(nextHistory);
    setIsLoadingAI(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
          userProfile: user,
          memories,
        }),
      });

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'I processed your request.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detectedAction: data.detectedAction || null,
      };

      const finalHistory = [...nextHistory, assistantMsg];
      setChatHistory(finalHistory);
      Storage.saveChatHistory(finalHistory);

      // Check if new memory proposed
      if (data.newMemory && typeof data.newMemory === 'string' && data.newMemory.trim()) {
        handleAddMemory(data.newMemory.trim(), 'fact');
      }

      // Check if structured action detected
      if (data.detectedAction) {
        setPendingAction(data.detectedAction);
      }
    } catch (e) {
      console.error('Assistant error', e);
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content:
          'I am currently operating in offline mode. Connect an internet connection or verify your API settings to resume cloud reasoning.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory([...nextHistory, errorMsg]);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleConfirmSmartAction = (finalAction: SmartAction) => {
    const category = finalAction.category || 'General';
    const newItem: PlannerItem = {
      id: `action_${Date.now()}`,
      title: finalAction.title,
      type: finalAction.type === 'REMINDER' ? 'reminder' : 'task',
      date: finalAction.date || new Date().toISOString().split('T')[0],
      time: finalAction.time || '09:00 AM',
      completed: false,
      priority: 'high',
      category,
      tags: [category],
    };

    const updated = [newItem, ...plannerItems];
    setPlannerItems(updated);
    Storage.savePlannerItems(updated);
    setPendingAction(null);

    // Add confirmation feedback message to chat
    const confirmMsg: ChatMessage = {
      id: `msg_c_${Date.now()}`,
      role: 'assistant',
      content: `Action confirmed: Added "${finalAction.title}" to your ${
        finalAction.type === 'REMINDER' ? 'Reminders' : 'Daily Planner'
      } for ${finalAction.date || 'Today'} at ${finalAction.time || '09:00 AM'}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const finalHistory = [...chatHistory, confirmMsg];
    setChatHistory(finalHistory);
    Storage.saveChatHistory(finalHistory);
  };

  const handleCompleteOnboarding = (updatedProfile: Partial<UserProfile>, initialPrompt?: string) => {
    handleUpdateUser(updatedProfile);
    localStorage.setItem('lifeos_onboarding_completed', 'true');
    setIsOnboardingOpen(false);
    if (initialPrompt) {
      handleSendMessage(initialPrompt);
    }
  };

  const handleClearAllData = () => {
    Storage.clearAllData();
    setUser(Storage.getUser());
    setMemories(Storage.getMemories());
    setPlannerItems(Storage.getPlannerItems());
    setHabits(Storage.getHabits());
    setChatHistory(Storage.getChatHistory());
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex justify-center ${isPhoneFrame ? 'p-4 sm:p-8 bg-slate-900' : ''}`}>
      {/* Container wrapper (Direct or Simulated Mobile Device Frame) */}
      <div
        className={`w-full flex flex-col transition-all duration-300 ${
          isPhoneFrame
            ? 'max-w-[420px] h-[860px] max-h-[92vh] rounded-[44px] border-[8px] border-slate-800 shadow-2xl shadow-black overflow-hidden relative bg-slate-950'
            : 'max-w-2xl min-h-screen relative'
        }`}
      >
        {/* Simulated Phone Notch / Speaker for Phone Frame */}
        {isPhoneFrame && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-full z-40 flex items-center justify-center">
            <div className="w-10 h-1 bg-slate-800 rounded-full" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-950 ml-2 border border-slate-800" />
          </div>
        )}

        {/* Global Navigation Header */}
        <TopHeader
          user={user}
          isOnline={isOnline}
          isPhoneFrame={isPhoneFrame}
          onTogglePhoneFrame={() => setIsPhoneFrame(!isPhoneFrame)}
          onOpenVoice={() => setIsVoiceOpen(true)}
          onOpenTranslator={() => setIsTranslatorOpen(true)}
        />

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto">
          {currentTab === 'home' && (
            <HomeView
              user={user}
              chatHistory={chatHistory}
              plannerItems={plannerItems}
              onSendMessage={handleSendMessage}
              isLoading={isLoadingAI}
              onOpenVoice={() => setIsVoiceOpen(true)}
              onToggleTask={handleToggleTask}
              onSelectAction={(action) => setPendingAction(action)}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'search' && (
            <SearchView
              onTriggerAction={(act) => {
                setCurrentTab('home');
                handleSendMessage(act);
              }}
              preferredLanguage={user.preferredLanguage}
            />
          )}

          {currentTab === 'learn' && <LearnView />}

          {currentTab === 'planner' && (
            <PlannerView
              plannerItems={plannerItems}
              habits={habits}
              onToggleTask={handleToggleTask}
              onAddTask={handleAddTask}
              onToggleHabit={handleToggleHabit}
            />
          )}

          {currentTab === 'profile' && (
            <ProfileView
              user={user}
              memories={memories}
              onUpdateUser={handleUpdateUser}
              onAddMemory={handleAddMemory}
              onDeleteMemory={handleDeleteMemory}
              onExportData={Storage.exportAllDataJSON}
              onClearAllData={handleClearAllData}
            />
          )}
        </main>

        {/* Global Bottom Navigation */}
        <BottomNav
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          onOpenVoice={() => setIsVoiceOpen(true)}
          user={user}
          isOnline={isOnline}
          isPhoneFrame={isPhoneFrame}
          onTogglePhoneFrame={() => setIsPhoneFrame(!isPhoneFrame)}
          onOpenTranslator={() => setIsTranslatorOpen(true)}
        />

        {/* Modals & Overlays */}
        <VoiceAssistantModal
          isOpen={isVoiceOpen}
          onClose={() => setIsVoiceOpen(false)}
          onSubmitVoicePrompt={(prompt) => {
            setCurrentTab('home');
            handleSendMessage(prompt);
          }}
          preferredLanguage={user.preferredLanguage}
        />

        <TranslatorModal
          isOpen={isTranslatorOpen}
          onClose={() => setIsTranslatorOpen(false)}
        />

        <SmartActionModal
          action={pendingAction}
          onConfirm={handleConfirmSmartAction}
          onCancel={() => setPendingAction(null)}
        />

        <OnboardingModal
          isOpen={isOnboardingOpen}
          onComplete={handleCompleteOnboarding}
        />
      </div>
    </div>
  );
}
