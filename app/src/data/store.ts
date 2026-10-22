// Banco local offline-first: tudo é lido e gravado aqui primeiro (a interface nunca espera a rede).
// Cada gravação local também entra na "caixa de saída" (outbox), que o SyncClient envia ao servidor.
// Mudanças vindas do servidor são aplicadas com "last writer wins" por registro.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import type { Change, ColName, Op, Rec } from './types';

type Cols = Record<ColName, Record<string, Rec>>;

export type DbState = {
  version: number;
  cols: Cols;
  outbox: Record<string, Op>; // chave `${col}/${id}`: só a versão mais nova de cada registro
  lastSeq: number;
  deviceId: string;
};

const emptyCols = (): Cols => ({ tasks: {}, completions: {}, settings: {}, goals: {}, goalLogs: {} });

let state: DbState = { version: 0, cols: emptyCols(), outbox: {}, lastSeq: 0, deviceId: '' };
let storageKey = '';
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

// LWW: maior timestamp vence; empate decidido pelo deviceId (mesma regra do servidor).
const newer = (a: Pick<Rec, 'updatedAt' | 'deviceId'>, b?: Pick<Rec, 'updatedAt' | 'deviceId'>) =>
  !b || a.updatedAt > b.updatedAt || (a.updatedAt === b.updatedAt && a.deviceId > b.deviceId);

function commit(next: Omit<DbState, 'version'>) {
  state = { ...next, version: state.version + 1 };
  scheduleSave();
  listeners.forEach((l) => l());
}

function scheduleSave() {
  if (!storageKey) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}

export async function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (!storageKey) return;
  const { cols, outbox, lastSeq, deviceId } = state;
  await AsyncStorage.setItem(storageKey, JSON.stringify({ cols, outbox, lastSeq, deviceId }));
}

export async function loadDb(userId: string) {
  storageKey = `rumo:db:${userId}`;
  const raw = await AsyncStorage.getItem(storageKey);
  const saved = raw ? JSON.parse(raw) : null;
  state = {
    version: state.version + 1,
    cols: { ...emptyCols(), ...(saved?.cols ?? {}) },
    outbox: saved?.outbox ?? {},
    lastSeq: saved?.lastSeq ?? 0,
    deviceId: saved?.deviceId ?? randomUUID(),
  };
  if (!saved) await saveNow();
  listeners.forEach((l) => l());
}

export async function closeDb(wipe: boolean) {
  const key = storageKey;
  await saveNow();
  storageKey = '';
  if (wipe && key) await AsyncStorage.removeItem(key);
  state = { version: state.version + 1, cols: emptyCols(), outbox: {}, lastSeq: 0, deviceId: '' };
  listeners.forEach((l) => l());
}

export const getState = () => state;

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useDb = () => useSyncExternalStore(subscribe, getState, getState);

function write(col: ColName, id: string, data: unknown, deleted: boolean) {
  const current = state.cols[col][id];
  // Garante que a edição local sempre supera a versão que o usuário está vendo,
  // mesmo que o relógio deste aparelho esteja atrasado em relação a outro.
  const updatedAt = Math.max(Date.now(), (current?.updatedAt ?? 0) + 1);
  const rec: Rec = { id, data: deleted ? null : data, updatedAt, deviceId: state.deviceId, deleted };
  commit({
    ...state,
    cols: { ...state.cols, [col]: { ...state.cols[col], [id]: rec } },
    outbox: { ...state.outbox, [`${col}/${id}`]: { col, id, data: rec.data, updatedAt, deleted } },
  });
}

export const put = <T,>(col: ColName, id: string, data: T) => write(col, id, data, false);
export const remove = (col: ColName, id: string) => write(col, id, null, true);
export const newId = () => randomUUID();

export function applyRemote(changes: Change[]) {
  if (changes.length === 0) return;
  let cols = state.cols;
  let lastSeq = state.lastSeq;
  for (const c of changes) {
    if (c.seq && c.seq > lastSeq) lastSeq = c.seq;
    if (!newer(c, cols[c.col]?.[c.id])) continue;
    cols = { ...cols, [c.col]: { ...cols[c.col], [c.id]: { id: c.id, data: c.data, updatedAt: c.updatedAt, deviceId: c.deviceId, deleted: c.deleted } } };
  }
  if (cols === state.cols && lastSeq === state.lastSeq) return;
  commit({ ...state, cols, lastSeq });
}

export const pendingOps = (): Op[] => Object.values(state.outbox);

// Remove da outbox só o que foi confirmado e não foi editado de novo enquanto o lote viajava.
export function ackOps(sent: Op[]) {
  const outbox = { ...state.outbox };
  let changed = false;
  for (const op of sent) {
    const key = `${op.col}/${op.id}`;
    if (outbox[key]?.updatedAt === op.updatedAt) {
      delete outbox[key];
      changed = true;
    }
  }
  if (changed) commit({ ...state, outbox });
}
