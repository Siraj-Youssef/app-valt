import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DayNav, InlineStat, TaskRow, TrailBar, WeekDots } from '../components/widgets';
import { Card, Section, T, s } from '../components/ui';
import { put, useDb } from '../data/store';
import type { Completion } from '../data/types';
import { MONTHS, WEEKDAY_LONG, todayKey, weekKeys, weekdayOf } from '../lib/dates';
import {
  buildModel, compassTip, completionId, goalOn, isDone, level, metOn, periodOf, pointsOn, streaks, tasksFor, weekGoal,
  type DayPeriod,
} from '../lib/model';
import { useShell } from '../shell';
import { colors } from '../theme';
import { Screen } from './Screen';

const PERIODS: DayPeriod[] = ['Manhã', 'Tarde', 'Noite', 'Qualquer hora'];

export function TodayScreen() {
  const m = buildModel(useDb());
  const { openTask } = useShell();
  const nav = useNavigation<any>();
  const today = todayKey();
  const [day, setDay] = useState(today);

  const name = (m.profile?.name ?? '').split(' ')[0];
  const now = new Date();
  const dayTasks = tasksFor(m, day);
  const dayPts = pointsOn(m, day);
  const dayGoal = goalOn(m, day);
  const done = dayTasks.filter((t) => isDone(m, t.id, day));
  const week = weekKeys(today).map((k) => ({ key: k, ratio: goalOn(m, k) ? pointsOn(m, k) / goalOn(m, k) : 0, met: metOn(m, k) }));
  const weekPts = weekKeys(today).reduce((a, k) => a + pointsOn(m, k), 0);
  const tip = compassTip(m, today);
  const lv = level(m, today);

  const toggle = (taskId: string, points: number) => {
    put<Completion>('completions', completionId(taskId, day), { taskId, date: day, done: !isDone(m, taskId, day), points });
  };

  return (
    <Screen>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <T v="displayBold" size={24} style={{ letterSpacing: -0.5 }}>rumo<T v="displayBold" size={24} style={{ color: colors.primary }}>.</T></T>
        <View style={s.row}>
          <Pressable onPress={() => nav.navigate('Você')} accessibilityLabel="Abrir perfil" style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <T v="bold" style={{ color: colors.onPrimary }}>{name.slice(0, 1).toUpperCase()}</T>
          </Pressable>
        </View>
      </View>

      <T v="medium" dim style={{ marginTop: 26 }}>Olá, {name}.</T>
      <T v="display" size={30} style={{ marginTop: 2 }}>
        {WEEKDAY_LONG[weekdayOf(today)].split('-')[0]}, {now.getDate()} de {MONTHS[now.getMonth()].toLowerCase()}
      </T>

      <Card style={{ marginTop: 18, padding: 18 }}>
        <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
          <View>
            <T v="medium" size={13} dim>{day === today ? 'Caminhado hoje' : 'Caminhado no dia'}</T>
            <View style={[s.row, { alignItems: 'flex-end', marginTop: 2 }]}>
              <T v="displayBold" size={44} style={{ lineHeight: 50 }}>{dayPts}</T>
              <T v="medium" dim style={{ marginLeft: 6, marginBottom: 8 }}>{dayGoal ? `de ${dayGoal} pts` : 'pts · sem meta'}</T>
            </View>
          </View>
          {metOn(m, day) && (
            <View style={[s.row, { backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, marginBottom: 10 }]}>
              <Ionicons name="flag" size={13} color={colors.onPrimary} />
              <T v="bold" size={12} style={{ color: colors.onPrimary, marginLeft: 5 }}>Marco</T>
            </View>
          )}
        </View>
        <View style={{ marginTop: 12 }}>
          <TrailBar parts={dayTasks.map((t) => ({ id: t.id, points: t.points, done: isDone(m, t.id, day) }))} />
        </View>
        <View style={[s.row, { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderColor: colors.line }]}>
          <InlineStat icon="flame" tint={colors.primary} value={streaks(m, today).current} label="dias seguidos" />
          <View style={{ width: 1, height: 30, backgroundColor: colors.line }} />
          <InlineStat icon="trail-sign" tint={colors.inkDim} value={`${lv.level}`} label="etapa" />
          <View style={{ width: 1, height: 30, backgroundColor: colors.line }} />
          <InlineStat icon="calendar-clear" tint={colors.inkDim} value={weekPts} label={`de ${weekGoal(m)} na semana`} />
        </View>
      </Card>

      <Pressable
        disabled={!tip.action}
        onPress={() => (tip.action === 'new' ? openTask({ mode: 'weekly' }) : nav.navigate('Você'))}
        style={[s.row, { marginTop: 14, paddingVertical: 14, paddingRight: 14, paddingLeft: 16, borderRadius: 12, backgroundColor: colors.surface, borderLeftWidth: 3, borderColor: colors.primary, alignItems: 'flex-start' }]}
      >
        <View style={{ flex: 1 }}>
          <T v="bold" size={11} style={{ color: colors.primary, letterSpacing: 1.5 }}>BÚSSOLA</T>
          <T size={14} style={{ marginTop: 4 }}>{tip.text}</T>
        </View>
        {tip.action && <Ionicons name="arrow-forward" size={18} color={colors.primary} style={{ alignSelf: 'center', marginLeft: 8 }} />}
      </Pressable>

      <Section title="Esta semana">
        <WeekDots days={week} today={today} onPress={setDay} />
      </Section>

      <Section title={`Plano · ${done.length}/${dayTasks.length}`} right={<DayNav date={day} onChange={setDay} />}>
        {dayTasks.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Ionicons name="map-outline" size={30} color={colors.inkFaint} />
            <T v="medium" style={{ marginTop: 8 }}>Nada planejado para este dia</T>
            <Pressable onPress={() => openTask({ mode: day === today ? 'weekly' : 'once', date: day })} style={{ marginTop: 6 }}>
              <T v="bold" style={{ color: colors.primary }}>Adicionar passo</T>
            </Pressable>
          </View>
        ) : (
          PERIODS.map((p) => {
            const items = dayTasks.filter((t) => periodOf(t.time) === p);
            if (items.length === 0) return null;
            return (
              <View key={p} style={{ marginBottom: 6 }}>
                <T v="medium" size={12} faint style={{ marginTop: 8 }}>{p}</T>
                {items.map((t) => (
                  <TaskRow
                    key={t.id} task={t} done={isDone(m, t.id, day)} locked={day > today}
                    onToggle={() => toggle(t.id, t.points)}
                    onEdit={() => openTask({ mode: t.repeat, editing: t })}
                  />
                ))}
              </View>
            );
          })
        )}
      </Section>
    </Screen>
  );
}
