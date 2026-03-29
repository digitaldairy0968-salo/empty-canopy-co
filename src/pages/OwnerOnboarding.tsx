import React, { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Printer, Scale, Calculator, Check, Grid3X3, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import MilkmanAnimation from '@/components/MilkmanAnimation';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OwnerOnboardingProps {
  onComplete: () => void;
  onBack: () => void;
}

// Simple rate chart generation for preview
const generateSimpleRateChart = (baseFatRate: number, baseSNF: number, snfDeduction: number) => {
  const fatValues = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0];
  const snfValues = [9.0, 9.1, 9.2, 9.3, 9.4, 9.5];
  
  const cells: Array<Array<{ fat: number; snf: number; rate: number }>> = [];
  
  for (const fat of fatValues) {
    const row: Array<{ fat: number; snf: number; rate: number }> = [];
    for (const snf of snfValues) {
      const snfDiff = (baseSNF - snf) / 0.1;
      const adjustedFatRate = baseFatRate - (snfDiff * snfDeduction);
      const ratePerLiter = fat * adjustedFatRate;
      row.push({ fat, snf, rate: ratePerLiter });
    }
    cells.push(row);
  }
  
  return { fatValues, snfValues, cells };
};

const OwnerOnboarding: React.FC<OwnerOnboardingProps> = ({ onComplete, onBack }) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [usesPrinter, setUsesPrinter] = useState<boolean | null>(null);
  const [milkBuyingBasis, setMilkBuyingBasis] = useState<'fat' | 'fat_snf' | null>(null);
  const [calculationSystem, setCalculationSystem] = useState<'avg_fat' | 'daily_total' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // FAT/SNF Chart settings
  const [showChartSetup, setShowChartSetup] = useState(false);
  const [baseFatRate, setBaseFatRate] = useState('8');
  const [baseSNF, setBaseSNF] = useState('9.5');
  const [snfDeduction, setSnfDeduction] = useState('0.2');
  const [fatMin, setFatMin] = useState('5.0');
  const [fatMax, setFatMax] = useState('9.0');
  const [fatStep, setFatStep] = useState('0.5');
  const [snfMin, setSnfMin] = useState('9.0');
  const [snfMax, setSnfMax] = useState('9.5');
  const [showChart, setShowChart] = useState(false);

  // Generate rate chart preview
  const rateChart = useMemo(() => {
    return generateSimpleRateChart(
      parseFloat(baseFatRate) || 8,
      parseFloat(baseSNF) || 9.5,
      parseFloat(snfDeduction) || 0.2
    );
  }, [baseFatRate, baseSNF, snfDeduction]);

  const handleNext = async () => {
    if (step === 1 && usesPrinter === null) {
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'कृपया एक विकल्प चुनें' : 'Please select an option',
        variant: 'destructive',
      });
      return;
    }
    if (step === 2 && milkBuyingBasis === null) {
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'कृपया एक विकल्प चुनें' : 'Please select an option',
        variant: 'destructive',
      });
      return;
    }
    if (step === 3 && calculationSystem === null) {
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'कृपया एक विकल्प चुनें' : 'Please select an option',
        variant: 'destructive',
      });
      return;
    }

    if (step < 3) {
      setStep(step + 1);
    } else {
      // Save settings to localStorage (will be saved to DB after dairy is created)
      await saveSettingsToLocalStorage();
    }
  };

  const handleSkip = () => {
    // Set defaults and skip
    if (step === 1) {
      setUsesPrinter(false);
      setStep(2);
    } else if (step === 2) {
      setMilkBuyingBasis('fat');
      setStep(3);
    } else if (step === 3) {
      setCalculationSystem('avg_fat');
      saveSettingsToLocalStorage();
    }
  };

  const saveSettingsToLocalStorage = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage - will be saved to DB after dairy is created
      const settings = {
        usesPrinter: usesPrinter ?? false,
        milkBuyingBasis: milkBuyingBasis ?? 'fat',
        calculationSystem: calculationSystem ?? 'avg_fat',
      };
      localStorage.setItem('pending_owner_settings', JSON.stringify(settings));

      // If FAT+SNF selected, save chart settings
      if (milkBuyingBasis === 'fat_snf') {
        const chartSettings = {
          baseFatRate: parseFloat(baseFatRate) || 8,
          baseSNF: parseFloat(baseSNF) || 9.5,
          snfDeductionPerPoint: parseFloat(snfDeduction) || 0.2,
          fatMin: parseFloat(fatMin) || 5.0,
          fatMax: parseFloat(fatMax) || 9.0,
          fatStep: parseFloat(fatStep) || 0.5,
          snfMin: parseFloat(snfMin) || 9.0,
          snfMax: parseFloat(snfMax) || 9.5,
          isEnabled: true,
        };
        localStorage.setItem('pending_fat_snf_settings', JSON.stringify(chartSettings));
      }
      
      localStorage.setItem('owner_onboarding_completed', 'true');
      
      toast({
        title: language === 'hi' ? 'सफल' : 'Success',
        description: language === 'hi' ? 'सेटिंग्स सेव हो गई' : 'Settings saved',
      });
      
      onComplete();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'सेव नहीं हो पाया' : 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="dairy-header py-6 px-4 text-center relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={step > 1 ? () => setStep(step - 1) : onBack}
          className="absolute left-4 top-4 text-primary-foreground hover:bg-primary-foreground/20"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold">
          {language === 'hi' ? 'डेयरी सेटअप' : 'Dairy Setup'}
        </h1>
        <p className="text-primary-foreground/80 mt-1 text-sm">
          {language === 'hi' ? `चरण ${step} / 3` : `Step ${step} / 3`}
        </p>
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-3">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={cn(
                "w-3 h-3 rounded-full transition-all",
                s === step ? "bg-primary-foreground scale-110" : s < step ? "bg-primary-foreground/80" : "bg-primary-foreground/30"
              )}
            />
          ))}
        </div>
      </div>

      {/* Milkman Animation */}
      <div className="py-4">
        <MilkmanAnimation />
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 -mt-2 overflow-auto">
        <div className="dairy-card max-w-md mx-auto animate-slide-up">
          {/* Step 1: Printer Usage */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Printer className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">
                  {language === 'hi' ? 'क्या आप प्रिंटर का उपयोग करते हैं?' : 'Do you use a printer?'}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {language === 'hi' ? 'रसीद प्रिंट करने के लिए' : 'For printing receipts'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setUsesPrinter(true)}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all text-center",
                    usesPrinter === true
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <Check className={cn("h-8 w-8 mx-auto mb-2", usesPrinter === true ? "text-primary" : "text-muted-foreground")} />
                  <p className="font-bold text-lg">{language === 'hi' ? 'हाँ' : 'Yes'}</p>
                </button>
                <button
                  onClick={() => setUsesPrinter(false)}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all text-center",
                    usesPrinter === false
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <span className="text-3xl mb-2 block">❌</span>
                  <p className="font-bold text-lg">{language === 'hi' ? 'नहीं' : 'No'}</p>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Milk Buying Basis */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Scale className="h-8 w-8 text-accent" />
                </div>
                <h2 className="text-xl font-bold mb-2">
                  {language === 'hi' ? 'आप दूध किस आधार पर खरीदेंगे?' : 'On what basis will you buy milk?'}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {language === 'hi' ? 'रेट कैलकुलेशन का तरीका' : 'Rate calculation method'}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setMilkBuyingBasis('fat');
                    setShowChartSetup(false);
                  }}
                  className={cn(
                    "w-full p-5 rounded-2xl border-2 transition-all text-left",
                    milkBuyingBasis === 'fat'
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg">
                        {language === 'hi' ? 'सिर्फ फैट (FAT)' : 'Only FAT'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {language === 'hi' ? 'रेट = दूध × फैट × प्रति फैट रेट' : 'Rate = Milk × FAT × Rate per FAT'}
                      </p>
                    </div>
                    {milkBuyingBasis === 'fat' && <Check className="h-6 w-6 text-primary" />}
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMilkBuyingBasis('fat_snf');
                    setShowChartSetup(true);
                  }}
                  className={cn(
                    "w-full p-5 rounded-2xl border-2 transition-all text-left",
                    milkBuyingBasis === 'fat_snf'
                      ? "border-accent bg-accent/10 shadow-md"
                      : "border-border hover:border-accent/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg">
                        {language === 'hi' ? 'फैट + SNF' : 'FAT + SNF'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {language === 'hi' ? 'SNF के हिसाब से फैट रेट बदलता है' : 'FAT rate varies based on SNF'}
                      </p>
                      <p className="text-xs text-accent mt-2 bg-accent/10 px-2 py-1 rounded-lg inline-block">
                        {language === 'hi' ? '📊 रेट चार्ट बनेगा' : '📊 Rate chart will be created'}
                      </p>
                    </div>
                    {milkBuyingBasis === 'fat_snf' && <Check className="h-6 w-6 text-accent" />}
                  </div>
                </button>
              </div>

              {/* FAT/SNF Chart Setup - shown when fat_snf is selected */}
              {showChartSetup && milkBuyingBasis === 'fat_snf' && (
                <div className="mt-6 p-4 border-2 border-accent/30 rounded-2xl bg-accent/5 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Grid3X3 className="h-5 w-5 text-accent" />
                    <h3 className="font-bold">
                      {language === 'hi' ? 'रेट चार्ट सेटिंग्स' : 'Rate Chart Settings'}
                    </h3>
                  </div>

                  {/* Base FAT Rate */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      {language === 'hi' ? 'बेस फैट रेट (₹)' : 'Base FAT Rate (₹)'}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={baseFatRate}
                        onChange={e => setBaseFatRate(e.target.value)}
                        className="pl-8"
                        placeholder="8"
                      />
                    </div>
                  </div>

                  {/* Base SNF */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      {language === 'hi' ? 'बेस SNF' : 'Base SNF'}
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={baseSNF}
                      onChange={e => setBaseSNF(e.target.value)}
                      placeholder="9.5"
                    />
                  </div>

                  {/* SNF Deduction */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      {language === 'hi' ? 'SNF कटौती प्रति 0.1' : 'SNF Deduction per 0.1'}
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={snfDeduction}
                      onChange={e => setSnfDeduction(e.target.value)}
                      placeholder="0.2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {language === 'hi' 
                        ? 'हर 0.1 SNF गिरने पर फैट रेट में कमी'
                        : 'Reduction in FAT rate for every 0.1 decrease'}
                    </p>
                  </div>

                  {/* FAT Range */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      {language === 'hi' ? 'FAT रेंज' : 'FAT Range'}
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Min</p>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          value={fatMin}
                          onChange={e => setFatMin(e.target.value)}
                          placeholder="5.0"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Max</p>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          value={fatMax}
                          onChange={e => setFatMax(e.target.value)}
                          placeholder="9.0"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Step</p>
                        <Select value={fatStep} onValueChange={setFatStep}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.1">0.1</SelectItem>
                            <SelectItem value="0.5">0.5</SelectItem>
                            <SelectItem value="1.0">1.0</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* SNF Range */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      {language === 'hi' ? 'SNF रेंज' : 'SNF Range'}
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Min</p>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={snfMin}
                          onChange={e => setSnfMin(e.target.value)}
                          placeholder="9.0"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Max</p>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={snfMax}
                          onChange={e => setSnfMax(e.target.value)}
                          placeholder="9.5"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Chart Preview Toggle */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowChart(!showChart)}
                  >
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    {showChart 
                      ? (language === 'hi' ? 'चार्ट छुपाएं' : 'Hide Chart')
                      : (language === 'hi' ? 'चार्ट देखें' : 'View Chart')}
                  </Button>

                  {/* Chart Preview */}
                  {showChart && (
                    <div className="overflow-hidden rounded-xl border">
                      <ScrollArea className="w-full">
                        <div className="min-w-max">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr>
                                <th className="border border-border bg-muted p-2 text-center font-bold">
                                  FAT \ SNF
                                </th>
                                {rateChart.snfValues.map(snf => (
                                  <th key={snf} className="border border-border bg-muted p-2 text-center font-semibold min-w-[50px]">
                                    {snf.toFixed(1)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rateChart.cells.map((row, fatIndex) => (
                                <tr key={rateChart.fatValues[fatIndex]}>
                                  <td className="border border-border bg-muted p-2 text-center font-semibold">
                                    {rateChart.fatValues[fatIndex].toFixed(1)}
                                  </td>
                                  {row.map((cell, snfIndex) => (
                                    <td 
                                      key={`${cell.fat}-${cell.snf}`} 
                                      className={cn(
                                        "border border-border p-2 text-center",
                                        snfIndex === row.length - 1 && "bg-primary/5"
                                      )}
                                    >
                                      {cell.rate.toFixed(1)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Calculation System */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calculator className="h-8 w-8 text-foreground" />
                </div>
                <h2 className="text-xl font-bold mb-2">
                  {language === 'hi' ? 'हिसाब-किताब का तरीका' : 'Calculation Method'}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {language === 'hi' ? 'भुगतान कैलकुलेशन कैसे होगी?' : 'How will payment be calculated?'}
                </p>
              </div>

              <div className="space-y-3">
                {/* Avg FAT System */}
                <button
                  onClick={() => setCalculationSystem('avg_fat')}
                  className={cn(
                    "w-full p-5 rounded-2xl border-2 transition-all text-left",
                    calculationSystem === 'avg_fat'
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-lg">
                      {language === 'hi' ? 'एवरेज फैट सिस्टम' : 'Average FAT System'}
                    </p>
                    {calculationSystem === 'avg_fat' && <Check className="h-6 w-6 text-primary" />}
                  </div>
                  <div className="bg-muted/50 p-3 rounded-xl text-sm">
                    <p className="text-muted-foreground mb-2">
                      {language === 'hi' ? '📌 उदाहरण:' : '📌 Example:'}
                    </p>
                    <p className="font-mono text-xs">
                      {language === 'hi' 
                        ? 'कुल दूध: 100L | एवग फैट: 6.5 | रेट: ₹8'
                        : 'Total Milk: 100L | Avg FAT: 6.5 | Rate: ₹8'}
                    </p>
                    <p className="font-bold text-primary mt-1">
                      = 100 × 6.5 × 8 = ₹5,200
                    </p>
                  </div>
                </button>

                {/* Daily Total System */}
                <button
                  onClick={() => setCalculationSystem('daily_total')}
                  className={cn(
                    "w-full p-5 rounded-2xl border-2 transition-all text-left",
                    calculationSystem === 'daily_total'
                      ? "border-accent bg-accent/10 shadow-md"
                      : "border-border hover:border-accent/40"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-lg">
                      {language === 'hi' ? 'रोज़ का जोड़ सिस्टम' : 'Daily Total System'}
                    </p>
                    {calculationSystem === 'daily_total' && <Check className="h-6 w-6 text-accent" />}
                  </div>
                  <div className="bg-muted/50 p-3 rounded-xl text-sm">
                    <p className="text-muted-foreground mb-2">
                      {language === 'hi' ? '📌 उदाहरण:' : '📌 Example:'}
                    </p>
                    <p className="font-mono text-xs">
                      {language === 'hi' 
                        ? 'दिन 1: 10L×6.5×8=₹520 | दिन 2: 12L×6.8×8=₹653'
                        : 'Day1: 10L×6.5×8=₹520 | Day2: 12L×6.8×8=₹653'}
                    </p>
                    <p className="font-bold text-accent mt-1">
                      = ₹520 + ₹653 = ₹1,173
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            {/* Skip Button */}
            <Button
              variant="outline"
              className="flex-1 h-14"
              onClick={handleSkip}
              disabled={isSaving}
            >
              <SkipForward className="mr-2 h-4 w-4" />
              {language === 'hi' ? 'छोड़ें' : 'Skip'}
            </Button>

            {/* Next/Complete Button */}
            <Button
              variant="dairy"
              className="flex-[2] h-14 text-lg"
              onClick={handleNext}
              disabled={isSaving}
            >
              {isSaving ? '...' : step === 3 
                ? (language === 'hi' ? 'पूरा करें' : 'Complete') 
                : (language === 'hi' ? 'आगे बढ़ें' : 'Next')} 
              {!isSaving && <ArrowRight className="ml-2 h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerOnboarding;