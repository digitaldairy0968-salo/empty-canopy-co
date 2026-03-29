import React, { useState, useMemo, useEffect } from 'react';
import { Search, Printer, CalendarIcon, ChevronDown, ChevronUp, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy } from '@/contexts/DairyContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import ReportReceipt from '@/components/ReportReceipt';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useFatSnfRateSettings } from '@/hooks/useFatSnfRateSettings';
import { calculateRatePerLiterWithSnf } from '@/utils/fatSnfCalculation';
import { calculateSupplierStats } from '@/utils/supplierCalculation';
import { useOwnerSettings } from '@/hooks/useOwnerSettings';

const HisaabReport: React.FC = () => {
  const { t, language } = useLanguage();
  const { suppliers, rateSettings, refreshData } = useDairy();
  const calculationMethod = rateSettings.calculationMethod || 'avg_fat';
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { settings: fatSnfSettings } = useFatSnfRateSettings();
  const { settings: ownerSettings } = useOwnerSettings();
  const [isSaving, setIsSaving] = useState(false);

  // Report/Calculation section state
  const [reportSupplierCode, setReportSupplierCode] = useState('');
  const [reportSupplierId, setReportSupplierId] = useState<string>('');
  const [reportSearchType, setReportSearchType] = useState<'code' | 'name'>('code');
  const [reportShiftFilter, setReportShiftFilter] = useState<'both' | 'morning' | 'evening'>('both');
  
  // Report receipt toggle - persisted in localStorage
  const [reportReceiptEnabled, setReportReceiptEnabled] = useState(() => {
    const saved = localStorage.getItem('reportReceiptEnabled');
    return saved !== null ? saved === 'true' : false;
  });
  
  // Report receipt dialog state
  const [showReportReceiptDialog, setShowReportReceiptDialog] = useState(false);
  const [shouldAutoPrint, setShouldAutoPrint] = useState(false);
  
  // Persist custom dates in localStorage
  const [reportStartDate, setReportStartDate] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem('reportStartDate');
    return saved ? new Date(saved) : undefined;
  });
  const [reportEndDate, setReportEndDate] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem('reportEndDate');
    return saved ? new Date(saved) : undefined;
  });
  const [reportCustomRate, setReportCustomRate] = useState<string>('');

  // Default rate from settings
  const defaultRate = rateSettings.fatRate;

  // Current rate for report section (custom if set, otherwise default)
  const reportRate = reportCustomRate ? parseFloat(reportCustomRate) : defaultRate;

  // Save reportReceiptEnabled to localStorage
  useEffect(() => {
    localStorage.setItem('reportReceiptEnabled', reportReceiptEnabled.toString());
  }, [reportReceiptEnabled]);

  // Initialize custom rate with default rate
  useEffect(() => {
    if (!reportCustomRate && defaultRate) {
      setReportCustomRate(defaultRate.toString());
    }
  }, [defaultRate]);

  // Find supplier for report by code or name
  const reportSupplier = useMemo(() => {
    if (reportSupplierId) {
      return suppliers.find(s => s.id === reportSupplierId);
    }
    if (reportSupplierCode.length >= 1) {
      if (reportSearchType === 'code') {
        return suppliers.find(s => s.code === reportSupplierCode);
      } else {
        return suppliers.find(s => s.name.toLowerCase().includes(reportSupplierCode.toLowerCase()));
      }
    }
    return undefined;
  }, [suppliers, reportSupplierCode, reportSupplierId, reportSearchType]);

  // Filter suppliers for report dropdown based on search type
  const filteredReportSuppliers = useMemo(() => {
    if (!reportSupplierCode) return suppliers;
    if (reportSearchType === 'code') {
      return suppliers.filter(s => s.code?.includes(reportSupplierCode));
    } else {
      return suppliers.filter(s => s.name.toLowerCase().includes(reportSupplierCode.toLowerCase()));
    }
  }, [suppliers, reportSupplierCode, reportSearchType]);

  // Sort suppliers by code for navigation
  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      const codeA = parseInt(a.code) || 0;
      const codeB = parseInt(b.code) || 0;
      return codeA - codeB;
    });
  }, [suppliers]);

  // Save dates to localStorage when they change
  useEffect(() => {
    if (reportStartDate) {
      localStorage.setItem('reportStartDate', reportStartDate.toISOString());
    }
  }, [reportStartDate]);

  useEffect(() => {
    if (reportEndDate) {
      localStorage.setItem('reportEndDate', reportEndDate.toISOString());
    }
  }, [reportEndDate]);

  const handleReportSupplierCodeChange = (value: string) => {
    setReportSupplierCode(value);
    setReportSupplierId('');
  };

  const handleSelectReportSupplier = (supplierId: string) => {
    setReportSupplierId(supplierId);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier?.code) {
      setReportSupplierCode(supplier.code);
    }
  };

  // Navigate to next/previous supplier in report section
  const navigateReportSupplier = (direction: 'up' | 'down') => {
    const currentCode = parseInt(reportSupplierCode) || 0;
    const sortedCodes = sortedSuppliers.map(s => parseInt(s.code) || 0).filter(c => c > 0);
    
    if (sortedCodes.length === 0) return;
    
    let targetCode: number;
    if (direction === 'up') {
      const prevCodes = sortedCodes.filter(c => c < currentCode);
      targetCode = prevCodes.length > 0 ? prevCodes[prevCodes.length - 1] : sortedCodes[sortedCodes.length - 1];
    } else {
      const nextCodes = sortedCodes.filter(c => c > currentCode);
      targetCode = nextCodes.length > 0 ? nextCodes[0] : sortedCodes[0];
    }
    
    const targetSupplier = sortedSuppliers.find(s => parseInt(s.code) === targetCode);
    if (targetSupplier) {
      setReportSupplierCode(targetSupplier.code);
      setReportSupplierId(targetSupplier.id);
    }
  };

  // Store current supplier data for receipt before moving to next
  const [receiptData, setReceiptData] = useState<{
    supplier: typeof reportSupplier;
    stats: typeof reportStats;
  } | null>(null);

  // Handle "Save in History" - save amount to customer's pending balance and move to next
  // Prevents duplicate: checks if same supplier+date_range already exists
  const handleSaveInHistory = async () => {
    if (!reportSupplier || !reportStats || !user?.dairyId || !reportStartDate || !reportEndDate) return;
    
    setIsSaving(true);
    try {
      const startStr = format(reportStartDate, 'yyyy-MM-dd');
      const endStr = format(reportEndDate, 'yyyy-MM-dd');

      // Check for duplicate: same supplier, same date range
      const { data: existing } = await (supabase
        .from('payment_history')
        .select('id')
        .eq('supplier_id', reportSupplier.id)
        .eq('dairy_id', user.dairyId) as any)
        .eq('date_range_start', startStr)
        .eq('date_range_end', endStr)
        .maybeSingle();

      if (existing) {
        toast({
          title: language === 'hi' ? 'पहले से जुड़ा है' : 'Already Added',
          description: language === 'hi' 
            ? 'इस तारीख रेंज का भुगतान पहले से हिस्ट्री में है' 
            : 'Payment for this date range already exists in history',
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      // Get current pending balance
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('pending_balance')
        .eq('id', reportSupplier.id)
        .single();
      
      const currentPending = Number(supplierData?.pending_balance) || 0;
      const amountToAdd = reportStats.totalAmount;
      const newBalance = currentPending + amountToAdd;
      
      // Insert payment history record with date range
      await supabase
        .from('payment_history')
        .insert({
          dairy_id: user.dairyId,
          supplier_id: reportSupplier.id,
          amount_added: amountToAdd,
          amount_paid: 0,
          balance_after: newBalance,
          notes: `${format(reportStartDate, 'dd/MM')} - ${format(reportEndDate, 'dd/MM')} | ${reportStats.totalMilk.toFixed(1)}L`,
          date_range_start: startStr,
          date_range_end: endStr,
        } as any);
      
      // Update supplier's pending balance
      await supabase
        .from('suppliers')
        .update({ pending_balance: newBalance })
        .eq('id', reportSupplier.id);
      
      await refreshData();
      
      toast({
        title: language === 'hi' ? 'सफल' : 'Success',
        description: language === 'hi' ? `₹${amountToAdd.toFixed(0)} हिस्ट्री में जोड़ा गया` : `₹${amountToAdd.toFixed(0)} added to history`,
      });
      
      // Show receipt if enabled
      if (reportReceiptEnabled) {
        if (ownerSettings.bluetoothPrinterConnected) {
          // Printer connected: directly print without showing dialog
          setReceiptData({ supplier: reportSupplier, stats: reportStats });
          setShouldAutoPrint(true);
        } else {
          // No printer: show preview dialog
          setReceiptData({ supplier: reportSupplier, stats: reportStats });
          setShowReportReceiptDialog(true);
        }
      }
      
      // Move to next supplier
      const currentCode = parseInt(reportSupplierCode) || 0;
      const sortedCodes = sortedSuppliers.map(s => parseInt(s.code) || 0).filter(c => c > 0);
      
      if (sortedCodes.length > 0) {
        const nextCodes = sortedCodes.filter(c => c > currentCode);
        const targetCode = nextCodes.length > 0 ? nextCodes[0] : sortedCodes[0];
        
        const targetSupplier = sortedSuppliers.find(s => parseInt(s.code) === targetCode);
        if (targetSupplier) {
          setReportSupplierCode(targetSupplier.code);
          setReportSupplierId(targetSupplier.id);
        }
      }
    } catch (error) {
      console.error('Error saving to history:', error);
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'सेव नहीं हो पाया' : 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate report stats
  const reportStats = useMemo(() => {
    if (!reportSupplier || !reportStartDate || !reportEndDate) return null;

    const startStr = format(reportStartDate, 'yyyy-MM-dd');
    const endStr = format(reportEndDate, 'yyyy-MM-dd');

    const stats = calculateSupplierStats({
      entries: reportSupplier.entries,
      startDate: startStr,
      endDate: endStr,
      shiftFilter: reportShiftFilter,
      rate: reportRate,
      calculationMethod,
      fatSnfSettings: fatSnfSettings,
      animalType: reportSupplier.animalType,
      literRate: rateSettings.literRate || 50,
    });

    return {
      totalMilk: stats.totalMilk,
      avgFat: stats.avgFat,
      totalFat: stats.totalFatSum,
      totalAmount: stats.totalAmount,
      entryCount: stats.entryCount,
    };
  }, [reportSupplier, reportStartDate, reportEndDate, reportRate, reportShiftFilter, calculationMethod, fatSnfSettings, rateSettings]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-20">
      <Header />

      <main className="px-3 py-3 max-w-lg mx-auto">
        {/* Report Card - Compact layout to fit in one screen */}
        <div className="bg-card rounded-2xl shadow-lg border border-border/50 p-3 animate-fade-in">
          {/* Search Type Toggle - Compact */}
          <div className="flex bg-muted rounded-full p-0.5 mb-2">
            <button
              onClick={() => setReportSearchType('code')}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                reportSearchType === 'code' 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {language === 'hi' ? 'कोड' : language === 'gu' ? 'કોડ' : 'Code'}
            </button>
            <button
              onClick={() => setReportSearchType('name')}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                reportSearchType === 'name' 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {language === 'hi' ? 'नाम' : language === 'gu' ? 'નામ' : 'Name'}
            </button>
          </div>

          {/* Supplier Search Input with Navigation - Compact */}
          <div className="flex items-center gap-1.5 mb-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => navigateReportSupplier('up')}
              className="h-10 w-10 rounded-lg shrink-0"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <div className="relative flex-1">
              <Input
                type="text"
                inputMode={reportSearchType === 'code' ? 'numeric' : 'text'}
                placeholder={reportSearchType === 'code' 
                  ? (language === 'hi' ? 'कोड...' : 'Code...')
                  : (language === 'hi' ? 'नाम...' : 'Name...')
                }
                value={reportSupplierCode}
                onChange={e => handleReportSupplierCodeChange(e.target.value)}
                className="h-10 text-base font-semibold text-center rounded-lg border-2 border-border/60 focus:border-primary bg-background pl-8"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => navigateReportSupplier('down')}
              className="h-10 w-10 rounded-lg shrink-0"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Select from List - Compact */}
          <Select value={reportSupplierId} onValueChange={handleSelectReportSupplier}>
            <SelectTrigger className="w-full h-9 rounded-lg mb-2 text-sm">
              <SelectValue placeholder={language === 'hi' ? 'सूची से चुनें' : 'Select from list'} />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {filteredReportSuppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="font-semibold">{s.code}</span>
                  <span className="text-muted-foreground ml-2">• {s.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {reportSupplier && (
            <div className="py-1.5 px-2 bg-primary/10 rounded-lg text-center mb-2">
              <p className="font-semibold text-primary text-sm">#{reportSupplier.code} - {reportSupplier.name}</p>
            </div>
          )}

          {/* Morning/Evening/Both Filter - Compact */}
          <div className="flex bg-muted rounded-full p-0.5 mb-2">
            <button
              onClick={() => setReportShiftFilter('morning')}
              className={cn(
                "flex-1 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200",
                reportShiftFilter === 'morning' 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              🌅 {language === 'hi' ? 'सुबह' : 'AM'}
            </button>
            <button
              onClick={() => setReportShiftFilter('evening')}
              className={cn(
                "flex-1 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200",
                reportShiftFilter === 'evening' 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              🌙 {language === 'hi' ? 'शाम' : 'PM'}
            </button>
            <button
              onClick={() => setReportShiftFilter('both')}
              className={cn(
                "flex-1 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200",
                reportShiftFilter === 'both' 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {language === 'hi' ? 'दोनों' : 'Both'}
            </button>
          </div>

          {/* Date Range and Rate - Compact in one row */}
          <div className="flex gap-2 mb-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 h-9 justify-start text-left font-normal rounded-lg text-xs",
                    !reportStartDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {reportStartDate ? format(reportStartDate, "dd/MM") : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={reportStartDate}
                  onSelect={setReportStartDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 h-9 justify-start text-left font-normal rounded-lg text-xs",
                    !reportEndDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {reportEndDate ? format(reportEndDate, "dd/MM") : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={reportEndDate}
                  onSelect={setReportEndDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2">
              <span className="text-xs text-muted-foreground">₹</span>
              <Input
                type="number"
                inputMode="decimal"
                value={reportCustomRate}
                onChange={e => setReportCustomRate(e.target.value)}
                className="w-14 h-7 text-sm font-semibold text-center rounded border-0 bg-transparent p-0"
                placeholder={defaultRate.toString()}
              />
            </div>
          </div>

          {/* Report Results - Compact */}
          {reportStats && (
            <div className="space-y-2 animate-fade-in mb-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-primary/10 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">{t('totalMilk')}</p>
                  <p className="text-lg font-bold text-primary">{reportStats.totalMilk.toFixed(1)}<span className="text-xs">L</span></p>
                </div>
                <div className="text-center p-2 bg-accent/10 rounded-lg">
                  <p className="text-[10px] text-muted-foreground">{t('totalFat')}</p>
                  <p className="text-lg font-bold text-accent">{reportStats.totalFat.toFixed(1)}</p>
                </div>
                <div className="text-center p-2 bg-secondary rounded-lg">
                  <p className="text-[10px] text-muted-foreground">{t('avgFat')}</p>
                  <p className="text-lg font-bold">{reportStats.avgFat.toFixed(2)}</p>
                </div>
              </div>
              <div className="text-center p-3 bg-gradient-to-r from-secondary to-secondary/60 rounded-lg">
                <p className="text-xs text-muted-foreground">{t('totalAmount')}</p>
                <p className="text-3xl font-bold text-foreground">₹{reportStats.totalAmount.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {reportStats.entryCount} {language === 'hi' ? 'एंट्री' : 'entries'} • ₹{reportRate}/{language === 'hi' ? 'फैट' : 'fat'}
                </p>
              </div>
            </div>
          )}

          {(!reportSupplier || !reportStartDate || !reportEndDate) && (
            <p className="text-center text-xs text-muted-foreground py-4">
              {language === 'hi' ? 'ग्राहक और तारीख चुनें' : 'Select customer and dates'}
            </p>
          )}

          {/* History Button, Print-Only Button, and Save Button */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/customer-history')}
              className="h-10 w-10 rounded-lg"
              title={language === 'hi' ? 'ग्राहक हिस्ट्री' : 'Customer History'}
            >
              <History className="h-4 w-4" />
            </Button>
            {/* Print-only receipt button - only for printer users */}
            {ownerSettings.bluetoothPrinterConnected && reportSupplier && reportStats && (
              <Button
                variant="outline"
                onClick={() => {
                  setReceiptData({ supplier: reportSupplier, stats: reportStats });
                  setShouldAutoPrint(true);
                }}
                className="h-10 rounded-lg gap-1"
                title={language === 'hi' ? 'सिर्फ प्रिंट करें' : 'Print Only'}
              >
                <Printer className="h-4 w-4" />
                <span className="text-xs">{language === 'hi' ? 'प्रिंट' : 'Print'}</span>
              </Button>
            )}
            <Button
              onClick={handleSaveInHistory}
              disabled={isSaving || !reportSupplier || !reportStats}
              className="flex-1 h-10 rounded-lg text-base font-semibold bg-primary hover:bg-primary/90 shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              {isSaving ? '...' : `✓ ${language === 'hi' ? 'हिस्ट्री में जोड़ें' : 'Save in History'}`}
            </Button>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Auto-print: hidden receipt that prints directly when printer is connected */}
      {shouldAutoPrint && receiptData?.supplier && receiptData?.stats && reportStartDate && reportEndDate && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, visibility: 'hidden' }}>
          <ReportReceipt
            outputType="print"
            autoPrint={true}
            data={{
              supplierName: receiptData.supplier.name,
              supplierCode: receiptData.supplier.code || '',
              startDate: format(reportStartDate, 'yyyy-MM-dd'),
              endDate: format(reportEndDate, 'yyyy-MM-dd'),
              totalMilk: receiptData.stats.totalMilk,
              avgFat: receiptData.stats.avgFat,
              totalFat: receiptData.stats.totalFat,
              totalAmount: receiptData.stats.totalAmount,
              rate: reportRate,
              ownerName: user?.dairyName,
              ownerPhone: '',
              entries: (() => {
                if (!receiptData.supplier) return [];
                const startStr = format(reportStartDate, 'yyyy-MM-dd');
                const endStr = format(reportEndDate, 'yyyy-MM-dd');
                const filtered = receiptData.supplier.entries.filter(
                  (e: any) => e.date >= startStr && e.date <= endStr
                ).sort((a: any, b: any) => a.date.localeCompare(b.date));
                return filtered.map((entry: any) => {
                  const mFat = entry.morningFat || 0;
                  const eFat = entry.eveningFat || 0;
                  const mSnf = entry.morningSNF || 0;
                  const eSnf = entry.eveningSNF || 0;
                  const mMilk = entry.morningMilk || 0;
                  const eMilk = entry.eveningMilk || 0;
                  const mRate = fatSnfSettings.isEnabled && mSnf
                    ? calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, mSnf, fatSnfSettings.snfDeductionPerPoint, mFat)
                    : (mFat ? mFat * reportRate : 0);
                  const eRate = fatSnfSettings.isEnabled && eSnf
                    ? calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, eSnf, fatSnfSettings.snfDeductionPerPoint, eFat)
                    : (eFat ? eFat * reportRate : 0);
                  return {
                    date: entry.date,
                    morningMilk: mMilk || null,
                    morningFat: mFat || null,
                    morningRate: mRate || null,
                    morningAmount: mMilk && mRate ? mMilk * mRate : null,
                    eveningMilk: eMilk || null,
                    eveningFat: eFat || null,
                    eveningRate: eRate || null,
                    eveningAmount: eMilk && eRate ? eMilk * eRate : null,
                  };
                });
              })(),
            }}
            onClose={() => {
              setShouldAutoPrint(false);
              setReceiptData(null);
            }}
          />
        </div>
      )}

      {/* Report Receipt Dialog - Uses stored receiptData for correct supplier */}
      <Dialog open={showReportReceiptDialog} onOpenChange={(open) => {
        setShowReportReceiptDialog(open);
        if (!open) setReceiptData(null);
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              {language === 'hi' ? 'हिसाब रसीद' : language === 'gu' ? 'હિસાબ રસીદ' : 'Report Receipt'}
            </DialogTitle>
          </DialogHeader>
          {receiptData?.supplier && receiptData?.stats && reportStartDate && reportEndDate && (
            <ReportReceipt
              outputType={ownerSettings.bhugtanOutputType}
              data={{
                supplierName: receiptData.supplier.name,
                supplierCode: receiptData.supplier.code || '',
                startDate: format(reportStartDate, 'yyyy-MM-dd'),
                endDate: format(reportEndDate, 'yyyy-MM-dd'),
                totalMilk: receiptData.stats.totalMilk,
                avgFat: receiptData.stats.avgFat,
                totalFat: receiptData.stats.totalFat,
                totalAmount: receiptData.stats.totalAmount,
                rate: reportRate,
                ownerName: user?.dairyName,
                ownerPhone: '',
                entries: (() => {
                  if (!receiptData.supplier) return [];
                  const startStr = format(reportStartDate, 'yyyy-MM-dd');
                  const endStr = format(reportEndDate, 'yyyy-MM-dd');
                  const filtered = receiptData.supplier.entries.filter(
                    (e: any) => e.date >= startStr && e.date <= endStr
                  ).sort((a: any, b: any) => a.date.localeCompare(b.date));
                  return filtered.map((entry: any) => {
                    const mFat = entry.morningFat || 0;
                    const eFat = entry.eveningFat || 0;
                    const mSnf = entry.morningSNF || 0;
                    const eSnf = entry.eveningSNF || 0;
                    const mMilk = entry.morningMilk || 0;
                    const eMilk = entry.eveningMilk || 0;

                    const mRate = fatSnfSettings.isEnabled && mSnf
                      ? calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, mSnf, fatSnfSettings.snfDeductionPerPoint, mFat)
                      : (mFat ? mFat * reportRate : 0);
                    const eRate = fatSnfSettings.isEnabled && eSnf
                      ? calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, eSnf, fatSnfSettings.snfDeductionPerPoint, eFat)
                      : (eFat ? eFat * reportRate : 0);

                    return {
                      date: entry.date,
                      morningMilk: mMilk || null,
                      morningFat: mFat || null,
                      morningRate: mRate || null,
                      morningAmount: mMilk && mRate ? mMilk * mRate : null,
                      eveningMilk: eMilk || null,
                      eveningFat: eFat || null,
                      eveningRate: eRate || null,
                      eveningAmount: eMilk && eRate ? eMilk * eRate : null,
                    };
                  });
                })(),
              }}
              onClose={() => {
                setShowReportReceiptDialog(false);
                setReceiptData(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HisaabReport;
