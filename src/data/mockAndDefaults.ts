export const DEFAULT_USER = {
  id: 'default-user',
  name: 'Nodysom User',
  email: '',
  avatar: '',
  bio: '',
  location: '',
  nativeLanguage: 'sw',
  learningLanguages: ['en'],
};

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
