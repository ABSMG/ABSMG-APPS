import {
  UserProfile,
  MemoryItem,
  PlannerItem,
  HabitItem,
} from '../types';

export const DEFAULT_USER: UserProfile = {
  id: 'default-user',
  name: 'Nodysom User',
  email: '',
  preferredLanguage: 'English',
  country: '',
  tier: 'FREE',
  lowDataMode: false,
  interests: [],
  goals: '',
  isGuest: true,
};

export const INITIAL_MEMORIES: MemoryItem[] = [];

export const INITIAL_PLANNER_ITEMS: PlannerItem[] = [];

export const INITIAL_HABITS: HabitItem[] = [];

export const LEARNING_SUBJECTS = [
  {
    id: 'languages',
    title: 'Languages',
    description: 'Swahili, French, Spanish, English',
    icon: 'Languages',
    color: 'from-amber-500/20 to-orange-500/20',
  },
  {
    id: 'coding',
    title: 'Coding & Tech',
    description: 'Web development, Python, Algorithms, AI',
    icon: 'Code',
    color: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    id: 'math',
    title: 'Mathematics',
    description: 'Algebra, Statistics, Everyday Math',
    icon: 'Calculator',
    color: 'from-violet-500/20 to-purple-500/20',
  },
  {
    id: 'science',
    title: 'Science & Physics',
    description: 'Biology, Physics, Environmental Science',
    icon: 'Atom',
    color: 'from-emerald-500/20 to-teal-500/20',
  },
  {
    id: 'business',
    title: 'Business & Finance',
    description: 'Entrepreneurship, Accounting, Marketing',
    icon: 'Briefcase',
    color: 'from-rose-500/20 to-pink-500/20',
  },
  {
    id: 'skills',
    title: 'Professional Skills',
    description: 'Communication, Resumes, Leadership',
    icon: 'Award',
    color: 'from-indigo-500/20 to-blue-500/20',
  },
];
