export const DEFAULT_USER = {
  id: 'default-user',
  name: 'Nodysom User',
  email: '',
  preferredLanguage: 'sw',
  country: 'TZ',
  tier: 'FREE',
  lowDataMode: false,
  interests: [],
  goals: '',
  isGuest: true,
};

export const INITIAL_MEMORIES = [
  {
    id: 'memory_welcome',
    category: 'fact' as const,
    content: 'Nodysom AI is your personal AI companion.',
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_PLANNER_ITEMS = [];

export const INITIAL_HABITS = [];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', flag: '🌐' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', flag: '🇹🇿' },
  { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
  { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇦🇪' },
  { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇧🇷' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' },
];

export const LANGUAGES = SUPPORTED_LANGUAGES;
