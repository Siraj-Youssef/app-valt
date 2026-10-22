// Cliente de sincronização em tempo real via WebSocket.
// - Reconecta sozinho com backoff exponencial + jitter (1s → 30s) e ao voltar para o app.
// - Ping de aplicação a cada 20s: se não vier pong em 10s, a conexão é considerada morta.
// - Envia a outbox em lotes; só apaga da outbox o que o servidor confirmou (ack).
// - No (re)conectar pede tudo com seq > lastSeq, então nada se perde enquanto estava offline.
import { AppState, type AppStateStatus } from 'react-native';
import { useSyncExternalStore } from 'react';
import { ackOps, applyRemote, getState, pendingOps, saveNow, subscribe } from './store';
import type { Op } from './types';

export type SyncStatus = 'offline' | 'connecting' | 'syncing' | 'online';

const BATCH = 200;
const ACK_TIMEOUT_MS = 15_000;
const PING_EVERY_MS = 20_000;
const PONG_TIMEOUT_MS = 10_000;

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

export class SyncClient {
  private ws: WebSocket | null = null;
  private stopped = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private ackTimer: ReturnType<typeof setTimeout> | null = null;
  private inflight: { batch: string; ops: Op[] } | null = null;
  private ready = false;
  private unsubscribeStore: () => void;
  private appStateSub: { remove(): void };
  private flushQueued = false;

  constructor(
    private serverUrl: string,
    private token: string,
    private onUnauthorized: () => void,
  ) {
    this.unsubscribeStore = subscribe(() => this.queueFlush());
    this.appStateSub = AppState.addEventListener('change', (s) => this.onAppState(s));
    this.connect();
  }

  stop() {
    this.stopped = true;
    this.unsubscribeStore();
    this.appStateSub.remove();
    this.clearTimers();
    this.ws?.close();
    this.ws = null;
    setStatus('offline');
  }

  private onAppState(s: AppStateStatus) {
    if (s === 'active') {
      // Ao voltar do background a conexão pode estar zumbi: reconecta já, sem esperar o backoff.
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) this.reconnectNow();
      else this.sendPing();
    } else {
      saveNow();
    }
  }

  private reconnectNow() {
    this.attempt = 0;
    this.clearTimers();
    const old = this.ws;
    this.ws = null; // o onclose do socket antigo é ignorado
    this.ready = false;
    this.inflight = null;
    old?.close();
    this.connect();
  }

  private connect() {
    if (this.stopped || (this.ws && this.ws.readyState <= WebSocket.OPEN)) return;
    setStatus('connecting');
    const url = this.serverUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/sync';
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      const { deviceId, lastSeq } = getState();
      this.send({ t: 'hello', token: this.token, deviceId, since: lastSeq });
      this.pingTimer = setInterval(() => this.sendPing(), PING_EVERY_MS);
    };

    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null; }
      switch (msg.t) {
        case 'welcome':
          setStatus('syncing');
          break;
        case 'changes':
          applyRemote(msg.changes);
          break;
        case 'synced':
          this.ready = true;
          this.attempt = 0;
          this.flush();
          break;
        case 'ack': {
          const sent = this.inflight;
          if (sent && sent.batch === msg.batch) this.finishBatch(sent.ops);
          applyRemote(msg.changes ?? []);
          this.flush();
          break;
        }
        case 'error': {
          const sent = this.inflight;
          if (msg.code === 'unauthorized') {
            this.stop();
            this.onUnauthorized();
          } else if (sent && msg.batch === sent.batch) {
            // Lote recusado por validação: descarta para não travar a fila para sempre.
            console.warn('Lote recusado pelo servidor', msg.message);
            this.finishBatch(sent.ops);
            this.flush();
          }
          break;
        }
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.ready = false;
      this.inflight = null; // será reenviado após reconectar (o servidor é idempotente por LWW)
      this.clearTimers();
      if (this.stopped) return;
      setStatus('offline');
      const delay = Math.min(30_000, 1000 * 2 ** this.attempt++) * (0.7 + Math.random() * 0.6);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };

    ws.onerror = () => { /* onclose cuida da reconexão */ };
  }

  private queueFlush() {
    if (this.flushQueued) return;
    this.flushQueued = true;
    setTimeout(() => { this.flushQueued = false; this.flush(); }, 30);
  }

  private flush() {
    if (!this.ready || this.inflight || !this.ws) {
      if (this.ready && !this.inflight) setStatus('online');
      return;
    }
    const ops = pendingOps().slice(0, BATCH);
    if (ops.length === 0) return setStatus('online');
    setStatus('syncing');
    this.inflight = { batch: Math.random().toString(36).slice(2), ops };
    this.send({ t: 'push', batch: this.inflight.batch, ops });
    this.ackTimer = setTimeout(() => this.ws?.close(), ACK_TIMEOUT_MS);
  }

  private finishBatch(ops: Op[]) {
    ackOps(ops);
    this.inflight = null;
    if (this.ackTimer) clearTimeout(this.ackTimer);
    this.ackTimer = null;
  }

  private sendPing() {
    if (this.ws?.readyState !== WebSocket.OPEN || this.pongTimer) return;
    this.send({ t: 'ping' });
    this.pongTimer = setTimeout(() => this.ws?.close(), PONG_TIMEOUT_MS);
  }

  private send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private clearTimers() {
    for (const t of [this.pingTimer, this.pongTimer, this.ackTimer, this.reconnectTimer]) {
      if (t) { clearTimeout(t as any); clearInterval(t as any); }
    }
    this.pingTimer = this.pongTimer = this.ackTimer = this.reconnectTimer = null;
  }
}
