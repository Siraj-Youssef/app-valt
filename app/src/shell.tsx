// Estado de interface compartilhado entre as telas: abrir sheets, sessão e sair.
import { createContext, useContext } from 'react';
import type { Goal, Task, User } from './data/types';

export type ShellApi = {
  user: User;
  serverUrl: string;
  openTask: (opts: { mode: 'weekly' | 'once'; date?: string; editing?: (Task & { id: string }) | null }) => void;
  openGoal: (editing?: (Goal & { id: string }) | null) => void;
  openLog: (goalId?: string | null) => void;
  logout: () => void;
};

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell fora do ShellContext');
  return ctx;
}
