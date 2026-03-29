import React, { useState } from 'react';
import { ArrowLeft, Percent, DollarSign, Milk, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import MilkmanAnimation from '@/components/MilkmanAnimation';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface RateSetupProps {
  onComplete: (rates: { fatRate: number; literRate: number }) => void;
  onBack: () => void;
}

const RateSetup: React.FC<RateSetupProps> = ({ onComplete, onBack }) => {
  const { language } = useLanguage();
  const { toast } = useToast();

  const [fatRate, setFatRate] = useState('8');
  const [literRate, setLiterRate] = useState('50');
  const [importing, setImporting] = useState(false);

  const handleImportChart = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: language === 'hi' ? 'त्रुटि' : 'Error', description: language === 'hi' ? 'कृपया इमेज फाइल चुनें' : 'Please select an image file', variant: 'destructive' });
      return;
    }
    setImporting(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => { resolve((reader.result as string).split(',')[1]); };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;
      const { data, error } = await supabase.functions.invoke('parse-rate-chart', {
        body: { imageBase64: base64Data, mimeType: file.type },
      });
      if (error) throw error;
      if (data?.settings?.baseFatRate) {
        setFatRate(data.settings.baseFatRate.toString());
        toast({ title: language === 'hi' ? 'सफल' : 'Success', description: language === 'hi' ? 'चार्ट से फैट रेट पढ़ा गया। कृपया वेरीफाई करें' : 'FAT rate imported. Please verify' });
      } else {
        toast({ title: language === 'hi' ? 'त्रुटि' : 'Error', description: language === 'hi' ? 'चार्ट पढ़ने में विफल' : 'Failed to read chart', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Import error:', err);
      toast({ title: language === 'hi' ? 'त्रुटि' : 'Error', description: language === 'hi' ? 'चार्ट इम्पोर्ट विफल' : 'Chart import failed', variant: 'destructive' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const fatRateNum = parseFloat(fatRate) || 8;
    const literRateNum = parseFloat(literRate) || 50;
    
    if (fatRateNum <= 0) {
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'कृपया सही फैट रेट दर्ज करें' : 'Please enter a valid fat rate',
        variant: 'destructive',
      });
      return;
    }
    
    if (literRateNum <= 0) {
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'कृपया सही लीटर रेट दर्ज करें' : 'Please enter a valid liter rate',
        variant: 'destructive',
      });
      return;
    }

    // Save to localStorage for later use when creating dairy
    localStorage.setItem('initial_fat_rate', fatRateNum.toString());
    localStorage.setItem('initial_liter_rate', literRateNum.toString());
    
    onComplete({ fatRate: fatRateNum, literRate: literRateNum });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="dairy-header py-6 px-4 text-center relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="absolute left-4 top-4 text-primary-foreground hover:bg-primary-foreground/20"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold">
          {language === 'hi' ? 'रेट सेटिंग्स' : language === 'gu' ? 'રેટ સેટિંગ્સ' : 'Rate Settings'}
        </h1>
        <p className="text-primary-foreground/80 mt-1 text-sm">
          {language === 'hi' ? 'अपना दूध रेट सेट करें' : language === 'gu' ? 'તમારો દૂધ રેટ સેટ કરો' : 'Set your milk rates'}
        </p>
      </div>

      {/* Milkman Animation */}
      <div className="py-4">
        <MilkmanAnimation />
      </div>

      {/* Form */}
      <div className="flex-1 px-4 py-4 -mt-2">
        <div className="dairy-card max-w-md mx-auto animate-slide-up">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Fat Rate - For Suppliers */}
            <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Percent className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm">
                    {language === 'hi' ? 'प्रति फैट रेट (₹)' : language === 'gu' ? 'ફેટ દીઠ રેટ (₹)' : 'Rate per Fat (₹)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'hi' ? 'सप्लायर के लिए' : language === 'gu' ? 'સપ્લાયર માટે' : 'For Suppliers'}
                  </p>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">₹</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={fatRate}
                  onChange={e => setFatRate(e.target.value)}
                  className="dairy-input pl-10 text-xl font-bold text-center h-14"
                  placeholder="8"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                {language === 'hi' 
                  ? `उदा: फैट 6.5 × दूध 10L × ₹${fatRate || 8} = ₹${(6.5 * 10 * (parseFloat(fatRate) || 8)).toFixed(0)}`
                  : `Ex: Fat 6.5 × Milk 10L × ₹${fatRate || 8} = ₹${(6.5 * 10 * (parseFloat(fatRate) || 8)).toFixed(0)}`
                }
              </p>
            </div>

            {/* Liter Rate - For Buyers */}
            <div className="p-4 rounded-xl border-2 border-accent/30 bg-accent/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-accent/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-bold text-sm">
                    {language === 'hi' ? 'प्रति लीटर रेट (₹)' : language === 'gu' ? 'લિટર દીઠ રેટ (₹)' : 'Rate per Liter (₹)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'hi' ? 'खरीदार के लिए' : language === 'gu' ? 'ખરીદનાર માટે' : 'For Buyers'}
                  </p>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">₹</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={literRate}
                  onChange={e => setLiterRate(e.target.value)}
                  className="dairy-input pl-10 text-xl font-bold text-center h-14"
                  placeholder="50"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
                {language === 'hi' 
                  ? `उदा: दूध 10L × ₹${literRate || 50} = ₹${(10 * (parseFloat(literRate) || 50)).toFixed(0)}`
                  : `Ex: Milk 10L × ₹${literRate || 50} = ₹${(10 * (parseFloat(literRate) || 50)).toFixed(0)}`
                }
              </p>
            </div>

            <div className="flex gap-3">
              {/* Skip Button */}
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-14"
                onClick={() => {
                  localStorage.setItem('initial_fat_rate', '8');
                  localStorage.setItem('initial_liter_rate', '50');
                  onComplete({ fatRate: 8, literRate: 50 });
                }}
              >
                {language === 'hi' ? 'छोड़ें' : 'Skip'}
              </Button>

              {/* Continue Button */}
              <Button
                type="submit"
                variant="dairy"
                className="flex-[2] h-14 text-lg"
              >
                {language === 'hi' ? 'आगे बढ़ें' : language === 'gu' ? 'આગળ વધો' : 'Continue'} →
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RateSetup;
