import { FatSnfRateSettings, calculateRatePerLiterWithSnf } from './fatSnfCalculation';

interface MilkEntry {
  date: string;
  morningMilk: number | null;
  morningFat: number | null;
  morningSNF: number | null;
  eveningMilk: number | null;
  eveningFat: number | null;
  eveningSNF: number | null;
  morningPrice: number | null;
  eveningPrice: number | null;
}

interface CalculationParams {
  entries: MilkEntry[];
  startDate: string;
  endDate: string;
  shiftFilter: 'both' | 'morning' | 'evening';
  rate: number;
  calculationMethod: 'avg_fat' | 'daily_total' | string;
  fatSnfSettings: FatSnfRateSettings;
  animalType?: string;
  literRate?: number;
}

export interface SupplierStats {
  totalMilk: number;
  totalFatSum: number;
  avgFat: number;
  totalAmount: number;
  entryCount: number;
  fatCount: number;
}

/**
 * Unified calculation function used by BOTH Reports and Bhugtan (HisaabReport).
 * Any change here reflects in both places, ensuring amounts always match.
 */
export function calculateSupplierStats(params: CalculationParams): SupplierStats {
  const {
    entries,
    startDate,
    endDate,
    shiftFilter,
    rate,
    calculationMethod,
    fatSnfSettings,
    animalType,
    literRate = 50,
  } = params;

  const filteredEntries = entries.filter(e => e.date >= startDate && e.date <= endDate);

  let totalMilk = 0;
  let totalFatSum = 0;
  let fatCount = 0;
  let dailyTotalAmount = 0;
  const useFatSnfSystem = fatSnfSettings.isEnabled && animalType !== 'buyer';

  filteredEntries.forEach(entry => {
    // Morning
    if ((shiftFilter === 'both' || shiftFilter === 'morning') &&
        entry.morningMilk !== null && entry.morningMilk !== undefined && entry.morningMilk > 0) {
      totalMilk += entry.morningMilk;
      if (entry.morningFat !== null && entry.morningFat !== undefined && entry.morningFat > 0) {
        totalFatSum += entry.morningFat;
        fatCount++;
        if (calculationMethod === 'daily_total') {
          const mSnf = entry.morningSNF || 0;
          const entryRate = useFatSnfSystem && mSnf > 0
            ? calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, mSnf, fatSnfSettings.snfDeductionPerPoint, entry.morningFat!)
            : entry.morningFat! * rate;
          dailyTotalAmount += entry.morningMilk * entryRate;
        }
      } else if (animalType === 'buyer') {
        // For buyers: use price if available, else liter rate
        const price = entry.morningPrice;
        if (price !== null && price !== undefined && price > 0) {
          dailyTotalAmount += price;
        } else {
          dailyTotalAmount += entry.morningMilk * literRate;
        }
      }
    } else if ((shiftFilter === 'both' || shiftFilter === 'morning') && animalType === 'buyer' &&
               entry.morningPrice !== null && entry.morningPrice !== undefined && entry.morningPrice > 0) {
      // Buyer entry with only price, no milk
      dailyTotalAmount += entry.morningPrice;
    }

    // Evening
    if ((shiftFilter === 'both' || shiftFilter === 'evening') &&
        entry.eveningMilk !== null && entry.eveningMilk !== undefined && entry.eveningMilk > 0) {
      totalMilk += entry.eveningMilk;
      if (entry.eveningFat !== null && entry.eveningFat !== undefined && entry.eveningFat > 0) {
        totalFatSum += entry.eveningFat;
        fatCount++;
        if (calculationMethod === 'daily_total') {
          const eSnf = entry.eveningSNF || 0;
          const entryRate = useFatSnfSystem && eSnf > 0
            ? calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, eSnf, fatSnfSettings.snfDeductionPerPoint, entry.eveningFat!)
            : entry.eveningFat! * rate;
          dailyTotalAmount += entry.eveningMilk * entryRate;
        }
      } else if (animalType === 'buyer') {
        const price = entry.eveningPrice;
        if (price !== null && price !== undefined && price > 0) {
          dailyTotalAmount += price;
        } else {
          dailyTotalAmount += entry.eveningMilk * literRate;
        }
      }
    } else if ((shiftFilter === 'both' || shiftFilter === 'evening') && animalType === 'buyer' &&
               entry.eveningPrice !== null && entry.eveningPrice !== undefined && entry.eveningPrice > 0) {
      // Buyer entry with only price, no milk
      dailyTotalAmount += entry.eveningPrice;
    }
  });

  const avgFat = fatCount > 0 ? totalFatSum / fatCount : 0;

  const totalAmount = calculationMethod === 'daily_total'
    ? dailyTotalAmount
    : avgFat * totalMilk * rate;

  return {
    totalMilk,
    totalFatSum,
    avgFat,
    totalAmount,
    entryCount: filteredEntries.length,
    fatCount,
  };
}
