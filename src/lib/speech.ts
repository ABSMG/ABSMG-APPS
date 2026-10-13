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
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

class SpeechService {
  private recognition: SpeechRecognitionInstance | null = null;

  private isListening: boolean = false;

  private isSpeaking: boolean = false;

  // Tracks whether start() has been called and the browser has
  // not yet confirmed that the recognition session has ended.
  private isStarting: boolean = false;

  // Prevents overlapping start() requests.
  private startRequestPending: boolean = false;

  // Tracks a requested stop while the browser is starting.
  private stopRequested: boolean = false;

  // Protects the active session from stale browser events.
  private sessionId: number = 0;

  // Handlers belonging to the active recognition session.
  private activeHandlers: SpeechRecognitionHandlers | null = null;

  // Tracks the current text-to-speech operation.
  private speechSessionId: number = 0;

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

    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();

        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
          this.isStarting = false;

          if (this.stopRequested) {
            this.stopRequested = false;
            this.stopListening();
            return;
          }

          this.isListening = true;
        };

        this.recognition.onresult = (
          event: SpeechRecognitionResultEvent
        ) => {
          const handlers = this.activeHandlers;

          if (!handlers) {
            return;
          }

          let interim = "";
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

            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            } else {
              interim += result[0].transcript;
            }
          }

          const text =
            finalTranscript || interim;

          if (text) {
            handlers.onResult(
              text,
              Boolean(finalTranscript)
            );
          }
        };

        this.recognition.onerror = (
          event: SpeechRecognitionErrorEvent
        ) => {
          const handlers = this.activeHandlers;

          this.isListening = false;
          this.isStarting = false;
          this.startRequestPending = false;
          this.stopRequested = false;

          const error =
            event.error ||
            event.message ||
            "Microphone error";

          // An intentional stop may generate an "aborted"
          // event in some browsers. Do not report it as a
          // new microphone failure.
          if (
            error === "aborted" &&
            !handlers
          ) {
            return;
          }

          console.warn(
            "[Nodysom AI] Speech recognition error:",
            error
          );

          if (handlers) {
            handlers.onError(error);
          }
        };

        this.recognition.onend = () => {
          const handlers = this.activeHandlers;

          this.isListening = false;
          this.isStarting = false;
          this.startRequestPending = false;
          this.stopRequested = false;

          this.activeHandlers = null;

          if (handlers) {
            handlers.onEnd();
          }
        };
      } catch (error) {
        console.warn(
          "[Nodysom AI] Speech recognition initialization failed:",
          error
        );

        this.recognition = null;
      }
    }
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
    if (!this.recognition) {
      handlers.onError(
        "Speech recognition is not supported in this browser."
      );

      handlers.onEnd();
      return;
    }

    // Do not call recognition.start() a second time while
    // a previous start request or recognition session exists.
    if (
      this.isListening ||
      this.isStarting ||
      this.startRequestPending
    ) {
      return;
    }

    const recognition = this.recognition;

    this.sessionId += 1;

    const currentSessionId =
      this.sessionId;

    this.activeHandlers = handlers;

    this.stopRequested = false;
    this.startRequestPending = true;
    this.isStarting = true;
    this.isListening = false;

    try {
      recognition.lang =
        lang.trim() || "en-US";

      // Browser event handlers were installed in the
      // constructor, so we only initiate the session here.
      recognition.start();

      this.startRequestPending = false;
    } catch (error: unknown) {
      this.startRequestPending = false;
      this.isStarting = false;
      this.isListening = false;

      // InvalidStateError normally means the browser
      // already has a recognition session running.
      // Do not repeatedly call start() or create a retry loop.
      const errorName =
        error instanceof Error
          ? error.name
          : "";

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not start microphone";

      if (errorName === "InvalidStateError") {
        console.warn(
          "[Nodysom AI] Speech recognition is already active."
        );

        // Keep the current handlers if the existing session
        // is still active. Otherwise release this request.
        if (
          !this.isListening &&
          this.sessionId === currentSessionId
        ) {
          this.activeHandlers = null;
        }

        return;
      }

      this.activeHandlers = null;

      console.warn(
        "[Nodysom AI] Could not start speech recognition:",
        error
      );

      handlers.onError(errorMessage);
      handlers.onEnd();
    }
  }

  // ---------------------------------------------------------
  // STOP SPEECH RECOGNITION
  // ---------------------------------------------------------

  public stopListening(): void {
    const recognition = this.recognition;

    if (!recognition) {
      this.isListening = false;
      this.isStarting = false;
      this.startRequestPending = false;
      this.stopRequested = false;
      this.activeHandlers = null;
      return;
    }

    // Nothing is running or starting.
    if (
      !this.isListening &&
      !this.isStarting &&
      !this.startRequestPending
    ) {
      return;
    }

    // If start() was requested but onstart has not fired,
    // remember the stop request and stop when possible.
    if (
      this.isStarting ||
      this.startRequestPending
    ) {
      this.stopRequested = true;
    }

    try {
      recognition.stop();
    } catch (error: unknown) {
      const errorName =
        error instanceof Error
          ? error.name
          : "";

      // InvalidStateError means there is no active session
      // to stop. Reset state instead of leaving the UI stuck.
      if (errorName === "InvalidStateError") {
        this.isListening = false;
        this.isStarting = false;
        this.startRequestPending = false;
        this.stopRequested = false;
        this.activeHandlers = null;
        return;
      }

      console.warn(
        "[Nodysom AI] Could not stop speech recognition:",
        error
      );
    }

    this.isListening = false;
  }

  // ---------------------------------------------------------
  // CANCEL SPEECH RECOGNITION IMMEDIATELY
  // ---------------------------------------------------------

  public abortListening(): void {
    const recognition = this.recognition;

    this.sessionId += 1;

    this.activeHandlers = null;
    this.isListening = false;
    this.isStarting = false;
    this.startRequestPending = false;
    this.stopRequested = false;

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
      new SpeechSynthesisUtterance(
        cleanText
      );

    utterance.lang =
      lang.trim() || "en-US";

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (
        currentSpeechSessionId !==
        this.speechSessionId
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
        currentSpeechSessionId !==
        this.speechSessionId
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
      window.speechSynthesis.speak(
        utterance
      );
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
