import React, { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  CornerDownLeft,
} from 'lucide-react';
import { speechService } from '../lib/speech';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitVoicePrompt: (prompt: string) => void;
  preferredLanguage?: string;
}

export const VoiceAssistantModal: React.FC<
  VoiceAssistantModalProps
> = ({
  isOpen,
  onClose,
  onSubmitVoicePrompt,
  preferredLanguage = 'en-US',
}) => {
  const [isListening, setIsListening] =
    useState(false);

  const [transcript, setTranscript] =
    useState('');

  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] =
    useState(true);

  const [statusMessage, setStatusMessage] =
    useState('Tap microphone to speak');

  const handleSubmit = React.useCallback(
    (textToSubmit?: string) => {
      const finalQuery =
        (textToSubmit || transcript).trim();

      if (!finalQuery) {
        return;
      }

      speechService.stopListening();

      setIsListening(false);

      onSubmitVoicePrompt(finalQuery);

      onClose();
    },
    [
      transcript,
      onSubmitVoicePrompt,
      onClose,
    ]
  );

  const handleStartListening =
    React.useCallback(() => {
      setTranscript('');
      setIsListening(true);
      setStatusMessage(
        'Listening... speak naturally'
      );

      speechService.startListening(
        {
          onResult: (
            text,
            isFinal
          ) => {
            setTranscript(text);

            if (
              isFinal &&
              text.trim().length > 2
            ) {
              setStatusMessage(
                'Processing speech...'
              );

              window.setTimeout(() => {
                handleSubmit(text);
              }, 600);
            }
          },

          onError: (err) => {
            console.error(
              'Speech recognition error:',
              err
            );

            setStatusMessage(
              `Speech error: ${err}`
            );

            setIsListening(false);
          },

          onEnd: () => {
            setIsListening(false);
          },
        },
        preferredLanguage
      );
    }, [
      preferredLanguage,
      handleSubmit,
    ]);

  const handleStopListening = () => {
    speechService.stopListening();

    setIsListening(false);

    setStatusMessage(
      'Paused. Tap mic to resume or submit.'
    );
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    handleStartListening();

    return () => {
      speechService.stopListening();
      speechService.stopSpeaking();
    };
  }, [
    isOpen,
    handleStartListening,
  ]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative flex flex-col items-center text-center">

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition-colors"
          aria-label="Close voice assistant"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Nodysom Voice Assistant</span>
        </div>

        {/* Microphone */}
        <div className="relative my-4 flex items-center justify-center">
          {isListening && (
            <>
              <div className="absolute w-32 h-32 rounded-full bg-indigo-500/15 animate-ping" />

              <div className="absolute w-24 h-24 rounded-full bg-cyan-500/20 animate-pulse" />
            </>
          )}

          <button
            type="button"
            onClick={
              isListening
                ? handleStopListening
                : handleStartListening
            }
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
              isListening
                ? 'bg-gradient-to-tr from-rose-500 to-indigo-600 text-white scale-110 shadow-rose-500/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95'
            }`}
            aria-label={
              isListening
                ? 'Stop listening'
                : 'Start listening'
            }
          >
            {isListening ? (
              <Mic className="w-8 h-8 animate-pulse" />
            ) : (
              <MicOff className="w-8 h-8" />
            )}
          </button>
        </div>

        {/* Status */}
        <p className="text-xs font-medium text-slate-400 mt-2 mb-4">
          {statusMessage}
        </p>

        {/* Transcript */}
        <div className="w-full min-h-[90px] max-h-[140px] overflow-y-auto bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 text-left mb-4 flex flex-col justify-between">
          <p className="text-xs text-slate-200 font-sans leading-relaxed">
            {transcript || (
              <span className="text-slate-500 italic">
                Speak anything, for example:
                "Plan my day" or "Create a study plan".
              </span>
            )}
          </p>

          {transcript && (
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() =>
                  handleSubmit()
                }
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
              >
                Send Request
                <CornerDownLeft className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Voice feedback */}
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
            type="button"
            onClick={() =>
              setVoiceFeedbackEnabled(
                (value) => !value
              )
            }
            className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
              voiceFeedbackEnabled
                ? 'bg-indigo-600'
                : 'bg-slate-800'
            }`}
            aria-label="Toggle spoken response"
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                voiceFeedbackEnabled
                  ? 'translate-x-4'
                  : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Quick prompts */}
        <div className="w-full mt-4 pt-3 border-t border-slate-800/80">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-2">
            Try saying:
          </span>

          <div className="flex flex-wrap gap-1.5 justify-center">
            {[
              'Plan my day',
              'Translate to Swahili',
              'Create study plan',
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() =>
                  handleSubmit(sample)
                }
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50 hover:border-slate-600 transition-all"
              >
                "{sample}"
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
