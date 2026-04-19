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
      // Fetch all dairies with owner info
      const { data: dairiesData, error: dairiesError } = await supabase
        .from('dairies')
        .select('*')
        .order('created_at', { ascending: false });

      if (dairiesError) {
        console.error('Error fetching dairies:', dairiesError);
        return;
      }

      // Fetch supplier counts for each dairy
      const dairyInfos: DairyInfo[] = [];
      
      for (const dairy of dairiesData || []) {
        const { count } = await supabase
          .from('suppliers')
          .select('*', { count: 'exact', head: true })
          .eq('dairy_id', dairy.id);

        // Get owner profile with phone
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, phone')
          .eq('user_id', dairy.owner_id)
          .maybeSingle();

        dairyInfos.push({
          id: dairy.id,
          name: dairy.name,
          code: dairy.code,
          ownerName: profileData?.name || 'Unknown',
          ownerPhone: profileData?.phone || 'N/A',
          supplierCount: count || 0,
          customerLimit: (dairy as any).customer_limit ?? null,
          createdAt: dairy.created_at,
        });
      }

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
                    <span className="inline-flex items-center gap-1 text-sm bg-green-100 text-green-700 px-2 py-1 rounded">
                      <Users className="w-3 h-3" />
                      {dairy.supplierCount} suppliers
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(dairy.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex gap-1">
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
    </div>
  );
};

export default AdminDashboard;