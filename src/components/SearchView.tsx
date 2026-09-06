import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  ArrowRight,
  Clock3,
} from 'lucide-react';

interface SearchResult {
  query: string;
  summary: string;
  verifiedFacts: string[];
  estimates: string[];
  uncertainties: string[];
  sources: Array<{
    title: string;
    url?: string;
  }>;
  suggestedActions: string[];
}

interface SearchViewProps {
  onSearch?: (query: string) => void;
  result?: SearchResult | null;
  loading?: boolean;
}

export function SearchView({
  onSearch,
  result,
  loading = false,
}: SearchViewProps) {
  const [query, setQuery] = useState('');

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();

    const value = query.trim();

    if (!value) return;

    onSearch?.(value);
  };

  return (
    <main className="nodysom-fade-up mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:px-8">

      {/* HEADER */}
      <section className="mb-7">
        <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-400">
          <Sparkles size={13} />
          Intelligent Search
        </div>

        <h1 className="nodysom-page-title">
          Search with Nodysom
        </h1>

        <p className="nodysom-page-subtitle max-w-2xl">
          Search for information and get a clear answer with
          facts, estimates, uncertainties and useful sources.
        </p>
      </section>

      {/* SEARCH BOX */}
      <section className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-3 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-4">

        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />

        <form
          onSubmit={submitSearch}
          className="relative flex flex-col gap-3 sm:flex-row"
        >

          <div className="relative flex-1">

            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="What would you like to know?"
              className="nodysom-input pl-11 pr-4"
              aria-label="Search query"
            />

          </div>

          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="nodysom-btn nodysom-btn-primary min-w-[120px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Searching
              </>
            ) : (
              <>
                <Search size={16} />
                Search
              </>
            )}
          </button>

        </form>

      </section>

      {/* EMPTY STATE */}
      {!result && !loading && (
        <section className="mt-6 grid gap-4 sm:grid-cols-3">

          {[
            {
              title: 'Ask anything',
              text: 'Search questions in natural language.',
            },
            {
              title: 'Understand faster',
              text: 'Get concise answers organized clearly.',
            },
            {
              title: 'Check sources',
              text: 'Review useful sources behind the answer.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="nodysom-card-soft p-5"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                <Sparkles size={16} />
              </div>

              <h3 className="text-sm font-bold text-white">
                {item.title}
              </h3>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {item.text}
              </p>
            </div>
          ))}

        </section>
      )}

      {/* LOADING */}
      {loading && (
        <section className="mt-6 space-y-4">

          <div className="nodysom-card p-5">
            <div className="h-4 w-32 animate-pulse rounded bg-white/[0.07]" />
            <div className="mt-4 h-4 w-full animate-pulse rounded bg-white/[0.05]" />
            <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-white/[0.05]" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-white/[0.05]" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="nodysom-card h-36 animate-pulse" />
            <div className="nodysom-card h-36 animate-pulse" />
          </div>

        </section>
      )}

      {/* RESULTS */}
      {result && !loading && (
        <section className="mt-6 space-y-5">

          {/* SUMMARY */}
          <div className="nodysom-card overflow-hidden">

            <div className="border-b border-white/[0.06] p-5 sm:p-6">

              <div className="flex flex-wrap items-center justify-between gap-3">

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-400">
                    Answer
                  </p>

                  <h2 className="mt-1 text-lg font-extrabold text-white">
                    {result.query}
                  </h2>
                </div>

                <span className="nodysom-badge nodysom-badge-success">
                  <CheckCircle2 size={12} />
                  Search complete
                </span>

              </div>

              <p className="mt-5 text-sm leading-7 text-slate-300">
                {result.summary}
              </p>

            </div>

            {/* VERIFIED FACTS */}
            {result.verifiedFacts?.length > 0 && (
              <div className="p-5 sm:p-6">

                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle2
                    size={17}
                    className="text-emerald-400"
                  />

                  <h3 className="text-sm font-bold text-white">
                    Verified facts
                  </h3>
                </div>

                <div className="space-y-2">
                  {result.verifiedFacts.map(
                    (fact, index) => (
                      <div
                        key={`${fact}-${index}`}
                        className="rounded-xl border border-emerald-400/[0.08] bg-emerald-400/[0.035] p-3 text-xs leading-5 text-slate-300"
                      >
                        {fact}
                      </div>
                    )
                  )}
                </div>

              </div>
            )}

          </div>

          {/* ESTIMATES + UNCERTAINTIES */}
          <div className="grid gap-4 lg:grid-cols-2">

            {result.estimates?.length > 0 && (
              <div className="nodysom-card p-5">

                <div className="mb-4 flex items-center gap-2">
                  <Clock3
                    size={17}
                    className="text-amber-300"
                  />

                  <h3 className="text-sm font-bold text-white">
                    Estimates
                  </h3>
                </div>

                <div className="space-y-2">
                  {result.estimates.map(
                    (item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="rounded-xl bg-amber-400/[0.04] p-3 text-xs leading-5 text-slate-400"
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>

              </div>
            )}

            {result.uncertainties?.length > 0 && (
              <div className="nodysom-card p-5">

                <div className="mb-4 flex items-center gap-2">
                  <AlertCircle
                    size={17}
                    className="text-sky-300"
                  />

                  <h3 className="text-sm font-bold text-white">
                    Uncertainties
                  </h3>
                </div>

                <div className="space-y-2">
                  {result.uncertainties.map(
                    (item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="rounded-xl bg-sky-400/[0.04] p-3 text-xs leading-5 text-slate-400"
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>

              </div>
            )}

          </div>

          {/* SOURCES */}
          {result.sources?.length > 0 && (
            <div className="nodysom-card p-5">

              <div className="mb-4 flex items-center gap-2">
                <ExternalLink
                  size={17}
                  className="text-indigo-300"
                />

                <h3 className="text-sm font-bold text-white">
                  Sources
                </h3>
              </div>

              <div className="space-y-2">
                {result.sources.map(
                  (source, index) => (
                    <a
                      key={`${source.title}-${index}`}
                      href={source.url || '#'}
                      target={
                        source.url
                          ? '_blank'
                          : undefined
                      }
                      rel={
                        source.url
                          ? 'noreferrer'
                          : undefined
                      }
                      className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 transition-colors hover:border-indigo-400/20 hover:bg-indigo-500/[0.05]"
                    >

                      <span className="min-w-0 truncate text-xs font-medium text-slate-300 group-hover:text-white">
                        {source.title}
                      </span>

                      <ExternalLink
                        size={14}
                        className="shrink-0 text-slate-600 group-hover:text-indigo-300"
                      />

                    </a>
                  )
                )}
              </div>

            </div>
          )}

          {/* SUGGESTED ACTIONS */}
          {result.suggestedActions?.length > 0 && (
            <div className="rounded-[22px] border border-indigo-400/10 bg-indigo-500/[0.05] p-5">

              <div className="mb-4 flex items-center gap-2">
                <Sparkles
                  size={17}
                  className="text-indigo-300"
                />

                <h3 className="text-sm font-bold text-white">
                  Suggested next steps
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {result.suggestedActions.map(
                  (action, index) => (
                    <button
                      key={`${action}-${index}`}
                      type="button"
                      className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 transition-all hover:border-indigo-400/25 hover:bg-indigo-500/10 hover:text-white active:scale-95"
                    >
                      {action}

                      <ArrowRight
                        size={13}
                        className="text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-300"
                      />
                    </button>
                  )
                )}
              </div>

            </div>
          )}

        </section>
      )}

    </main>
  );
}
