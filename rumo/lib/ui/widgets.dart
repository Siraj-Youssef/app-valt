import 'package:flutter/material.dart';

import '../data/sync.dart';
import '../logic/dates.dart';
import '../logic/model.dart';
import '../theme.dart';

class RCard extends StatelessWidget {
  const RCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.margin});
  final Widget child;
  final EdgeInsets padding;
  final EdgeInsets? margin;
  @override
  Widget build(BuildContext context) => Container(
        margin: margin,
        padding: padding,
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.line)),
        child: child,
      );
}

class Section extends StatelessWidget {
  const Section({super.key, required this.title, required this.child, this.trailing});
  final String title;
  final Widget child;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 26),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(title.toUpperCase(), style: body(12, weight: FontWeight.w600, color: C.inkDim, spacing: 1.4))),
            ?trailing,
          ]),
          const SizedBox(height: 10),
          child,
        ]),
      );
}

class Label extends StatelessWidget {
  const Label(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) =>
      Padding(padding: const EdgeInsets.only(top: 18, bottom: 8), child: Text(text, style: body(13, weight: FontWeight.w500, color: C.inkDim)));
}

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, required this.onPressed, this.icon});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 52,
        child: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: C.primary,
            disabledBackgroundColor: C.primary.withValues(alpha: 0.35),
            foregroundColor: C.onPrimary,
            disabledForegroundColor: C.onPrimary.withValues(alpha: 0.5),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          onPressed: onPressed,
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 8)],
            Text(label, style: body(15, weight: FontWeight.w600, color: C.onPrimary)),
          ]),
        ),
      );
}

class TextAction extends StatelessWidget {
  const TextAction({super.key, required this.label, required this.onPressed, this.color = C.inkDim, this.icon});
  final String label;
  final VoidCallback? onPressed;
  final Color color;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 48,
        child: TextButton(
          onPressed: onPressed,
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[Icon(icon, size: 18, color: color), const SizedBox(width: 6)],
            Text(label, style: body(15, weight: FontWeight.w600, color: onPressed == null ? C.inkFaint : color)),
          ]),
        ),
      );
}

// Escolha de valor por pílulas: selecionado em branco (o vermelho fica para progresso e ação principal).
class ChoicePills<T> extends StatelessWidget {
  const ChoicePills({super.key, required this.value, required this.options, required this.onChanged, required this.label});
  final T value;
  final List<T> options;
  final ValueChanged<T> onChanged;
  final String Function(T) label;
  @override
  Widget build(BuildContext context) => Wrap(spacing: 8, runSpacing: 8, children: [
        for (final o in options)
          InkWell(
            borderRadius: BorderRadius.circular(99),
            onTap: () => onChanged(o),
            child: Container(
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: o == value ? C.ink : C.surface,
                borderRadius: BorderRadius.circular(99),
                border: Border.all(color: o == value ? C.ink : C.line),
              ),
              // widthFactor: 1 mantém a pílula do tamanho do texto (sem esticar na linha).
              child: Center(
                widthFactor: 1,
                child: Text(label(o), style: body(14, weight: o == value ? FontWeight.w600 : FontWeight.w500, color: o == value ? C.bg : C.inkDim)),
              ),
            ),
          ),
      ]);
}

// Ajuste numérico discreto (metas diárias, alvo das metas).
class Nudge extends StatelessWidget {
  const Nudge({super.key, required this.value, required this.onChanged, this.step = 5, this.min = 0, this.max = 99999});
  final int value, step, min, max;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) {
    Widget btn(IconData icon, Color color, int next, String tip) => Tooltip(
          message: tip,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: () => onChanged(next.clamp(min, max)),
            child: Container(width: 34, height: 34, decoration: const BoxDecoration(color: C.surface, shape: BoxShape.circle), child: Icon(icon, size: 18, color: color)),
          ),
        );
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: C.surfaceAlt, borderRadius: BorderRadius.circular(99)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        btn(Icons.remove, C.inkDim, value - step, 'Diminuir'),
        SizedBox(width: 56, child: Text('$value', textAlign: TextAlign.center, style: body(15, weight: FontWeight.w600))),
        btn(Icons.add, C.primary, value + step, 'Aumentar'),
      ]),
    );
  }
}

// Abas sublinhadas (Hábito / Só um dia, Criar conta / Já tenho conta, Semana / Mês / Ano).
class UnderlineTabs<T> extends StatelessWidget {
  const UnderlineTabs({super.key, required this.value, required this.options, required this.onChanged});
  final T value;
  final List<(T, String, IconData?)> options;
  final ValueChanged<T> onChanged;
  @override
  Widget build(BuildContext context) => Container(
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.line))),
        child: Row(children: [
          for (final (v, label, icon) in options)
            Expanded(
              child: InkWell(
                onTap: () => onChanged(v),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(border: Border(bottom: BorderSide(color: v == value ? C.primary : Colors.transparent, width: 2))),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    if (icon != null) ...[Icon(icon, size: 16, color: v == value ? C.primary : C.inkFaint), const SizedBox(width: 6)],
                    Text(label, style: body(14, weight: v == value ? FontWeight.w600 : FontWeight.w500, color: v == value ? C.ink : C.inkDim)),
                  ]),
                ),
              ),
            ),
        ]),
      );
}

class ProgressLine extends StatelessWidget {
  const ProgressLine({super.key, required this.value, this.color = C.primary, this.height = 8});
  final double value;
  final Color color;
  final double height;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(height),
        child: LinearProgressIndicator(value: value.clamp(0, 1), minHeight: height, color: color, backgroundColor: C.surfaceAlt),
      );
}

// Ponto + texto curto: monocromático quando tudo bem; vermelho só quando há alteração esperando o servidor.
class SyncDot extends StatelessWidget {
  const SyncDot({super.key, required this.status, required this.pending});
  final SyncStatus status;
  final int pending;
  @override
  Widget build(BuildContext context) {
    var color = C.ink;
    var label = 'em dia';
    if (status == SyncStatus.connecting || status == SyncStatus.syncing) {
      color = C.inkDim;
      label = 'sincronizando';
    } else if (status == SyncStatus.offline) {
      color = pending > 0 ? C.primary : C.inkFaint;
      label = pending > 0 ? '$pending pendente${pending > 1 ? 's' : ''}' : 'offline';
    }
    return Semantics(
      label: 'Sincronização: $label',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(99), border: Border.all(color: C.line)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(label, style: body(12, weight: FontWeight.w500, color: C.inkDim)),
        ]),
      ),
    );
  }
}

// Barra da trilha do dia: um trecho por tarefa, proporcional aos pontos; preenche quando concluída.
class TrailBar extends StatelessWidget {
  const TrailBar({super.key, required this.parts});
  final List<({int points, bool done})> parts;
  @override
  Widget build(BuildContext context) {
    if (parts.isEmpty) return Container(height: 10, decoration: BoxDecoration(color: C.surfaceAlt, borderRadius: BorderRadius.circular(5)));
    return Row(children: [
      for (var i = 0; i < parts.length; i++) ...[
        if (i > 0) const SizedBox(width: 4),
        Expanded(
          flex: parts[i].points.clamp(1, 1000),
          child: Container(height: 10, decoration: BoxDecoration(color: parts[i].done ? C.primary : C.surfaceAlt, borderRadius: BorderRadius.circular(5))),
        ),
      ],
    ]);
  }
}

// Semana em 7 círculos: enchem conforme a meta; bandeira = marco (meta batida).
class WeekDots extends StatelessWidget {
  const WeekDots({super.key, required this.days, required this.today, required this.onTap});
  final List<({String key, double ratio, bool met})> days;
  final String today;
  final ValueChanged<String> onTap;
  @override
  Widget build(BuildContext context) => Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        for (var i = 0; i < days.length; i++)
          InkWell(
            customBorder: const CircleBorder(),
            onTap: () => onTap(days[i].key),
            child: Column(children: [
              Text(weekdayLetter[i],
                  style: body(12, weight: days[i].key == today ? FontWeight.w600 : FontWeight.w500, color: days[i].key == today ? C.primary : C.inkFaint)),
              const SizedBox(height: 6),
              Container(
                width: 38,
                height: 38,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: C.surface,
                  shape: BoxShape.circle,
                  border: Border.all(color: days[i].key == today ? C.primary : C.line, width: days[i].key == today ? 2 : 1),
                ),
                child: Stack(alignment: Alignment.center, children: [
                  Align(
                    alignment: Alignment.bottomCenter,
                    child: FractionallySizedBox(heightFactor: days[i].ratio.clamp(0, 1), widthFactor: 1, child: ColoredBox(color: days[i].met ? C.primary : C.primarySoft)),
                  ),
                  if (days[i].met) const Icon(Icons.flag, size: 16, color: C.onPrimary),
                ]),
              ),
            ]),
          ),
      ]);
}

class DayNav extends StatelessWidget {
  const DayNav({super.key, required this.date, required this.onChanged});
  final String date;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) {
    final today = todayKey();
    final d = fromKey(date);
    final label = date == today
        ? 'Hoje'
        : date == addDays(today, -1)
            ? 'Ontem'
            : date == addDays(today, 1)
                ? 'Amanhã'
                : '${weekdayLong[weekdayOf(date)].split('-').first}, ${d.day} ${months[d.month - 1].substring(0, 3).toLowerCase()}';
    return Container(
      decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(99), border: Border.all(color: C.line)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        IconButton(visualDensity: VisualDensity.compact, tooltip: 'Dia anterior', onPressed: () => onChanged(addDays(date, -1)), icon: const Icon(Icons.chevron_left, size: 20, color: C.inkDim)),
        InkWell(onTap: () => onChanged(today), child: Text(label, style: body(13, weight: FontWeight.w600))),
        IconButton(visualDensity: VisualDensity.compact, tooltip: 'Próximo dia', onPressed: () => onChanged(addDays(date, 1)), icon: const Icon(Icons.chevron_right, size: 20, color: C.inkDim)),
      ]),
    );
  }
}

class TaskRow extends StatelessWidget {
  const TaskRow({super.key, required this.task, required this.done, required this.locked, required this.onToggle, required this.onEdit});
  final Task task;
  final bool done, locked;
  final VoidCallback onToggle, onEdit;
  @override
  Widget build(BuildContext context) {
    final sub = [task.repeat == 'weekly' ? 'hábito' : 'só neste dia', task.time, task.durationMin != null ? '${task.durationMin} min' : null].whereType<String>().join(' · ');
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.line))),
      child: Row(children: [
        Semantics(
          checked: done,
          label: task.title,
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: locked ? null : onToggle,
            child: Opacity(
              opacity: locked ? 0.35 : 1,
              child: Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: done ? C.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: done ? C.primary : C.inkFaint, width: 2),
                ),
                child: done ? const Icon(Icons.check, size: 16, color: C.onPrimary) : null,
              ),
            ),
          ),
        ),
        Expanded(
          child: InkWell(
            onTap: onEdit,
            child: Row(children: [
              Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text(task.icon, style: const TextStyle(fontSize: 20))),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(task.title,
                      style: body(16, weight: FontWeight.w500, color: done ? C.inkFaint : C.ink, deco: done ? TextDecoration.lineThrough : null)),
                  Text(sub, style: body(12, color: C.inkFaint)),
                ]),
              ),
              Container(
                margin: const EdgeInsets.only(left: 8),
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(color: done ? C.primarySoft : C.surfaceAlt, borderRadius: BorderRadius.circular(99)),
                child: Text('${task.points} pts', style: body(12, weight: FontWeight.w600, color: done ? C.primary : C.inkDim)),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

class InlineStat extends StatelessWidget {
  const InlineStat({super.key, required this.icon, required this.value, required this.label, this.tint = C.ink});
  final IconData icon;
  final String value, label;
  final Color tint;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(children: [
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 16, color: tint),
            const SizedBox(width: 5),
            Text(value, style: display(20)),
          ]),
          const SizedBox(height: 2),
          Text(label, style: body(12, color: C.inkDim), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      );
}

class MiniStat extends StatelessWidget {
  const MiniStat({super.key, required this.value, required this.label, this.sub, this.icon});
  final String value, label;
  final String? sub;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Expanded(
        child: RCard(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              if (icon != null) ...[Icon(icon, size: 14, color: C.ink), const SizedBox(width: 4)],
              Text(value, style: display(24)),
            ]),
            Text(label, style: body(12, color: C.inkDim), maxLines: 1, overflow: TextOverflow.ellipsis),
            if (sub != null) Text(sub!, style: body(11, color: C.inkFaint), maxLines: 1),
          ]),
        ),
      );
}

// Cabeçalho padrão das telas: "kicker" pequeno + título grande e ação à direita.
class ScreenHeader extends StatelessWidget {
  const ScreenHeader({super.key, required this.kicker, required this.title, this.trailing});
  final String kicker, title;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(kicker, style: body(13, weight: FontWeight.w500, color: C.inkDim)),
              Text(title, style: display(32)),
            ]),
          ),
          ?trailing,
        ]),
      );
}

Future<bool> confirmDialog(BuildContext context, {required String title, required String message, required String action}) async =>
    await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: C.surface,
        title: Text(title, style: display(20)),
        content: Text(message, style: body(14, color: C.inkDim)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Cancelar', style: body(14, color: C.inkDim))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(action, style: body(14, weight: FontWeight.w600, color: C.danger))),
        ],
      ),
    ) ??
    false;

// Conteúdo rolável centralizado: no celular ocupa a tela; no computador fica numa coluna confortável.
class ScreenScroll extends StatelessWidget {
  const ScreenScroll({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => SafeArea(
        bottom: false,
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 620),
            child: ListView(padding: const EdgeInsets.fromLTRB(20, 14, 20, 120), children: children),
          ),
        ),
      );
}
