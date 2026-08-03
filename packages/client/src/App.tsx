import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { FireAlertProvider, useFireAlert } from './context/FireAlertContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { AppShell } from './components/AppShell.js';
import { Header } from './components/Header.js';
import { InstallPrompt } from './components/InstallPrompt.js';
import { ToastList } from './components/ToastList.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.js';
import { ResetPasswordPage } from './pages/ResetPasswordPage.js';
import { MatrixView } from './views/MatrixView.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { HistoryView } from './views/HistoryView.js';
import { FocusView } from './views/FocusView.js';
import { RitualView } from './views/RitualView.js';
import { useTasks } from './hooks/useTasks.js';
import { useTags } from './hooks/useTags.js';
import { useRitual } from './hooks/useRitual.js';

function AppLayout() {
  return (
    <FireAlertProvider>
      <Header />
      <InstallPrompt />
      <Outlet />
    </FireAlertProvider>
  );
}

function focusTaskInput() {
  document.querySelector<HTMLInputElement>('[data-task-input]')?.focus();
}

// Premier Rituel (v3-15) : détecté au premier rendu authentifié, une seule
// fois par session — sans ce garde-fou, « Passer » sans rien créer ramène
// sur la Matrice avec un état toujours vide et redéclenche la redirection.
const ONBOARDING_CHECKED_KEY = 'oracle:onboardingChecked';

function alreadyCheckedOnboarding(): boolean {
  try {
    return window.sessionStorage.getItem(ONBOARDING_CHECKED_KEY) !== null;
  } catch {
    return false;
  }
}

function markOnboardingChecked(): void {
  try {
    window.sessionStorage.setItem(ONBOARDING_CHECKED_KEY, '1');
  } catch {
    // best-effort — l'absence de garde-fou ne doit jamais bloquer l'app
  }
}

function FocusRoute() {
  const { tasks, isLoading, refresh, reorderTasks, planTask, completeTask, toggleStep, reactivateTask } = useTasks();
  const { tags: allTags } = useTags();
  const { setHasFireTasks } = useFireAlert();

  useEffect(() => {
    setHasFireTasks(tasks.some((t) => t.quadrant === 'FIRE' && t.status === 'ACTIVE'));
  }, [tasks, setHasFireTasks]);

  const handlePass = async (id: string) => {
    const starsIds = tasks
      .filter((t) => t.quadrant === 'STARS' && t.status === 'ACTIVE')
      .sort((a, b) => a.position - b.position)
      .map((t) => t.id);
    const without = starsIds.filter((sid) => sid !== id);
    await reorderTasks('STARS', [...without, id]);
  };

  const handlePassFire = async (id: string) => {
    const fireIds = tasks
      .filter((t) => t.quadrant === 'FIRE' && t.status === 'ACTIVE')
      .sort((a, b) => a.position - b.position)
      .map((t) => t.id);
    const without = fireIds.filter((fid) => fid !== id);
    await reorderTasks('FIRE', [...without, id]);
  };

  return (
    <AppShell onTaskCreated={refresh}>
      <FocusView
        tasks={tasks}
        isLoading={isLoading}
        allTags={allTags}
        onPlan={planTask}
        onPass={handlePass}
        onComplete={completeTask}
        onPassFire={handlePassFire}
        onToggleStep={toggleStep}
        onReactivate={reactivateTask}
      />
    </AppShell>
  );
}

function RitualRoute() {
  const { tasks, starTask, unstarTask } = useTasks();
  return <RitualView tasks={tasks} onStar={starTask} onUnstar={unstarTask} />;
}

function MatrixRoute() {
  const { tasks, isLoading, error, refresh, completeTask, eliminateTask, reactivateTask, updateTask, updateTaskTags, deleteTask, reorderTasks, unplanTask, planTask, addStep, toggleStep, removeStep } = useTasks();
  const { tags: allTags } = useTags();
  const { setHasFireTasks } = useFireAlert();
  const { status: ritualStatus, isLoading: ritualLoading } = useRitual();
  const navigate = useNavigate();

  useEffect(() => {
    setHasFireTasks(tasks.some((t) => t.quadrant === 'FIRE' && t.status === 'ACTIVE'));
  }, [tasks, setHasFireTasks]);

  // Premier Rituel (v3-15) : compte tout neuf (0 vision, 0 murmure, jamais de
  // rituel) → onboarding guidé. Aucun flag en base, l'état se déduit.
  useEffect(() => {
    if (isLoading || ritualLoading || ritualStatus === null) return;
    if (alreadyCheckedOnboarding()) return;
    markOnboardingChecked();
    if (tasks.length === 0 && ritualStatus.whisperCount === 0 && ritualStatus.lastRitualOn === null) {
      void navigate('/ritual?first=1');
    }
  }, [isLoading, ritualLoading, ritualStatus, tasks.length, navigate]);

  return (
    <AppShell onTaskCreated={refresh}>
      <MatrixView
        tasks={tasks}
        isLoading={isLoading}
        error={error}
        allTags={allTags}
        onComplete={completeTask}
        onEliminate={eliminateTask}
        onReactivate={reactivateTask}
        onUpdate={updateTask}
        onUpdateTags={updateTaskTags}
        onDelete={deleteTask}
        onReorder={reorderTasks}
        onAddStep={addStep}
        onToggleStep={toggleStep}
        onRemoveStep={removeStep}
        onUnplan={unplanTask}
        onPlan={planTask}
        onFocusInput={focusTaskInput}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <ToastList />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<MatrixRoute />} />
                <Route path="/focus" element={<FocusRoute />} />
                <Route path="/ritual" element={<RitualRoute />} />
                <Route path="/history" element={<HistoryView />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
