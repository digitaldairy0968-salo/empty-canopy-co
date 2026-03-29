/**
 * FAT/SNF Rate Calculation Utility
 * 
 * SNF-Based Deduction Formula (CORRECTED):
 * - Deduction is applied based on SNF, NOT FAT
 * - For every 0.1 decrease in SNF from baseSNF, the RATE PER LITER decreases
 * 
 * Formula:
 * SNFPoints = (BaseSNF - CurrentSNF) / 0.1
 * BaseRatePerLiter = FAT × BaseFatRate
 * Deduction = SNFPoints × SNFDeductionPerPoint (this is ₹ per liter deduction)
 * RatePerLiter = BaseRatePerLiter - Deduction
 * TotalAmount = MilkQuantity × RatePerLiter
 * 
 * Example:
 * BaseFatRate = ₹8, BaseSNF = 9.5, SNFDeduction = ₹0.2
 * If FAT = 5.0 and SNF = 9.4:
 * BaseRate = 5.0 × 8 = ₹40
 * Deduction = 1 × 0.2 = ₹0.2 (1 point because 9.5-9.4=0.1)
 * FinalRate = 40 - 0.2 = ₹39.8 per liter
 */

export interface FatSnfRateSettings {
  isEnabled: boolean;
  baseFatRate: number;      // Base FAT Rate (e.g., 8)
  baseSNF: number;          // Base SNF (e.g., 9.5)
  snfDeductionPerPoint: number; // ₹ reduction per 0.1 SNF decrease (e.g., 0.2)
  fatMin: number;           // Minimum FAT (e.g., 3.0)
  fatMax: number;           // Maximum FAT (e.g., 9.0)
  fatStep: number;          // FAT step (e.g., 0.1, 0.5, or 1.0)
  snfMin: number;           // Minimum SNF (e.g., 9.0)
  snfMax: number;           // Maximum SNF (e.g., 9.5)
}

export interface RateChartCell {
  fat: number;
  snf: number;
  rate: number;
}

export interface RateChart {
  fatValues: number[];
  snfValues: number[];
  cells: RateChartCell[][];
}

/**
 * Calculate rate per liter based on FAT and SNF
 * SNF deduction is applied to the final rate per liter, not the FAT rate
 */
export function calculateRatePerLiterWithSnf(
  baseFatRate: number,
  baseSNF: number,
  currentSNF: number,
  snfDeductionPerPoint: number,
  fat: number
): number {
  // Base rate = FAT × BaseFatRate
  const baseRatePerLiter = fat * baseFatRate;
  
  // Calculate SNF points difference (positive = SNF is lower than base)
  const snfPoints = Math.round((baseSNF - currentSNF) / 0.1 * 10) / 10;
  
  // Only apply deduction when SNF is BELOW base (snfPoints > 0)
  // SNF above base does NOT increase rate
  const deduction = snfPoints > 0 ? snfPoints * snfDeductionPerPoint : 0;
  
  // Final rate per liter (ensure it doesn't go negative)
  return Math.max(0, baseRatePerLiter - deduction);
}

/**
 * Calculate adjusted FAT rate based on SNF (legacy function for compatibility)
 * @deprecated Use calculateRatePerLiterWithSnf instead
 */
export function calculateAdjustedFatRate(
  baseFatRate: number,
  baseSNF: number,
  currentSNF: number,
  snfDeductionPerPoint: number
): number {
  const snfDiff = (baseSNF - currentSNF) / 0.1;
  const adjustedRate = baseFatRate - (snfDiff * snfDeductionPerPoint);
  return Math.max(0, adjustedRate); // Ensure rate doesn't go negative
}

/**
 * Calculate rate per liter (legacy function)
 */
export function calculateRatePerLiter(fat: number, adjustedFatRate: number): number {
  return fat * adjustedFatRate;
}

/**
 * Calculate total amount
 */
export function calculateTotalAmount(quantity: number, ratePerLiter: number): number {
  return quantity * ratePerLiter;
}

/**
 * Calculate milk entry using FAT/SNF rate chart with CORRECT SNF-based deduction
 */
export function calculateFatSnfEntry(
  settings: FatSnfRateSettings,
  quantity: number,
  fat: number,
  snf: number
): {
  adjustedFatRate: number;
  ratePerLiter: number;
  totalAmount: number;
  snfDeduction: number;
  warning?: string;
} {
  // Base rate per liter = FAT × BaseFatRate
  const baseRatePerLiter = fat * settings.baseFatRate;
  
  // Calculate SNF points difference
  const snfPoints = Math.round((settings.baseSNF - snf) / 0.1 * 10) / 10;
  
  // Only apply deduction when SNF is BELOW base (snfPoints > 0)
  // SNF above base does NOT increase rate
  const snfDeduction = snfPoints > 0 ? snfPoints * settings.snfDeductionPerPoint : 0;
  
  // Final rate per liter
  const ratePerLiter = Math.max(0, baseRatePerLiter - snfDeduction);
  
  // Total amount
  const totalAmount = quantity * ratePerLiter;
  
  // For backward compatibility, calculate an "adjusted FAT rate"
  const adjustedFatRate = fat > 0 ? ratePerLiter / fat : 0;
  
  let warning: string | undefined;
  if (snf < settings.snfMin) {
    warning = `SNF ${snf} is below minimum ${settings.snfMin}`;
  }

  return {
    adjustedFatRate,
    ratePerLiter,
    totalAmount,
    snfDeduction,
    warning
  };
}

/**
 * Generate rate chart matrix with scrollable/slidable support
 */
export function generateRateChart(settings: FatSnfRateSettings): RateChart {
  const fatValues: number[] = [];
  const snfValues: number[] = [];
  
  // Generate FAT values using integer math to avoid floating-point errors
  const fatSteps = Math.round((settings.fatMax - settings.fatMin) / settings.fatStep);
  for (let i = 0; i <= fatSteps; i++) {
    fatValues.push(parseFloat((settings.fatMin + i * settings.fatStep).toFixed(1)));
  }
  
  // Generate SNF values using integer math (always 0.1 step)
  const snfSteps = Math.round((settings.snfMax - settings.snfMin) / 0.1);
  for (let i = 0; i <= snfSteps; i++) {
    snfValues.push(parseFloat((settings.snfMin + i * 0.1).toFixed(1)));
  }
  
  // Generate cells matrix using correct SNF deduction logic
  const cells: RateChartCell[][] = fatValues.map(fat => 
    snfValues.map(snf => {
      const rate = calculateRatePerLiterWithSnf(
        settings.baseFatRate,
        settings.baseSNF,
        snf,
        settings.snfDeductionPerPoint,
        fat
      );
      return {
        fat,
        snf,
        rate: parseFloat(rate.toFixed(2))
      };
    })
  );
  
  return { fatValues, snfValues, cells };
}

/**
 * Look up rate from chart for given FAT and SNF values
 * Uses nearest matching values
 */
export function lookupRate(
  chart: RateChart,
  fat: number,
  snf: number
): number | null {
  // Find nearest FAT value
  let nearestFatIndex = 0;
  let minFatDiff = Math.abs(chart.fatValues[0] - fat);
  
  for (let i = 1; i < chart.fatValues.length; i++) {
    const diff = Math.abs(chart.fatValues[i] - fat);
    if (diff < minFatDiff) {
      minFatDiff = diff;
      nearestFatIndex = i;
    }
  }
  
  // Find nearest SNF value
  let nearestSnfIndex = 0;
  let minSnfDiff = Math.abs(chart.snfValues[0] - snf);
  
  for (let i = 1; i < chart.snfValues.length; i++) {
    const diff = Math.abs(chart.snfValues[i] - snf);
    if (diff < minSnfDiff) {
      minSnfDiff = diff;
      nearestSnfIndex = i;
    }
  }
  
  return chart.cells[nearestFatIndex]?.[nearestSnfIndex]?.rate ?? null;
}

/**
 * Default FAT/SNF rate settings
 */
export const defaultFatSnfSettings: FatSnfRateSettings = {
  isEnabled: false,
  baseFatRate: 8,
  baseSNF: 9.5,
  snfDeductionPerPoint: 0.2,
  fatMin: 3.0,
  fatMax: 9.0,
  fatStep: 0.1, // Default to 0.1 step for FAT
  snfMin: 9.0,
  snfMax: 9.5
};
