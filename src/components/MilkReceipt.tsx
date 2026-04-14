import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Printer } from 'lucide-react';

interface ReceiptData {
  date: string;
  supplierName: string;
  supplierId: string;
  supplierCode?: string;
  villageName?: string;
  animalType?: string;
  timeOfDay: 'morning' | 'evening';
  quantity: number;
  fat: number | null;
  snf: number | null;
  lr: number | null;
  rate: number;
  dairyName?: string;
}

interface MilkReceiptProps {
  data: ReceiptData;
  onClose: () => void;
  autoPrint?: boolean;
}

// Helper to get receipt field settings from localStorage
const getEntryReceiptFields = () => {
  try {
    const saved = localStorage.getItem('entryReceiptFields');
    return saved ? JSON.parse(saved) : {
      showDate: true, showTime: true, showCode: true, showName: true,
      showMilkType: true, showQuantity: true, showFat: true, showSnf: true,
      showLr: true, showRate: true, showAmount: true, showPaymentMode: true,
    };
  } catch {
    return {
      showDate: true, showTime: true, showCode: true, showName: true,
      showMilkType: true, showQuantity: true, showFat: true, showSnf: true,
      showLr: true, showRate: true, showAmount: true, showPaymentMode: true,
    };
  }
};

const MilkReceipt: React.FC<MilkReceiptProps> = ({ data, onClose, autoPrint = false }) => {
  const { t } = useLanguage();
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank'>('cash');
  const receiptRef = useRef<HTMLDivElement>(null);
  const fields = getEntryReceiptFields();
  const hasPrinted = useRef(false);

  // Auto-print on mount when autoPrint is true, then auto-close
  useEffect(() => {
    if (autoPrint && !hasPrinted.current) {
      hasPrinted.current = true;
      const timer = setTimeout(() => {
        handlePrint();
        // Auto-close after print
        setTimeout(() => onClose(), 1500);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = () => {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const calculateAmount = () => {
    if (data.fat === null || data.fat === 0) return 0;
    return data.fat * data.quantity * data.rate;
  };

  const getMilkType = () => {
    switch (data.animalType) {
      case 'cow': return t('cow');
      case 'buffalo': return t('buffalo');
      case 'goat': return t('goat');
      default: return 'Mixed';
    }
  };

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);
    
    const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Milk Receipt</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; font-size: 12px; padding: 10px; max-width: 80mm; margin: 0 auto; }
            .receipt { border: 2px solid #000; padding: 10px; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .header h1 { font-size: 16px; font-weight: bold; }
            .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; font-weight: bold; border-top: 2px solid #000; border-bottom: 2px solid #000; margin: 10px 0; }
            .footer { text-align: center; font-size: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #000; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
        </html>
      `);
      frameDoc.close();
      
      printFrame.onload = () => {
        setTimeout(() => {
          try { printFrame.contentWindow?.focus(); printFrame.contentWindow?.print(); } catch (e) {}
          setTimeout(() => { document.body.removeChild(printFrame); }, 1000);
        }, 300);
      };
      
      setTimeout(() => {
        try { printFrame.contentWindow?.focus(); printFrame.contentWindow?.print(); } catch (e) {}
        setTimeout(() => { if (document.body.contains(printFrame)) document.body.removeChild(printFrame); }, 1000);
      }, 500);
    }
  };

  return (
    <div className="space-y-4">
      {fields.showPaymentMode && (
        <div className="flex gap-2">
          <Button variant={paymentMode === 'cash' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setPaymentMode('cash')}>
            💵 {t('cash')}
          </Button>
          <Button variant={paymentMode === 'bank' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setPaymentMode('bank')}>
            🏦 {t('bankTransfer')}
          </Button>
        </div>
      )}

      <div ref={receiptRef} className="bg-white text-black p-4 rounded-lg border-2 border-dashed border-foreground/30 font-mono text-sm">
        <div className="receipt">
          <div className="header text-center border-b border-dashed border-black pb-3 mb-3">
            <h1 className="text-lg font-bold">🥛 {data.dairyName || t('appName')}</h1>
            <p className="text-xs">{t('milkReceipt')}</p>
          </div>

          <div className="space-y-1 text-xs">
            {fields.showDate && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span className="label">{t('date')}:</span>
                <span className="value font-semibold">{formatDate(data.date)}</span>
              </div>
            )}
            {fields.showTime && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span className="label">Time:</span>
                <span className="value font-semibold">{formatTime()}</span>
              </div>
            )}
            {fields.showCode && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span className="label">{t('supplierCode')}:</span>
                <span className="value font-semibold">{data.supplierCode || data.supplierId.slice(0, 8).toUpperCase()}</span>
              </div>
            )}
            {fields.showName && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span className="label">{t('name')}:</span>
                <span className="value font-semibold">{data.supplierName}</span>
              </div>
            )}
            {fields.showMilkType && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span className="label">{t('milkType')}:</span>
                <span className="value font-semibold">{getMilkType()}</span>
              </div>
            )}
          </div>

          <div className="divider border-t border-dashed border-black my-3"></div>

          <div className="space-y-1 text-xs">
            {fields.showQuantity && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span className="label">{t('quantity')} ({t('liters')}):</span>
                <span className="value font-semibold">{data.quantity.toFixed(1)} L</span>
              </div>
            )}
            {fields.showLr && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span className="label">{t('lr')}:</span>
                <span className="value font-semibold">{data.lr ?? '-'}</span>
              </div>
            )}
            {fields.showFat && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span className="label">{t('fat')} %:</span>
                <span className="value font-semibold">{data.fat ?? '-'}</span>
              </div>
            )}
            {fields.showSnf && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span className="label">{t('snf')} %:</span>
                <span className="value font-semibold">{data.snf ?? '-'}</span>
              </div>
            )}
            {fields.showRate && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span className="label">{t('ratePerUnit')}:</span>
                <span className="value font-semibold">₹{data.rate}/{t('fat')}</span>
              </div>
            )}
          </div>

          {fields.showAmount && (
            <div className="total-row flex justify-between py-2 text-base font-bold border-t-2 border-b-2 border-black my-3">
              <span>{t('totalAmount')}:</span>
              <span>₹{calculateAmount().toFixed(0)}</span>
            </div>
          )}

          {fields.showPaymentMode && (
            <div className="row flex justify-between py-1 text-xs">
              <span className="label">{t('paymentMode')}:</span>
              <span className="value font-semibold">{paymentMode === 'cash' ? t('cash') : t('bankTransfer')}</span>
            </div>
          )}

          <div className="footer text-center text-[10px] mt-3 pt-3 border-t border-dashed border-black">
            <p>Thank you! / धन्यवाद!</p>
            <p>{data.timeOfDay === 'morning' ? '🌅' : '🌙'} {t(data.timeOfDay)}</p>
          </div>
        </div>
      </div>

      <Button onClick={handlePrint} className="w-full" variant="dairy">
        <Printer className="mr-2 h-5 w-5" />
        {t('printReceipt')}
      </Button>
    </div>
  );
};

export default MilkReceipt;
