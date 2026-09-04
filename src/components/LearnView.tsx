import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Award,
  Layers,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RotateCw,
  HelpCircle,
  GraduationCap,
} from 'lucide-react';
import { LEARNING_SUBJECTS } from '../data/mockAndDefaults';
import { LearnModule, QuizQuestion, Flashcard } from '../types';

export const LearnView: React.FC = () => {
  const [selectedTopic, setSelectedTopic] = useState('Foundations of Artificial Intelligence');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [activeMode, setActiveMode] = useState<'lesson' | 'quiz' | 'flashcards'>('lesson');
  const [customTopicInput, setCustomTopicInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Lesson Module State
  const [moduleData, setModuleData] = useState<LearnModule>({
    topic: 'Foundations of Artificial Intelligence',
    difficulty: 'beginner',
    lessonContent:
      'Artificial Intelligence (AI) refers to computer systems engineered to simulate aspects of human intelligence, such as learning from patterns, reasoning logically, solving problems, and understanding human language.\n\nUnlike traditional computer programs that follow rigid step-by-step instructions, modern AI uses algorithms (like neural networks) that improve automatically as they process more data. Think of it like teaching a child to recognize a cat not by writing thousands of rules about fur and whiskers, but by showing pictures until the pattern clicks.',
    keyTakeaways: [
      'AI identifies complex statistical patterns in data instead of following hardcoded rules.',
      'Machine Learning is the engine powering modern generative and analytical models.',
      'Training requires quality data, validation, and computational power.',
    ],
    quiz: [
      {
        question: 'How does modern machine learning differ from traditional computer programming?',
        options: [
          'It learns patterns directly from data rather than following fixed manual rules',
          'It requires no electricity or processors',
          'It only runs on hardware built before 1990',
          'It can never make an error',
        ],
        correctIndex: 0,
        explanation:
          'Traditional programming relies on humans writing every single rule. Machine learning algorithms discover the rules and patterns automatically from datasets.',
      },
      {
        question: 'Which of the following is essential for training high-accuracy models?',
        options: [
          'Large quantities of noisy uncurated data only',
          'High quality, representative training data and evaluation metrics',
          'Turning off all validation checks',
          'Avoiding mathematical models',
        ],
        correctIndex: 1,
        explanation:
          'Quality, balance, and clean representative datasets are the foundation of performant AI systems.',
      },
    ],
    flashcards: [
      {
        front: 'What is a Neural Network in AI?',
        back: 'A computational model inspired by the human brain, composed of interconnected nodes (neurons) that process and weight input data.',
      },
      {
        front: 'What is "Training" in Machine Learning?',
        back: 'The process where an AI algorithm adjusts internal weights and parameters to minimize errors against reference data.',
      },
      {
        front: 'What is "Inference"?',
        back: 'When a trained AI model takes brand-new input data and generates a prediction or answer in real time.',
      },
    ],
  });

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showQuizFeedback, setShowQuizFeedback] = useState(false);

  // Flashcard state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const fetchTopicContent = async (topicName: string, level: 'beginner' | 'intermediate' | 'advanced') => {
    setIsLoading(true);
    setSelectedAnswers({});
    setShowQuizFeedback(false);
    setCurrentCardIndex(0);
    setIsFlipped(false);

    try {
      const res = await fetch('/api/ai/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicName, difficulty: level }),
      });
      const data = await res.json();
      setModuleData({
        topic: topicName,
        difficulty: level,
        lessonContent: data.lessonContent || 'Lesson content is ready.',
        keyTakeaways: data.keyTakeaways || ['Study key terms', 'Practice real problems'],
        quiz: data.quiz || [],
        flashcards: data.flashcards || [],
      });
      setSelectedTopic(topicName);
    } catch (e) {
      console.error('Failed to load topic:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopicInput.trim()) return;
    fetchTopicContent(customTopicInput.trim(), difficulty);
    setCustomTopicInput('');
  };

  const handleQuizAnswer = (qIdx: number, optIdx: number) => {
    if (showQuizFeedback) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto px-4 pt-3">
      {/* Header */}
      <section className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            Universal Learning Hub
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
          Learn anything with your AI Tutor
        </h1>
        <p className="text-xs text-slate-400">
          Personalized bite-sized lessons, interactive quizzes, and flashcards across any subject.
        </p>
      </section>

      {/* Custom Topic Search Box */}
      <section>
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <input
            type="text"
            value={customTopicInput}
            onChange={(e) => setCustomTopicInput(e.target.value)}
            placeholder="Search any topic (e.g. 'Photosynthesis', 'Python Loops', 'Compound Interest')..."
            className="flex-1 bg-slate-900 border border-slate-750 focus:border-indigo-500 rounded-2xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !customTopicInput.trim()}
            className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all shrink-0"
          >
            {isLoading ? '...' : 'Learn'}
          </button>
        </form>
      </section>

      {/* Subject Preset Cards */}
      <section className="space-y-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
          Featured Topics
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LEARNING_SUBJECTS.map((sub) => (
            <button
              key={sub.id}
              onClick={() => fetchTopicContent(sub.title, difficulty)}
              className="text-left p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-850 transition-all text-xs"
            >
              <h4 className="font-bold text-slate-200 line-clamp-1">
                {sub.title}
              </h4>
              <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                {sub.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Controls: Difficulty & Mode Switchers */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2 bg-slate-900/90 border border-slate-800 rounded-2xl">
        {/* Difficulty buttons */}
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-2">
            Level:
          </span>
          {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => {
                setDifficulty(lvl);
                fetchTopicContent(selectedTopic, lvl);
              }}
              className={`text-xs px-2.5 py-1 rounded-xl capitalize transition-all ${
                difficulty === lvl
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Mode Buttons */}
        <div className="flex items-center gap-1 w-full sm:w-auto justify-end">
          {[
            { id: 'lesson', label: 'Lesson', icon: BookOpen },
            { id: 'quiz', label: 'Quiz', icon: Award },
            { id: 'flashcards', label: 'Flashcards', icon: Layers },
          ].map((mode) => {
            const Icon = mode.icon;
            const isActive = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode.id as any)}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-slate-800 text-indigo-400 font-semibold border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Mode Content */}
      <section className="space-y-4">
        {/* 1. Lesson Mode */}
        {activeMode === 'lesson' && (
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">
                  {moduleData.difficulty} lesson
                </span>
                <h2 className="text-base font-bold text-slate-100 mt-0.5">
                  {moduleData.topic}
                </h2>
              </div>
            </div>

            <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans space-y-3">
              {moduleData.lessonContent}
            </div>

            {/* Key Takeaways */}
            <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-2 mt-4">
              <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider block">
                Key Takeaways
              </span>
              <ul className="space-y-1.5">
                {moduleData.keyTakeaways.map((takeaway, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveMode('quiz')}
                className="text-xs px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition-all"
              >
                Take Topic Quiz <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Quiz Mode */}
        {activeMode === 'quiz' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Practice Quiz ({moduleData.quiz.length} Questions)
              </h3>
              {showQuizFeedback && (
                <button
                  onClick={() => {
                    setSelectedAnswers({});
                    setShowQuizFeedback(false);
                  }}
                  className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <RotateCw className="w-3 h-3" /> Retry
                </button>
              )}
            </div>

            {moduleData.quiz.map((q, qIdx) => {
              const userAnswer = selectedAnswers[qIdx];
              const isAnswered = userAnswer !== undefined;
              return (
                <div
                  key={qIdx}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md"
                >
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                      {qIdx + 1}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-100">
                      {q.question}
                    </h4>
                  </div>

                  <div className="space-y-2 pt-1">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = userAnswer === optIdx;
                      const isCorrect = optIdx === q.correctIndex;

                      let btnStyle = 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700';
                      if (showQuizFeedback) {
                        if (isCorrect) {
                          btnStyle = 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-semibold';
                        } else if (isSelected) {
                          btnStyle = 'bg-rose-950/40 border-rose-500 text-rose-300 line-through';
                        }
                      } else if (isSelected) {
                        btnStyle = 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold';
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleQuizAnswer(qIdx, optIdx)}
                          className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between ${btnStyle}`}
                        >
                          <span>{opt}</span>
                          {showQuizFeedback && isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          {showQuizFeedback && isSelected && !isCorrect && (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {showQuizFeedback && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-300 flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-200">Explanation: </span>
                        <span>{q.explanation}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {!showQuizFeedback && (
              <button
                onClick={() => setShowQuizFeedback(true)}
                disabled={Object.keys(selectedAnswers).length === 0}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
              >
                Submit Answers & View Explanations
              </button>
            )}
          </div>
        )}

        {/* 3. Flashcards Mode */}
        {activeMode === 'flashcards' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {moduleData.flashcards.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                No flashcards available for this topic.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>
                    Card {currentCardIndex + 1} of {moduleData.flashcards.length}
                  </span>
                  <span>Tap card to flip</span>
                </div>

                {/* Interactive Flip Card */}
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="cursor-pointer min-h-[200px] rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950/50 border border-slate-700/80 p-6 flex flex-col items-center justify-center text-center shadow-xl transition-all hover:border-indigo-500/50 relative overflow-hidden"
                >
                  <span className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-wider text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10">
                    {isFlipped ? 'Answer' : 'Question / Concept'}
                  </span>

                  <p className="text-sm sm:text-base font-semibold text-slate-100 font-sans max-w-md">
                    {isFlipped
                      ? moduleData.flashcards[currentCardIndex].back
                      : moduleData.flashcards[currentCardIndex].front}
                  </p>

                  <span className="text-[10px] text-slate-400 mt-4">
                    [Tap anywhere to flip]
                  </span>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentCardIndex((prev) => Math.max(0, prev - 1));
                    }}
                    disabled={currentCardIndex === 0}
                    className="flex-1 py-2 rounded-xl bg-slate-900 border border-slate-800 disabled:opacity-30 text-xs text-slate-300 font-medium"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentCardIndex((prev) =>
                        Math.min(moduleData.flashcards.length - 1, prev + 1)
                      );
                    }}
                    disabled={currentCardIndex === moduleData.flashcards.length - 1}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-xs text-white font-semibold shadow-md"
                  >
                    Next Card
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
