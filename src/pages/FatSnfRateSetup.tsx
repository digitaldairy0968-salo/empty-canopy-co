import React, { useState, useMemo } from 'react';
import { ArrowLeft, Save, Grid3X3, Calculator, AlertTriangle, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useFatSnfRateSettings } from '@/hooks/useFatSnfRateSettings';
import { generateRateChart, FatSnfRateSettings, calculateFatSnfEntry } from '@/utils/fatSnfCalculation';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';


const FatSnfRateSetup: React.FC = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { settings: savedSettings, saving, saveSettings } = useFatSnfRateSettings();

  // Local state for form
  const [baseFatRate, setBaseFatRate] = useState(savedSettings.baseFatRate.toString());
  const [baseSNF, setBaseSNF] = useState(savedSettings.baseSNF.toString());
  const [snfDeduction, setSnfDeduction] = useState(savedSettings.snfDeductionPerPoint.toString());
  const [fatMin, setFatMin] = useState(savedSettings.fatMin.toString());
  const [fatMax, setFatMax] = useState(savedSettings.fatMax.toString());
  const [fatStep, setFatStep] = useState(savedSettings.fatStep === 0.5 ? '0.1' : savedSettings.fatStep.toString());
  const [snfMin, setSnfMin] = useState(savedSettings.snfMin.toString());
  const [snfMax, setSnfMax] = useState(savedSettings.snfMax.toString());
  const [showChart, setShowChart] = useState(false);
  const [importing, setImporting] = useState(false);

  // Test calculation state
  const [testMilk, setTestMilk] = useState('10');
  const [testFat, setTestFat] = useState('7');
  const [testSnf, setTestSnf] = useState('9.4');

  // Current settings from form
  const currentSettings: FatSnfRateSettings = useMemo(() => ({
    isEnabled: true,
    baseFatRate: parseFloat(baseFatRate) || 8,
    baseSNF: parseFloat(baseSNF) || 9.5,
    snfDeductionPerPoint: parseFloat(snfDeduction) || 0.2,
    fatMin: parseFloat(fatMin) || 5.0,
    fatMax: parseFloat(fatMax) || 9.0,
    fatStep: parseFloat(fatStep) || 0.5,
    snfMin: parseFloat(snfMin) || 9.0,
    snfMax: parseFloat(snfMax) || 9.5,
  }), [baseFatRate, baseSNF, snfDeduction, fatMin, fatMax, fatStep, snfMin, snfMax]);

  // Generate rate chart
  const rateChart = useMemo(() => {
    return generateRateChart(currentSettings);
  }, [currentSettings]);

  // Test calculation
  const testResult = useMemo(() => {
    const milk = parseFloat(testMilk) || 0;
    const fat = parseFloat(testFat) || 0;
    const snf = parseFloat(testSnf) || 0;
    
    if (milk <= 0 || fat <= 0 || snf <= 0) return null;
    
    return calculateFatSnfEntry(currentSettings, milk, fat, snf);
  }, [currentSettings, testMilk, testFat, testSnf]);

  const handleSave = async () => {
    const success = await saveSettings(currentSettings);
    if (success) {
      toast({
        title: language === 'hi' ? 'सफल' : 'Success',
        description: language === 'hi' ? 'रेट चार्ट सेव हो गया' : 'Rate chart saved',
      });
      navigate('/settings');
    } else {
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'सेव करने में त्रुटि' : 'Failed to save',
        variant: 'destructive',
      });
    }
  };

  const handleImportChart = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only accept images
    if (!file.type.startsWith('image/')) {
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'कृपया इमेज फाइल चुनें' : 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const { data, error } = await supabase.functions.invoke('parse-rate-chart', {
        body: { imageBase64: base64Data, mimeType: file.type },
      });

      if (error) throw error;

      if (data?.settings) {
        const s = data.settings;
        if (s.baseFatRate) setBaseFatRate(s.baseFatRate.toString());
        if (s.baseSNF) setBaseSNF(s.baseSNF.toString());
        if (s.snfDeductionPerPoint) setSnfDeduction(s.snfDeductionPerPoint.toString());
        if (s.fatMin) setFatMin(s.fatMin.toString());
        if (s.fatMax) setFatMax(s.fatMax.toString());
        if (s.fatStep) setFatStep(s.fatStep.toString());
        if (s.snfMin) setSnfMin(s.snfMin.toString());
        if (s.snfMax) setSnfMax(s.snfMax.toString());

        toast({
          title: language === 'hi' ? 'सफल' : 'Success',
          description: language === 'hi' ? 'चार्ट से डेटा इम्पोर्ट हो गया। कृपया वेरीफाई करें' : 'Data imported from chart. Please verify',
        });
      } else {
        toast({
          title: language === 'hi' ? 'त्रुटि' : 'Error',
          description: language === 'hi' ? 'चार्ट पढ़ने में विफल' : 'Failed to read chart',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Import error:', err);
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'चार्ट इम्पोर्ट विफल' : 'Chart import failed',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      // Reset input
      e.target.value = '';
    }
  };

  const t = {
    title: language === 'hi' ? 'FAT / SNF रेट चार्ट' : 'FAT / SNF Rate Chart',
    subtitle: language === 'hi' ? 'रेट चार्ट कॉन्फ़िगर करें' : 'Configure rate chart',
    baseFatRate: language === 'hi' ? 'बेस फैट रेट (₹)' : 'Base FAT Rate (₹)',
    baseFatRateHint: language === 'hi' ? 'प्रति 1 फैट पर रेट' : 'Rate per 1 FAT',
    baseSNF: language === 'hi' ? 'बेस SNF' : 'Base SNF',
    baseSNFHint: language === 'hi' ? 'जिस पर पूरा फैट रेट लागू हो' : 'SNF at which full FAT rate applies',
    snfDeduction: language === 'hi' ? 'SNF कटौती प्रति 0.1' : 'SNF Deduction per 0.1',
    snfDeductionHint: language === 'hi' ? 'हर 0.1 SNF गिरने पर फैट रेट में कमी' : 'Reduction in FAT rate for every 0.1 decrease',
    fatRange: language === 'hi' ? 'FAT रेंज' : 'FAT Range',
    snfRange: language === 'hi' ? 'SNF रेंज' : 'SNF Range',
    min: language === 'hi' ? 'न्यूनतम' : 'Min',
    max: language === 'hi' ? 'अधिकतम' : 'Max',
    step: language === 'hi' ? 'स्टेप' : 'Step',
    generateChart: language === 'hi' ? 'चार्ट देखें' : 'View Chart',
    hideChart: language === 'hi' ? 'चार्ट छुपाएं' : 'Hide Chart',
    save: language === 'hi' ? 'सेव करें' : 'Save',
    testCalculation: language === 'hi' ? 'टेस्ट कैलकुलेशन' : 'Test Calculation',
    milk: language === 'hi' ? 'दूध (L)' : 'Milk (L)',
    fat: language === 'hi' ? 'FAT' : 'FAT',
    snf: language === 'hi' ? 'SNF' : 'SNF',
    adjustedRate: language === 'hi' ? 'एडजस्टेड फैट रेट' : 'Adjusted FAT Rate',
    ratePerLiter: language === 'hi' ? 'रेट/लीटर' : 'Rate/Liter',
    totalAmount: language === 'hi' ? 'कुल राशि' : 'Total Amount',
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/settings')}
            className="rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-primary" />
              {t.title}
            </h2>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        {/* Import Chart */}
        <div className="dairy-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="icon-badge-sm bg-accent/10">
              <Upload className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-bold">
                {language === 'hi' ? 'चार्ट इम्पोर्ट करें' : 'Import Chart'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {language === 'hi' ? 'इमेज से रेट चार्ट पढ़ें (AI)' : 'Read rate chart from image (AI)'}
              </p>
            </div>
          </div>
          <label className="block">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImportChart}
              disabled={importing}
            />
            <div className={cn(
              "w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
              importing ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}>
              {importing ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium text-primary">
                    {language === 'hi' ? 'AI चार्ट पढ़ रहा है...' : 'AI reading chart...'}
                  </span>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    {language === 'hi' ? '📷 चार्ट की फोटो अपलोड करें' : '📷 Upload chart photo'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'hi' ? 'JPG, PNG सपोर्टेड' : 'JPG, PNG supported'}
                  </p>
                </>
              )}
            </div>
          </label>
        </div>

        {/* Configuration Form */}
        <div className="dairy-card space-y-5">
          {/* Base FAT Rate */}
          <div className="space-y-2">
            <Label className="font-semibold">{t.baseFatRate}</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
              <Input
                type="number"
                inputMode="decimal"
                value={baseFatRate}
                onChange={e => setBaseFatRate(e.target.value)}
                className="pl-10 text-lg font-bold"
                placeholder="8"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t.baseFatRateHint}</p>
          </div>

          {/* Base SNF */}
          <div className="space-y-2">
            <Label className="font-semibold">{t.baseSNF}</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={baseSNF}
              onChange={e => setBaseSNF(e.target.value)}
              className="text-lg font-bold"
              placeholder="9.5"
            />
            <p className="text-xs text-muted-foreground">{t.baseSNFHint}</p>
          </div>

          {/* SNF Deduction */}
          <div className="space-y-2">
            <Label className="font-semibold">{t.snfDeduction}</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={snfDeduction}
              onChange={e => setSnfDeduction(e.target.value)}
              className="text-lg font-bold"
              placeholder="0.2"
            />
            <p className="text-xs text-muted-foreground">{t.snfDeductionHint}</p>
          </div>

          {/* FAT Range */}
          <div className="space-y-3">
            <Label className="font-semibold">{t.fatRange}</Label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.min}</p>
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
                <p className="text-xs text-muted-foreground mb-1">{t.max}</p>
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
                <p className="text-xs text-muted-foreground mb-1">{t.step}</p>
                <Select value={fatStep} onValueChange={setFatStep}>
                  <SelectTrigger>
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
          <div className="space-y-3">
            <Label className="font-semibold">{t.snfRange}</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.min}</p>
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
                <p className="text-xs text-muted-foreground mb-1">{t.max}</p>
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
            <p className="text-xs text-muted-foreground">SNF step: 0.1 ({language === 'hi' ? 'निश्चित' : 'fixed'})</p>
          </div>
        </div>

        {/* Test Calculation */}
        <div className="dairy-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-badge-sm bg-accent/10">
              <Calculator className="h-5 w-5 text-accent" />
            </div>
            <h3 className="font-bold">{t.testCalculation}</h3>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.milk}</p>
              <Input
                type="number"
                inputMode="decimal"
                value={testMilk}
                onChange={e => setTestMilk(e.target.value)}
                placeholder="10"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.fat}</p>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={testFat}
                onChange={e => setTestFat(e.target.value)}
                placeholder="7"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.snf}</p>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={testSnf}
                onChange={e => setTestSnf(e.target.value)}
                placeholder="9.4"
              />
            </div>
          </div>

          {testResult && (
            <div className="bg-primary/5 rounded-xl p-4 space-y-2">
              {testResult.warning && (
                <div className="flex items-center gap-2 text-amber-600 text-sm mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{testResult.warning}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.adjustedRate}:</span>
                <span className="font-semibold">₹{testResult.adjustedFatRate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.ratePerLiter}:</span>
                <span className="font-semibold">₹{testResult.ratePerLiter.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg border-t pt-2 mt-2">
                <span className="font-semibold">{t.totalAmount}:</span>
                <span className="font-bold text-primary">₹{testResult.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Rate Chart Toggle */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowChart(!showChart)}
        >
          <Grid3X3 className="h-4 w-4 mr-2" />
          {showChart ? t.hideChart : t.generateChart}
        </Button>

        {/* Rate Chart Matrix */}
        {showChart && (
          <div className="dairy-card overflow-hidden">
            <h3 className="font-bold mb-3">
              {language === 'hi' ? 'रेट चार्ट (₹/लीटर)' : 'Rate Chart (₹/Liter)'}
            </h3>
            <div 
              className="w-full overflow-auto overscroll-x-contain" 
              style={{ WebkitOverflowScrolling: 'touch', maxHeight: '70vh' }}
            >
              <table className="border-collapse text-sm" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th className="border border-border bg-muted p-2 text-center font-bold sticky left-0 z-10">
                      FAT \ SNF
                    </th>
                    {rateChart.snfValues.map(snf => (
                      <th key={snf} className="border border-border bg-muted p-2 text-center font-semibold min-w-[60px]">
                        {snf.toFixed(1)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rateChart.cells.map((row, fatIndex) => (
                    <tr key={rateChart.fatValues[fatIndex]}>
                      <td className="border border-border bg-muted p-2 text-center font-semibold sticky left-0 z-10">
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
          </div>
        )}

        {/* Save Button */}
        <Button
          variant="dairy"
          className="w-full h-14 text-lg"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="h-5 w-5 mr-2" />
          {saving ? (language === 'hi' ? 'सेव हो रहा है...' : 'Saving...') : t.save}
        </Button>
      </main>

      <BottomNav />
    </div>
  );
};

export default FatSnfRateSetup;
