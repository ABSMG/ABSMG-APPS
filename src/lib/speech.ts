// Speech Recognition and Text-to-Speech audio integration for LifeOS

export interface SpeechRecognitionHandlers {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
      }
    }
  }

  public isSpeechSupported(): boolean {
    return Boolean(this.recognition);
  }

  public isTTSSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public startListening(handlers: SpeechRecognitionHandlers, lang: string = 'en-US') {
    if (!this.recognition) {
      handlers.onError('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      this.recognition.lang = lang;
      this.recognition.onresult = (event: any) => {
        let interim = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = finalTranscript || interim;
        handlers.onResult(text, Boolean(finalTranscript));
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        handlers.onError(event.error || 'Microphone error');
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
        handlers.onEnd();
      };

      this.recognition.start();
      this.isListening = true;
    } catch (err: any) {
      handlers.onError(err?.message || 'Could not start microphone');
      this.isListening = false;
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error(e);
      }
      this.isListening = false;
    }
  }

  public speak(text: string, lang: string = 'en-US', onDone?: () => void) {
    if (!this.isTTSSupported()) return;

    this.stopSpeaking();

    // Clean markdown asterisks or code formatting for natural voice read
    const cleanText = text
      .replace(/[*_#`]/g, '')
      .replace(/\[.*?\]/g, '')
      .slice(0, 300); // Read concise summary

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      this.isSpeaking = false;
      if (onDone) onDone();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      if (onDone) onDone();
    };

    this.isSpeaking = true;
    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking() {
    if (this.isTTSSupported() && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }
}

export const speechService = new SpeechService();
