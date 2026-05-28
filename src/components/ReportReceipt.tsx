import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Printer, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportReceiptData {
  supplierName: string;
  supplierCode: string;
  startDate: string;
  endDate: string;
  totalMilk: number;
  avgFat: number;
  totalFat: number;
  totalAmount: number;
  rate: number;
  dairyName?: string;
  ownerName?: string;
  ownerPhone?: string;
  entries?: Array<{
    date: string;
    morningMilk: number | null;
    morningFat: number | null;
    morningRate?: number | null;
    morningAmount?: number | null;
    eveningMilk: number | null;
    eveningFat: number | null;
    eveningRate?: number | null;
    eveningAmount?: number | null;
  }>;
  productAmount?: number;
  advancePaid?: number;
  advanceReceived?: number;
  avgMilkPerDay?: number;
  avgAmountPerDay?: number;
  avgRate?: number;
}

interface ReportReceiptProps {
  data: ReportReceiptData;
  onClose: () => void;
  outputType?: 'print' | 'pdf' | 'nothing';
  autoPrint?: boolean;
}

// Get bhugtan receipt field settings
const getBhugtanReceiptFields = () => {
  try {
    const saved = localStorage.getItem('bhugtanReceiptFields');
    return saved ? JSON.parse(saved) : {
      showCode: true, showName: true, showDates: true,
      showTotalMilk: true, showTotalFat: true, showAvgFat: true,
      showRate: true, showAmount: true, showRakam: true, showEntryTable: true,
      showMorning: true, showEvening: true,
    };
  } catch {
    return {
      showCode: true, showName: true, showDates: true,
      showTotalMilk: true, showTotalFat: true, showAvgFat: true,
      showRate: true, showAmount: true, showRakam: true, showEntryTable: true,
      showMorning: true, showEvening: true,
    };
  }
};

const ReportReceipt: React.FC<ReportReceiptProps> = ({ data, onClose, outputType = 'print', autoPrint = false }) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const fields = getBhugtanReceiptFields();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handlePrint = () => {
    if (autoPrint) return;

    toast({
      title: language === 'hi' ? 'ब्राउज़र प्रिंट बंद है' : 'Browser print disabled',
      description: language === 'hi' ? 'प्रिंट प्रीव्यू खोलना बंद कर दिया गया है। PDF इस्तेमाल करें।' : 'Print preview has been disabled. Please use PDF.',
      variant: 'destructive',
    });
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 20;

      if (data.ownerName || data.ownerPhone) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const headerLine = [data.ownerName, data.ownerPhone].filter(Boolean).join(' - ');
        doc.text(headerLine, pageWidth - margin, y, { align: 'right' });
        y += 10;
      }

      if (fields.showDates) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Date: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`, pageWidth - margin, y, { align: 'right' });
        y += 12;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const supplierLine = [fields.showCode && data.supplierCode, fields.showName && data.supplierName].filter(Boolean).join(' - ');
      doc.text(supplierLine, margin, y);
      y += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Milk Detail', margin, y);
      y += 7;

      const productAmount = data.productAmount || 0;
      const advancePaid = data.advancePaid || 0;
      const advanceReceived = data.advanceReceived || 0;
      const netPayable = data.totalAmount - productAmount - advancePaid + advanceReceived;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Payable: ${data.totalAmount.toFixed(2)} - ${productAmount.toFixed(2)} (Product) - ${advancePaid.toFixed(2)} (Adv Paid) + ${advanceReceived.toFixed(2)} (Adv Recv) = ${netPayable.toFixed(2)}`,
        margin, y
      );
      y += 6;

      const numDays = data.entries?.length || 1;
      const avgMilkPerDay = data.avgMilkPerDay || (data.totalMilk / numDays);
      const avgAmountPerDay = data.avgAmountPerDay || (data.totalAmount / numDays);
      const avgRate = data.avgRate || (data.totalMilk > 0 ? data.totalAmount / data.totalMilk : 0);

      doc.setFontSize(9);
      if (fields.showTotalMilk) doc.text(`Total Milk : ${data.totalMilk.toFixed(2)} L`, margin, y);
      if (fields.showAmount) doc.text(`Total Amount: ${data.totalAmount.toFixed(2)}`, margin + 80, y);
      doc.text(`Avg. Milk : ${avgMilkPerDay.toFixed(2)} L/Day`, margin + 170, y);
      y += 5;
      doc.text(`Avg. Amount: ${avgAmountPerDay.toFixed(2)}/Day`, margin, y);
      if (fields.showRate) doc.text(`Avg. Rate: ${avgRate.toFixed(2)}`, margin + 80, y);
      y += 8;

      if (fields.showEntryTable && data.entries && data.entries.length > 0) {
        const tableBody: (string | number)[][] = [];
        const sortedEntries = [...data.entries].sort((a, b) => a.date.localeCompare(b.date));
        let tMM = 0, tMF = 0, tMR = 0, tMA = 0, tEM = 0, tEF = 0, tER = 0, tEA = 0;
        let mCount = 0, eCount = 0, mRateCount = 0, eRateCount = 0;

        sortedEntries.forEach(entry => {
          const mMilk = fields.showMorning ? (entry.morningMilk || 0) : 0;
          const mFat = fields.showMorning ? (entry.morningFat || 0) : 0;
          const mRate = entry.morningRate ?? (mFat ? mFat * data.rate : 0);
          const mAmt = entry.morningAmount ?? (mMilk && mFat ? mMilk * mRate : 0);
          
          const eMilk = fields.showEvening ? (entry.eveningMilk || 0) : 0;
          const eFat = fields.showEvening ? (entry.eveningFat || 0) : 0;
          const eRate = entry.eveningRate ?? (eFat ? eFat * data.rate : 0);
          const eAmt = entry.eveningAmount ?? (eMilk && eFat ? eMilk * eRate : 0);
          
          const dayTotal = mAmt + eAmt;

          tMM += mMilk; if (mFat > 0) { tMF += mFat; mCount++; }
          if (mRate > 0) { tMR += mRate; mRateCount++; }
          tMA += mAmt;
          tEM += eMilk; if (eFat > 0) { tEF += eFat; eCount++; }
          if (eRate > 0) { tER += eRate; eRateCount++; }
          tEA += eAmt;

          const row: (string | number)[] = [formatDate(entry.date)];
          if (fields.showMorning) {
            row.push(mMilk > 0 ? mMilk.toFixed(2) : '', mFat > 0 ? mFat.toFixed(2) : '');
            if (fields.showRakam) row.push(mRate > 0 ? mRate.toFixed(2) : '', mAmt > 0 ? mAmt.toFixed(2) : '');
          }
          if (fields.showEvening) {
            row.push(eMilk > 0 ? eMilk.toFixed(2) : '', eFat > 0 ? eFat.toFixed(2) : '');
            if (fields.showRakam) row.push(eRate > 0 ? eRate.toFixed(2) : '', eAmt > 0 ? eAmt.toFixed(2) : '');
          }
          if (fields.showRakam) row.push(dayTotal > 0 ? dayTotal.toFixed(2) : '');
          tableBody.push(row);
        });

        // Totals row
        const totalRow: (string | number)[] = ['Total'];
        if (fields.showMorning) {
          totalRow.push(tMM.toFixed(2), mCount > 0 ? (tMF / mCount).toFixed(2) : '');
          if (fields.showRakam) totalRow.push(mRateCount > 0 ? (tMR / mRateCount).toFixed(2) : '', tMA.toFixed(2));
        }
        if (fields.showEvening) {
          totalRow.push(tEM.toFixed(2), eCount > 0 ? (tEF / eCount).toFixed(2) : '');
          if (fields.showRakam) totalRow.push(eRateCount > 0 ? (tER / eRateCount).toFixed(2) : '', tEA.toFixed(2));
        }
        if (fields.showRakam) totalRow.push((tMA + tEA).toFixed(2));
        tableBody.push(totalRow);

        const headRow1: any[] = [{ content: 'Date', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } }];
        const headRow2: string[] = [];
        const mColSpan = fields.showRakam ? 4 : 2;
        if (fields.showMorning) { headRow1.push({ content: 'Morning', colSpan: mColSpan, styles: { halign: 'center' } }); headRow2.push('Liter', 'Fat'); if (fields.showRakam) headRow2.push('Rate', 'Amount'); }
        if (fields.showEvening) { headRow1.push({ content: 'Evening', colSpan: mColSpan, styles: { halign: 'center' } }); headRow2.push('Liter', 'Fat'); if (fields.showRakam) headRow2.push('Rate', 'Amount'); }
        if (fields.showRakam) headRow1.push({ content: 'Total', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } });

        autoTable(doc, {
          startY: y,
          head: [headRow1, headRow2],
          body: tableBody,
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, lineWidth: 0.3, lineColor: [0, 0, 0], cellPadding: 2 },
          bodyStyles: { fontSize: 8, cellPadding: 1.5, lineWidth: 0.2, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
          margin: { left: margin, right: margin },
          didParseCell: (hookData: any) => {
            if (hookData.row.index === tableBody.length - 1 && hookData.section === 'body') {
              hookData.cell.styles.fontStyle = 'bold';
            }
          }
        });

        const finalY = (doc as any).lastAutoTable?.finalY || (doc as any).previousAutoTable?.finalY || 150;
        let advY = finalY + 8;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Net Payable: Rs. ${netPayable.toFixed(2)}`, margin, advY);
      }

      const pageH = doc.internal.pageSize.getHeight();
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')} | Milk Mitra`, pageWidth / 2, pageH - 5, { align: 'center' });

      const pdfDataUri = doc.output('datauristring');
      const link = document.createElement('a');
      link.href = pdfDataUri;
      link.download = `Milk_Report_${data.supplierCode}_${data.startDate.replace(/-/g, '_')}.pdf`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); }, 100);
    } catch (e) {
      console.error('PDF generation failed:', e);
    }
  };

  React.useEffect(() => {
    if (outputType === 'pdf') {
      handleDownloadPDF();
      onClose();
    }
  }, [outputType]);

  React.useEffect(() => {
    if (autoPrint) {
      // Small delay to ensure the hidden DOM is rendered before printing
      const timer = setTimeout(() => {
        handlePrint();
        onClose();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);


  if (outputType === 'nothing') return null;

  return (
    <div className="space-y-4">
      <div ref={receiptRef} className="bg-white text-black p-4 rounded-lg border-2 border-dashed border-foreground/30 font-mono text-sm">
        <div className="receipt">
          <div className="header text-center border-b border-dashed border-black pb-3 mb-3">
            <h1 className="text-lg font-bold">🥛 {t('appName')}</h1>
            <p className="text-xs">{language === 'hi' ? 'हिसाब रिपोर्ट' : 'Report Receipt'}</p>
          </div>

          <div className="space-y-1 text-xs">
            {fields.showCode && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span>{t('supplierCode')}:</span>
                <span className="font-semibold">{data.supplierCode}</span>
              </div>
            )}
            {fields.showName && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span>{t('name')}:</span>
                <span className="font-semibold">{data.supplierName}</span>
              </div>
            )}
            {fields.showDates && (
              <>
                <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                  <span>{t('fromDate')}:</span>
                  <span className="font-semibold">{formatDate(data.startDate)}</span>
                </div>
                <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                  <span>{t('toDate')}:</span>
                  <span className="font-semibold">{formatDate(data.endDate)}</span>
                </div>
              </>
            )}
          </div>

          <div className="divider border-t border-dashed border-black my-3"></div>

          <div className="space-y-1 text-xs">
            {fields.showTotalMilk && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span>{t('totalMilk')}:</span>
                <span className="font-semibold">{data.totalMilk.toFixed(1)} L</span>
              </div>
            )}
            {fields.showTotalFat && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span>{t('totalFat')}:</span>
                <span className="font-semibold">{data.totalFat.toFixed(1)}</span>
              </div>
            )}
            {fields.showAvgFat && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span>{t('avgFat')}:</span>
                <span className="font-semibold">{data.avgFat.toFixed(2)}</span>
              </div>
            )}
            {fields.showRate && (
              <div className="row flex justify-between py-1 border-b border-dotted border-gray-300">
                <span>{language === 'hi' ? 'रेट/फैट' : 'Rate/Fat'}:</span>
                <span className="font-semibold">₹{data.rate}</span>
              </div>
            )}
          </div>

          {fields.showAmount && (
            <div className="total-row flex justify-between py-2 text-base font-bold border-t-2 border-b-2 border-black my-3">
              <span>{t('totalAmount')}:</span>
              <span>₹{data.totalAmount.toFixed(0)}</span>
            </div>
          )}

          {fields.showRakam && (
            <div className="row flex justify-between py-1 border-b border-dotted border-gray-300 text-xs">
              <span>{language === 'hi' ? 'रकम' : 'Rakam'}:</span>
              <span className="font-bold">₹{data.totalAmount.toFixed(0)}</span>
            </div>
          )}

          {/* Entries table in print receipt */}
          {fields.showEntryTable && data.entries && data.entries.length > 0 && (
            <div className="mt-3">
              <table className="w-full text-[9px] border-collapse">
                <thead>
                  <tr className="border-b border-black">
                    <th className="text-left py-0.5">Date</th>
                    {fields.showMorning && <><th className="text-right py-0.5">🌅L</th><th className="text-right py-0.5">🌅F</th>{fields.showRakam && <th className="text-right py-0.5">🌅₹</th>}</>}
                    {fields.showEvening && <><th className="text-right py-0.5">🌙L</th><th className="text-right py-0.5">🌙F</th>{fields.showRakam && <th className="text-right py-0.5">🌙₹</th>}</>}
                    {fields.showRakam && <th className="text-right py-0.5 font-bold">Total</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...data.entries].sort((a, b) => a.date.localeCompare(b.date)).map((entry, idx) => {
                    const mMilk = fields.showMorning ? (entry.morningMilk || 0) : 0;
                    const mFat = fields.showMorning ? (entry.morningFat || 0) : 0;
                    const mAmt = entry.morningAmount ?? (mMilk && mFat ? mMilk * mFat * data.rate : 0);
                    const eMilk = fields.showEvening ? (entry.eveningMilk || 0) : 0;
                    const eFat = fields.showEvening ? (entry.eveningFat || 0) : 0;
                    const eAmt = entry.eveningAmount ?? (eMilk && eFat ? eMilk * eFat * data.rate : 0);
                    const total = mAmt + eAmt;
                    return (
                      <tr key={idx} className="border-b border-dotted border-gray-300">
                        <td className="py-0.5">{new Date(entry.date).getDate()}</td>
                        {fields.showMorning && (
                          <>
                            <td className="text-right">{mMilk > 0 ? mMilk.toFixed(1) : '-'}</td>
                            <td className="text-right">{mFat > 0 ? mFat.toFixed(1) : '-'}</td>
                            {fields.showRakam && <td className="text-right">{mAmt > 0 ? `₹${mAmt.toFixed(0)}` : '-'}</td>}
                          </>
                        )}
                        {fields.showEvening && (
                          <>
                            <td className="text-right">{eMilk > 0 ? eMilk.toFixed(1) : '-'}</td>
                            <td className="text-right">{eFat > 0 ? eFat.toFixed(1) : '-'}</td>
                            {fields.showRakam && <td className="text-right">{eAmt > 0 ? `₹${eAmt.toFixed(0)}` : '-'}</td>}
                          </>
                        )}
                        {fields.showRakam && <td className="text-right font-bold">{total > 0 ? `₹${total.toFixed(0)}` : '-'}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="footer text-center text-[10px] mt-3 pt-3 border-t border-dashed border-black">
            <p>Thank you! / धन्यवाद!</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handlePrint} className="flex-1" variant="dairy">
          <Printer className="mr-2 h-4 w-4" />
          {language === 'hi' ? 'प्रिंट' : 'Print'}
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" className="flex-1">
          <Download className="mr-2 h-4 w-4" />
          PDF
        </Button>
      </div>
    </div>
  );
};

export default ReportReceipt;
