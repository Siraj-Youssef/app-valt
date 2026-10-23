import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Task } from '../data/types';
import { WEEKDAY_LETTER, addDays, fromKey, todayKey, MONTHS, WEEKDAY_LONG, weekdayOf } from '../lib/dates';
import { colors, radius } from '../theme';
import { T } from './ui';

// Barra da trilha do dia: um trecho por tarefa, proporcional aos pontos; preenche quando concluída.
export function TrailBar({ parts }: { parts: { id: string; points: number; done: boolean }[] }) {
  if (parts.length === 0) return <View style={[st.trail, { backgroundColor: colors.surfaceAlt }]} />;
  return (
    <View style={[st.row, { gap: 4 }]}>
      {parts.map((p) => (
        <View key={p.id} style={[st.trail, { flex: p.points, backgroundColor: p.done ? colors.primary : colors.surfaceAlt }]} />
      ))}
    </View>
  );
}

// Semana em 7 círculos: preenchimento proporcional ao quanto da meta foi feito; bandeira = marco (meta batida).
export function WeekDots({ days, today, onPress }: {
  days: { key: string; ratio: number; met: boolean }[]; today: string; onPress?: (k: string) => void;
}) {
  return (
    <View style={[st.row, { justifyContent: 'space-between' }]}>
      {days.map((d, i) => {
        const size = 38;
        const fill = Math.max(0, Math.min(1, d.ratio));
        return (
          <Pressable key={d.key} onPress={() => onPress?.(d.key)} style={{ alignItems: 'center' }}>
            <T v={d.key === today ? 'bold' : 'medium'} size={12} style={{ color: d.key === today ? colors.primary : colors.inkFaint, marginBottom: 6 }}>{WEEKDAY_LETTER[i]}</T>
            <View style={[st.dot, { width: size, height: size, borderRadius: size / 2 }, d.key === today && { borderColor: colors.primary, borderWidth: 2 }]}>
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: size * fill, backgroundColor: d.met ? colors.primary : colors.primarySoft }} />
              {d.met && <Ionicons name="flag" size={15} color={colors.onPrimary} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DayNav({ date, onChange }: { date: string; onChange: (k: string) => void }) {
  const today = todayKey();
  const d = fromKey(date);
  const label = date === today ? 'Hoje' : date === addDays(today, -1) ? 'Ontem' : date === addDays(today, 1) ? 'Amanhã'
    : `${WEEKDAY_LONG[weekdayOf(date)].split('-')[0]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3).toLowerCase()}`;
  return (
    <View style={[st.row, st.dayNav]}>
      <Pressable hitSlop={10} onPress={() => onChange(addDays(date, -1))} accessibilityLabel="Dia anterior"><Ionicons name="chevron-back" size={18} color={colors.inkDim} /></Pressable>
      <Pressable onPress={() => onChange(today)} style={{ paddingHorizontal: 12 }}><T v="bold" size={13}>{label}</T></Pressable>
      <Pressable hitSlop={10} onPress={() => onChange(addDays(date, 1))} accessibilityLabel="Próximo dia"><Ionicons name="chevron-forward" size={18} color={colors.inkDim} /></Pressable>
    </View>
  );
}

export function TaskRow({ task, done, locked, onToggle, onEdit }: {
  task: Task & { id: string }; done: boolean; locked?: boolean; onToggle: () => void; onEdit?: () => void;
}) {
  const sub = [task.repeat === 'weekly' ? 'hábito' : 'só neste dia', task.time, task.durationMin ? `${task.durationMin} min` : null].filter(Boolean).join(' · ');
  return (
    <View style={[st.row, st.task]}>
      <Pressable onPress={onToggle} disabled={locked} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={task.title}
        style={[st.check, done && { backgroundColor: colors.primary, borderColor: colors.primary }, locked && { opacity: 0.35 }]}>
        {done && <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
      </Pressable>
      <Pressable onPress={onEdit} style={[st.row, { flex: 1 }]}>
        <T size={20} style={{ marginHorizontal: 12 }}>{task.icon}</T>
        <View style={{ flex: 1 }}>
          <T v="medium" size={16} style={done && { color: colors.inkFaint, textDecorationLine: 'line-through' }}>{task.title}</T>
          <T size={12} faint style={{ marginTop: 1 }}>{sub}</T>
        </View>
        <View style={[st.ptsTag, done && { backgroundColor: colors.primarySoft }]}>
          <T v="bold" size={12} style={{ color: done ? colors.primary : colors.inkDim }}>{task.points} pts</T>
        </View>
      </Pressable>
    </View>
  );
}

export function InlineStat({ icon, value, label, tint = colors.ink }: { icon: keyof typeof Ionicons.glyphMap; value: string | number; label: string; tint?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={st.row}>
        <Ionicons name={icon} size={15} color={tint} style={{ marginRight: 5 }} />
        <T v="display" size={20}>{value}</T>
      </View>
      <T size={12} dim style={{ marginTop: 2 }}>{label}</T>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  trail: { height: 10, borderRadius: 5, flex: 1 },
  dot: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  dayNav: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.line },
  task: { paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.inkFaint, alignItems: 'center', justifyContent: 'center' },
  ptsTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, marginLeft: 8 },
});
