import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Plus, Trash2, Check, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FEATURE_CATALOG, getFeatureDef } from '@/lib/featureCatalog';


interface Variety {
  id: string;
  name: string;
  description: string | null;
  features: string[];
  is_active: boolean;
}

interface VarietyPlan {
  id: string;
  variety_id: string;
  name: string;
  price: number;
  validity_days: number;
  is_active: boolean;
}

const AdminVarieties: React.FC = () => {
  const navigate = useNavigate();
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [plans, setPlans] = useState<VarietyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // New variety form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newFeatures, setNewFeatures] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  // New plan form
  const [selectedVariety, setSelectedVariety] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planDays, setPlanDays] = useState('30');
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [vRes, pRes] = await Promise.all([
        supabase.from('subscription_varieties').select('*').order('created_at', { ascending: true }),
        supabase.from('variety_plans').select('*').order('price', { ascending: true }),
      ]);

      setVarieties((vRes.data || []).map((v: any) => ({
        ...v,
        features: Array.isArray(v.features) ? v.features : []
      })));
      setPlans(pRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const addVariety = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('subscription_varieties').insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        features: newFeatures,
      });
      if (error) throw error;
      toast.success('Variety added');
      setNewName(''); setNewDesc(''); setNewFeatures([]);
      fetchData(false);

    } catch (e) {
      toast.error('Failed to add variety');
    } finally {
      setSaving(false);
    }
  };

  const deleteVariety = async (id: string) => {
    if (!confirm('Delete this variety and all its plans?')) return;
    try {
      await supabase.from('subscription_varieties').delete().eq('id', id);
      toast.success('Variety deleted');
      fetchData(false);
    } catch (e) {
      toast.error('Failed');
    }
  };

  const toggleVariety = async (id: string, active: boolean) => {
    await supabase.from('subscription_varieties').update({ is_active: active }).eq('id', id);
    fetchData(false);
  };

  const addPlan = async () => {
    if (!selectedVariety || !planName || !planPrice) return;
    setSavingPlan(true);
    try {
      const { error } = await supabase.from('variety_plans').insert({
        variety_id: selectedVariety,
        name: planName.trim(),
        price: parseFloat(planPrice) || 100,
        validity_days: parseInt(planDays) || 30,
      });
      if (error) throw error;
      toast.success('Plan added');
      setPlanName(''); setPlanPrice(''); setPlanDays('30');
      fetchData(false);
    } catch (e) {
      toast.error('Failed');
    } finally {
      setSavingPlan(false);
    }
  };

  const deletePlan = async (id: string) => {
    await supabase.from('variety_plans').delete().eq('id', id);
    fetchData(false);
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/subscriptions')} className="text-primary-foreground hover:bg-primary-foreground/20">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-full flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Subscription Varieties</h1>
              <p className="text-primary-foreground/70 text-sm">Manage tiers & plans</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Add Variety */}
        <div className="dairy-card space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Variety
          </h3>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Variety Name (e.g. Basic, Pro, Premium)" />
          <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Short description (optional)" />
          <div>
            <Label className="text-xs">Features (one per line)</Label>
            <Textarea value={newFeatures} onChange={e => setNewFeatures(e.target.value)} placeholder="Milk Entry&#10;Reports&#10;Calculator" rows={4} />
          </div>
          <Button onClick={addVariety} disabled={saving || !newName.trim()} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            {saving ? 'Adding...' : 'Add Variety'}
          </Button>
        </div>

        {/* Existing Varieties */}
        {varieties.map(v => (
          <div key={v.id} className="dairy-card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg">{v.name}</h3>
                {v.description && <p className="text-sm text-muted-foreground">{v.description}</p>}
                {v.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {v.features.map((f: string, i: number) => (
                      <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{f}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => toggleVariety(v.id, !v.is_active)}>
                  {v.is_active ? <Check className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteVariety(v.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            {/* Plans for this variety */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-semibold">Plans:</p>
              {plans.filter(p => p.variety_id === v.id).length === 0 ? (
                <p className="text-xs text-muted-foreground">No plans yet</p>
              ) : (
                plans.filter(p => p.variety_id === v.id).map(plan => (
                  <div key={plan.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div>
                      <span className="font-medium">{plan.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">₹{plan.price} • {plan.validity_days} days</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deletePlan(plan.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))
              )}

              {/* Quick add plan */}
              {selectedVariety === v.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Plan name" className="text-sm" />
                    <Input type="number" value={planPrice} onChange={e => setPlanPrice(e.target.value)} placeholder="₹ Price" className="text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Select value={planDays} onValueChange={setPlanDays}>
                      <SelectTrigger className="text-sm h-9">
                        <SelectValue placeholder="Validity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">1 Month</SelectItem>
                        <SelectItem value="180">6 Months</SelectItem>
                        <SelectItem value="365">1 Year</SelectItem>
                        <SelectItem value="36500">Permanently</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={addPlan} disabled={savingPlan}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setSelectedVariety(v.id)} className="w-full text-xs gap-1">
                  <Plus className="h-3 w-3" /> Add Plan
                </Button>
              )}
            </div>
          </div>
        ))}

        {varieties.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No varieties created yet. Add one above.</p>
        )}
      </main>
    </div>
  );
};

export default AdminVarieties;
