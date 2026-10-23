// Estado de interface compartilhado entre as telas: abrir os formulários (sheets).
import { createContext, useContext } from 'react';
import type { Goal, Task } from './data/types';

export type ShellApi = {
  openTask: (opts: { mode: 'weekly' | 'once'; date?: string; editing?: (Task & { id: string }) | null }) => void;
  openGoal: (editing?: (Goal & { id: string }) | null) => void;
  openLog: (goalId?: string | null) => void;
};

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell fora do ShellContext');
  return ctx;
}
