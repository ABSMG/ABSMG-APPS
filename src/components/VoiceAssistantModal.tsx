import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  CornerDownLeft,
  Loader2,
  RotateCcw,
  Play,
  Square,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';

import { speechService } from '../lib/speech';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;

  onSubmitVoicePrompt: (
    prompt: string
  ) => Promise<string | null> | string | null;

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
  // ---------------------------------------------------------
  // STATE
  // ---------------------------------------------------------

  const [isListening, setIsListening] =
    useState(false);

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [isSpeaking, setIsSpeaking] =
    useState(false);

  const [transcript, setTranscript] =
    useState('');

  const [assistantResponse, setAssistantResponse] =
    useState('');

  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] =
    useState(true);

  const [statusMessage, setStatusMessage] =
    useState('Tap the microphone and speak.');

  const [errorMessage, setErrorMessage] =
    useState('');

  // ---------------------------------------------------------
  // REFS
  // ---------------------------------------------------------

  // Keep the latest callback available to speech recognition
  // without restarting recognition after every React render.
  const submitHandlerRef = useRef<
    (textToSubmit?: string) => Promise<void>
  >(async () => {});

  const isSubmittingRef = useRef(false);

  const isMountedOpenRef = useRef(false);

  const finalTranscriptTimeoutRef =
    useRef<number | null>(null);

  const lastSubmittedTranscriptRef =
    useRef('');

  // ---------------------------------------------------------
  // STOP PENDING SPEECH TIMER
  // ---------------------------------------------------------

  const clearFinalTranscriptTimeout =
    useCallback(() => {
      if (
        finalTranscriptTimeoutRef.current !== null
      ) {
        window.clearTimeout(
          finalTranscriptTimeoutRef.current
        );

        finalTranscriptTimeoutRef.current = null;
      }
    }, []);

  // ---------------------------------------------------------
  // STOP SPEECH OUTPUT
  // ---------------------------------------------------------

  const stopSpeaking = useCallback(() => {
    speechService.stopSpeaking();

    setIsSpeaking(false);
  }, []);

  // ---------------------------------------------------------
  // SPEAK ASSISTANT RESPONSE
  // ---------------------------------------------------------

  const speakResponse = useCallback(
    (textToSpeak?: string) => {
      const text = (
        textToSpeak || assistantResponse
      ).trim();

      if (!text) {
        setStatusMessage(
          'There is no answer to read aloud yet.'
        );

        return;
      }

      if (!speechService.isTTSSupported()) {
        setErrorMessage(
          'Spoken responses are not supported by this browser or device.'
        );

        setStatusMessage(
          'Text-to-speech is unavailable.'
        );

        return;
      }

      setErrorMessage('');

      setIsSpeaking(true);

      setStatusMessage(
        'Nodysom is speaking...'
      );

      speechService.speak(
        text,
        preferredLanguage,
        () => {
          setIsSpeaking(false);

          if (isMountedOpenRef.current) {
            setStatusMessage(
              'Answer complete. You can ask another question.'
            );
          }
        }
      );
    },
    [
      assistantResponse,
      preferredLanguage,
    ]
  );

  // ---------------------------------------------------------
  // SUBMIT VOICE OR TEXT PROMPT
  // ---------------------------------------------------------

  const handleSubmit = useCallback(
    async (
      textToSubmit?: string
    ): Promise<void> => {
      const finalQuery = (
        textToSubmit !== undefined
          ? textToSubmit
          : transcript
      ).trim();

      if (!finalQuery) {
        setStatusMessage(
          'Please speak or enter a request first.'
        );

        return;
      }

      if (isSubmittingRef.current) {
        return;
      }

      if (!isMountedOpenRef.current) {
        return;
      }

      isSubmittingRef.current = true;

      clearFinalTranscriptTimeout();

      lastSubmittedTranscriptRef.current =
        finalQuery;

      speechService.stopListening();

      setIsListening(false);

      setIsProcessing(true);

      setErrorMessage('');

      setAssistantResponse('');

      setTranscript(finalQuery);

      setStatusMessage(
        'Nodysom is preparing your answer...'
      );

      try {
        const result =
          await onSubmitVoicePrompt(
            finalQuery
          );

        // The modal may have been closed while the
        // assistant request was still in progress.
        if (!isMountedOpenRef.current) {
          return;
        }

        const answer =
          typeof result === 'string'
            ? result.trim()
            : '';

        if (!answer) {
          setAssistantResponse('');

          setStatusMessage(
            'The request was sent, but no answer was returned to Voice Assistant.'
          );

          setErrorMessage(
            'No response text was returned. Check the AI request and its response handling in App.tsx.'
          );

          return;
        }

        setAssistantResponse(answer);

        setStatusMessage(
          'Nodysom has answered your question.'
        );

        // Read the answer aloud only when the user
        // has enabled spoken responses.
        if (voiceFeedbackEnabled) {
          speakResponse(answer);
        }
      } catch (error: unknown) {
        console.error(
          '[Nodysom Voice Assistant] Request failed:',
          error
        );

        if (!isMountedOpenRef.current) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.';

        setErrorMessage(message);

        setStatusMessage(
          'Nodysom could not complete your request.'
        );
      } finally {
        isSubmittingRef.current = false;

        if (isMountedOpenRef.current) {
          setIsProcessing(false);
        }
      }
    },
    [
      transcript,
      onSubmitVoicePrompt,
      clearFinalTranscriptTimeout,
      voiceFeedbackEnabled,
      speakResponse,
    ]
  );

  // Keep speech recognition connected to the latest
  // submit handler without restarting the microphone.
  useEffect(() => {
    submitHandlerRef.current = handleSubmit;
  }, [handleSubmit]);

  // ---------------------------------------------------------
  // START LISTENING
  // ---------------------------------------------------------

  const handleStartListening =
    useCallback(() => {
      if (!isOpen) {
        return;
      }

      if (isProcessing || isSubmittingRef.current) {
        setStatusMessage(
          'Please wait for the current answer to finish.'
        );

        return;
      }

      if (isListening) {
        return;
      }

      clearFinalTranscriptTimeout();

      speechService.stopSpeaking();

      setIsSpeaking(false);

      setErrorMessage('');

      setTranscript('');

      setAssistantResponse('');

      lastSubmittedTranscriptRef.current = '';

      setIsListening(true);

      setStatusMessage(
        'Listening... speak naturally.'
      );

      speechService.startListening(
        {
          onResult: (
            text,
            isFinal
          ) => {
            if (!isMountedOpenRef.current) {
              return;
            }

            const cleanedText =
              text.trim();

            setTranscript(cleanedText);

            if (
              isFinal &&
              cleanedText.length > 0
            ) {
              // Prevent duplicate submissions if the
              // browser reports the same final result again.
              if (
                lastSubmittedTranscriptRef.current ===
                cleanedText
              ) {
                return;
              }

              clearFinalTranscriptTimeout();

              setStatusMessage(
                'Speech captured. Preparing your request...'
              );

              finalTranscriptTimeoutRef.current =
                window.setTimeout(() => {
                  finalTranscriptTimeoutRef.current =
                    null;

                  void submitHandlerRef.current(
                    cleanedText
                  );
                }, 350);
            }
          },

          onError: (error) => {
            console.error(
              '[Nodysom Voice Assistant] Speech recognition error:',
              error
            );

            if (!isMountedOpenRef.current) {
              return;
            }

            setIsListening(false);

            setErrorMessage(
              error
            );

            setStatusMessage(
              'Microphone recognition failed. Check microphone permission and try again.'
            );
          },

          onEnd: () => {
            if (!isMountedOpenRef.current) {
              return;
            }

            setIsListening(false);

            // Do not overwrite the status while an
            // answer is being generated or spoken.
            if (
              !isProcessing &&
              !isSubmittingRef.current &&
              !speechService.isCurrentlySpeaking()
            ) {
              setStatusMessage(
                'Listening stopped. Tap the microphone to speak again.'
              );
            }
          },
        },
        preferredLanguage
      );

      // If the browser has no SpeechRecognition support,
      // the service reports an error through its handlers.
    }, [
      isOpen,
      isProcessing,
      isListening,
      preferredLanguage,
      clearFinalTranscriptTimeout,
    ]);

  // ---------------------------------------------------------
  // STOP LISTENING
  // ---------------------------------------------------------

  const handleStopListening =
    useCallback(() => {
      clearFinalTranscriptTimeout();

      speechService.stopListening();

      setIsListening(false);

      if (transcript.trim()) {
        setStatusMessage(
          'Speech captured. Tap Send Request to continue.'
        );
      } else {
        setStatusMessage(
          'Microphone paused. Tap the microphone to resume.'
        );
      }
    }, [
      transcript,
      clearFinalTranscriptTimeout,
    ]);

  // ---------------------------------------------------------
  // START A NEW REQUEST
  // ---------------------------------------------------------

  const handleNewRequest = useCallback(() => {
    if (isProcessing || isSubmittingRef.current) {
      return;
    }

    clearFinalTranscriptTimeout();

    speechService.stopListening();

    speechService.stopSpeaking();

    setIsListening(false);

    setIsSpeaking(false);

    setTranscript('');

    setAssistantResponse('');

    setErrorMessage('');

    setStatusMessage(
      'Ready for your next question. Tap the microphone or choose a prompt.'
    );

    lastSubmittedTranscriptRef.current = '';
  }, [
    isProcessing,
    clearFinalTranscriptTimeout,
  ]);

  // ---------------------------------------------------------
  // TOGGLE SPOKEN RESPONSE
  // ---------------------------------------------------------

  const handleToggleVoiceFeedback =
    useCallback(() => {
      setVoiceFeedbackEnabled((enabled) => {
        const nextEnabled = !enabled;

        if (!nextEnabled) {
          speechService.stopSpeaking();

          setIsSpeaking(false);

          setStatusMessage(
            'Spoken responses are turned off.'
          );
        }

        return nextEnabled;
      });
    }, []);

  // ---------------------------------------------------------
  // CLOSE HANDLER
  // ---------------------------------------------------------

  const handleClose = useCallback(() => {
    clearFinalTranscriptTimeout();

    isMountedOpenRef.current = false;

    speechService.stopListening();

    speechService.stopSpeaking();

    setIsListening(false);

    setIsSpeaking(false);

    onClose();
  }, [
    clearFinalTranscriptTimeout,
    onClose,
  ]);

  // ---------------------------------------------------------
  // OPEN / CLOSE LIFECYCLE
  // ---------------------------------------------------------

  useEffect(() => {
    if (!isOpen) {
      isMountedOpenRef.current = false;

      return;
    }

    isMountedOpenRef.current = true;

    isSubmittingRef.current = false;

    lastSubmittedTranscriptRef.current = '';

    setIsListening(false);

    setIsProcessing(false);

    setIsSpeaking(false);

    setTranscript('');

    setAssistantResponse('');

    setErrorMessage('');

    setStatusMessage(
      'Tap the microphone and speak.'
    );

    return () => {
      isMountedOpenRef.current = false;

      clearFinalTranscriptTimeout();

      speechService.stopListening();

      speechService.stopSpeaking();

      isSubmittingRef.current = false;
    };
  }, [
    isOpen,
    clearFinalTranscriptTimeout,
  ]);

  // ---------------------------------------------------------
  // QUICK PROMPTS
  // ---------------------------------------------------------

  const handleQuickPrompt = useCallback(
    (sample: string) => {
      void handleSubmit(sample);
    },
    [
      handleSubmit,
    ]
  );

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">

      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative flex flex-col items-center text-center">

        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition-colors"
          aria-label="Close voice assistant"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold mb-5 mt-1">
          <Sparkles className="w-3.5 h-3.5" />

          <span>
            Nodysom Voice Assistant
          </span>
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
            disabled={
              isProcessing ||
              isSubmittingRef.current
            }
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
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
        <div
          className="flex items-center justify-center gap-2 text-xs font-medium text-slate-400 mt-2 mb-4"
          aria-live="polite"
          role="status"
        >
          {isProcessing && (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
          )}

          {isSpeaking && (
            <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}

          {statusMessage}
        </div>

        {/* Transcript */}
        <div className="w-full min-h-[90px] max-h-[140px] overflow-y-auto bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 text-left mb-4 flex flex-col justify-between">

          <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <Mic className="w-3.5 h-3.5" />

            <span>
              What you said
            </span>
          </div>

          <p className="text-xs text-slate-200 font-sans leading-relaxed whitespace-pre-wrap break-words">
            {transcript || (
              <span className="text-slate-500 italic">
                Speak naturally. For example:
                {' '}
                "Plan my day" or "Create a study plan".
              </span>
            )}
          </p>

          {transcript && (
            <div className="flex justify-end mt-3">

              <button
                type="button"
                disabled={
                  isProcessing ||
                  isSubmittingRef.current
                }
                onClick={() => {
                  void handleSubmit();
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />

                    Sending...
                  </>
                ) : (
                  <>
                    Send Request

                    <CornerDownLeft className="w-3 h-3" />
                  </>
                )}
              </button>

            </div>
          )}
        </div>

        {/* Error */}
        {errorMessage && (
          <div
            role="alert"
            className="w-full mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-left"
          >
            <div className="flex items-start gap-2 text-rose-300">

              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />

              <p className="text-xs leading-relaxed break-words">
                {errorMessage}
              </p>

            </div>
          </div>
        )}

        {/* Assistant Response */}
        {(assistantResponse || isProcessing) && (
          <div className="w-full mb-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-left">

            <div className="flex items-center gap-2 mb-3 text-indigo-300">

              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <MessageCircle className="w-4 h-4 shrink-0" />
              )}

              <span className="text-xs font-semibold">
                Nodysom's Answer
              </span>

            </div>

            {isProcessing && !assistantResponse && (
              <p className="text-xs text-slate-400 leading-relaxed">
                Nodysom is thinking and preparing your answer...
              </p>
            )}

            {assistantResponse && (
              <>
                <div className="max-h-[240px] overflow-y-auto">

                  <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap break-words">
                    {assistantResponse}
                  </p>

                </div>

                {/* Response controls */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-indigo-400/20">

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking();
                      } else {
                        speakResponse();
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
                  >
                    {isSpeaking ? (
                      <>
                        <Square className="w-3.5 h-3.5" />

                        Stop speaking
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />

                        Play answer
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleNewRequest}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />

                    New question
                  </button>

                </div>
              </>
            )}
          </div>
        )}

        {/* Voice feedback */}
        <div className="w-full flex items-center justify-between text-xs text-slate-400 px-2 py-2">

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
            role="switch"
            aria-checked={voiceFeedbackEnabled}
            onClick={handleToggleVoiceFeedback}
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
                disabled={
                  isProcessing ||
                  isSubmittingRef.current
                }
                onClick={() => {
                  void handleQuickPrompt(sample);
                }}
                className="text-xs px-2.5 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50 hover:border-slate-600 transition-all disabled:opacity-50"
              >
                "{sample}"
              </button>
            ))}

          </div>
        </div>

        {/* Footer guidance */}
        <p className="w-full mt-4 text-[10px] leading-relaxed text-slate-500">
          Tap the microphone to speak, or choose a sample request.
          Nodysom's answer will appear here. Keep this window open
          while your answer is being prepared.
        </p>

      </div>
    </div>
  );
};
