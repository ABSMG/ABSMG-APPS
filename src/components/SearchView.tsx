import React, { FormEvent, useState } from 'react';
import {
  Search,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface SearchSource {
  title?: string;
  url?: string;
  snippet?: string;
}

interface SearchResult {
  query: string;
  summary: string;
  verifiedFacts?: string[];
  estimates?: string[];
  uncertainties?: string[];
  sources?: SearchSource[];
  suggestedActions?: string[];
}

interface SearchViewProps {
  onTriggerAction?: (text: string) => void;
  preferredLanguage?: string;
}

export function SearchView({
  onTriggerAction,
  preferredLanguage = 'en',
}: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] =
    useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitSearch = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const value = query.trim();

    if (!value || loading) {
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(
        '/api/ai/search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: value,
            language: preferredLanguage,
          }),
        }
      );

      let data: any = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Search failed (${response.status}).`
        );
      }

      setResult({
        query: data?.query || value,
        summary:
          data?.summary ||
          'No summary was returned.',
        verifiedFacts:
          Array.isArray(data?.verifiedFacts)
            ? data.verifiedFacts
            : [],
        estimates:
          Array.isArray(data?.estimates)
            ? data.estimates
            : [],
        uncertainties:
          Array.isArray(data?.uncertainties)
            ? data.uncertainties
            : [],
        sources:
          Array.isArray(data?.sources)
            ? data.sources
            : [],
        suggestedActions:
          Array.isArray(data?.suggestedActions)
            ? data.suggestedActions
            : [],
      });
    } catch (err: any) {
      console.error(
        'Nodysom AI search failed:',
        err
      );

      const message =
        err?.message ||
        'Search is temporarily unavailable.';

      setError(message);

      setResult({
        query: value,
        summary: message,
        verifiedFacts: [],
        estimates: [],
        uncertainties: [
          'The search service could not complete this request.',
        ],
        sources: [],
        suggestedActions: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedAction = (
    action: string
  ) => {
    const clean = action.trim();

    if (!clean) {
      return;
    }

    if (onTriggerAction) {
      onTriggerAction(clean);
      return;
    }

    setQuery(clean);
  };

  const clearSearch = () => {
    if (loading) {
      return;
    }

    setQuery('');
    setResult(null);
    setError('');
  };

  return (
    <main className="nodysom-fade-up mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-6 lg:px-8">
      {/* HEADER */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-indigo-500/[0.14] via-violet-500/[0.07] to-transparent p-5 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300">
            <Sparkles size={13} />
            AI Search
          </div>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Search with Nodysom
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Ask Nodysom to research a question,
            explain information, compare options,
            or help you understand a topic.
          </p>

          {/* SEARCH FORM */}
          <form
            onSubmit={submitSearch}
            className="mt-6"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                  type="text"
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Ask anything..."
                  maxLength={2000}
                  disabled={loading}
                  className="w-full rounded-xl border border-white/[0.08] bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={
                  !query.trim() || loading
                }
                className="nodysom-btn nodysom-btn-primary min-h-[46px] min-w-[125px] justify-center disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Searching
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>

          {/* CLEAR */}
          {(query || result || error) && (
            <button
              type="button"
              onClick={clearSearch}
              disabled={loading}
              className="mt-3 text-xs font-semibold text-slate-500 transition hover:text-slate-300 disabled:opacity-40"
            >
              Clear search
            </button>
          )}
        </div>
      </section>

      {/* ERROR */}
      {error && (
        <section className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
          <div className="flex gap-3">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-rose-400"
            />

            <div>
              <p className="text-sm font-bold text-rose-300">
                Search error
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                {error}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* LOADING */}
      {loading && (
        <section className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
          <div className="flex items-center gap-3">
            <Loader2
              size={20}
              className="animate-spin text-indigo-400"
            />

            <div>
              <p className="text-sm font-bold text-white">
                Nodysom is thinking...
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Processing your search request.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* RESULTS */}
      {result && !loading && (
        <div className="mt-5 space-y-4">
          {/* SUMMARY */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <div className="flex items-center gap-2">
              <Sparkles
                size={17}
                className="text-indigo-400"
              />

              <h2 className="text-sm font-extrabold text-white">
                Summary
              </h2>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">
              {result.summary}
            </p>
          </section>

          {/* VERIFIED FACTS */}
          {result.verifiedFacts &&
            result.verifiedFacts.length > 0 && (
              <section className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.025] p-5">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={17}
                    className="text-emerald-400"
                  />

                  <h2 className="text-sm font-extrabold text-white">
                    Key facts
                  </h2>
                </div>

                <ul className="mt-4 space-y-3">
                  {result.verifiedFacts.map(
                    (fact, index) => (
                      <li
                        key={`${fact}-${index}`}
                        className="flex gap-3 text-sm leading-6 text-slate-300"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                        <span>{fact}</span>
                      </li>
                    )
                  )}
                </ul>
              </section>
            )}

          {/* ESTIMATES */}
          {result.estimates &&
            result.estimates.length > 0 && (
              <section className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.025] p-5">
                <h2 className="text-sm font-extrabold text-white">
                  Estimates
                </h2>

                <ul className="mt-4 space-y-3">
                  {result.estimates.map(
                    (item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="flex gap-3 text-sm leading-6 text-slate-300"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        <span>{item}</span>
                      </li>
                    )
                  )}
                </ul>
              </section>
            )}

          {/* UNCERTAINTIES */}
          {result.uncertainties &&
            result.uncertainties.length > 0 && (
              <section className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5">
                <h2 className="text-sm font-extrabold text-white">
                  Uncertainties
                </h2>

                <ul className="mt-4 space-y-3">
                  {result.uncertainties.map(
                    (item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="flex gap-3 text-sm leading-6 text-slate-400"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                        <span>{item}</span>
                      </li>
                    )
                  )}
                </ul>
              </section>
            )}

          {/* SOURCES */}
          {result.sources &&
            result.sources.length > 0 && (
              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <h2 className="text-sm font-extrabold text-white">
                  Sources
                </h2>

                <div className="mt-4 space-y-3">
                  {result.sources.map(
                    (source, index) => (
                      <div
                        key={`${source.url || source.title || 'source'}-${index}`}
                        className="rounded-xl border border-white/[0.06] bg-slate-950/50 p-3"
                      >
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-indigo-300 hover:text-indigo-200 hover:underline"
                          >
                            {source.title ||
                              source.url}
                          </a>
                        ) : (
                          <p className="text-sm font-semibold text-slate-200">
                            {source.title ||
                              'Source'}
                          </p>
                        )}

                        {source.snippet && (
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {source.snippet}
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>
              </section>
            )}

          {/* SUGGESTED ACTIONS */}
          {result.suggestedActions &&
            result.suggestedActions.length > 0 && (
              <section className="rounded-2xl border border-indigo-500/10 bg-indigo-500/[0.025] p-5">
                <h2 className="text-sm font-extrabold text-white">
                  Suggested next steps
                </h2>

                <div className="mt-4 flex flex-col gap-2">
                  {result.suggestedActions.map(
                    (action, index) => (
                      <button
                        key={`${action}-${index}`}
                        type="button"
                        onClick={() =>
                          handleSuggestedAction(
                            action
                          )
                        }
                        className="group flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-left transition hover:border-indigo-400/20 hover:bg-indigo-500/[0.05]"
                      >
                        <span className="text-xs font-semibold text-slate-300 group-hover:text-white">
                          {action}
                        </span>

                        <ArrowRight
                          size={15}
                          className="shrink-0 text-slate-600 transition group-hover:translate-x-1 group-hover:text-indigo-300"
                        />
                      </button>
                    )
                  )}
                </div>
              </section>
            )}
        </div>
      )}

      {/* EMPTY STATE */}
      {!result && !loading && !error && (
        <section className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">
            <Search size={21} />
          </div>

          <h2 className="mt-4 text-sm font-extrabold text-white">
            What do you want to know?
          </h2>

          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
            Enter a question above and Nodysom
            will process it using the AI search
            service.
          </p>
        </section>
      )}
    </main>
  );
}
