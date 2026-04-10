import { useState, useEffect, useCallback, useRef } from 'react';

export type VoiceField = 'milk';

interface UseVoiceEntryProps {
  onValueDetected: (value: number) => void;
  language?: 'hi' | 'gu' | 'en';
}

interface UseVoiceEntryReturn {
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  transcript: string;
  error: string | null;
  isSupported: boolean;
}

// Comprehensive number parsing optimized for milk quantities (0.1 - 99.9 range)
const parseSpokenNumber = (rawText: string): number | null => {
  let text = rawText.toLowerCase().trim();

  // Remove common noise words/fillers
  text = text
    .replace(/\b(the|a|is|it|of|to|do|he|hi|ok|huh|ha|hmm|uh|um|yeah|yes|हां|जी|और|and|लीटर|लिटर|liters?|litres?|દૂધ|दूध|milk|doodh|લીટર)\b/gi, '')
    .replace(/[,\s]+/g, ' ')
    .trim();

  if (!text) return null;

  // --- 1. Try direct numeric parse first (handles "6.5", "14", "0.8" etc.) ---
  const directNum = text.match(/(\d+\.?\d*)/);
  if (directNum) {
    const val = parseFloat(directNum[1]);
    if (!isNaN(val) && val >= 0 && val <= 999) return val;
  }

  // --- 2. Hindi number words ---
  const hindiMap: Record<string, number> = {
    'शून्य': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4,
    'पांच': 5, 'पाँच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'नो': 9,
    'दस': 10, 'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14,
    'पंद्रह': 15, 'सोलह': 16, 'सत्रह': 17, 'अठारह': 18, 'उन्नीस': 19,
    'बीस': 20, 'इक्कीस': 21, 'बाईस': 22, 'तेईस': 23, 'चौबीस': 24,
    'पच्चीस': 25, 'छब्बीस': 26, 'सत्ताईस': 27, 'अट्ठाईस': 28, 'उनतीस': 29,
    'तीस': 30, 'इकतीस': 31, 'बत्तीस': 32, 'तैंतीस': 33, 'चौंतीस': 34,
    'पैंतीस': 35, 'छत्तीस': 36, 'सैंतीस': 37, 'अड़तीस': 38, 'उनतालीस': 39,
    'चालीस': 40, 'इकतालीस': 41, 'बयालीस': 42, 'तैंतालीस': 43, 'चवालीस': 44,
    'पैंतालीस': 45, 'छियालीस': 46, 'सैंतालीस': 47, 'अड़तालीस': 48, 'उनचास': 49,
    'पचास': 50, 'इक्यावन': 51, 'बावन': 52, 'तिरपन': 53, 'चौवन': 54,
    'पचपन': 55, 'छप्पन': 56, 'सत्तावन': 57, 'अट्ठावन': 58, 'उनसठ': 59,
    'साठ': 60, 'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90,
    'सौ': 100,
    'डेढ़': 1.5, 'ढाई': 2.5, 'आधा': 0.5, 'पौना': 0.75,
  };

  // Gujarati number words
  const gujaratiMap: Record<string, number> = {
    'શૂન્ય': 0, 'એક': 1, 'બે': 2, 'ત્રણ': 3, 'ચાર': 4,
    'પાંચ': 5, 'છ': 6, 'સાત': 7, 'આઠ': 8, 'નવ': 9,
    'દસ': 10, 'અગિયાર': 11, 'બાર': 12, 'તેર': 13, 'ચૌદ': 14,
    'પંદર': 15, 'સોળ': 16, 'સત્તર': 17, 'અઢાર': 18, 'ઓગણીસ': 19,
    'વીસ': 20, 'ત્રીસ': 30, 'ચાલીસ': 40, 'પચાસ': 50,
    'સાઠ': 60, 'સીત્તેર': 70, 'એંશી': 80, 'નેવું': 90, 'સો': 100,
  };

  // English number words
  const englishMap: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'for': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
    'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
    'hundred': 100, 'half': 0.5, 'quarter': 0.25,
  };

  const allWords = { ...hindiMap, ...gujaratiMap, ...englishMap };

  // --- 3. Handle "साढ़े X" (X + 0.5) pattern ---
  if (text.includes('साढ़े')) {
    const rest = text.replace('साढ़े', '').trim();
    const base = parseSpokenNumber(rest);
    if (base !== null) return base + 0.5;
  }

  // --- 4. Handle "सवा X" (X * 1.25) pattern ---
  if (text.includes('सवा')) {
    const rest = text.replace('सवा', '').trim();
    const base = parseSpokenNumber(rest);
    if (base !== null) return base + 0.25;
  }

  // --- 5. Handle decimal spoken as "X point Y" / "X पॉइंट Y" ---
  const pointPattern = /(.+?)\s*(?:point|पॉइंट|पोइंट|दशमलव|डॉट|dot|\.)\s*(.+)/i;
  const pointMatch = text.match(pointPattern);
  if (pointMatch) {
    const intPart = lookupWord(pointMatch[1].trim(), allWords);
    const decPart = lookupWord(pointMatch[2].trim(), allWords);
    if (intPart !== null && decPart !== null) {
      // "6 point 5" = 6.5, "14 point 8" = 14.8
      // If decPart is a single digit (0-9), treat as tenths
      if (decPart >= 0 && decPart <= 9) {
        return intPart + decPart / 10;
      }
      // "6 point 45" = 6.45
      const decStr = decPart.toString();
      return intPart + decPart / Math.pow(10, decStr.length);
    }
  }

  // --- 6. Direct word lookup ---
  const wordVal = lookupWord(text, allWords);
  if (wordVal !== null) return wordVal;

  // --- 7. Handle compound like "twenty one" / "बीस एक" ---
  const words = text.split(/\s+/);
  if (words.length >= 2) {
    // Try combining first and second word
    const first = lookupWord(words[0], allWords);
    const second = lookupWord(words[1], allWords);
    if (first !== null && second !== null) {
      // "twenty one" = 21, but "six five" should be 6.5
      if (first >= 20 && first % 10 === 0 && second >= 1 && second <= 9) {
        return first + second;
      }
      // Likely "X Y" meaning X.Y for milk quantities
      if (first >= 1 && first <= 99 && second >= 0 && second <= 9) {
        return first + second / 10;
      }
    }
  }

  return null;
};

// Look up a single token - try numeric first, then word dictionary
const lookupWord = (token: string, dict: Record<string, number>): number | null => {
  const t = token.trim();
  const num = parseFloat(t);
  if (!isNaN(num) && num >= 0) return num;
  for (const [word, val] of Object.entries(dict)) {
    if (t === word || t.includes(word)) return val;
  }
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSpeechRecognition = (): (new () => any) | null => {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

export const useVoiceEntry = ({
  onValueDetected,
  language = 'hi',
}: UseVoiceEntryProps): UseVoiceEntryReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isListeningRef = useRef(false);
  // Debounce: track last applied value+time to avoid duplicates
  const lastAppliedRef = useRef<{ value: number; ts: number }>({ value: -1, ts: 0 });

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  useEffect(() => {
    setIsSupported(!!getSpeechRecognition());
  }, []);

  const applyValue = useCallback((value: number) => {
    // Deduplicate rapid same-value detections (within 1s)
    const now = Date.now();
    if (lastAppliedRef.current.value === value && now - lastAppliedRef.current.ts < 1000) return;
    lastAppliedRef.current = { value, ts: now };

    onValueDetected(value);

    // Beep feedback
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.value = 0.12;
      osc.start();
      osc.stop(audioCtx.currentTime + 0.07);
    } catch { /* silent */ }
  }, [onValueDetected]);

  const initRecognition = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return null;

    const recognition = new SpeechRecognitionClass();
    const langMap: Record<string, string> = { hi: 'hi-IN', gu: 'gu-IN', en: 'en-IN' };
    recognition.lang = langMap[language] || 'hi-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => { setIsListening(true); setError(null); };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal) {
          // Try all alternatives, pick best number
          let bestValue: number | null = null;

          for (let alt = 0; alt < result.length; alt++) {
            const txt = result[alt].transcript;
            const parsed = parseSpokenNumber(txt);
            if (parsed !== null && parsed > 0) {
              bestValue = parsed;
              setTranscript(txt);
              break; // first valid match from alternatives
            }
          }

          if (bestValue !== null) {
            applyValue(bestValue);
          } else {
            // Show what was heard even if we couldn't parse
            setTranscript(result[0]?.transcript || '');
          }
        } else {
          interimText += result[0].transcript;
        }
      }

      if (interimText) setTranscript(interimText);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      if (isListeningRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (!isListeningRef.current) return;
          try {
            const fresh = initRecognition();
            if (fresh) {
              recognitionRef.current = fresh;
              fresh.start();
            }
          } catch (e) {
            console.error('Failed to restart recognition:', e);
            setIsListening(false);
          }
        }, 400);
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [language, applyValue]);

  const startListening = useCallback(() => {
    if (!isSupported) { setError('Voice recognition not supported'); return; }
    recognitionRef.current = initRecognition();
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); setIsListening(true); }
      catch { setError('Failed to start voice recognition'); }
    }
  }, [isSupported, initRecognition]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    if (restartTimeoutRef.current) { clearTimeout(restartTimeoutRef.current); restartTimeoutRef.current = null; }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setTranscript('');
    setError(null);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening(); else startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    };
  }, []);

  return { isListening, startListening, stopListening, toggleListening, transcript, error, isSupported };
};
