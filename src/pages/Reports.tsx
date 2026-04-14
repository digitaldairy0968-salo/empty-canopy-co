import React, { useState, useMemo } from 'react';
import { FileText, Download, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy } from '@/contexts/DairyContext';
import { useAuth } from '@/contexts/AuthContext';
import { exportToPDF } from '@/utils/exportData';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useFatSnfRateSettings } from '@/hooks/useFatSnfRateSettings';
import { calculateSupplierStats } from '@/utils/supplierCalculation';

const Reports: React.FC = () => {
  const { t, language } = useLanguage();
  const { suppliers, getSupplierStats, rateSettings } = useDairy();
  const { user } = useAuth();
  const { settings: fatSnfSettings } = useFatSnfRateSettings();
  
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [shiftFilter, setShiftFilter] = useState<'both' | 'morning' | 'evening'>('both');
  const [showSupplierList, setShowSupplierList] = useState(false);
  

  const defaultRate = rateSettings.fatRate;
  const calculationMethod = rateSettings.calculationMethod || 'avg_fat';

  const handleExportPDF = () => {
    if (suppliers.length === 0) {
      toast.error(t('noData'));
      return;
    }
    exportToPDF({ suppliers, dairyName: user?.dairyName || 'Dairy', period: 30, rateSettings, getSupplierStats });
    toast.success('PDF exported successfully!');
  };

  // Calculate per-supplier stats for the selected date range
  const supplierReportData = useMemo(() => {
    if (!startDate || !endDate) return null;
    
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    
    let supplierTotalMilk = 0;
    let supplierTotalAmount = 0;
    let buyerTotalMilk = 0;
    let buyerTotalAmount = 0;
    
    const data = suppliers.map(supplier => {
      const stats = calculateSupplierStats({
        entries: supplier.entries,
        startDate: startStr,
        endDate: endStr,
        shiftFilter,
        rate: defaultRate,
        calculationMethod,
        fatSnfSettings: fatSnfSettings,
        animalType: supplier.animalType,
        literRate: rateSettings.literRate || 50,
      });
      
      if (supplier.animalType === 'buyer') {
        buyerTotalMilk += stats.totalMilk;
        buyerTotalAmount += stats.totalAmount;
      } else {
        supplierTotalMilk += stats.totalMilk;
        supplierTotalAmount += stats.totalAmount;
      }
      
      return { supplier, totalMilk: stats.totalMilk, avgFat: stats.avgFat, totalAmount: stats.totalAmount, entryCount: stats.entryCount };
    }).filter(d => d.totalMilk > 0 || d.totalAmount > 0);
    
    return { data, supplierTotalMilk, supplierTotalAmount, buyerTotalMilk, buyerTotalAmount };
  }, [suppliers, startDate, endDate, shiftFilter, defaultRate, fatSnfSettings, rateSettings]);

  

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-4">{t('reports')}</h2>

        {/* Export Button - PDF only */}
        <div className="flex gap-2 mb-6">
          <Button variant="outline" onClick={handleExportPDF} className="flex-1">
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>

        {/* Custom Date Range */}
        <div className="dairy-card mb-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">
              {language === 'hi' ? 'कस्टम तारीख रेंज' : 'Custom Date Range'}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
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

          <div className="flex bg-muted rounded-full p-1 mb-4">
            <button onClick={() => setShiftFilter('morning')} className={cn("flex-1 px-3 py-2 rounded-full text-sm font-medium transition-all", shiftFilter === 'morning' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground")}>
              🌅 {t('morning')}
            </button>
            <button onClick={() => setShiftFilter('evening')} className={cn("flex-1 px-3 py-2 rounded-full text-sm font-medium transition-all", shiftFilter === 'evening' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground")}>
              🌙 {t('evening')}
            </button>
            <button onClick={() => setShiftFilter('both')} className={cn("flex-1 px-3 py-2 rounded-full text-sm font-medium transition-all", shiftFilter === 'both' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground")}>
              {t('both')}
            </button>
          </div>

          {startDate && endDate && (
            <Button onClick={() => setShowSupplierList(true)} className="w-full mb-4" variant="dairy">
              {language === 'hi' ? '📊 रिपोर्ट बनाएं' : '📊 Generate Report'}
            </Button>
          )}

          {supplierReportData && showSupplierList && (
            <div className="space-y-3 animate-fade-in">
              {/* Supplier Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-4 bg-primary/10 rounded-xl">
                  <p className="text-sm text-muted-foreground">{language === 'hi' ? 'सप्लायर दूध' : 'Supplier Milk'}</p>
                  <p className="text-2xl font-bold text-primary">{supplierReportData.supplierTotalMilk.toFixed(1)} L</p>
                </div>
                <div className="text-center p-4 bg-accent/10 rounded-xl">
                  <p className="text-sm text-muted-foreground">{language === 'hi' ? 'सप्लायर राशि' : 'Supplier Amount'}</p>
                  <p className="text-2xl font-bold text-accent">₹{supplierReportData.supplierTotalAmount.toFixed(0)}</p>
                </div>
              </div>
              {/* Buyer Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-4 bg-secondary/10 rounded-xl">
                  <p className="text-sm text-muted-foreground">{language === 'hi' ? 'खरीदार दूध' : 'Buyer Milk'}</p>
                  <p className="text-2xl font-bold text-secondary-foreground">{supplierReportData.buyerTotalMilk.toFixed(1)} L</p>
                </div>
                <div className="text-center p-4 bg-secondary/10 rounded-xl">
                  <p className="text-sm text-muted-foreground">{language === 'hi' ? 'खरीदार राशि' : 'Buyer Amount'}</p>
                  <p className="text-2xl font-bold text-secondary-foreground">₹{supplierReportData.buyerTotalAmount.toFixed(0)}</p>
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <h4 className="font-semibold text-sm text-muted-foreground">
                  {language === 'hi' ? `${supplierReportData.data.length} ग्राहकों की रिपोर्ट` : `Report for ${supplierReportData.data.length} suppliers`}
                </h4>
                {supplierReportData.data.map(item => (
                    <div key={item.supplier.id} className="p-3 bg-muted/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">#{item.supplier.code}</span>
                          <span className="font-semibold text-sm">{item.supplier.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">₹{item.totalAmount.toFixed(0)}</p>
                          <p className="text-[10px] text-muted-foreground">{item.totalMilk.toFixed(1)}L • avg {item.avgFat.toFixed(1)}</p>
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          )}

          {!startDate || !endDate ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              {language === 'hi' ? 'तारीख चुनें' : 'Select dates'}
            </p>
          ) : null}
        </div>

        {suppliers.length === 0 && (
          <div className="dairy-card text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Reports;
