// Sessão do usuário e contas no Supabase (banco gratuito na nuvem que liga computador e celular).
// O Supabase guarda os tokens sozinho; aqui guardamos só qual banco e qual usuário, para abrir offline.
import './polyfills';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, isAuthRetryableFetchError, type AuthError, type SupabaseClient } from '@supabase/supabase-js';
import type { User } from './types';

const SESSION_KEY = 'rumo:session';
const BACKEND_KEY = 'rumo:backend';

// url = https://<projeto>.supabase.co · key = chave pública (anon ou publishable), feita para ficar no app.
export type Backend = { url: string; key: string };
export type Session = { backend: Backend; user: User };

// Padrão embutido no build (EXPO_PUBLIC_*); o último banco usado com sucesso tem preferência.
export async function loadBackend(): Promise<Backend> {
  const raw = await AsyncStorage.getItem(BACKEND_KEY);
  if (raw) return JSON.parse(raw);
  return { url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '', key: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '' };
}

let cached: { id: string; client: SupabaseClient } | null = null;

export function supabaseFor(b: Backend): SupabaseClient {
  const id = `${b.url}|${b.key}`;
  if (cached?.id !== id) {
    cached = {
      id,
      client: createClient(b.url, b.key, {
        auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        global: { fetch: fetchWithTimeout },
      }),
    };
  }
  return cached.client;
}

// Rede de celular às vezes "pendura" sem erro: depois de 15s a requisição falha e o sync tenta de novo.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  init?.signal?.addEventListener('abort', () => ctrl.abort());
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

export async function loadSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  const s = raw ? JSON.parse(raw) : null;
  return s?.backend?.url && s?.user?.id ? s : null; // ignora sessões do servidor antigo
}

export async function saveSession(s: Session) {
  await AsyncStorage.multiSet([[SESSION_KEY, JSON.stringify(s)], [BACKEND_KEY, JSON.stringify(s.backend)]]);
}

export const clearSession = () => AsyncStorage.removeItem(SESSION_KEY);

export async function authenticate(
  mode: 'login' | 'register',
  backend: Backend,
  body: { email: string; password: string; name?: string },
): Promise<Session> {
  const b = { url: backend.url.trim().replace(/\/+$/, ''), key: backend.key.trim() };
  if (!/^https?:\/\/\S+$/.test(b.url) || !b.key) {
    throw new Error('Configure o banco: cole a URL do projeto e a chave pública do Supabase (toque em "Banco").');
  }
  const sb = supabaseFor(b);
  const email = body.email.trim().toLowerCase();
  const name = body.name?.trim();
  let res;
  try {
    res = mode === 'register'
      ? await sb.auth.signUp({ email, password: body.password, options: { data: name ? { name } : {} } })
      : await sb.auth.signInWithPassword({ email, password: body.password });
  } catch {
    throw new Error(`Não consegui falar com o banco em ${b.url}. Confira o endereço e a internet.`);
  }
  if (res.error) throw new Error(authMessage(res.error, b.url));
  const session = res.data.session;
  // Com "Confirm email" ligado no Supabase, o cadastro só vale depois do link do e-mail.
  if (!session) throw new Error('Conta criada! Abra o link de confirmação que chegou no seu e-mail e depois entre em "Já tenho conta".');
  const u = session.user;
  return {
    backend: b,
    user: { id: u.id, email: u.email ?? email, name: String(u.user_metadata?.name ?? '') || email.split('@')[0] },
  };
}

function authMessage(e: AuthError, url: string): string {
  if (isAuthRetryableFetchError(e)) return `Não consegui falar com o banco em ${url}. Confira o endereço e a internet.`;
  switch (e.code) {
    case 'invalid_credentials': return 'E-mail ou senha incorretos';
    case 'email_not_confirmed': return 'Confirme seu e-mail pelo link que o Supabase enviou e tente de novo.';
    case 'user_already_exists':
    case 'email_exists': return 'Já existe uma conta com esse e-mail';
    case 'weak_password': return 'A senha precisa de pelo menos 6 caracteres';
    case 'email_address_invalid': return 'E-mail inválido';
    case 'signup_disabled': return 'Novos cadastros estão desligados neste banco. Use "Já tenho conta".';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Muitas tentativas seguidas. Espere alguns minutos.';
  }
  return e.message;
}

// scope 'local': sai só deste aparelho; os outros continuam conectados.
export function logoutRemote(s: Session) {
  supabaseFor(s.backend).auth.signOut({ scope: 'local' }).catch(() => {});
}
