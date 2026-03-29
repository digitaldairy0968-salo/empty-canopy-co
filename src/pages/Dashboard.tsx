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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-dairy-cream pb-28">
      <Header />

      <main className="px-4 py-5 max-w-4xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Total Customers */}
          <div className="dairy-card animate-fade-in p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 bg-primary/12 rounded-xl flex items-center justify-center">
                <span className="text-xl">👥</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{suppliers.length}</p>
            <p className="text-sm text-muted-foreground">{customerLabel}</p>
          </div>

          {/* Today's Total Milk */}
          <div className="dairy-card animate-fade-in p-4" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 bg-accent/12 rounded-xl flex items-center justify-center">
                <span className="text-xl">🥛</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{todayStats.totalMilk.toFixed(1)} L</p>
            <p className="text-sm text-muted-foreground">{t('todayMilk')}</p>
          </div>
        </div>

        {/* Morning/Evening Milk + Avg Fat */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Morning Milk */}
          <div className="dairy-card animate-fade-in p-3 text-center" style={{ animationDelay: '150ms' }}>
            <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Sun className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-lg font-bold text-foreground">{todayStats.morningMilk.toFixed(1)} L</p>
            <p className="text-xs text-muted-foreground">{t('morningMilk')}</p>
            {todayStats.morningAvgFat > 0 && (
              <p className="text-xs text-muted-foreground mt-1">🧈 avg fat {todayStats.morningAvgFat.toFixed(2)}</p>
            )}
          </div>

          {/* Evening Milk */}
          <div className="dairy-card animate-fade-in p-3 text-center" style={{ animationDelay: '200ms' }}>
            <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Moon className="h-5 w-5 text-indigo-500" />
            </div>
            <p className="text-lg font-bold text-foreground">{todayStats.eveningMilk.toFixed(1)} L</p>
            <p className="text-xs text-muted-foreground">{t('eveningMilk')}</p>
            {todayStats.eveningAvgFat > 0 && (
              <p className="text-xs text-muted-foreground mt-1">🧈 avg fat {todayStats.eveningAvgFat.toFixed(2)}</p>
            )}
          </div>

          {/* Avg Fat */}
          <div className="dairy-card animate-fade-in p-3 text-center" style={{ animationDelay: '250ms' }}>
            <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mx-auto mb-2">
              <span className="text-lg">🧈</span>
            </div>
            <p className="text-lg font-bold text-foreground">{todayStats.avgFat.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{t('avgFat')}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="section-title">
            <span className="text-lg">⚡</span>
            {language === 'hi' ? 'त्वरित कार्य' : language === 'gu' ? 'ઝડપી કામ' : 'Quick Actions'}
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="dairy"
              className="h-auto py-6 flex-col gap-3 rounded-3xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all"
              onClick={() => navigate('/milk-entry')}
            >
              <div className="w-14 h-14 bg-primary-foreground/20 rounded-2xl flex items-center justify-center">
                <ClipboardPlus className="h-7 w-7" />
              </div>
              <span className="font-bold">{language === 'hi' ? 'दूध एंट्री' : language === 'gu' ? 'દૂધ એન્ટ્રી' : 'Milk Entry'}</span>
            </Button>
            
            <Button
              variant="dairy-outline"
              className="h-auto py-6 flex-col gap-3 rounded-3xl hover:shadow-lg transition-all"
              onClick={() => navigate('/add-supplier')}
            >
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <Plus className="h-7 w-7" />
              </div>
              <span className="font-bold">{addCustomerLabel}</span>
            </Button>
            
            <Button
              variant="dairy-secondary"
              className="h-auto py-5 col-span-2 justify-between rounded-3xl"
              onClick={() => navigate('/suppliers')}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold">{customerListLabel}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Empty State */}
        {suppliers.length === 0 && (
          <div className="dairy-card text-center py-10 animate-fade-in">
            <div className="text-6xl mb-4">🥛</div>
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
