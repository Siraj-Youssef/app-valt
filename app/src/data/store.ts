// Banco local: tudo fica guardado só neste celular (AsyncStorage), sem conta e sem internet.
// As telas leem o estado por useDb() e gravam com put()/remove(); a gravação em disco é agrupada (250 ms).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import type { ColName, Rec } from './types';

type Cols = Record<ColName, Record<string, Rec>>;

export type DbState = { version: number; cols: Cols };

const STORAGE_KEY = 'rumo:db';
const emptyCols = (): Cols => ({ tasks: {}, completions: {}, settings: {}, goals: {}, goalLogs: {} });

let state: DbState = { version: 0, cols: emptyCols() };
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function commit(cols: Cols) {
  state = { version: state.version + 1, cols };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
  listeners.forEach((l) => l());
}

export async function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ cols: state.cols }));
}

export async function loadDb() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const saved = raw ? JSON.parse(raw) : null;
  state = { version: state.version + 1, cols: { ...emptyCols(), ...(saved?.cols ?? {}) } };
  listeners.forEach((l) => l());
}

export const getState = () => state;

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useDb = () => useSyncExternalStore(subscribe, getState, getState);

export function put<T>(col: ColName, id: string, data: T) {
  const rec: Rec = { id, data, updatedAt: Date.now(), deleted: false };
  commit({ ...state.cols, [col]: { ...state.cols[col], [id]: rec } });
}

export function remove(col: ColName, id: string) {
  const { [id]: _, ...rest } = state.cols[col];
  commit({ ...state.cols, [col]: rest });
}

export const newId = () => randomUUID();
