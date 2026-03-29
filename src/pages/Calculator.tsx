import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const Calculator: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [hasResult, setHasResult] = useState(false);

  const handleNumber = (num: string) => {
    if (hasResult) {
      setDisplay(num);
      setEquation('');
      setHasResult(false);
    } else if (display === '0' && num !== '.') {
      setDisplay(num);
    } else if (num === '.' && display.includes('.')) {
      return;
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
    setHasResult(false);
  };

  const handleEqual = () => {
    try {
      const fullEquation = equation + display;
      // Replace × and ÷ with * and /
      const evalEquation = fullEquation.replace(/×/g, '*').replace(/÷/g, '/');
      const result = new Function('return ' + evalEquation)();
      setDisplay(String(parseFloat(result.toFixed(4))));
      setEquation('');
      setHasResult(true);
    } catch {
      setDisplay('Error');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setHasResult(false);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const buttons = [
    ['C', '⌫', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];

  const getButtonStyle = (btn: string) => {
    if (btn === 'C') return 'bg-destructive/10 text-destructive hover:bg-destructive/20';
    if (btn === '⌫') return 'bg-muted text-muted-foreground hover:bg-muted/80';
    if (['÷', '×', '-', '+', '='].includes(btn)) return 'bg-primary text-primary-foreground hover:bg-primary/90';
    return 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="dairy-header px-4 py-4">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold">{t('calculator')}</h1>
        </div>
      </header>

      <main className="px-4 py-6 max-w-md mx-auto">
        {/* Display */}
        <div className="dairy-card mb-6 animate-fade-in">
          <div className="text-right">
            {equation && (
              <p className="text-sm text-muted-foreground mb-1">{equation}</p>
            )}
            <p className="text-4xl font-bold truncate">{display}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="grid gap-3 animate-slide-up">
          {buttons.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-4 gap-3">
              {row.map(btn => (
                <Button
                  key={btn}
                  variant="ghost"
                  className={`h-16 text-2xl font-semibold rounded-2xl ${getButtonStyle(btn)} ${
                    btn === '0' ? 'col-span-2' : ''
                  }`}
                  onClick={() => {
                    if (btn === 'C') handleClear();
                    else if (btn === '⌫') handleBackspace();
                    else if (btn === '=') handleEqual();
                    else if (['÷', '×', '-', '+'].includes(btn)) handleOperator(btn);
                    else handleNumber(btn);
                  }}
                >
                  {btn}
                </Button>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Calculator;
