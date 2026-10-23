import 'package:flutter/material.dart';

import '../../data/store.dart';
import '../../logic/dates.dart';
import '../../logic/model.dart';
import '../../theme.dart';
import '../scope.dart';
import '../sheets.dart';
import '../widgets.dart';

class TodayScreen extends StatefulWidget {
  const TodayScreen({super.key, required this.goTo});
  final ValueChanged<int> goTo;
  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  String _day = todayKey();

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final store = scope.store;
    return ListenableBuilder(
      listenable: Listenable.merge([store, scope.sync.status]),
      builder: (context, _) {
        final m = Model.of(store);
        final today = todayKey();
        final now = DateTime.now();
        final name = (m.profileName ?? scope.session.user.name).split(' ').first;
        final dayTasks = m.tasksFor(_day);
        final done = dayTasks.where((t) => m.isDone(t.id, _day)).length;
        final dayGoal = m.goalOn(_day);
        final lv = m.level(today);
        final tip = m.compassTip(today);
        final weekPts = weekKeys(today).fold(0, (a, k) => a + m.pointsOn(k));

        void toggle(Task t) => store.put('completions', completionId(t.id, _day),
            {'taskId': t.id, 'date': _day, 'done': !m.isDone(t.id, _day), 'points': t.points});

        return ScreenScroll(children: [
          Row(children: [
            Text.rich(TextSpan(children: [
              TextSpan(text: 'rumo', style: display(24, weight: FontWeight.w700, spacing: -0.5)),
              TextSpan(text: '.', style: display(24, weight: FontWeight.w700, color: C.primary)),
            ])),
            const Spacer(),
            SyncDot(status: scope.sync.status.value, pending: store.outbox.length),
            const SizedBox(width: 10),
            Tooltip(
              message: 'Abrir perfil',
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => widget.goTo(3),
                child: Container(
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(10)),
                  child: Text(name.isEmpty ? '?' : name[0].toUpperCase(), style: body(15, weight: FontWeight.w600, color: C.onPrimary)),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 26),
          Text('Olá, $name.', style: body(15, weight: FontWeight.w500, color: C.inkDim)),
          const SizedBox(height: 2),
          Text('${weekdayLong[weekdayOf(today)].split('-').first}, ${now.day} de ${months[now.month - 1].toLowerCase()}', style: display(30)),
          const SizedBox(height: 18),
          RCard(
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_day == today ? 'Caminhado hoje' : 'Caminhado no dia', style: body(13, weight: FontWeight.w500, color: C.inkDim)),
                    Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                      Text('${m.pointsOn(_day)}', style: display(44, weight: FontWeight.w700)),
                      const SizedBox(width: 6),
                      Text(dayGoal > 0 ? 'de $dayGoal pts' : 'pts · sem meta', style: body(15, weight: FontWeight.w500, color: C.inkDim)),
                    ]),
                  ]),
                ),
                if (m.metOn(_day))
                  Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(99)),
                    child: Row(children: [
                      const Icon(Icons.flag, size: 13, color: C.onPrimary),
                      const SizedBox(width: 5),
                      Text('Marco', style: body(12, weight: FontWeight.w600, color: C.onPrimary)),
                    ]),
                  ),
              ]),
              const SizedBox(height: 12),
              TrailBar(parts: [for (final t in dayTasks) (points: t.points, done: m.isDone(t.id, _day))]),
              const SizedBox(height: 18),
              const Divider(height: 1),
              const SizedBox(height: 14),
              Row(children: [
                InlineStat(icon: Icons.local_fire_department, tint: C.primary, value: '${m.streaks(today).current}', label: 'dias seguidos'),
                Container(width: 1, height: 30, color: C.line),
                InlineStat(icon: Icons.signpost_outlined, tint: C.inkDim, value: '${lv.level}', label: 'etapa'),
                Container(width: 1, height: 30, color: C.line),
                InlineStat(icon: Icons.calendar_today, tint: C.inkDim, value: '$weekPts', label: 'de ${m.weekGoal}/semana'),
              ]),
            ]),
          ),
          const SizedBox(height: 14),
          Material(
            color: C.surface,
            borderRadius: BorderRadius.circular(12),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: tip.action == null
                  ? null
                  : () => tip.action == 'new' ? showTaskSheet(context, store, mode: 'weekly') : widget.goTo(3),
              child: Container(
                decoration: const BoxDecoration(border: Border(left: BorderSide(color: C.primary, width: 3))),
                padding: const EdgeInsets.fromLTRB(16, 14, 14, 14),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('BÚSSOLA', style: body(11, weight: FontWeight.w600, color: C.primary, spacing: 1.5)),
                      const SizedBox(height: 4),
                      Text(tip.text, style: body(14)),
                    ]),
                  ),
                  if (tip.action != null) const Icon(Icons.arrow_forward, size: 18, color: C.primary),
                ]),
              ),
            ),
          ),
          Section(
            title: 'Esta semana',
            child: WeekDots(
              today: today,
              onTap: (k) => setState(() => _day = k),
              days: [
                for (final k in weekKeys(today)) (key: k, ratio: m.goalOn(k) > 0 ? m.pointsOn(k) / m.goalOn(k) : 0.0, met: m.metOn(k)),
              ],
            ),
          ),
          Section(
            title: 'Plano · $done/${dayTasks.length}',
            trailing: DayNav(date: _day, onChanged: (d) => setState(() => _day = d)),
            child: dayTasks.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 30),
                    child: Column(children: [
                      const Icon(Icons.map_outlined, size: 30, color: C.inkFaint),
                      const SizedBox(height: 8),
                      Text('Nada planejado para este dia', style: body(15, weight: FontWeight.w500)),
                      TextAction(
                        label: 'Adicionar passo',
                        color: C.primary,
                        onPressed: () => showTaskSheet(context, store, mode: _day == today ? 'weekly' : 'once', date: _day),
                      ),
                    ]),
                  )
                : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    for (final period in ['Manhã', 'Tarde', 'Noite', 'Qualquer hora'])
                      if (dayTasks.any((t) => periodOf(t.time) == period)) ...[
                        Padding(padding: const EdgeInsets.only(top: 8), child: Text(period, style: body(12, weight: FontWeight.w500, color: C.inkFaint))),
                        for (final t in dayTasks.where((t) => periodOf(t.time) == period))
                          TaskRow(
                            task: t,
                            done: m.isDone(t.id, _day),
                            locked: _day.compareTo(today) > 0,
                            onToggle: () => toggle(t),
                            onEdit: () => showTaskSheet(context, store, mode: t.repeat, editing: t),
                          ),
                      ],
                  ]),
          ),
        ]);
      },
    );
  }
}

// Usado pelo botão "+" da barra: abre o formulário de novo hábito.
void openNewStep(BuildContext context, Store store) => showTaskSheet(context, store, mode: 'weekly');
