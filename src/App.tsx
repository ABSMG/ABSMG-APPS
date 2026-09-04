import React, { useEffect, useRef, useState } from 'react';
import { Storage } from './lib/storage';
import {
  getCurrentSession,
  loadCloudData,
  saveCloudData,
  signIn,
  signUp,
  signOut,
} from './lib/cloudSync';
import { supabase, isSupabaseConfigured } from './lib/supabase';

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

const AI_TIMEOUT_MS = 30000;
const MAX_HISTORY = 4;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_MEMORY_ITEMS = 6;
const MAX_MEMORY_LENGTH = 500;
const CLOUD_SYNC_DELAY = 1200;

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('home');

  const [user, setUser] = useState<UserProfile>(() =>
    Storage.getUser()
  );

  const [memories, setMemories] = useState<MemoryItem[]>(() =>
    Storage.getMemories()
  );

  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>(() =>
    Storage.getPlannerItems()
  );

  const [habits, setHabits] = useState<HabitItem[]>(() =>
    Storage.getHabits()
  );

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() =>
    Storage.getChatHistory()
  );

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [isPhoneFrame, setIsPhoneFrame] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isTranslatorOpen, setIsTranslatorOpen] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<SmartAction | null>(null);

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    return !localStorage.getItem('lifeos_onboarding_completed');
  });

  // Supabase state
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);

  const cloudSyncTimer = useRef<number | null>(null);

  /*
   * ---------------------------------------------------------
   * ONLINE / OFFLINE
   * ---------------------------------------------------------
   */

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

  /*
   * ---------------------------------------------------------
   * LOAD SUPABASE SESSION
   * ---------------------------------------------------------
   */

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      if (!isSupabaseConfigured) {
        setCloudReady(false);
        return;
      }

      try {
        const session = await getCurrentSession();

        if (!mounted) return;

        if (session?.user) {
          await handleCloudLogin(
            session.user.id,
            session.user.email || ''
          );
        } else {
          setCloudUserId(null);
          setCloudEmail('');
          setCloudReady(false);
        }
      } catch (error) {
        console.error('Supabase session error:', error);
        if (mounted) {
          setCloudReady(false);
        }
      }
    };

    loadSession();

    let unsubscribe: (() => void) | undefined;

    if (supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!mounted) return;

        if (session?.user) {
          await handleCloudLogin(
            session.user.id,
            session.user.email || ''
          );
        } else {
          setCloudUserId(null);
          setCloudEmail('');
          setCloudReady(false);
        }
      });

      unsubscribe = () => subscription.unsubscribe();
    }

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * CLOUD LOGIN / LOAD DATA
   * ---------------------------------------------------------
   */

  const handleCloudLogin = async (
    userId: string,
    email: string
  ) => {
    setCloudUserId(userId);
    setCloudEmail(email);

    try {
      setCloudBusy(true);

      const cloudData = await loadCloudData(userId);

      if (cloudData) {
        // Cloud becomes source of truth when data exists.
        setUser(cloudData.user);
        setMemories(cloudData.memories || []);
        setPlannerItems(cloudData.plannerItems || []);
        setHabits(cloudData.habits || []);
        setChatHistory(cloudData.chatHistory || []);

        Storage.saveUser(cloudData.user);
        Storage.saveMemories(cloudData.memories || []);
        Storage.savePlannerItems(cloudData.plannerItems || []);
        Storage.saveHabits(cloudData.habits || []);
        Storage.saveChatHistory(cloudData.chatHistory || []);
      } else {
        // First login: upload existing local data.
        await saveCloudData(userId, {
          user,
          memories,
          plannerItems,
          habits,
          chatHistory,
        });
      }

      setCloudReady(true);
    } catch (error) {
      console.error('Cloud data load error:', error);
      setCloudReady(false);
    } finally {
      setCloudBusy(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * AUTOMATIC CLOUD SYNC
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!cloudUserId || !cloudReady || !isSupabaseConfigured) {
      return;
    }

    if (cloudSyncTimer.current) {
      window.clearTimeout(cloudSyncTimer.current);
    }

    cloudSyncTimer.current = window.setTimeout(async () => {
      try {
        await saveCloudData(cloudUserId, {
          user,
          memories,
          plannerItems,
          habits,
          chatHistory,
        });
      } catch (error) {
        console.error('Cloud sync error:', error);
      }
    }, CLOUD_SYNC_DELAY);

    return () => {
      if (cloudSyncTimer.current) {
        window.clearTimeout(cloudSyncTimer.current);
      }
    };
  }, [
    cloudUserId,
    cloudReady,
    user,
    memories,
    plannerItems,
    habits,
    chatHistory,
  ]);

  /*
   * ---------------------------------------------------------
   * AUTH ACTIONS
   * ---------------------------------------------------------
   */

  const handleCloudSignIn = async (
    email: string,
    password: string
  ) => {
    setCloudBusy(true);

    try {
      const { data, error } = await signIn(email, password);

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error('Login failed.');
      }

      await handleCloudLogin(
        data.user.id,
        data.user.email || email
      );

      return {
        success: true,
        message: 'Login successful.',
      };
    } catch (error: any) {
      console.error('Sign in error:', error);

      return {
        success: false,
        message:
          error?.message ||
          'Login failed. Please check your email and password.',
      };
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudSignUp = async (
    email: string,
    password: string
  ) => {
    setCloudBusy(true);

    try {
      const { data, error } = await signUp(email, password);

      if (error) {
        throw error;
      }

      if (data.session?.user) {
        await handleCloudLogin(
          data.session.user.id,
          data.session.user.email || email
        );

        return {
          success: true,
          message: 'Account created successfully.',
        };
      }

      return {
        success: true,
        message:
          'Account created. Please check your email to confirm your account.',
      };
    } catch (error: any) {
      console.error('Sign up error:', error);

      return {
        success: false,
        message:
          error?.message ||
          'Could not create your account.',
      };
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudSignOut = async () => {
    setCloudBusy(true);

    try {
      await signOut();

      setCloudUserId(null);
      setCloudEmail('');
      setCloudReady(false);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setCloudBusy(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * USER
   * ---------------------------------------------------------
   */

  const handleUpdateUser = (
    updated: Partial<UserProfile>
  ) => {
    const nextUser = {
      ...user,
      ...updated,
    };

    setUser(nextUser);
    Storage.saveUser(nextUser);
  };

  /*
   * ---------------------------------------------------------
   * PLANNER
   * ---------------------------------------------------------
   */

  const handleToggleTask = (id: string) => {
    const updated = plannerItems.map((item) =>
      item.id === id
        ? {
            ...item,
            completed: !item.completed,
          }
        : item
    );

    setPlannerItems(updated);
    Storage.savePlannerItems(updated);
  };

  const handleAddTask = (
    item: Omit<PlannerItem, 'id'>
  ) => {
    const category = item.category?.trim();

    let tags = (item.tags || [])
      .map((t) => t.trim())
      .filter(Boolean);

    if (category && !tags.includes(category)) {
      tags = [category, ...tags];
    }

    tags = Array.from(new Set(tags));

    const newItem: PlannerItem = {
      ...item,
      id: `task_${Date.now()}`,
      category:
        category ||
        tags[0] ||
        'General',
      tags,
    };

    const updated = [
      newItem,
      ...plannerItems,
    ];

    setPlannerItems(updated);
    Storage.savePlannerItems(updated);
  };

  /*
   * ---------------------------------------------------------
   * HABITS
   * ---------------------------------------------------------
   */

  const handleToggleHabit = (id: string) => {
    const updated = habits.map((habit) => {
      if (habit.id !== id) return habit;

      const nextState =
        !habit.completedToday;

      return {
        ...habit,
        completedToday: nextState,
        streak: nextState
          ? habit.streak + 1
          : Math.max(
              0,
              habit.streak - 1
            ),
      };
    });

    setHabits(updated);
    Storage.saveHabits(updated);
  };

  /*
   * ---------------------------------------------------------
   * MEMORY
   * ---------------------------------------------------------
   */

  const handleAddMemory = (
    content: string,
    category: any
  ) => {
    const cleanContent =
      content.trim();

    if (!cleanContent) return;

    const newMem: MemoryItem = {
      id: `mem_${Date.now()}`,
      content: cleanContent,
      category,
      createdAt:
        new Date()
          .toISOString()
          .split('T')[0],
    };

    const updated = [
      newMem,
      ...memories,
    ];

    setMemories(updated);
    Storage.saveMemories(updated);
  };

  const handleDeleteMemory = (
    id: string
  ) => {
    const updated =
      memories.filter(
        (memory) =>
          memory.id !== id
      );

    setMemories(updated);
    Storage.saveMemories(updated);
  };

  /*
   * ---------------------------------------------------------
   * AI
   * ---------------------------------------------------------
   */

  const handleSendMessage = async (
    text: string
  ) => {
    const cleanText =
      text.trim();

    if (
      !cleanText ||
      isLoadingAI
    ) {
      return;
    }

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: cleanText,
      timestamp:
        new Date().toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit',
          }
        ),
    };

    const nextHistory = [
      ...chatHistory,
      userMsg,
    ];

    setChatHistory(nextHistory);
    Storage.saveChatHistory(nextHistory);
    setIsLoadingAI(true);

    const controller =
      new AbortController();

    const timeoutId =
      window.setTimeout(() => {
        controller.abort();
      }, AI_TIMEOUT_MS);

    try {
      const recentHistory =
        nextHistory
          .slice(-MAX_HISTORY)
          .map((message) => ({
            role: message.role,
            content: String(
              message.content || ''
            ).slice(0, 1200),
          }));

      const recentMemories =
        memories
          .slice(
            0,
            MAX_MEMORY_ITEMS
          )
          .map((memory) => ({
            content: String(
              memory.content || ''
            ).slice(
              0,
              MAX_MEMORY_LENGTH
            ),
          }));

      const safeProfile = {
        name: user?.name || '',
        preferredLanguage:
          user?.preferredLanguage ||
          'en',
        goals: String(
          user?.goals || ''
        ).slice(0, 500),
      };

      const response =
        await fetch(
          '/api/ai/assistant',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            signal:
              controller.signal,
            body: JSON.stringify({
              message:
                cleanText.slice(
                  0,
                  MAX_MESSAGE_LENGTH
                ),
              history:
                recentHistory,
              userProfile:
                safeProfile,
              memories:
                recentMemories,
            }),
          }
        );

      if (!response.ok) {
        let serverMessage =
          'AI request failed.';

        try {
          const errorData =
            await response.json();

          serverMessage =
            errorData?.error ||
            errorData?.reply ||
            serverMessage;
        } catch {
          // Ignore invalid response.
        }

        throw new Error(
          serverMessage
        );
      }

      const data =
        await response.json();

      const assistantMsg: ChatMessage = {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content:
          typeof data.reply ===
            'string' &&
          data.reply.trim()
            ? data.reply.trim()
            : 'I processed your request.',
        timestamp:
          new Date().toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          ),
        detectedAction:
          data.detectedAction ||
          null,
      };

      const finalHistory = [
        ...nextHistory,
        assistantMsg,
      ];

      setChatHistory(
        finalHistory
      );

      Storage.saveChatHistory(
        finalHistory
      );

      if (
        data.newMemory &&
        typeof data.newMemory ===
          'string' &&
        data.newMemory.trim()
      ) {
        handleAddMemory(
          data.newMemory.trim(),
          'fact'
        );
      }

      if (data.detectedAction) {
        setPendingAction(
          data.detectedAction
        );
      }
    } catch (error: any) {
      console.error(
        'Nodysom AI error:',
        error
      );

      let errorText =
        'Nodysom AI is temporarily unavailable. Please try again.';

      if (
        error?.name ===
        'AbortError'
      ) {
        errorText =
          'The AI request took too long. Please try again.';
      } else if (
        !isOnline
      ) {
        errorText =
          'You are offline. Please check your internet connection and try again.';
      }

      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: errorText,
        timestamp:
          new Date().toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          ),
      };

      const errorHistory = [
        ...nextHistory,
        errorMsg,
      ];

      setChatHistory(
        errorHistory
      );

      Storage.saveChatHistory(
        errorHistory
      );
    } finally {
      window.clearTimeout(
        timeoutId
      );

      setIsLoadingAI(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * SMART ACTION
   * ---------------------------------------------------------
   */

  const handleConfirmSmartAction = (
    finalAction: SmartAction
  ) => {
    const category =
      finalAction.category ||
      'General';

    const newItem: PlannerItem = {
      id: `action_${Date.now()}`,
      title:
        finalAction.title,
      type:
        finalAction.type ===
        'REMINDER'
          ? 'reminder'
          : 'task',
      date:
        finalAction.date ||
        new Date()
          .toISOString()
          .split('T')[0],
      time:
        finalAction.time ||
        '09:00 AM',
      completed: false,
      priority: 'high',
      category,
      tags: [category],
    };

    const updated = [
      newItem,
      ...plannerItems,
    ];

    setPlannerItems(updated);
    Storage.savePlannerItems(
      updated
    );

    setPendingAction(null);

    const confirmMsg: ChatMessage = {
      id: `msg_c_${Date.now()}`,
      role: 'assistant',
      content: `Action confirmed: Added "${finalAction.title}" to your ${
        finalAction.type ===
        'REMINDER'
          ? 'Reminders'
          : 'Daily Planner'
      } for ${
        finalAction.date ||
        'Today'
      } at ${
        finalAction.time ||
        '09:00 AM'
      }.`,
      timestamp:
        new Date().toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit',
          }
        ),
    };

    const finalHistory = [
      ...chatHistory,
      confirmMsg,
    ];

    setChatHistory(
      finalHistory
    );

    Storage.saveChatHistory(
      finalHistory
    );
  };

  /*
   * ---------------------------------------------------------
   * ONBOARDING
   * ---------------------------------------------------------
   */

  const handleCompleteOnboarding = (
    updatedProfile: Partial<UserProfile>,
    initialPrompt?: string
  ) => {
    handleUpdateUser(
      updatedProfile
    );

    localStorage.setItem(
      'lifeos_onboarding_completed',
      'true'
    );

    setIsOnboardingOpen(false);

    if (initialPrompt) {
      handleSendMessage(
        initialPrompt
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * CLEAR DATA
   * ---------------------------------------------------------
   */

  const handleClearAllData = () => {
    Storage.clearAllData();

    setUser(
      Storage.getUser()
    );

    setMemories(
      Storage.getMemories()
    );

    setPlannerItems(
      Storage.getPlannerItems()
    );

    setHabits(
      Storage.getHabits()
    );

    setChatHistory(
      Storage.getChatHistory()
    );
  };

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-100 flex justify-center ${
        isPhoneFrame
          ? 'p-4 sm:p-8 bg-slate-900'
          : ''
      }`}
    >
      <div
        className={`w-full flex flex-col transition-all duration-300 ${
          isPhoneFrame
            ? 'max-w-[420px] h-[860px] max-h-[92vh] rounded-[44px] border-[8px] border-slate-800 shadow-2xl shadow-black overflow-hidden relative bg-slate-950'
            : 'max-w-2xl min-h-screen relative'
        }`}
      >
        {isPhoneFrame && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-full z-40 flex items-center justify-center">
            <div className="w-10 h-1 bg-slate-800 rounded-full" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-950 ml-2 border border-slate-800" />
          </div>
        )}

        <TopHeader
          user={user}
          isOnline={isOnline}
          isPhoneFrame={isPhoneFrame}
          onTogglePhoneFrame={() =>
            setIsPhoneFrame(
              !isPhoneFrame
            )
          }
          onOpenVoice={() =>
            setIsVoiceOpen(true)
          }
          onOpenTranslator={() =>
            setIsTranslatorOpen(
              true
            )
          }
        />

        <main className="flex-1 overflow-y-auto">
          {currentTab === 'home' && (
            <HomeView
              user={user}
              chatHistory={
                chatHistory
              }
              plannerItems={
                plannerItems
              }
              onSendMessage={
                handleSendMessage
              }
              isLoading={
                isLoadingAI
              }
              onOpenVoice={() =>
                setIsVoiceOpen(
                  true
                )
              }
              onToggleTask={
                handleToggleTask
              }
              onSelectAction={(
                action
              ) =>
                setPendingAction(
                  action
                )
              }
              onNavigateTab={(
                tab
              ) =>
                setCurrentTab(
                  tab
                )
              }
            />
          )}

          {currentTab ===
            'search' && (
            <SearchView
              onTriggerAction={(
                act
              ) => {
                setCurrentTab(
                  'home'
                );

                handleSendMessage(
                  act
                );
              }}
              preferredLanguage={
                user.preferredLanguage
              }
            />
          )}

          {currentTab === 'learn' && (
            <LearnView />
          )}

          {currentTab ===
            'planner' && (
            <PlannerView
              plannerItems={
                plannerItems
              }
              habits={habits}
              onToggleTask={
                handleToggleTask
              }
              onAddTask={
                handleAddTask
              }
              onToggleHabit={
                handleToggleHabit
              }
            />
          )}

          {currentTab ===
            'profile' && (
            <ProfileView
              user={user}
              memories={memories}
              onUpdateUser={
                handleUpdateUser
              }
              onAddMemory={
                handleAddMemory
              }
              onDeleteMemory={
                handleDeleteMemory
              }
              onExportData={
                Storage.exportAllDataJSON
              }
              onClearAllData={
                handleClearAllData
              }

              /* Cloud account props */
              cloudEnabled={
                isSupabaseConfigured
              }
              cloudEmail={
                cloudEmail
              }
              cloudBusy={
                cloudBusy
              }
              onSignIn={
                handleCloudSignIn
              }
              onSignUp={
                handleCloudSignUp
              }
              onSignOut={
                handleCloudSignOut
              }
            />
          )}
        </main>

        <BottomNav
          currentTab={
            currentTab
          }
          onSelectTab={(tab) =>
            setCurrentTab(tab)
          }
          onOpenVoice={() =>
            setIsVoiceOpen(true)
          }
          user={user}
          isOnline={isOnline}
          isPhoneFrame={
            isPhoneFrame
          }
          onTogglePhoneFrame={() =>
            setIsPhoneFrame(
              !isPhoneFrame
            )
          }
          onOpenTranslator={() =>
            setIsTranslatorOpen(
              true
            )
          }
        />

        <VoiceAssistantModal
          isOpen={isVoiceOpen}
          onClose={() =>
            setIsVoiceOpen(false)
          }
          onSubmitVoicePrompt={(
            prompt
          ) => {
            setCurrentTab(
              'home'
            );

            handleSendMessage(
              prompt
            );
          }}
          preferredLanguage={
            user.preferredLanguage
          }
        />

        <TranslatorModal
          isOpen={
            isTranslatorOpen
          }
          onClose={() =>
            setIsTranslatorOpen(
              false
            )
          }
        />

        <SmartActionModal
          action={
            pendingAction
          }
          onConfirm={
            handleConfirmSmartAction
          }
          onCancel={() =>
            setPendingAction(null)
          }
        />

        <OnboardingModal
          isOpen={
            isOnboardingOpen
          }
          onComplete={
            handleCompleteOnboarding
          }
        />
      </div>
    </div>
  );
}
