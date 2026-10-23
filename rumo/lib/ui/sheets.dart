// Painéis inferiores: "Novo passo" (hábito ou passo de um dia), "Nova meta" e "Registrar avanço".
import 'package:flutter/material.dart';

import '../data/store.dart';
import '../logic/dates.dart';
import '../logic/model.dart';
import '../theme.dart';
import 'widgets.dart';

Future<void> _openSheet(BuildContext context, String title, Widget Function(BuildContext) builder) => showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: C.surface,
      barrierColor: Colors.black.withValues(alpha: 0.72),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      constraints: const BoxConstraints(maxWidth: 620),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.92),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Row(children: [
                Expanded(child: Text(title, style: display(24))),
                IconButton.filledTonal(
                  tooltip: 'Fechar',
                  style: IconButton.styleFrom(backgroundColor: C.surfaceAlt),
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close, color: C.ink),
                ),
              ]),
              const SizedBox(height: 16),
              builder(ctx),
            ]),
          ),
        ),
      ),
    );

Widget _emojiRow(List<String> icons, String selected, ValueChanged<String> onPick) => SizedBox(
      height: 46,
      child: ListView(scrollDirection: Axis.horizontal, children: [
        for (final i in icons)
          Padding(
            padding: const EdgeInsets.only(right: 6, top: 3, bottom: 3),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => onPick(i),
              child: Container(
                width: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: i == selected ? C.primarySoft : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: i == selected ? C.primary : Colors.transparent),
                ),
                child: Text(i, style: const TextStyle(fontSize: 20)),
              ),
            ),
          ),
      ]),
    );

const _ideas = [('Caminhar', '🥾'), ('Estudar', '📝'), ('Ler', '📚'), ('Alongar', '🤸'), ('Treinar', '💪'), ('Escrever', '✍️')];
const _taskIcons = ['🌱', '🥾', '📝', '📚', '🤸', '💪', '✍️', '🧘', '💧', '🍎', '💻', '🎧', '🛏️', '🧹', '💰', '🎨'];
const _points = [5, 10, 15, 20, 30, 50];

Future<void> showTaskSheet(BuildContext context, Store store, {required String mode, String? date, Task? editing}) =>
    _openSheet(context, editing != null ? 'Editar passo' : 'Novo passo', (ctx) => _TaskForm(store: store, mode: mode, date: date, editing: editing));

class _TaskForm extends StatefulWidget {
  const _TaskForm({required this.store, required this.mode, this.date, this.editing});
  final Store store;
  final String mode;
  final String? date;
  final Task? editing;
  @override
  State<_TaskForm> createState() => _TaskFormState();
}

class _TaskFormState extends State<_TaskForm> {
  late final _title = TextEditingController(text: widget.editing?.title ?? '');
  late final _time = TextEditingController(text: widget.editing?.time ?? '');
  late final _minutes = TextEditingController(text: widget.editing?.durationMin?.toString() ?? '');
  late String _icon = widget.editing?.icon ?? '🌱';
  late int _pts = widget.editing?.points ?? 10;
  late String _repeat = widget.editing?.repeat ?? widget.mode;
  late List<int> _days = [...?widget.editing?.weekdays];
  int _saved = 0;

  @override
  void initState() {
    super.initState();
    if (_days.isEmpty) _days = [0, 1, 2, 3, 4, 5, 6];
    _title.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _title.dispose();
    _time.dispose();
    _minutes.dispose();
    super.dispose();
  }

  String get _onceDate => widget.editing?.date ?? widget.date ?? todayKey();
  bool get _valid => _title.text.trim().isNotEmpty && (_repeat == 'once' || _days.isNotEmpty);

  void _save({required bool another}) {
    if (!_valid) return;
    final time = RegExp(r'^\d{1,2}:\d{2}$').hasMatch(_time.text.trim()) ? _time.text.trim().padLeft(5, '0') : null;
    final minutes = int.tryParse(_minutes.text.trim());
    final task = Task(
      id: widget.editing?.id ?? newId(),
      title: _title.text.trim(),
      icon: _icon,
      points: _pts,
      repeat: _repeat,
      weekdays: _repeat == 'weekly' ? ([..._days]..sort()) : const [],
      startDate: widget.editing?.startDate ?? todayKey(),
      date: _repeat == 'once' ? _onceDate : null,
      time: time,
      durationMin: minutes != null && minutes > 0 ? minutes : null,
    );
    widget.store.put('tasks', task.id, task.toJson());
    if (!another) {
      Navigator.pop(context);
      return;
    }
    setState(() {
      _saved++;
      _title.clear();
      _icon = '🌱';
    });
  }

  Future<void> _delete() async {
    final t = widget.editing!;
    final ok = await confirmDialog(context, title: 'Excluir passo', message: 'Excluir "${t.title}"? Os pontos já feitos continuam no histórico.', action: 'Excluir');
    if (!ok || !mounted) return;
    widget.store.remove('tasks', t.id);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      UnderlineTabs<String>(
        value: _repeat,
        onChanged: (v) => setState(() => _repeat = v),
        options: [('weekly', 'Hábito', Icons.repeat), ('once', 'Só dia ${dayOfMonth(_onceDate)}', Icons.today_outlined)],
      ),
      const Label('O que você vai fazer?'),
      Row(children: [
        Container(
          width: 50,
          height: 50,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.line)),
          child: Text(_icon, style: const TextStyle(fontSize: 24)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: TextField(controller: _title, maxLength: 60, style: body(16), decoration: const InputDecoration(hintText: 'Ex.: Caminhar 20 minutos', counterText: '')),
        ),
      ]),
      if (widget.editing == null)
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Wrap(spacing: 10, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
            Text('Ideias:', style: body(13, color: C.inkFaint)),
            for (final (name, icon) in _ideas)
              InkWell(
                onTap: () => setState(() {
                  _title.text = name;
                  _icon = icon;
                }),
                child: Text(name, style: body(13, weight: FontWeight.w500, deco: TextDecoration.underline)),
              ),
          ]),
        ),
      const SizedBox(height: 10),
      _emojiRow(_taskIcons, _icon, (i) => setState(() => _icon = i)),
      const Label('Quanto vale'),
      ChoicePills<int>(value: _pts, options: _points, onChanged: (v) => setState(() => _pts = v), label: (p) => '$p pts'),
      if (_repeat == 'weekly') ...[
        const Label('Em quais dias'),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          for (var d = 0; d < 7; d++)
            InkWell(
              customBorder: const CircleBorder(),
              onTap: () => setState(() => _days.contains(d) ? _days.remove(d) : _days.add(d)),
              child: Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: _days.contains(d) ? C.ink : C.bg,
                  shape: BoxShape.circle,
                  border: Border.all(color: _days.contains(d) ? C.ink : C.line),
                ),
                child: Text(weekdayLetter[d], style: body(14, weight: FontWeight.w600, color: _days.contains(d) ? C.bg : C.inkDim)),
              ),
            ),
        ]),
        const SizedBox(height: 10),
        Wrap(spacing: 16, children: [
          for (final (label, days) in [('Todo dia', [0, 1, 2, 3, 4, 5, 6]), ('Dias úteis', [0, 1, 2, 3, 4]), ('Fins de semana', [5, 6])])
            InkWell(
              onTap: () => setState(() => _days = [...days]),
              child: Text(label, style: body(13, weight: FontWeight.w500, color: C.inkDim, deco: TextDecoration.underline)),
            ),
        ]),
      ],
      Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Label('Horário (opcional)'),
            TextField(controller: _time, maxLength: 5, keyboardType: TextInputType.datetime, style: body(16), decoration: const InputDecoration(hintText: '07:30', counterText: '')),
          ]),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Label('Minutos (opcional)'),
            TextField(controller: _minutes, maxLength: 4, keyboardType: TextInputType.number, style: body(16), decoration: const InputDecoration(hintText: '20', counterText: '')),
          ]),
        ),
      ]),
      Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text('O horário organiza o plano em manhã, tarde e noite. Não altera os pontos.', style: body(12, color: C.inkFaint)),
      ),
      if (_saved > 0)
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Text('✓ $_saved ${_saved == 1 ? 'passo salvo' : 'passos salvos'}. Pode adicionar o próximo.', style: body(13, weight: FontWeight.w500, color: C.primary)),
        ),
      const SizedBox(height: 20),
      PrimaryButton(label: widget.editing != null ? 'Salvar alterações' : 'Salvar', onPressed: _valid ? () => _save(another: false) : null),
      if (widget.editing != null)
        TextAction(label: 'Excluir passo', icon: Icons.delete_outline, color: C.danger, onPressed: _delete)
      else
        TextAction(label: 'Salvar e adicionar outro', color: C.ink, onPressed: _valid ? () => _save(another: true) : null),
    ]);
  }
}

const periodLabel = {'week': 'Semana', 'month': 'Mês', 'year': 'Ano'};
const _goalIcons = ['🏔️', '📚', '🏃', '💰', '💪', '✍️', '🎨', '🧠', '🌱', '🏆'];

Future<void> showGoalSheet(BuildContext context, Store store, {Goal? editing}) =>
    _openSheet(context, editing != null ? 'Editar meta' : 'Nova meta', (ctx) => _GoalForm(store: store, editing: editing));

class _GoalForm extends StatefulWidget {
  const _GoalForm({required this.store, this.editing});
  final Store store;
  final Goal? editing;
  @override
  State<_GoalForm> createState() => _GoalFormState();
}

class _GoalFormState extends State<_GoalForm> {
  late final _title = TextEditingController(text: widget.editing?.title ?? '');
  late final _unit = TextEditingController(text: widget.editing?.unit ?? '');
  late String _icon = widget.editing?.icon ?? '🏔️';
  late String _period = widget.editing?.period ?? 'month';
  late int _target = widget.editing?.target ?? 10;

  @override
  void initState() {
    super.initState();
    _title.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _title.dispose();
    _unit.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        UnderlineTabs<String>(
          value: _period,
          onChanged: (v) => setState(() => _period = v),
          options: [for (final p in ['week', 'month', 'year']) (p, periodLabel[p]!, null)],
        ),
        const Label('Aonde quer chegar?'),
        TextField(controller: _title, maxLength: 60, style: body(16), decoration: const InputDecoration(hintText: 'Ex.: Ler 4 livros', counterText: '')),
        const SizedBox(height: 10),
        _emojiRow(_goalIcons, _icon, (i) => setState(() => _icon = i)),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Label('Quanto'),
            Nudge(value: _target, step: 1, min: 1, onChanged: (v) => setState(() => _target = v)),
          ]),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Label('Unidade'),
              TextField(controller: _unit, maxLength: 16, style: body(16), decoration: const InputDecoration(hintText: 'livros, km, R\$…', counterText: '')),
            ]),
          ),
        ]),
        const SizedBox(height: 22),
        PrimaryButton(
          label: 'Salvar meta',
          onPressed: _title.text.trim().isEmpty
              ? null
              : () {
                  final g = Goal(
                      id: widget.editing?.id ?? newId(),
                      title: _title.text.trim(),
                      icon: _icon,
                      period: _period,
                      target: _target,
                      unit: _unit.text.trim().isEmpty ? 'vezes' : _unit.text.trim());
                  widget.store.put('goals', g.id, g.toJson());
                  Navigator.pop(context);
                },
        ),
        if (widget.editing != null)
          TextAction(
            label: 'Excluir meta',
            icon: Icons.delete_outline,
            color: C.danger,
            onPressed: () async {
              final ok = await confirmDialog(context, title: 'Excluir meta', message: 'Excluir "${widget.editing!.title}"?', action: 'Excluir');
              if (!ok || !context.mounted) return;
              widget.store.remove('goals', widget.editing!.id);
              Navigator.pop(context);
            },
          ),
      ]);
}

Future<void> showLogSheet(BuildContext context, Store store, Goal goal) => _openSheet(context, 'Registrar avanço', (ctx) => _LogForm(store: store, goal: goal));

class _LogForm extends StatefulWidget {
  const _LogForm({required this.store, required this.goal});
  final Store store;
  final Goal goal;
  @override
  State<_LogForm> createState() => _LogFormState();
}

class _LogFormState extends State<_LogForm> {
  int _amount = 1;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Text(widget.goal.icon, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 10),
          Expanded(child: Text(widget.goal.title, style: body(17, weight: FontWeight.w500))),
        ]),
        Label('Quanto você avançou (${widget.goal.unit})?'),
        Align(alignment: Alignment.centerLeft, child: Nudge(value: _amount, step: 1, min: 1, onChanged: (v) => setState(() => _amount = v))),
        const SizedBox(height: 22),
        PrimaryButton(
          label: 'Registrar',
          onPressed: () {
            widget.store.put('goalLogs', newId(), {'goalId': widget.goal.id, 'date': todayKey(), 'amount': _amount});
            Navigator.pop(context);
          },
        ),
      ]);
}
