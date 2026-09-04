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

export const DEFAULT_USER: UserProfile = {
  id: 'user_default_101',
  name: 'Alex Rivera',
  email: 'alex.rivera@lifeos.world',
  preferredLanguage: 'en',
  country: 'Global',
  tier: 'FREE',
  lowDataMode: false,
  interests: ['Technology', 'Entrepreneurship', 'Healthy Living', 'Languages'],
  goals: 'Master software engineering & save $500 this quarter',
  isGuest: false,
};

export const INITIAL_MEMORIES: MemoryItem[] = [
  {
    id: 'mem_1',
    category: 'goal',
    content: 'Preparing for professional technical certifications this fall',
    createdAt: '2026-08-15',
  },
  {
    id: 'mem_2',
    category: 'preference',
    content: 'Prefers concise bullet-point daily plans over long prose',
    createdAt: '2026-08-20',
  },
  {
    id: 'mem_3',
    category: 'habit',
    content: 'Runs 30 minutes every morning before starting work',
    createdAt: '2026-08-28',
  },
];

export const INITIAL_PLANNER_ITEMS: PlannerItem[] = [
  {
    id: 'plan_1',
    title: 'Review Computer Science Exam Study Notes',
    type: 'task',
    date: new Date().toISOString().split('T')[0],
    time: '08:30 AM',
    durationMinutes: 60,
    completed: false,
    priority: 'high',
    category: 'Study',
    tags: ['Study', 'Urgent'],
  },
  {
    id: 'plan_2',
    title: 'Call Mother & Check In',
    type: 'reminder',
    date: new Date().toISOString().split('T')[0],
    time: '12:30 PM',
    completed: false,
    priority: 'normal',
    category: 'Personal',
    tags: ['Personal', 'Family'],
  },
  {
    id: 'plan_3',
    title: 'Work Shift / Team Standup',
    type: 'schedule_block',
    date: new Date().toISOString().split('T')[0],
    time: '02:00 PM',
    durationMinutes: 180,
    completed: true,
    priority: 'high',
    category: 'Work',
    tags: ['Work', 'Urgent'],
  },
  {
    id: 'plan_4',
    title: 'Budget Allocation & Review Monthly Savings',
    type: 'task',
    date: new Date().toISOString().split('T')[0],
    time: '06:00 PM',
    durationMinutes: 30,
    completed: false,
    priority: 'normal',
    category: 'Personal',
    tags: ['Personal', 'Finance'],
  },
];

export const INITIAL_HABITS: HabitItem[] = [
  {
    id: 'hab_1',
    name: 'Morning Hydration & Walk',
    category: 'Health',
    streak: 14,
    completedToday: true,
    history: ['2026-09-01', '2026-09-02', '2026-09-03'],
  },
  {
    id: 'hab_2',
    name: 'Read 20 mins or Language Flashcards',
    category: 'Learning',
    streak: 9,
    completedToday: false,
    history: ['2026-09-01', '2026-09-02'],
  },
  {
    id: 'hab_3',
    name: 'Log Daily Expenses',
    category: 'Finance',
    streak: 22,
    completedToday: true,
    history: ['2026-09-01', '2026-09-02', '2026-09-03'],
  },
];

export const SUGGESTED_ACTIONS = [
  {
    label: 'Plan my day',
    prompt: 'I have classes from 8 AM to 2 PM and work from 4 PM to 7 PM. Create my optimized daily schedule.',
    icon: 'Calendar',
    badge: 'Smart Planner',
  },
  {
    label: 'Create budget',
    prompt: 'Help me create a simple monthly budget to save 20% on a modest income.',
    icon: 'PieChart',
    badge: 'Finance',
  },
  {
    label: 'Translate to Swahili',
    prompt: 'Translate this message into Swahili: "Welcome to LifeOS, where intelligence meets everyday life."',
    icon: 'Globe',
    badge: 'Languages',
  },
  {
    label: 'Explain like beginner',
    prompt: 'Explain how machine learning and neural networks work like I am a complete beginner.',
    icon: 'Sparkles',
    badge: 'Learn',
  },
  {
    label: 'Find scholarships',
    prompt: 'What are the top international scholarships for students in developing nations and Africa?',
    icon: 'Search',
    badge: 'Search',
  },
  {
    label: 'Write an email',
    prompt: 'Help me draft a polite, professional email requesting a mentor meeting.',
    icon: 'PenTool',
    badge: 'Writing',
  },
];

export const LEARNING_SUBJECTS = [
  { id: 'languages', title: 'Languages', description: 'Swahili, French, Spanish, English', icon: 'Languages', color: 'from-amber-500/20 to-orange-500/10' },
  { id: 'coding', title: 'Coding & Tech', description: 'Web dev, Python, Algorithms, AI', icon: 'Code', color: 'from-cyan-500/20 to-blue-500/10' },
  { id: 'math', title: 'Mathematics', description: 'Algebra, Statistics, Everyday Math', icon: 'Calculator', color: 'from-emerald-500/20 to-teal-500/10' },
  { id: 'science', title: 'Science & Physics', description: 'Biology, Environmental science', icon: 'Atom', color: 'from-purple-500/20 to-indigo-500/10' },
  { id: 'business', title: 'Business & Finance', description: 'Entrepreneurship, Accounting, Marketing', icon: 'Briefcase', color: 'from-rose-500/20 to-pink-500/10' },
  { id: 'skills', title: 'Professional Skills', description: 'Communication, Resumes, Leadership', icon: 'Award', color: 'from-blue-500/20 to-indigo-500/10' },
];
