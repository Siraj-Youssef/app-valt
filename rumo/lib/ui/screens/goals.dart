import 'package:flutter/material.dart';

import '../../data/store.dart';
import '../../logic/dates.dart';
import '../../logic/model.dart';
import '../../theme.dart';
import '../scope.dart';
import '../sheets.dart';
import '../widgets.dart';

const _sectionTitle = {'week': 'Nesta semana', 'month': 'Neste mês', 'year': 'Neste ano'};

class GoalsScreen extends StatelessWidget {
  const GoalsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = AppScope.of(context).store;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final m = Model.of(store);
        return ScreenScroll(children: [
          const ScreenHeader(kicker: 'Destinos', title: 'Metas'),
          Text('Aonde você quer chegar nesta semana, neste mês e neste ano. Toque em +1 a cada avanço.', style: body(15, color: C.inkDim)),
          if (m.goals.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 20),
              child: RCard(
                padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
                child: Column(children: [
                  const Icon(Icons.emoji_events_outlined, size: 30, color: C.ink),
                  const SizedBox(height: 8),
                  Text('Nenhum destino ainda', style: body(15, weight: FontWeight.w500)),
                  const SizedBox(height: 4),
                  Text('Ex.: ler 4 livros no mês, correr 20 km na semana.', textAlign: TextAlign.center, style: body(13, color: C.inkDim)),
                  TextAction(label: 'Criar meta', color: C.primary, onPressed: () => showGoalSheet(context, store)),
                ]),
              ),
            ),
          for (final p in ['week', 'month', 'year'])
            if (m.goals.any((g) => g.period == p))
              Section(
                title: _sectionTitle[p]!,
                child: Column(children: [
                  for (final g in m.goals.where((g) => g.period == p).toList()..sort((a, b) => a.title.compareTo(b.title)))
                    _GoalCard(goal: g, progress: m.goalProgress(g), store: store),
                ]),
              ),
          if (m.goals.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('Segure o +1 para registrar outro valor · toque na meta para editar', textAlign: TextAlign.center, style: body(12, color: C.inkFaint)),
            ),
        ]);
      },
    );
  }
}

class _GoalCard extends StatelessWidget {
  const _GoalCard({required this.goal, required this.progress, required this.store});
  final Goal goal;
  final ({int done, double ratio}) progress;
  final Store store;

  @override
  Widget build(BuildContext context) {
    final reached = progress.ratio >= 1;
    return RCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: InkWell(
              onTap: () => showGoalSheet(context, store, editing: goal),
              child: Row(children: [
                Text(goal.icon, style: const TextStyle(fontSize: 24)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(goal.title, style: body(16, weight: FontWeight.w500)),
                    Text('${progress.done} de ${goal.target} ${goal.unit}', style: body(13, color: C.inkDim)),
                  ]),
                ),
              ]),
            ),
          ),
          if (reached)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(color: C.surfaceAlt, borderRadius: BorderRadius.circular(99)),
              child: Row(children: [
                const Icon(Icons.flag, size: 13, color: C.ink),
                const SizedBox(width: 4),
                Text('Chegou', style: body(12, weight: FontWeight.w600)),
              ]),
            )
          else
            Tooltip(
              message: 'Somar 1 (segure para outro valor)',
              child: Material(
                color: C.primarySoft,
                borderRadius: BorderRadius.circular(99),
                child: InkWell(
                  borderRadius: BorderRadius.circular(99),
                  onTap: () => store.put('goalLogs', newId(), {'goalId': goal.id, 'date': todayKey(), 'amount': 1}),
                  onLongPress: () => showLogSheet(context, store, goal),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    child: Text('+1', style: body(15, weight: FontWeight.w600, color: C.primary)),
                  ),
                ),
              ),
            ),
        ]),
        const SizedBox(height: 12),
        ProgressLine(value: progress.ratio, color: reached ? C.ink : C.primary),
      ]),
    );
  }
}
