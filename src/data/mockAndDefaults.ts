import { UserProfile, MemoryItem, PlannerItem, HabitItem } from '../types';

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

export const DEFAULT_USER: UserProfile = {
  id: 'user_default_101',
  name: 'Nodysom User',
  email: '',
  preferredLanguage: 'en',
  country: 'TZ',
  tier: 'FREE',
  lowDataMode: false,
  interests: [],
  goals: '',
  isGuest: true,
};

export const INITIAL_MEMORIES: MemoryItem[] = [
  {
    id: 'mem_1',
    category: 'goal',
    content: 'Build a productive and organized daily routine.',
    createdAt: '2026-09-05',
  },
  {
    id: 'mem_2',
    category: 'preference',
    content: 'Prefers concise and useful answers.',
    createdAt: '2026-09-05',
  },
];

export const INITIAL_PLANNER_ITEMS: PlannerItem[] = [
  {
    id: 'plan_1',
    title: 'Review today’s priorities',
    type: 'task',
    date: new Date().toISOString().split('T')[0],
    time: '08:30 AM',
    durationMinutes: 30,
    completed: false,
    priority: 'normal',
    category: 'Personal',
    tags: ['Personal'],
  },
];

export const INITIAL_HABITS: HabitItem[] = [
  {
    id: 'hab_1',
    name: 'Daily learning',
    category: 'Learning',
    streak: 0,
    completedToday: false,
    history: [],
  },
  {
    id: 'hab_2',
    name: 'Daily planning',
    category: 'Productivity',
    streak: 0,
    completedToday: false,
    history: [],
  },
];

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

export const LEARNING_SUBJECTS = [
  {
    id: 'languages',
    title: 'Languages',
    description: 'Swahili, French, Spanish, English',
    icon: 'Languages',
    color: 'from-amber-500/20 to-orange-500/10',
  },
  {
    id: 'coding',
    title: 'Coding & Tech',
    description: 'Web development, Python, Algorithms and AI',
    icon: 'Code',
    color: 'from-cyan-500/20 to-blue-500/10',
  },
  {
    id: 'math',
    title: 'Mathematics',
    description: 'Algebra, Statistics and Everyday Math',
    icon: 'Calculator',
    color: 'from-emerald-500/20 to-teal-500/10',
  },
  {
    id: 'science',
    title: 'Science & Physics',
    description: 'Biology, Physics and Environmental Science',
    icon: 'Atom',
    color: 'from-purple-500/20 to-indigo-500/10',
  },
  {
    id: 'business',
    title: 'Business & Finance',
    description: 'Entrepreneurship, Accounting and Marketing',
    icon: 'Briefcase',
    color: 'from-rose-500/20 to-pink-500/10',
  },
  {
    id: 'skills',
    title: 'Professional Skills',
    description: 'Communication, Resumes and Leadership',
    icon: 'Award',
    color: 'from-blue-500/20 to-indigo-500/10',
  },
];
