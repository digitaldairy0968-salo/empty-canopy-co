import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Shield, ToggleLeft, ToggleRight, Hash, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Master feature list
const MASTER_FEATURES = [
  {
    key: 'entry_settings',
    label: 'Entry Settings (Advanced)',
    description: 'FAT/SNF Machine Connect, Auto-fill Milk, Auto Code Direction, Prefill Settings',
    subFeatures: ['connect_fat_machine', 'auto_fill_milk', 'auto_code_direction', 'prefill_settings']
  },
  {
    key: 'customer_code',
    label: '12-Digit Customer Code',
    description: 'Suppliers can join dairy via 12-digit code on their phone to view milk card',
  }
];

const AdminDairyFeatures: React.FC = () => {
  const { dairyId } = useParams<{ dairyId: string }>();
  const navigate = useNavigate();
  const [dairyName, setDairyName] = useState('');
  const [dairyCode, setDairyCode] = useState<string | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (dairyId) fetchData();
  }, [dairyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get dairy info
      const { data: dairy } = await supabase
        .from('dairies')
        .select('name, code')
        .eq('id', dairyId!)
        .single();
      
      if (dairy) {
        setDairyName(dairy.name);
        setDairyCode(dairy.code);
      }

      // Get existing features
      const { data: featureData } = await supabase
        .from('dairy_features')
        .select('feature_key, is_enabled')
        .eq('dairy_id', dairyId!);

      const featureMap: Record<string, boolean> = {};
      MASTER_FEATURES.forEach(f => { featureMap[f.key] = false; });
      featureData?.forEach((f: any) => { featureMap[f.feature_key] = f.is_enabled; });
      setFeatures(featureMap);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (featureKey: string, enabled: boolean) => {
    setSaving(featureKey);
    try {
      const { error } = await supabase
        .from('dairy_features')
        .upsert({
          dairy_id: dairyId!,
          feature_key: featureKey,
          is_enabled: enabled,
        }, { onConflict: 'dairy_id,feature_key' });

      if (error) throw error;

      // If enabling customer_code, generate a 12-digit code if dairy doesn't have one
      if (featureKey === 'customer_code' && enabled) {
        if (!dairyCode || dairyCode.length !== 12) {
          const newCode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
          const { error: codeError } = await supabase
            .from('dairies')
            .update({ code: newCode })
            .eq('id', dairyId!);
          
          if (!codeError) {
            setDairyCode(newCode);
            toast.success(`12-digit code generated: ${newCode}`);
          }
        }
      }

      // If disabling customer_code, remove the code
      if (featureKey === 'customer_code' && !enabled) {
        await supabase
          .from('dairies')
          .update({ code: null })
          .eq('id', dairyId!);
        setDairyCode(null);
      }

      setFeatures(prev => ({ ...prev, [featureKey]: enabled }));
      toast.success(`${enabled ? 'Enabled' : 'Disabled'}: ${MASTER_FEATURES.find(f => f.key === featureKey)?.label}`);
    } catch (error) {
      console.error('Error toggling feature:', error);
      toast.error('Failed to update feature');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="dairy-header px-4 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{dairyName}</h1>
              <p className="text-primary-foreground/70 text-sm">Feature Control</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        {/* Dairy Code Status */}
        {dairyCode && (
          <div className="dairy-card bg-green-50 dark:bg-green-950/20 border-green-200">
            <div className="flex items-center gap-3">
              <Hash className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">12-Digit Customer Code</p>
                <p className="text-lg font-mono font-bold tracking-wider">{dairyCode}</p>
              </div>
            </div>
          </div>
        )}

        {/* Feature Toggles */}
        <div className="space-y-3">
          {MASTER_FEATURES.map(feature => (
            <div key={feature.key} className="dairy-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {features[feature.key] ? (
                      <ToggleRight className="h-5 w-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold">{feature.label}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
                  {feature.key === 'customer_code' && features[feature.key] && dairyCode && (
                    <p className="text-xs font-mono mt-2 bg-muted p-2 rounded">Code: {dairyCode}</p>
                  )}
                </div>
                <Switch
                  checked={features[feature.key] || false}
                  onCheckedChange={(checked) => toggleFeature(feature.key, checked)}
                  disabled={saving === feature.key}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          When a feature is OFF (locked), the dairy owner cannot use it but it remains visible (disabled) in their app.
        </p>
      </main>
    </div>
  );
};

export default AdminDairyFeatures;
