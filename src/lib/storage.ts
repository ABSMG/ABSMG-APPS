import {
  UserProfile,
  MemoryItem,
  PlannerItem,
  HabitItem,
  ChatMessage,
} from '../types';

import {
  DEFAULT_USER,
  INITIAL_MEMORIES,
  INITIAL_PLANNER_ITEMS,
  INITIAL_HABITS,
} from '../data/mockAndDefaults';

/**
 * Nodysom AI Local Storage
 *
 * Local storage is used as the fast/offline cache.
 * Supabase cloud sync is handled separately by cloudSync.ts.
 *
 * Important:
 * - Local data is never treated as the permanent cloud backup.
 * - Chat history is kept locally so the app still works offline.
 * - Cloud sync can restore the data on another device after login.
 */

const STORAGE_KEYS = {
  USER: 'lifeos_user_profile',
  MEMORIES: 'lifeos_memories',
  PLANNER: 'lifeos_planner_items',
  HABITS: 'lifeos_habits',
  CHAT: 'lifeos_chat_history',
  APP_SETTINGS: 'lifeos_app_settings',
} as const;

/**
 * Maximum number of chat messages kept in localStorage.
 *
 * The complete cloud history is handled by Supabase.
 * Keeping a reasonable local cache prevents mobile storage
 * from growing indefinitely.
 */
const LOCAL_CHAT_LIMIT = 200;

/**
 * Welcome message used only when there is no local history.
 */
const createWelcomeMessage = (): ChatMessage => ({
  id: 'welcome_msg',
  role: 'assistant',
  content:
    'Hello! I am Nodysom AI, your intelligent daily life assistant. Ask me anything, plan your day, learn something new, organize your tasks, or turn your ideas into structured action.',
  timestamp: new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  }),
});

/**
 * Safely parse JSON from localStorage.
 */
function parseJSON<T>(
  key: string,
  fallback: T
): T {
  try {
    const data = localStorage.getItem(key);

    if (!data) {
      return fallback;
    }

    const parsed = JSON.parse(data);

    return parsed as T;
  } catch (error) {
    console.warn(
      `Failed to read local storage key "${key}"`,
      error
    );

    return fallback;
  }
}

/**
 * Safely write JSON to localStorage.
 */
function saveJSON<T>(
  key: string,
  value: T
): boolean {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

    return true;
  } catch (error) {
    console.warn(
      `Failed to save local storage key "${key}"`,
      error
    );

    return false;
  }
}

/**
 * Normalize chat history.
 *
 * This protects the application from malformed entries
 * accidentally stored in localStorage.
 */
function normalizeChatHistory(
  chat: unknown
): ChatMessage[] {
  if (!Array.isArray(chat)) {
    return [];
  }

  return chat.filter((message): message is ChatMessage => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    const item = message as Partial<ChatMessage>;

    return (
      typeof item.id === 'string' &&
      (
        item.role === 'user' ||
        item.role === 'assistant' ||
        item.role === 'system'
      ) &&
      typeof item.content === 'string' &&
      typeof item.timestamp === 'string'
    );
  });
}

export const Storage = {
  // =========================================================
  // USER
  // =========================================================

  getUser: (): UserProfile => {
    return parseJSON<UserProfile>(
      STORAGE_KEYS.USER,
      DEFAULT_USER
    );
  },

  saveUser: (
    user: UserProfile
  ): boolean => {
    return saveJSON(
      STORAGE_KEYS.USER,
      user
    );
  },

  // =========================================================
  // MEMORIES
  // =========================================================

  getMemories: (): MemoryItem[] => {
    return parseJSON<MemoryItem[]>(
      STORAGE_KEYS.MEMORIES,
      INITIAL_MEMORIES
    );
  },

  saveMemories: (
    memories: MemoryItem[]
  ): boolean => {
    return saveJSON(
      STORAGE_KEYS.MEMORIES,
      memories
    );
  },

  // =========================================================
  // PLANNER
  // =========================================================

  getPlannerItems: (): PlannerItem[] => {
    return parseJSON<PlannerItem[]>(
      STORAGE_KEYS.PLANNER,
      INITIAL_PLANNER_ITEMS
    );
  },

  savePlannerItems: (
    items: PlannerItem[]
  ): boolean => {
    return saveJSON(
      STORAGE_KEYS.PLANNER,
      items
    );
  },

  // =========================================================
  // HABITS
  // =========================================================

  getHabits: (): HabitItem[] => {
    return parseJSON<HabitItem[]>(
      STORAGE_KEYS.HABITS,
      INITIAL_HABITS
    );
  },

  saveHabits: (
    habits: HabitItem[]
  ): boolean => {
    return saveJSON(
      STORAGE_KEYS.HABITS,
      habits
    );
  },

  // =========================================================
  // CHAT HISTORY
  // =========================================================

  /**
   * Get locally cached chat history.
   *
   * If no chat history exists, a welcome message is created.
   */
  getChatHistory: (): ChatMessage[] => {
    const data =
      localStorage.getItem(
        STORAGE_KEYS.CHAT
      );

    if (!data) {
      return [
        createWelcomeMessage(),
      ];
    }

    const parsed =
      normalizeChatHistory(
        parseJSON<unknown>(
          STORAGE_KEYS.CHAT,
          []
        )
      );

    if (parsed.length === 0) {
      return [
        createWelcomeMessage(),
      ];
    }

    return parsed;
  },

  /**
   * Save local chat history.
   *
   * We keep the latest 200 messages locally.
   * Supabase is responsible for cloud persistence.
   */
  saveChatHistory: (
    chat: ChatMessage[]
  ): boolean => {
    const normalized =
      normalizeChatHistory(chat);

    const trimmed =
      normalized.slice(
        -LOCAL_CHAT_LIMIT
      );

    return saveJSON(
      STORAGE_KEYS.CHAT,
      trimmed
    );
  },

  /**
   * Append a single chat message.
   *
   * This avoids repeatedly rebuilding the local history
   * in different parts of the application.
   */
  appendChatMessage: (
    message: ChatMessage
  ): ChatMessage[] => {
    const current =
      Storage.getChatHistory();

    const updated = [
      ...current,
      message,
    ];

    Storage.saveChatHistory(
      updated
    );

    return updated.slice(
      -LOCAL_CHAT_LIMIT
    );
  },

  /**
   * Replace the entire local chat history.
   *
   * Useful when cloud data has been loaded from Supabase.
   */
  replaceChatHistory: (
    chat: ChatMessage[]
  ): boolean => {
    return Storage.saveChatHistory(
      chat
    );
  },

  /**
   * Check whether local chat history exists.
   */
  hasChatHistory: (): boolean => {
    try {
      return Boolean(
        localStorage.getItem(
          STORAGE_KEYS.CHAT
        )
      );
    } catch {
      return false;
    }
  },

  /**
   * Get number of locally stored messages.
   */
  getChatMessageCount: (): number => {
    return Storage.getChatHistory()
      .length;
  },

  // =========================================================
  // APP SETTINGS
  // =========================================================

  getAppSettings: <
    T extends Record<string, unknown> = Record<
      string,
      unknown
    >
  >(): T => {
    return parseJSON<T>(
      STORAGE_KEYS.APP_SETTINGS,
      {} as T
    );
  },

  saveAppSettings: <
    T extends Record<string, unknown>
  >(
    settings: T
  ): boolean => {
    return saveJSON(
      STORAGE_KEYS.APP_SETTINGS,
      settings
    );
  },

  // =========================================================
  // EXPORT
  // =========================================================

  exportAllDataJSON: () => {
    try {
      const backup = {
        app: 'Nodysom AI',
        version: '1.0.0',

        exportedAt:
          new Date().toISOString(),

        user:
          Storage.getUser(),

        memories:
          Storage.getMemories(),

        planner:
          Storage.getPlannerItems(),

        habits:
          Storage.getHabits(),

        chat:
          Storage.getChatHistory(),

        settings:
          Storage.getAppSettings(),
      };

      const json =
        JSON.stringify(
          backup,
          null,
          2
        );

      const blob =
        new Blob(
          [json],
          {
            type:
              'application/json',
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

      anchor.href = url;

      anchor.download =
        `Nodysom_AI_Backup_${new Date()
          .toISOString()
          .split('T')[0]}.json`;

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
    } catch (error) {
      console.error(
        'Failed to export Nodysom AI data:',
        error
      );
    }
  },

  // =========================================================
  // CLEAR LOCAL DATA
  // =========================================================

  clearAllData: () => {
    Object.values(
      STORAGE_KEYS
    ).forEach((key) => {
      try {
        localStorage.removeItem(
          key
        );
      } catch (error) {
        console.warn(
          `Failed to remove local storage key "${key}"`,
          error
        );
      }
    });
  },

  // =========================================================
  // CLEAR ONLY CHAT
  // =========================================================

  clearChatHistory: () => {
    try {
      localStorage.removeItem(
        STORAGE_KEYS.CHAT
      );
    } catch (error) {
      console.warn(
        'Failed to clear chat history',
        error
      );
    }
  },

  // =========================================================
  // STORAGE KEY ACCESS
  // =========================================================

  keys: STORAGE_KEYS,
};
