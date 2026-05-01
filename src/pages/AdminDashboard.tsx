import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Milk, RefreshCw, LogOut, Search, CreditCard, Trash2, Phone, Shield, Package, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DairyInfo {
  id: string;
  name: string;
  code: string;
  ownerName: string;
  ownerPhone: string;
  supplierCount: number;
  customerLimit: number | null;
  createdAt: string;
}

const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [dairies, setDairies] = useState<DairyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAllDairies();
  }, []);

  const fetchAllDairies = async () => {
    setLoading(true);
    try {
      // 1. Fetch all dairies
      const { data: dairiesData, error: dairiesError } = await supabase
        .from('dairies')
        .select('*')
        .order('created_at', { ascending: false });

      if (dairiesError) {
        console.error('Error fetching dairies:', dairiesError);
        return;
      }

      const dairyList = dairiesData || [];
      if (dairyList.length === 0) {
        setDairies([]);
        return;
      }

      const ownerIds = Array.from(new Set(dairyList.map(d => d.owner_id)));
      const dairyIds = dairyList.map(d => d.id);

      // 2. Fetch ALL profiles + ALL suppliers in parallel (just 2 queries instead of 2*N)
      const [profilesRes, suppliersRes] = await Promise.all([
        supabase.from('profiles').select('user_id, name, phone').in('user_id', ownerIds),
        supabase.from('suppliers').select('dairy_id').in('dairy_id', dairyIds),
      ]);

      const profileMap = new Map<string, { name: string; phone: string }>();
      (profilesRes.data || []).forEach((p: any) => {
        profileMap.set(p.user_id, { name: p.name || 'Unknown', phone: p.phone || 'N/A' });
      });

      const countMap = new Map<string, number>();
      (suppliersRes.data || []).forEach((s: any) => {
        countMap.set(s.dairy_id, (countMap.get(s.dairy_id) || 0) + 1);
      });

      const dairyInfos: DairyInfo[] = dairyList.map(dairy => {
        const profile = profileMap.get(dairy.owner_id);
        return {
          id: dairy.id,
          name: dairy.name,
          code: dairy.code,
          ownerName: profile?.name || 'Unknown',
          ownerPhone: profile?.phone || 'N/A',
          supplierCount: countMap.get(dairy.id) || 0,
          customerLimit: (dairy as any).customer_limit ?? null,
          createdAt: dairy.created_at,
        };
      });

      setDairies(dairyInfos);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dairyToDelete, setDairyToDelete] = useState<DairyInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [dairyForLimit, setDairyForLimit] = useState<DairyInfo | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);

  const openLimitDialog = (dairy: DairyInfo) => {
    setDairyForLimit(dairy);
    setLimitInput(dairy.customerLimit !== null ? String(dairy.customerLimit) : '');
    setLimitDialogOpen(true);
  };

  const saveLimit = async () => {
    if (!dairyForLimit) return;
    setSavingLimit(true);
    try {
      const trimmed = limitInput.trim();
      const newLimit = trimmed === '' ? null : parseInt(trimmed, 10);
      if (newLimit !== null && (isNaN(newLimit) || newLimit < 0)) {
        toast.error('Invalid number');
        setSavingLimit(false);
        return;
      }
      const { error } = await supabase
        .from('dairies')
        .update({ customer_limit: newLimit } as any)
        .eq('id', dairyForLimit.id);
      if (error) throw error;
      setDairies(prev => prev.map(d => d.id === dairyForLimit.id ? { ...d, customerLimit: newLimit } : d));
      toast.success(newLimit === null ? 'Limit removed (unlimited)' : `Limit set to ${newLimit}`);
      setLimitDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update limit');
    } finally {
      setSavingLimit(false);
    }
  };

  const filteredDairies = dairies.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.code.includes(searchTerm) ||
    d.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.ownerPhone.includes(searchTerm)
  );

  const handleDeleteDairy = async () => {
    if (!dairyToDelete) return;
    
    setDeleting(true);
    try {
      // Delete related data first (due to foreign key constraints)
      // Delete milk entries
      await supabase.from('milk_entries').delete().eq('dairy_id', dairyToDelete.id);
      
      // Delete announcements
      await supabase.from('announcements').delete().eq('dairy_id', dairyToDelete.id);
      
      // Delete rate settings
      await supabase.from('rate_settings').delete().eq('dairy_id', dairyToDelete.id);
      
      // Delete suppliers
      await supabase.from('suppliers').delete().eq('dairy_id', dairyToDelete.id);
      
      // Delete subscriptions
      await supabase.from('subscriptions').delete().eq('dairy_id', dairyToDelete.id);
      
      // Finally delete the dairy
      const { error } = await supabase.from('dairies').delete().eq('id', dairyToDelete.id);
      
      if (error) throw error;
      
      toast.success(`Dairy "${dairyToDelete.name}" deleted successfully`);
      setDairies(prev => prev.filter(d => d.id !== dairyToDelete.id));
    } catch (error) {
      console.error('Error deleting dairy:', error);
      toast.error('Failed to delete dairy');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDairyToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="dairy-header px-4 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-full flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-primary-foreground/70 text-sm">Manage all dairies</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="dairy-card text-center">
            <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{dairies.length}</p>
            <p className="text-muted-foreground text-sm">Total Dairies</p>
          </div>
          <div className="dairy-card text-center">
            <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-2">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold">{dairies.reduce((sum, d) => sum + d.supplierCount, 0)}</p>
            <p className="text-muted-foreground text-sm">Total Suppliers</p>
          </div>
        </div>

        {/* Admin Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button
            onClick={() => navigate('/admin/subscriptions')}
            className="gap-2"
            variant="outline"
          >
            <CreditCard className="h-4 w-4" />
            Subscriptions
          </Button>
          <Button
            onClick={() => navigate('/admin/varieties')}
            className="gap-2"
            variant="outline"
          >
            <Package className="h-4 w-4" />
            Varieties
          </Button>
        </div>

        {/* Search and Refresh */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search dairies, codes, owners..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAllDairies}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Dairies List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground mt-2">Loading...</p>
            </div>
          ) : filteredDairies.length === 0 ? (
            <div className="text-center py-8 dairy-card">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No dairies found</p>
            </div>
          ) : (
            filteredDairies.map(dairy => (
              <div key={dairy.id} className="dairy-card">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Milk className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{dairy.name}</h3>
                      <p className="text-sm text-muted-foreground">Code: {dairy.code}</p>
                      <p className="text-xs text-muted-foreground mt-1">Owner: {dairy.ownerName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        <a href={`tel:${dairy.ownerPhone}`} className="hover:text-primary">
                          {dairy.ownerPhone}
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <span className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded ${
                      dairy.customerLimit !== null && dairy.supplierCount > dairy.customerLimit
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      <Users className="w-3 h-3" />
                      {dairy.supplierCount}{dairy.customerLimit !== null ? ` / ${dairy.customerLimit}` : ''}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(dairy.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openLimitDialog(dairy)}
                        className="gap-1"
                      >
                        <UserCog className="w-3 h-3" />
                        Limit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/dairy-features/${dairy.id}`)}
                        className="gap-1"
                      >
                        <Shield className="w-3 h-3" />
                        Features
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setDairyToDelete(dairy);
                          setDeleteDialogOpen(true);
                        }}
                        className="gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dairy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{dairyToDelete?.name}" (Code: {dairyToDelete?.code})?
              <br /><br />
              This will permanently delete:
              <ul className="list-disc list-inside mt-2 text-destructive">
                <li>{dairyToDelete?.supplierCount} suppliers</li>
                <li>All milk entries</li>
                <li>All announcements</li>
                <li>Rate settings & subscription</li>
              </ul>
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDairy}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Dairy'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer Limit Dialog */}
      <AlertDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set Customer Limit</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Dairy: <strong>{dairyForLimit?.name}</strong></p>
                <p>Current customers: <strong>{dairyForLimit?.supplierCount}</strong></p>
                <p className="text-sm">
                  Enter the maximum number of customers this dairy can have. Leave empty for unlimited.
                  If existing customers exceed the limit, the oldest ones stay active and the newest ones cannot have milk entries.
                </p>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 50 (empty = unlimited)"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingLimit}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveLimit} disabled={savingLimit}>
              {savingLimit ? 'Saving...' : 'Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;