import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import OperacionesListPage from './pages/OperacionesListPage';
import NewOpPage from './pages/NewOpPage';
import OpDetailPage from './pages/OpDetailPage';
import AdminPage from './pages/AdminPage';

function AppRouter() {
  const { user } = useAuth();

  // Estado de navegación local. Cuando metamos React Router lo sustituimos.
  const [view, setView] = useState({ name: 'list' });

  if (!user) {
    return <LoginPage />;
  }

  switch (view.name) {
    case 'list':
      return (
        <OperacionesListPage
          onOpenOp={(id) => setView({ name: 'detail', id })}
          onNewOp={() => setView({ name: 'new' })}
          onGoToAdmin={() => setView({ name: 'admin' })}
        />
      );
    case 'new':
      return (
        <NewOpPage
          onCreated={(op) => setView({ name: 'detail', id: op.id })}
          onCancel={() => setView({ name: 'list' })}
        />
      );
    case 'detail':
      return (
        <OpDetailPage
          opId={view.id}
          onBack={() => setView({ name: 'list' })}
        />
      );
    case 'admin':
      return <AdminPage onBack={() => setView({ name: 'list' })} />;
    default:
      return <OperacionesListPage onOpenOp={() => {}} onNewOp={() => {}} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
