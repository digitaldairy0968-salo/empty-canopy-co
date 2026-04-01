import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Key, CreditCard, Copy, RefreshCw, Trash2, Users, Check, Ban, Clock, Plus, Edit3, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SubscriptionSettings {
  id: string;
  monthly_price: number;
  upi_id: string;
  qr_code_url: string | null;
  admin_phone: string;
  default_validity_days: number;
  auth_page_image_url: string | null;
  demo_days?: number;
}

interface ActivationCode {
  id: string;
  code: string;
  validity_days: number;
  is_used: boolean;
  used_at: string | null;
  dairy_id: string | null;
  created_at: string;
}

interface Subscription {
  id: string;
  dairy_id: string;
  status: string;
  started_at: string | null;
  expires_at: string | null;
  created_at: string;
  dairy_name?: string;
}

const AdminSubscriptions: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SubscriptionSettings | null>(null);
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [upiId, setUpiId] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [defaultValidityDays, setDefaultValidityDays] = useState('30');
  const [defaultValidityPreset, setDefaultValidityPreset] = useState('30');
  const [validityDays, setValidityDays] = useState('30');
  const [validityPreset, setValidityPreset] = useState('30');
  const [codesCount, setCodesCount] = useState('1');
  const [demoDays, setDemoDays] = useState('9');

  // Payment plans state
  const [plans, setPlans] = useState<any[]>([]);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanDays, setNewPlanDays] = useState('30');
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const { data: settingsData } = await supabase
        .from('subscription_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (settingsData) {
        setSettings(settingsData);
        setMonthlyPrice(settingsData.monthly_price.toString());
        setUpiId(settingsData.upi_id);
        setAdminPhone(settingsData.admin_phone);
        const days = settingsData.default_validity_days?.toString() || '30';
        setDefaultValidityDays(days);
        setDefaultValidityPreset(['1', '7', '15', '30', '90', '180', '365'].includes(days) ? days : 'custom');
        setDemoDays((settingsData as any).demo_days?.toString() || '9');
      }

      // Fetch codes
      const { data: codesData } = await supabase
        .from('activation_codes')
        .select('*')
        .order('created_at', { ascending: false });

      setCodes(codesData || []);

      // Fetch payment plans
      const { data: plansData } = await supabase
        .from('payment_plans')
        .select('*')
        .order('price', { ascending: true });
      setPlans(plansData || []);

      // Fetch subscriptions with dairy names
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (subsData) {
        // Get dairy names
        const dairyIds = subsData.map(s => s.dairy_id);
        const { data: dairies } = await supabase
          .from('dairies')
          .select('id, name')
          .in('id', dairyIds);

        const dairyMap = new Map(dairies?.map(d => [d.id, d.name]));
        setSubscriptions(subsData.map(s => ({
          ...s,
          dairy_name: dairyMap.get(s.dairy_id) || 'Unknown'
        })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settingsPayload = {
        monthly_price: parseFloat(monthlyPrice) || 100,
        upi_id: upiId,
        admin_phone: adminPhone,
        default_validity_days: parseInt(defaultValidityDays) || 30,
        demo_days: parseInt(demoDays) || 9,
        updated_at: new Date().toISOString()
      } as any;

      if (settings?.id) {
        // Update existing
        const { error } = await supabase
          .from('subscription_settings')
          .update(settingsPayload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('subscription_settings')
          .insert(settingsPayload);
        if (error) throw error;
      }

      toast.success('Settings saved');
      fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const uploadQRCode = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings?.id) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `qr-code-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('qr-codes')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('qr-codes')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('subscription_settings')
        .update({ qr_code_url: publicUrl })
        .eq('id', settings.id);

      if (updateError) throw updateError;
      toast.success('QR Code uploaded');
      fetchData();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDefaultValidityPresetChange = (value: string) => {
    setDefaultValidityPreset(value);
    if (value !== 'custom') {
      setDefaultValidityDays(value);
    }
  };

  const handleValidityPresetChange = (value: string) => {
    setValidityPreset(value);
    if (value !== 'custom') {
      setValidityDays(value);
    }
  };

  const generateCodes = async () => {
    if (!user?.id) return;

    setGenerating(true);
    try {
      const count = parseInt(codesCount) || 1;
      const validity = parseInt(validityDays) || parseInt(defaultValidityDays) || 30;
      const newCodes = [];

      for (let i = 0; i < count; i++) {
        const code = generateRandomCode();
        newCodes.push({
          code,
          validity_days: validity,
          created_by: user.id
        });
      }

      const { error } = await supabase
        .from('activation_codes')
        .insert(newCodes);

      if (error) throw error;
      toast.success(`${count} code${count > 1 ? 's' : ''} generated (${validity} days each)`);
      fetchData();
    } catch (error) {
      console.error('Error generating codes:', error);
      toast.error('Failed to generate codes');
    } finally {
      setGenerating(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        return true;
      } catch (err) {
        return false;
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const copyCode = async (code: string) => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopiedCode(code);
      toast.success('Code copied');
      setTimeout(() => setCopiedCode(null), 2000);
    } else {
      toast.error('Failed to copy');
    }
  };

  const deleteCode = async (id: string) => {
    try {
      const { error } = await supabase
        .from('activation_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Code deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  const banDairy = async (dairyId: string, dairyName: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY BAN "${dairyName}"? This will set expiry to past and mark as banned.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'banned',
          expires_at: new Date('2000-01-01').toISOString()
        })
        .eq('dairy_id', dairyId);

      if (error) throw error;
      toast.success(`${dairyName} has been banned permanently`);
      fetchData();
    } catch (error) {
      console.error('Error banning dairy:', error);
      toast.error('Failed to ban dairy');
    }
  };

  const extendSubscriptionByMonths = async (dairyId: string, dairyName: string, months: number) => {
    try {
      const sub = subscriptions.find(s => s.dairy_id === dairyId);
      const currentExpiry = sub?.expires_at ? new Date(sub.expires_at) : new Date();
      const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()));
      newExpiry.setMonth(newExpiry.getMonth() + months);

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          expires_at: newExpiry.toISOString()
        })
        .eq('dairy_id', dairyId);

      if (error) throw error;
      toast.success(`${dairyName} extended by ${months} month(s)`);
      fetchData();
    } catch (error) {
      console.error('Error extending subscription:', error);
      toast.error('Failed to extend subscription');
    }
  };

  const extendSubscription = async (dairyId: string, dairyName: string, days: number) => {
    try {
      const sub = subscriptions.find(s => s.dairy_id === dairyId);
      const currentExpiry = sub?.expires_at ? new Date(sub.expires_at) : new Date();
      const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()));
      newExpiry.setDate(newExpiry.getDate() + days);

      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'active', expires_at: newExpiry.toISOString() })
        .eq('dairy_id', dairyId);

      if (error) throw error;
      toast.success(`${dairyName} extended by ${days} days`);
      fetchData();
    } catch (error) {
      console.error('Error extending subscription:', error);
      toast.error('Failed to extend subscription');
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
      {/* Header */}
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
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Subscription Management</h1>
              <p className="text-primary-foreground/70 text-sm">Manage payments & codes</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto">
        <Tabs defaultValue="settings">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings" className="gap-1 text-xs">
              <Settings className="h-3 w-3" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-1 text-xs">
              <Package className="h-3 w-3" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="codes" className="gap-1 text-xs">
              <Key className="h-3 w-3" />
              Codes
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-1 text-xs">
              <Users className="h-3 w-3" />
              Active
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="dairy-card space-y-4">
              <h3 className="font-semibold">Payment Settings</h3>

              <div className="space-y-2">
                <Label>UPI ID</Label>
                <Input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="yourname@upi"
                />
              </div>

              <div className="space-y-2">
                <Label>Admin Phone (with country code)</Label>
                <Input
                  type="text"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="919876543210"
                />
              </div>

              <div className="space-y-2">
                <Label>QR Code</Label>
                {settings?.qr_code_url && (
                  <img 
                    src={settings.qr_code_url} 
                    alt="QR Code" 
                    className="w-32 h-32 border rounded-lg mb-2"
                  />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={uploadQRCode}
                  disabled={uploading}
                />
                {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
              </div>

              {/* Auth Page Image Upload */}
              <div className="space-y-2">
                <Label>Auth Page Image (above डेयरी प्रबंधक)</Label>
                <p className="text-xs text-muted-foreground">This image will animate on the role selection page</p>
                {settings?.auth_page_image_url && (
                  <img 
                    src={settings.auth_page_image_url} 
                    alt="Auth Page Image" 
                    className="w-24 h-24 border rounded-lg mb-2 object-contain"
                  />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !settings?.id) return;
                    setUploading(true);
                    try {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `auth-image-${Date.now()}.${fileExt}`;
                      const { error: uploadError } = await supabase.storage
                        .from('auth-images')
                        .upload(fileName, file);
                      if (uploadError) throw uploadError;
                      const { data: { publicUrl } } = supabase.storage
                        .from('auth-images')
                        .getPublicUrl(fileName);
                      const { error: updateError } = await supabase
                        .from('subscription_settings')
                        .update({ auth_page_image_url: publicUrl } as any)
                        .eq('id', settings.id);
                      if (updateError) throw updateError;
                      toast.success('Auth page image uploaded');
                      fetchData();
                    } catch (error) {
                      console.error('Upload error:', error);
                      toast.error('Failed to upload');
                    } finally {
                      setUploading(false);
                    }
                  }}
                  disabled={uploading}
                />
              </div>

              <div className="space-y-2">
                <Label>Demo Days (Free Trial)</Label>
                <Input
                  type="number"
                  value={demoDays}
                  onChange={(e) => setDemoDays(e.target.value)}
                  placeholder="9"
                  min="1"
                />
                <p className="text-xs text-muted-foreground">New users ko kitne din ka free demo milega</p>
              </div>

              <Button 
                onClick={saveSettings} 
                disabled={saving}
                className="w-full"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </TabsContent>

          {/* Payment Plans Tab */}
          <TabsContent value="plans" className="space-y-4 mt-4">
            <div className="dairy-card space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Add New Payment Plan
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Plan Name</Label>
                  <Input value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder="e.g. Yearly" />
                </div>
                <div className="space-y-1">
                  <Label>Price (₹)</Label>
                  <Input type="number" value={newPlanPrice} onChange={e => setNewPlanPrice(e.target.value)} placeholder="1000" />
                </div>
                <div className="space-y-1">
                  <Label>Validity (Days)</Label>
                  <Input type="number" value={newPlanDays} onChange={e => setNewPlanDays(e.target.value)} placeholder="365" />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input value={newPlanDesc} onChange={e => setNewPlanDesc(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <Button
                className="w-full gap-2"
                disabled={savingPlan || !newPlanName || !newPlanPrice}
                onClick={async () => {
                  setSavingPlan(true);
                  try {
                    const { error } = await supabase.from('payment_plans').insert({
                      name: newPlanName,
                      price: parseFloat(newPlanPrice) || 100,
                      validity_days: parseInt(newPlanDays) || 30,
                      description: newPlanDesc || null,
                    });
                    if (error) throw error;
                    toast.success('Plan added');
                    setNewPlanName(''); setNewPlanPrice(''); setNewPlanDays('30'); setNewPlanDesc('');
                    fetchData();
                  } catch (e) { toast.error('Failed to add plan'); }
                  finally { setSavingPlan(false); }
                }}
              >
                <Plus className="h-4 w-4" />
                {savingPlan ? 'Adding...' : 'Add Plan'}
              </Button>
            </div>

            {/* Existing Plans */}
            <div className="dairy-card space-y-3">
              <h3 className="font-semibold">Active Plans ({plans.filter(p => p.is_active).length})</h3>
              {plans.length === 0 ? (
                <p className="text-muted-foreground text-sm">No plans yet</p>
              ) : (
                <div className="space-y-2">
                  {plans.map(plan => (
                    <div key={plan.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-semibold">{plan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ₹{plan.price} • {plan.validity_days} days
                        </p>
                        {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            await supabase.from('payment_plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
                            fetchData();
                          }}
                        >
                          {plan.is_active ? <Check className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (confirm(`Delete plan "${plan.name}"?`)) {
                              await supabase.from('payment_plans').delete().eq('id', plan.id);
                              fetchData();
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Codes Tab */}
          <TabsContent value="codes" className="space-y-4 mt-4">
            <div className="dairy-card space-y-4">
              <h3 className="font-semibold">Generate Activation Codes</h3>
              
              <div className="space-y-2">
                <Label>Validity Period</Label>
                <Select value={validityPreset} onValueChange={handleValidityPresetChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select validity" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="30">1 Month</SelectItem>
                     <SelectItem value="180">6 Months</SelectItem>
                     <SelectItem value="365">1 Year</SelectItem>
                     <SelectItem value="custom">Custom Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {validityPreset === 'custom' && (
                <div className="space-y-2">
                  <Label>Custom Days</Label>
                  <Input
                    type="number"
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    min="1"
                    placeholder="Enter number of days"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Number of codes</Label>
                <Input
                  type="number"
                  value={codesCount}
                  onChange={(e) => setCodesCount(e.target.value)}
                  min="1"
                  max="50"
                />
              </div>

              <Button 
                onClick={generateCodes} 
                disabled={generating}
                className="w-full gap-2"
              >
                {generating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Key className="h-4 w-4" />
                )}
                Generate {codesCount} Codes ({validityDays} days each)
              </Button>
            </div>

            {/* Unused Codes */}
            <div className="dairy-card space-y-3">
              <h3 className="font-semibold">Unused Codes ({codes.filter(c => !c.is_used).length})</h3>
              {codes.filter(c => !c.is_used).length === 0 ? (
                <p className="text-muted-foreground text-sm">No unused codes</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {codes.filter(c => !c.is_used).map(code => (
                    <div key={code.id} className="flex items-center justify-between bg-muted/50 p-2 rounded">
                      <div>
                        <code className="font-mono font-bold">{code.code}</code>
                        <span className="text-xs text-muted-foreground ml-2">
                          {code.validity_days} days
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyCode(code.code)}
                        >
                          {copiedCode === code.code ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCode(code.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Used Codes */}
            <div className="dairy-card space-y-3">
              <h3 className="font-semibold">Used Codes ({codes.filter(c => c.is_used).length})</h3>
              {codes.filter(c => c.is_used).length === 0 ? (
                <p className="text-muted-foreground text-sm">No used codes</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {codes.filter(c => c.is_used).map(code => (
                    <div key={code.id} className="flex items-center justify-between bg-muted/30 p-2 rounded opacity-60">
                      <div>
                        <code className="font-mono line-through">{code.code}</code>
                        <span className="text-xs text-muted-foreground ml-2">
                          Used {code.used_at ? new Date(code.used_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4 mt-4">
            <div className="dairy-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">All Subscriptions</h3>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {subscriptions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No subscriptions yet</p>
              ) : (
                <div className="space-y-3">
                  {subscriptions.map(sub => (
                    <div key={sub.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{sub.dairy_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Expires: {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          sub.status === 'active' ? 'bg-green-100 text-green-700' :
                          sub.status === 'banned' ? 'bg-black text-white' :
                          sub.status === 'expired' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                      
                      {/* Admin Actions */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-muted">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => extendSubscriptionByMonths(sub.dairy_id, sub.dairy_name || '', 1)}
                        >
                          <Clock className="h-3 w-3" />
                          +1 Month
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => extendSubscriptionByMonths(sub.dairy_id, sub.dairy_name || '', 6)}
                        >
                          <Clock className="h-3 w-3" />
                          +6 Months
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => extendSubscriptionByMonths(sub.dairy_id, sub.dairy_name || '', 12)}
                        >
                          <Clock className="h-3 w-3" />
                          +1 Year
                        </Button>
                        {sub.status !== 'banned' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="text-xs gap-1"
                            onClick={() => banDairy(sub.dairy_id, sub.dairy_name || '')}
                          >
                            <Ban className="h-3 w-3" />
                            Ban Permanently
                          </Button>
                        )}
                      </div>
                      
                      {/* Custom Days Extension */}
                      <div className="flex items-center gap-2 pt-2">
                        <Input
                          type="number"
                          placeholder="Days (+/-)"
                          className="w-24 h-8 text-xs"
                          id={`custom-days-${sub.dairy_id}`}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => {
                            const input = document.getElementById(`custom-days-${sub.dairy_id}`) as HTMLInputElement;
                            const days = parseInt(input?.value || '0');
                            if (days !== 0) {
                              extendSubscription(sub.dairy_id, sub.dairy_name || '', days);
                              input.value = '';
                            }
                          }}
                        >
                          Apply Custom Days
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminSubscriptions;
