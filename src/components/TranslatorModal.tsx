import React, { useState } from 'react';
import { Globe, ArrowRightLeft, Volume2, Copy, Check, Sparkles, X } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../data/mockAndDefaults';
import { speechService } from '../lib/speech';

interface TranslatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TranslatorModal: React.FC<TranslatorModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [inputText, setInputText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('sw');
  const [translatedText, setTranslatedText] = useState('');
  const [phoneticGuide, setPhoneticGuide] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    const targetObj = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang);
    const targetName = targetObj ? targetObj.name : 'Swahili';

    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          targetLanguage: targetName,
          sourceLanguage: sourceLang,
        }),
      });
      const data = await res.json();
      setTranslatedText(data.translatedText || '');
      setPhoneticGuide(data.phoneticGuide || '');
      setNotes(data.notes || '');
    } catch (e) {
      console.error('Translation failed', e);
      setTranslatedText(`Translation unavailable offline.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSpeak = (text: string, langCode: string) => {
    speechService.speak(text, langCode === 'sw' ? 'sw' : 'en-US');
  };

  const swapLanguages = () => {
    if (sourceLang === 'auto') {
      setSourceLang(targetLang);
      setTargetLang('en');
    } else {
      const temp = sourceLang;
      setSourceLang(targetLang);
      setTargetLang(temp);
    }
    if (translatedText) {
      setInputText(translatedText);
      setTranslatedText(inputText);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl relative text-slate-100 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Universal Translator
              </h3>
              <p className="text-[11px] text-slate-400">
                8+ Global & African Languages
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language Selectors */}
        <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 my-3">
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="auto">Detect Language</option>
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>

          <button
            onClick={swapLanguages}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Swap languages"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>

          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Input Box */}
        <div className="relative mb-3">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or paste text to translate..."
            rows={3}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none font-sans"
          />
          {inputText && (
            <button
              onClick={() => handleSpeak(inputText, sourceLang)}
              className="absolute bottom-2.5 right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-200 bg-slate-900/80"
              title="Pronounce input text"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={handleTranslate}
          disabled={isLoading || !inputText.trim()}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-1.5 mb-3"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Translate Now
            </>
          )}
        </button>

        {/* Output Box */}
        {translatedText && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs relative space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-850">
              <span className="font-semibold text-slate-300">
                Translation
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSpeak(translatedText, targetLang)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-850"
                  title="Speak translation"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-850 flex items-center gap-1"
                  title="Copy text"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-sm font-medium text-slate-100 leading-relaxed">
              {translatedText}
            </p>

            {phoneticGuide && (
              <p className="text-[11px] text-cyan-300 font-mono bg-cyan-950/30 p-1.5 rounded-lg">
                🗣️ Pronunciation: {phoneticGuide}
              </p>
            )}

            {notes && (
              <p className="text-[10px] text-slate-400 italic">
                ℹ️ {notes}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
