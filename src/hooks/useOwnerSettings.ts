import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OwnerSettings {
  usesPrinter: boolean;
  milkBuyingBasis: 'fat' | 'fat_snf';
  calculationSystem: 'avg_fat' | 'daily_total';
  onboardingCompleted: boolean;
  dairyNameForPdf: string | null;
  autoPrintEnabled: boolean;
  bluetoothFatMachineConnected: boolean;
  bluetoothPrinterConnected: boolean;
  showRakamToCustomers: boolean;
  bhugtanOutputType: 'print' | 'pdf' | 'nothing';
  codeDirection: 'forward' | 'reverse';
  prefillEnabled: boolean;
  prefillFat: number | null;
  prefillSnf: number | null;
  prefillLr: number | null;
}

const defaultSettings: OwnerSettings = {
  usesPrinter: false,
  milkBuyingBasis: 'fat',
  calculationSystem: 'avg_fat',
  onboardingCompleted: false,
  dairyNameForPdf: null,
  autoPrintEnabled: false,
  bluetoothFatMachineConnected: false,
  bluetoothPrinterConnected: false,
  showRakamToCustomers: true,
  bhugtanOutputType: 'print',
  codeDirection: 'forward',
  prefillEnabled: false,
  prefillFat: null,
  prefillSnf: null,
  prefillLr: null,
};

export function useOwnerSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<OwnerSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.dairyId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('owner_settings')
          .select('*')
          .eq('dairy_id', user.dairyId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSettings({
            usesPrinter: (data as any).uses_printer ?? false,
            milkBuyingBasis: (data as any).milk_buying_basis ?? 'fat',
            calculationSystem: (data as any).calculation_system ?? 'avg_fat',
            onboardingCompleted: (data as any).onboarding_completed ?? false,
            dairyNameForPdf: (data as any).dairy_name_for_pdf ?? null,
            autoPrintEnabled: (data as any).auto_print_enabled ?? false,
            bluetoothFatMachineConnected: (data as any).bluetooth_fat_machine_connected ?? false,
            bluetoothPrinterConnected: (data as any).bluetooth_printer_connected ?? false,
            showRakamToCustomers: (data as any).show_rakam_to_customers ?? true,
            bhugtanOutputType: (data as any).bhugtan_output_type ?? 'print',
            codeDirection: (data as any).code_direction ?? 'forward',
            prefillEnabled: (data as any).prefill_enabled ?? false,
            prefillFat: (data as any).prefill_fat ?? null,
            prefillSnf: (data as any).prefill_snf ?? null,
            prefillLr: (data as any).prefill_lr ?? null,
          });
        }
      } catch (error) {
        console.error('Error fetching owner settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user?.dairyId]);

  const updateSettings = async (updates: Partial<OwnerSettings>) => {
    if (!user?.dairyId) return false;

    setSaving(true);
    try {
      const dbUpdates: any = {};
      if (updates.usesPrinter !== undefined) dbUpdates.uses_printer = updates.usesPrinter;
      if (updates.milkBuyingBasis !== undefined) dbUpdates.milk_buying_basis = updates.milkBuyingBasis;
      if (updates.calculationSystem !== undefined) dbUpdates.calculation_system = updates.calculationSystem;
      if (updates.onboardingCompleted !== undefined) dbUpdates.onboarding_completed = updates.onboardingCompleted;
      if (updates.dairyNameForPdf !== undefined) dbUpdates.dairy_name_for_pdf = updates.dairyNameForPdf;
      if (updates.autoPrintEnabled !== undefined) dbUpdates.auto_print_enabled = updates.autoPrintEnabled;
      if (updates.bluetoothFatMachineConnected !== undefined) dbUpdates.bluetooth_fat_machine_connected = updates.bluetoothFatMachineConnected;
      if (updates.bluetoothPrinterConnected !== undefined) dbUpdates.bluetooth_printer_connected = updates.bluetoothPrinterConnected;
      if (updates.showRakamToCustomers !== undefined) dbUpdates.show_rakam_to_customers = updates.showRakamToCustomers;
      if (updates.bhugtanOutputType !== undefined) dbUpdates.bhugtan_output_type = updates.bhugtanOutputType;
      if (updates.codeDirection !== undefined) dbUpdates.code_direction = updates.codeDirection;
      if (updates.prefillEnabled !== undefined) dbUpdates.prefill_enabled = updates.prefillEnabled;
      if (updates.prefillFat !== undefined) dbUpdates.prefill_fat = updates.prefillFat;
      if (updates.prefillSnf !== undefined) dbUpdates.prefill_snf = updates.prefillSnf;
      if (updates.prefillLr !== undefined) dbUpdates.prefill_lr = updates.prefillLr;

      const { error } = await supabase
        .from('owner_settings')
        .upsert({
          dairy_id: user.dairyId,
          ...dbUpdates,
        } as any, { onConflict: 'dairy_id' });

      if (error) throw error;

      setSettings(prev => ({ ...prev, ...updates }));
      return true;
    } catch (error) {
      console.error('Error updating owner settings:', error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    settings,
    loading,
    saving,
    updateSettings,
  };
}
