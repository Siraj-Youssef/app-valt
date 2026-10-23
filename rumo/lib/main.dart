import 'package:flutter/material.dart';

import 'data/session.dart';
import 'data/store.dart';
import 'data/sync.dart';
import 'logic/dates.dart';
import 'theme.dart';
import 'ui/scope.dart';
import 'ui/screens/login.dart';
import 'ui/shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const RumoApp());
}

class RumoApp extends StatefulWidget {
  const RumoApp({super.key});
  @override
  State<RumoApp> createState() => _RumoAppState();
}

class _RumoAppState extends State<RumoApp> {
  final _store = Store();
  Session? _session;
  SyncClient? _sync;
  bool _booting = true;
  String? _notice;

  @override
  void initState() {
    super.initState();
    loadSession().then((s) async {
      if (s != null) await _start(s);
    }).whenComplete(() => setState(() => _booting = false));
  }

  @override
  void dispose() {
    _sync?.stop();
    super.dispose();
  }

  Future<void> _start(Session s) async {
    await _store.load(s.user.id);
    _sync?.stop();
    _sync = SyncClient(store: _store, serverUrl: s.serverUrl, token: s.token, onUnauthorized: () => _end('Sua sessão expirou. Entre de novo.'));
    setState(() => _session = s);
  }

  Future<void> _end(String? message) async {
    _sync?.stop();
    _sync = null;
    await _store.close(wipe: true);
    await clearSession();
    setState(() {
      _session = null;
      _notice = message;
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    final sync = _sync;
    Widget home;
    if (_booting) {
      home = const Scaffold(body: Center(child: CircularProgressIndicator(color: C.primary)));
    } else if (session == null || sync == null) {
      home = LoginScreen(
        notice: _notice,
        onDone: (s, isNew) async {
          await saveSession(s);
          await _start(s);
          // Só uma conta nova cria o perfil; num login ele vem do servidor (não sobrescreve a data de início).
          if (isNew) _store.put('settings', 'profile', {'name': s.user.name, 'startDate': todayKey()});
        },
      );
    } else {
      home = AppScope(
        store: _store,
        session: session,
        sync: sync,
        logout: () {
          logoutRemote(session);
          _end(null);
        },
        child: const HomeShell(),
      );
    }
    return MaterialApp(title: 'Rumo', debugShowCheckedModeBanner: false, theme: buildTheme(), home: home);
  }
}
