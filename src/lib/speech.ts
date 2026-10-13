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

  private isListening = false;

  private isSpeaking = false;

  // Tracks a recognition request while the browser initializes it.
  private isStarting = false;

  // Prevents duplicate start requests.
  private startRequestPending = false;

  // Stops recognition if stop is requested before onstart.
  private stopRequested = false;

  // Identifies the current recognition session.
  private sessionId = 0;

  // Handlers for the active recognition session.
  private activeHandlers: SpeechRecognitionHandlers | null = null;

  // Identifies the current TTS operation.
  private speechSessionId = 0;

  // Prevents a callback from being delivered more than once.
  private recognitionEndDelivered = false;

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
        "[Nodysom AI] Speech recognition API is unavailable in this browser."
      );
      return;
    }

    try {
      this.recognition = new SpeechRecognition();

      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isStarting = false;
        this.startRequestPending = false;

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

        if (!handlers || this.recognitionEndDelivered) {
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

          const transcript = result[0].transcript;

          if (result.isFinal) {
            finalTranscript += transcript;
          } else {
            interim += transcript;
          }
        }

        const text = finalTranscript || interim;

        if (text.trim()) {
          try {
            handlers.onResult(
              text.trim(),
              Boolean(finalTranscript)
            );
          } catch (error) {
            console.error(
              "[Nodysom AI] Speech result handler failed:",
              error
            );
          }
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

        // An intentional cancellation must not appear as
        // a new microphone failure.
        if (error === "aborted" && !handlers) {
          return;
        }

        // Some browsers report "no-speech" when the user
        // has not spoken yet. It is still a recognition error,
        // but it does not necessarily mean permission was denied.
        console.warn(
          "[Nodysom AI] Speech recognition error:",
          error
        );

        if (handlers && !this.recognitionEndDelivered) {
          try {
            handlers.onError(error);
          } catch (handlerError) {
            console.error(
              "[Nodysom AI] Speech error handler failed:",
              handlerError
            );
          }
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.isStarting = false;
        this.startRequestPending = false;
        this.stopRequested = false;

        const handlers = this.activeHandlers;

        this.activeHandlers = null;

        if (this.recognitionEndDelivered) {
          return;
        }

        this.recognitionEndDelivered = true;

        if (handlers) {
          try {
            handlers.onEnd();
          } catch (error) {
            console.error(
              "[Nodysom AI] Speech end handler failed:",
              error
            );
          }
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
        "Speech recognition is not supported in this browser or WebView. Check browser compatibility and microphone permissions."
      );

      handlers.onEnd();
      return;
    }

    if (
      this.isListening ||
      this.isStarting ||
      this.startRequestPending
    ) {
      console.warn(
        "[Nodysom AI] Ignored duplicate speech recognition start request."
      );
      return;
    }

    const recognition = this.recognition;

    this.sessionId += 1;
    this.activeHandlers = handlers;

    this.isListening = false;
    this.isStarting = true;
    this.startRequestPending = true;
    this.stopRequested = false;
    this.recognitionEndDelivered = false;

    try {
      recognition.lang = lang.trim() || "en-US";

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.start();

      // The browser may dispatch onstart asynchronously.
      // Keep isStarting true until that event arrives.
      this.startRequestPending = false;
    } catch (error: unknown) {
      this.isListening = false;
      this.isStarting = false;
      this.startRequestPending = false;
      this.stopRequested = false;
      this.activeHandlers = null;
      this.recognitionEndDelivered = true;

      const errorName =
        error instanceof Error ? error.name : "";

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not start microphone.";

      if (errorName === "InvalidStateError") {
        console.warn(
          "[Nodysom AI] Speech recognition is already active."
        );

        return;
      }

      console.warn(
        "[Nodysom AI] Could not start speech recognition:",
        error
      );

      try {
        handlers.onError(errorMessage);
      } finally {
        handlers.onEnd();
      }
    }
  }

  // ---------------------------------------------------------
  // STOP SPEECH RECOGNITION
  // ---------------------------------------------------------

  public stopListening(): void {
    const recognition = this.recognition;

    if (!recognition) {
      this.resetRecognitionState();
      return;
    }

    if (
      !this.isListening &&
      !this.isStarting &&
      !this.startRequestPending
    ) {
      return;
    }

    if (this.isStarting || this.startRequestPending) {
      this.stopRequested = true;
    }

    try {
      recognition.stop();
    } catch (error: unknown) {
      const errorName =
        error instanceof Error ? error.name : "";

      if (errorName === "InvalidStateError") {
        this.resetRecognitionState();
        return;
      }

      console.warn(
        "[Nodysom AI] Could not stop speech recognition:",
        error
      );
    }

    // Do not clear activeHandlers here. The browser can still
    // deliver a final result before its onend event.
    this.isListening = false;
  }

  // ---------------------------------------------------------
  // CANCEL SPEECH RECOGNITION IMMEDIATELY
  // ---------------------------------------------------------

  public abortListening(): void {
    const recognition = this.recognition;

    this.sessionId += 1;

    // Prevent results from an intentionally cancelled session
    // from being delivered to the UI.
    this.activeHandlers = null;
    this.resetRecognitionState();

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
  // RESET RECOGNITION STATE
  // ---------------------------------------------------------

  private resetRecognitionState(): void {
    this.isListening = false;
    this.isStarting = false;
    this.startRequestPending = false;
    this.stopRequested = false;
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

    // Cancel any previous utterance and invalidate its callbacks.
    this.stopSpeaking();

    const currentSpeechSessionId = this.speechSessionId;

    const utterance = new SpeechSynthesisUtterance(cleanText);

    utterance.lang = lang.trim() || "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    let callbackDelivered = false;

    const finish = () => {
      if (callbackDelivered) {
        return;
      }

      if (currentSpeechSessionId !== this.speechSessionId) {
        return;
      }

      callbackDelivered = true;
      this.isSpeaking = false;

      if (onDone) {
        onDone();
      }
    };

    utterance.onend = () => {
      finish();
    };

    utterance.onerror = (event) => {
      if (currentSpeechSessionId !== this.speechSessionId) {
        return;
      }

      this.isSpeaking = false;

      console.warn(
        "[Nodysom AI] Text-to-speech error:",
        event.error
      );

      finish();
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

      finish();
    }
  }

  // ---------------------------------------------------------
  // STOP TEXT-TO-SPEECH
  // ---------------------------------------------------------

  public stopSpeaking(): void {
    // Invalidate callbacks from previous speech operations.
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
