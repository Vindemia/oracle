import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { AppShell } from './components/AppShell.js';
import { Header } from './components/Header.js';
import { ToastList } from './components/ToastList.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { MatrixView } from './views/MatrixView.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { HistoryView } from './views/HistoryView.js';
import { useTasks } from './hooks/useTasks.js';
import { useTags } from './hooks/useTags.js';

function AppLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}

function focusTaskInput() {
  document.querySelector<HTMLInputElement>('[data-task-input]')?.focus();
}

function MatrixRoute() {
  const { tasks, isLoading, error, refresh, completeTask, eliminateTask, updateTask, updateTaskTags, deleteTask, unplanTask } = useTasks();
  const { tags: allTags } = useTags();
  return (
    <AppShell onTaskCreated={refresh}>
      <MatrixView
        tasks={tasks}
        isLoading={isLoading}
        error={error}
        allTags={allTags}
        onComplete={completeTask}
        onEliminate={eliminateTask}
        onUpdate={updateTask}
        onUpdateTags={updateTaskTags}
        onDelete={deleteTask}
        onUnplan={unplanTask}
        onFocusInput={focusTaskInput}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ToastList />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<MatrixRoute />} />
              <Route path="/history" element={<HistoryView />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
