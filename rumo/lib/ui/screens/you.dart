import 'package:flutter/material.dart';

import '../../logic/dates.dart';
import '../../logic/model.dart';
import '../../theme.dart';
import '../scope.dart';
import '../widgets.dart';

class YouScreen extends StatefulWidget {
  const YouScreen({super.key});
  @override
  State<YouScreen> createState() => _YouScreenState();
}

class _YouScreenState extends State<YouScreen> {
  TextEditingController? _editing;

  @override
  void dispose() {
    _editing?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final store = scope.store;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final m = Model.of(store);
        final today = todayKey();
        final now = DateTime.now();
        final name = m.profileName ?? scope.session.user.name;
        final lv = m.level(today);
        final st = m.streaks(today);
        final month = m.month(now.year, now.month, today);
        final route = routeStatus(month.pace, month.hasGoal);
        final (fg, bg) = switch (route.tone) {
          'good' => (C.primary, C.primarySoft),
          'warn' => (C.ink, C.surfaceAlt),
          'bad' => (C.danger, C.primarySoft),
          _ => (C.inkDim, C.surfaceAlt),
        };

        void saveName() {
          final v = _editing?.text.trim() ?? '';
          if (v.isNotEmpty) store.put('settings', 'profile', {'name': v, 'startDate': m.startDate});
          setState(() {
            _editing?.dispose();
            _editing = null;
          });
        }

        void setDaily(int i, int v) {
          final daily = [...m.daily]..[i] = v;
          store.put('settings', 'goals', {'daily': daily});
        }

        return ScreenScroll(children: [
          ScreenHeader(kicker: 'Você', title: name),
          Transform.translate(
            offset: const Offset(0, -10),
            child: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 10, children: [
              Text(scope.session.user.email, style: body(13, color: C.inkDim)),
              InkWell(
                onTap: () => setState(() => _editing = TextEditingController(text: name)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.edit_outlined, size: 14, color: C.primary),
                  const SizedBox(width: 3),
                  Text('editar nome', style: body(13, weight: FontWeight.w500, color: C.primary)),
                ]),
              ),
            ]),
          ),
          if (_editing != null)
            TextField(controller: _editing, autofocus: true, maxLength: 40, style: body(16), onSubmitted: (_) => saveName(), onTapOutside: (_) => saveName()),
          const SizedBox(height: 6),
          RCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                const Icon(Icons.signpost, size: 18, color: C.primary),
                const SizedBox(width: 8),
                Expanded(child: Text('Etapa ${lv.level}', style: display(20))),
                Text('${lv.weekPoints}/${lv.weekGoal} pts na semana', style: body(13, color: C.inkDim)),
              ]),
              const SizedBox(height: 12),
              ProgressLine(value: lv.weekGoal > 0 ? lv.weekPoints / lv.weekGoal : 0),
              const SizedBox(height: 8),
              Text(
                lv.weekGoal == 0
                    ? 'Defina os pontos por dia abaixo para começar a avançar de etapa.'
                    : lv.missing > 0
                        ? 'Mais ${lv.missing} pts nesta semana e você avança para a etapa ${lv.level + 1}.'
                        : 'Semana completa: etapa conquistada.',
                style: body(13, color: C.inkDim),
              ),
            ]),
          ),
          const SizedBox(height: 12),
          RCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text('Rota de ${months[now.month - 1].toLowerCase()}', style: body(13, weight: FontWeight.w500, color: C.inkDim))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
                  child: Text(route.label, style: body(12, weight: FontWeight.w600, color: fg)),
                ),
              ]),
              const SizedBox(height: 8),
              Text(route.body, style: body(14)),
              if (month.hasGoal) ...[
                const SizedBox(height: 12),
                Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                  Text('${month.projection}', style: display(30, weight: FontWeight.w700, color: fg)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text('pts previstos · meta ${month.goal} · passo em ${(month.pace * 100).round()}%', style: body(13, color: C.inkDim)),
                  ),
                ]),
              ],
            ]),
          ),
          const SizedBox(height: 12),
          Row(children: [
            MiniStat(value: '${month.points}', label: 'pts no mês'),
            const SizedBox(width: 10),
            MiniStat(value: '${month.marks}', label: 'marcos'),
            const SizedBox(width: 10),
            MiniStat(value: '${st.current}', label: 'dias seguidos', sub: 'recorde: ${st.best}'),
          ]),
          Section(
            title: 'Pontos por dia',
            trailing: Text('semana: ${m.weekGoal} pts', style: body(12, color: C.inkDim)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              RCard(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Column(children: [
                  for (var i = 0; i < 7; i++)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(border: i < 6 ? const Border(bottom: BorderSide(color: C.line)) : null),
                      child: Row(children: [
                        Expanded(child: Text(weekdayLong[i], style: body(15, weight: FontWeight.w500))),
                        Nudge(value: m.daily[i], onChanged: (v) => setDaily(i, v)),
                      ]),
                    ),
                ]),
              ),
              const SizedBox(height: 8),
              Text('A meta da semana e do mês é a soma dos dias. Dia com 0 é dia livre e não quebra a sequência.', style: body(12, color: C.inkFaint)),
            ]),
          ),
          Section(
            title: 'Conta',
            child: RCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Servidor de sincronização', style: body(12, color: C.inkDim)),
                const SizedBox(height: 2),
                Text(scope.session.serverUrl, style: body(13)),
                const SizedBox(height: 6),
                TextAction(
                  label: 'Sair da conta',
                  icon: Icons.logout,
                  color: C.danger,
                  onPressed: () async {
                    final ok = await confirmDialog(context,
                        title: 'Sair', message: 'Sair desta conta neste aparelho? Alterações ainda não enviadas serão perdidas.', action: 'Sair');
                    if (ok) scope.logout();
                  },
                ),
              ]),
            ),
          ),
        ]);
      },
    );
  }
}
