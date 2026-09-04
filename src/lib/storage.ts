import { UserProfile, MemoryItem, PlannerItem, HabitItem, ChatMessage } from '../types';
import { DEFAULT_USER, INITIAL_MEMORIES, INITIAL_PLANNER_ITEMS, INITIAL_HABITS } from '../data/mockAndDefaults';

const STORAGE_KEYS = {
  USER: 'lifeos_user_profile',
  MEMORIES: 'lifeos_memories',
  PLANNER: 'lifeos_planner_items',
  HABITS: 'lifeos_habits',
  CHAT: 'lifeos_chat_history',
  APP_SETTINGS: 'lifeos_app_settings',
};

export const Storage = {
  getUser: (): UserProfile => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER);
      return data ? JSON.parse(data) : DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  },

  saveUser: (user: UserProfile) => {
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save user', e);
    }
  },

  getMemories: (): MemoryItem[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEMORIES);
      return data ? JSON.parse(data) : INITIAL_MEMORIES;
    } catch {
      return INITIAL_MEMORIES;
    }
  },

  saveMemories: (memories: MemoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(memories));
    } catch (e) {
      console.warn('Failed to save memories', e);
    }
  },

  getPlannerItems: (): PlannerItem[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PLANNER);
      return data ? JSON.parse(data) : INITIAL_PLANNER_ITEMS;
    } catch {
      return INITIAL_PLANNER_ITEMS;
    }
  },

  savePlannerItems: (items: PlannerItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.PLANNER, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to save planner items', e);
    }
  },

  getHabits: (): HabitItem[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HABITS);
      return data ? JSON.parse(data) : INITIAL_HABITS;
    } catch {
      return INITIAL_HABITS;
    }
  },

  saveHabits: (habits: HabitItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
    } catch (e) {
      console.warn('Failed to save habits', e);
    }
  },

  getChatHistory: (): ChatMessage[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CHAT);
      return data ? JSON.parse(data) : [
        {
          id: 'welcome_msg',
          role: 'assistant',
          content: 'Hello! I am LifeOS, your universal AI companion. Ask me anything, plan your daily agenda, learn a new skill, or turn your thoughts into structured action.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ];
    } catch {
      return [];
    }
  },

  saveChatHistory: (chat: ChatMessage[]) => {
    try {
      // Keep only last 50 messages to preserve mobile local storage
      const trimmed = chat.slice(-50);
      localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Failed to save chat', e);
    }
  },

  exportAllDataJSON: () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      user: Storage.getUser(),
      memories: Storage.getMemories(),
      planner: Storage.getPlannerItems(),
      habits: Storage.getHabits(),
      chat: Storage.getChatHistory(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LifeOS_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  clearAllData: () => {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
