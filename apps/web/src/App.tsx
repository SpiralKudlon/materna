import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { MfaSetup } from './components/MfaSetup';
import { RegistrationForm } from './components/RegistrationForm';
import { NotificationCenter } from './components/NotificationCenter';
import { SosButton } from './components/SosButton';
import { CHVCaseload } from './components/CHVCaseload';
import { SmsSimulator } from './components/SmsSimulator';
import { useSyncQueue } from './hooks/useSyncQueue';
import { WifiOff, Activity, Globe, LogOut } from 'lucide-react';

function ProtectedLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { isOnline, syncing, isCacheValidating, pendingCount } = useSyncQueue();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'sw' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground flex flex-col">
      {/* Header Bar - Normal */}
      <header className="bg-surface border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Activity className="h-4 w-4" />
            {t('app.title')}
          </div>
          <div className="flex items-center gap-4 text-sm">
            {/* Sync States - Normal text, no pill badges */}
            {syncing && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                {t('app.syncing')}
              </span>
            )}
            {!syncing && isCacheValidating && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                Updating Cache...
              </span>
            )}
            {!syncing && !isCacheValidating && pendingCount > 0 && (
              <span className="flex items-center gap-1.5 text-accent">
                <WifiOff className="h-3.5 w-3.5" />
                {pendingCount} pending
              </span>
            )}
            {user && (
              <span className="hidden sm:inline text-muted-foreground">
                {user.name || user.email}
              </span>
            )}
            <div className="flex items-center gap-2 border-l pl-4 ml-2">
              <NotificationCenter />
              <button onClick={toggleLanguage} className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                {i18n.language === 'en' ? 'SW' : 'EN'}
              </button>
              <button onClick={logout} className="text-muted-foreground hover:text-foreground transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Offline Banner - Normal */}
      {!isOnline && (
        <div className="bg-accent/10 text-accent px-4 py-2 border-b border-accent/20 flex items-center justify-center gap-2 text-sm font-medium">
          <WifiOff className="h-4 w-4" />
          <p>{t('app.offline_banner')}</p>
        </div>
      )}

      {/* Main Content - Normal containment, no hero layouts */}
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col gap-12 max-w-5xl">
        <section className="w-full">
          <RegistrationForm />
        </section>

        <section className="w-full pt-8 border-t">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Facility Caseload Queue</h2>
          </div>
          <CHVCaseload />
        </section>

        <section className="w-full pt-8 border-t">
          <SmsSimulator />
        </section>

        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40">
          <SosButton patientId={(user as any)?.id || 'demo-patient-id'} />
        </div>
      </main>

      {/* Footer - Normal */}
      <footer className="border-t py-6 mt-auto">
        <div className="container mx-auto px-4 text-sm text-muted-foreground">
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Loading...</span>
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
