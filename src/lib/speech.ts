// Speech Recognition and Text-to-Speech audio integration for Nodysom AI

export interface SpeechRecognitionHandlers {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
      confidence?: number;
    };
  }>;
};

type SpeechRecognitionErrorEvent = {
  error?: string;
  message?: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onaudiostart?: (() => void) | null;
  onaudioend?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onsoundend?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onnomatch?: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type RecognitionSession = {
  id: number;
  handlers: SpeechRecognitionHandlers;
  startConfirmed: boolean;
  resultReceived: boolean;
  finalResultReceived: boolean;
  intentionalStop: boolean;
  errorReported: boolean;
  lastTranscript: string;
  watchdog: ReturnType<typeof setTimeout> | null;
};

const RECOGNITION_START_TIMEOUT_MS = 10000;
const RECOGNITION_NO_RESULT_TIMEOUT_MS = 15000;

class SpeechService {
  private recognition: SpeechRecognitionInstance | null = null;

  private isListening = false;

  private isSpeaking = false;

  // Indicates that the browser has not yet confirmed onstart.
  private isStarting = false;

  // Prevents overlapping recognition.start() requests.
  private startRequestPending = false;

  // Remembers a stop requested before recognition actually starts.
  private stopRequested = false;

  // Identifies recognition sessions and protects against stale events.
  private sessionId = 0;

  // Current recognition session.
  private activeSession: RecognitionSession | null = null;

  // Tracks the current text-to-speech operation.
  private speechSessionId = 0;

  constructor() {
    if (typeof window === "undefined") {
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognition =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn(
        "[Nodysom AI] Speech Recognition API is unavailable in this browser."
      );
      return;
    }

    try {
      this.recognition = new SpeechRecognition();

      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.installRecognitionHandlers();
    } catch (error) {
      console.error(
        "[Nodysom AI] Speech recognition initialization failed:",
        error
      );

      this.recognition = null;
    }
  }

  // ---------------------------------------------------------
  // INTERNAL RECOGNITION UTILITIES
  // ---------------------------------------------------------

  private getActiveSession(): RecognitionSession | null {
    const session = this.activeSession;

    if (!session || session.id !== this.sessionId) {
      return null;
    }

    return session;
  }

  private clearSessionWatchdog(
    session: RecognitionSession
  ): void {
    if (session.watchdog !== null) {
      clearTimeout(session.watchdog);
      session.watchdog = null;
    }
  }

  private clearAllRecognitionTimers(): void {
    const session = this.activeSession;

    if (session) {
      this.clearSessionWatchdog(session);
    }
  }

  private clearSessionState(): void {
    this.clearAllRecognitionTimers();

    this.activeSession = null;
    this.isListening = false;
    this.isStarting = false;
    this.startRequestPending = false;
    this.stopRequested = false;
  }

  private mapRecognitionError(error: string): string {
    const normalizedError = error.toLowerCase().trim();

    const errorMessages: Record<string, string> = {
      "not-allowed":
        "Microphone or speech-recognition permission was denied. Allow microphone access for Nodysom AI in your browser settings, then try again.",

      "service-not-allowed":
        "The browser's speech-recognition service is blocked or unavailable. Check your browser settings and try again.",

      "audio-capture":
        "The microphone could not be opened. Check that your microphone is available and that no other app is blocking it.",

      "network":
        "The speech-recognition service could not connect. Check your internet connection and try again.",

      "no-speech":
        "No speech was detected. Tap the microphone and speak clearly after listening starts.",

      "language-not-supported":
        "The selected speech-recognition language is not supported by this browser. Try English (United States) or another supported language.",

      "aborted":
        "Speech recognition was interrupted. Tap the microphone to try again.",

      "bad-grammar":
        "The browser could not process the speech-recognition grammar. Try again.",

      "phrases-not-supported":
        "The browser does not support the selected recognition phrases.",

      "microphone error":
        "The microphone could not complete speech recognition. Check microphone permission and try again.",

      "not supported":
        "Speech recognition is not supported in this browser. Try an up-to-date browser with Web Speech API support."
    };

    return (
      errorMessages[normalizedError] ||
      `Speech recognition failed (${error || "unknown error"}). Check microphone permission, internet access and browser compatibility, then try again.`
    );
  }

  private reportError(
    session: RecognitionSession,
    error: string
  ): void {
    if (
      session.errorReported ||
      this.getActiveSession()?.id !== session.id
    ) {
      return;
    }

    session.errorReported = true;

    this.clearSessionWatchdog(session);

    console.warn(
      "[Nodysom AI] Speech recognition error:",
      error
    );

    try {
      session.handlers.onError(
        this.mapRecognitionError(error)
      );
    } catch (handlerError) {
      console.error(
        "[Nodysom AI] Recognition error handler failed:",
        handlerError
      );
    }
  }

  private finishSession(
    session: RecognitionSession
  ): void {
    if (this.getActiveSession()?.id !== session.id) {
      return;
    }

    this.clearSessionWatchdog(session);

    this.activeSession = null;
    this.isListening = false;
    this.isStarting = false;
    this.startRequestPending = false;
    this.stopRequested = false;

    try {
      session.handlers.onEnd();
    } catch (error) {
      console.error(
        "[Nodysom AI] Recognition end handler failed:",
        error
      );
    }
  }

  private startWatchdog(
    session: RecognitionSession,
    timeoutMs: number,
    message: string
  ): void {
    this.clearSessionWatchdog(session);

    session.watchdog = setTimeout(() => {
      if (this.getActiveSession()?.id !== session.id) {
        return;
      }

      if (session.intentionalStop) {
        return;
      }

      console.warn(
        "[Nodysom AI] Recognition watchdog triggered:",
        message
      );

      this.reportError(session, message);

      const recognition = this.recognition;

      if (recognition) {
        try {
          if (typeof recognition.abort === "function") {
            recognition.abort();
          } else {
            recognition.stop();
          }
        } catch (error) {
          console.warn(
            "[Nodysom AI] Could not stop timed-out recognition:",
            error
          );
        }
      }

      // Do not depend solely on the browser firing onend.
      // A broken recognition implementation must not leave
      // the UI stuck forever.
      this.finishSession(session);
    }, timeoutMs);
  }

  private installRecognitionHandlers(): void {
    const recognition = this.recognition;

    if (!recognition) {
      return;
    }

    recognition.onstart = () => {
      const session = this.getActiveSession();

      if (!session) {
        try {
          recognition.abort?.();
        } catch {
          // Ignore stale-session cleanup failures.
        }

        return;
      }

      session.startConfirmed = true;

      this.isStarting = false;
      this.startRequestPending = false;
      this.isListening = true;

      console.info(
        "[Nodysom AI] Speech recognition started.",
        { sessionId: session.id }
      );

      if (this.stopRequested || session.intentionalStop) {
        this.stopRequested = false;
        this.stopListening();
        return;
      }

      // If no result or recognition error arrives, report a
      // useful timeout rather than leaving the UI in Listening.
      this.startWatchdog(
        session,
        RECOGNITION_NO_RESULT_TIMEOUT_MS,
        "Speech recognition received no result within 15 seconds. Check your microphone, browser speech service and internet connection, then try again."
      );
    };

    recognition.onaudiostart = () => {
      const session = this.getActiveSession();

      if (!session) {
        return;
      }

      console.info(
        "[Nodysom AI] Microphone audio capture started."
      );
    };

    recognition.onaudioend = () => {
      console.info(
        "[Nodysom AI] Microphone audio capture ended."
      );
    };

    recognition.onsoundstart = () => {
      console.info(
        "[Nodysom AI] Sound detected by speech recognition."
      );
    };

    recognition.onsoundend = () => {
      console.info(
        "[Nodysom AI] Sound activity ended."
      );
    };

    recognition.onspeechstart = () => {
      console.info(
        "[Nodysom AI] Speech activity detected."
      );
    };

    recognition.onspeechend = () => {
      console.info(
        "[Nodysom AI] Speech activity ended."
      );
    };

    recognition.onnomatch = () => {
      const session = this.getActiveSession();

      if (!session || session.intentionalStop) {
        return;
      }

      console.warn(
        "[Nodysom AI] Speech was detected, but no matching transcript was returned."
      );
    };

    recognition.onresult = (
      event: SpeechRecognitionResultEvent
    ) => {
      const session = this.getActiveSession();

      if (!session || session.intentionalStop) {
        return;
      }

      let interimTranscript = "";
      let finalTranscript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const result = event.results[i];

        if (!result || !result[0]) {
          continue;
        }

        const transcript =
          result[0].transcript || "";

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const transcript = (
        finalTranscript || interimTranscript
      ).trim();

      if (!transcript) {
        return;
      }

      session.resultReceived = true;
      session.lastTranscript = transcript;

      if (finalTranscript.trim()) {
        session.finalResultReceived = true;
      }

      // Speech recognition is producing data. Give it a fresh
      // window if more speech results are still arriving.
      this.startWatchdog(
        session,
        RECOGNITION_NO_RESULT_TIMEOUT_MS,
        "Speech recognition stopped producing results. Tap the microphone and try again."
      );

      console.info(
        "[Nodysom AI] Transcript received:",
        {
          transcript,
          isFinal: Boolean(finalTranscript.trim())
        }
      );

      try {
        session.handlers.onResult(
          transcript,
          Boolean(finalTranscript.trim())
        );
      } catch (error) {
        console.error(
          "[Nodysom AI] Transcript handler failed:",
          error
        );

        this.reportError(
          session,
          "The application could not process the recognized transcript."
        );
      }

      if (session.finalResultReceived) {
        this.clearSessionWatchdog(session);
      }
    };

    recognition.onerror = (
      event: SpeechRecognitionErrorEvent
    ) => {
      const session = this.getActiveSession();

      const error =
        event.error ||
        event.message ||
        "Microphone error";

      this.isListening = false;
      this.isStarting = false;
      this.startRequestPending = false;
      this.stopRequested = false;

      // A user-requested abort is not necessarily a failure.
      if (
        (error === "aborted" || error === "no-speech") &&
        session?.intentionalStop
      ) {
        return;
      }

      if (session) {
        this.reportError(session, error);
      } else {
        console.warn(
          "[Nodysom AI] Recognition error without an active session:",
          error
        );
      }
    };

    recognition.onend = () => {
      const session = this.getActiveSession();

      console.info(
        "[Nodysom AI] Speech recognition session ended."
      );

      if (!session) {
        this.isListening = false;
        this.isStarting = false;
        this.startRequestPending = false;
        this.stopRequested = false;
        return;
      }

      // A normal onend without any result or error is not a
      // successful transcription. Tell the UI what happened.
      if (
        !session.intentionalStop &&
        !session.resultReceived &&
        !session.errorReported
      ) {
        this.reportError(
          session,
          "Speech recognition ended without returning any words. Check the browser speech service, microphone access and internet connection."
        );
      }

      this.finishSession(session);
    };
  }

  // ---------------------------------------------------------
  // SPEECH RECOGNITION SUPPORT
  // ---------------------------------------------------------

  public isSpeechSupported(): boolean {
    return Boolean(this.recognition);
  }

  public isCurrentlyListening(): boolean {
    return (
      this.isListening ||
      this.isStarting ||
      this.startRequestPending
    );
  }

  // ---------------------------------------------------------
  // TEXT-TO-SPEECH SUPPORT
  // ---------------------------------------------------------

  public isTTSSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined"
    );
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  // ---------------------------------------------------------
  // START SPEECH RECOGNITION
  // ---------------------------------------------------------

  public startListening(
    handlers: SpeechRecognitionHandlers,
    lang: string = "en-US"
  ): void {
    if (typeof window === "undefined") {
      handlers.onError(
        "Speech recognition is unavailable because the browser window does not exist."
      );

      handlers.onEnd();
      return;
    }

    if (!this.recognition) {
      handlers.onError(
        "Speech recognition is not supported in this browser. Use an up-to-date browser with Web Speech API support."
      );

      handlers.onEnd();
      return;
    }

    // Prevent multiple simultaneous sessions.
    if (
      this.isListening ||
      this.isStarting ||
      this.startRequestPending ||
      this.activeSession !== null
    ) {
      console.warn(
        "[Nodysom AI] Ignoring duplicate recognition start request."
      );
      return;
    }

    const recognition = this.recognition;

    this.sessionId += 1;

    const session: RecognitionSession = {
      id: this.sessionId,
      handlers,
      startConfirmed: false,
      resultReceived: false,
      finalResultReceived: false,
      intentionalStop: false,
      errorReported: false,
      lastTranscript: "",
      watchdog: null
    };

    this.activeSession = session;

    this.stopRequested = false;
    this.startRequestPending = true;
    this.isStarting = true;
    this.isListening = false;

    try {
      const requestedLanguage =
        typeof lang === "string"
          ? lang.trim()
          : "";

      recognition.lang =
        requestedLanguage || "en-US";

      // A browser must confirm onstart before the session is
      // considered to be actively listening.
      recognition.start();

      // Do not leave "starting" stuck if the browser never
      // sends onstart or onerror.
      this.startWatchdog(
        session,
        RECOGNITION_START_TIMEOUT_MS,
        "The browser did not start speech recognition within 10 seconds. Check microphone permission and browser compatibility."
      );
    } catch (error: unknown) {
      this.clearSessionWatchdog(session);

      this.isListening = false;
      this.isStarting = false;
      this.startRequestPending = false;
      this.stopRequested = false;

      const errorName =
        error instanceof Error
          ? error.name
          : "";

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not start microphone";

      console.error(
        "[Nodysom AI] Could not start speech recognition:",
        { errorName, errorMessage }
      );

      if (errorName === "InvalidStateError") {
        this.activeSession = null;

        handlers.onError(
          "The browser reports that speech recognition is already running. Wait a moment, then tap the microphone again."
        );

        handlers.onEnd();
        return;
      }

      this.activeSession = null;

      handlers.onError(
        this.mapRecognitionError(
          errorName || errorMessage
        )
      );

      handlers.onEnd();
    }
  }

  // ---------------------------------------------------------
  // STOP SPEECH RECOGNITION
  // ---------------------------------------------------------

  public stopListening(): void {
    const recognition = this.recognition;
    const session = this.getActiveSession();

    if (!recognition || !session) {
      this.clearSessionState();
      return;
    }

    if (
      !this.isListening &&
      !this.isStarting &&
      !this.startRequestPending
    ) {
      this.finishSession(session);
      return;
    }

    session.intentionalStop = true;
    this.stopRequested = true;

    this.clearSessionWatchdog(session);

    try {
      recognition.stop();
    } catch (error: unknown) {
      const errorName =
        error instanceof Error
          ? error.name
          : "";

      if (errorName === "InvalidStateError") {
        this.finishSession(session);
        return;
      }

      console.warn(
        "[Nodysom AI] Could not stop speech recognition:",
        error
      );

      this.finishSession(session);
      return;
    }

    this.isListening = false;
    this.isStarting = false;
    this.startRequestPending = false;

    // Some browser implementations fail to fire onend after
    // stop(). Finish safely instead of leaving a stale session.
    session.watchdog = setTimeout(() => {
      if (this.getActiveSession()?.id !== session.id) {
        return;
      }

      console.warn(
        "[Nodysom AI] Recognition did not finish after stop()."
      );

      this.finishSession(session);
    }, 3000);
  }

  // ---------------------------------------------------------
  // CANCEL SPEECH RECOGNITION IMMEDIATELY
  // ---------------------------------------------------------

  public abortListening(): void {
    const recognition = this.recognition;

    // Invalidate callbacks from the session being cancelled.
    this.sessionId += 1;

    this.clearSessionState();

    if (!recognition) {
      return;
    }

    try {
      if (typeof recognition.abort === "function") {
        recognition.abort();
      } else {
        recognition.stop();
      }
    } catch (error) {
      console.warn(
        "[Nodysom AI] Could not abort speech recognition:",
        error
      );
    }
  }

  // ---------------------------------------------------------
  // TEXT-TO-SPEECH
  // ---------------------------------------------------------

  public speak(
    text: string,
    lang: string = "en-US",
    onDone?: () => void
  ): void {
    if (!this.isTTSSupported()) {
      if (onDone) {
        onDone();
      }

      return;
    }

    const cleanText = text
      .replace(/[*_#`]/g, "")
      .replace(/\[.*?\]/g, "")
      .trim()
      .slice(0, 300);

    if (!cleanText) {
      if (onDone) {
        onDone();
      }

      return;
    }

    this.stopSpeaking();

    const currentSpeechSessionId =
      this.speechSessionId;

    const utterance =
      new SpeechSynthesisUtterance(cleanText);

    utterance.lang =
      lang.trim() || "en-US";

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (
        currentSpeechSessionId !== this.speechSessionId
      ) {
        return;
      }

      this.isSpeaking = false;

      if (onDone) {
        onDone();
      }
    };

    utterance.onerror = (event) => {
      if (
        currentSpeechSessionId !== this.speechSessionId
      ) {
        return;
      }

      this.isSpeaking = false;

      console.warn(
        "[Nodysom AI] Text-to-speech error:",
        event.error
      );

      if (onDone) {
        onDone();
      }
    };

    this.isSpeaking = true;

    try {
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      this.isSpeaking = false;

      console.warn(
        "[Nodysom AI] Could not start text-to-speech:",
        error
      );

      if (onDone) {
        onDone();
      }
    }
  }

  // ---------------------------------------------------------
  // STOP TEXT-TO-SPEECH
  // ---------------------------------------------------------

  public stopSpeaking(): void {
    // Invalidate callbacks from the previous speech session.
    this.speechSessionId += 1;

    if (!this.isTTSSupported()) {
      this.isSpeaking = false;
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      console.warn(
        "[Nodysom AI] Could not stop text-to-speech:",
        error
      );
    }

    this.isSpeaking = false;
  }
}

// Shared service instance used by the existing application.
export const speechService = new SpeechService();
