// Cliente de sincronização em tempo real via WebSocket (mesmo protocolo do servidor em server/src/server.js).
// - Reconecta sozinho com backoff exponencial + jitter (1s → 30s) e ao voltar para o app.
// - Ping de aplicação a cada 20s: sem resposta em 10s, a conexão é considerada morta e refeita.
// - Envia a outbox em lotes; só apaga da outbox o que o servidor confirmou (ack).
// - No (re)conectar pede tudo com seq > lastSeq, então nada se perde enquanto estava offline.
import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/widgets.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'store.dart';

enum SyncStatus { offline, connecting, syncing, online }

class SyncClient {
  SyncClient({required this.store, required this.serverUrl, required this.token, required this.onUnauthorized}) {
    store.addListener(_queueFlush);
    _lifecycle = AppLifecycleListener(onResume: _onResume, onPause: () => store.saveNow());
    _connect();
  }

  final Store store;
  final String serverUrl;
  final String token;
  final VoidCallback onUnauthorized;
  final status = ValueNotifier(SyncStatus.offline);

  static const _batch = 200;
  WebSocketChannel? _ws;
  StreamSubscription<dynamic>? _sub;
  late final AppLifecycleListener _lifecycle;
  bool _stopped = false;
  bool _ready = false;
  int _attempt = 0;
  Timer? _reconnectTimer, _pingTimer, _pongTimer, _ackTimer, _flushTimer;
  ({String batch, List<Op> ops})? _inflight;
  final _rand = Random();

  void stop() {
    _stopped = true;
    store.removeListener(_queueFlush);
    _lifecycle.dispose();
    _teardown();
    status.value = SyncStatus.offline;
  }

  void _onResume() {
    // Ao voltar do background a conexão pode estar zumbi: reconecta já, sem esperar o backoff.
    if (_ws == null || !_ready) {
      _attempt = 0;
      _teardown();
      _connect();
    } else {
      _sendPing();
    }
  }

  void _teardown() {
    for (final t in [_reconnectTimer, _pingTimer, _pongTimer, _ackTimer, _flushTimer]) {
      t?.cancel();
    }
    _reconnectTimer = _pingTimer = _pongTimer = _ackTimer = _flushTimer = null;
    _sub?.cancel();
    _sub = null;
    _ws?.sink.close();
    _ws = null;
    _ready = false;
    _inflight = null; // reenviado após reconectar (o servidor é idempotente por LWW)
  }

  Future<void> _connect() async {
    if (_stopped || _ws != null) return;
    status.value = SyncStatus.connecting;
    final uri = Uri.parse('${serverUrl.replaceFirst(RegExp(r'^http'), 'ws').replaceFirst(RegExp(r'/$'), '')}/sync');
    final ws = WebSocketChannel.connect(uri);
    _ws = ws;
    _sub = ws.stream.listen(_onMessage, onDone: () => _onClosed(ws), onError: (_) => _onClosed(ws), cancelOnError: true);
    try {
      await ws.ready;
    } catch (_) {
      _onClosed(ws);
      return;
    }
    if (_ws != ws) return;
    _send({'t': 'hello', 'token': token, 'deviceId': store.deviceId, 'since': store.lastSeq});
    _pingTimer = Timer.periodic(const Duration(seconds: 20), (_) => _sendPing());
  }

  void _onClosed(WebSocketChannel ws) {
    if (_ws != ws) return;
    _teardown();
    if (_stopped) return;
    status.value = SyncStatus.offline;
    final base = min(30000, 1000 * pow(2, _attempt++).toInt());
    final delay = (base * (0.7 + _rand.nextDouble() * 0.6)).round();
    _reconnectTimer = Timer(Duration(milliseconds: delay), _connect);
  }

  void _onMessage(dynamic raw) {
    Map<String, dynamic> msg;
    try {
      msg = (jsonDecode(raw as String) as Map).cast<String, dynamic>();
    } catch (_) {
      return;
    }
    _pongTimer?.cancel();
    _pongTimer = null;
    switch (msg['t']) {
      case 'welcome':
        status.value = SyncStatus.syncing;
      case 'changes':
        store.applyRemote(msg['changes'] as List);
      case 'synced':
        _ready = true;
        _attempt = 0;
        _flush();
      case 'ack':
        final sent = _inflight;
        if (sent != null && sent.batch == msg['batch']) _finishBatch(sent.ops);
        store.applyRemote((msg['changes'] as List?) ?? const []);
        _flush();
      case 'error':
        final sent = _inflight;
        if (msg['code'] == 'unauthorized') {
          stop();
          onUnauthorized();
        } else if (sent != null && msg['batch'] == sent.batch) {
          // Lote recusado por validação: descarta para não travar a fila para sempre.
          debugPrint('Lote recusado pelo servidor: ${msg['message']}');
          _finishBatch(sent.ops);
          _flush();
        }
    }
  }

  void _queueFlush() {
    if (_flushTimer != null) return;
    _flushTimer = Timer(const Duration(milliseconds: 30), () {
      _flushTimer = null;
      _flush();
    });
  }

  void _flush() {
    if (!_ready || _ws == null) return;
    if (_inflight != null) return;
    final ops = store.pendingOps().take(_batch).toList();
    if (ops.isEmpty) {
      status.value = SyncStatus.online;
      return;
    }
    status.value = SyncStatus.syncing;
    final batch = _rand.nextInt(1 << 31).toRadixString(36);
    _inflight = (batch: batch, ops: ops);
    _send({'t': 'push', 'batch': batch, 'ops': ops.map((o) => o.toJson()).toList()});
    _ackTimer = Timer(const Duration(seconds: 15), () => _onClosed(_ws!));
  }

  void _finishBatch(List<Op> ops) {
    store.ackOps(ops);
    _inflight = null;
    _ackTimer?.cancel();
    _ackTimer = null;
  }

  void _sendPing() {
    if (_ws == null || _pongTimer != null) return;
    _send({'t': 'ping'});
    final ws = _ws!;
    _pongTimer = Timer(const Duration(seconds: 10), () => _onClosed(ws));
  }

  void _send(Map<String, dynamic> msg) => _ws?.sink.add(jsonEncode(msg));
}
