import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Milk, TrendingUp, ChevronLeft, ChevronRight, CalendarIcon, Filter, History, ArrowDownCircle, ArrowUpCircle, Bell, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy, MilkEntry } from '@/contexts/DairyContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useFatSnfRateSettings } from '@/hooks/useFatSnfRateSettings';
import { calculateRatePerLiterWithSnf } from '@/utils/fatSnfCalculation';
import { calculateSupplierStats } from '@/utils/supplierCalculation';

interface PaymentHistoryEntry {
  id: string;
  transaction_date: string;
  amount_added: number;
  amount_paid: number;
  balance_after: number;
  notes: string | null;
  created_at: string;
  supplier_confirmed: boolean | null;
}

const SupplierDashboard: React.FC = () => {
  const { t, language } = useLanguage();
  const { getSupplierByPhone, getSupplierStats, rateSettings, suppliers, refreshData } = useDairy();
  const { user } = useAuth();
  const { settings: fatSnfSettings } = useFatSnfRateSettings();

  const supplier = user ? getSupplierByPhone(user.phone) : undefined;
  const stats = supplier ? getSupplierStats(supplier.id, 10) : null;
  const supplierData = supplier ? suppliers.find(s => s.id === supplier.id) : undefined;

  const rate = rateSettings.fatRate;
  const showCalculations = supplier?.canSeeCalculations ?? rateSettings.showCalculationsToSuppliers;
  const calculationMethod = rateSettings.calculationMethod || 'avg_fat';

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showRakamToCustomers, setShowRakamToCustomers] = useState(true);
  const [customerCodeEnabled, setCustomerCodeEnabled] = useState<boolean | null>(null);

  // Date range filter
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [timeFilter, setTimeFilter] = useState<'morning' | 'evening' | 'both'>('both');

  // Payment history
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Pending payment confirmations - only for actual bhugtan (amount_paid > 0), not for bakaya additions
  const pendingPayments = paymentHistory.filter(p => (p.amount_paid || 0) > 0 && p.supplier_confirmed === null);

  const handleConfirmPayment = async (paymentId: string, confirmed: boolean) => {
    try {
      const payment = paymentHistory.find(p => p.id === paymentId);
      
      const { error: rpcError } = await supabase.rpc('confirm_supplier_payment', { _payment_id: paymentId, _confirmed: confirmed });
      if (rpcError) throw rpcError;

      // If confirmed (हां), NOW deduct the amount from supplier's pending_balance
      if (confirmed && payment && (payment.amount_paid || 0) > 0 && supplierData?.id) {
        const { data: supplierRecord } = await supabase
          .from('suppliers')
          .select('pending_balance')
          .eq('id', supplierData.id)
          .single();
        
        if (supplierRecord) {
          const newBalance = (supplierRecord.pending_balance || 0) - (payment.amount_paid || 0);
          
          // Update supplier's actual pending_balance
          await supabase
            .from('suppliers')
            .update({ pending_balance: newBalance })
            .eq('id', supplierData.id);

          // Also update the payment history entry's balance_after to reflect the true balance
          await supabase
            .from('payment_history')
            .update({ balance_after: newBalance } as any)
            .eq('id', paymentId);
        }
      }
      // If rejected (नहीं), do nothing - balance was never deducted

      setPaymentHistory(prev => prev.map(p => p.id === paymentId ? { ...p, supplier_confirmed: confirmed } : p));
      // Refresh context so Kul Bakaya updates immediately
      await refreshData();

      // Re-fetch payment history to get updated balance_after values
      if (supplierData?.id) {
        const { data } = await supabase
          .from('payment_history')
          .select('*')
          .eq('supplier_id', supplierData.id)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false });
        if (data) setPaymentHistory(data);
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
    }
  };

  // Check if customer_code feature is enabled for this dairy
  useEffect(() => {
    const checkCustomerCodeFeature = async () => {
      if (!user?.dairyId) return;
      try {
        const { data } = await supabase
          .from('dairy_features')
          .select('is_enabled')
          .eq('dairy_id', user.dairyId)
          .eq('feature_key', 'customer_code')
          .maybeSingle();
        setCustomerCodeEnabled(data?.is_enabled ?? false);
      } catch (error) {
        console.error('Error checking customer_code feature:', error);
      }
    };
    checkCustomerCodeFeature();
  }, [user?.dairyId]);

  // Fetch owner settings
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

  // Fetch payment history for supplier
  useEffect(() => {
    const fetchHistory = async () => {
      if (!supplierData?.id) return;
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('payment_history')
          .select('*')
          .eq('supplier_id', supplierData.id)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false });
        if (!error && data) {
          setPaymentHistory(data);
        }
      } catch (error) {
        console.error('Error fetching payment history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [supplierData?.id]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getMonthDates = () => {
    const days = getDaysInMonth(currentMonth);
    const dates: string[] = [];
    for (let i = 1; i <= days; i++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      dates.push(format(d, 'yyyy-MM-dd'));
    }
    return dates;
  };

  const getEntryForDate = (date: string): MilkEntry | undefined => {
    return supplierData?.entries.find(e => e.date === date);
  };

  const changeMonth = (delta: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Custom range stats
  const getCustomRangeStats = () => {
    if (!startDate || !endDate || !supplierData) return null;
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    
    const stats = calculateSupplierStats({
      entries: supplierData.entries,
      startDate: startStr,
      endDate: endStr,
      shiftFilter: timeFilter,
      rate,
      calculationMethod,
      fatSnfSettings,
      animalType: supplierData.animalType,
      literRate: rateSettings.literRate || 50,
    });
    
    return { totalMilk: stats.totalMilk, avgFat: stats.avgFat, totalAmount: stats.totalAmount, morningTotalAmount: 0, eveningTotalAmount: 0 };
  };

  const customRangeStats = getCustomRangeStats();

  // Block access if customer_code feature is disabled
  if (customerCodeEnabled === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="dairy-card text-center py-12 max-w-sm animate-fade-in">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">एक्सेस बंद है</h2>
          <p className="text-muted-foreground text-sm">
            इस डेयरी का कस्टमर कोड अभी बंद है। कृपया डेयरी मालिक या एडमिन से संपर्क करें।
          </p>
          <p className="text-muted-foreground text-xs mt-2">
            Access is currently disabled for this dairy. Please contact the dairy owner or admin.
          </p>
        </div>
      </div>
    );
  }

  if (!supplier || !supplierData) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        <main className="px-4 py-6 max-w-4xl mx-auto">
          <div className="dairy-card text-center py-12 animate-fade-in">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-muted-foreground">{t('noData')}</p>
            <p className="text-sm text-muted-foreground mt-2">
              कृपया डेयरी मालिक से संपर्क करें
            </p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header with Supplier Info */}
      <header className="dairy-header px-4 py-4">
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <div className="w-14 h-14 bg-primary-foreground/20 rounded-full flex items-center justify-center">
            <span className="text-3xl">🥛</span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary-foreground">{supplier.name}</h1>
            {user?.dairyName && (
              <p className="text-sm text-primary-foreground/80">{user.dairyName}</p>
            )}
            {supplier.code && (
              <p className="text-xs text-primary-foreground/60">#{supplier.code}</p>
            )}
           </div>
         </div>
       </header>

       <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
         {/* Kul Bakaya (Total Balance) */}
         {supplierData && (
           <div className="dairy-card animate-fade-in bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">{language === 'hi' ? 'कुल बकाया (शेष राशि)' : 'Total Balance'}</p>
                 <p className={cn("text-2xl font-bold", (supplierData.pendingBalance || 0) > 0 ? "text-amber-600" : "text-green-600")}>
                   ₹{Math.abs(supplierData.pendingBalance || 0).toLocaleString()}
                 </p>
               </div>
               <span className="text-3xl">💰</span>
             </div>
           </div>
         )}
        {/* Payment Confirmation Banner */}
        {pendingPayments.length > 0 && (
          <div className="dairy-card animate-fade-in border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-center gap-2 mb-3">
              <Banknote className="h-5 w-5 text-amber-600" />
              <h3 className="font-bold text-amber-700 dark:text-amber-400">
                {language === 'hi' ? '💰 क्या आपने पैसे प्राप्त किए?' : '💰 Did you receive the money?'}
              </h3>
            </div>
            <div className="space-y-2">
              {pendingPayments.map(p => (
                <div key={p.id} className="p-3 bg-card rounded-xl border flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-lg">₹{((p.amount_paid || 0) > 0 ? (p.amount_paid || 0) : (p.amount_added || 0)).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(p.transaction_date), 'dd/MM/yyyy')}
                      {p.notes && ` • ${p.notes}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs px-2" onClick={() => handleConfirmPayment(p.id, true)}>
                      {language === 'hi' ? 'हां' : 'Yes'}
                    </Button>
                    <Button size="sm" variant="destructive" className="text-xs px-2" onClick={() => handleConfirmPayment(p.id, false)}>
                      {language === 'hi' ? 'नहीं' : 'No'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Date Range Stats */}
        {showCalculations && (
          <div className="dairy-card animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">{t('customDateRange')}</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t('fromDate')}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : t('selectDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t('toDate')}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : t('selectDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <Button variant={timeFilter === 'morning' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setTimeFilter('morning')}>🌅 {t('morning')}</Button>
              <Button variant={timeFilter === 'evening' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setTimeFilter('evening')}>🌙 {t('evening')}</Button>
              <Button variant={timeFilter === 'both' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setTimeFilter('both')}>{t('both')}</Button>
            </div>

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
                <div className="col-span-2 text-center p-2 bg-primary/10 rounded-lg">
                  <p className="text-xs text-muted-foreground">{t('totalAmount')}</p>
                  <p className="text-xl font-bold text-primary">₹{customRangeStats.totalAmount.toFixed(0)}</p>
                </div>
              </div>
            )}

            {(!startDate || !endDate) && (
              <p className="text-center text-sm text-muted-foreground py-4">{t('selectDate')}</p>
            )}
          </div>
        )}

        {/* Month Card Table */}
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

          <div className="overflow-x-auto -mx-5 px-1">
            <table className="milk-table text-[9px]">
              <thead>
                 {(() => {
                   const isBuyer = supplierData?.animalType === 'buyer';
                   const colCount = isBuyer ? 2 : (showRakamToCustomers ? 5 : 4);
                   return (
                   <>
                   <tr>
                   <th rowSpan={2} className="w-6 px-0.5">{language === 'hi' ? 'दि' : 'D'}</th>
                   <th colSpan={colCount} className="bg-primary/10 px-0.5">🌅</th>
                   <th colSpan={colCount} className="border-l-4 border-dairy-divider shadow-[inset_4px_0_8px_-4px_hsl(0_80%_55%/0.4)] bg-accent/10 px-0.5">🌙</th>
                 </tr>
                 <tr>
                   <th className="px-0.5">{language === 'hi' ? 'दूध' : 'M'}</th>
                   {!isBuyer && <th className="px-0.5">{language === 'hi' ? 'फैट' : 'F'}</th>}
                   {!isBuyer && <th className="px-0.5">SNF</th>}
                   {!isBuyer && <th className="px-0.5">LR</th>}
                   {(isBuyer || showRakamToCustomers) && (
                     <th className="text-primary font-bold px-0.5">₹</th>
                   )}
                   <th className="border-l-4 border-dairy-divider shadow-[inset_4px_0_8px_-4px_hsl(0_80%_55%/0.4)] px-0.5">{language === 'hi' ? 'दूध' : 'M'}</th>
                   {!isBuyer && <th className="px-0.5">{language === 'hi' ? 'फैट' : 'F'}</th>}
                   {!isBuyer && <th className="px-0.5">SNF</th>}
                   {!isBuyer && <th className="px-0.5">LR</th>}
                   {(isBuyer || showRakamToCustomers) && (
                     <th className="text-primary font-bold px-0.5">₹</th>
                   )}
                 </tr>
                   </>
                   );
                 })()}
              </thead>
              <tbody>
                {getMonthDates().map(date => {
                  const entry = getEntryForDate(date);
                  const dayNum = Number(date.split('-')[2]);
                  const isToday = date === format(new Date(), 'yyyy-MM-dd');
                  const isBuyer = supplierData?.animalType === 'buyer';
                  const literRate = rateSettings.literRate || 50;

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
                       {(isBuyer || showRakamToCustomers) && (
                         <td className="text-primary font-bold">{morningAmount !== null ? `₹${morningAmount.toFixed(0)}` : '-'}</td>
                       )}
                       <td className="border-l-4 border-dairy-divider shadow-[inset_4px_0_8px_-4px_hsl(0_80%_55%/0.4)]">{entry?.eveningMilk ?? '-'}</td>
                       {!isBuyer && <td>{entry?.eveningFat ?? '-'}</td>}
                       {!isBuyer && <td>{entry?.eveningSNF ?? '-'}</td>}
                       {!isBuyer && <td>{entry?.eveningLR ?? '-'}</td>}
                       {(isBuyer || showRakamToCustomers) && (
                         <td className="text-primary font-bold">{eveningAmount !== null ? `₹${eveningAmount.toFixed(0)}` : '-'}</td>
                       )}
                    </tr>
                  );
                })}
                {/* Totals Row */}
                {(() => {
                  const monthDates = getMonthDates();
                  let totalMorningMilk = 0, totalEveningMilk = 0;
                  let totalMorningFat = 0, totalEveningFat = 0;
                  let morningFatCount = 0, eveningFatCount = 0;
                  let totalMorningAmount = 0, totalEveningAmount = 0;

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
                      {(() => {
                        const isBuyer = supplierData?.animalType === 'buyer';
                        const literRate = rateSettings.literRate || 50;
                        return (
                        <>
                      <tr className="bg-primary/10 font-bold border-t-2 border-primary">
                        <td className="text-primary">{t('total')}</td>
                        <td>{totalMorningMilk.toFixed(1)}</td>
                        {!isBuyer && <td>{totalMorningFat.toFixed(1)}</td>}
                        {!isBuyer && <td>-</td>}
                        {!isBuyer && <td>-</td>}
                         {(isBuyer || showRakamToCustomers) && (
                           <td className="text-primary">₹{isBuyer ? (totalMorningMilk * literRate).toFixed(0) : totalMorningAmount.toFixed(0)}</td>
                         )}
                         <td className="border-l-4 border-dairy-divider">{totalEveningMilk.toFixed(1)}</td>
                         {!isBuyer && <td>{totalEveningFat.toFixed(1)}</td>}
                         {!isBuyer && <td>-</td>}
                         {!isBuyer && <td>-</td>}
                         {(isBuyer || showRakamToCustomers) && (
                           <td className="text-primary">₹{isBuyer ? (totalEveningMilk * literRate).toFixed(0) : totalEveningAmount.toFixed(0)}</td>
                         )}
                      </tr>
                      {!isBuyer && (
                      <tr className="bg-muted/30 text-xs text-muted-foreground">
                        <td className="font-medium">{language === 'hi' ? 'एवग' : 'Avg'}</td>
                        <td>-</td>
                        <td className="font-semibold text-primary">{avgMorningFat.toFixed(2)}</td>
                        <td>-</td><td>-</td>
                         {showRakamToCustomers && <td>-</td>}
                         <td className="border-l-4 border-dairy-divider">-</td>
                         <td className="font-semibold text-accent">{avgEveningFat.toFixed(2)}</td>
                         <td>-</td><td>-</td>
                         {showRakamToCustomers && <td>-</td>}
                      </tr>
                      )}
                        </>
                        );
                      })()}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History Section */}
        <div className="dairy-card animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-primary" />
            <h3 className="font-bold">{language === 'hi' ? 'भुगतान हिस्ट्री' : 'Payment History'}</h3>
          </div>

          {loadingHistory ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              {language === 'hi' ? 'लोड हो रहा है...' : 'Loading...'}
            </p>
          ) : (() => {
            // Filter: payment records (amount_paid > 0) only show after supplier confirms
            const visibleHistory = paymentHistory.filter(entry => {
              const isPaid = (entry.amount_paid || 0) > 0;
              // For bhugtan records: only show if supplier confirmed
              if (isPaid) return entry.supplier_confirmed === true;
              // For bakaya additions: always show
              return true;
            });
            return visibleHistory.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                {language === 'hi' ? 'कोई भुगतान हिस्ट्री नहीं' : 'No payment history'}
              </p>
            ) : (
              <div className="space-y-2">
                {visibleHistory.map(entry => {
                  const isPaid = (entry.amount_paid || 0) > 0;
                  return (
                    <div key={entry.id} className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border",
                      isPaid ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                    )}>
                      {isPaid ? (
                        <ArrowUpCircle className="h-5 w-5 text-green-600 shrink-0" />
                      ) : (
                        <ArrowDownCircle className="h-5 w-5 text-amber-600 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {isPaid
                            ? `${language === 'hi' ? 'भुगतान' : 'Paid'}: ₹${(entry.amount_paid || 0).toLocaleString()}`
                            : `${language === 'hi' ? 'बकाया जोड़ा' : 'Added'}: ₹${(entry.amount_added || 0).toLocaleString()}`
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.transaction_date), 'dd/MM/yyyy')}
                          {entry.notes && ` • ${entry.notes}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{language === 'hi' ? 'शेष' : 'Bal'}</p>
                        <p className={cn("text-sm font-bold", entry.balance_after > 0 ? "text-amber-600" : "text-green-600")}>
                          ₹{Math.abs(entry.balance_after).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default SupplierDashboard;
