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
  recognition: SpeechRecognitionInstance;
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
const RECOGNITION_STOP_TIMEOUT_MS = 3000;
const RETIRING_RECOGNITION_TIMEOUT_MS = 5000;

class SpeechService {
  private recognitionConstructor: SpeechRecognitionConstructor | null = null;

  private recognition: SpeechRecognitionInstance | null = null;

  private isListening = false;

  private isStarting = false;

  private startRequestPending = false;

  private isSpeaking = false;

  private sessionId = 0;

  private activeSession: RecognitionSession | null = null;

  /**
   * Tracks old recognition instances that are being stopped.
   * This is diagnostic state only; it must not permanently block
   * a new recognition session.
   */
  private retiringRecognitions = new Set<SpeechRecognitionInstance>();

  private retirementTimers = new Map<
    SpeechRecognitionInstance,
    ReturnType<typeof setTimeout>
  >();

  private speechSessionId = 0;

  constructor() {
    if (typeof window === "undefined") {
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    this.recognitionConstructor =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition ||
      null;

    if (!this.recognitionConstructor) {
      console.warn(
        "[Nodysom AI] Speech Recognition API is unavailable in this browser."
      );
      return;
    }

    console.info(
      "[Nodysom AI] Speech Recognition API detected."
    );
  }

  // ---------------------------------------------------------
  // INTERNAL SESSION UTILITIES
  // ---------------------------------------------------------

  private getActiveSession(): RecognitionSession | null {
    const session = this.activeSession;

    if (!session || session.id !== this.sessionId) {
      return null;
    }

    return session;
  }

  private isSessionActive(session: RecognitionSession): boolean {
    return (
      this.activeSession === session &&
      this.sessionId === session.id
    );
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

  private updatePublicState(): void {
    const session = this.activeSession;

    this.isStarting = Boolean(
      session && !session.startConfirmed
    );

    this.isListening = Boolean(
      session &&
      session.startConfirmed &&
      !session.intentionalStop
    );

    this.startRequestPending = Boolean(
      session && !session.startConfirmed
    );
  }

  private detachRecognitionHandlers(
    recognition: SpeechRecognitionInstance
  ): void {
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.onaudiostart = null;
    recognition.onaudioend = null;
    recognition.onsoundstart = null;
    recognition.onsoundend = null;
    recognition.onspeechstart = null;
    recognition.onspeechend = null;
    recognition.onnomatch = null;
  }

  private clearRetirementTimer(
    recognition: SpeechRecognitionInstance
  ): void {
    const timer = this.retirementTimers.get(recognition);

    if (timer !== undefined) {
      clearTimeout(timer);
      this.retirementTimers.delete(recognition);
    }
  }

  private releaseRetiringRecognition(
    recognition: SpeechRecognitionInstance
  ): void {
    this.clearRetirementTimer(recognition);
    this.retiringRecognitions.delete(recognition);

    console.info(
      "[Nodysom AI] Previous recognition instance released from tracking.",
      {
        remainingRetiringSessions: this.retiringRecognitions.size
      }
    );
  }

  private retireRecognition(
    recognition: SpeechRecognitionInstance
  ): void {
    this.retiringRecognitions.add(recognition);

    /*
     * Do not retain a stale recognition instance forever if the
     * browser fails to dispatch onend.
     *
     * This timer only releases our internal tracking. It cannot
     * guarantee that the browser's underlying speech service has
     * actually stopped.
     */
    this.clearRetirementTimer(recognition);

    const retirementTimer = setTimeout(() => {
      this.releaseRetiringRecognition(recognition);
    }, RETIRING_RECOGNITION_TIMEOUT_MS);

    this.retirementTimers.set(
      recognition,
      retirementTimer
    );

    try {
      if (typeof recognition.abort === "function") {
        recognition.abort();
      } else {
        recognition.stop();
      }
    } catch (error) {
      console.warn(
        "[Nodysom AI] Could not retire recognition instance:",
        error
      );
    }
  }

  private createRecognitionInstance(): SpeechRecognitionInstance {
    if (!this.recognitionConstructor) {
      throw new Error(
        "Speech recognition is not supported in this browser."
      );
    }

    const recognition = new this.recognitionConstructor();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    return recognition;
  }

  private createSession(
    handlers: SpeechRecognitionHandlers,
    lang: string
  ): RecognitionSession {
    const recognition = this.createRecognitionInstance();

    const session: RecognitionSession = {
      id: ++this.sessionId,
      recognition,
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
    this.recognition = recognition;

    const requestedLanguage =
      typeof lang === "string" ? lang.trim() : "";

    recognition.lang = requestedLanguage || "en-US";

    this.installRecognitionHandlers(session);

    return session;
  }

  private clearSessionState(
    session: RecognitionSession,
    detachHandlers = false
  ): void {
    this.clearSessionWatchdog(session);

    if (detachHandlers) {
      this.detachRecognitionHandlers(session.recognition);
    }

    if (this.activeSession === session) {
      this.activeSession = null;
      this.recognition = null;
    }

    this.updatePublicState();
  }

  // ---------------------------------------------------------
  // ERROR HANDLING
  // ---------------------------------------------------------

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
        "Speech recognition is not supported in this browser. Try an up-to-date browser with Web Speech API support.",

      "invalidstateerror":
        "The browser is still using a previous speech-recognition session. Wait a moment, then try again."
    };

    return (
      errorMessages[normalizedError] ||
      `Speech recognition failed (${error || "unknown error"}). Check microphone permission, internet access and browser compatibility, then try again.`
    );
  }

  private notifyError(
    session: RecognitionSession,
    error: string
  ): void {
    if (session.errorReported) {
      return;
    }

    session.errorReported = true;

    console.warn(
      "[Nodysom AI] Speech recognition error:",
      error,
      { sessionId: session.id }
    );

    try {
      session.handlers.onError(
        this.mapRecognitionError(error)
      );
    } catch (handlerError) {
      console.error(
        "[Nodysom AI] Recognition error callback failed:",
        handlerError
      );
    }
  }

  private reportError(
    session: RecognitionSession,
    error: string
  ): void {
    if (!this.isSessionActive(session)) {
      return;
    }

    this.clearSessionWatchdog(session);
    this.notifyError(session, error);
  }

  // ---------------------------------------------------------
  // SESSION FINISHING AND WATCHDOGS
  // ---------------------------------------------------------

  private finishSession(
    session: RecognitionSession
  ): void {
    if (!this.isSessionActive(session)) {
      return;
    }

    console.info(
      "[Nodysom AI] Recognition session finished.",
      {
        sessionId: session.id,
        receivedResult: session.resultReceived,
        receivedFinalResult: session.finalResultReceived
      }
    );

    this.clearSessionState(session, true);

    try {
      session.handlers.onEnd();
    } catch (error) {
      console.error(
        "[Nodysom AI] Recognition end callback failed:",
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
      if (!this.isSessionActive(session)) {
        return;
      }

      if (session.intentionalStop) {
        return;
      }

      console.warn(
        "[Nodysom AI] Recognition watchdog triggered.",
        {
          sessionId: session.id,
          timeoutMs,
          message
        }
      );

      this.reportError(session, message);

      /*
       * Finish the UI session so it does not remain stuck.
       * Track the old instance only temporarily because some browsers
       * do not send onend reliably.
       */
      this.clearSessionState(session);

      this.retireRecognition(session.recognition);

      try {
        session.handlers.onEnd();
      } catch (error) {
        console.error(
          "[Nodysom AI] Recognition timeout end callback failed:",
          error
        );
      }
    }, timeoutMs);
  }

  private installRecognitionHandlers(
    session: RecognitionSession
  ): void {
    const recognition = session.recognition;

    recognition.onstart = () => {
      if (!this.isSessionActive(session)) {
        console.info(
          "[Nodysom AI] Ignoring start event from a stale session.",
          { sessionId: session.id }
        );

        return;
      }

      session.startConfirmed = true;
      this.updatePublicState();

      console.info(
        "[Nodysom AI] Speech recognition started.",
        {
          sessionId: session.id,
          lang: recognition.lang
        }
      );

      if (session.intentionalStop) {
        this.stopListening();
        return;
      }

      this.startWatchdog(
        session,
        RECOGNITION_NO_RESULT_TIMEOUT_MS,
        "Speech recognition received no result within 15 seconds. Check your microphone, browser speech service and internet connection, then try again."
      );
    };

    recognition.onaudiostart = () => {
      if (!this.isSessionActive(session)) {
        return;
      }

      console.info(
        "[Nodysom AI] Microphone audio capture started.",
        { sessionId: session.id }
      );
    };

    recognition.onaudioend = () => {
      console.info(
        "[Nodysom AI] Microphone audio capture ended.",
        { sessionId: session.id }
      );
    };

    recognition.onsoundstart = () => {
      if (!this.isSessionActive(session)) {
        return;
      }

      console.info(
        "[Nodysom AI] Sound detected.",
        { sessionId: session.id }
      );
    };

    recognition.onsoundend = () => {
      console.info(
        "[Nodysom AI] Sound activity ended.",
        { sessionId: session.id }
      );
    };

    recognition.onspeechstart = () => {
      if (!this.isSessionActive(session)) {
        return;
      }

      console.info(
        "[Nodysom AI] Speech activity detected.",
        { sessionId: session.id }
      );
    };

    recognition.onspeechend = () => {
      console.info(
        "[Nodysom AI] Speech activity ended.",
        { sessionId: session.id }
      );
    };

    recognition.onnomatch = () => {
      if (!this.isSessionActive(session)) {
        return;
      }

      console.warn(
        "[Nodysom AI] Speech was detected, but no matching transcript was returned.",
        { sessionId: session.id }
      );
    };

    recognition.onresult = (
      event: SpeechRecognitionResultEvent
    ) => {
      if (
        !this.isSessionActive(session) ||
        session.intentionalStop
      ) {
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

      console.info(
        "[Nodysom AI] Transcript received.",
        {
          sessionId: session.id,
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
          "[Nodysom AI] Transcript callback failed:",
          error
        );

        this.reportError(
          session,
          "The application could not process the recognized transcript."
        );

        return;
      }

      if (session.finalResultReceived) {
        this.clearSessionWatchdog(session);
      } else {
        this.startWatchdog(
          session,
          RECOGNITION_NO_RESULT_TIMEOUT_MS,
          "Speech recognition stopped producing results. Tap the microphone and try again."
        );
      }
    };

    recognition.onerror = (
      event: SpeechRecognitionErrorEvent
    ) => {
      const error =
        event.error ||
        event.message ||
        "Microphone error";

      console.warn(
        "[Nodysom AI] Browser recognition error event.",
        {
          sessionId: session.id,
          error
        }
      );

      if (!this.isSessionActive(session)) {
        return;
      }

      this.clearSessionWatchdog(session);

      if (
        session.intentionalStop &&
        (error === "aborted" || error === "no-speech")
      ) {
        return;
      }

      this.notifyError(session, error);
    };

    recognition.onend = () => {
      console.info(
        "[Nodysom AI] Browser recognition onend event.",
        { sessionId: session.id }
      );

      this.releaseRetiringRecognition(recognition);

      if (!this.isSessionActive(session)) {
        return;
      }

      if (
        !session.intentionalStop &&
        !session.resultReceived &&
        !session.errorReported
      ) {
        this.notifyError(
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
    return this.recognitionConstructor !== null;
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

    if (!this.recognitionConstructor) {
      handlers.onError(
        "Speech recognition is not supported in this browser. Use an up-to-date browser with Web Speech API support."
      );

      handlers.onEnd();
      return;
    }

    /*
     * Prevent duplicate sessions that are actually active.
     *
     * IMPORTANT:
     * retiringRecognitions.size is intentionally NOT used as a
     * permanent start blocker. An old recognition instance may fail
     * to send onend, which would otherwise disable the microphone.
     *
     * The browser can still reject start() with InvalidStateError.
     * That error is handled below.
     */
    if (
      this.activeSession !== null ||
      this.isListening ||
      this.isStarting ||
      this.startRequestPending
    ) {
      console.warn(
        "[Nodysom AI] Duplicate recognition start rejected.",
        {
          activeSession: this.activeSession?.id ?? null,
          retiringSessions: this.retiringRecognitions.size,
          isListening: this.isListening,
          isStarting: this.isStarting
        }
      );

      handlers.onError(
        "Speech recognition is already starting or listening. Wait a moment, then try again."
      );

      handlers.onEnd();
      return;
    }

    let session: RecognitionSession;

    try {
      session = this.createSession(handlers, lang);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not initialize speech recognition.";

      console.error(
        "[Nodysom AI] Recognition session creation failed:",
        error
      );

      handlers.onError(this.mapRecognitionError(message));
      handlers.onEnd();
      return;
    }

    this.updatePublicState();

    console.info(
      "[Nodysom AI] Requesting speech recognition start.",
      {
        sessionId: session.id,
        language: session.recognition.lang
      }
    );

    try {
      session.recognition.start();

      this.startWatchdog(
        session,
        RECOGNITION_START_TIMEOUT_MS,
        "The browser did not start speech recognition within 10 seconds. Check microphone permission and browser compatibility."
      );
    } catch (error: unknown) {
      const errorName =
        error instanceof Error
          ? error.name
          : "";

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not start microphone.";

      console.error(
        "[Nodysom AI] Recognition start() failed.",
        {
          sessionId: session.id,
          errorName,
          errorMessage
        }
      );

      this.clearSessionWatchdog(session);

      if (errorName === "InvalidStateError") {
        this.clearSessionState(session);

        this.retireRecognition(session.recognition);

        try {
          handlers.onError(
            "The browser is still using its speech-recognition service. Wait a moment, then tap the microphone again."
          );
        } catch (handlerError) {
          console.error(
            "[Nodysom AI] Error callback failed:",
            handlerError
          );
        }

        try {
          handlers.onEnd();
        } catch (handlerError) {
          console.error(
            "[Nodysom AI] End callback failed:",
            handlerError
          );
        }

        return;
      }

      this.clearSessionState(session, true);

      try {
        handlers.onError(
          this.mapRecognitionError(
            errorName || errorMessage
          )
        );
      } catch (handlerError) {
        console.error(
          "[Nodysom AI] Error callback failed:",
          handlerError
        );
      }

      try {
        handlers.onEnd();
      } catch (handlerError) {
        console.error(
          "[Nodysom AI] End callback failed:",
          handlerError
        );
      }
    }
  }

  // ---------------------------------------------------------
  // STOP SPEECH RECOGNITION
  // ---------------------------------------------------------

  public stopListening(): void {
    const session = this.getActiveSession();

    if (!session) {
      this.isListening = false;
      this.isStarting = false;
      this.startRequestPending = false;
      return;
    }

    if (session.intentionalStop) {
      return;
    }

    session.intentionalStop = true;

    this.clearSessionWatchdog(session);
    this.updatePublicState();

    console.info(
      "[Nodysom AI] User or application requested recognition stop.",
      { sessionId: session.id }
    );

    try {
      session.recognition.stop();
    } catch (error: unknown) {
      const errorName =
        error instanceof Error
          ? error.name
          : "";

      console.warn(
        "[Nodysom AI] recognition.stop() failed:",
        error
      );

      if (errorName === "InvalidStateError") {
        this.clearSessionState(session);

        this.retireRecognition(session.recognition);

        try {
          session.handlers.onEnd();
        } catch (handlerError) {
          console.error(
            "[Nodysom AI] Recognition end callback failed:",
            handlerError
          );
        }

        return;
      }

      this.clearSessionState(session);

      this.retireRecognition(session.recognition);

      try {
        session.handlers.onEnd();
      } catch (handlerError) {
        console.error(
          "[Nodysom AI] Recognition end callback failed:",
          handlerError
        );
      }

      return;
    }

    session.watchdog = setTimeout(() => {
      if (!this.isSessionActive(session)) {
        return;
      }

      console.warn(
        "[Nodysom AI] Recognition did not end after stop(); retiring session.",
        { sessionId: session.id }
      );

      this.clearSessionState(session);

      this.retireRecognition(session.recognition);

      try {
        session.handlers.onEnd();
      } catch (error) {
        console.error(
          "[Nodysom AI] Recognition end callback failed:",
          error
        );
      }
    }, RECOGNITION_STOP_TIMEOUT_MS);
  }

  // ---------------------------------------------------------
  // CANCEL SPEECH RECOGNITION IMMEDIATELY
  // ---------------------------------------------------------

  public abortListening(): void {
    const session = this.activeSession;

    if (!session) {
      this.isListening = false;
      this.isStarting = false;
      this.startRequestPending = false;
      return;
    }

    console.info(
      "[Nodysom AI] Aborting recognition session.",
      { sessionId: session.id }
    );

    this.clearSessionWatchdog(session);

    /*
     * Invalidate callbacks from the session being cancelled.
     */
    this.sessionId += 1;
    this.activeSession = null;
    this.recognition = null;

    this.isListening = false;
    this.isStarting = false;
    this.startRequestPending = false;

    this.retireRecognition(session.recognition);

    try {
      session.handlers.onEnd();
    } catch (error) {
      console.error(
        "[Nodysom AI] Recognition cancellation callback failed:",
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

    const currentSpeechSessionId = this.speechSessionId;

    const utterance = new SpeechSynthesisUtterance(cleanText);

    utterance.lang = lang.trim() || "en-US";
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
