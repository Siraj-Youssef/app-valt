// "Mapa": o mês como mapa de calor + histórico das semanas e hábitos mais constantes.
import 'dart:math';

import 'package:flutter/material.dart';

import '../../logic/dates.dart';
import '../../logic/model.dart';
import '../../theme.dart';
import '../scope.dart';
import '../widgets.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  String _selected = todayKey();

  @override
  Widget build(BuildContext context) {
    final store = AppScope.of(context).store;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final m = Model.of(store);
        final today = todayKey();
        final st = m.month(_month.year, _month.month, today);
        final lead = weekdayOf(st.keys.first);
        final cells = <String?>[...List.filled(lead, null), ...st.keys];
        while (cells.length % 7 != 0) {
          cells.add(null);
        }
        final byId = {for (final t in m.tasks) t.id: t};
        final selectedDone = (m.doneByDate[_selected] ?? const []).map((id) => byId[id]).whereType<Task>().toList();

        final goal = m.weekGoal;
        final weeks = List.generate(8, (i) => weekKeys(addDays(today, -7 * (7 - i))));
        final weekPts = [for (final w in weeks) w.fold(0, (a, k) => a + m.pointsOn(k))];
        final maxWeek = [goal, ...weekPts, 1].reduce(max);

        final counts = <String, int>{};
        for (final k in rangeKeys(addDays(today, -29), today)) {
          for (final id in m.doneByDate[k] ?? const <String>[]) {
            counts[id] = (counts[id] ?? 0) + 1;
          }
        }
        final steady = m.tasks.where((t) => (counts[t.id] ?? 0) > 0).toList()..sort((a, b) => counts[b.id]!.compareTo(counts[a.id]!));

        return ScreenScroll(children: [
          ScreenHeader(
            kicker: 'Mapa',
            title: months[_month.month - 1] + (_month.year != DateTime.now().year ? ' ${_month.year}' : ''),
            trailing: Row(children: [
              IconButton.filledTonal(
                  tooltip: 'Mês anterior',
                  style: IconButton.styleFrom(backgroundColor: C.surface),
                  onPressed: () => setState(() => _month = DateTime(_month.year, _month.month - 1)),
                  icon: const Icon(Icons.chevron_left, color: C.ink)),
              const SizedBox(width: 8),
              IconButton.filledTonal(
                  tooltip: 'Próximo mês',
                  style: IconButton.styleFrom(backgroundColor: C.surface),
                  onPressed: () => setState(() => _month = DateTime(_month.year, _month.month + 1)),
                  icon: const Icon(Icons.chevron_right, color: C.ink)),
            ]),
          ),
          Row(children: [
            MiniStat(value: '${st.points}', label: 'de ${st.goal} pts'),
            const SizedBox(width: 10),
            MiniStat(value: '${st.marks}', label: st.marks == 1 ? 'marco' : 'marcos', icon: Icons.flag),
            const SizedBox(width: 10),
            MiniStat(value: '${st.stepsDone}', label: 'passos'),
          ]),
          const SizedBox(height: 14),
          RCard(
            padding: const EdgeInsets.all(12),
            child: Column(children: [
              Row(children: [for (final l in weekdayLetter) Expanded(child: Text(l, textAlign: TextAlign.center, style: body(12, weight: FontWeight.w500, color: C.inkFaint)))]),
              const SizedBox(height: 6),
              GridView.count(
                crossAxisCount: 7,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  for (final k in cells)
                    if (k == null)
                      const SizedBox()
                    else
                      _DayCell(
                        dateKey: k,
                        today: today,
                        selected: k == _selected,
                        met: m.metOn(k),
                        ratio: m.goalOn(k) > 0 ? min(1.0, m.pointsOn(k) / m.goalOn(k)) : (m.pointsOn(k) > 0 ? 0.5 : 0.0),
                        onTap: () => setState(() => _selected = k),
                      ),
                ],
              ),
            ]),
          ),
          Section(
            title: 'Dia ${dayOfMonth(_selected)} · ${m.pointsOn(_selected)}/${m.goalOn(_selected)} pts',
            child: selectedDone.isEmpty
                ? Text('Nenhum passo registrado.', style: body(15, color: C.inkDim))
                : Column(children: [
                    for (final t in selectedDone)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(children: [
                          Text(t.icon, style: const TextStyle(fontSize: 18)),
                          const SizedBox(width: 10),
                          Expanded(child: Text(t.title, style: body(15, weight: FontWeight.w500))),
                          Text('${m.completionPoints[completionId(t.id, _selected)] ?? t.points} pts', style: body(15, weight: FontWeight.w600, color: C.primary)),
                        ]),
                      ),
                  ]),
          ),
          Section(
            title: 'Últimas 8 semanas',
            trailing: Text('linha = meta', style: body(12, color: C.inkFaint)),
            child: RCard(
              child: SizedBox(
                height: 140,
                child: Stack(children: [
                  if (goal > 0)
                    Positioned(left: 0, right: 0, bottom: 20 + goal / maxWeek * 100, child: Container(height: 1, color: C.inkDim.withValues(alpha: 0.6))),
                  Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    for (var i = 0; i < 8; i++)
                      Expanded(
                        child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                          Container(
                            width: 14,
                            height: max(3.0, weekPts[i] / maxWeek * 100),
                            decoration: BoxDecoration(
                              color: goal > 0 && weekPts[i] >= goal ? C.primary : C.primarySoft,
                              borderRadius: BorderRadius.circular(7),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text('${dayOfMonth(weeks[i].first)}/${weeks[i].first.substring(5, 7)}', style: body(10, color: C.inkFaint)),
                        ]),
                      ),
                  ]),
                ]),
              ),
            ),
          ),
          Section(
            title: 'Hábitos mais constantes (30 dias)',
            child: steady.isEmpty
                ? Text('Conclua alguns passos para ver quais hábitos você mais mantém.', style: body(15, color: C.inkDim))
                : Column(children: [
                    for (final t in steady.take(6))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          Row(children: [
                            Expanded(child: Text('${t.icon}  ${t.title}', style: body(15, weight: FontWeight.w500))),
                            Text('${counts[t.id]} de 30 dias', style: body(13, color: C.inkDim)),
                          ]),
                          const SizedBox(height: 6),
                          ProgressLine(value: counts[t.id]! / 30),
                        ]),
                      ),
                  ]),
          ),
        ]);
      },
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({required this.dateKey, required this.today, required this.selected, required this.met, required this.ratio, required this.onTap});
  final String dateKey, today;
  final bool selected, met;
  final double ratio;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final isToday = dateKey == today;
    final future = dateKey.compareTo(today) > 0;
    final color = ratio == 0 ? C.bg : (met ? C.primary : C.primary.withValues(alpha: 0.15 + ratio * 0.45));
    return Padding(
      padding: const EdgeInsets.all(3),
      child: Material(
        color: color,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: selected ? Border.all(color: C.ink, width: 2) : (isToday ? Border.all(color: C.primary, width: 1.5) : null),
            ),
            child: Stack(children: [
              Center(
                child: Text('${dayOfMonth(dateKey)}',
                    style: body(13, weight: isToday ? FontWeight.w600 : FontWeight.w500, color: met ? C.onPrimary : (future ? C.inkFaint : C.ink))),
              ),
              if (met) const Positioned(top: 3, right: 4, child: Icon(Icons.flag, size: 10, color: C.onPrimary)),
            ]),
          ),
        ),
      ),
    );
  }
}
