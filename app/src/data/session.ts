// Sessão do usuário (servidor, token, perfil) e chamadas HTTP de conta.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { User } from './types';

const KEY = 'rumo:session';
const SERVER_PORT = 8787;

export type Session = { serverUrl: string; token: string; user: User };

// Padrão: EXPO_PUBLIC_SERVER_URL; senão, o mesmo IP do computador que roda o Metro (útil com Expo Go na rede local).
export function defaultServerUrl(): string {
  const env = process.env.EXPO_PUBLIC_SERVER_URL;
  if (env) return env;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:${SERVER_PORT}`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:${SERVER_PORT}` : `http://192.168.0.10:${SERVER_PORT}`;
}

export async function loadSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export const saveSession = (s: Session) => AsyncStorage.setItem(KEY, JSON.stringify(s));
export const clearSession = () => AsyncStorage.removeItem(KEY);

export async function authenticate(
  mode: 'login' | 'register',
  serverUrl: string,
  body: { email: string; password: string; name?: string },
): Promise<Session> {
  const base = serverUrl.trim().replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/auth/${mode}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Não consegui falar com o servidor em ${base}. Confira o endereço e se o celular está na mesma rede.`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `Erro ${res.status}`);
  return { serverUrl: base, token: json.token, user: json.user };
}

export function logoutRemote(s: Session) {
  fetch(`${s.serverUrl}/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${s.token}` } }).catch(() => {});
}
