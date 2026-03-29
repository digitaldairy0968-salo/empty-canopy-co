import React, { useState, useEffect } from 'react';
import { Send, Trash2, MessageCircle, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy } from '@/contexts/DairyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getNotificationPermissionStatus } from '@/utils/notifications';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const quickMessages = [
  { hindi: 'आज दूध खरीद नहीं होगा', english: 'No milk purchase today' },
  { hindi: 'दूध लेने में 1 घंटे की देरी होगी', english: '1 hour delay in milk collection' },
  { hindi: 'फैट रेट अपडेट कर दिया गया है', english: 'Fat rate has been updated' },
  { hindi: 'कल छुट्टी रहेगी', english: 'Holiday tomorrow' },
  { hindi: 'समय पर दूध लाएं', english: 'Bring milk on time' },
];

const Announcements: React.FC = () => {
  const { t, language } = useLanguage();
  const { announcements, addAnnouncement, deleteAnnouncement, suppliers, enableNotifications } = useDairy();
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermissionStatus()
  );

  const isSupplier = user?.role === 'supplier';

  const handleEnableNotifications = async () => {
    const granted = await enableNotifications();
    setNotificationStatus(getNotificationPermissionStatus());
    if (granted) {
      toast({ title: t('success'), description: 'Notifications enabled! You will be alerted when new announcements arrive.' });
    } else {
      toast({ title: t('error'), description: 'Permission denied. Please enable notifications in browser settings.', variant: 'destructive' });
    }
  };

  const handleSend = () => {
    if (!message.trim()) {
      toast({ title: t('error'), description: 'Please enter a message', variant: 'destructive' });
      return;
    }

    addAnnouncement(message.trim());
    setMessage('');
    toast({ title: t('success'), description: 'Message sent to all suppliers!' });
  };

  const handleQuickMessage = (msg: typeof quickMessages[0]) => {
    const text = language === 'hi' ? msg.hindi : msg.english;
    setMessage(text);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('announcements')}</h2>
              <p className="text-sm text-muted-foreground">
                {isSupplier ? user?.dairyName : `${suppliers.length} ${t('totalSuppliers')}`}
              </p>
            </div>
          </div>
          {/* Notification Toggle for Suppliers */}
          {isSupplier && notificationStatus !== 'unsupported' && (
            <Button
              variant={notificationStatus === 'granted' ? 'outline' : 'default'}
              size="sm"
              onClick={handleEnableNotifications}
              className="flex items-center gap-2"
            >
              {notificationStatus === 'granted' ? (
                <>
                  <Bell className="h-4 w-4" />
                  Enabled
                </>
              ) : (
                <>
                  <BellOff className="h-4 w-4" />
                  Enable Alerts
                </>
              )}
            </Button>
          )}
        </div>

        {/* Quick Messages - Only for Owners */}
        {!isSupplier && (
          <div className="dairy-card animate-fade-in">
            <h3 className="font-semibold mb-3">Quick Messages</h3>
            <div className="flex flex-wrap gap-2">
              {quickMessages.map((msg, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickMessage(msg)}
                  className="text-xs"
                >
                  {language === 'hi' ? msg.hindi : msg.english}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Message Input - Only for Owners */}
        {!isSupplier && (
          <div className="dairy-card animate-fade-in" style={{ animationDelay: '50ms' }}>
            <Textarea
              placeholder={language === 'hi' ? 'अपना संदेश लिखें...' : 'Write your message...'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mb-4 min-h-24"
            />
            <Button variant="dairy" className="w-full" onClick={handleSend}>
              <Send className="mr-2 h-5 w-5" />
              {t('send')}
            </Button>
          </div>
        )}

        {/* Previous Announcements */}
        <div className="space-y-3">
          <h3 className="font-semibold">{t('announcements')} History</h3>
          {announcements.length === 0 ? (
            <div className="dairy-card text-center py-8">
              <div className="text-4xl mb-2">📢</div>
              <p className="text-muted-foreground">No announcements yet</p>
            </div>
          ) : (
            announcements.map((announcement, index) => (
              <div
                key={announcement.id}
                className="dairy-card animate-fade-in flex items-start gap-3"
                style={{ animationDelay: `${(index + 2) * 50}ms` }}
              >
                <div className="flex-1">
                  <p className="text-sm">{announcement.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(announcement.createdAt).toLocaleString()}
                  </p>
                </div>
                {!isSupplier && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('delete')}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this announcement.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteAnnouncement(announcement.id)}>
                          {t('delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Announcements;
