// Datas como chaves locais 'AAAA-MM-DD' (sem fuso), semana começando na segunda.
export const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const WEEKDAY_LETTER = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
export const WEEKDAY_LONG = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export const weekdayOf = (key: string) => (fromKey(key).getDay() + 6) % 7;

export function weekKeys(key: string): string[] {
  const monday = addDays(key, -weekdayOf(key));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function monthKeys(year: number, month: number): string[] {
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => toKey(new Date(year, month, i + 1)));
}

export function rangeKeys(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

export const dayOfMonth = (key: string) => Number(key.slice(8, 10));

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
}
