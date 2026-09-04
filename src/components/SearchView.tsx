import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { SearchResult } from '../types';

interface SearchViewProps {
  onTriggerAction: (actionText: string) => void;
  preferredLanguage?: string;
}

export const SearchView: React.FC<SearchViewProps> = ({
  onTriggerAction,
  preferredLanguage = 'en',
}) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([
    'How do scholarships in Africa work?',
    'What is the difference between inflation and interest rate?',
    'How to build an offline-first app for low-end phones?',
  ]);

  const handleSearch = async (targetQuery?: string) => {
    const q = (targetQuery || query).trim();
    if (!q || isLoading) return;

    setIsLoading(true);
    setQuery(q);

    if (!searchHistory.includes(q)) {
      setSearchHistory([q, ...searchHistory.slice(0, 5)]);
    }

    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, language: preferredLanguage }),
      });
      const data = await res.json();
      setResult({
        query: q,
        summary: data.summary || 'No summary available.',
        verifiedFacts: data.verifiedFacts || [],
        estimates: data.estimates || [],
        uncertainties: data.uncertainties || [],
        sources: data.sources || [{ title: 'LifeOS Verified Knowledge', url: '#' }],
        suggestedActions: data.suggestedActions || ['Save to planner', 'Explore in learning hub'],
      });
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto px-4 pt-3">
      {/* Header */}
      <section className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Search className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            Universal Search Engine
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
          Ask questions, not keywords
        </h1>
        <p className="text-xs text-slate-400">
          Concise factual answers clearly separating verified facts, estimates, and uncertainty.
        </p>
      </section>

      {/* Search Input Bar */}
      <section>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="relative flex items-center bg-slate-900 border border-slate-750 focus-within:border-indigo-500 rounded-2xl shadow-xl p-1.5"
        >
          <Search className="w-5 h-5 text-slate-500 ml-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything (e.g., 'What scholarships exist for East Africa?')"
            className="w-full bg-transparent px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md transition-all shrink-0"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Search'
            )}
          </button>
        </form>
      </section>

      {/* Quick Search Chips */}
      {!result && !isLoading && (
        <section className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Popular Inquiries
          </span>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((h) => (
              <button
                key={h}
                onClick={() => handleSearch(h)}
                className="text-xs px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-indigo-500/40 transition-colors text-left flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>{h}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Search Results Display */}
      {result && (
        <section className="space-y-4 animate-in fade-in duration-200">
          {/* Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block">
              Concise Answer
            </span>
            <p className="text-sm font-medium text-slate-100 leading-relaxed font-sans">
              {result.summary}
            </p>
          </div>

          {/* Fact vs Estimate vs Uncertainty Triad */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Verified Facts */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Verified Facts
                </span>
              </div>
              <ul className="space-y-1.5">
                {result.verifiedFacts.map((fact, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5 leading-snug">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Estimates & Calculations */}
            <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-400">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Estimates & Models
                </span>
              </div>
              <ul className="space-y-1.5">
                {result.estimates.map((est, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5 leading-snug">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{est}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Uncertainties & Caveats */}
            <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
              <div className="flex items-center gap-1.5 text-purple-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Uncertainty / Caveats
                </span>
              </div>
              <ul className="space-y-1.5">
                {result.uncertainties.map((unc, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5 leading-snug">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>{unc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sources & Citations */}
          {result.sources.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                References & Data Sources
              </span>
              <div className="flex flex-wrap gap-2">
                {result.sources.map((src, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-indigo-300"
                  >
                    <span>{src.title}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actionable Next Steps */}
          {result.suggestedActions.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-2">
              <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider block">
                Actionable Next Steps
              </span>
              <div className="flex flex-wrap gap-2">
                {result.suggestedActions.map((act, i) => (
                  <button
                    key={i}
                    onClick={() => onTriggerAction(act)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 transition-all flex items-center gap-1 active:scale-95"
                  >
                    <span>{act}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
