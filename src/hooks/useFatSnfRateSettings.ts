import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FatSnfRateSettings, defaultFatSnfSettings, generateRateChart, RateChart } from '@/utils/fatSnfCalculation';

const CACHE_KEY = 'dairy_app_fat_snf_settings';

export function useFatSnfRateSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<FatSnfRateSettings>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : defaultFatSnfSettings;
  });
  const [rateChart, setRateChart] = useState<RateChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user?.dairyId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('fat_snf_rate_settings')
        .select('*')
        .eq('dairy_id', user.dairyId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching FAT/SNF settings:', error);
        return;
      }

      if (data) {
        const newSettings: FatSnfRateSettings = {
          isEnabled: data.is_enabled,
          baseFatRate: Number(data.base_fat_rate),
          baseSNF: Number(data.base_snf),
          snfDeductionPerPoint: Number(data.snf_deduction_per_point),
          fatMin: Number(data.fat_min),
          fatMax: Number(data.fat_max),
          fatStep: Number(data.fat_step),
          snfMin: Number(data.snf_min),
          snfMax: Number(data.snf_max),
        };
        setSettings(newSettings);
        localStorage.setItem(CACHE_KEY, JSON.stringify(newSettings));
        
        // Generate rate chart
        if (newSettings.isEnabled) {
          setRateChart(generateRateChart(newSettings));
        }
      }
    } catch (error) {
      console.error('Error fetching FAT/SNF settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.dairyId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = useCallback(async (newSettings: FatSnfRateSettings): Promise<boolean> => {
    if (!user?.dairyId) return false;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('fat_snf_rate_settings')
        .upsert({
          dairy_id: user.dairyId,
          is_enabled: newSettings.isEnabled,
          base_fat_rate: newSettings.baseFatRate,
          base_snf: newSettings.baseSNF,
          snf_deduction_per_point: newSettings.snfDeductionPerPoint,
          fat_min: newSettings.fatMin,
          fat_max: newSettings.fatMax,
          fat_step: newSettings.fatStep,
          snf_min: newSettings.snfMin,
          snf_max: newSettings.snfMax,
        }, {
          onConflict: 'dairy_id'
        });

      if (error) {
        console.error('Error saving FAT/SNF settings:', error);
        return false;
      }

      setSettings(newSettings);
      localStorage.setItem(CACHE_KEY, JSON.stringify(newSettings));
      
      // Update rate chart
      if (newSettings.isEnabled) {
        setRateChart(generateRateChart(newSettings));
      } else {
        setRateChart(null);
      }

      return true;
    } catch (error) {
      console.error('Error saving FAT/SNF settings:', error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.dairyId]);

  const toggleEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    return saveSettings({ ...settings, isEnabled: enabled });
  }, [settings, saveSettings]);

  return {
    settings,
    rateChart,
    loading,
    saving,
    saveSettings,
    toggleEnabled,
    refreshSettings: fetchSettings,
  };
}
