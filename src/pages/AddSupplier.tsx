import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Hash, Phone, ShoppingCart, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy } from '@/contexts/DairyContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const AddSupplier: React.FC = () => {
  const { language } = useLanguage();
  const { addSupplier, suppliers } = useDairy();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [customerType, setCustomerType] = useState<'supplier' | 'buyer'>('supplier');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const addCustomerLabel = language === 'hi' ? 'ग्राहक जोड़ें' : language === 'gu' ? 'ગ્રાહક ઉમેરો' : 'Add Customer';
  const supplierLabel = language === 'hi' ? 'सप्लायर' : language === 'gu' ? 'સપ્લાયર' : 'Supplier';
  const buyerLabel = language === 'hi' ? 'खरीदार' : language === 'gu' ? 'ખરીદનાર' : 'Buyer';
  const supplierDesc = language === 'hi' ? 'दूध देने वाला' : language === 'gu' ? 'દૂધ આપનાર' : 'Milk Provider';
  const buyerDesc = language === 'hi' ? 'दूध लेने वाला' : language === 'gu' ? 'દૂધ લેનાર' : 'Milk Buyer';
  const customerCodeLabel = language === 'hi' ? 'ग्राहक कोड' : language === 'gu' ? 'ગ્રાહક કોડ' : 'Customer Code';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code || !name) {
      toast({ title: language === 'hi' ? 'त्रुटि' : 'Error', description: 'कृपया सभी फ़ील्ड भरें / Please fill all fields', variant: 'destructive' });
      return;
    }

    // Validate code (alphanumeric, 1-10 characters)
    if (!/^[a-zA-Z0-9]{1,10}$/.test(code)) {
      toast({ title: language === 'hi' ? 'त्रुटि' : 'Error', description: 'कोड 1-10 अक्षर/अंक होना चाहिए / Code must be 1-10 alphanumeric characters', variant: 'destructive' });
      return;
    }

    // Check if code already exists
    const codeExists = suppliers.some(s => s.code?.toLowerCase() === code.toLowerCase());
    if (codeExists) {
      toast({ title: language === 'hi' ? 'त्रुटि' : 'Error', description: 'यह कोड पहले से मौजूद है / This code already exists', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      await addSupplier({
        code,
        name,
        phone: phone.trim(),
        animalType: customerType === 'buyer' ? 'buyer' : 'cow', // Use 'buyer' type to differentiate buyers
      });

      toast({ title: language === 'hi' ? 'सफल' : 'Success', description: 'ग्राहक जोड़ा गया! / Customer added!' });
      navigate('/suppliers');
    } catch (error: any) {
      const isLimit = error?.message === 'customer_limit_reached';
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: isLimit
          ? (language === 'hi' ? 'ग्राहक सीमा पूरी हो गई। एडमिन से संपर्क करें।' : 'Customer limit reached. Contact admin.')
          : (language === 'hi' ? 'ग्राहक जोड़ने में विफल' : 'Failed to add customer'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="dairy-header px-4 py-4">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold">{addCustomerLabel}</h1>
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Type Selection */}
          <div className="dairy-card animate-fade-in">
            <p className="font-semibold mb-3">
              {language === 'hi' ? 'ग्राहक प्रकार चुनें' : language === 'gu' ? 'ગ્રાહક પ્રકાર પસંદ કરો' : 'Select Customer Type'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCustomerType('supplier')}
                className={cn(
                  "flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                  customerType === 'supplier' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                )}
              >
                <Truck className={cn("h-8 w-8", customerType === 'supplier' ? 'text-primary' : 'text-muted-foreground')} />
                <span className="font-bold">{supplierLabel}</span>
                <span className="text-xs text-muted-foreground">{supplierDesc}</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('buyer')}
                className={cn(
                  "flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                  customerType === 'buyer' 
                    ? 'border-accent bg-accent/10' 
                    : 'border-border hover:border-accent/50'
                )}
              >
                <ShoppingCart className={cn("h-8 w-8", customerType === 'buyer' ? 'text-accent' : 'text-muted-foreground')} />
                <span className="font-bold">{buyerLabel}</span>
                <span className="text-xs text-muted-foreground">{buyerDesc}</span>
              </button>
            </div>
          </div>

          {/* Customer Details */}
          <div className="dairy-card space-y-4 animate-fade-in" style={{ animationDelay: '50ms' }}>
            <div className="relative">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`${customerCodeLabel} * (1-10 अक्षर/अंक)`}
                value={code}
                onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase())}
                className="dairy-input pl-12"
                maxLength={10}
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {code.length}/10
              </span>
            </div>

            <p className="text-blue-600 text-xs bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 p-2 rounded">
              {language === 'hi' 
                ? 'यह कोड मिल्क एंट्री के समय ग्राहक को जल्दी ढूंढने के लिए उपयोग होगा'
                : language === 'gu'
                ? 'આ કોડ મિલ્ક એન્ટ્રી સમયે ગ્રાહકને ઝડપથી શોધવા માટે વપરાશે'
                : 'This code will be used to quickly find the customer during milk entry'}
            </p>

            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`${language === 'hi' ? 'नाम' : language === 'gu' ? 'નામ' : 'Name'} *`}
                value={name}
                onChange={e => setName(e.target.value)}
                className="dairy-input pl-12"
                required
              />
            </div>

            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="tel"
                placeholder={language === 'hi' ? 'फ़ोन नंबर (वैकल्पिक)' : language === 'gu' ? 'ફોન નંબર (વૈકલ્પિક)' : 'Phone Number (Optional)'}
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                className="dairy-input pl-12"
                maxLength={10}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <Button
              type="button"
              variant="dairy-outline"
              className="flex-1"
              onClick={() => navigate(-1)}
              disabled={isLoading}
            >
              {language === 'hi' ? 'रद्द करें' : language === 'gu' ? 'રદ કરો' : 'Cancel'}
            </Button>
            <Button type="submit" variant="dairy" className="flex-1" disabled={isLoading}>
              {isLoading ? '...' : language === 'hi' ? 'सेव करें' : language === 'gu' ? 'સાચવો' : 'Save'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default AddSupplier;
