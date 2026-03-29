import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, User, Hash, Phone, Info, Pencil, Trash2, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy, Supplier } from '@/contexts/DairyContext';
import { useToast } from '@/hooks/use-toast';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const Suppliers: React.FC = () => {
  const { t, language } = useLanguage();
  const { suppliers, deleteSupplier, updateSupplier } = useDairy();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // About sheet state
  const [aboutSupplier, setAboutSupplier] = useState<Supplier | null>(null);
  
  // Edit state
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Sort suppliers by code (numeric) and filter
  const sortedAndFilteredSuppliers = suppliers
    .filter(
      s => s.name.toLowerCase().includes(search.toLowerCase()) ||
           s.phone.includes(search) ||
           s.code?.includes(search)
    )
    .sort((a, b) => {
      const codeA = parseInt(a.code || '0') || 0;
      const codeB = parseInt(b.code || '0') || 0;
      return codeA - codeB;
    });

  const customerLabel = language === 'hi' ? 'ग्राहक' : language === 'gu' ? 'ગ્રાહક' : 'Customer';
  const addCustomerLabel = language === 'hi' ? 'ग्राहक जोड़ें' : language === 'gu' ? 'ગ્રાહક ઉમેરો' : 'Add Customer';
  const totalCustomersLabel = language === 'hi' ? 'कुल ग्राहक' : language === 'gu' ? 'કુલ ગ્રાહક' : 'Total Customers';

  const handleDelete = () => {
    if (deleteId) {
      deleteSupplier(deleteId);
      setDeleteId(null);
      setAboutSupplier(null);
      toast({ 
        title: t('success'), 
        description: language === 'hi' ? 'ग्राहक हटा दिया गया' : language === 'gu' ? 'ગ્રાહક દૂર કરવામાં આવ્યો' : 'Customer deleted' 
      });
    }
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setAboutSupplier(null);
    setEditSupplier(supplier);
    setEditName(supplier.name);
    setEditCode(supplier.code || '');
    setEditPhone(supplier.phone || '');
  };

  const handleSaveEdit = async () => {
    if (!editSupplier) return;
    
    if (!editName.trim()) {
      toast({ 
        title: t('error'), 
        description: language === 'hi' ? 'नाम आवश्यक है' : language === 'gu' ? 'નામ જરૂરી છે' : 'Name is required', 
        variant: 'destructive' 
      });
      return;
    }

    // Check if code already exists (for another supplier)
    if (editCode && suppliers.some(s => s.id !== editSupplier.id && s.code?.toLowerCase() === editCode.toLowerCase())) {
      toast({ 
        title: t('error'), 
        description: language === 'hi' ? 'यह कोड पहले से मौजूद है' : language === 'gu' ? 'આ કોડ પહેલેથી અસ્તિત્વમાં છે' : 'This code already exists', 
        variant: 'destructive' 
      });
      return;
    }

    setIsEditing(true);
    try {
      await updateSupplier(editSupplier.id, { 
        name: editName.trim(),
        code: editCode.trim() || undefined,
        phone: editPhone.trim()
      });
      toast({ 
        title: t('success'), 
        description: language === 'hi' ? 'ग्राहक अपडेट किया गया' : language === 'gu' ? 'ગ્રાહક અપડેટ કરવામાં આવ્યો' : 'Customer updated' 
      });
      setEditSupplier(null);
    } catch (error) {
      toast({ 
        title: t('error'), 
        description: language === 'hi' ? 'अपडेट विफल' : language === 'gu' ? 'અપડેટ નિષ્ફળ' : 'Update failed', 
        variant: 'destructive' 
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleCall = (phone: string) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      toast({
        title: t('error'),
        description: language === 'hi' ? 'फ़ोन नंबर नहीं है' : language === 'gu' ? 'ફોન નંબર નથી' : 'No phone number',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto">
        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={language === 'hi' ? 'नाम या कोड से खोजें...' : language === 'gu' ? 'નામ અથવા કોડ દ્વારા શોધો...' : 'Search by name or code...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="dairy-input pl-12 rounded-2xl"
          />
        </div>

        {/* Add Button */}
        <Button
          variant="dairy"
          className="w-full mb-6 rounded-2xl"
          onClick={() => navigate('/add-supplier')}
        >
          <Plus className="mr-2" />
          {addCustomerLabel}
        </Button>

        {/* Stats */}
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-sm text-muted-foreground font-medium">
            {totalCustomersLabel}: <span className="text-foreground font-bold">{suppliers.length}</span>
          </p>
        </div>

        {/* Customer List */}
        <div className="space-y-3">
          {sortedAndFilteredSuppliers.map((supplier, index) => (
            <div
              key={supplier.id}
              className="dairy-card animate-fade-in"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(`/supplier/${supplier.id}`)}
                  className="flex items-center gap-4 flex-1 text-left"
                >
                  <div className="icon-badge bg-primary/10">
                    {supplier.animalType === 'cow' ? '🐄' : supplier.animalType === 'buffalo' ? '🐃' : '🐐'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-lg truncate">{supplier.name}</p>
                      {supplier.code && (
                        <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-mono font-semibold shrink-0">
                          #{supplier.code}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {supplier.phone || ''} {supplier.villageName && `• ${supplier.villageName}`}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAboutSupplier(supplier);
                  }}
                  className="text-primary hover:bg-primary/10 rounded-xl"
                >
                  <Info className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {sortedAndFilteredSuppliers.length === 0 && (
          <div className="dairy-card text-center py-14 animate-fade-in">
            <div className="text-6xl mb-4 float">🔍</div>
            <p className="text-muted-foreground text-lg">{t('noData')}</p>
          </div>
        )}
      </main>

      <BottomNav />

      {/* About Sheet */}
      <Sheet open={!!aboutSupplier} onOpenChange={(open) => !open && setAboutSupplier(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left pb-4">
            <SheetTitle className="text-xl flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              {language === 'hi' ? 'ग्राहक जानकारी' : language === 'gu' ? 'ગ્રાહક માહિતી' : 'Customer Info'}
            </SheetTitle>
          </SheetHeader>
          
          {aboutSupplier && (
            <div className="space-y-4 pb-6">
              {/* Customer Details */}
              <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="icon-badge bg-primary/10">
                    {aboutSupplier.animalType === 'cow' ? '🐄' : aboutSupplier.animalType === 'buffalo' ? '🐃' : '🐐'}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{aboutSupplier.name}</p>
                    {aboutSupplier.code && (
                      <span className="text-sm text-muted-foreground font-mono">#{aboutSupplier.code}</span>
                    )}
                  </div>
                </div>
                {aboutSupplier.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {aboutSupplier.phone}
                  </p>
                )}
                {aboutSupplier.villageName && (
                  <p className="text-sm text-muted-foreground">
                    📍 {aboutSupplier.villageName}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2 rounded-xl"
                  onClick={() => handleOpenEdit(aboutSupplier)}
                >
                  <Pencil className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium">
                    {language === 'hi' ? 'संपादित करें' : language === 'gu' ? 'સંપાદિત કરો' : 'Edit'}
                  </span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2 rounded-xl"
                  onClick={() => handleCall(aboutSupplier.phone)}
                  disabled={!aboutSupplier.phone}
                >
                  <PhoneCall className="h-6 w-6 text-green-600" />
                  <span className="text-xs font-medium">
                    {language === 'hi' ? 'कॉल करें' : language === 'gu' ? 'કૉલ કરો' : 'Call'}
                  </span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2 rounded-xl border-destructive/50"
                  onClick={() => setDeleteId(aboutSupplier.id)}
                >
                  <Trash2 className="h-6 w-6 text-destructive" />
                  <span className="text-xs font-medium text-destructive">
                    {language === 'hi' ? 'हटाएं' : language === 'gu' ? 'દૂર કરો' : 'Delete'}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">{t('confirm')}</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {language === 'hi' ? 'क्या आप इस ग्राहक को हटाना चाहते हैं? इससे सभी मिल्क एंट्री भी हट जाएंगी।' : language === 'gu' ? 'શું તમે આ ગ્રાહકને દૂર કરવા માંગો છો? આ તમામ મિલ્ક એન્ટ્રીઓ પણ કાઢી નાખશે.' : 'Are you sure you want to delete this customer? This will also delete all milk entries.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl">
              {language === 'hi' ? 'हटाएं' : language === 'gu' ? 'દૂર કરો' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editSupplier} onOpenChange={(open) => !open && setEditSupplier(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {language === 'hi' ? 'ग्राहक संपादित करें' : language === 'gu' ? 'ગ્રાહક સંપાદિત કરો' : 'Edit Customer'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={language === 'hi' ? 'ग्राहक कोड' : language === 'gu' ? 'ગ્રાહક કોડ' : 'Customer Code'}
                value={editCode}
                onChange={e => setEditCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase())}
                className="dairy-input pl-12"
                maxLength={10}
              />
            </div>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={language === 'hi' ? 'ग्राहक नाम' : language === 'gu' ? 'ગ્રાહક નામ' : 'Customer Name'}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="dairy-input pl-12"
              />
            </div>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="tel"
                placeholder={language === 'hi' ? 'फ़ोन नंबर (वैकल्पिक)' : language === 'gu' ? 'ફોન નંબર (વૈકલ્પિક)' : 'Phone Number (Optional)'}
                value={editPhone}
                onChange={e => setEditPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                className="dairy-input pl-12"
                maxLength={10}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditSupplier(null)} className="rounded-xl" disabled={isEditing}>
              {t('cancel')}
            </Button>
            <Button variant="dairy" onClick={handleSaveEdit} className="rounded-xl" disabled={isEditing}>
              {isEditing ? '...' : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Suppliers;