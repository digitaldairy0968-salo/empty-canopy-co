import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceSettings {
  milkEnabled: boolean;
  fatEnabled: boolean;
  snfEnabled: boolean;
  lrEnabled: boolean;
}

export type VoiceField = 'milk' | 'fat' | 'snf' | 'lr';

interface UseVoiceEntryProps {
  settings: VoiceSettings;
  onValueDetected: (field: VoiceField, value: number) => void;
  onFieldChange: (field: VoiceField) => void;
  language?: 'hi' | 'gu' | 'en';
}

interface UseVoiceEntryReturn {
  isListening: boolean;
  currentField: VoiceField;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  setCurrentField: (field: VoiceField) => void;
  transcript: string;
  error: string | null;
  isSupported: boolean;
}

// Field keywords in different languages - ORDER MATTERS: check specific fields first, milk last
const fieldKeywordsOrdered: Array<{ field: VoiceField; keywords: string[] }> = [
  // Check fat first (most common after milk)
  { field: 'fat', keywords: ['fat', 'fact', 'fate', 'फैट', 'फेट', 'ફેટ', 'वसा', 'ચરબી', 'faat', 'phat'] },
  // Check snf
  { field: 'snf', keywords: ['snf', 'एसएनएफ', 'एस एन एफ', 'એસએનએફ', 's n f', 'es en ef'] },
  // Check lr/clr
  { field: 'lr', keywords: ['lr', 'एलआर', 'एल आर', 'એલઆર', 'clr', 'सीएलआर', 'l r', 'el ar', 'सी एल आर'] },
  // Check milk/liter LAST (default if no specific field detected)
  { field: 'milk', keywords: ['liter', 'litre', 'liters', 'litres', 'लीटर', 'लिटर', 'લીટર', 'દૂધ', 'दूध', 'milk', 'doodh'] },
];

// Normalize common misrecognitions to improve both field detection and what we show on-screen.
// Example: Hindi “fat” is often transcribed as “फीट”.
const normalizeSpeechText = (text: string): string => {
  return text
    // Hindi common mishears
    .replace(/फीट/g, 'फेट')
    .replace(/फिट/g, 'फेट')
    // English common mishears
    .replace(/\bfeet\b/gi, 'fat')
    .replace(/\bfit\b/gi, 'fat')
    .replace(/\bfact\b/gi, 'fat')
    .replace(/\bfate\b/gi, 'fat');
};

// Detect which field the user is referring to
const detectField = (text: string): VoiceField | null => {
  const lowerText = normalizeSpeechText(text).toLowerCase().trim();
  
  // Check each field's keywords in priority order
  for (const { field, keywords } of fieldKeywordsOrdered) {
    for (const keyword of keywords) {
      // Use word boundary matching for better accuracy
      const keywordLower = keyword.toLowerCase();
      // Check if keyword exists as a word (not part of another word)
      const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b|${keywordLower}`, 'i');
      if (regex.test(lowerText) || lowerText.includes(keywordLower)) {
        return field;
      }
    }
  }
  return null;
};

// Parse spoken numbers including Hindi/Gujarati numerals
const parseSpokenNumber = (text: string): number | null => {
  let cleanText = normalizeSpeechText(text).toLowerCase().trim();
  
  // Hindi number words - comprehensive
  const hindiNumbers: Record<string, number> = {
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
    'पचास': 50, 'साठ': 60, 'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90,
    'सौ': 100, 'डेढ़': 1.5, 'ढाई': 2.5, 'साढ़े': 0,
    'आधा': 0.5, 'पौना': 0.75, 'सवा': 1.25,
  };
  
  // Gujarati number words
  const gujaratiNumbers: Record<string, number> = {
    'શૂન્ય': 0, 'એક': 1, 'બે': 2, 'ત્રણ': 3, 'ચાર': 4,
    'પાંચ': 5, 'છ': 6, 'સાત': 7, 'આઠ': 8, 'નવ': 9,
    'દસ': 10, 'અગિયાર': 11, 'બાર': 12, 'તેર': 13, 'ચૌદ': 14,
    'પંદર': 15, 'સોળ': 16, 'સત્તર': 17, 'અઢાર': 18, 'ઓગણીસ': 19,
    'વીસ': 20, 'ત્રીસ': 30, 'ચાલીસ': 40, 'પચાસ': 50, 'સાઠ': 60, 'સીત્તેર': 70, 'એંશી': 80, 'નેવું': 90,
    'સો': 100,
  };
  
  // English number words
  const englishNumbers: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
    'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
    'hundred': 100, 'half': 0.5, 'quarter': 0.25,
  };
  
  const allNumbers = { ...hindiNumbers, ...gujaratiNumbers, ...englishNumbers };
  
  // Check "साढ़े" modifier first
  if (cleanText.includes('साढ़े')) {
    const baseText = cleanText.replace('साढ़े', '').trim();
    const parsed = parseSpokenNumber(baseText);
    if (parsed !== null) return parsed + 0.5;
  }

  // Check "सवा" modifier (1.25x)
  if (cleanText.includes('सवा')) {
    const baseText = cleanText.replace('सवा', '').trim();
    const parsed = parseSpokenNumber(baseText);
    if (parsed !== null) return parsed * 1.25;
  }
  
  for (const [word, num] of Object.entries(allNumbers)) {
    if (cleanText.includes(word) && num !== 0) {
      return num;
    }
  }
  
  // Remove field keywords to extract number
  cleanText = cleanText
    .replace(/लीटर|लिटर|liters?|litres?/gi, '')
    .replace(/फैट|फेट|fat/gi, '')
    .replace(/snf|एसएनएफ/gi, '')
    .replace(/lr|एलआर|clr|सीएलआर/gi, '')
    // Normalize spoken decimal patterns
    .replace(/(\d)\s*(point|पॉइंट|दशमलव|पोइंट|डॉट|dot)\s*(\d)/gi, '$1.$3')
    .replace(/point|पॉइंट|दशमलव|पोइंट|डॉट|dot/gi, '.')
    .replace(/और|and|एंड/gi, '')
    // Remove noise words
    .replace(/\b(the|a|is|it|of|to|do|he|hi|ok|huh|ha|hmm|uh|um|yeah|yes|हां|जी)\b/gi, '')
    .replace(/[,\s]+/g, ' ')
    .trim();
  
  // Try to extract decimal numbers (e.g. "6.4", "10.5")
  const decimalMatch = cleanText.match(/(\d+\.?\d*)/);
  if (decimalMatch) {
    const parsed = parseFloat(decimalMatch[1]);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  
  return null;
};

// Parse spoken text and return both field and value
const parseSpokenEntry = (text: string): { field: VoiceField | null; value: number | null } => {
  const detectedField = detectField(text);
  const value = parseSpokenNumber(text);
  return { field: detectedField, value };
};

// Get speech recognition constructor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSpeechRecognition = (): (new () => any) | null => {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

export const useVoiceEntry = ({
  settings,
  onValueDetected,
  onFieldChange,
  language = 'hi',
}: UseVoiceEntryProps): UseVoiceEntryReturn => {
  const [isListening, setIsListening] = useState(false);
  const [currentField, setCurrentField] = useState<VoiceField>('milk');
  const currentFieldRef = useRef<VoiceField>('milk');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    currentFieldRef.current = currentField;
  }, [currentField]);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);

  // When speech recognition returns a value-only final result (e.g. "6.5"),
  // we still want to apply it to the intended field (e.g. user said "6.5 fat").
  // We keep a short-lived hint of the most recently mentioned field keyword
  // from interim/final transcripts.
  const lastExplicitFieldRef = useRef<{ field: VoiceField | null; ts: number }>({
    field: null,
    ts: 0,
  });
  const FIELD_HINT_TTL_MS = 5000;

  // If recognition sends the number and the field keyword as separate results
  // (e.g. first "4" then "fat"), we buffer the number briefly to avoid
  // incorrectly applying it to the currently focused field (often milk).
  const pendingValueRef = useRef<{ value: number; ts: number } | null>(null);
  const pendingApplyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PENDING_VALUE_TTL_MS = 2000;
  const PENDING_APPLY_DELAY_MS = 650;

  // Keep ref in sync with state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Check browser support
  useEffect(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    setIsSupported(!!SpeechRecognitionClass);
  }, []);

  // Get enabled fields in order
  const getEnabledFields = useCallback((): VoiceField[] => {
    const fields: VoiceField[] = [];
    if (settings.milkEnabled) fields.push('milk');
    if (settings.fatEnabled) fields.push('fat');
    if (settings.snfEnabled) fields.push('snf');
    if (settings.lrEnabled) fields.push('lr');
    return fields;
  }, [settings]);

  const clearPendingValue = useCallback(() => {
    pendingValueRef.current = null;
    if (pendingApplyTimeoutRef.current) {
      clearTimeout(pendingApplyTimeoutRef.current);
      pendingApplyTimeoutRef.current = null;
    }
  }, []);

  // Audio feedback: beep + TTS confirmation
  const playConfirmationFeedback = useCallback((field: VoiceField, value: number) => {
    try {
      // Short beep using AudioContext
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.15;
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.08);
      
      // TTS confirmation after beep
      setTimeout(() => {
        if ('speechSynthesis' in window) {
          const fieldNames: Record<string, Record<VoiceField, string>> = {
            hi: { milk: 'लीटर', fat: 'फैट', snf: 'एसएनएफ', lr: 'एलआर' },
            gu: { milk: 'લીટર', fat: 'ફેટ', snf: 'એસએનએફ', lr: 'એલઆર' },
            en: { milk: 'liters', fat: 'fat', snf: 'SNF', lr: 'LR' },
          };
          const fieldName = fieldNames[language]?.[field] || field;
          const utterance = new SpeechSynthesisUtterance(`${value} ${fieldName}`);
          utterance.lang = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-IN';
          utterance.rate = 1.3;
          utterance.volume = 0.7;
          window.speechSynthesis.speak(utterance);
        }
      }, 150);
    } catch {
      // Silently fail if audio is not available
    }
  }, [language]);

  const applyValueToField = useCallback(
    (field: VoiceField, value: number) => {
      const enabledFields = getEnabledFields();
      if (!enabledFields.includes(field)) return;

      onValueDetected(field, value);
      playConfirmationFeedback(field, value);

      if (field !== currentFieldRef.current) {
        setCurrentField(field);
        onFieldChange(field);
      }
    },
    [getEnabledFields, onFieldChange, onValueDetected, playConfirmationFeedback]
  );

  const setPendingValue = useCallback(
    (value: number) => {
      pendingValueRef.current = { value, ts: Date.now() };

      if (pendingApplyTimeoutRef.current) {
        clearTimeout(pendingApplyTimeoutRef.current);
      }

      pendingApplyTimeoutRef.current = setTimeout(() => {
        const pending = pendingValueRef.current;
        if (!pending) return;

        if (Date.now() - pending.ts > PENDING_VALUE_TTL_MS) {
          clearPendingValue();
          return;
        }

        // No field keyword arrived in time → fallback to current field
        applyValueToField(currentFieldRef.current, pending.value);
        clearPendingValue();
      }, PENDING_APPLY_DELAY_MS);
    },
    [applyValueToField, clearPendingValue]
  );

  // Initialize speech recognition
  const initRecognition = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      setError('Voice recognition not supported');
      return null;
    }

    const recognition = new SpeechRecognitionClass();
    
    // Set language based on app language - optimized for best recognition
    const langMap = {
      hi: 'hi-IN',
      gu: 'gu-IN',
      en: 'en-IN',
    };
    recognition.lang = langMap[language];
    recognition.continuous = true;
    recognition.interimResults = true;
    // Maximum alternatives for better accuracy
    recognition.maxAlternatives = 5;
    
    // Additional settings for improved recognition (if supported)
    try {
      // @ts-ignore - Some browsers support these properties
      if ('grammars' in recognition) {
        // Create grammar for numbers and field keywords
        const SpeechGrammarList = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;
        if (SpeechGrammarList) {
          const grammar = '#JSGF V1.0; grammar numbers; public <number> = zero | one | two | three | four | five | six | seven | eight | nine | ten | eleven | twelve | thirteen | fourteen | fifteen | sixteen | seventeen | eighteen | nineteen | twenty | thirty | forty | fifty | sixty | seventy | eighty | ninety | hundred | liter | litre | fat | snf | lr ;';
          const speechRecognitionList = new SpeechGrammarList();
          speechRecognitionList.addFromString(grammar, 1);
          recognition.grammars = speechRecognitionList;
        }
      }
    } catch (e) {
      // Grammar not supported, continue without it
    }

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      let bestResult: { field: VoiceField | null; value: number | null } = { field: null, value: null };

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        
        if (result.isFinal) {
          // Check ALL alternatives and STRONGLY prefer the ones that include a field keyword.
          // This prevents cases like saying "6.5 fat" but the engine returning a higher-confidence
          // alternative like "6.5" (no field), which would incorrectly overwrite the current field.
          let bestWithField: { field: VoiceField; value: number; transcript: string; confidence: number } | null = null;
          let bestWithValue: { field: VoiceField | null; value: number; transcript: string; confidence: number } | null = null;

          for (let altIndex = 0; altIndex < result.length; altIndex++) {
            const alternative = result[altIndex];
            const transcriptText = alternative.transcript;
            const confidence = alternative.confidence || 0;

            const parsed = parseSpokenEntry(transcriptText);

            // Even if there's no number yet, remember the explicit field keyword.
            // Some recognizers emit "fat" and "4" as separate results.
            if (parsed.field) {
              lastExplicitFieldRef.current = { field: parsed.field, ts: Date.now() };

              // If we already captured a pending number moments ago, apply it now.
              const pending = pendingValueRef.current;
              if (pending && Date.now() - pending.ts <= PENDING_VALUE_TTL_MS) {
                clearPendingValue();
                applyValueToField(parsed.field, pending.value);
              }
            }

            if (parsed.value === null) continue;

            // Track best value-only (fallback)
            if (!bestWithValue || confidence > bestWithValue.confidence) {
              bestWithValue = {
                field: parsed.field,
                value: parsed.value,
                transcript: transcriptText,
                confidence,
              };
            }

            // Track best value+field (preferred)
            if (parsed.field !== null) {
              if (!bestWithField || confidence > bestWithField.confidence) {
                bestWithField = {
                  field: parsed.field,
                  value: parsed.value,
                  transcript: transcriptText,
                  confidence,
                };
              }
            }
          }

          const chosen = bestWithField || bestWithValue;
          if (chosen) {
            bestResult = { field: chosen.field, value: chosen.value };
            finalTranscript = chosen.transcript;

            // Refresh hint when we confidently see an explicit field keyword.
            if (chosen.field) {
              lastExplicitFieldRef.current = { field: chosen.field, ts: Date.now() };
            }
          }
          
          // Fallback to first alternative if no value found
          if (bestResult.value === null && result[0]) {
            finalTranscript = result[0].transcript;
            bestResult = parseSpokenEntry(finalTranscript);
          }
        } else {
          // For interim results, just use the first alternative
          const interimText = result[0].transcript;
          interimTranscript += interimText;

          // Update the hint from interim speech (common case: "6.5 fat" becomes
          // interim "6.5 fat" but final sometimes collapses to just "6.5").
          const hintedField = detectField(interimText);
          if (hintedField) {
            lastExplicitFieldRef.current = { field: hintedField, ts: Date.now() };

            // If we already captured a number but didn't know the field yet,
            // apply it as soon as we hear a field keyword.
            const pending = pendingValueRef.current;
            if (pending && Date.now() - pending.ts <= PENDING_VALUE_TTL_MS) {
              clearPendingValue();
              applyValueToField(hintedField, pending.value);
            }
          }
        }
      }

      setTranscript(normalizeSpeechText(interimTranscript || finalTranscript));

      // Process final transcript with best result
      if (finalTranscript && bestResult.value !== null) {
        const now = Date.now();
        const hint = lastExplicitFieldRef.current;
        const hintedField = hint.field && now - hint.ts <= FIELD_HINT_TTL_MS ? hint.field : null;

        // If we have ONLY a number and no recent field keyword, buffer briefly.
        // This prevents overwriting milk when user is actually saying fat.
        if (!bestResult.field && !hintedField) {
          setPendingValue(bestResult.value);
          return;
        }

        clearPendingValue();
        const targetField: VoiceField = bestResult.field || hintedField || currentFieldRef.current;
        applyValueToField(targetField, bestResult.value);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Error: ${event.error}`);
      }
      
      // Don't auto-restart on errors - let onend handle it
      // This prevents rapid restart loops
    };

    recognition.onend = () => {
      // Clear any pending restart
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      
      // Auto-restart if still supposed to be listening
      if (isListeningRef.current) {
        // Use longer delay to prevent rapid restart loops
        restartTimeoutRef.current = setTimeout(() => {
          if (isListeningRef.current) {
            try {
              // Create fresh recognition instance to avoid stale state
              const SpeechRecognitionClass = getSpeechRecognition();
              if (SpeechRecognitionClass) {
                const newRecognition = new SpeechRecognitionClass();
                const langMap: Record<string, string> = { hi: 'hi-IN', gu: 'gu-IN', en: 'en-IN' };
                newRecognition.lang = langMap[language] || 'hi-IN';
                newRecognition.continuous = true;
                newRecognition.interimResults = true;
                newRecognition.maxAlternatives = 5;
                
                // Copy event handlers
                newRecognition.onstart = recognition.onstart;
                newRecognition.onresult = recognition.onresult;
                newRecognition.onerror = recognition.onerror;
                newRecognition.onend = recognition.onend;
                
                recognitionRef.current = newRecognition;
                newRecognition.start();
              }
            } catch (e) {
              console.error('Failed to restart recognition:', e);
              setIsListening(false);
            }
          }
        }, 500); // Longer delay prevents hanging
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [language, currentField, applyValueToField, clearPendingValue, setPendingValue]);

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Voice recognition not supported in this browser');
      return;
    }

    // Initialize first enabled field
    const enabledFields = getEnabledFields();
    if (enabledFields.length === 0) {
      setError('No voice fields enabled');
      return;
    }

    setCurrentField(enabledFields[0]);
    onFieldChange(enabledFields[0]);

    recognitionRef.current = initRecognition();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        setError('Failed to start voice recognition');
      }
    }
  }, [isSupported, getEnabledFields, initRecognition, onFieldChange]);

  // Stop listening
  const stopListening = useCallback(() => {
    // Set state first to prevent restart loops
    isListeningRef.current = false;
    setIsListening(false);
    
    // Clear any pending restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    // Stop and cleanup recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null; // Prevent onend from restarting
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors during stop
      }
      recognitionRef.current = null;
    }
    
    setTranscript('');
    setError(null);

    clearPendingValue();
  }, [clearPendingValue]);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      clearPendingValue();
    };
  }, [clearPendingValue]);

  // Update recognition language when language changes
  useEffect(() => {
    if (recognitionRef.current && isListening) {
      const langMap = {
        hi: 'hi-IN',
        gu: 'gu-IN',
        en: 'en-IN',
      };
      recognitionRef.current.lang = langMap[language];
    }
  }, [language, isListening]);

  return {
    isListening,
    currentField,
    startListening,
    stopListening,
    toggleListening,
    setCurrentField,
    transcript,
    error,
    isSupported,
  };
};

// Default voice settings
export const defaultVoiceSettings = {
  milkEnabled: true,
  fatEnabled: true,
  snfEnabled: false,
  lrEnabled: false,
};

// Get voice settings from localStorage
export const getVoiceSettings = () => {
  const saved = localStorage.getItem('voiceSettings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return defaultVoiceSettings;
    }
  }
  return defaultVoiceSettings;
};

// Save voice settings to localStorage
export const saveVoiceSettings = (settings: typeof defaultVoiceSettings) => {
  localStorage.setItem('voiceSettings', JSON.stringify(settings));
};
