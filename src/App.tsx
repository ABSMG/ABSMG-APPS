import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Storage } from './lib/storage';

import {
  getCurrentSession,
  loadCloudData,
  saveCloudData,
  signIn,
  signUp,
  signOut,
} from './lib/cloudSync';

import {
  supabase,
  isSupabaseConfigured,
} from './lib/supabase';

import {
  TabType,
  UserProfile,
  MemoryItem,
  PlannerItem,
  HabitItem,
  ChatMessage,
  SmartAction,
} from './types';

import {
  TopHeader,
  BottomNav,
} from './components/Navigation';

import { HomeView } from './components/HomeView';
import { SearchView } from './components/SearchView';
import { PlannerView } from './components/PlannerView';
import { LearnView } from './components/LearnView';
import { ProfileView } from './components/ProfileView';
import {
  VoiceAssistantModal,
} from './components/VoiceAssistantModal';
import {
  TranslatorModal,
} from './components/TranslatorModal';
import {
  SmartActionModal,
} from './components/SmartActionModal';
import {
  OnboardingModal,
} from './components/OnboardingModal';

const AI_TIMEOUT_MS = 120000;

const MAX_HISTORY = 6;

const MAX_MESSAGE_LENGTH = 2000;

const MAX_MEMORY_ITEMS = 6;

const MAX_MEMORY_LENGTH = 500;

const CLOUD_SYNC_DELAY = 1200;

const ONBOARDING_KEY =
  'lifeos_onboarding_completed';

export default function App() {
  // =========================================================
  // APP STATE
  // =========================================================

  const [currentTab, setCurrentTab] =
    useState<TabType>('home');

  const [user, setUser] =
    useState<UserProfile>(() =>
      Storage.getUser()
    );

  const [memories, setMemories] =
    useState<MemoryItem[]>(() =>
      Storage.getMemories()
    );

  const [plannerItems, setPlannerItems] =
    useState<PlannerItem[]>(() =>
      Storage.getPlannerItems()
    );

  const [habits, setHabits] =
    useState<HabitItem[]>(() =>
      Storage.getHabits()
    );

  const [chatHistory, setChatHistory] =
    useState<ChatMessage[]>(() =>
      Storage.getChatHistory()
    );

  const [isOnline, setIsOnline] =
    useState(
      typeof navigator !== 'undefined'
        ? navigator.onLine
        : true
    );

  const [isPhoneFrame, setIsPhoneFrame] =
    useState(false);

  const [isLoadingAI, setIsLoadingAI] =
    useState(false);

  const [isVoiceOpen, setIsVoiceOpen] =
    useState(false);

  const [isTranslatorOpen, setIsTranslatorOpen] =
    useState(false);

  const [pendingAction, setPendingAction] =
    useState<SmartAction | null>(null);

  const [isOnboardingOpen, setIsOnboardingOpen] =
    useState(() => {
      try {
        return !localStorage.getItem(
          ONBOARDING_KEY
        );
      } catch {
        return true;
      }
    });

  // =========================================================
  // SUPABASE STATE
  // =========================================================

  const [cloudUserId, setCloudUserId] =
    useState<string | null>(null);

  const [cloudEmail, setCloudEmail] =
    useState('');

  const [cloudBusy, setCloudBusy] =
    useState(false);

  /**
   * IMPORTANT:
   *
   * cloudReady becomes true ONLY after cloud data has
   * successfully been loaded or initialized.
   *
   * Automatic sync is blocked until this happens.
   */
  const [cloudReady, setCloudReady] =
    useState(false);

  /**
   * Prevents an old/slow cloud login request from applying
   * data after another login/logout has already happened.
   */
  const cloudRequestId =
    useRef(0);

  /**
   * Prevents automatic sync from accidentally overwriting
   * cloud data while hydration is still happening.
   */
  const cloudHydrated =
    useRef(false);

  /**
   * Prevents duplicate cloud saves.
   */
  const cloudSyncTimer =
    useRef<number | null>(null);

  /**
   * Prevents state updates after component unmount.
   */
  const mountedRef =
    useRef(true);

  // =========================================================
  // MOUNT / UNMOUNT
  // =========================================================

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (
        cloudSyncTimer.current !== null
      ) {
        window.clearTimeout(
          cloudSyncTimer.current
        );
      }
    };
  }, []);

  // =========================================================
  // ONLINE / OFFLINE
  // =========================================================

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener(
      'online',
      handleOnline
    );

    window.addEventListener(
      'offline',
      handleOffline
    );

    return () => {
      window.removeEventListener(
        'online',
        handleOnline
      );

      window.removeEventListener(
        'offline',
        handleOffline
      );
    };
  }, []);

  // =========================================================
  // CLOUD LOGIN / HYDRATION
  // =========================================================

  const handleCloudLogin =
    useCallback(
      async (
        userId: string,
        email: string
      ) => {
        if (!userId) {
          return;
        }

        const requestId =
          ++cloudRequestId.current;

        cloudHydrated.current =
          false;

        setCloudReady(false);

        setCloudUserId(
          userId
        );

        setCloudEmail(
          email
        );

        setCloudBusy(true);

        try {
          const cloudData =
            await loadCloudData(
              userId
            );

          /**
           * Ignore this response if another auth action
           * happened while the request was running.
           */
          if (
            requestId !==
            cloudRequestId.current
          ) {
            return;
          }

          if (!mountedRef.current) {
            return;
          }

          // ---------------------------------------------------
          // EXISTING CLOUD ACCOUNT
          // ---------------------------------------------------

          if (cloudData) {
            const restoredUser =
              cloudData.user;

            const restoredMemories =
              Array.isArray(
                cloudData.memories
              )
                ? cloudData.memories
                : [];

            const restoredPlanner =
              Array.isArray(
                cloudData.plannerItems
              )
                ? cloudData.plannerItems
                : [];

            const restoredHabits =
              Array.isArray(
                cloudData.habits
              )
                ? cloudData.habits
                : [];

            const restoredChat =
              Array.isArray(
                cloudData.chatHistory
              )
                ? cloudData.chatHistory
                : [];

            /**
             * CLOUD IS THE SOURCE OF TRUTH AFTER LOGIN.
             *
             * Restore every data category together.
             */
            setUser(
              restoredUser
            );

            setMemories(
              restoredMemories
            );

            setPlannerItems(
              restoredPlanner
            );

            setHabits(
              restoredHabits
            );

            setChatHistory(
              restoredChat
            );

            /**
             * Also update local cache.
             */
            Storage.saveUser(
              restoredUser
            );

            Storage.saveMemories(
              restoredMemories
            );

            Storage.savePlannerItems(
              restoredPlanner
            );

            Storage.saveHabits(
              restoredHabits
            );

            Storage.saveChatHistory(
              restoredChat
            );

            /**
             * Mark hydration complete only AFTER every
             * cloud value has been applied.
             */
            cloudHydrated.current =
              true;

            setCloudReady(
              true
            );

            return;
          }

          // ---------------------------------------------------
          // NEW CLOUD ACCOUNT
          // ---------------------------------------------------

          /**
           * No cloud record exists yet.
           *
           * The current local data becomes the initial
           * cloud backup.
           */
          const initialCloudData = {
            user,
            memories,
            plannerItems,
            habits,
            chatHistory,
          };

          await saveCloudData(
            userId,
            initialCloudData
          );

          if (
            requestId !==
            cloudRequestId.current
          ) {
            return;
          }

          if (!mountedRef.current) {
            return;
          }

          cloudHydrated.current =
            true;

          setCloudReady(
            true
          );
        } catch (error) {
          console.error(
            'Cloud data load error:',
            error
          );

          if (
            requestId ===
            cloudRequestId.current
          ) {
            cloudHydrated.current =
              false;

            setCloudReady(
              false
            );
          }
        } finally {
          if (
            requestId ===
              cloudRequestId.current &&
            mountedRef.current
          ) {
            setCloudBusy(
              false
            );
          }
        }
      },
      [
        user,
        memories,
        plannerItems,
        habits,
        chatHistory,
      ]
    );

  // =========================================================
  // INITIAL SUPABASE SESSION
  // =========================================================

  useEffect(() => {
    let active = true;

    const loadSession =
      async () => {
        if (
          !isSupabaseConfigured
        ) {
          setCloudReady(
            false
          );

          cloudHydrated.current =
            false;

          return;
        }

        try {
          const session =
            await getCurrentSession();

          if (!active) {
            return;
          }

          if (session?.user) {
            await handleCloudLogin(
              session.user.id,
              session.user.email ||
                ''
            );
          } else {
            cloudRequestId.current++;

            cloudHydrated.current =
              false;

            setCloudUserId(
              null
            );

            setCloudEmail(
              ''
            );

            setCloudReady(
              false
            );
          }
        } catch (error) {
          console.error(
            'Supabase session error:',
            error
          );

          if (active) {
            cloudHydrated.current =
              false;

            setCloudReady(
              false
            );
          }
        }
      };

    loadSession();

    let unsubscribe:
      | (() => void)
      | undefined;

    if (supabase) {
      const {
        data: {
          subscription,
        },
      } =
        supabase.auth.onAuthStateChange(
          async (
            _event,
            session
          ) => {
            if (!active) {
              return;
            }

            if (session?.user) {
              await handleCloudLogin(
                session.user.id,
                session.user.email ||
                  ''
              );
            } else {
              cloudRequestId.current++;

              cloudHydrated.current =
                false;

              setCloudUserId(
                null
              );

              setCloudEmail(
                ''
              );

              setCloudReady(
                false
              );
            }
          }
        );

      unsubscribe = () => {
        subscription.unsubscribe();
      };
    }

    return () => {
      active = false;

      unsubscribe?.();
    };
  }, [
    handleCloudLogin,
  ]);

  // =========================================================
  // AUTOMATIC CLOUD SYNC
  // =========================================================

  useEffect(() => {
    /**
     * NEVER sync before hydration.
     *
     * This is the most important protection against
     * localStorage overwriting cloud chat history.
     */
    if (
      !cloudUserId ||
      !cloudReady ||
      !cloudHydrated.current ||
      !isSupabaseConfigured
    ) {
      return;
    }

    if (
      cloudSyncTimer.current !== null
    ) {
      window.clearTimeout(
        cloudSyncTimer.current
      );
    }

    cloudSyncTimer.current =
      window.setTimeout(
        async () => {
          /**
           * Check again immediately before writing.
           */
          if (
            !cloudUserId ||
            !cloudReady ||
            !cloudHydrated.current
          ) {
            return;
          }

          try {
            await saveCloudData(
              cloudUserId,
              {
                user,
                memories,
                plannerItems,
                habits,
                chatHistory,
              }
            );
          } catch (error) {
            console.error(
              'Cloud sync error:',
              error
            );
          }
        },
        CLOUD_SYNC_DELAY
      );

    return () => {
      if (
        cloudSyncTimer.current !==
        null
      ) {
        window.clearTimeout(
          cloudSyncTimer.current
        );
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

  // =========================================================
  // AUTH ACTIONS
  // =========================================================

  const handleCloudSignIn =
    async (
      email: string,
      password: string
    ) => {
      setCloudBusy(true);

      try {
        const {
          data,
          error,
        } =
          await signIn(
            email,
            password
          );

        if (error) {
          throw error;
        }

        if (!data.user) {
          throw new Error(
            'Login failed.'
          );
        }

        /**
         * Explicitly hydrate before reporting success.
         */
        await handleCloudLogin(
          data.user.id,
          data.user.email ||
            email
        );

        return {
          success: true,
          message:
            'Login successful. Your cloud data has been restored.',
        };
      } catch (error: any) {
        console.error(
          'Sign in error:',
          error
        );

        return {
          success: false,
          message:
            error?.message ||
            'Login failed. Please check your email and password.',
        };
      } finally {
        setCloudBusy(
          false
        );
      }
    };

  const handleCloudSignUp =
    async (
      email: string,
      password: string
    ) => {
      setCloudBusy(true);

      try {
        const {
          data,
          error,
        } =
          await signUp(
            email,
            password
          );

        if (error) {
          throw error;
        }

        if (
          data.session?.user
        ) {
          await handleCloudLogin(
            data.session.user.id,
            data.session.user.email ||
              email
          );

          return {
            success: true,
            message:
              'Account created successfully. Your data is now backed up.',
          };
        }

        return {
          success: true,
          message:
            'Account created. Please check your email to confirm your account.',
        };
      } catch (error: any) {
        console.error(
          'Sign up error:',
          error
        );

        return {
          success: false,
          message:
            error?.message ||
            'Could not create your account.',
        };
      } finally {
        setCloudBusy(
          false
        );
      }
    };

  const handleCloudSignOut =
    async () => {
      setCloudBusy(true);

      try {
        cloudRequestId.current++;

        cloudHydrated.current =
          false;

        if (
          cloudSyncTimer.current !==
          null
        ) {
          window.clearTimeout(
            cloudSyncTimer.current
          );
        }

        await signOut();

        setCloudUserId(
          null
        );

        setCloudEmail(
          ''
        );

        setCloudReady(
          false
        );
      } catch (error) {
        console.error(
          'Sign out error:',
          error
        );
      } finally {
        setCloudBusy(
          false
        );
      }
    };

  // =========================================================
  // USER
  // =========================================================

  const handleUpdateUser =
    (
      updated: Partial<UserProfile>
    ) => {
      const nextUser = {
        ...user,
        ...updated,
      };

      setUser(
        nextUser
      );

      Storage.saveUser(
        nextUser
      );
    };

  // =========================================================
  // PLANNER
  // =========================================================

  const handleToggleTask =
    (
      id: string
    ) => {
      const updated =
        plannerItems.map(
          (item) =>
            item.id === id
              ? {
                  ...item,
                  completed:
                    !item.completed,
                }
              : item
        );

      setPlannerItems(
        updated
      );

      Storage.savePlannerItems(
        updated
      );
    };

  const handleAddTask =
    (
      item: Omit<
        PlannerItem,
        'id'
      >
    ) => {
      const category =
        item.category?.trim();

      let tags =
        (item.tags || [])
          .map((tag) =>
            tag.trim()
          )
          .filter(Boolean);

      if (
        category &&
        !tags.includes(
          category
        )
      ) {
        tags = [
          category,
          ...tags,
        ];
      }

      tags = Array.from(
        new Set(tags)
      );

      const newItem:
        PlannerItem = {
        ...item,
        id:
          `task_${Date.now()}`,
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

      setPlannerItems(
        updated
      );

      Storage.savePlannerItems(
        updated
      );
    };

  // =========================================================
  // HABITS
  // =========================================================

  const handleToggleHabit =
    (
      id: string
    ) => {
      const updated =
        habits.map(
          (habit) => {
            if (
              habit.id !== id
            ) {
              return habit;
            }

            const nextState =
              !habit.completedToday;

            return {
              ...habit,
              completedToday:
                nextState,
              streak:
                nextState
                  ? habit.streak +
                    1
                  : Math.max(
                      0,
                      habit.streak -
                        1
                    ),
            };
          }
        );

      setHabits(
        updated
      );

      Storage.saveHabits(
        updated
      );
    };

  // =========================================================
  // MEMORY
  // =========================================================

  const handleAddMemory =
    (
      content: string,
      category: any
    ) => {
      const cleanContent =
        content.trim();

      if (
        !cleanContent
      ) {
        return;
      }

      const newMemory:
        MemoryItem = {
        id:
          `mem_${Date.now()}`,
        content:
          cleanContent,
        category,
        createdAt:
          new Date()
            .toISOString()
            .split('T')[0],
      };

      const updated = [
        newMemory,
        ...memories,
      ];

      setMemories(
        updated
      );

      Storage.saveMemories(
        updated
      );
    };

  const handleDeleteMemory =
    (
      id: string
    ) => {
      const updated =
        memories.filter(
          (memory) =>
            memory.id !== id
        );

      setMemories(
        updated
      );

      Storage.saveMemories(
        updated
      );
    };

  // =========================================================
  // AI AGENT
  // =========================================================

  const handleSendMessage =
    async (
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

      const now =
        Date.now();

      const userMsg:
        ChatMessage = {
        id:
          `msg_u_${now}`,
        role:
          'user',
        content:
          cleanText,
        timestamp:
          new Date().toLocaleTimeString(
            [],
            {
              hour:
                '2-digit',
              minute:
                '2-digit',
            }
          ),
      };

      const nextHistory = [
        ...chatHistory,
        userMsg,
      ];

      setChatHistory(
        nextHistory
      );

      /**
       * Local cache is updated immediately.
       */
      Storage.saveChatHistory(
        nextHistory
      );

      setIsLoadingAI(
        true
      );

      const controller =
        new AbortController();

      const timeoutId =
        window.setTimeout(
          () => {
            controller.abort();
          },
          AI_TIMEOUT_MS
        );

      try {
        const recentHistory =
          nextHistory
            .slice(
              -MAX_HISTORY
            )
            .map(
              (message) => ({
                role:
                  message.role,
                content:
                  String(
                    message.content ||
                      ''
                  ).slice(
                    0,
                    1200
                  ),
              })
            );

        const recentMemories =
          memories
            .slice(
              0,
              MAX_MEMORY_ITEMS
            )
            .map(
              (memory) => ({
                content:
                  String(
                    memory.content ||
                      ''
                  ).slice(
                    0,
                    MAX_MEMORY_LENGTH
                  ),
              })
            );

        const safeProfile = {
          name:
            user?.name ||
            '',

          preferredLanguage:
            user?.preferredLanguage ||
            'en',

          goals:
            String(
              user?.goals ||
                ''
            ).slice(
              0,
              500
            ),
        };

        const response =
          await fetch(
            '/api/agent',
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              signal:
                controller.signal,

              body:
                JSON.stringify({
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
            'AI Agent request failed.';

          try {
            const errorData =
              await response.json();

            serverMessage =
              errorData?.error ||
              errorData?.reply ||
              serverMessage;
          } catch {
            // Ignore invalid JSON.
          }

          throw new Error(
            serverMessage
          );
        }

        const data =
          await response.json();

        const agentReply =
          typeof data.reply ===
            'string' &&
          data.reply.trim()
            ? data.reply.trim()
            : 'I processed your request.';

        const assistantMsg:
          ChatMessage = {
          id:
            `msg_a_${Date.now()}`,

          role:
            'assistant',

          content:
            agentReply,

          timestamp:
            new Date().toLocaleTimeString(
              [],
              {
                hour:
                  '2-digit',
                minute:
                  '2-digit',
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

        if (
          data.detectedAction
        ) {
          setPendingAction(
            data.detectedAction
          );
        }

        if (
          data.usedTool &&
          data.tool
        ) {
          console.log(
            'Agent tool used:',
            data.tool
          );

          if (
            data.toolResult
          ) {
            console.log(
              'Tool result:',
              data.toolResult
            );
          }
        }
      } catch (
        error: any
      ) {
        console.error(
          'Nodysom AI Agent error:',
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
        } else if (
          error?.message
        ) {
          errorText =
            error.message;
        }

        const errorMsg:
          ChatMessage = {
          id:
            `msg_err_${Date.now()}`,

          role:
            'assistant',

          content:
            errorText,

          timestamp:
            new Date().toLocaleTimeString(
              [],
              {
                hour:
                  '2-digit',
                minute:
                  '2-digit',
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

        setIsLoadingAI(
          false
        );
      }
    };

  // =========================================================
  // SMART ACTION
  // =========================================================

  const handleConfirmSmartAction =
    (
      finalAction: SmartAction
    ) => {
      const category =
        finalAction.category ||
        'General';

      const newItem:
        PlannerItem = {
        id:
          `action_${Date.now()}`,

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

        completed:
          false,

        priority:
          'high',

        category,

        tags: [
          category,
        ],
      };

      const updated = [
        newItem,
        ...plannerItems,
      ];

      setPlannerItems(
        updated
      );

      Storage.savePlannerItems(
        updated
      );

      setPendingAction(
        null
      );

      const confirmMsg:
        ChatMessage = {
        id:
          `msg_c_${Date.now()}`,

        role:
          'assistant',

        content:
          `Action confirmed: Added "${finalAction.title}" to your ${
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
              hour:
                '2-digit',
              minute:
                '2-digit',
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

  // =========================================================
  // ONBOARDING
  // =========================================================

  const handleCompleteOnboarding =
    (
      updatedProfile:
        Partial<UserProfile>,
      initialPrompt?: string
    ) => {
      handleUpdateUser(
        updatedProfile
      );

      try {
        localStorage.setItem(
          ONBOARDING_KEY,
          'true'
        );
      } catch {
        // Ignore storage errors.
      }

      setIsOnboardingOpen(
        false
      );

      if (
        initialPrompt
      ) {
        handleSendMessage(
          initialPrompt
        );
      }
    };

  // =========================================================
  // CLEAR LOCAL DATA
  // =========================================================

  const handleClearAllData =
    () => {
      Storage.clearAllData();

      const resetUser =
        Storage.getUser();

      const resetMemories =
        Storage.getMemories();

      const resetPlanner =
        Storage.getPlannerItems();

      const resetHabits =
        Storage.getHabits();

      const resetChat =
        Storage.getChatHistory();

      setUser(
        resetUser
      );

      setMemories(
        resetMemories
      );

      setPlannerItems(
        resetPlanner
      );

      setHabits(
        resetHabits
      );

      setChatHistory(
        resetChat
      );
    };

  // =========================================================
  // UI
  // =========================================================

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
          isPhoneFrame={
            isPhoneFrame
          }
          onTogglePhoneFrame={() =>
            setIsPhoneFrame(
              !isPhoneFrame
            )
          }
          onOpenVoice={() =>
            setIsVoiceOpen(
              true
            )
          }
          onOpenTranslator={() =>
            setIsTranslatorOpen(
              true
            )
          }
        />

        <main className="flex-1 overflow-y-auto">
          {currentTab ===
            'home' && (
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
              onNavigate={(tab) =>
                setCurrentTab(
                  tab as TabType
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

          {currentTab ===
            'learn' && (
            <LearnView
              onOpenLesson={(
                topic
              ) => {
                setCurrentTab(
                  'home'
                );

                handleSendMessage(
                  `Teach me about ${topic}. Explain it step by step in a simple and practical way.`
                );
              }}
            />
          )}

          {currentTab ===
            'planner' && (
            <PlannerView
              plannerItems={
                plannerItems
              }
              habits={
                habits
              }
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
              memories={
                memories
              }
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
            setCurrentTab(
              tab
            )
          }
          onOpenVoice={() =>
            setIsVoiceOpen(
              true
            )
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
          isOpen={
            isVoiceOpen
          }
          onClose={() =>
            setIsVoiceOpen(
              false
            )
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
            setPendingAction(
              null
            )
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
