import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, Sparkles, CornerDownLeft } from 'lucide-react';
import { speechService } from '../lib/speech';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitVoicePrompt: (prompt: string) => void;
  preferredLanguage?: string;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onSubmitVoicePrompt,
  preferredLanguage = 'en-US',
}) => {
  if (!isOpen) return null;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Tap microphone to speak');

  useEffect(() => {
    // Start listening automatically when modal opens
    handleStartListening();

    return () => {
      speechService.stopListening();
      speechService.stopSpeaking();
    };
  }, []);

  const handleStartListening = () => {
    setTranscript('');
    setIsListening(true);
    setStatusMessage('Listening... speak naturally');

    speechService.startListening(
      {
        onResult: (text, isFinal) => {
          setTranscript(text);
          if (isFinal && text.trim().length > 2) {
            setStatusMessage('Processing speech...');
            setTimeout(() => {
              handleSubmit(text);
            }, 600);
          }
        },
        onError: (err) => {
          setStatusMessage(`Speech error: ${err}`);
          setIsListening(false);
        },
        onEnd: () => {
          setIsListening(false);
        },
      },
      preferredLanguage
    );
  };

  const handleStopListening = () => {
    speechService.stopListening();
    setIsListening(false);
    setStatusMessage('Paused. Tap mic to resume or submit.');
  };

  const handleSubmit = (textToSubmit?: string) => {
    const finalQuery = (textToSubmit || transcript).trim();
    if (!finalQuery) return;
    speechService.stopListening();
    setIsListening(false);
    onSubmitVoicePrompt(finalQuery);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Tagline */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>LifeOS Voice Engine</span>
        </div>

        {/* Pulse Visualizer Container */}
        <div className="relative my-4 flex items-center justify-center">
          {isListening && (
            <>
              <div className="absolute w-32 h-32 rounded-full bg-indigo-500/15 animate-ping" />
              <div className="absolute w-24 h-24 rounded-full bg-cyan-500/20 animate-pulse" />
            </>
          )}

          <button
            onClick={isListening ? handleStopListening : handleStartListening}
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
              isListening
                ? 'bg-gradient-to-tr from-rose-500 to-indigo-600 text-white scale-110 shadow-rose-500/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95'
            }`}
          >
            {isListening ? (
              <Mic className="w-8 h-8 animate-pulse" />
            ) : (
              <MicOff className="w-8 h-8" />
            )}
          </button>
        </div>

        {/* Status Message */}
        <p className="text-xs font-medium text-slate-400 mt-2 mb-4">
          {statusMessage}
        </p>

        {/* Live Transcript Box */}
        <div className="w-full min-h-[90px] max-h-[140px] overflow-y-auto bg-slate-950/80 border border-slate-850 rounded-2xl p-3.5 text-left mb-4 flex flex-col justify-between">
          <p className="text-xs text-slate-200 font-sans leading-relaxed">
            {transcript || (
              <span className="text-slate-400 italic">
                Speak anything, e.g. "Plan my day", "Remind me to call Mom tomorrow at 8am", or "Translate to Swahili"...
              </span>
            )}
          </p>

          {transcript && (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => handleSubmit()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
              >
                Send Request <CornerDownLeft className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Voice Feedback Audio Toggle */}
        <div className="w-full flex items-center justify-between text-xs text-slate-400 px-2 py-1">
          <span className="flex items-center gap-1.5">
            {voiceFeedbackEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            Spoken Voice Response
          </span>
          <button
            onClick={() => setVoiceFeedbackEnabled(!voiceFeedbackEnabled)}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
              voiceFeedbackEnabled ? 'bg-indigo-600' : 'bg-slate-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                voiceFeedbackEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Quick Voice Prompt Shortcuts */}
        <div className="w-full mt-4 pt-3 border-t border-slate-800/80">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-2">
            Try saying:
          </span>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {['Plan my day', 'Translate to Swahili', 'Create study plan'].map(
              (sample) => (
                <button
                  key={sample}
                  onClick={() => handleSubmit(sample)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50 hover:border-slate-600 transition-all"
                >
                  "{sample}"
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
