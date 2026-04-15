import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, ClipboardPlus, ChevronRight, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy } from '@/contexts/DairyContext';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { t, language } = useLanguage();
  const { suppliers, getTodayStats } = useDairy();
  const { user } = useAuth();
  const navigate = useNavigate();

  const todayStats = getTodayStats();

  const customerLabel = language === 'hi' ? 'कुल ग्राहक' : language === 'gu' ? 'કુલ ગ્રાહક' : 'Total Customers';
  const addCustomerLabel = language === 'hi' ? 'ग्राहक जोड़ें' : language === 'gu' ? 'ગ્રાહક ઉમેરો' : 'Add Customer';
  const customerListLabel = language === 'hi' ? 'ग्राहक सूची' : language === 'gu' ? 'ગ્રાહક યાદી' : 'Customer List';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-dairy-cream pb-20">
      <Header />

      <main className="px-3 py-3 max-w-4xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Total Customers */}
          <div className="dairy-card animate-fade-in p-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-primary/12 rounded-lg flex items-center justify-center">
                <span className="text-lg">👥</span>
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{suppliers.length}</p>
            <p className="text-xs text-muted-foreground">{customerLabel}</p>
          </div>

          {/* Today's Total Milk */}
          <div className="dairy-card animate-fade-in p-3" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-accent/12 rounded-lg flex items-center justify-center">
                <span className="text-lg">🥛</span>
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{todayStats.totalMilk.toFixed(1)} L</p>
            <p className="text-xs text-muted-foreground">{t('todayMilk')}</p>
          </div>
        </div>

        {/* Morning/Evening Milk + Avg Fat */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {/* Morning Milk */}
          <div className="dairy-card animate-fade-in p-2.5 text-center" style={{ animationDelay: '150ms' }}>
            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <Sun className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-base font-bold text-foreground">{todayStats.morningMilk.toFixed(1)} L</p>
            <p className="text-xs text-muted-foreground">{t('morningMilk')}</p>
            {todayStats.morningAvgFat > 0 && (
              <p className="text-xs text-muted-foreground mt-1">🧈 avg fat {todayStats.morningAvgFat.toFixed(2)}</p>
            )}
          </div>

          {/* Evening Milk */}
          <div className="dairy-card animate-fade-in p-2.5 text-center" style={{ animationDelay: '200ms' }}>
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <Moon className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-base font-bold text-foreground">{todayStats.eveningMilk.toFixed(1)} L</p>
            <p className="text-xs text-muted-foreground">{t('eveningMilk')}</p>
            {todayStats.eveningAvgFat > 0 && (
              <p className="text-xs text-muted-foreground mt-1">🧈 avg fat {todayStats.eveningAvgFat.toFixed(2)}</p>
            )}
          </div>

          {/* Avg Fat */}
          <div className="dairy-card animate-fade-in p-2.5 text-center" style={{ animationDelay: '250ms' }}>
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <span className="text-base">🧈</span>
            </div>
            <p className="text-base font-bold text-foreground">{todayStats.avgFat.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{t('avgFat')}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-4">
          <h2 className="section-title">
            <span className="text-lg">⚡</span>
            {language === 'hi' ? 'त्वरित कार्य' : language === 'gu' ? 'ઝડપી કામ' : 'Quick Actions'}
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="dairy"
              className="h-auto py-4 flex-col gap-2 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all"
              onClick={() => navigate('/milk-entry')}
            >
              <div className="w-11 h-11 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
                <ClipboardPlus className="h-5 w-5" />
              </div>
              <span className="font-bold">{language === 'hi' ? 'दूध एंट्री' : language === 'gu' ? 'દૂધ એન્ટ્રી' : 'Milk Entry'}</span>
            </Button>
            
            <Button
              variant="dairy-outline"
              className="h-auto py-4 flex-col gap-2 rounded-2xl hover:shadow-lg transition-all"
              onClick={() => navigate('/add-supplier')}
            >
              <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <span className="font-bold">{addCustomerLabel}</span>
            </Button>
            
            <Button
              variant="dairy-secondary"
              className="h-auto py-3 col-span-2 justify-between rounded-2xl"
              onClick={() => navigate('/suppliers')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold">{customerListLabel}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Empty State */}
        {suppliers.length === 0 && (
          <div className="dairy-card text-center py-6 animate-fade-in">
            <div className="text-4xl mb-3">🥛</div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {language === 'hi' ? 'अभी कोई ग्राहक नहीं है' : 'No customers yet'}
            </h3>
            <p className="text-muted-foreground mb-5 text-sm">
              {language === 'hi' ? 'अपना पहला ग्राहक जोड़ें और शुरू करें!' : 'Add your first customer to get started!'}
            </p>
            <Button variant="dairy" onClick={() => navigate('/add-supplier')} className="px-8">
              <Plus className="mr-2 h-5 w-5" />
              {addCustomerLabel}
            </Button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
