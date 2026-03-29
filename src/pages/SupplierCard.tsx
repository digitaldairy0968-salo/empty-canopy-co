import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy, MilkEntry } from '@/contexts/DairyContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import MilkReceipt from '@/components/MilkReceipt';
import { format } from 'date-fns';
import { useFatSnfRateSettings } from '@/hooks/useFatSnfRateSettings';
import { calculateRatePerLiterWithSnf } from '@/utils/fatSnfCalculation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SupplierCard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const { suppliers, addMilkEntry, getSupplierStats, rateSettings } = useDairy();
  const { settings: fatSnfSettings } = useFatSnfRateSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [entryType, setEntryType] = useState<'morning' | 'evening'>('morning');
  const [milkQty, setMilkQty] = useState('');
  const [fatValue, setFatValue] = useState('');
  const [snfValue, setSnfValue] = useState('');
  const [lrValue, setLrValue] = useState('');
  const [viewDays, setViewDays] = useState<10 | 30>(10);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [savedEntryData, setSavedEntryData] = useState<{
    date: string;
    timeOfDay: 'morning' | 'evening';
    quantity: number;
    fat: number | null;
    snf: number | null;
    lr: number | null;
  } | null>(null);
  

  const supplier = suppliers.find(s => s.id === id);

  if (!supplier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t('noData')}</p>
      </div>
    );
  }

  const stats = getSupplierStats(supplier.id, viewDays);
  const rate = rateSettings.fatRate;
  const literRate = rateSettings.literRate || 50;
  const isBuyer = supplier.animalType === 'buyer';

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getMonthDates = () => {
    const days = getDaysInMonth(currentMonth);
    const dates: string[] = [];
    // Ascending order: 1 ... 31 (so bottom is 31)
    for (let i = 1; i <= days; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      // IMPORTANT: avoid toISOString() here (it can shift dates by timezone)
      dates.push(format(date, 'yyyy-MM-dd'));
    }
    return dates;
  };

  const getEntryForDate = (date: string): MilkEntry | undefined => {
    return supplier.entries.find(e => e.date === date);
  };

  const handleOpenEntry = (date: string, type: 'morning' | 'evening') => {
    setSelectedDate(date);
    setEntryType(type);
    const entry = getEntryForDate(date);
    if (entry) {
      if (type === 'morning') {
        setMilkQty(entry.morningMilk?.toString() || '');
        setFatValue(entry.morningFat?.toString() || '');
        setSnfValue(entry.morningSNF?.toString() || '');
        setLrValue(entry.morningLR?.toString() || '');
      } else {
        setMilkQty(entry.eveningMilk?.toString() || '');
        setFatValue(entry.eveningFat?.toString() || '');
        setSnfValue(entry.eveningSNF?.toString() || '');
        setLrValue(entry.eveningLR?.toString() || '');
      }
    } else {
      setMilkQty('');
      setFatValue('');
      setSnfValue('');
      setLrValue('');
    }
    setShowEntryDialog(true);
  };

  const handleSaveEntry = async () => {
    if (!milkQty) {
      toast({ title: t('error'), description: 'Please enter milk quantity', variant: 'destructive' });
      return;
    }

    setIsSavingEntry(true);

    try {
      const existingEntry = getEntryForDate(selectedDate);

      // Check if this is an EDIT (existing entry has data for this shift)
      const isEdit = existingEntry && (
        (entryType === 'morning' && existingEntry.morningMilk !== null && existingEntry.morningMilk > 0) ||
        (entryType === 'evening' && existingEntry.eveningMilk !== null && existingEntry.eveningMilk > 0)
      );

      // If editing, check if supplier is an app user (has user_id)
      if (isEdit && user?.dairyId && supplier) {
        const { data: supplierRecord } = await supabase
          .from('suppliers')
          .select('user_id')
          .eq('id', supplier.id)
          .single();

        if (supplierRecord?.user_id) {
          // Supplier uses the app - need to create edit request instead
          const changes: Record<string, any> = {};
          if (entryType === 'morning') {
            changes.morningMilk = parseFloat(milkQty);
            if (fatValue) changes.morningFat = parseFloat(fatValue);
            if (snfValue) changes.morningSNF = parseFloat(snfValue);
            if (lrValue) changes.morningLR = parseFloat(lrValue);
          } else {
            changes.eveningMilk = parseFloat(milkQty);
            if (fatValue) changes.eveningFat = parseFloat(fatValue);
            if (snfValue) changes.eveningSNF = parseFloat(snfValue);
            if (lrValue) changes.eveningLR = parseFloat(lrValue);
          }

          // Find the milk_entry id for this date+shift
          const { data: entryRecord } = await supabase
            .from('milk_entries')
            .select('id')
            .eq('supplier_id', supplier.id)
            .eq('date', selectedDate)
            .eq('time_of_day', entryType)
            .single();

          if (entryRecord) {
            const { error: insertError } = await supabase.from('entry_edit_requests').insert({
              dairy_id: user.dairyId,
              supplier_id: supplier.id,
              entry_id: entryRecord.id,
              requested_by: (await supabase.auth.getUser()).data.user?.id || '',
              changes: changes,
              reason: language === 'hi' ? 'मालिक द्वारा एंट्री अपडेट' : 'Entry update by owner',
            });

            if (insertError) {
              console.error('Error creating edit request:', insertError);
              toast({ title: t('error'), description: 'Failed to send permission request', variant: 'destructive' });
            } else {
              toast({
                title: language === 'hi' ? 'अनुरोध भेजा गया' : 'Request Sent',
                description: language === 'hi'
                  ? `${supplier.name} को एंट्री बदलने की अनुमति भेजी गई। वो अपनी Settings से approve करेंगे।`
                  : `Edit permission request sent to ${supplier.name}. They will approve from Settings.`,
              });
            }

            setShowEntryDialog(false);
            setMilkQty('');
            setFatValue('');
            setSnfValue('');
            setLrValue('');
            setIsSavingEntry(false);
            return;
          }
        }
      }

      const newEntry: MilkEntry = {
        date: selectedDate,
        morningMilk: entryType === 'morning' ? parseFloat(milkQty) : (existingEntry?.morningMilk ?? null),
        morningFat: entryType === 'morning' ? (fatValue ? parseFloat(fatValue) : null) : (existingEntry?.morningFat ?? null),
        morningSNF: entryType === 'morning' ? (snfValue ? parseFloat(snfValue) : null) : (existingEntry?.morningSNF ?? null),
        morningLR: entryType === 'morning' ? (lrValue ? parseFloat(lrValue) : null) : (existingEntry?.morningLR ?? null),
        eveningMilk: entryType === 'evening' ? parseFloat(milkQty) : (existingEntry?.eveningMilk ?? null),
        eveningFat: entryType === 'evening' ? (fatValue ? parseFloat(fatValue) : null) : (existingEntry?.eveningFat ?? null),
        eveningSNF: entryType === 'evening' ? (snfValue ? parseFloat(snfValue) : null) : (existingEntry?.eveningSNF ?? null),
        eveningLR: entryType === 'evening' ? (lrValue ? parseFloat(lrValue) : null) : (existingEntry?.eveningLR ?? null),
      };

      addMilkEntry(supplier.id, newEntry);
      
      // Store saved entry data for receipt
      setSavedEntryData({
        date: selectedDate,
        timeOfDay: entryType,
        quantity: parseFloat(milkQty),
        fat: fatValue ? parseFloat(fatValue) : null,
        snf: snfValue ? parseFloat(snfValue) : null,
        lr: lrValue ? parseFloat(lrValue) : null,
      });
      
      toast({ title: t('success'), description: 'Entry saved!' });
      setShowEntryDialog(false);
      setMilkQty('');
      setFatValue('');
      setSnfValue('');
      setLrValue('');
    } catch (error) {
      console.error('Error saving entry:', error);
      toast({ title: t('error'), description: 'Failed to save entry', variant: 'destructive' });
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handlePrintReceipt = () => {
    setShowReceiptDialog(true);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const changeMonth = (delta: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const calculationMethod = rateSettings.calculationMethod || 'avg_fat';

  

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="dairy-header px-4 py-4">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/suppliers')}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{supplier.name}</h1>
              {supplier.code && (
                <span className="text-xs bg-primary-foreground/20 text-primary-foreground px-2 py-0.5 rounded-full font-mono">
                  #{supplier.code}
                </span>
              )}
            </div>
            <p className="text-sm text-primary-foreground/80">
              {supplier.villageName || supplier.phone}
            </p>
          </div>
          <span className="text-4xl">🥛</span>
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">

        {/* Month Navigation */}
        <div className="dairy-card animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => changeMonth(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

        {/* Milk Entry Table */}
          <div className="overflow-x-auto -mx-5 px-1">
            <table className="milk-table text-[9px]">
              <thead>
                <tr>
                  <th rowSpan={2} className="w-6 px-0.5">{language === 'hi' ? 'दि' : 'D'}</th>
                  <th colSpan={isBuyer ? 2 : (calculationMethod === 'daily_total' ? 5 : 4)} className="bg-primary/10 px-0.5">🌅</th>
                  <th colSpan={isBuyer ? 2 : (calculationMethod === 'daily_total' ? 5 : 4)} className="bg-accent/10 border-l-4 border-dairy-divider shadow-[inset_4px_0_8px_-4px_hsl(0_80%_55%/0.4)] px-0.5">🌙</th>
                </tr>
                <tr>
                  <th className="bg-primary/5 px-0.5">{language === 'hi' ? 'दूध' : 'M'}</th>
                  {!isBuyer && <th className="bg-primary/5 px-0.5">{language === 'hi' ? 'फैट' : 'F'}</th>}
                  {!isBuyer && <th className="bg-primary/5 px-0.5">SNF</th>}
                  {!isBuyer && <th className="bg-primary/5 px-0.5">LR</th>}
                  {(calculationMethod === 'daily_total' || isBuyer) && (
                    <th className="bg-primary/5 text-primary font-bold px-0.5">₹</th>
                  )}
                  <th className="bg-accent/5 border-l-4 border-dairy-divider shadow-[inset_4px_0_8px_-4px_hsl(0_80%_55%/0.4)] px-0.5">{language === 'hi' ? 'दूध' : 'M'}</th>
                  {!isBuyer && <th className="bg-accent/5 px-0.5">{language === 'hi' ? 'फैट' : 'F'}</th>}
                  {!isBuyer && <th className="bg-accent/5 px-0.5">SNF</th>}
                  {!isBuyer && <th className="bg-accent/5 px-0.5">LR</th>}
                  {(calculationMethod === 'daily_total' || isBuyer) && (
                    <th className="bg-accent/5 text-primary font-bold px-0.5">₹</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {getMonthDates().map(date => {
                  const entry = getEntryForDate(date);
                  const dayNum = Number(date.split('-')[2]);
                  const isToday = date === format(new Date(), 'yyyy-MM-dd');
                  
                  // Calculate morning and evening amounts - use SNF system if enabled
                  // For buyers: amount = milk × literRate
                  const morningAmount = isBuyer
                    ? (entry?.morningMilk ? entry.morningMilk * literRate : null)
                    : (entry?.morningMilk && entry?.morningFat 
                      ? (fatSnfSettings.isEnabled && entry?.morningSNF
                        ? entry.morningMilk * calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, entry.morningSNF, fatSnfSettings.snfDeductionPerPoint, entry.morningFat)
                        : entry.morningMilk * entry.morningFat * rate)
                      : null);
                  const eveningAmount = isBuyer
                    ? (entry?.eveningMilk ? entry.eveningMilk * literRate : null)
                    : (entry?.eveningMilk && entry?.eveningFat 
                      ? (fatSnfSettings.isEnabled && entry?.eveningSNF
                        ? entry.eveningMilk * calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, entry.eveningSNF, fatSnfSettings.snfDeductionPerPoint, entry.eveningFat)
                        : entry.eveningMilk * entry.eveningFat * rate)
                      : null);
                  
                  return (
                    <tr key={date} className={cn(isToday && 'ring-2 ring-primary ring-inset')}>
                      <td className="font-medium">{dayNum}</td>
                      <td 
                        className="cursor-pointer hover:bg-primary/10"
                        onClick={() => handleOpenEntry(date, 'morning')}
                      >
                        {entry?.morningMilk ?? '-'}
                      </td>
                      {!isBuyer && (
                        <td className="cursor-pointer hover:bg-primary/10" onClick={() => handleOpenEntry(date, 'morning')}>
                          {entry?.morningFat ?? '-'}
                        </td>
                      )}
                      {!isBuyer && (
                        <td className="cursor-pointer hover:bg-primary/10" onClick={() => handleOpenEntry(date, 'morning')}>
                          {entry?.morningSNF ?? '-'}
                        </td>
                      )}
                      {!isBuyer && (
                        <td className="cursor-pointer hover:bg-primary/10" onClick={() => handleOpenEntry(date, 'morning')}>
                          {entry?.morningLR ?? '-'}
                        </td>
                      )}
                      {(calculationMethod === 'daily_total' || isBuyer) && (
                        <td className="text-primary font-bold">
                          {morningAmount !== null ? `₹${morningAmount.toFixed(0)}` : '-'}
                        </td>
                      )}
                      <td 
                        className="cursor-pointer hover:bg-accent/10 border-l-4 border-dairy-divider shadow-[inset_4px_0_8px_-4px_hsl(0_80%_55%/0.4)]"
                        onClick={() => handleOpenEntry(date, 'evening')}
                      >
                        {entry?.eveningMilk ?? '-'}
                      </td>
                      {!isBuyer && (
                        <td className="cursor-pointer hover:bg-accent/10" onClick={() => handleOpenEntry(date, 'evening')}>
                          {entry?.eveningFat ?? '-'}
                        </td>
                      )}
                      {!isBuyer && (
                        <td className="cursor-pointer hover:bg-accent/10" onClick={() => handleOpenEntry(date, 'evening')}>
                          {entry?.eveningSNF ?? '-'}
                        </td>
                      )}
                      {!isBuyer && (
                        <td className="cursor-pointer hover:bg-accent/10" onClick={() => handleOpenEntry(date, 'evening')}>
                          {entry?.eveningLR ?? '-'}
                        </td>
                      )}
                      {(calculationMethod === 'daily_total' || isBuyer) && (
                        <td className="text-primary font-bold">
                          {eveningAmount !== null ? `₹${eveningAmount.toFixed(0)}` : '-'}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {/* Totals Row */}
                {(() => {
                  const monthDates = getMonthDates();
                  let totalMorningMilk = 0;
                  let totalEveningMilk = 0;
                  let totalMorningFat = 0;
                  let totalEveningFat = 0;
                  let morningFatCount = 0;
                  let eveningFatCount = 0;
                  let totalMorningAmount = 0;
                  let totalEveningAmount = 0;
                  
                  monthDates.forEach(date => {
                    const entry = getEntryForDate(date);
                    if (entry) {
                      totalMorningMilk += entry.morningMilk || 0;
                      totalEveningMilk += entry.eveningMilk || 0;
                      if (entry.morningFat !== null) {
                        totalMorningFat += entry.morningFat;
                        morningFatCount++;
                        if (entry.morningMilk) {
                          totalMorningAmount += fatSnfSettings.isEnabled && entry.morningSNF
                            ? entry.morningMilk * calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, entry.morningSNF, fatSnfSettings.snfDeductionPerPoint, entry.morningFat)
                            : entry.morningMilk * entry.morningFat * rate;
                        }
                      }
                      if (entry.eveningFat !== null) {
                        totalEveningFat += entry.eveningFat;
                        eveningFatCount++;
                        if (entry.eveningMilk) {
                          totalEveningAmount += fatSnfSettings.isEnabled && entry.eveningSNF
                            ? entry.eveningMilk * calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, entry.eveningSNF, fatSnfSettings.snfDeductionPerPoint, entry.eveningFat)
                            : entry.eveningMilk * entry.eveningFat * rate;
                        }
                      }
                    }
                  });
                  
                   const avgMorningFat = morningFatCount > 0 ? totalMorningFat / morningFatCount : 0;
                   const avgEveningFat = eveningFatCount > 0 ? totalEveningFat / eveningFatCount : 0;
                   
                  return (
                     <>
                       <tr className="bg-primary/10 font-bold border-t-2 border-primary">
                         <td className="text-primary">{t('total')}</td>
                         <td>{totalMorningMilk.toFixed(1)}</td>
                         {!isBuyer && <td>{totalMorningFat.toFixed(1)}</td>}
                         {!isBuyer && <td>-</td>}
                         {!isBuyer && <td>-</td>}
                         {(calculationMethod === 'daily_total' || isBuyer) && (
                           <td className="text-primary">₹{isBuyer ? (totalMorningMilk * literRate).toFixed(0) : totalMorningAmount.toFixed(0)}</td>
                         )}
                         <td className="border-l-4 border-dairy-divider shadow-[inset_4px_0_8px_-4px_hsl(0_80%_55%/0.4)]">{totalEveningMilk.toFixed(1)}</td>
                         {!isBuyer && <td>{totalEveningFat.toFixed(1)}</td>}
                         {!isBuyer && <td>-</td>}
                         {!isBuyer && <td>-</td>}
                         {(calculationMethod === 'daily_total' || isBuyer) && (
                           <td className="text-primary">₹{isBuyer ? (totalEveningMilk * literRate).toFixed(0) : totalEveningAmount.toFixed(0)}</td>
                         )}
                       </tr>
                       {!isBuyer && (
                       <tr className="bg-muted/30 text-xs text-muted-foreground">
                         <td className="font-medium">{language === 'hi' ? 'एवग' : 'Avg'}</td>
                         <td>-</td>
                         <td className="font-semibold text-primary">{avgMorningFat.toFixed(2)}</td>
                         <td>-</td>
                         <td>-</td>
                         {calculationMethod === 'daily_total' && <td>-</td>}
                         <td className="border-l-4 border-dairy-divider">-</td>
                         <td className="font-semibold text-accent">{avgEveningFat.toFixed(2)}</td>
                         <td>-</td>
                         <td>-</td>
                         {calculationMethod === 'daily_total' && <td>-</td>}
                       </tr>
                       )}
                     </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="dairy"
            className="flex-1"
            onClick={() => handleOpenEntry(new Date().toISOString().split('T')[0], 'morning')}
          >
            <Plus className="mr-2" />
            {t('enterMilk')}
          </Button>
          {savedEntryData && (
            <Button
              variant="outline"
              onClick={handlePrintReceipt}
              className="px-4"
            >
              <Printer className="h-5 w-5" />
            </Button>
          )}
        </div>
      </main>

      {/* Entry Dialog - Optimized for instant typing */}
      <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {entryType === 'morning' ? '🌅' : '🌙'} {t(entryType)} - {selectedDate}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Time Toggle */}
            <div className="flex gap-2">
              <Button
                variant={entryType === 'morning' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setEntryType('morning')}
              >
                🌅 {t('morning')}
              </Button>
              <Button
                variant={entryType === 'evening' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setEntryType('evening')}
              >
                🌙 {t('evening')}
              </Button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('milk')} ({t('liters')}) *</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="0.0"
                defaultValue={milkQty}
                key={`milk-${selectedDate}-${entryType}`}
                onBlur={e => setMilkQty(e.target.value)}
                className="flex h-12 w-full rounded-xl border border-input bg-background px-4 py-2 text-xl text-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {!isBuyer && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">{t('fat')} %</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="-"
                  defaultValue={fatValue}
                  key={`fat-${selectedDate}-${entryType}`}
                  onBlur={e => setFatValue(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('snf')}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="-"
                  defaultValue={snfValue}
                  key={`snf-${selectedDate}-${entryType}`}
                  onBlur={e => setSnfValue(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('lr')}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="-"
                  defaultValue={lrValue}
                  key={`lr-${selectedDate}-${entryType}`}
                  onBlur={e => setLrValue(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            )}

            <Button variant="dairy" className="w-full" onClick={handleSaveEntry}>
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🧾 {t('printReceipt')}
            </DialogTitle>
          </DialogHeader>
          {savedEntryData && (
            <MilkReceipt
              data={{
                date: savedEntryData.date,
                supplierName: supplier.name,
                supplierId: supplier.id,
                villageName: supplier.villageName || undefined,
                animalType: supplier.animalType || undefined,
                timeOfDay: savedEntryData.timeOfDay,
                quantity: savedEntryData.quantity,
                fat: savedEntryData.fat,
                snf: savedEntryData.snf,
                lr: savedEntryData.lr,
                rate: rate,
              }}
              onClose={() => setShowReceiptDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierCard;
