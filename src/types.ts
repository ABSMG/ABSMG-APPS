export type TabType = 'home' | 'search' | 'learn' | 'planner' | 'profile';

export type UserTier = 'FREE' | 'PLUS' | 'BUSINESS';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  preferredLanguage: string;
  country: string;
  tier: UserTier;
  lowDataMode: boolean;
  interests: string[];
  goals: string;
  isGuest: boolean;
}

export interface MemoryItem {
  id: string;
  category: 'preference' | 'goal' | 'habit' | 'fact' | 'work';
  content: string;
  createdAt: string;
}

export type PlannerItemType = 'task' | 'reminder' | 'schedule_block';
export type PriorityType = 'low' | 'normal' | 'high';

export interface PlannerItem {
  id: string;
  title: string;
  type: PlannerItemType;
  date: string; // YYYY-MM-DD
  time?: string;
  durationMinutes?: number;
  completed: boolean;
  priority: PriorityType;
  category?: string;
  tags?: string[];
}

export interface HabitItem {
  id: string;
  name: string;
  category: string;
  streak: number;
  completedToday: boolean;
  history: string[]; // dates completed
}

export interface SmartAction {
  type: 'TASK' | 'REMINDER' | 'SCHEDULE' | 'BUDGET';
  title: string;
  date?: string;
  time?: string;
  category?: string;
  amount?: number;
  confirmedRequired?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  detectedAction?: SmartAction | null;
  audioAvailable?: boolean;
}

export interface SearchResult {
  query: string;
  summary: string;
  verifiedFacts: string[];
  estimates: string[];
  uncertainties: string[];
  sources: Array<{ title: string; url?: string }>;
  suggestedActions: string[];
}

export interface ScheduleBlock {
  time: string;
  title: string;
  category: string;
  durationMinutes?: number;
  notes?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface LearnModule {
  topic: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  lessonContent: string;
  keyTakeaways: string[];
  quiz: QuizQuestion[];
  flashcards: Flashcard[];
}
