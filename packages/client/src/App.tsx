import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { AppShell } from './components/AppShell.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { MatrixView } from './views/MatrixView.js';
import { useTasks } from './hooks/useTasks.js';

function MatrixRoute() {
  const { tasks, isLoading, error, refresh } = useTasks();
  return (
    <AppShell onTaskCreated={refresh}>
      <MatrixView tasks={tasks} isLoading={isLoading} error={error} />
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MatrixRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <AppShell>
                  <div style={{ color: 'var(--text-primary)', padding: '1.5rem' }}>
                    Prophéties Accomplies — à venir
                  </div>
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
