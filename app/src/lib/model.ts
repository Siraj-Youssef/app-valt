// Regras de pontuação, metas, sequência, nível e projeção — tudo derivado dos registros locais.
import type { DbState } from '../data/store';
import type { Completion, Goal, GoalLog, GoalsSettings, ProfileSettings, Task } from '../data/types';
import { addDays, monthKeys, rangeKeys, todayKey, weekKeys, weekdayOf } from './dates';

export const DEFAULT_DAILY = [0, 0, 0, 0, 0, 0, 0];

export type Model = {
  tasks: (Task & { id: string })[];
  completions: Map<string, Completion>;
  pointsByDate: Map<string, number>;
  doneByDate: Map<string, string[]>;
  daily: number[];
  profile: ProfileSettings | null;
  goals: (Goal & { id: string })[];
  goalLogs: (GoalLog & { id: string })[];
  startDate: string;
};

function live<T>(s: DbState, col: keyof DbState['cols']): (T & { id: string })[] {
  return Object.values(s.cols[col])
    .filter((r) => !r.deleted && r.data)
    .map((r) => ({ ...(r.data as T), id: r.id }));
}

let cache: { version: number; model: Model } | null = null;

export function buildModel(s: DbState): Model {
  if (cache?.version === s.version) return cache.model;
  const tasks = live<Task>(s, 'tasks').sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.title.localeCompare(b.title));
  const completions = new Map<string, Completion>();
  const pointsByDate = new Map<string, number>();
  const doneByDate = new Map<string, string[]>();
  for (const c of live<Completion>(s, 'completions')) {
    completions.set(c.id, c);
    if (!c.done) continue;
    pointsByDate.set(c.date, (pointsByDate.get(c.date) ?? 0) + c.points);
    doneByDate.set(c.date, [...(doneByDate.get(c.date) ?? []), c.taskId]);
  }
  const goalsRec = s.cols.settings.goals;
  const profileRec = s.cols.settings.profile;
  const profile = profileRec && !profileRec.deleted ? (profileRec.data as ProfileSettings) : null;
  const daily = goalsRec && !goalsRec.deleted ? (goalsRec.data as GoalsSettings).daily : DEFAULT_DAILY;
  const model: Model = {
    tasks,
    completions,
    pointsByDate,
    doneByDate,
    daily,
    profile,
    goals: live<Goal>(s, 'goals').filter((g) => !g.archived),
    goalLogs: live<GoalLog>(s, 'goalLogs'),
    startDate: profile?.startDate ?? todayKey(),
  };
  cache = { version: s.version, model };
  return model;
}

export const completionId = (taskId: string, date: string) => `${taskId}@${date}`;

export function tasksFor(m: Model, date: string) {
  const wd = weekdayOf(date);
  return m.tasks.filter((t) =>
    t.repeat === 'once' ? t.date === date : date >= t.startDate && t.weekdays.includes(wd),
  );
}

export const isDone = (m: Model, taskId: string, date: string) => !!m.completions.get(completionId(taskId, date))?.done;
export const pointsOn = (m: Model, date: string) => m.pointsByDate.get(date) ?? 0;
export const goalOn = (m: Model, date: string) => m.daily[weekdayOf(date)] ?? 0;
export const metOn = (m: Model, date: string) => goalOn(m, date) > 0 && pointsOn(m, date) >= goalOn(m, date);
export const weekGoal = (m: Model) => m.daily.reduce((a, b) => a + b, 0);
export const sum = (keys: string[], f: (k: string) => number) => keys.reduce((acc, k) => acc + f(k), 0);

// Sequência: dias seguidos batendo a meta. Dias com meta 0 (ex.: fim de semana livre) não quebram nem contam.
// Hoje ainda não batido não zera a sequência — o dia não acabou.
export function streaks(m: Model, today = todayKey()) {
  let best = 0;
  let run = 0;
  for (const k of rangeKeys(m.startDate, today)) {
    if (goalOn(m, k) === 0) continue;
    if (metOn(m, k)) best = Math.max(best, ++run);
    else if (k !== today) run = 0;
  }
  return { current: run, best };
}

// Nível: começa em 1 e sobe uma vez para cada semana em que a meta semanal foi batida.
export function level(m: Model, today = todayKey()) {
  const goal = weekGoal(m);
  let weeksMet = 0;
  for (let monday = weekKeys(m.startDate)[0]; monday <= today; monday = addDays(monday, 7)) {
    const pts = sum(weekKeys(monday), (k) => pointsOn(m, k));
    if (goal > 0 && pts >= goal) weeksMet++;
  }
  const thisWeek = sum(weekKeys(today), (k) => pointsOn(m, k));
  return { level: 1 + weeksMet, weekPoints: thisWeek, weekGoal: goal, missing: Math.max(0, goal - thisWeek) };
}

export function monthStats(m: Model, year: number, month: number, today = todayKey()) {
  const keys = monthKeys(year, month);
  const points = sum(keys, (k) => pointsOn(m, k));
  const goal = sum(keys, (k) => goalOn(m, k));
  const stars = keys.filter((k) => metOn(m, k)).length;
  const tasksDone = sum(keys, (k) => m.doneByDate.get(k)?.length ?? 0);
  // Ritmo = pontos feitos / meta acumulada dos dias já vividos (a partir do início de uso).
  const elapsed = keys.filter((k) => k <= today && k >= m.startDate);
  const goalSoFar = sum(elapsed, (k) => goalOn(m, k));
  const pace = goalSoFar > 0 ? points / goalSoFar : 0;
  return { keys, points, goal, stars, tasksDone, pace, projection: Math.round(goal * pace), hasGoal: goalSoFar > 0 };
}

export function goalProgress(m: Model, goal: Goal & { id: string }, today = todayKey()) {
  const d = new Date();
  let from: string;
  if (goal.period === 'week') from = weekKeys(today)[0];
  else if (goal.period === 'month') from = monthKeys(d.getFullYear(), d.getMonth())[0];
  else from = `${d.getFullYear()}-01-01`;
  const done = m.goalLogs.filter((l) => l.goalId === goal.id && l.date >= from && l.date <= today).reduce((a, l) => a + l.amount, 0);
  return { done, ratio: goal.target > 0 ? Math.min(1, done / goal.target) : 0 };
}

// "Bússola": uma frase de orientação para o momento, sempre com o próximo passo concreto.
export function compassTip(m: Model, today = todayKey()): { text: string; action?: 'new' | 'goals' } {
  const pts = pointsOn(m, today);
  const goal = goalOn(m, today);
  if (m.tasks.length === 0) return { text: 'Seu mapa está em branco. Adicione o primeiro hábito e diga quanto ele vale.', action: 'new' };
  if (weekGoal(m) === 0) return { text: 'Defina quantos pontos quer fazer por dia para traçar sua rota.', action: 'goals' };
  if (goal > 0 && pts >= goal) return { text: `Marco do dia alcançado com ${pts} pts. Descanse ou siga adiante.` };
  const left = tasksFor(m, today).filter((t) => !isDone(m, t.id, today));
  if (goal > 0 && left.length > 0) {
    const next = [...left].sort((a, b) => (a.durationMin ?? 99) - (b.durationMin ?? 99))[0];
    return { text: `Faltam ${goal - pts} pts para o marco de hoje. Próximo passo: ${next.icon} ${next.title}.` };
  }
  if (goal === 0) return { text: 'Hoje é dia livre na sua rota. Qualquer passo conta como extra.' };
  return { text: `Faltam ${goal - pts} pts e o plano de hoje acabou. Que tal um passo extra?`, action: 'new' };
}

export type DayPeriod = 'Manhã' | 'Tarde' | 'Noite' | 'Qualquer hora';
export function periodOf(time?: string): DayPeriod {
  if (!time) return 'Qualquer hora';
  const h = Number(time.slice(0, 2));
  return h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite';
}

export function routeStatus(pace: number, hasGoal: boolean) {
  if (!hasGoal) return { label: 'Sem rota', tone: 'muted' as const, body: 'Defina pontos por dia para ver a previsão do mês.' };
  if (pace >= 1) return { label: 'Em rota', tone: 'good' as const, body: 'Mantendo esse passo, você chega à meta do mês.' };
  if (pace >= 0.8) return { label: 'Perto da rota', tone: 'warn' as const, body: 'Um pouco mais por dia e você volta à rota.' };
  return { label: 'Fora da rota', tone: 'bad' as const, body: 'Ajuste o passo: escolha hábitos menores ou revise a meta.' };
}
