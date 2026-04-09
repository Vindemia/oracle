import { createContext, useContext, useState, type ReactNode } from 'react';

interface FireAlertContextValue {
  hasFireTasks: boolean;
  setHasFireTasks: (v: boolean) => void;
}

const FireAlertContext = createContext<FireAlertContextValue>({
  hasFireTasks: false,
  setHasFireTasks: () => {},
});

export function FireAlertProvider({ children }: { children: ReactNode }) {
  const [hasFireTasks, setHasFireTasks] = useState(false);
  return (
    <FireAlertContext.Provider value={{ hasFireTasks, setHasFireTasks }}>
      {children}
    </FireAlertContext.Provider>
  );
}

export function useFireAlert() {
  return useContext(FireAlertContext);
}
