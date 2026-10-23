// Dependências compartilhadas entre as telas: banco local, sessão, sincronização e ações globais.
import 'package:flutter/widgets.dart';

import '../data/session.dart';
import '../data/store.dart';
import '../data/sync.dart';

class AppScope extends InheritedWidget {
  const AppScope({super.key, required this.store, required this.session, required this.sync, required this.logout, required super.child});

  final Store store;
  final Session session;
  final SyncClient sync;
  final VoidCallback logout;

  static AppScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!;

  @override
  bool updateShouldNotify(AppScope old) => store != old.store || session != old.session || sync != old.sync;
}
