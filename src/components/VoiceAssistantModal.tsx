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

type VoiceState =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'captured'
  | 'processing'
  | 'speaking'
  | 'error';

const START_FEEDBACK_TIMEOUT_MS = 12000;
const FINAL_TRANSCRIPT_DELAY_MS = 350;

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

  const [voiceState, setVoiceState] =
    useState<VoiceState>('idle');

  // ---------------------------------------------------------
  // REFS
  // ---------------------------------------------------------

  const submitHandlerRef = useRef<
    (textToSubmit?: string) => Promise<void>
  >(async () => {});

  const isSubmittingRef = useRef(false);

  const isMountedOpenRef = useRef(false);

  const finalTranscriptTimeoutRef =
    useRef<number | null>(null);

  const startFeedbackTimeoutRef =
    useRef<number | null>(null);

  const lastSubmittedTranscriptRef =
    useRef('');

  const recognitionAttemptRef =
    useRef(0);

  const transcriptRef =
    useRef('');

  const voiceStateRef =
    useRef<VoiceState>('idle');

  const isProcessingRef =
    useRef(false);

  const isSpeakingRef =
    useRef(false);

  const isListeningRef =
    useRef(false);

  const requestIdRef =
    useRef(0);

  const mountedRef =
    useRef(false);

  const voiceFeedbackEnabledRef =
    useRef(true);

  const onCloseRef =
    useRef(onClose);

  const onSubmitVoicePromptRef =
    useRef(onSubmitVoicePrompt);

  // ---------------------------------------------------------
  // KEEP CALLBACK REFS UP TO DATE
  // ---------------------------------------------------------

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [
    onClose,
  ]);

  useEffect(() => {
    onSubmitVoicePromptRef.current =
      onSubmitVoicePrompt;
  }, [
    onSubmitVoicePrompt,
  ]);

  useEffect(() => {
    voiceFeedbackEnabledRef.current =
      voiceFeedbackEnabled;
  }, [
    voiceFeedbackEnabled,
  ]);

  // ---------------------------------------------------------
  // SYNCHRONIZE REFS WITH STATE
  // ---------------------------------------------------------

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [
    transcript,
  ]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [
    voiceState,
  ]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [
    isProcessing,
  ]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [
    isSpeaking,
  ]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [
    isListening,
  ]);

  // ---------------------------------------------------------
  // TIMER MANAGEMENT
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

  const clearStartFeedbackTimeout =
    useCallback(() => {
      if (
        startFeedbackTimeoutRef.current !== null
      ) {
        window.clearTimeout(
          startFeedbackTimeoutRef.current
        );

        startFeedbackTimeoutRef.current = null;
      }
    }, []);

  const clearAllTimers =
    useCallback(() => {
      clearFinalTranscriptTimeout();

      clearStartFeedbackTimeout();
    }, [
      clearFinalTranscriptTimeout,
      clearStartFeedbackTimeout,
    ]);

  // ---------------------------------------------------------
  // UPDATE VOICE STATE
  // ---------------------------------------------------------

  const updateVoiceState = useCallback(
    (
      nextState: VoiceState,
      message?: string
    ) => {
      voiceStateRef.current = nextState;

      setVoiceState(nextState);

      if (message !== undefined) {
        setStatusMessage(message);
      }
    },
    []
  );

  // ---------------------------------------------------------
  // STOP SPEECH OUTPUT
  // ---------------------------------------------------------

  const stopSpeaking = useCallback(() => {
    speechService.stopSpeaking();

    isSpeakingRef.current = false;

    setIsSpeaking(false);

    if (
      voiceStateRef.current === 'speaking'
    ) {
      updateVoiceState(
        'idle',
        'Spoken response stopped.'
      );
    }
  }, [
    updateVoiceState,
  ]);

  // ---------------------------------------------------------
  // SPEAK ASSISTANT RESPONSE
  // ---------------------------------------------------------

  const speakResponse = useCallback(
    (textToSpeak?: string) => {
      const text = (
        textToSpeak !== undefined
          ? textToSpeak
          : assistantResponse
      ).trim();

      if (!text) {
        updateVoiceState(
          'idle',
          'There is no answer to read aloud yet.'
        );

        return;
      }

      if (!isMountedOpenRef.current) {
        return;
      }

      if (!speechService.isTTSSupported()) {
        setErrorMessage(
          'Spoken responses are not supported by this browser or device.'
        );

        updateVoiceState(
          'error',
          'Text-to-speech is unavailable.'
        );

        return;
      }

      setErrorMessage('');

      isSpeakingRef.current = true;

      setIsSpeaking(true);

      updateVoiceState(
        'speaking',
        'Nodysom is speaking...'
      );

      const currentRequestId =
        requestIdRef.current;

      try {
        speechService.speak(
          text,
          preferredLanguage,
          () => {
            // Ignore callbacks belonging to an old request.
            if (
              currentRequestId !== requestIdRef.current
            ) {
              return;
            }

            isSpeakingRef.current = false;

            setIsSpeaking(false);

            if (!isMountedOpenRef.current) {
              return;
            }

            updateVoiceState(
              'idle',
              'Answer complete. You can ask another question.'
            );
          }
        );
      } catch (error: unknown) {
        console.error(
          '[Nodysom Voice Assistant] Text-to-speech failed:',
          error
        );

        isSpeakingRef.current = false;

        setIsSpeaking(false);

        if (!isMountedOpenRef.current) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to speak the answer on this device.';

        setErrorMessage(message);

        updateVoiceState(
          'error',
          'Nodysom could not read the answer aloud.'
        );
      }
    },
    [
      assistantResponse,
      preferredLanguage,
      updateVoiceState,
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
          : transcriptRef.current
      ).trim();

      if (!finalQuery) {
        if (isMountedOpenRef.current) {
          updateVoiceState(
            'idle',
            'Please speak or enter a request first.'
          );
        }

        return;
      }

      if (isSubmittingRef.current) {
        return;
      }

      if (!isMountedOpenRef.current) {
        return;
      }

      isSubmittingRef.current = true;

      const currentRequestId =
        ++requestIdRef.current;

      clearAllTimers();

      lastSubmittedTranscriptRef.current =
        finalQuery;

      recognitionAttemptRef.current += 1;

      speechService.stopListening();

      isListeningRef.current = false;

      setIsListening(false);

      isProcessingRef.current = true;

      setIsProcessing(true);

      setErrorMessage('');

      setAssistantResponse('');

      transcriptRef.current = finalQuery;

      setTranscript(finalQuery);

      updateVoiceState(
        'processing',
        'Nodysom is preparing your answer...'
      );

      try {
        const result =
          await onSubmitVoicePromptRef.current(
            finalQuery
          );

        // Do not allow a response from an earlier request
        // to overwrite the current modal state.
        if (
          !isMountedOpenRef.current ||
          currentRequestId !== requestIdRef.current
        ) {
          return;
        }

        const answer =
          typeof result === 'string'
            ? result.trim()
            : '';

        if (!answer) {
          setAssistantResponse('');

          setErrorMessage(
            'No response text was returned. Check the AI request and its response handling in App.tsx.'
          );

          updateVoiceState(
            'error',
            'The request was sent, but no answer was returned.'
          );

          return;
        }

        setAssistantResponse(answer);

        updateVoiceState(
          'idle',
          'Nodysom has answered your question.'
        );

        if (
          voiceFeedbackEnabledRef.current
        ) {
          speakResponse(answer);
        }
      } catch (error: unknown) {
        console.error(
          '[Nodysom Voice Assistant] Request failed:',
          error
        );

        if (
          !isMountedOpenRef.current ||
          currentRequestId !== requestIdRef.current
        ) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.';

        setErrorMessage(message);

        updateVoiceState(
          'error',
          'Nodysom could not complete your request.'
        );
      } finally {
        // Only the current request may reset submission state.
        if (
          currentRequestId === requestIdRef.current
        ) {
          isSubmittingRef.current = false;

          isProcessingRef.current = false;

          if (isMountedOpenRef.current) {
            setIsProcessing(false);
          }
        }
      }
    },
    [
      clearAllTimers,
      speakResponse,
      updateVoiceState,
    ]
  );

  // Keep recognition connected to the latest submit handler.
  useEffect(() => {
    submitHandlerRef.current = handleSubmit;
  }, [
    handleSubmit,
  ]);

  // ---------------------------------------------------------
  // START LISTENING
  // ---------------------------------------------------------

  const handleStartListening =
    useCallback(() => {
      if (!isOpen) {
        return;
      }

      if (!isMountedOpenRef.current) {
        return;
      }

      if (
        isProcessingRef.current ||
        isSubmittingRef.current
      ) {
        updateVoiceState(
          'processing',
          'Please wait for the current answer to finish.'
        );

        return;
      }

      if (
        isListeningRef.current ||
        speechService.isCurrentlyListening()
      ) {
        return;
      }

      clearAllTimers();

      // Stop any previous speech before opening the microphone.
      speechService.stopSpeaking();

      isSpeakingRef.current = false;

      setIsSpeaking(false);

      setErrorMessage('');

      transcriptRef.current = '';

      setTranscript('');

      setAssistantResponse('');

      lastSubmittedTranscriptRef.current = '';

      const attempt =
        ++recognitionAttemptRef.current;

      isListeningRef.current = true;

      setIsListening(true);

      updateVoiceState(
        'starting',
        'Starting microphone and speech recognition...'
      );

      // The recognition service should confirm its start.
      // If it does not, don't keep displaying Listening forever.
      startFeedbackTimeoutRef.current =
        window.setTimeout(() => {
          startFeedbackTimeoutRef.current = null;

          if (
            !isMountedOpenRef.current ||
            recognitionAttemptRef.current !== attempt
          ) {
            return;
          }

          if (
            voiceStateRef.current === 'starting' &&
            !speechService.isCurrentlyListening()
          ) {
            isListeningRef.current = false;

            setIsListening(false);

            setErrorMessage(
              'The browser did not confirm that speech recognition started. Check microphone permission, browser compatibility and the speech-recognition service.'
            );

            updateVoiceState(
              'error',
              'Speech recognition did not start. Tap the microphone to try again.'
            );
          }
        }, START_FEEDBACK_TIMEOUT_MS);

      try {
        speechService.startListening(
          {
            onResult: (
              text,
              isFinal
            ) => {
              if (
                !isMountedOpenRef.current ||
                recognitionAttemptRef.current !== attempt
              ) {
                return;
              }

              const cleanedText =
                text.trim();

              if (!cleanedText) {
                return;
              }

              clearStartFeedbackTimeout();

              transcriptRef.current = cleanedText;

              setTranscript(cleanedText);

              setErrorMessage('');

              if (isFinal) {
                if (
                  lastSubmittedTranscriptRef.current ===
                  cleanedText
                ) {
                  return;
                }

                clearFinalTranscriptTimeout();

                updateVoiceState(
                  'captured',
                  'Speech recognized. Preparing your request...'
                );

                finalTranscriptTimeoutRef.current =
                  window.setTimeout(() => {
                    finalTranscriptTimeoutRef.current =
                      null;

                    if (
                      !isMountedOpenRef.current ||
                      recognitionAttemptRef.current !== attempt
                    ) {
                      return;
                    }

                    void submitHandlerRef.current(
                      cleanedText
                    );
                  }, FINAL_TRANSCRIPT_DELAY_MS);
              } else {
                updateVoiceState(
                  'listening',
                  'Speech detected. Keep speaking...'
                );
              }
            },

            onError: (error) => {
              console.error(
                '[Nodysom Voice Assistant] Speech recognition error:',
                error
              );

              if (
                !isMountedOpenRef.current ||
                recognitionAttemptRef.current !== attempt
              ) {
                return;
              }

              clearAllTimers();

              isListeningRef.current = false;

              setIsListening(false);

              setErrorMessage(
                error ||
                  'Speech recognition failed. Check microphone permission and try again.'
              );

              updateVoiceState(
                'error',
                'Speech recognition failed. Read the error below and try again.'
              );
            },

            onEnd: () => {
              if (
                !isMountedOpenRef.current ||
                recognitionAttemptRef.current !== attempt
              ) {
                return;
              }

              clearStartFeedbackTimeout();

              isListeningRef.current = false;

              setIsListening(false);

              if (
                isProcessingRef.current ||
                isSubmittingRef.current ||
                isSpeakingRef.current
              ) {
                return;
              }

              if (transcriptRef.current.trim()) {
                if (
                  voiceStateRef.current !== 'captured'
                ) {
                  updateVoiceState(
                    'captured',
                    'Speech captured. You can send your request.'
                  );
                }

                return;
              }

              // Preserve a specific recognition error instead
              // of replacing it with a generic stopped message.
              if (
                voiceStateRef.current === 'error'
              ) {
                return;
              }

              updateVoiceState(
                'idle',
                'Listening stopped without recognized words. Tap the microphone and try again.'
              );
            },
          },
          preferredLanguage
        );

        // Check support after requesting recognition.
        if (!speechService.isSpeechSupported()) {
          clearStartFeedbackTimeout();

          isListeningRef.current = false;

          setIsListening(false);

          setErrorMessage(
            'Speech recognition is not supported in this browser. Try an up-to-date browser that supports Web Speech API.'
          );

          updateVoiceState(
            'error',
            'Speech recognition is unavailable.'
          );
        }
      } catch (error: unknown) {
        clearAllTimers();

        isListeningRef.current = false;

        setIsListening(false);

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to start speech recognition.';

        setErrorMessage(message);

        updateVoiceState(
          'error',
          'Could not start the microphone. Check permissions and try again.'
        );
      }
    }, [
      isOpen,
      preferredLanguage,
      clearAllTimers,
      clearFinalTranscriptTimeout,
      clearStartFeedbackTimeout,
      updateVoiceState,
    ]);

  // ---------------------------------------------------------
  // STOP LISTENING
  // ---------------------------------------------------------

  const handleStopListening =
    useCallback(() => {
      clearAllTimers();

      // Invalidate late events from the stopped session.
      recognitionAttemptRef.current += 1;

      speechService.stopListening();

      isListeningRef.current = false;

      setIsListening(false);

      if (transcriptRef.current.trim()) {
        updateVoiceState(
          'captured',
          'Speech captured. Tap Send Request to continue.'
        );
      } else {
        updateVoiceState(
          'idle',
          'Microphone paused. Tap the microphone to resume.'
        );
      }
    }, [
      clearAllTimers,
      updateVoiceState,
    ]);

  // ---------------------------------------------------------
  // START A NEW REQUEST
  // ---------------------------------------------------------

  const handleNewRequest = useCallback(() => {
    if (
      isProcessingRef.current ||
      isSubmittingRef.current
    ) {
      return;
    }

    clearAllTimers();

    recognitionAttemptRef.current += 1;

    requestIdRef.current += 1;

    speechService.stopListening();

    speechService.stopSpeaking();

    isListeningRef.current = false;

    setIsListening(false);

    isSpeakingRef.current = false;

    setIsSpeaking(false);

    transcriptRef.current = '';

    setTranscript('');

    setAssistantResponse('');

    setErrorMessage('');

    lastSubmittedTranscriptRef.current = '';

    updateVoiceState(
      'idle',
      'Ready for your next question. Tap the microphone or choose a prompt.'
    );
  }, [
    clearAllTimers,
    updateVoiceState,
  ]);

  // ---------------------------------------------------------
  // TOGGLE SPOKEN RESPONSE
  // ---------------------------------------------------------

  const handleToggleVoiceFeedback =
    useCallback(() => {
      setVoiceFeedbackEnabled((enabled) => {
        const nextEnabled = !enabled;

        voiceFeedbackEnabledRef.current =
          nextEnabled;

        if (!nextEnabled) {
          speechService.stopSpeaking();

          isSpeakingRef.current = false;

          setIsSpeaking(false);

          if (
            voiceStateRef.current === 'speaking'
          ) {
            updateVoiceState(
              'idle',
              'Spoken responses are turned off.'
            );
          }
        }

        return nextEnabled;
      });
    }, [
      updateVoiceState,
    ]);

  // ---------------------------------------------------------
  // CLOSE HANDLER
  // ---------------------------------------------------------

  const handleClose = useCallback(() => {
    clearAllTimers();

    recognitionAttemptRef.current += 1;

    requestIdRef.current += 1;

    isMountedOpenRef.current = false;

    speechService.stopListening();

    speechService.stopSpeaking();

    isListeningRef.current = false;

    setIsListening(false);

    isSpeakingRef.current = false;

    setIsSpeaking(false);

    isSubmittingRef.current = false;

    isProcessingRef.current = false;

    setIsProcessing(false);

    onCloseRef.current();
  }, [
    clearAllTimers,
  ]);

  // ---------------------------------------------------------
  // OPEN / CLOSE LIFECYCLE
  // ---------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    if (!isOpen) {
      isMountedOpenRef.current = false;

      return () => {
        mountedRef.current = false;
      };
    }

    isMountedOpenRef.current = true;

    isSubmittingRef.current = false;

    isProcessingRef.current = false;

    isSpeakingRef.current = false;

    isListeningRef.current = false;

    recognitionAttemptRef.current += 1;

    requestIdRef.current += 1;

    lastSubmittedTranscriptRef.current = '';

    transcriptRef.current = '';

    clearAllTimers();

    speechService.stopListening();

    speechService.stopSpeaking();

    setIsListening(false);

    setIsProcessing(false);

    setIsSpeaking(false);

    setTranscript('');

    setAssistantResponse('');

    setErrorMessage('');

    updateVoiceState(
      'idle',
      'Tap the microphone and speak.'
    );

    return () => {
      mountedRef.current = false;

      isMountedOpenRef.current = false;

      recognitionAttemptRef.current += 1;

      requestIdRef.current += 1;

      clearAllTimers();

      speechService.stopListening();

      speechService.stopSpeaking();

      isSubmittingRef.current = false;

      isProcessingRef.current = false;

      isSpeakingRef.current = false;

      isListeningRef.current = false;
    };
  }, [
    isOpen,
    clearAllTimers,
    updateVoiceState,
  ]);

  // ---------------------------------------------------------
  // QUICK PROMPTS
  // ---------------------------------------------------------

  const handleQuickPrompt = useCallback(
    (sample: string) => {
      if (
        isProcessingRef.current ||
        isSubmittingRef.current
      ) {
        return;
      }

      void submitHandlerRef.current(sample);
    },
    []
  );

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  if (!isOpen) {
    return null;
  }

  const microphoneLabel =
    isListening
      ? 'Stop listening'
      : voiceState === 'starting'
        ? 'Starting microphone'
        : 'Start listening';

  const microphoneDisabled =
    isProcessing ||
    isSubmittingRef.current ||
    voiceState === 'starting';

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
            disabled={microphoneDisabled}
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
              isListening
                ? 'bg-gradient-to-tr from-rose-500 to-indigo-600 text-white scale-110 shadow-rose-500/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95'
            }`}
            aria-label={microphoneLabel}
            title={microphoneLabel}
          >
            {voiceState === 'starting' ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isListening ? (
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
          {(
            isProcessing ||
            voiceState === 'starting'
          ) && (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
          )}

          {isSpeaking && (
            <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}

          {voiceState === 'error' && (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}

          <span className="break-words">
            {statusMessage}
          </span>
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
