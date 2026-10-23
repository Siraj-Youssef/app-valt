// Coleções do banco local. Cada registro é um documento JSON com id próprio.
export type ColName = 'tasks' | 'completions' | 'settings' | 'goals' | 'goalLogs';

export type Task = {
  title: string;
  icon: string;
  points: number;
  repeat: 'weekly' | 'once';
  weekdays: number[]; // 0 = segunda ... 6 = domingo (só para 'weekly')
  date?: string; // AAAA-MM-DD (só para 'once')
  time?: string; // HH:MM, apenas organização
  durationMin?: number; // apenas organização
  startDate: string; // a tarefa não aparece em dias anteriores à criação
};

// id = `${taskId}@${date}`; desmarcar vira done=false.
export type Completion = { taskId: string; date: string; done: boolean; points: number };

export type GoalsSettings = { daily: number[] }; // settings/goals: meta de pontos de seg..dom
export type ProfileSettings = { name: string; startDate: string }; // settings/profile

export type Goal = {
  title: string;
  icon: string;
  period: 'week' | 'month' | 'year';
  target: number;
  unit: string;
  archived?: boolean;
};

export type GoalLog = { goalId: string; date: string; amount: number };

export type Rec<T = unknown> = {
  id: string;
  data: T | null;
  updatedAt: number;
  deleted: boolean;
};
