import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Button, Label, Nudge, Sheet, T, Toggle, s } from '../components/ui';
import { newId, put, remove } from '../data/store';
import type { Goal, GoalLog } from '../data/types';
import { confirm } from '../lib/confirm';
import { todayKey } from '../lib/dates';
import { colors } from '../theme';

const ICONS = ['🏔️', '📚', '🏃', '💰', '💪', '✍️', '🎨', '🧠', '🌱', '🏆'];
export const PERIOD_LABEL: Record<Goal['period'], string> = { week: 'Semana', month: 'Mês', year: 'Ano' };

export function GoalSheet({ visible, onClose, editing }: { visible: boolean; onClose: () => void; editing?: (Goal & { id: string }) | null }) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🏔️');
  const [period, setPeriod] = useState<Goal['period']>('month');
  const [target, setTarget] = useState(10);
  const [unit, setUnit] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTitle(editing?.title ?? '');
    setIcon(editing?.icon ?? '🏔️');
    setPeriod(editing?.period ?? 'month');
    setTarget(editing?.target ?? 10);
    setUnit(editing?.unit ?? '');
  }, [visible, editing]);

  const valid = title.trim().length > 0 && target > 0;
  const save = () => {
    put<Goal>('goals', editing?.id ?? newId(), { title: title.trim(), icon, period, target, unit: unit.trim() || 'vezes' });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? 'Editar meta' : 'Nova meta'}>
      <Toggle value={period} onChange={setPeriod} options={(['week', 'month', 'year'] as const).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
      <Label>Aonde quer chegar?</Label>
      <TextInput value={title} onChangeText={setTitle} placeholder="Ex.: Ler 4 livros" placeholderTextColor={colors.inkFaint} style={s.input} maxLength={60} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
        {ICONS.map((i) => (
          <Pressable key={i} onPress={() => setIcon(i)} style={{ width: 40, height: 40, marginRight: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: i === icon ? colors.primarySoft : 'transparent', borderWidth: i === icon ? 1 : 0, borderColor: colors.primary }}>
            <T size={20}>{i}</T>
          </Pressable>
        ))}
      </ScrollView>
      <View style={[s.row, { gap: 12, alignItems: 'flex-end' }]}>
        <View>
          <Label>Quanto</Label>
          <Nudge value={target} onChange={setTarget} step={1} min={1} />
        </View>
        <View style={{ flex: 1 }}>
          <Label>Unidade</Label>
          <TextInput value={unit} onChangeText={setUnit} placeholder="livros, km, R$…" placeholderTextColor={colors.inkFaint} style={[s.input, { height: 40 }]} maxLength={16} />
        </View>
      </View>
      <Button title="Salvar meta" onPress={save} disabled={!valid} style={{ marginTop: 22 }} />
      {editing && (
        <Button title="Excluir meta" kind="danger" icon="trash-outline"
          onPress={() => confirm('Excluir meta', `Excluir "${editing.title}"?`, 'Excluir', () => { remove('goals', editing.id); onClose(); })} />
      )}
    </Sheet>
  );
}

export function LogSheet({ visible, onClose, goals, initialGoalId }: {
  visible: boolean; onClose: () => void; goals: (Goal & { id: string })[]; initialGoalId?: string | null;
}) {
  const [amount, setAmount] = useState(1);
  useEffect(() => { if (visible) setAmount(1); }, [visible]);
  const goal = goals.find((g) => g.id === initialGoalId);

  return (
    <Sheet visible={visible} onClose={onClose} title="Registrar avanço">
      {goal ? (
        <>
          <View style={s.row}>
            <T size={24} style={{ marginRight: 10 }}>{goal.icon}</T>
            <T v="medium" size={17}>{goal.title}</T>
          </View>
          <Label>Quanto você avançou ({goal.unit})?</Label>
          <Nudge value={amount} onChange={setAmount} step={1} min={1} />
          <Button title="Registrar" style={{ marginTop: 22 }} onPress={() => {
            put<GoalLog>('goalLogs', newId(), { goalId: goal.id, date: todayKey(), amount });
            onClose();
          }} />
        </>
      ) : (
        <T dim>Escolha uma meta na aba Metas.</T>
      )}
    </Sheet>
  );
}
