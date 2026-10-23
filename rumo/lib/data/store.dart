// Banco local offline-first: tudo é lido e gravado aqui primeiro (a interface nunca espera a rede).
// Cada gravação local também entra na "caixa de saída" (outbox), que o SyncClient envia ao servidor.
// Mudanças vindas do servidor são aplicadas com "last writer wins" por registro (mesma regra do servidor).
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

const collections = ['tasks', 'completions', 'settings', 'goals', 'goalLogs'];
const _uuid = Uuid();
String newId() => _uuid.v4();

class Rec {
  Rec({required this.id, required this.data, required this.updatedAt, required this.deviceId, required this.deleted});
  final String id;
  final Map<String, dynamic>? data;
  final int updatedAt;
  final String deviceId;
  final bool deleted;

  factory Rec.fromJson(Map<String, dynamic> j) => Rec(
        id: j['id'] as String,
        data: (j['data'] as Map?)?.cast<String, dynamic>(),
        updatedAt: (j['updatedAt'] as num).toInt(),
        deviceId: j['deviceId'] as String? ?? '',
        deleted: j['deleted'] == true,
      );

  Map<String, dynamic> toJson() => {'id': id, 'data': data, 'updatedAt': updatedAt, 'deviceId': deviceId, 'deleted': deleted};

  // Desempate determinístico: maior timestamp vence; em empate, maior deviceId.
  bool newerThan(Rec? other) =>
      other == null || updatedAt > other.updatedAt || (updatedAt == other.updatedAt && deviceId.compareTo(other.deviceId) > 0);
}

class Op {
  Op({required this.col, required this.id, required this.data, required this.updatedAt, required this.deleted});
  final String col;
  final String id;
  final Map<String, dynamic>? data;
  final int updatedAt;
  final bool deleted;

  factory Op.fromJson(Map<String, dynamic> j) => Op(
        col: j['col'] as String,
        id: j['id'] as String,
        data: (j['data'] as Map?)?.cast<String, dynamic>(),
        updatedAt: (j['updatedAt'] as num).toInt(),
        deleted: j['deleted'] == true,
      );

  Map<String, dynamic> toJson() => {'col': col, 'id': id, 'data': data, 'updatedAt': updatedAt, 'deleted': deleted};
}

class Store extends ChangeNotifier {
  Map<String, Map<String, Rec>> cols = {for (final c in collections) c: {}};
  Map<String, Op> outbox = {}; // chave "col/id": só a versão mais nova de cada registro
  int lastSeq = 0;
  String deviceId = '';
  int version = 0;

  String? _key;
  Timer? _saveTimer;

  Future<void> load(String userId) async {
    _key = 'rumo:db:$userId';
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key!);
    cols = {for (final c in collections) c: {}};
    outbox = {};
    lastSeq = 0;
    deviceId = newId();
    if (raw != null) {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      final savedCols = (j['cols'] as Map).cast<String, dynamic>();
      for (final c in collections) {
        final m = (savedCols[c] as Map?)?.cast<String, dynamic>() ?? {};
        cols[c] = m.map((k, v) => MapEntry(k, Rec.fromJson((v as Map).cast<String, dynamic>())));
      }
      outbox = ((j['outbox'] as Map?) ?? {}).map((k, v) => MapEntry(k as String, Op.fromJson((v as Map).cast<String, dynamic>())));
      lastSeq = (j['lastSeq'] as num?)?.toInt() ?? 0;
      deviceId = j['deviceId'] as String? ?? deviceId;
    } else {
      await saveNow();
    }
    _changed(save: false);
  }

  Future<void> close({required bool wipe}) async {
    final key = _key;
    await saveNow();
    _key = null;
    if (wipe && key != null) (await SharedPreferences.getInstance()).remove(key);
    cols = {for (final c in collections) c: {}};
    outbox = {};
    lastSeq = 0;
    _changed(save: false);
  }

  Future<void> saveNow() async {
    _saveTimer?.cancel();
    _saveTimer = null;
    final key = _key;
    if (key == null) return;
    final json = jsonEncode({
      'cols': cols.map((c, m) => MapEntry(c, m.map((k, r) => MapEntry(k, r.toJson())))),
      'outbox': outbox.map((k, o) => MapEntry(k, o.toJson())),
      'lastSeq': lastSeq,
      'deviceId': deviceId,
    });
    await (await SharedPreferences.getInstance()).setString(key, json);
  }

  void _changed({bool save = true}) {
    version++;
    if (save && _key != null) {
      _saveTimer?.cancel();
      _saveTimer = Timer(const Duration(milliseconds: 250), saveNow);
    }
    notifyListeners();
  }

  void _write(String col, String id, Map<String, dynamic>? data, bool deleted) {
    final current = cols[col]![id];
    // A edição local sempre supera a versão que o usuário está vendo, mesmo com o relógio atrasado.
    final now = DateTime.now().millisecondsSinceEpoch;
    final updatedAt = current != null && current.updatedAt + 1 > now ? current.updatedAt + 1 : now;
    cols[col]![id] = Rec(id: id, data: deleted ? null : data, updatedAt: updatedAt, deviceId: deviceId, deleted: deleted);
    outbox['$col/$id'] = Op(col: col, id: id, data: deleted ? null : data, updatedAt: updatedAt, deleted: deleted);
    _changed();
  }

  void put(String col, String id, Map<String, dynamic> data) => _write(col, id, data, false);
  void remove(String col, String id) => _write(col, id, null, true);

  void applyRemote(List<dynamic> changes) {
    if (changes.isEmpty) return;
    var changed = false;
    for (final raw in changes) {
      final c = (raw as Map).cast<String, dynamic>();
      final seq = (c['seq'] as num?)?.toInt();
      if (seq != null && seq > lastSeq) {
        lastSeq = seq;
        changed = true;
      }
      final col = c['col'] as String;
      if (!cols.containsKey(col)) continue;
      final rec = Rec.fromJson(c);
      if (!rec.newerThan(cols[col]![rec.id])) continue;
      cols[col]![rec.id] = rec;
      changed = true;
    }
    if (changed) _changed();
  }

  List<Op> pendingOps() => outbox.values.toList();

  // Remove da outbox só o que foi confirmado e não foi editado de novo enquanto o lote viajava.
  void ackOps(List<Op> sent) {
    var changed = false;
    for (final op in sent) {
      final key = '${op.col}/${op.id}';
      if (outbox[key]?.updatedAt == op.updatedAt) {
        outbox.remove(key);
        changed = true;
      }
    }
    if (changed) _changed();
  }

  Iterable<MapEntry<String, Map<String, dynamic>>> live(String col) =>
      cols[col]!.values.where((r) => !r.deleted && r.data != null).map((r) => MapEntry(r.id, r.data!));

  Map<String, dynamic>? get(String col, String id) {
    final r = cols[col]![id];
    return r == null || r.deleted ? null : r.data;
  }
}
