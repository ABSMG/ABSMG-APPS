import React, { FormEvent, useEffect, useRef, useState } from 'react';
import {
Search,
Sparkles,
AlertCircle,
CheckCircle2,
ArrowRight,
Loader2,
ExternalLink,
RefreshCw,
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

interface NormalizedSearchResponse {
query?: string;
summary?: unknown;
answer?: unknown;
response?: unknown;
text?: unknown;
content?: unknown;
message?: unknown;
result?: unknown;
data?: unknown;
verifiedFacts?: unknown;
facts?: unknown;
estimates?: unknown;
uncertainties?: unknown;
sources?: unknown;
suggestedActions?: unknown;
actions?: unknown;
error?: unknown;
}

const SEARCH_TIMEOUT_MS = 30000;

const EMPTY_SUMMARY_MESSAGE =
'The search service responded, but it did not return a summary. Please try again. If this keeps happening, the search backend needs to be checked.';

function isRecord(
value: unknown
): value is Record<string, unknown> {
return (
typeof value === 'object' &&
value !== null &&
!Array.isArray(value)
);
}

function cleanText(
value: unknown
): string {
if (typeof value === 'string') {
return value.trim();
}

if (
typeof value === 'number' ||
typeof value === 'boolean'
) {
return String(value);
}

return '';
}

function normalizeStringArray(
value: unknown
): string[] {
if (!Array.isArray(value)) {
return [];
}

return value
.map((item) => {
if (typeof item === 'string') {
return item.trim();
}

  if (isRecord(item)) {
    return cleanText(
      item.text ??
      item.fact ??
      item.description ??
      item.content ??
      item.title ??
      item.name
    );
  }

  return '';
})
.filter(Boolean);

}

function normalizeSources(
value: unknown
): SearchSource[] {
if (!Array.isArray(value)) {
return [];
}

return value
.map((item): SearchSource | null => {
if (typeof item === 'string') {
const url = item.trim();

    if (!url) {
      return null;
    }

    return {
      title: url,
      url,
    };
  }

  if (!isRecord(item)) {
    return null;
  }

  const title = cleanText(
    item.title ??
    item.name ??
    item.label
  );

  const url = cleanText(
    item.url ??
    item.link ??
    item.href ??
    item.uri
  );

  const snippet = cleanText(
    item.snippet ??
    item.description ??
    item.summary ??
    item.text
  );

  if (!title && !url && !snippet) {
    return null;
  }

  return {
    title,
    url,
    snippet,
  };
})
.filter(
  (source): source is SearchSource =>
    source !== null
);

}

function getSafeHttpUrl(
value?: string
): string | null {
if (!value) {
return null;
}

try {
const parsed = new URL(value);

if (
  parsed.protocol !== 'https:' &&
  parsed.protocol !== 'http:'
) {
  return null;
}

return parsed.href;

} catch {
return null;
}
}

function getNestedResponse(
input: unknown
): NormalizedSearchResponse {
if (!isRecord(input)) {
return {};
}

let current: Record<string, unknown> = input;

/*

* Some backends wrap their payload inside result or data.
* Unwrap a limited number of levels while preserving the
* outer response as a fallback.
  */
  for (let depth = 0; depth < 3; depth += 1) {
  const nestedResult = current.result;
  const nestedData = current.data;

if (
  isRecord(nestedResult) &&
  (
    nestedResult.summary !== undefined ||
    nestedResult.answer !== undefined ||
    nestedResult.response !== undefined ||
    nestedResult.sources !== undefined ||
    nestedResult.content !== undefined
  )
) {
  current = {
    ...current,
    ...nestedResult,
  };

  continue;
}

if (
  isRecord(nestedData) &&
  (
    nestedData.summary !== undefined ||
    nestedData.answer !== undefined ||
    nestedData.response !== undefined ||
    nestedData.sources !== undefined ||
    nestedData.content !== undefined
  )
) {
  current = {
    ...current,
    ...nestedData,
  };

  continue;
}

break;

}

return current as NormalizedSearchResponse;
}

function extractSummary(
response: NormalizedSearchResponse
): string {
const candidates = [
response.summary,
response.answer,
response.response,
response.text,
response.content,
response.message,
];

for (const candidate of candidates) {
if (typeof candidate === 'string') {
const value = candidate.trim();

  if (value) {
    return value;
  }
}

/*
 * Handle common structured response formats such as:
 * { answer: { text: "..." } }
 * { content: { parts: [{ text: "..." }] } }
 */
if (isRecord(candidate)) {
  const nestedText = cleanText(
    candidate.text ??
    candidate.answer ??
    candidate.summary ??
    candidate.content
  );

  if (nestedText) {
    return nestedText;
  }

  if (Array.isArray(candidate.parts)) {
    const partsText = candidate.parts
      .map((part) => {
        if (isRecord(part)) {
          return cleanText(part.text);
        }

        return '';
      })
      .filter(Boolean)
      .join('\n\n');

    if (partsText) {
      return partsText;
    }
  }
}

/*
 * Handle a content array containing text blocks.
 */
if (Array.isArray(candidate)) {
  const arrayText = candidate
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }

      if (isRecord(item)) {
        return cleanText(
          item.text ??
          item.content ??
          item.value
        );
      }

      return '';
    })
    .filter(Boolean)
    .join('\n\n');

  if (arrayText) {
    return arrayText;
  }
}

}

/*

* Some search APIs return an array of search results
* without a pre-generated summary. Display the returned
* information rather than silently discarding it.
  */
  const rawResults =
  response.sources ??
  (isRecord(response.result)
  ? response.result.sources
  : undefined);

if (Array.isArray(rawResults)) {
const resultText = rawResults
.map((item) => {
if (!isRecord(item)) {
return '';
}

    const title = cleanText(
      item.title ??
      item.name
    );

    const snippet = cleanText(
      item.snippet ??
      item.description ??
      item.content ??
      item.text
    );

    if (title && snippet) {
      return `${title}\n${snippet}`;
    }

    return title || snippet;
  })
  .filter(Boolean);

if (resultText.length > 0) {
  return (
    'Here is the information returned by the search service:\n\n' +
    resultText.join('\n\n')
  );
}

}

return '';
}

function normalizeSearchResponse(
input: unknown,
originalQuery: string
): SearchResult {
const response = getNestedResponse(input);

const summary =
extractSummary(response) ||
EMPTY_SUMMARY_MESSAGE;

const verifiedFacts = normalizeStringArray(
response.verifiedFacts ??
response.facts
);

const estimates = normalizeStringArray(
response.estimates
);

const uncertainties = normalizeStringArray(
response.uncertainties
);

const sources = normalizeSources(
response.sources
);

const suggestedActions = normalizeStringArray(
response.suggestedActions ??
response.actions
);

return {
query:
cleanText(response.query) ||
originalQuery,

summary,

verifiedFacts,

estimates,

uncertainties,

sources,

suggestedActions,

};
}

function getErrorMessage(
error: unknown
): string {
if (error instanceof Error) {
if (error.name === 'AbortError') {
return (
'The search took too long to respond. ' +
'Please try again.'
);
}

return error.message;

}

return 'Search is temporarily unavailable. Please try again.';
}

export function SearchView({
onTriggerAction,
preferredLanguage = 'en',
}: SearchViewProps) {
const [query, setQuery] = useState('');

const [result, setResult] =
useState<SearchResult | null>(null);

const [loading, setLoading] =
useState(false);

const [error, setError] =
useState('');

const requestControllerRef =
useRef<AbortController | null>(null);

const mountedRef = useRef(true);

useEffect(() => {
mountedRef.current = true;

return () => {
  mountedRef.current = false;

  requestControllerRef.current?.abort();

  requestControllerRef.current = null;
};

}, []);

const submitSearch = async (
event: FormEvent<HTMLFormElement>
) => {
event.preventDefault();

const value = query.trim();

if (!value || loading) {
  return;
}

/*
 * Cancel any previous request before starting another.
 */
requestControllerRef.current?.abort();

const controller = new AbortController();

requestControllerRef.current = controller;

const timeoutId = window.setTimeout(() => {
  controller.abort();
}, SEARCH_TIMEOUT_MS);

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
        Accept: 'application/json',
      },

      body: JSON.stringify({
        query: value,
        language: preferredLanguage,
      }),

      signal: controller.signal,
    }
  );

  let data: unknown = {};

  const responseText = await response.text();

  if (responseText.trim()) {
    try {
      data = JSON.parse(responseText);
    } catch {
      /*
       * Preserve plain-text backend responses as a
       * possible answer instead of discarding them.
       */
      data = {
        answer: responseText.trim(),
      };
    }
  }

  if (!response.ok) {
    const parsedError = isRecord(data)
      ? cleanText(data.error ?? data.message)
      : '';

    throw new Error(
      parsedError ||
      `Search failed (${response.status}).`
    );
  }

  const normalized =
    normalizeSearchResponse(
      data,
      value
    );

  if (!mountedRef.current) {
    return;
  }

  setResult(normalized);

  /*
   * A successful HTTP response without summary is
   * not automatically a network error. Keep the
   * response visible so the user can inspect any
   * returned facts, sources or other information.
   */
} catch (err: unknown) {
  if (!mountedRef.current) {
    return;
  }

  /*
   * Do not show an error if the request was cancelled
   * because the component was unmounted.
   */
  if (
    err instanceof Error &&
    err.name === 'AbortError' &&
    !controller.signal.aborted
  ) {
    return;
  }

  console.error(
    'Nodysom AI search failed:',
    err
  );

  const message = getErrorMessage(err);

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
  window.clearTimeout(timeoutId);

  if (
    requestControllerRef.current === controller
  ) {
    requestControllerRef.current = null;
  }

  if (mountedRef.current) {
    setLoading(false);
  }
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

requestControllerRef.current?.abort();

requestControllerRef.current = null;

setQuery('');

setResult(null);

setError('');

};

const retrySearch = () => {
if (loading || !query.trim()) {
return;
}

const form = document.getElementById(
  'nodysom-search-form'
) as HTMLFormElement | null;

if (form) {
  form.requestSubmit();
}

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
        id="nodysom-search-form"
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
              aria-label="Search query"
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
    <section
      role="alert"
      className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4"
    >
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

          <button
            type="button"
            onClick={retrySearch}
            disabled={loading || !query.trim()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-400/20 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={13} />
            Try again
          </button>
        </div>
      </div>
    </section>
  )}

  {/* LOADING */}
  {loading && (
    <section
      role="status"
      aria-live="polite"
      className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6"
    >
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

        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
          {result.summary}
        </p>

        {result.summary === EMPTY_SUMMARY_MESSAGE && (
          <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3">
            <p className="text-xs leading-5 text-amber-200/80">
              The interface received a response, but no
              usable summary was found. If search results
              are also missing, check the backend endpoint
              at /api/ai/search and its response format.
            </p>
          </div>
        )}
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
            <div className="flex items-center gap-2">
              <ExternalLink
                size={16}
                className="text-indigo-400"
              />

              <h2 className="text-sm font-extrabold text-white">
                Sources
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              {result.sources.map(
                (source, index) => {
                  const safeUrl = getSafeHttpUrl(
                    source.url
                  );

                  return (
                    <div
                      key={`${source.url || source.title || 'source'}-${index}`}
                      className="rounded-xl border border-white/[0.06] bg-slate-950/50 p-3"
                    >
                      {safeUrl ? (
                        <a
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className="inline-flex items-start gap-2 text-sm font-semibold text-indigo-300 hover:text-indigo-200 hover:underline"
                        >
                          <span className="break-words">
                            {source.title ||
                              safeUrl}
                          </span>

                          <ExternalLink
                            size={13}
                            className="mt-0.5 shrink-0"
                          />
                        </a>
                      ) : (
                        <p className="break-words text-sm font-semibold text-slate-200">
                          {source.title ||
                            'Source'}
                        </p>
                      )}

                      {source.snippet && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">
                          {source.snippet}
                        </p>
                      )}
                    </div>
                  );
                }
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
                      handleSuggestedAction(action)
                    }
                    className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-left transition hover:border-indigo-400/20 hover:bg-indigo-500/[0.05]"
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
