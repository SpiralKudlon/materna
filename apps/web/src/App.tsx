import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { MfaSetup } from './components/MfaSetup';
import { RegistrationForm } from './components/RegistrationForm';
import { useSyncQueue } from './hooks/useSyncQueue';
import { WifiOff, Activity, Globe, LogOut } from 'lucide-react';
import { Button } from './components/ui/button';

function ProtectedLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
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
          <div className="flex items-center gap-3">
            {syncing && (
              <span className="text-sm font-medium animate-pulse flex items-center gap-2 bg-primary-foreground/20 px-3 py-1 rounded-full">
                <Globe className="h-4 w-4" />
                {t('app.syncing')}
              </span>
            )}
            {user && (
              <span className="text-sm hidden sm:inline opacity-80">
                {user.name || user.email}
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={toggleLanguage} className="font-semibold shadow-sm">
              {i18n.language === 'en' ? 'Swahili' : 'English'}
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-primary-foreground hover:bg-primary-foreground/10">
              <LogOut className="h-4 w-4" />
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

      {/* Main Content */}
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Activity className="h-10 w-10 text-emerald-600 animate-bounce" />
          <span className="text-slate-500 text-sm font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function MfaGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mfaCompleted, setMfaCompleted] = useState(false);

  if (user?.requiresMfa && !mfaCompleted) {
    return <MfaSetup onComplete={() => setMfaCompleted(true)} />;
  }

  return <>{children}</>;
}

export function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
        }
      />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <MfaGate>
              <ProtectedLayout />
            </MfaGate>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default App;
