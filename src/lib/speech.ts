// Speech Recognition and Text-to-Speech audio integration for Nodysom AI
//
// Features preserved and improved:
// - Browser Speech Recognition and WebKit Speech Recognition support
// - Recognition permission and microphone diagnostics
// - Android WebView and browser compatibility diagnostics
// - Interim and final transcript results
// - Recognition session tracking and duplicate-start prevention
// - Recognition start, no-result, stop and error watchdogs
// - Safe recognition cleanup and retirement tracking
// - Detailed recognition error messages
// - Text-to-Speech with voice selection and language fallback
// - Speech cancellation and stale callback protection
// - Existing SpeechService public API and shared speechService export

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

type SpeechSynthesisVoiceLike = SpeechSynthesisVoice;

type SpeechDiagnostics = {
  isSecureContext: boolean;
  isAndroid: boolean;
  isLikelyAndroidWebView: boolean;
  isRecognitionSupported: boolean;
  isTextToSpeechSupported: boolean;
  isMicrophoneCaptureSupported: boolean;
  hasMediaDevices: boolean;
  hasSpeechSynthesis: boolean;
  userAgent: string;
  language: string;
};

const RECOGNITION_START_TIMEOUT_MS = 10000;
const RECOGNITION_NO_RESULT_TIMEOUT_MS = 15000;
const RECOGNITION_STOP_TIMEOUT_MS = 3000;
const RETIRING_RECOGNITION_TIMEOUT_MS = 5000;
const RECOGNITION_ERROR_CLEANUP_TIMEOUT_MS = 2000;

const SPEECH_TEXT_MAX_LENGTH = 300;
const SPEECH_SYNTHESIS_START_TIMEOUT_MS = 10000;

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
   * Retiring instances never permanently block new sessions.
   */
  private retiringRecognitions = new Set<SpeechRecognitionInstance>();

  private retirementTimers = new Map<
    SpeechRecognitionInstance,
    ReturnType<typeof setTimeout>
  >();

  private speechSessionId = 0;

  private speechStartTimer: ReturnType<typeof setTimeout> | null = null;

  private activeUtterance: SpeechSynthesisUtterance | null = null;

  private microphoneCheckInProgress = false;

  constructor() {
    this.detectRecognitionSupport();

    if (typeof window === "undefined") {
      return;
    }

    if (this.recognitionConstructor) {
      console.info(
        "[Nodysom AI] Speech Recognition API detected."
      );
    } else {
      console.warn(
        "[Nodysom AI] Speech Recognition API is unavailable in this environment."
      );
    }

    if (this.isTTSSupported()) {
      console.info(
        "[Nodysom AI] Text-to-Speech API detected."
      );
    } else {
      console.warn(
        "[Nodysom AI] Text-to-Speech API is unavailable in this environment."
      );
    }

    this.logEnvironmentDiagnostics();
  }

  // ---------------------------------------------------------
  // ENVIRONMENT AND FEATURE DETECTION
  // ---------------------------------------------------------

  private detectRecognitionSupport(): void {
    if (typeof window === "undefined") {
      this.recognitionConstructor = null;
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
  }

  private getUserAgent(): string {
    if (typeof navigator === "undefined") {
      return "";
    }

    return navigator.userAgent || "";
  }

  private isAndroidEnvironment(): boolean {
    return /Android/i.test(this.getUserAgent());
  }

  private isLikelyAndroidWebView(): boolean {
    const userAgent = this.getUserAgent();

    return (
      /Android/i.test(userAgent) &&
      (
        /\bwv\b/i.test(userAgent) ||
        /Version\/[\d.]+.*Chrome\/[\d.]+.*Mobile/i.test(userAgent)
      )
    );
  }

  private isSecureEnvironment(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    if (window.isSecureContext === true) {
      return true;
    }

    const protocol = window.location?.protocol || "";
    const hostname = window.location?.hostname || "";

    return (
      protocol === "https:" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  }

  private logEnvironmentDiagnostics(): void {
    const diagnostics = this.getDiagnostics();

    console.info(
      "[Nodysom AI] Speech environment diagnostics:",
      diagnostics
    );

    if (!diagnostics.isSecureContext) {
      console.warn(
        "[Nodysom AI] The current page is not in a secure context. Browser microphone access may be unavailable."
      );
    }

    if (
      diagnostics.isLikelyAndroidWebView &&
      !diagnostics.isRecognitionSupported
    ) {
      console.warn(
        "[Nodysom AI] Android WebView does not expose the Web Speech Recognition API. Microphone permission alone cannot add this API."
      );
    }
  }

  /**
   * Returns environment information for troubleshooting.
   * This is an additive API; existing callers do not need to change.
   */
  public getDiagnostics(): SpeechDiagnostics {
    const hasWindow = typeof window !== "undefined";
    const hasNavigator = typeof navigator !== "undefined";

    const mediaDevicesAvailable =
      hasNavigator &&
      typeof navigator.mediaDevices !== "undefined";

    const microphoneCaptureSupported =
      mediaDevicesAvailable &&
      typeof navigator.mediaDevices.getUserMedia === "function";

    return {
      isSecureContext: this.isSecureEnvironment(),
      isAndroid: this.isAndroidEnvironment(),
      isLikelyAndroidWebView: this.isLikelyAndroidWebView(),
      isRecognitionSupported:
        this.recognitionConstructor !== null,
      isTextToSpeechSupported: this.isTTSSupported(),
      isMicrophoneCaptureSupported:
        microphoneCaptureSupported,
      hasMediaDevices: mediaDevicesAvailable,
      hasSpeechSynthesis:
        hasWindow &&
        "speechSynthesis" in window,
      userAgent: this.getUserAgent(),
      language:
        hasNavigator
          ? navigator.language || "en-US"
          : "en-US"
    };
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

  private clearSessionWatchdog(session: RecognitionSession): void {
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
        remainingRetiringSessions:
          this.retiringRecognitions.size
      }
    );
  }

  private retireRecognition(
    recognition: SpeechRecognitionInstance
  ): void {
    this.retiringRecognitions.add(recognition);

    /*
     * Internal tracking is released after a timeout if the browser
     * does not dispatch onend. This does not guarantee that the
     * underlying browser speech service has stopped.
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

  private safelyCallOnEnd(
    session: RecognitionSession
  ): void {
    try {
      session.handlers.onEnd();
    } catch (error) {
      console.error(
        "[Nodysom AI] Recognition end callback failed:",
        error
      );
    }
  }

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
    this.safelyCallOnEnd(session);
  }

  private safelyNotifyError(
    handlers: SpeechRecognitionHandlers,
    error: string
  ): void {
    try {
      handlers.onError(error);
    } catch (handlerError) {
      console.error(
        "[Nodysom AI] Recognition error callback failed:",
        handlerError
      );
    }
  }

  private safelyNotifyEnd(
    handlers: SpeechRecognitionHandlers
  ): void {
    try {
      handlers.onEnd();
    } catch (handlerError) {
      console.error(
        "[Nodysom AI] Recognition end callback failed:",
        handlerError
      );
    }
  }

  // ---------------------------------------------------------
  // MICROPHONE PERMISSION DIAGNOSTICS
  // ---------------------------------------------------------

  /**
   * Checks whether microphone access is available in the current
   * environment. It does not keep the microphone open.
   *
   * This method is optional and additive. Existing callers can
   * continue using startListening() as before.
   *
   * IMPORTANT:
   * Browsers may require this to be called from a user gesture.
   * Android WebView additionally requires native application
   * permissions and a WebChromeClient permission handler.
   */
  public async checkMicrophonePermission(): Promise<{
    supported: boolean;
    granted: boolean | null;
    message: string;
  }> {
    if (typeof window === "undefined") {
      return {
        supported: false,
        granted: false,
        message:
          "Microphone access is unavailable because the browser window does not exist."
      };
    }

    if (!this.isSecureEnvironment()) {
      return {
        supported: false,
        granted: false,
        message:
          "Microphone access requires HTTPS or a supported local secure context. Open Nodysom AI using its HTTPS address."
      };
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      return {
        supported: false,
        granted: null,
        message:
          "This environment does not expose browser microphone capture. On the installed Android app, native WebView microphone permission handling may be required."
      };
    }

    if (this.microphoneCheckInProgress) {
      return {
        supported: true,
        granted: null,
        message:
          "A microphone permission check is already in progress."
      };
    }

    this.microphoneCheckInProgress = true;

    let stream: MediaStream | null = null;

    try {
      /*
       * getUserMedia triggers the browser's permission flow when
       * permission has not already been granted.
       */
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      return {
        supported: true,
        granted: true,
        message:
          "Microphone access is available. If voice recognition still fails, the browser speech-recognition service may be unavailable."
      };
    } catch (error: unknown) {
      const errorName =
        error instanceof Error
          ? error.name
          : "";

      console.warn(
        "[Nodysom AI] Microphone permission check failed:",
        {
          errorName,
          error
        }
      );

      if (
        errorName === "NotAllowedError" ||
        errorName === "PermissionDeniedError" ||
        errorName === "SecurityError"
      ) {
        return {
          supported: true,
          granted: false,
          message:
            "Microphone access was denied. Allow microphone permission for Nodysom AI in Android app settings or browser site settings, then try again."
        };
      }

      if (errorName === "NotFoundError") {
        return {
          supported: true,
          granted: false,
          message:
            "No available microphone was found. Check that the phone has a working microphone."
        };
      }

      if (errorName === "NotReadableError") {
        return {
          supported: true,
          granted: false,
          message:
            "The microphone could not be opened. Another app may be using it, or the device may have a microphone problem."
        };
      }

      if (errorName === "OverconstrainedError") {
        return {
          supported: true,
          granted: false,
          message:
            "The requested microphone configuration is not supported by this device."
        };
      }

      return {
        supported: true,
        granted: null,
        message:
          "The microphone permission check could not finish. Check app permissions and try again."
      };
    } finally {
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }

      this.microphoneCheckInProgress = false;
    }
  }

  // ---------------------------------------------------------
  // ERROR HANDLING
  // ---------------------------------------------------------

  private mapRecognitionError(error: string): string {
    const normalizedError = error.toLowerCase().trim();

    const diagnostics = this.getDiagnostics();

    const errorMessages: Record<string, string> = {
      "not-allowed":
        "Microphone or speech-recognition permission was denied. On Chrome, allow microphone access in the site's settings. On the installed Android app, allow microphone access in Android Settings → Apps → Nodysom AI → Permissions. If permission is already allowed, the WebView speech-recognition service may be unavailable.",

      "service-not-allowed":
        "The browser's speech-recognition service is blocked or unavailable. Check browser settings and internet access. On Android WebView, this API may not be available even when microphone permission is granted.",

      "audio-capture":
        "The microphone could not be opened. Check Android microphone permission, confirm the microphone is working, and close other apps that may be using it.",

      "network":
        "The speech-recognition service could not connect. Check your internet connection. Some browser speech-recognition services require a working network connection.",

      "no-speech":
        "No speech was detected. Tap the microphone, wait until listening starts, and then speak clearly.",

      "language-not-supported":
        "The selected speech-recognition language is not supported. Try en-US or another language supported by your browser.",

      "aborted":
        "Speech recognition was interrupted. Tap the microphone to try again.",

      "bad-grammar":
        "The browser could not process the speech-recognition grammar. Try again.",

      "phrases-not-supported":
        "The browser does not support the selected recognition phrases.",

      "microphone error":
        "The microphone could not complete speech recognition. Check microphone permission, device availability and browser compatibility.",

      "not supported":
        "Speech recognition is not supported in this environment. Try a supported version of Chrome. The installed Android app may require native speech-recognition integration.",

      "invalidstateerror":
        "The browser is still using a previous speech-recognition session. Wait a moment, then try again."
    };

    if (errorMessages[normalizedError]) {
      if (
        normalizedError === "not-allowed" &&
        diagnostics.isLikelyAndroidWebView
      ) {
        return (
          "Android app speech recognition was blocked. First allow Microphone permission in Android Settings → Apps → Nodysom AI → Permissions. If it is already allowed, this Android WebView may not provide the browser speech-recognition service; the app needs a supported native recognition implementation."
        );
      }

      return errorMessages[normalizedError];
    }

    if (
      /permissiondeniederror/i.test(error) ||
      /permission denied/i.test(error)
    ) {
      return (
        "Microphone permission was denied. Allow microphone access in Android app settings or browser site settings. If permission is already granted, the browser speech-recognition service may be blocked."
      );
    }

    if (/notallowederror/i.test(error)) {
      return (
        "Microphone permission was denied. Allow microphone access in Android app settings or browser site settings, then try again."
      );
    }

    if (/invalidstateerror/i.test(error)) {
      return (
        "The browser is still using a previous speech-recognition session. Wait a moment, then try again."
      );
    }

    if (
      diagnostics.isLikelyAndroidWebView &&
      !diagnostics.isRecognitionSupported
    ) {
      return (
        "Speech recognition is unavailable in this Android WebView. Microphone permission alone cannot add speech recognition support. The installed app needs a supported native recognition implementation."
      );
    }

    return (
      `Speech recognition failed (${error || "unknown error"}). Check microphone permission, internet access, selected language and browser compatibility, then try again.`
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

    this.safelyNotifyError(
      session.handlers,
      this.mapRecognitionError(error)
    );
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
  // SESSION WATCHDOGS
  // ---------------------------------------------------------

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

      this.clearSessionState(session);

      this.retireRecognition(session.recognition);

      this.safelyCallOnEnd(session);
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

      /*
       * Some browsers and Android WebViews report an error
       * without dispatching onend. Use a bounded cleanup timer.
       *
       * If onend arrives normally, finishSession() clears it.
       */
      session.watchdog = setTimeout(() => {
        if (!this.isSessionActive(session)) {
          return;
        }

        console.warn(
          "[Nodysom AI] Recognition error was not followed by onend. Forcing cleanup.",
          {
            sessionId: session.id,
            error
          }
        );

        this.clearSessionState(session);

        this.retireRecognition(session.recognition);

        this.safelyCallOnEnd(session);
      }, RECOGNITION_ERROR_CLEANUP_TIMEOUT_MS);
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
    this.detectRecognitionSupport();

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

  /**
   * Returns available system voices.
   * This method is additive and does not change the existing API.
   */
  public getAvailableVoices(): SpeechSynthesisVoiceLike[] {
    if (!this.isTTSSupported()) {
      return [];
    }

    try {
      return window.speechSynthesis.getVoices();
    } catch (error) {
      console.warn(
        "[Nodysom AI] Could not retrieve system speech voices:",
        error
      );

      return [];
    }
  }

  private findBestVoice(
    lang: string
  ): SpeechSynthesisVoiceLike | null {
    const voices = this.getAvailableVoices();

    if (voices.length === 0) {
      return null;
    }

    const requestedLanguage =
      (lang || "en-US").trim().toLowerCase();

    const exactMatch = voices.find(
      (voice) =>
        voice.lang.toLowerCase() === requestedLanguage
    );

    if (exactMatch) {
      return exactMatch;
    }

    const languagePrefix =
      requestedLanguage.split("-")[0];

    const languageMatch = voices.find(
      (voice) =>
        voice.lang.toLowerCase().split("-")[0] ===
        languagePrefix
    );

    if (languageMatch) {
      return languageMatch;
    }

    const englishVoice = voices.find(
      (voice) => voice.lang.toLowerCase().startsWith("en")
    );

    return englishVoice || null;
  }

  private clearSpeechStartTimer(): void {
    if (this.speechStartTimer !== null) {
      clearTimeout(this.speechStartTimer);
      this.speechStartTimer = null;
    }
  }

  // ---------------------------------------------------------
  // START SPEECH RECOGNITION
  // ---------------------------------------------------------

  public startListening(
    handlers: SpeechRecognitionHandlers,
    lang: string = "en-US"
  ): void {
    if (typeof window === "undefined") {
      this.safelyNotifyError(
        handlers,
        "Speech recognition is unavailable because the browser window does not exist."
      );

      this.safelyNotifyEnd(handlers);
      return;
    }

    this.detectRecognitionSupport();

    if (!this.recognitionConstructor) {
      const diagnostics = this.getDiagnostics();

      const message =
        diagnostics.isLikelyAndroidWebView
          ? "Speech recognition is unavailable in this Android WebView. Microphone permission alone cannot add speech recognition support. The installed app needs a supported native recognition implementation."
          : "Speech recognition is not supported in this browser. Use an up-to-date browser with Web Speech API support.";

      this.safelyNotifyError(handlers, message);
      this.safelyNotifyEnd(handlers);
      return;
    }

    if (!this.isSecureEnvironment()) {
      this.safelyNotifyError(
        handlers,
        "Speech recognition requires a secure HTTPS page or a supported local secure context. Open Nodysom AI using its HTTPS address."
      );

      this.safelyNotifyEnd(handlers);
      return;
    }

    /*
     * Prevent duplicate sessions that are actually active.
     * Retiring instances do not permanently block a new session.
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
          activeSession:
            this.activeSession?.id ?? null,
          retiringSessions:
            this.retiringRecognitions.size,
          isListening: this.isListening,
          isStarting: this.isStarting
        }
      );

      this.safelyNotifyError(
        handlers,
        "Speech recognition is already starting or listening. Wait a moment, then try again."
      );

      this.safelyNotifyEnd(handlers);
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

      this.safelyNotifyError(
        handlers,
        this.mapRecognitionError(message)
      );

      this.safelyNotifyEnd(handlers);
      return;
    }

    this.updatePublicState();

    console.info(
      "[Nodysom AI] Requesting speech recognition start.",
      {
        sessionId: session.id,
        language: session.recognition.lang,
        secureContext: this.isSecureEnvironment(),
        android: this.isAndroidEnvironment(),
        androidWebView: this.isLikelyAndroidWebView()
      }
    );

    try {
      /*
       * Keep start() synchronous with the user action. Browsers
       * may reject microphone or recognition requests if the call
       * is delayed until after an asynchronous permission check.
       */
      session.recognition.start();

      this.startWatchdog(
        session,
        RECOGNITION_START_TIMEOUT_MS,
        "The browser did not start speech recognition within 10 seconds. Check microphone permission, browser compatibility and the speech-recognition service."
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

        this.safelyNotifyError(
          handlers,
          "The browser is still using its speech-recognition service. Wait a moment, then tap the microphone again."
        );

        this.safelyNotifyEnd(handlers);
        return;
      }

      this.clearSessionState(session, true);

      this.safelyNotifyError(
        handlers,
        this.mapRecognitionError(
          errorName || errorMessage
        )
      );

      this.safelyNotifyEnd(handlers);
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
        this.safelyCallOnEnd(session);
        return;
      }

      this.clearSessionState(session);

      this.retireRecognition(session.recognition);
      this.safelyCallOnEnd(session);
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
      this.safelyCallOnEnd(session);
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
    this.safelyCallOnEnd(session);
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
      console.warn(
        "[Nodysom AI] Text-to-Speech is unavailable in this environment."
      );

      if (onDone) {
        onDone();
      }

      return;
    }

    /*
     * Remove common Markdown formatting and code fences without
     * stripping normal punctuation needed for natural speech.
     */
    const cleanText = text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[*_#`]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, SPEECH_TEXT_MAX_LENGTH);

    if (!cleanText) {
      if (onDone) {
        onDone();
      }

      return;
    }

    this.stopSpeaking();

    const currentSpeechSessionId = this.speechSessionId;

    const utterance =
      new SpeechSynthesisUtterance(cleanText);

    const requestedLanguage =
      typeof lang === "string" && lang.trim()
        ? lang.trim()
        : "en-US";

    utterance.lang = requestedLanguage;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    /*
     * Assign a system voice when one matching the requested
     * language is available. The browser's default voice remains
     * available when the voice list has not loaded yet.
     */
    const selectedVoice =
      this.findBestVoice(requestedLanguage);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    let completed = false;

    const finishSpeech = (
      reason: "ended" | "error" | "timeout"
    ): void => {
      if (completed) {
        return;
      }

      if (
        currentSpeechSessionId !== this.speechSessionId
      ) {
        return;
      }

      completed = true;

      this.clearSpeechStartTimer();
      this.isSpeaking = false;
      this.activeUtterance = null;

      if (reason !== "ended") {
        console.warn(
          "[Nodysom AI] Text-to-speech did not finish normally.",
          { reason }
        );
      }

      if (onDone) {
        try {
          onDone();
        } catch (error) {
          console.error(
            "[Nodysom AI] Text-to-speech completion callback failed:",
            error
          );
        }
      }
    };

    utterance.onstart = () => {
      if (
        currentSpeechSessionId !== this.speechSessionId
      ) {
        return;
      }

      this.clearSpeechStartTimer();
      this.isSpeaking = true;

      console.info(
        "[Nodysom AI] Text-to-speech started.",
        {
          language: utterance.lang,
          voice: utterance.voice?.name || "system default",
          textLength: cleanText.length
        }
      );
    };

    utterance.onend = () => {
      finishSpeech("ended");
    };

    utterance.onerror = (event) => {
      if (
        currentSpeechSessionId !== this.speechSessionId
      ) {
        return;
      }

      console.warn(
        "[Nodysom AI] Text-to-speech error:",
        event.error
      );

      finishSpeech("error");
    };

    this.isSpeaking = true;
    this.activeUtterance = utterance;

    /*
     * Some Android WebView implementations do not dispatch
     * speech events reliably. The timeout prevents the UI from
     * remaining in the speaking state forever if speech never
     * starts. It does not claim that audio was played.
     */
    this.speechStartTimer = setTimeout(() => {
      if (
        currentSpeechSessionId !== this.speechSessionId ||
        !this.isSpeaking
      ) {
        return;
      }

      console.warn(
        "[Nodysom AI] Text-to-speech start timeout reached."
      );

      try {
        window.speechSynthesis.cancel();
      } catch (error) {
        console.warn(
          "[Nodysom AI] Could not cancel stalled speech:",
          error
        );
      }

      finishSpeech("timeout");
    }, SPEECH_SYNTHESIS_START_TIMEOUT_MS);

    try {
      /*
       * Resume a paused synthesis engine before queuing speech.
       * This can help in some browser and Android implementations.
       */
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.speak(utterance);

      /*
       * Some browsers need a resume after speak() if the engine
       * unexpectedly reports itself as paused.
       */
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (error) {
      console.warn(
        "[Nodysom AI] Could not start text-to-speech:",
        error
      );

      finishSpeech("error");
    }
  }

  // ---------------------------------------------------------
  // STOP TEXT-TO-SPEECH
  // ---------------------------------------------------------

  public stopSpeaking(): void {
    this.speechSessionId += 1;

    this.clearSpeechStartTimer();

    if (!this.isTTSSupported()) {
      this.isSpeaking = false;
      this.activeUtterance = null;
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
    this.activeUtterance = null;
  }
}

// Shared service instance used by the existing application.
export const speechService = new SpeechService();
