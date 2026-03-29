import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Supplier, MilkEntry } from '@/contexts/DairyContext';

interface ExportData {
  suppliers: Supplier[];
  dairyName: string;
  period: number;
  rateSettings: {
    fatRate: number;
  };
  getSupplierStats: (supplierId: string, days: number) => {
    totalMilk: number;
    totalFat: number;
    avgFat: number;
    totalAmount: number;
    fatEntryCount: number;
  };
}

// Safe PDF download using data URI + hidden anchor (works in sandbox/mobile/APK)
const safePDFDownload = (doc: jsPDF, filename: string) => {
  try {
    const pdfDataUri = doc.output('datauristring');
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Cleanup after short delay
    setTimeout(() => {
      document.body.removeChild(link);
    }, 500);
  } catch (e) {
    console.error('PDF download failed with data URI, trying blob:', e);
    try {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 500);
    } catch (e2) {
      console.error('PDF download blob also failed:', e2);
      // Last resort: open in new window
      window.open(doc.output('bloburl'), '_blank');
    }
  }
};

export const exportToPDF = (data: ExportData) => {
  const { suppliers, dairyName, period, rateSettings, getSupplierStats } = data;
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.text(`${dairyName} - Milk Records Report`, 14, 22);
  
  doc.setFontSize(12);
  doc.text(`Period: Last ${period} Days`, 14, 32);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);
  
  // Summary table
  let totalMilk = 0;
  let totalFat = 0;
  let totalAmount = 0;
  let totalFatEntries = 0;
  
  suppliers.forEach(supplier => {
    const stats = getSupplierStats(supplier.id, period);
    totalMilk += stats.totalMilk;
    totalFat += stats.totalFat;
    totalAmount += stats.totalAmount;
    totalFatEntries += stats.fatEntryCount;
  });
  
  const avgFat = totalFatEntries > 0 ? totalFat / totalFatEntries : 0;
  
  doc.setFontSize(14);
  doc.text('Summary', 14, 55);
  
  autoTable(doc, {
    startY: 60,
    head: [['Total Milk (L)', 'Total Fat', 'Avg Fat', 'Total Amount (₹)']],
    body: [[
      totalMilk.toFixed(1),
      totalFat.toFixed(1),
      avgFat.toFixed(2),
      totalAmount.toFixed(0)
    ]],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
  });
  
  // Supplier-wise data
  doc.setFontSize(14);
  doc.text('Supplier Details', 14, (doc as any).lastAutoTable.finalY + 15);
  
  const supplierRows = suppliers.map(supplier => {
    const stats = getSupplierStats(supplier.id, period);
    const rate = rateSettings.fatRate;
    
    return [
      supplier.name,
      supplier.phone,
      stats.totalMilk.toFixed(1),
      stats.totalFat.toFixed(1),
      stats.avgFat.toFixed(2),
      `₹${rate}`,
      `₹${stats.totalAmount.toFixed(0)}`
    ];
  });
  
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [['Name', 'Phone', 'Milk (L)', 'Total Fat', 'Avg Fat', 'Rate', 'Amount']],
    body: supplierRows,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });
  
  // Daily entries for each supplier
  suppliers.forEach((supplier, index) => {
    if (index > 0 || (doc as any).lastAutoTable.finalY > 200) {
      doc.addPage();
    }
    
    const startY = index === 0 ? (doc as any).lastAutoTable.finalY + 20 : 20;
    
    doc.setFontSize(12);
    doc.text(`${supplier.name} - Daily Entries`, 14, startY);
    
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period);
    
    const relevantEntries = supplier.entries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= startDate && entryDate <= now;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const entryRows = relevantEntries.map(entry => [
      new Date(entry.date).toLocaleDateString(),
      entry.morningMilk?.toFixed(1) || '-',
      entry.morningFat?.toFixed(1) || '-',
      entry.eveningMilk?.toFixed(1) || '-',
      entry.eveningFat?.toFixed(1) || '-',
      ((entry.morningMilk || 0) + (entry.eveningMilk || 0)).toFixed(1)
    ]);
    
    autoTable(doc, {
      startY: startY + 5,
      head: [['Date', 'Morning Milk', 'Morning Fat', 'Evening Milk', 'Evening Fat', 'Daily Total']],
      body: entryRows,
      theme: 'grid',
      headStyles: { fillColor: [34, 197, 94] },
      styles: { fontSize: 8 },
    });
  });
  
  const filename = `${dairyName}_milk_records_${period}days.pdf`;
  safePDFDownload(doc, filename);
};

export const exportToExcel = (data: ExportData) => {
  const { suppliers, dairyName, period, rateSettings, getSupplierStats } = data;
  const wb = XLSX.utils.book_new();
  
  // Summary sheet
  let totalMilk = 0;
  let totalFat = 0;
  let totalAmount = 0;
  let totalFatEntries = 0;
  
  suppliers.forEach(supplier => {
    const stats = getSupplierStats(supplier.id, period);
    totalMilk += stats.totalMilk;
    totalFat += stats.totalFat;
    totalAmount += stats.totalAmount;
    totalFatEntries += stats.fatEntryCount;
  });
  
  const avgFat = totalFatEntries > 0 ? totalFat / totalFatEntries : 0;
  
  const summaryData = [
    ['Dairy Name', dairyName],
    ['Report Period', `Last ${period} Days`],
    ['Generated Date', new Date().toLocaleDateString()],
    [],
    ['Summary'],
    ['Total Milk (L)', totalMilk.toFixed(1)],
    ['Total Fat', totalFat.toFixed(1)],
    ['Average Fat', avgFat.toFixed(2)],
    ['Total Amount (₹)', totalAmount.toFixed(0)],
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
  
  // Supplier summary sheet
  const supplierSummaryData = [
    ['Name', 'Phone', 'Total Milk (L)', 'Total Fat', 'Avg Fat', 'Rate (₹)', 'Total Amount (₹)'],
    ...suppliers.map(supplier => {
      const stats = getSupplierStats(supplier.id, period);
      const rate = rateSettings.fatRate;
      
      return [
        supplier.name,
        supplier.phone,
        stats.totalMilk.toFixed(1),
        stats.totalFat.toFixed(1),
        stats.avgFat.toFixed(2),
        rate,
        stats.totalAmount.toFixed(0)
      ];
    })
  ];
  
  const supplierSheet = XLSX.utils.aoa_to_sheet(supplierSummaryData);
  XLSX.utils.book_append_sheet(wb, supplierSheet, 'Suppliers');
  
  // Daily entries sheet
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - period);
  
  const allEntriesData: any[][] = [
    ['Date', 'Supplier', 'Morning Milk (L)', 'Morning Fat', 'Morning SNF', 'Morning LR', 'Evening Milk (L)', 'Evening Fat', 'Evening SNF', 'Evening LR', 'Daily Total (L)']
  ];
  
  suppliers.forEach(supplier => {
    const relevantEntries = supplier.entries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= startDate && entryDate <= now;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    relevantEntries.forEach(entry => {
      allEntriesData.push([
        entry.date,
        supplier.name,
        entry.morningMilk || '',
        entry.morningFat || '',
        entry.morningSNF || '',
        entry.morningLR || '',
        entry.eveningMilk || '',
        entry.eveningFat || '',
        entry.eveningSNF || '',
        entry.eveningLR || '',
        (entry.morningMilk || 0) + (entry.eveningMilk || 0)
      ]);
    });
  });
  
  const entriesSheet = XLSX.utils.aoa_to_sheet(allEntriesData);
  XLSX.utils.book_append_sheet(wb, entriesSheet, 'Daily Entries');
  
  XLSX.writeFile(wb, `${dairyName}_milk_records_${period}days.xlsx`);
};
