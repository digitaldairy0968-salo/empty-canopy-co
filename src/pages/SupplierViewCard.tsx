import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarIcon, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy, MilkEntry } from '@/contexts/DairyContext';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFatSnfRateSettings } from '@/hooks/useFatSnfRateSettings';
import { calculateRatePerLiterWithSnf } from '@/utils/fatSnfCalculation';

const SupplierViewCard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const { suppliers, getSupplierStats, rateSettings } = useDairy();
  const { user } = useAuth();
  const { settings: fatSnfSettings } = useFatSnfRateSettings();
  const navigate = useNavigate();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showRakamToCustomers, setShowRakamToCustomers] = useState(true);
  
  // Date range filter state - always shown
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [timeFilter, setTimeFilter] = useState<'morning' | 'evening' | 'both'>('both');

  // Fetch owner settings to check if Rakam should be shown
  useEffect(() => {
    const fetchOwnerSettings = async () => {
      if (!user?.dairyId) return;
      
      try {
        const { data } = await supabase
          .from('owner_settings')
          .select('show_rakam_to_customers')
          .eq('dairy_id', user.dairyId)
          .maybeSingle();
        
        if (data) {
          setShowRakamToCustomers((data as any).show_rakam_to_customers ?? true);
        }
      } catch (error) {
        console.error('Error fetching owner settings:', error);
      }
    };
    
    fetchOwnerSettings();
  }, [user?.dairyId]);

  const supplier = suppliers.find(s => s.id === id);
  const showCalculations = supplier?.canSeeCalculations ?? rateSettings.showCalculationsToSuppliers;

  if (!supplier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t('noData')}</p>
      </div>
    );
  }

  const rate = rateSettings.fatRate;
  const literRate = rateSettings.literRate || 50;
  const isBuyer = supplier.animalType === 'buyer';

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getMonthDates = () => {
    const days = getDaysInMonth(currentMonth);
    const dates: string[] = [];
    for (let i = 1; i <= days; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      dates.push(format(date, 'yyyy-MM-dd'));
    }
    return dates;
  };

  const getEntryForDate = (date: string): MilkEntry | undefined => {
    return supplier.entries.find(e => e.date === date);
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

  // Calculate stats for custom date range
  const getCustomRangeStats = () => {
    if (!startDate || !endDate) return null;
    
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    
    const filteredEntries = supplier.entries.filter(e => {
      return e.date >= startStr && e.date <= endStr;
    });
    
    let totalMilk = 0;
    let totalFat = 0;
    let fatCount = 0;
    let dailyTotalAmount = 0;
    let morningTotalAmount = 0;
    let eveningTotalAmount = 0;
    
    filteredEntries.forEach(entry => {
      if (timeFilter === 'morning' || timeFilter === 'both') {
        if (entry.morningMilk !== null && entry.morningMilk !== undefined && entry.morningMilk > 0) {
          totalMilk += entry.morningMilk;
          if (entry.morningFat && entry.morningFat > 0) {
            totalFat += entry.morningFat;
            fatCount++;
          }
          if (calculationMethod === 'daily_total') {
            const entryFat = entry.morningFat ?? 0;
            const amount = entry.morningMilk * entryFat * rate;
            morningTotalAmount += amount;
            dailyTotalAmount += amount;
          }
        }
      }
      if (timeFilter === 'evening' || timeFilter === 'both') {
        if (entry.eveningMilk !== null && entry.eveningMilk !== undefined && entry.eveningMilk > 0) {
          totalMilk += entry.eveningMilk;
          if (entry.eveningFat && entry.eveningFat > 0) {
            totalFat += entry.eveningFat;
            fatCount++;
          }
          if (calculationMethod === 'daily_total') {
            const entryFat = entry.eveningFat ?? 0;
            const amount = entry.eveningMilk * entryFat * rate;
            eveningTotalAmount += amount;
            dailyTotalAmount += amount;
          }
        }
      }
    });
    
    const avgFat = fatCount > 0 ? totalFat / fatCount : 0;
    const totalAmount = calculationMethod === 'daily_total' 
      ? dailyTotalAmount 
      : avgFat * totalMilk * rate;
    
    return { totalMilk, totalFat, avgFat, totalAmount, morningTotalAmount, eveningTotalAmount };
  };

  const customRangeStats = getCustomRangeStats();

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="dairy-header px-4 py-4">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/supplier-dashboard')}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{supplier.name}</h1>
            <p className="text-sm text-primary-foreground/80">{supplier.phone}</p>
            {user?.dairyName && (
              <p className="text-xs text-primary-foreground/60">{user.dairyName}</p>
            )}
          </div>
          <span className="text-4xl">🥛</span>
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        {/* Custom Date Range Stats - Only show if calculations are enabled */}
        {showCalculations && (
          <div className="dairy-card animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">{t('customDateRange')}</h3>
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t('fromDate')}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : t('selectDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t('toDate')}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : t('selectDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Time Filter Buttons */}
            <div className="flex gap-2 mb-3">
              <Button
                variant={timeFilter === 'morning' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTimeFilter('morning')}
              >
                🌅 {t('morning')}
              </Button>
              <Button
                variant={timeFilter === 'evening' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTimeFilter('evening')}
              >
                🌙 {t('evening')}
              </Button>
              <Button
                variant={timeFilter === 'both' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTimeFilter('both')}
              >
                {t('both')}
              </Button>
            </div>

            {/* Stats Display */}
            {customRangeStats && startDate && endDate && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-xl">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{t('totalMilk')}</p>
                  <p className="text-lg font-bold text-primary">{customRangeStats.totalMilk.toFixed(1)} L</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{t('avgFat')}</p>
                  <p className="text-lg font-bold text-accent">{customRangeStats.avgFat.toFixed(2)}</p>
                </div>
                {calculationMethod === 'daily_total' && (
                  <>
                    {(timeFilter === 'morning' || timeFilter === 'both') && (
                      <div className="text-center p-2 bg-accent/20 rounded-lg">
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                          🌅 {t('morning')}
                        </p>
                        <p className="text-lg font-bold text-accent-foreground">
                          ₹{customRangeStats.morningTotalAmount.toFixed(0)}
                        </p>
                      </div>
                    )}
                    {(timeFilter === 'evening' || timeFilter === 'both') && (
                      <div className="text-center p-2 bg-secondary rounded-lg">
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                          🌙 {t('evening')}
                        </p>
                        <p className="text-lg font-bold text-secondary-foreground">
                          ₹{customRangeStats.eveningTotalAmount.toFixed(0)}
                        </p>
                      </div>
                    )}
                    {timeFilter === 'both' && (
                      <div className="col-span-2 text-center p-2 bg-primary/10 rounded-lg">
                        <p className="text-xs text-muted-foreground">{t('totalAmount')}</p>
                        <p className="text-xl font-bold text-primary">₹{customRangeStats.totalAmount.toFixed(0)}</p>
                      </div>
                    )}
                  </>
                )}
                {calculationMethod !== 'daily_total' && (
                  <div className="col-span-2 text-center p-2 bg-primary/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">{t('totalAmount')}</p>
                    <p className="text-xl font-bold text-primary">₹{customRangeStats.totalAmount.toFixed(0)}</p>
                  </div>
                )}
              </div>
            )}
            
            {(!startDate || !endDate) && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {t('selectDate')}
              </p>
            )}
          </div>
        )}

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

        {/* Milk Entry Table - Read Only */}
        <div className="overflow-x-auto -mx-5 px-1">
          <table className="milk-table text-[9px]">
            <thead>
              <tr>
                <th rowSpan={2} className="w-6 px-0.5">{language === 'hi' ? 'दि' : 'D'}</th>
                <th colSpan={isBuyer ? 2 : ((calculationMethod === 'daily_total' && showRakamToCustomers) ? 5 : 4)} className="bg-primary/10 px-0.5">🌅</th>
                <th colSpan={isBuyer ? 2 : ((calculationMethod === 'daily_total' && showRakamToCustomers) ? 5 : 4)} className="border-l-4 border-dairy-divider shadow-[inset_4px_0_8px_-4px_hsl(0_80%_55%/0.4)] bg-accent/10 px-0.5">🌙</th>
              </tr>
              <tr>
                <th className="px-0.5">{language === 'hi' ? 'दूध' : 'M'}</th>
                {!isBuyer && <th className="px-0.5">{language === 'hi' ? 'फैट' : 'F'}</th>}
                {!isBuyer && <th className="px-0.5">SNF</th>}
                {!isBuyer && <th className="px-0.5">LR</th>}
                {((calculationMethod === 'daily_total' && showRakamToCustomers) || isBuyer) && (
                  <th className="text-primary font-bold px-0.5">₹</th>
                )}
                <th className="border-l-4 border-dairy-divider shadow-[inset_4px_0_8px_-4px_hsl(0_80%_55%/0.4)] px-0.5">{language === 'hi' ? 'दूध' : 'M'}</th>
                {!isBuyer && <th className="px-0.5">{language === 'hi' ? 'फैट' : 'F'}</th>}
                {!isBuyer && <th className="px-0.5">SNF</th>}
                {!isBuyer && <th className="px-0.5">LR</th>}
                {((calculationMethod === 'daily_total' && showRakamToCustomers) || isBuyer) && (
                  <th className="text-primary font-bold px-0.5">₹</th>
                )}
              </tr>
            </thead>
            <tbody>
              {getMonthDates().map(date => {
                const entry = getEntryForDate(date);
                const dayNum = Number(date.split('-')[2]);
                const isToday = date === format(new Date(), 'yyyy-MM-dd');
                
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
                  <tr key={date} className={cn(isToday && 'bg-primary/5')}>
                    <td className="font-medium">{dayNum}</td>
                    <td>{entry?.morningMilk ?? '-'}</td>
                    {!isBuyer && <td>{entry?.morningFat ?? '-'}</td>}
                    {!isBuyer && <td>{entry?.morningSNF ?? '-'}</td>}
                    {!isBuyer && <td>{entry?.morningLR ?? '-'}</td>}
                    {((calculationMethod === 'daily_total' && showRakamToCustomers) || isBuyer) && (
                      <td className="text-primary font-bold">{morningAmount !== null ? `₹${morningAmount.toFixed(0)}` : '-'}</td>
                    )}
                    <td className="border-l-4 border-dairy-divider shadow-[inset_4px_0_8px_-4px_hsl(0_80%_55%/0.4)]">{entry?.eveningMilk ?? '-'}</td>
                    {!isBuyer && <td>{entry?.eveningFat ?? '-'}</td>}
                    {!isBuyer && <td>{entry?.eveningSNF ?? '-'}</td>}
                    {!isBuyer && <td>{entry?.eveningLR ?? '-'}</td>}
                    {((calculationMethod === 'daily_total' && showRakamToCustomers) || isBuyer) && (
                      <td className="text-primary font-bold">{eveningAmount !== null ? `₹${eveningAmount.toFixed(0)}` : '-'}</td>
                    )}
                  </tr>
                );
              })}
               {/* Totals and Avg Fat Row */}
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
                        {((calculationMethod === 'daily_total' && showRakamToCustomers) || isBuyer) && (
                          <td className="text-primary">₹{isBuyer ? (totalMorningMilk * literRate).toFixed(0) : totalMorningAmount.toFixed(0)}</td>
                        )}
                        <td className="border-l-4 border-dairy-divider">{totalEveningMilk.toFixed(1)}</td>
                        {!isBuyer && <td>{totalEveningFat.toFixed(1)}</td>}
                        {!isBuyer && <td>-</td>}
                        {!isBuyer && <td>-</td>}
                        {((calculationMethod === 'daily_total' && showRakamToCustomers) || isBuyer) && (
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
                        {calculationMethod === 'daily_total' && showRakamToCustomers && <td>-</td>}
                        <td className="border-l-4 border-dairy-divider">-</td>
                        <td className="font-semibold text-accent">{avgEveningFat.toFixed(2)}</td>
                        <td>-</td>
                        <td>-</td>
                        {calculationMethod === 'daily_total' && showRakamToCustomers && <td>-</td>}
                      </tr>
                      )}
                    </>
                 );
               })()}
            </tbody>
          </table>
        </div>
        </div>
      </main>
    </div>
  );
};

export default SupplierViewCard;
