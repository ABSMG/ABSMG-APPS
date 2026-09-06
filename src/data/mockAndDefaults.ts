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
  { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇵🇹' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' },
];

export const LANGUAGES = SUPPORTED_LANGUAGES;

export const SUGGESTED_ACTIONS = [
  {
    label: 'Plan my day',
    prompt:
      'Create an optimized daily schedule based on my priorities and available time.',
    icon: 'Calendar',
    badge: 'Smart Planner',
  },
  {
    label: 'Create budget',
    prompt:
      'Help me create a simple monthly budget and organize my spending.',
    icon: 'PieChart',
    badge: 'Finance',
  },
  {
    label: 'Translate to Swahili',
    prompt:
      'Translate my text into natural and correct Swahili.',
    icon: 'Globe',
    badge: 'Languages',
  },
  {
    label: 'Explain like beginner',
    prompt:
      'Explain this topic clearly as if I am a complete beginner.',
    icon: 'Sparkles',
    badge: 'Learn',
  },
  {
    label: 'Find scholarships',
    prompt:
      'Help me find suitable international scholarships and explain the requirements.',
    icon: 'Search',
    badge: 'Search',
  },
  {
    label: 'Write an email',
    prompt:
      'Help me write a clear, polite and professional email.',
    icon: 'PenTool',
    badge: 'Writing',
  },
];
