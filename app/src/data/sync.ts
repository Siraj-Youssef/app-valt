// Sincronização com o Supabase.
// - Lê do banco tudo com seq > lastSeq (então nada se perde enquanto estava offline).
// - Envia a outbox em lotes pela função push_ops; só apaga da outbox o que o banco confirmou.
// - O Supabase Realtime avisa na hora quando outro aparelho muda algo; o aviso dispara uma nova leitura.
// - Rede caiu: tenta de novo com backoff exponencial + jitter (1s → 30s); ao voltar para o app, sincroniza já.
import { isAuthRetryableFetchError, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { ackOps, applyRemote, getState, pendingOps, saveNow, subscribe } from './store';
import type { Change } from './types';

export type SyncStatus = 'offline' | 'connecting' | 'syncing' | 'online';

const BATCH = 200;
const PAGE = 1000;
const POLL_MS = 60_000; // rede de segurança caso algum aviso do tempo real se perca

let status: SyncStatus = 'offline';
const statusListeners = new Set<() => void>();
function setStatus(s: SyncStatus) {
  if (s === status) return;
  status = s;
  statusListeners.forEach((l) => l());
}
export const useSyncStatus = () =>
  useSyncExternalStore(
    (l) => { statusListeners.add(l); return () => statusListeners.delete(l); },
    () => status,
    () => status,
  );

type Row = { col: Change['col']; id: string; data: unknown; updated_at: number; device_id: string; deleted: boolean; seq: number };
const toChange = (r: Row): Change => ({ col: r.col, id: r.id, data: r.data, updatedAt: r.updated_at, deviceId: r.device_id, deleted: r.deleted, seq: r.seq });

export class SyncClient {
  private stopped = false;
  private running = false;
  private again = false;
  private synced = false;
  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private poll: ReturnType<typeof setInterval>;
  private channel: RealtimeChannel;
  private unsubscribeStore: () => void;
  private appStateSub: { remove(): void };
  private authSub: { unsubscribe(): void };

  constructor(
    private sb: SupabaseClient,
    userId: string,
    private onUnauthorized: () => void,
    private onFirstSync: () => void,
  ) {
    setStatus('connecting');
    this.unsubscribeStore = subscribe(() => { if (pendingOps().length) this.queue(30); });
    this.appStateSub = AppState.addEventListener('change', (s) => this.onAppState(s));
    this.authSub = sb.auth.onAuthStateChange((event) => {
      // Não chamar o Supabase dentro deste callback (recomendação da lib): sai para o próximo tick.
      if (event === 'SIGNED_OUT') setTimeout(() => this.unauthorized(), 0);
    }).data.subscription;
    this.channel = sb
      .channel(`rumo:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${userId}` }, () => this.queue(150))
      .subscribe((s) => { if (s === 'SUBSCRIBED') this.queue(0); });
    this.poll = setInterval(() => this.queue(0), POLL_MS);
    this.queue(0);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.unsubscribeStore();
    this.appStateSub.remove();
    this.authSub.unsubscribe();
    if (this.timer) clearTimeout(this.timer);
    clearInterval(this.poll);
    this.sb.removeChannel(this.channel);
    setStatus('offline');
  }

  private unauthorized() {
    if (this.stopped) return;
    this.stop();
    this.onUnauthorized();
  }

  private onAppState(s: AppStateStatus) {
    if (s === 'active') {
      this.sb.auth.startAutoRefresh();
      this.failures = 0;
      this.queue(0);
    } else {
      this.sb.auth.stopAutoRefresh();
      saveNow();
    }
  }

  private queue(delayMs: number) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.run(); }, delayMs);
  }

  private async run() {
    if (this.running) { this.again = true; return; }
    this.running = true;
    if (pendingOps().length) setStatus('syncing');
    else if (status === 'offline') setStatus('connecting');
    try {
      if (!(await this.hasSession())) return this.unauthorized();
      do {
        this.again = false;
        await this.pull();
        await this.push();
      } while (this.again && !this.stopped);
      if (this.stopped) return;
      this.failures = 0;
      setStatus('online');
      if (!this.synced) { this.synced = true; this.onFirstSync(); }
    } catch (e) {
      if (this.stopped) return;
      setStatus('offline');
      const delay = Math.min(30_000, 1000 * 2 ** this.failures++) * (0.7 + Math.random() * 0.6);
      this.queue(delay);
    } finally {
      this.running = false;
      if (this.again && !this.stopped) this.queue(0);
    }
  }

  // Sem rede, getSession devolve erro "retryable": é só offline, a sessão continua guardada.
  private async hasSession() {
    const { data, error } = await this.sb.auth.getSession();
    if (data.session) return true;
    if (error && isAuthRetryableFetchError(error)) throw error;
    return false;
  }

  private async pull() {
    for (;;) {
      const { data, error } = await this.sb
        .from('records')
        .select('col,id,data,updated_at,device_id,deleted,seq')
        .gt('seq', getState().lastSeq)
        .order('seq')
        .limit(PAGE);
      if (error) throw error;
      if (this.stopped) return;
      applyRemote((data as Row[]).map(toChange));
      if (data.length < PAGE) return;
    }
  }

  private async push() {
    for (;;) {
      const ops = pendingOps().slice(0, BATCH);
      if (ops.length === 0 || this.stopped) return;
      setStatus('syncing');
      const { data, error } = await this.sb.rpc('push_ops', { p_device: getState().deviceId, p_ops: ops });
      if (this.stopped) return;
      if (error?.code === '22023') {
        // Lote recusado por validação: descarta para não travar a fila para sempre.
        console.warn('Lote recusado pelo banco', error.message);
        ackOps(ops);
        continue;
      }
      if (error) throw error;
      ackOps(ops);
      // Aplica a versão vencedora sem o seq: o lastSeq só avança pela leitura,
      // senão poderíamos pular mudanças de outro aparelho que ainda não lemos.
      applyRemote((data as Change[]).map(({ seq, ...c }) => c));
    }
  }
}
