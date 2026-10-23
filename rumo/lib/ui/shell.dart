// Navegação principal: 4 abas com rótulo e um botão "+" contextual
// (na aba Metas cria meta; em Hoje e Mapa, um novo passo; em Você não aparece).
import 'package:flutter/material.dart';

import '../theme.dart';
import 'scope.dart';
import 'screens/goals.dart';
import 'screens/map.dart';
import 'screens/today.dart';
import 'screens/you.dart';
import 'sheets.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final store = AppScope.of(context).store;
    final pages = [TodayScreen(goTo: (i) => setState(() => _tab = i)), const MapScreen(), const GoalsScreen(), const YouScreen()];
    return Scaffold(
      body: IndexedStack(index: _tab, children: pages),
      floatingActionButton: _tab == 3
          ? null
          : FloatingActionButton.extended(
              backgroundColor: C.primary,
              foregroundColor: C.onPrimary,
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              onPressed: () => _tab == 2 ? showGoalSheet(context, store) : openNewStep(context, store),
              icon: const Icon(Icons.add),
              label: Text(_tab == 2 ? 'Meta' : 'Passo', style: body(15, weight: FontWeight.w600, color: C.onPrimary)),
            ),
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: C.surface,
          indicatorColor: C.primarySoft,
          surfaceTintColor: Colors.transparent,
          labelTextStyle: WidgetStateProperty.resolveWith(
            (s) => body(11, weight: s.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500, color: s.contains(WidgetState.selected) ? C.primary : C.inkFaint),
          ),
          iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? C.primary : C.inkFaint)),
        ),
        child: Container(
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: C.line))),
          child: NavigationBar(
            height: 68,
            selectedIndex: _tab,
            onDestinationSelected: (i) => setState(() => _tab = i),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.wb_sunny_outlined), selectedIcon: Icon(Icons.wb_sunny), label: 'Hoje'),
              NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map), label: 'Mapa'),
              NavigationDestination(icon: Icon(Icons.flag_outlined), selectedIcon: Icon(Icons.flag), label: 'Metas'),
              NavigationDestination(icon: Icon(Icons.account_circle_outlined), selectedIcon: Icon(Icons.account_circle), label: 'Você'),
            ],
          ),
        ),
      ),
    );
  }
}
