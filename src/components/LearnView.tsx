import React from 'react';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  GraduationCap,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';

interface LearnViewProps {
  onOpenLesson?: (topic: string) => void;
}

const subjects = [
  {
    name: 'Science',
    description: 'Explore science concepts and build strong understanding.',
    icon: Brain,
  },
  {
    name: 'Languages',
    description: 'Improve communication, vocabulary and language skills.',
    icon: BookOpen,
  },
  {
    name: 'Technology',
    description: 'Learn practical digital and technology skills.',
    icon: Sparkles,
  },
  {
    name: 'Personal Growth',
    description: 'Build useful habits and improve everyday skills.',
    icon: Target,
  },
];

export function LearnView({
  onOpenLesson,
}: LearnViewProps) {
  return (
    <main className="nodysom-fade-up mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:px-8">

      {/* HEADER */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.14] via-indigo-500/[0.07] to-transparent p-5 sm:p-8">

        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative">

          <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
            <GraduationCap size={13} />
            AI Learning
          </div>

          <h1 className="mt-4 nodysom-page-title">
            Learn smarter.
          </h1>

          <p className="nodysom-page-subtitle max-w-2xl">
            Build knowledge through focused lessons,
            practical explanations and intelligent practice.
          </p>

          <button
            type="button"
            onClick={() => onOpenLesson?.('General Learning')}
            className="nodysom-btn nodysom-btn-primary mt-6"
          >
            <Sparkles size={16} />
            Start learning
            <ChevronRight size={15} />
          </button>

        </div>
      </section>

      {/* PROGRESS */}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">

        <div className="nodysom-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
              <BookOpen size={18} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Lessons
              </p>

              <p className="mt-1 text-lg font-extrabold text-white">
                0
              </p>
            </div>
          </div>
        </div>

        <div className="nodysom-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
              <Flame size={18} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Streak
              </p>

              <p className="mt-1 text-lg font-extrabold text-white">
                0 days
              </p>
            </div>
          </div>
        </div>

        <div className="nodysom-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
              <Trophy size={18} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Progress
              </p>

              <p className="mt-1 text-lg font-extrabold text-white">
                Starting
              </p>
            </div>
          </div>
        </div>

      </section>

      {/* SUBJECTS */}
      <section className="mt-8">

        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-400">
              Explore
            </p>

            <h2 className="mt-1 nodysom-section-title">
              Learning subjects
            </h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          {subjects.map((subject) => {
            const Icon = subject.icon;

            return (
              <button
                key={subject.name}
                type="button"
                onClick={() =>
                  onOpenLesson?.(subject.name)
                }
                className="group rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-400/20 hover:bg-indigo-500/[0.06] active:scale-[0.98]"
              >

                <div className="flex items-start justify-between">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                    <Icon size={19} />
                  </div>

                  <ChevronRight
                    size={16}
                    className="text-slate-600 transition-all group-hover:translate-x-1 group-hover:text-indigo-300"
                  />

                </div>

                <h3 className="mt-5 text-sm font-extrabold text-white">
                  {subject.name}
                </h3>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {subject.description}
                </p>

                <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-indigo-300">
                  <span>Explore</span>
                  <ChevronRight size={12} />
                </div>

              </button>
            );
          })}

        </div>

      </section>

      {/* STUDY TIP */}
      <section className="mt-7 grid gap-4 lg:grid-cols-2">

        <div className="nodysom-card p-5 sm:p-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
              <CheckCircle2 size={18} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Study strategy
              </p>

              <h3 className="mt-1 text-sm font-extrabold text-white">
                Learn in focused sessions
              </h3>
            </div>

          </div>

          <p className="mt-4 text-xs leading-6 text-slate-400">
            Choose one topic, understand the main idea,
            practise it, then review what you learned.
          </p>

        </div>

        <div className="nodysom-card p-5 sm:p-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
              <Clock3 size={18} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Recommended
              </p>

              <h3 className="mt-1 text-sm font-extrabold text-white">
                20–30 minutes
              </h3>
            </div>

          </div>

          <p className="mt-4 text-xs leading-6 text-slate-400">
            Short, consistent study sessions can make it
            easier to stay focused and review regularly.
          </p>

        </div>

      </section>

    </main>
  );
}
