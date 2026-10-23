import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Bar, Card, Nudge, Section, T, s } from '../components/ui';
import { put, useDb } from '../data/store';
import type { GoalsSettings, ProfileSettings } from '../data/types';
import { MONTHS, WEEKDAY_LONG, todayKey } from '../lib/dates';
import { buildModel, level, monthStats, routeStatus, streaks, weekGoal } from '../lib/model';
import { colors } from '../theme';
import { Screen } from './Screen';

const TONE = {
  good: { fg: colors.primary, bg: colors.primarySoft },
  warn: { fg: colors.accent, bg: colors.accentSoft },
  bad: { fg: colors.danger, bg: colors.dangerSoft },
  muted: { fg: colors.inkDim, bg: colors.surfaceAlt },
};

export function YouScreen() {
  const m = buildModel(useDb());
  const today = todayKey();
  const now = new Date();
  const name = m.profile?.name ?? '';
  const [editing, setEditing] = useState<string | null>(null);
  const lv = level(m, today);
  const st = streaks(m, today);
  const month = monthStats(m, now.getFullYear(), now.getMonth(), today);
  const route = routeStatus(month.pace, month.hasGoal);
  const tone = TONE[route.tone];

  const setDaily = (i: number, v: number) => {
    const daily = [...m.daily];
    daily[i] = v;
    put<GoalsSettings>('settings', 'goals', { daily });
  };
  const saveName = () => {
    if (editing?.trim()) put<ProfileSettings>('settings', 'profile', { name: editing.trim(), startDate: m.startDate });
    setEditing(null);
  };

  return (
    <Screen kicker="Você" title={name}>
      <View style={[s.row, { marginTop: -10, marginBottom: 6 }]}>
        <Pressable onPress={() => setEditing(name)} style={s.row}>
          <Ionicons name="create-outline" size={14} color={colors.primary} />
          <T v="medium" size={13} style={{ color: colors.primary, marginLeft: 3 }}>editar nome</T>
        </Pressable>
      </View>
      {editing !== null && (
        <TextInput value={editing} onChangeText={setEditing} onSubmitEditing={saveName} onBlur={saveName} autoFocus maxLength={40} style={[s.input, { marginTop: 6 }]} />
      )}

      <Card style={{ marginTop: 16 }}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <View style={s.row}>
            <Ionicons name="trail-sign" size={18} color={colors.primary} />
            <T v="display" size={20} style={{ marginLeft: 8 }}>Etapa {lv.level}</T>
          </View>
          <T size={13} dim>{lv.weekPoints}/{lv.weekGoal} pts na semana</T>
        </View>
        <View style={{ marginTop: 12 }}><Bar value={lv.weekGoal ? lv.weekPoints / lv.weekGoal : 0} /></View>
        <T dim size={13} style={{ marginTop: 8 }}>
          {lv.weekGoal === 0 ? 'Defina os pontos por dia abaixo para começar a avançar de etapa.'
            : lv.missing > 0 ? `Mais ${lv.missing} pts nesta semana e você avança para a etapa ${lv.level + 1}.`
            : 'Semana completa: etapa conquistada.'}
        </T>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T v="medium" size={13} dim>Rota de {MONTHS[now.getMonth()].toLowerCase()}</T>
          <View style={{ backgroundColor: tone.bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T v="bold" size={12} style={{ color: tone.fg }}>{route.label}</T>
          </View>
        </View>
        <T size={14} style={{ marginTop: 8 }}>{route.body}</T>
        {month.hasGoal && (
          <View style={[s.row, { marginTop: 12, alignItems: 'flex-end' }]}>
            <T v="displayBold" size={30} style={{ color: tone.fg }}>{month.projection}</T>
            <T dim size={13} style={{ marginLeft: 6, marginBottom: 5 }}>pts previstos · meta {month.goal} · passo em {Math.round(month.pace * 100)}%</T>
          </View>
        )}
      </Card>

      <View style={[s.row, { gap: 10, marginTop: 12 }]}>
        <Mini value={month.points} label="pts no mês" />
        <Mini value={month.stars} label="marcos" />
        <Mini value={st.current} label="dias seguidos" sub={`recorde: ${st.best}`} />
      </View>

      <Section title="Pontos por dia" right={<T size={12} dim>semana: {weekGoal(m)} pts</T>}>
        <Card style={{ paddingVertical: 6 }}>
          {WEEKDAY_LONG.map((d, i) => (
            <View key={d} style={[s.row, { justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < 6 ? 1 : 0, borderColor: colors.line }]}>
              <T v="medium">{d}</T>
              <Nudge value={m.daily[i] ?? 0} onChange={(v) => setDaily(i, v)} step={5} />
            </View>
          ))}
        </Card>
        <T faint size={12} style={{ marginTop: 8 }}>A meta da semana e do mês é a soma dos dias. Dia com 0 é dia livre e não quebra a sequência.</T>
      </Section>

      <Section title="Seus dados">
        <Card>
          <View style={s.row}>
            <Ionicons name="phone-portrait-outline" size={18} color={colors.inkDim} />
            <T size={13} dim style={{ marginLeft: 8, flex: 1 }}>Tudo fica salvo só neste celular, sem conta e sem internet. Desinstalar o app apaga os dados.</T>
          </View>
        </Card>
      </Section>
    </Screen>
  );
}

function Mini({ value, label, sub }: { value: number; label: string; sub?: string }) {
  return (
    <Card style={{ flex: 1, padding: 12 }}>
      <T v="display" size={24}>{value}</T>
      <T size={12} dim numberOfLines={1}>{label}</T>
      {sub && <T size={11} faint numberOfLines={1}>{sub}</T>}
    </Card>
  );
}
