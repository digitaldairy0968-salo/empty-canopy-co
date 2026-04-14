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
    if ((shiftFilter === 'both' || shiftFilter === 'morning')) {
      const mMilk = entry.morningMilk ?? 0;
      const mFat = entry.morningFat ?? 0;
      const mPrice = entry.morningPrice ?? 0;
      
      if (animalType === 'buyer') {
        // Buyer: match supplier card rakam logic — milk × literRate first, direct price only as fallback
        if (mMilk > 0) {
          dailyTotalAmount += mMilk * literRate;
          totalMilk += mMilk;
        } else if (mPrice > 0) {
          dailyTotalAmount += mPrice;
        }
      } else if (mMilk > 0) {
        totalMilk += mMilk;
        if (mFat > 0) {
          totalFatSum += mFat;
          fatCount++;
          if (calculationMethod === 'daily_total') {
            const mSnf = entry.morningSNF || 0;
            const entryRate = useFatSnfSystem && mSnf > 0
              ? calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, mSnf, fatSnfSettings.snfDeductionPerPoint, mFat)
              : mFat * rate;
            dailyTotalAmount += mMilk * entryRate;
          }
        }
      }
    }

    // Evening
    if ((shiftFilter === 'both' || shiftFilter === 'evening')) {
      const eMilk = entry.eveningMilk ?? 0;
      const eFat = entry.eveningFat ?? 0;
      const ePrice = entry.eveningPrice ?? 0;
      
      if (animalType === 'buyer') {
        if (eMilk > 0) {
          dailyTotalAmount += eMilk * literRate;
          totalMilk += eMilk;
        } else if (ePrice > 0) {
          dailyTotalAmount += ePrice;
        }
      } else if (eMilk > 0) {
        totalMilk += eMilk;
        if (eFat > 0) {
          totalFatSum += eFat;
          fatCount++;
          if (calculationMethod === 'daily_total') {
            const eSnf = entry.eveningSNF || 0;
            const entryRate = useFatSnfSystem && eSnf > 0
              ? calculateRatePerLiterWithSnf(fatSnfSettings.baseFatRate, fatSnfSettings.baseSNF, eSnf, fatSnfSettings.snfDeductionPerPoint, eFat)
              : eFat * rate;
            dailyTotalAmount += eMilk * entryRate;
          }
        }
      }
    }
  });

  const avgFat = fatCount > 0 ? totalFatSum / fatCount : 0;

  const totalAmount = (calculationMethod === 'daily_total' || animalType === 'buyer')
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
