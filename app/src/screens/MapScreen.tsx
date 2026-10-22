// "Mapa": o mês como mapa de calor + histórico das semanas e hábitos mais constantes.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bar, Card, IconButton, Section, T, s } from '../components/ui';
import { useDb } from '../data/store';
import { MONTHS, WEEKDAY_LETTER, addDays, dayOfMonth, rangeKeys, todayKey, weekKeys, weekdayOf } from '../lib/dates';
import { buildModel, goalOn, metOn, monthStats, pointsOn, sum, weekGoal } from '../lib/model';
import { colors } from '../theme';
import { Screen } from './Screen';

export function MapScreen() {
  const m = buildModel(useDb());
  const now = new Date();
  const today = todayKey();
  const [ym, setYm] = useState({ y: now.getFullYear(), mo: now.getMonth() });
  const [selected, setSelected] = useState(today);
  const stats = monthStats(m, ym.y, ym.mo, today);
  const shift = (d: number) => setYm(({ y, mo }) => { const n = new Date(y, mo + d, 1); return { y: n.getFullYear(), mo: n.getMonth() }; });

  const cells: (string | null)[] = [...Array(weekdayOf(stats.keys[0])).fill(null), ...stats.keys];
  while (cells.length % 7) cells.push(null);
  const taskById = new Map(m.tasks.map((t) => [t.id, t]));
  const selectedDone = (m.doneByDate.get(selected) ?? []).map((id) => taskById.get(id)).filter((t): t is NonNullable<typeof t> => !!t);

  const goal = weekGoal(m);
  const weeks = Array.from({ length: 8 }, (_, i) => weekKeys(addDays(today, -7 * (7 - i))));
  const weekPts = weeks.map((w) => sum(w, (k) => pointsOn(m, k)));
  const maxWeek = Math.max(1, goal, ...weekPts);

  const counts = new Map<string, number>();
  for (const k of rangeKeys(addDays(today, -29), today)) for (const id of m.doneByDate.get(k) ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  const steady = m.tasks.map((t) => ({ t, n: counts.get(t.id) ?? 0 })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 6);

  return (
    <Screen
      kicker="Mapa"
      title={`${MONTHS[ym.mo]} ${ym.y !== now.getFullYear() ? ym.y : ''}`.trim()}
      right={
        <View style={s.row}>
          <IconButton name="chevron-back" onPress={() => shift(-1)} label="Mês anterior" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface }} />
          <IconButton name="chevron-forward" onPress={() => shift(1)} label="Próximo mês" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, marginLeft: 8 }} />
        </View>
      }
    >
      <View style={[s.row, { gap: 10 }]}>
        <Summary value={stats.points} label={`de ${stats.goal} pts`} />
        <Summary value={stats.stars} label={stats.stars === 1 ? 'marco' : 'marcos'} icon="flag" />
        <Summary value={stats.tasksDone} label="passos" />
      </View>

      <Card style={{ marginTop: 14, padding: 12 }}>
        <View style={s.row}>
          {WEEKDAY_LETTER.map((d, i) => <T key={i} v="medium" faint size={12} style={{ flex: 1, textAlign: 'center' }}>{d}</T>)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {cells.map((k, i) => {
            if (!k) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            const g = goalOn(m, k);
            const ratio = g ? Math.min(1, pointsOn(m, k) / g) : pointsOn(m, k) > 0 ? 0.5 : 0;
            const met = metOn(m, k);
            const isSel = k === selected;
            return (
              <Pressable key={k} onPress={() => setSelected(k)} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }} accessibilityLabel={`Dia ${dayOfMonth(k)}`}>
                <View style={{
                  flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: ratio === 0 ? colors.bg : met ? colors.primary : `rgba(229,48,43,${0.15 + ratio * 0.45})`,
                  borderWidth: isSel ? 2 : k === today ? 1.5 : 0, borderColor: isSel ? colors.accent : colors.primary,
                }}>
                  <T v={k === today ? 'bold' : 'medium'} size={13} style={{ color: met ? colors.onPrimary : k > today ? colors.inkFaint : colors.ink }}>{dayOfMonth(k)}</T>
                  {met && <Ionicons name="flag" size={9} color={colors.onPrimary} style={{ position: 'absolute', top: 3, right: 4 }} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Section title={`Dia ${dayOfMonth(selected)} · ${pointsOn(m, selected)}/${goalOn(m, selected)} pts`}>
        {selectedDone.length === 0 ? <T dim>Nenhum passo registrado.</T> : selectedDone.map((t) => (
          <View key={t.id} style={[s.row, { paddingVertical: 8 }]}>
            <T size={18} style={{ marginRight: 10 }}>{t.icon}</T>
            <T v="medium" style={{ flex: 1 }}>{t.title}</T>
            <T v="bold" style={{ color: colors.primary }}>{m.completions.get(`${t.id}@${selected}`)?.points ?? t.points} pts</T>
          </View>
        ))}
      </Section>

      <Section title="Últimas 8 semanas" right={<T size={12} faint>linha = meta</T>}>
        <Card>
          <View style={{ height: 120, flexDirection: 'row', alignItems: 'flex-end' }}>
            {goal > 0 && <View style={{ position: 'absolute', left: 0, right: 0, bottom: (goal / maxWeek) * 100 + 18, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.accent }} />}
            {weekPts.map((v, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ width: 14, height: Math.max(3, (v / maxWeek) * 100), borderRadius: 7, backgroundColor: goal > 0 && v >= goal ? colors.primary : colors.primarySoft }} />
                <T size={10} faint style={{ marginTop: 6 }}>{dayOfMonth(weeks[i][0])}/{weeks[i][0].slice(5, 7)}</T>
              </View>
            ))}
          </View>
        </Card>
      </Section>

      <Section title="Hábitos mais constantes (30 dias)">
        {steady.length === 0 ? <T dim>Conclua alguns passos para ver quais hábitos você mais mantém.</T> : steady.map(({ t, n }) => (
          <View key={t.id} style={{ marginBottom: 12 }}>
            <View style={[s.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
              <T v="medium">{t.icon}  {t.title}</T>
              <T size={13} dim>{n} de 30 dias</T>
            </View>
            <Bar value={n / 30} />
          </View>
        ))}
      </Section>
    </Screen>
  );
}

function Summary({ value, label, icon }: { value: number; label: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Card style={{ flex: 1, padding: 12 }}>
      <View style={s.row}>
        {icon && <Ionicons name={icon} size={14} color={colors.accent} style={{ marginRight: 4 }} />}
        <T v="display" size={24}>{value}</T>
      </View>
      <T size={12} dim>{label}</T>
    </Card>
  );
}
