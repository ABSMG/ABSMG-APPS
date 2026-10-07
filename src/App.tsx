import React, {
  lazy,
  Suspense,
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

// =========================================================
// LAZY-LOADED MAIN VIEWS
// =========================================================
//
// Main views are lazy-loaded so the initial application
// startup does not need to download every view immediately.
//
// No feature is removed.
// =========================================================

const HomeView = lazy(
  () =>
    import('./components/HomeView').then(
      (module) => ({
        default:
          module.HomeView,
      })
    )
);

const ChatView = lazy(
  () =>
    import('./components/ChatView')
);

const SearchView = lazy(
  () =>
    import('./components/SearchView').then(
      (module) => ({
        default:
          module.SearchView,
      })
    )
);

const PlannerView = lazy(
  () =>
    import('./components/PlannerView').then(
      (module) => ({
        default:
          module.PlannerView,
      })
    )
);

const LearnView = lazy(
  () =>
    import('./components/LearnView').then(
      (module) => ({
        default:
          module.LearnView,
      })
    )
);

const ProfileView = lazy(
  () =>
    import('./components/ProfileView').then(
      (module) => ({
        default:
          module.ProfileView,
      })
    )
);

// =========================================================
// MODALS
// =========================================================

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

// =========================================================
// APP CONSTANTS
// =========================================================

const AI_TIMEOUT_MS = 120000;

const MAX_HISTORY = 6;

const MAX_MESSAGE_LENGTH = 2000;

const MAX_MEMORY_ITEMS = 6;

const MAX_MEMORY_LENGTH = 500;

const CLOUD_SYNC_DELAY = 1200;

const ONBOARDING_KEY =
  'lifeos_onboarding_completed';

// =========================================================
// HABIT DATE HELPERS
// =========================================================
//
// Habit completion is based on actual calendar dates.
//
// Example:
//
// history = [
//   "2026-10-04",
//   "2026-10-05",
//   "2026-10-06"
// ]
//
// Current streak = 3.
//
// If today is 2026-10-07 and the user has not completed
// the habit yet, the current streak can still display 3
// because yesterday was completed.
//
// If 2026-10-03 was the last completion before that,
// the streak is broken.
// =========================================================

function getLocalISODate(
  date: Date = new Date()
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
}


// =========================================================
// STRICT ISO DATE PARSER
// =========================================================

function parseISODate(
  dateString: string
): Date | null {
  if (
    typeof dateString !==
    'string'
  ) {
    return null;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateString
    )
  ) {
    return null;
  }

  const [
    year,
    month,
    day,
  ] =
    dateString
      .split('-')
      .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  if (
    date.getFullYear() !==
      year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !==
      day
  ) {
    return null;
  }

  return date;
}


// =========================================================
// ADD / SUBTRACT DAYS
// =========================================================

function addDaysToISODate(
  dateString: string,
  amount: number
): string {
  const parsed =
    parseISODate(
      dateString
    );

  if (!parsed) {
    return dateString;
  }

  parsed.setDate(
    parsed.getDate() +
      amount
  );

  return getLocalISODate(
    parsed
  );
}


// =========================================================
// NORMALIZE HABIT HISTORY
// =========================================================
//
// Only valid YYYY-MM-DD dates are retained.
//
// Duplicate dates are removed.
//
// Dates are sorted chronologically.
// =========================================================

function normalizeHabitHistory(
  history: unknown
): string[] {
  if (
    !Array.isArray(history)
  ) {
    return [];
  }

  const validDates =
    history.filter(
      (
        value
      ): value is string =>
        typeof value ===
          'string' &&
        Boolean(
          parseISODate(
            value
          )
        )
    );

  return Array.from(
    new Set(
      validDates
    )
  ).sort();
}


// =========================================================
// CALCULATE CURRENT HABIT STREAK
// =========================================================
//
// Source of truth = history.
//
// If today is completed:
//
//   today -> yesterday -> previous day...
//
// If today is not completed:
//
//   yesterday -> previous day...
//
// This prevents a completed habit from being treated as
// automatically broken simply because the user has not
// checked it yet today.
// =========================================================

function calculateHabitStreak(
  history: string[],
  today: string = getLocalISODate()
): number {
  const normalizedHistory =
    normalizeHabitHistory(
      history
    );

  if (
    normalizedHistory.length ===
    0
  ) {
    return 0;
  }

  const historySet =
    new Set(
      normalizedHistory
    );

  let streakStart =
    today;

  if (
    !historySet.has(
      streakStart
    )
  ) {
    streakStart =
      addDaysToISODate(
        today,
        -1
      );

    if (
      !historySet.has(
        streakStart
      )
    ) {
      return 0;
    }
  }

  let streak = 0;

  let cursor =
    streakStart;

  while (
    historySet.has(
      cursor
    )
  ) {
    streak += 1;

    cursor =
      addDaysToISODate(
        cursor,
        -1
      );

    if (
      streak >
      normalizedHistory.length
    ) {
      break;
    }
  }

  return streak;
}


// =========================================================
// CALCULATE BEST HABIT STREAK
// =========================================================
//
// This is useful for preserving a historical "best streak"
// independently from the current streak.
// =========================================================

function calculateBestHabitStreak(
  history: string[]
): number {
  const normalizedHistory =
    normalizeHabitHistory(
      history
    );

  if (
    normalizedHistory.length ===
    0
  ) {
    return 0;
  }

  const historySet =
    new Set(
      normalizedHistory
    );

  let bestStreak = 0;

  for (
    const date of normalizedHistory
  ) {
    const previousDate =
      addDaysToISODate(
        date,
        -1
      );

    if (
      historySet.has(
        previousDate
      )
    ) {
      continue;
    }

    let currentStreak = 1;

    let cursor =
      addDaysToISODate(
        date,
        1
      );

    while (
      historySet.has(
        cursor
      )
    ) {
      currentStreak += 1;

      cursor =
        addDaysToISODate(
          cursor,
          1
        );

      if (
        currentStreak >
        normalizedHistory.length
      ) {
        break;
      }
    }

    bestStreak =
      Math.max(
        bestStreak,
        currentStreak
      );
  }

  return bestStreak;
}


// =========================================================
// NORMALIZE SINGLE HABIT
// =========================================================
//
// IMPORTANT:
//
// Older versions of Nodysom may have had:
//
// completedToday: true
//
// without storing the actual completion date.
//
// Safe migration:
//
// - If history already exists, trust history.
// - If history is empty AND completedToday was true,
//   migrate that legacy completion to today.
// - If history is empty AND completedToday is false,
//   do not invent a completion date.
// =========================================================

function normalizeHabit(
  habit: HabitItem,
  today: string = getLocalISODate()
): HabitItem {
  let history =
    normalizeHabitHistory(
      habit.history
    );

  if (
    history.length === 0 &&
    habit.completedToday === true
  ) {
    history = [
      today,
    ];
  }

  const completedToday =
    history.includes(
      today
    );

  const streak =
    calculateHabitStreak(
      history,
      today
    );

  return {
    ...habit,

    history,

    completedToday,

    streak,
  };
}


// =========================================================
// NORMALIZE ALL HABITS
// =========================================================

function normalizeHabits(
  habits: HabitItem[],
  today: string = getLocalISODate()
): HabitItem[] {
  if (
    !Array.isArray(habits)
  ) {
    return [];
  }

  return habits.map(
    (habit) =>
      normalizeHabit(
        habit,
        today
      )
  );
}


// =========================================================
// SAFE MERGE HELPERS
// =========================================================

function mergeById<T extends { id: string }>(
  cloudItems: T[],
  localItems: T[],
): T[] {
  const map =
    new Map<string, T>();

  for (
    const item of cloudItems
  ) {
    if (
      item?.id
    ) {
      map.set(
        item.id,
        item
      );
    }
  }

  for (
    const item of localItems
  ) {
    if (
      item?.id
    ) {
      map.set(
        item.id,
        item
      );
    }
  }

  return Array.from(
    map.values()
  );
}


// =========================================================
// CHAT SORT VALUE
// =========================================================

function chatOrderValue(
  message: ChatMessage,
  fallback: number,
): number {
  const raw =
    String(
      message?.timestamp ||
        ''
    ).trim();

  if (!raw) {
    return fallback;
  }

  const parsed =
    Date.parse(
      raw
    );

  if (
    !Number.isNaN(
      parsed
    )
  ) {
    return parsed;
  }

  const match =
    raw.match(
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
    );

  if (match) {
    let hours =
      Number(
        match[1]
      );

    const minutes =
      Number(
        match[2]
      );

    const seconds =
      Number(
        match[3] || 0
      );

    const meridiem =
      match[4]?.toUpperCase();

    if (
      meridiem === 'PM' &&
      hours < 12
    ) {
      hours += 12;
    }

    if (
      meridiem === 'AM' &&
      hours === 12
    ) {
      hours = 0;
    }

    return (
      hours *
        60 *
        60 *
        1000 +
      minutes *
        60 *
        1000 +
      seconds *
        1000
    );
  }

  return fallback;
}


// =========================================================
// MERGE CHAT HISTORY
// =========================================================

function mergeChatHistory(
  cloudChat: ChatMessage[],
  localChat: ChatMessage[],
): ChatMessage[] {
  const map =
    new Map<string, ChatMessage>();

  for (
    const message of cloudChat
  ) {
    if (
      message?.id
    ) {
      map.set(
        message.id,
        message
      );
    }
  }

  for (
    const message of localChat
  ) {
    if (
      message?.id
    ) {
      map.set(
        message.id,
        message
      );
    }
  }

  const merged =
    Array.from(
      map.values()
    );

  return merged
    .sort(
      (a, b) =>
        chatOrderValue(
          a,
          0
        ) -
        chatOrderValue(
          b,
          0
        )
    )
    .slice(
      -200
    );
}


// =========================================================
// MERGE CHAT HISTORY FOR EXPORT
// =========================================================
//
// No 200-message limit here.
// =========================================================

function mergeChatHistoryForExport(
  cloudChat: ChatMessage[],
  localChat: ChatMessage[],
): ChatMessage[] {
  const map =
    new Map<string, ChatMessage>();

  for (
    const message of cloudChat
  ) {
    if (
      message?.id
    ) {
      map.set(
        message.id,
        message
      );
    }
  }

  for (
    const message of localChat
  ) {
    if (
      message?.id
    ) {
      map.set(
        message.id,
        message
      );
    }
  }

  return Array.from(
    map.values()
  )
    .sort(
      (a, b) =>
        chatOrderValue(
          a,
          0
        ) -
        chatOrderValue(
          b,
          0
        )
    );
}


// =========================================================
// VIEW LOADING FALLBACK
// =========================================================

function ViewLoading() {
  return (
    <div className="min-h-[320px] w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">

        <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />

        <div className="text-sm text-slate-400">
          Loading Nodysom AI…
        </div>

      </div>
    </div>
  );
}


// =========================================================
// APP
// =========================================================

export default function App() {

  // =========================================================
  // APP STATE
  // =========================================================

  const [currentTab, setCurrentTab] =
    useState<TabType>(
      'home'
    );

  const [user, setUser] =
    useState<UserProfile>(
      () =>
        Storage.getUser()
    );

  const [memories, setMemories] =
    useState<MemoryItem[]>(
      () =>
        Storage.getMemories()
    );

  const [plannerItems, setPlannerItems] =
    useState<PlannerItem[]>(
      () =>
        Storage.getPlannerItems()
    );

  const [habits, setHabits] =
    useState<HabitItem[]>(
      () =>
        normalizeHabits(
          Storage.getHabits()
        )
    );

  const [chatHistory, setChatHistory] =
    useState<ChatMessage[]>(
      () =>
        Storage.getChatHistory()
    );

  const [isOnline, setIsOnline] =
    useState(
      typeof navigator !==
        'undefined'
        ? navigator.onLine
        : true
    );

  const [isPhoneFrame, setIsPhoneFrame] =
    useState(
      false
    );

  const [isLoadingAI, setIsLoadingAI] =
    useState(
      false
    );

  const [isVoiceOpen, setIsVoiceOpen] =
    useState(
      false
    );

  const [isTranslatorOpen, setIsTranslatorOpen] =
    useState(
      false
    );

  const [pendingAction, setPendingAction] =
    useState<SmartAction | null>(
      null
    );

  const [isOnboardingOpen, setIsOnboardingOpen] =
    useState(
      () => {
        try {
          return !localStorage.getItem(
            ONBOARDING_KEY
          );
        } catch {
          return true;
        }
      }
    );


  // =========================================================
  // SUPABASE STATE
  // =========================================================

  const [cloudUserId, setCloudUserId] =
    useState<string | null>(
      null
    );

  const [cloudEmail, setCloudEmail] =
    useState(
      ''
    );

  const [cloudBusy, setCloudBusy] =
    useState(
      false
    );

  const [cloudReady, setCloudReady] =
    useState(
      false
    );


  // =========================================================
  // CLOUD REFS
  // =========================================================

  const cloudRequestId =
    useRef(
      0
    );

  const cloudHydrated =
    useRef(
      false
    );

  const cloudSyncTimer =
    useRef<number | null>(
      null
    );

  const mountedRef =
    useRef(
      true
    );


  // =========================================================
  // LATEST DATA REF
  // =========================================================

  const latestDataRef =
    useRef({
      user,
      memories,
      plannerItems,
      habits,
      chatHistory,
    });

  latestDataRef.current = {
    user,
    memories,
    plannerItems,
    habits,
    chatHistory,
  };


  // =========================================================
  // MOUNT / UNMOUNT
  // =========================================================

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;

      if (
        cloudSyncTimer.current !==
        null
      ) {
        window.clearTimeout(
          cloudSyncTimer.current
        );
      }
    };
  }, []);


  // =========================================================
  // NORMALIZE EXISTING HABITS ON STARTUP
  // =========================================================

  useEffect(() => {
    const today =
      getLocalISODate();

    const currentHabits =
      latestDataRef.current
        .habits;

    const normalized =
      normalizeHabits(
        currentHabits,
        today
      );

    const changed =
      JSON.stringify(
        normalized
      ) !==
      JSON.stringify(
        currentHabits
      );

    if (
      changed
    ) {
      setHabits(
        normalized
      );

      Storage.saveHabits(
        normalized
      );
    }
  }, []);


  // =========================================================
  // ONLINE / OFFLINE
  // =========================================================

  useEffect(() => {

    const handleOnline =
      () => {
        setIsOnline(
          true
        );
      };

    const handleOffline =
      () => {
        setIsOnline(
          false
        );
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

        if (
          !userId
        ) {
          return;
        }

        const requestId =
          ++cloudRequestId.current;

        cloudHydrated.current =
          false;

        setCloudReady(
          false
        );

        setCloudUserId(
          userId
        );

        setCloudEmail(
          email
        );

        setCloudBusy(
          true
        );

        try {

          const cloudData =
            await loadCloudData(
              userId
            );

          if (
            requestId !==
            cloudRequestId.current
          ) {
            return;
          }

          if (
            !mountedRef.current
          ) {
            return;
          }


          // =================================================
          // EXISTING CLOUD ACCOUNT
          // =================================================

          if (
            cloudData
          ) {

            const localData =
              latestDataRef.current;

            const cloudUser =
              cloudData.user;

            const cloudMemories =
              Array.isArray(
                cloudData.memories
              )
                ? cloudData.memories
                : [];

            const cloudPlanner =
              Array.isArray(
                cloudData.plannerItems
              )
                ? cloudData.plannerItems
                : [];

            const cloudHabits =
              Array.isArray(
                cloudData.habits
              )
                ? cloudData.habits
                : [];

            const cloudChat =
              Array.isArray(
                cloudData.chatHistory
              )
                ? cloudData.chatHistory
                : [];


            // =============================================
            // USER
            // =============================================

            const restoredUser:
              UserProfile = {
              ...localData.user,
              ...(cloudUser || {}),
            };


            // =============================================
            // MEMORIES
            // =============================================

            const restoredMemories =
              mergeById(
                cloudMemories,
                localData.memories
              );


            // =============================================
            // PLANNER
            // =============================================

            const restoredPlanner =
              mergeById(
                cloudPlanner,
                localData.plannerItems
              );


            // =============================================
            // HABITS
            // =============================================

            const mergedHabits =
              mergeById(
                cloudHabits,
                localData.habits
              );

            const restoredHabits =
              normalizeHabits(
                mergedHabits
              );


            // =============================================
            // CHAT
            // =============================================

            const restoredChat =
              mergeChatHistory(
                cloudChat,
                localData.chatHistory
              );


            // =============================================
            // APPLY MERGED DATA
            // =============================================

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


            // =============================================
            // LOCAL CACHE
            // =============================================

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


            // =============================================
            // MERGED CLOUD SAVE
            // =============================================

            void saveCloudData(
              userId,
              {
                user:
                  restoredUser,

                memories:
                  restoredMemories,

                plannerItems:
                  restoredPlanner,

                habits:
                  restoredHabits,

                chatHistory:
                  restoredChat,
              }
            ).catch(
              (error) => {
                console.error(
                  'Merged cloud data save error:',
                  error
                );
              }
            );


            if (
              requestId !==
              cloudRequestId.current
            ) {
              return;
            }

            if (
              !mountedRef.current
            ) {
              return;
            }

            cloudHydrated.current =
              true;

            setCloudReady(
              true
            );

            return;
          }


          // =================================================
          // NEW CLOUD ACCOUNT
          // =================================================

          const localData =
            latestDataRef.current;

          const normalizedLocalHabits =
            normalizeHabits(
              localData.habits
            );

          const initialCloudData = {
            user:
              localData.user,

            memories:
              localData.memories,

            plannerItems:
              localData.plannerItems,

            habits:
              normalizedLocalHabits,

            chatHistory:
              localData.chatHistory,
          };


          void saveCloudData(
            userId,
            initialCloudData
          ).catch(
            (error) => {
              console.error(
                'Initial cloud backup error:',
                error
              );
            }
          );


          if (
            requestId !==
            cloudRequestId.current
          ) {
            return;
          }

          if (
            !mountedRef.current
          ) {
            return;
          }

          cloudHydrated.current =
            true;

          setCloudReady(
            true
          );

        } catch (
          error
        ) {

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
      []
    );


  // =========================================================
  // INITIAL SUPABASE SESSION
  // =========================================================

  useEffect(() => {

    let active =
      true;

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

          if (
            !active
          ) {
            return;
          }

          if (
            session?.user
          ) {

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

        } catch (
          error
        ) {

          console.error(
            'Supabase session error:',
            error
          );

          if (
            active
          ) {

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


    if (
      supabase
    ) {

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

            if (
              !active
            ) {
              return;
            }

            if (
              session?.user
            ) {

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


      unsubscribe =
        () => {
          subscription.unsubscribe();
        };
    }


    return () => {
      active =
        false;

      unsubscribe?.();
    };

  }, [
    handleCloudLogin,
  ]);


  // =========================================================
  // AUTOMATIC CLOUD SYNC
  // =========================================================

  useEffect(() => {

    if (
      !cloudUserId ||
      !cloudReady ||
      !cloudHydrated.current ||
      !isSupabaseConfigured
    ) {
      return;
    }


    if (
      cloudSyncTimer.current !==
      null
    ) {

      window.clearTimeout(
        cloudSyncTimer.current
      );
    }


    cloudSyncTimer.current =
      window.setTimeout(
        async () => {

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

          } catch (
            error
          ) {

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
  // CLOUD SIGN IN
  // =========================================================

  const handleCloudSignIn =
    async (
      email: string,
      password: string
    ) => {

      setCloudBusy(
        true
      );

      try {

        const {
          data,
          error,
        } =
          await signIn(
            email,
            password
          );

        if (
          error
        ) {
          throw error;
        }

        if (
          !data.user
        ) {
          throw new Error(
            'Login failed.'
          );
        }

        await handleCloudLogin(
          data.user.id,
          data.user.email ||
            email
        );

        return {
          success:
            true,

          message:
            'Login successful. Your cloud data has been restored.',
        };

      } catch (
        error: any
      ) {

        console.error(
          'Sign in error:',
          error
        );

        return {
          success:
            false,

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


  // =========================================================
  // CLOUD SIGN UP
  // =========================================================

  const handleCloudSignUp =
    async (
      email: string,
      password: string
    ) => {

      setCloudBusy(
        true
      );

      try {

        const {
          data,
          error,
        } =
          await signUp(
            email,
            password
          );

        if (
          error
        ) {
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
            success:
              true,

            message:
              'Account created successfully. Your data is now backed up.',
          };
        }

        return {
          success:
            true,

          message:
            'Account created. Please check your email to confirm your account.',
        };

      } catch (
        error: any
      ) {

        console.error(
          'Sign up error:',
          error
        );

        return {
          success:
            false,

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


  // =========================================================
  // CLOUD SIGN OUT
  // =========================================================

  const handleCloudSignOut =
    async () => {

      setCloudBusy(
        true
      );

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

        // Local data intentionally remains intact.

      } catch (
        error
      ) {

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


  // =========================================================
  // ADD PLANNER TASK
  // =========================================================

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
          .map(
            (tag) =>
              tag.trim()
          )
          .filter(
            Boolean
          );

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

      tags =
        Array.from(
          new Set(
            tags
          )
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
  //
  // IMPORTANT CHANGE:
  //
  // We NEVER do:
  //
  // streak + 1
  //
  // or:
  //
  // streak - 1
  //
  // anymore.
  //
  // Instead:
  //
  // history = source of truth
  //
  // and streak is recalculated from the dates.
  // =========================================================

  const handleToggleHabit =
    (
      id: string
    ) => {

      const today =
        getLocalISODate();

      const updated =
        habits.map(
          (habit) => {

            if (
              habit.id !== id
            ) {
              return habit;
            }


            // =============================================
            // NORMALIZE EXISTING HABIT
            // =============================================

            const normalized =
              normalizeHabit(
                habit,
                today
              );


            // =============================================
            // READ HISTORY
            // =============================================

            const history =
              normalizeHabitHistory(
                normalized.history
              );


            const completedToday =
              history.includes(
                today
              );


            // =============================================
            // TOGGLE TODAY
            // =============================================

            let nextHistory:
              string[];


            if (
              completedToday
            ) {

              // -------------------------------------------
              // UNCOMPLETE TODAY
              // -------------------------------------------

              nextHistory =
                history.filter(
                  (date) =>
                    date !== today
                );

            } else {

              // -------------------------------------------
              // COMPLETE TODAY
              // -------------------------------------------

              nextHistory =
                Array.from(
                  new Set([
                    ...history,
                    today,
                  ])
                ).sort();
            }


            // =============================================
            // RECALCULATE STREAK
            // =============================================

            const nextStreak =
              calculateHabitStreak(
                nextHistory,
                today
              );


            // =============================================
            // RETURN UPDATED HABIT
            // =============================================

            return {
              ...normalized,

              history:
                nextHistory,

              completedToday:
                nextHistory.includes(
                  today
                ),

              streak:
                nextStreak,
            };
          }
        );


      // ===============================================
      // SAVE LOCAL STATE
      // ===============================================

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


  // =========================================================
  // DELETE MEMORY
  // =========================================================

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
  // NEW CHAT
  // =========================================================

  const handleNewChat =
    () => {

      if (
        isLoadingAI
      ) {
        return;
      }

      const emptyChat:
        ChatMessage[] = [];

      setChatHistory(
        emptyChat
      );

      Storage.saveChatHistory(
        emptyChat
      );

      setPendingAction(
        null
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
              (
                message
              ) => ({
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
              (
                memory
              ) => ({
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


        if (
          !response.ok
        ) {

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
          getLocalISODate(),

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
  // CLEAR ALL LOCAL DATA
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
        normalizeHabits(
          resetHabits
        )
      );

      setChatHistory(
        resetChat
      );
    };


  // =========================================================
  // EXPORT MY DATA
  // =========================================================

  const handleExportAllData =
    useCallback(
      async () => {

        try {

          // ===============================================
          // CURRENT LOCAL DATA
          // ===============================================

          const localData =
            latestDataRef.current;


          let exportUser:
            UserProfile =
            localData.user;


          let exportMemories:
            MemoryItem[] =
            Array.isArray(
              localData.memories
            )
              ? localData.memories
              : [];


          let exportPlanner:
            PlannerItem[] =
            Array.isArray(
              localData.plannerItems
            )
              ? localData.plannerItems
              : [];


          let exportHabits:
            HabitItem[] =
            Array.isArray(
              localData.habits
            )
              ? normalizeHabits(
                  localData.habits
                )
              : [];


          let exportChat:
            ChatMessage[] =
            Array.isArray(
              localData.chatHistory
            )
              ? localData.chatHistory
              : [];


          let source:
            | 'local'
            | 'local + cloud' =
            'local';


          // ===============================================
          // INCLUDE SUPABASE DATA
          // ===============================================

          if (
            cloudUserId &&
            isSupabaseConfigured
          ) {

            try {

              const cloudData =
                await loadCloudData(
                  cloudUserId
                );


              if (
                cloudData
              ) {

                const cloudMemories =
                  Array.isArray(
                    cloudData.memories
                  )
                    ? cloudData.memories
                    : [];


                const cloudPlanner =
                  Array.isArray(
                    cloudData.plannerItems
                  )
                    ? cloudData.plannerItems
                    : [];


                const cloudHabits =
                  Array.isArray(
                    cloudData.habits
                  )
                    ? cloudData.habits
                    : [];


                const cloudChat =
                  Array.isArray(
                    cloudData.chatHistory
                  )
                    ? cloudData.chatHistory
                    : [];


                // =========================================
                // USER
                // =========================================

                exportUser = {
                  ...(cloudData.user || {}),
                  ...(localData.user || {}),

                  id:
                    cloudData.user?.id ||
                    localData.user?.id ||
                    cloudUserId,

                  email:
                    cloudEmail ||
                    cloudData.user?.email ||
                    localData.user?.email ||
                    '',
                };


                // =========================================
                // MEMORIES
                // =========================================

                exportMemories =
                  mergeById(
                    cloudMemories,
                    exportMemories
                  );


                // =========================================
                // PLANNER
                // =========================================

                exportPlanner =
                  mergeById(
                    cloudPlanner,
                    exportPlanner
                  );


                // =========================================
                // HABITS
                // =========================================

                exportHabits =
                  normalizeHabits(
                    mergeById(
                      cloudHabits,
                      exportHabits
                    )
                  );


                // =========================================
                // CHAT
                // =========================================

                exportChat =
                  mergeChatHistoryForExport(
                    cloudChat,
                    exportChat
                  );


                source =
                  'local + cloud';
              }

            } catch (
              cloudError
            ) {

              console.warn(
                'Cloud export unavailable. Continuing with local data.',
                cloudError
              );

              source =
                'local';
            }
          }


          // ===============================================
          // APP SETTINGS
          // ===============================================

          let settings:
            ReturnType<
              typeof Storage.getAppSettings
            >;


          try {

            settings =
              Storage.getAppSettings();

          } catch (
            settingsError
          ) {

            console.warn(
              'Could not load app settings for export.',
              settingsError
            );

            settings =
              {} as ReturnType<
                typeof Storage.getAppSettings
              >;
          }


          // ===============================================
          // BACKUP OBJECT
          // ===============================================

          const backup = {
            app:
              'Nodysom AI',

            developer:
              'ANORD BONIPHACE',

            version:
              '1.0.0',

            exportedAt:
              new Date().toISOString(),

            source,

            user:
              exportUser,

            memories:
              exportMemories,

            planner:
              exportPlanner,

            habits:
              exportHabits,

            chat:
              exportChat,

            settings,
          };


          // ===============================================
          // JSON
          // ===============================================

          const json =
            JSON.stringify(
              backup,
              null,
              2
            );


          // ===============================================
          // DOWNLOAD
          // ===============================================

          const blob =
            new Blob(
              [json],
              {
                type:
                  'application/json;charset=utf-8',
              }
            );


          const url =
            URL.createObjectURL(
              blob
            );


          const anchor =
            document.createElement(
              'a'
            );


          anchor.href =
            url;


          anchor.download =
            `Nodysom_AI_Backup_${
              new Date()
                .toISOString()
                .split('T')[0]
            }.json`;


          anchor.style.display =
            'none';


          document.body.appendChild(
            anchor
          );


          anchor.click();


          document.body.removeChild(
            anchor
          );


          URL.revokeObjectURL(
            url
          );


          console.log(
            'Nodysom AI data export completed successfully.',
            {
              source,

              user:
                Boolean(
                  exportUser
                ),

              memories:
                exportMemories.length,

              planner:
                exportPlanner.length,

              habits:
                exportHabits.length,

              chat:
                exportChat.length,
            }
          );

        } catch (
          error
        ) {

          console.error(
            'Nodysom AI export failed:',
            error
          );


          // =============================================
          // EMERGENCY LOCAL BACKUP
          // =============================================

          try {

            const emergencyData =
              latestDataRef.current;


            const emergencyBackup = {
              app:
                'Nodysom AI',

              developer:
                'ANORD BONIPHACE',

              version:
                '1.0.0',

              exportedAt:
                new Date().toISOString(),

              source:
                'local',

              user:
                emergencyData.user,

              memories:
                emergencyData.memories,

              planner:
                emergencyData.plannerItems,

              habits:
                normalizeHabits(
                  emergencyData.habits
                ),

              chat:
                emergencyData.chatHistory,

              settings:
                {},
            };


            const emergencyJson =
              JSON.stringify(
                emergencyBackup,
                null,
                2
              );


            const emergencyBlob =
              new Blob(
                [emergencyJson],
                {
                  type:
                    'application/json;charset=utf-8',
                }
              );


            const emergencyUrl =
              URL.createObjectURL(
                emergencyBlob
              );


            const emergencyAnchor =
              document.createElement(
                'a'
              );


            emergencyAnchor.href =
              emergencyUrl;


            emergencyAnchor.download =
              `Nodysom_AI_Backup_${
                new Date()
                  .toISOString()
                  .split('T')[0]
              }.json`;


            emergencyAnchor.style.display =
              'none';


            document.body.appendChild(
              emergencyAnchor
            );


            emergencyAnchor.click();


            document.body.removeChild(
              emergencyAnchor
            );


            URL.revokeObjectURL(
              emergencyUrl
            );


            console.log(
              'Emergency Nodysom AI export completed.'
            );

          } catch (
            emergencyError
          ) {

            console.error(
              'Emergency export failed:',
              emergencyError
            );


            alert(
              'Nodysom AI could not export your data. Please try again.'
            );
          }
        }
      },
      [
        cloudUserId,
        cloudEmail,
      ]
    );


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
            : 'max-w-7xl min-h-screen relative'
        }`}
      >

        {/* =================================================
            PHONE FRAME TOP
            ================================================= */}

        {isPhoneFrame && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-full z-40 flex items-center justify-center">

            <div className="w-10 h-1 bg-slate-800 rounded-full" />

            <div className="w-2.5 h-2.5 rounded-full bg-slate-950 ml-2 border border-slate-800" />

          </div>
        )}


        {/* =================================================
            TOP HEADER
            ================================================= */}

        <TopHeader
          user={
            user
          }

          isOnline={
            isOnline
          }

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


        {/* =================================================
            MAIN CONTENT
            ================================================= */}

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">

          <Suspense
            fallback={
              <ViewLoading />
            }
          >

            {/* =================================================
                HOME
                ================================================= */}

            {currentTab ===
              'home' && (

              <HomeView
                user={
                  user
                }

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


            {/* =================================================
                CHAT
                ================================================= */}

            {currentTab ===
              'chat' && (

              <ChatView
                user={
                  user
                }

                chatHistory={
                  chatHistory
                }

                isLoading={
                  isLoadingAI
                }

                onSendMessage={
                  handleSendMessage
                }

                onNewChat={
                  handleNewChat
                }
              />

            )}


            {/* =================================================
                SEARCH
                ================================================= */}

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


            {/* =================================================
                LEARN
                ================================================= */}

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


            {/* =================================================
                PLANNER
                ================================================= */}

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


            {/* =================================================
                PROFILE
                ================================================= */}

            {currentTab ===
              'profile' && (

              <ProfileView
                user={
                  user
                }

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
                  handleExportAllData
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

          </Suspense>

        </main>


        {/* ===================================================
            BOTTOM NAVIGATION
            =================================================== */}

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

          user={
            user
          }

          isOnline={
            isOnline
          }

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


        {/* ===================================================
            VOICE ASSISTANT
            =================================================== */}

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


        {/* ===================================================
            TRANSLATOR
            =================================================== */}

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


        {/* ===================================================
            SMART ACTION
            =================================================== */}

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


        {/* ===================================================
            ONBOARDING
            =================================================== */}

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
