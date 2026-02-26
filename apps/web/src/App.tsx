import { useTranslation } from 'react-i18next';
import { RegistrationForm } from './components/RegistrationForm';
import { useSyncQueue } from './hooks/useSyncQueue';
import { WifiOff, Activity, Globe } from 'lucide-react';
import { Button } from './components/ui/button';

export function App() {
  const { t, i18n } = useTranslation();
  const { isOnline, syncing } = useSyncQueue();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'sw' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-50 flex flex-col">
      {/* Header Bar */}
      <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg md:text-xl tracking-tight">
            <Activity className="h-6 w-6" />
            {t('app.title')}
          </div>
          <div className="flex items-center gap-4">
            {syncing && (
              <span className="text-sm font-medium animate-pulse flex items-center gap-2 bg-primary-foreground/20 px-3 py-1 rounded-full">
                <Globe className="h-4 w-4" />
                {t('app.syncing')}
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={toggleLanguage} className="font-semibold shadow-sm">
              {i18n.language === 'en' ? 'Swahili' : 'English'}
            </Button>
          </div>
        </div>
      </header>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-destructive text-destructive-foreground px-4 py-3 flex items-center justify-center gap-2 shadow-inner font-medium">
          <WifiOff className="h-5 w-5" />
          <p>{t('app.offline_banner')}</p>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center">
        <RegistrationForm />
      </main>

      {/* Footer */}
      <footer className="bg-slate-100 dark:bg-slate-900 border-t py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Maternal System. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default App;
