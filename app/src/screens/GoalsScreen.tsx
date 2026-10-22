import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { Bar, Card, Section, T, s } from '../components/ui';
import { newId, put, useDb } from '../data/store';
import type { Goal, GoalLog } from '../data/types';
import { todayKey } from '../lib/dates';
import { buildModel, goalProgress } from '../lib/model';
import { useShell } from '../shell';
import { colors } from '../theme';
import { Screen } from './Screen';

const PERIODS: Goal['period'][] = ['week', 'month', 'year'];
const SECTION_TITLE: Record<Goal['period'], string> = { week: 'Nesta semana', month: 'Neste mês', year: 'Neste ano' };

export function GoalsScreen() {
  const m = buildModel(useDb());
  const { openGoal, openLog } = useShell();
  const quickLog = (goalId: string) => put<GoalLog>('goalLogs', newId(), { goalId, date: todayKey(), amount: 1 });

  return (
    <Screen kicker="Destinos" title="Metas">
      <T dim style={{ marginTop: -6 }}>Aonde você quer chegar nesta semana, neste mês e neste ano. Toque em +1 a cada avanço.</T>
      {m.goals.length === 0 && (
        <Card style={{ alignItems: 'center', paddingVertical: 28, marginTop: 20 }}>
          <Ionicons name="trophy-outline" size={30} color={colors.accent} />
          <T v="medium" style={{ marginTop: 8 }}>Nenhum destino ainda</T>
          <T dim size={13} style={{ marginTop: 4, textAlign: 'center' }}>Ex.: ler 4 livros no mês, correr 20 km na semana.</T>
          <Pressable onPress={() => openGoal(null)} style={{ marginTop: 10 }}><T v="bold" style={{ color: colors.primary }}>Criar meta</T></Pressable>
        </Card>
      )}
      {PERIODS.map((p) => {
        const goals = m.goals.filter((g) => g.period === p).sort((a, b) => a.title.localeCompare(b.title));
        if (goals.length === 0) return null;
        return (
          <Section key={p} title={SECTION_TITLE[p]}>
            {goals.map((g) => {
              const pr = goalProgress(m, g);
              const reached = pr.ratio >= 1;
              return (
                <Card key={g.id} style={{ marginBottom: 10 }}>
                  <View style={s.row}>
                    <Pressable onPress={() => openGoal(g)} style={[s.row, { flex: 1 }]} accessibilityLabel={`Editar ${g.title}`}>
                      <T size={24} style={{ marginRight: 12 }}>{g.icon}</T>
                      <View style={{ flex: 1 }}>
                        <T v="medium" size={16}>{g.title}</T>
                        <T dim size={13}>{pr.done} de {g.target} {g.unit}</T>
                      </View>
                    </Pressable>
                    {reached ? (
                      <View style={[s.row, { backgroundColor: colors.accentSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 }]}>
                        <Ionicons name="flag" size={13} color={colors.accent} />
                        <T v="bold" size={12} style={{ color: colors.accent, marginLeft: 4 }}>Chegou</T>
                      </View>
                    ) : (
                      <Pressable onPress={() => quickLog(g.id)} onLongPress={() => openLog(g.id)} accessibilityLabel={`Somar 1 em ${g.title}`}
                        style={({ pressed }) => ({ backgroundColor: colors.primarySoft, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
                        <T v="bold" style={{ color: colors.primary }}>+1</T>
                      </Pressable>
                    )}
                  </View>
                  <View style={{ marginTop: 12 }}><Bar value={pr.ratio} color={reached ? colors.accent : colors.primary} /></View>
                </Card>
              );
            })}
          </Section>
        );
      })}
      {m.goals.length > 0 && <T faint size={12} style={{ textAlign: 'center', marginTop: 8 }}>Segure o +1 para registrar outro valor · toque na meta para editar</T>}
    </Screen>
  );
}
