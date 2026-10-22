// "Novo passo": um único formulário para hábito (repete na semana) ou passo de um dia só.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Button, ChoicePills, Label, Sheet, T, Toggle, s } from '../components/ui';
import { newId, put, remove } from '../data/store';
import type { Task } from '../data/types';
import { confirm } from '../lib/confirm';
import { WEEKDAY_LETTER, dayOfMonth, todayKey } from '../lib/dates';
import { colors } from '../theme';

const IDEAS = [
  { title: 'Caminhar', icon: '🥾' }, { title: 'Estudar', icon: '📝' }, { title: 'Ler', icon: '📚' },
  { title: 'Alongar', icon: '🤸' }, { title: 'Treinar', icon: '💪' }, { title: 'Escrever', icon: '✍️' },
];
const ICONS = ['🌱', '🥾', '📝', '📚', '🤸', '💪', '✍️', '🧘', '💧', '🍎', '💻', '🎧', '🛏️', '🧹', '💰', '🎨'];
const POINTS = [5, 10, 15, 20, 30, 50] as const;
const ALL = [0, 1, 2, 3, 4, 5, 6];
const PRESETS: [string, number[]][] = [['Todo dia', ALL], ['Dias úteis', [0, 1, 2, 3, 4]], ['Fins de semana', [5, 6]]];

export type TaskSheetProps = {
  visible: boolean;
  onClose: () => void;
  mode: 'weekly' | 'once';
  date?: string;
  editing?: (Task & { id: string }) | null;
};

export function TaskSheet({ visible, onClose, mode, date, editing }: TaskSheetProps) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🌱');
  const [points, setPoints] = useState<number>(10);
  const [repeat, setRepeat] = useState<'weekly' | 'once'>(mode);
  const [weekdays, setWeekdays] = useState<number[]>(ALL);
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setTitle(editing?.title ?? '');
    setIcon(editing?.icon ?? '🌱');
    setPoints(editing?.points ?? 10);
    setRepeat(editing?.repeat ?? mode);
    setWeekdays(editing?.weekdays ?? ALL);
    setTime(editing?.time ?? '');
    setDuration(editing?.durationMin ? String(editing.durationMin) : '');
    setSaved(0);
  }, [visible, editing, mode]);

  const onceDate = editing?.date ?? date ?? todayKey();
  const valid = title.trim().length > 0 && (repeat === 'once' || weekdays.length > 0);
  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));

  function save(another: boolean) {
    if (!valid) return;
    const task: Task = {
      title: title.trim(),
      icon,
      points,
      repeat,
      weekdays: repeat === 'weekly' ? weekdays : [],
      date: repeat === 'once' ? onceDate : undefined,
      time: /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : undefined,
      durationMin: Number(duration) > 0 ? Number(duration) : undefined,
      startDate: editing?.startDate ?? todayKey(),
    };
    put('tasks', editing?.id ?? newId(), JSON.parse(JSON.stringify(task)));
    if (!another) return onClose();
    setSaved((n) => n + 1);
    setTitle('');
    setIcon('🌱');
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? 'Editar passo' : 'Novo passo'}>
      <Toggle
        value={repeat}
        onChange={setRepeat}
        options={[{ value: 'weekly', label: 'Hábito', icon: 'repeat' }, { value: 'once', label: `Só dia ${dayOfMonth(onceDate)}`, icon: 'today-outline' }]}
      />

      <Label>O que você vai fazer?</Label>
      <View style={s.row}>
        <View style={{ width: 50, height: 50, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <T size={24}>{icon}</T>
        </View>
        <TextInput value={title} onChangeText={setTitle} placeholder="Ex.: Caminhar 20 minutos" placeholderTextColor={colors.inkFaint} style={[s.input, { flex: 1 }]} maxLength={60} />
      </View>
      {!editing && (
        <View style={[s.row, { flexWrap: 'wrap', marginTop: 10 }]}>
          <T size={13} faint style={{ marginRight: 6 }}>Ideias:</T>
          {IDEAS.map((i) => (
            <Pressable key={i.title} onPress={() => { setTitle(i.title); setIcon(i.icon); }} style={{ marginRight: 10, marginVertical: 2 }}>
              <T v="medium" size={13} style={{ color: colors.ink, textDecorationLine: 'underline' }}>{i.title}</T>
            </Pressable>
          ))}
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
        {ICONS.map((i) => (
          <Pressable key={i} onPress={() => setIcon(i)} accessibilityLabel={`Ícone ${i}`} style={{ width: 40, height: 40, marginRight: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: i === icon ? colors.primarySoft : 'transparent', borderWidth: i === icon ? 1 : 0, borderColor: colors.primary }}>
            <T size={20}>{i}</T>
          </Pressable>
        ))}
      </ScrollView>

      <Label>Quanto vale</Label>
      <ChoicePills value={points} options={POINTS} onChange={setPoints} format={(p) => `${p} pts`} />

      {repeat === 'weekly' && (
        <>
          <Label>Em quais dias</Label>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            {ALL.map((d) => {
              const on = weekdays.includes(d);
              return (
                <Pressable key={d} onPress={() => toggleDay(d)} accessibilityLabel={`Dia ${d + 1}`} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.ink : colors.bg, borderWidth: 1, borderColor: on ? colors.ink : colors.line }}>
                  <T v="bold" size={14} style={{ color: on ? colors.bg : colors.inkDim }}>{WEEKDAY_LETTER[d]}</T>
                </Pressable>
              );
            })}
          </View>
          <View style={[s.row, { marginTop: 10, gap: 16 }]}>
            {PRESETS.map(([label, days]) => (
              <Pressable key={label} onPress={() => setWeekdays([...days])}><T v="medium" size={13} style={{ color: colors.inkDim, textDecorationLine: 'underline' }}>{label}</T></Pressable>
            ))}
          </View>
        </>
      )}

      <View style={[s.row, { gap: 10 }]}>
        <View style={{ flex: 1 }}>
          <Label>Horário (opcional)</Label>
          <TextInput value={time} onChangeText={setTime} placeholder="07:30" placeholderTextColor={colors.inkFaint} style={s.input} maxLength={5} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <Label>Minutos (opcional)</Label>
          <TextInput value={duration} onChangeText={(v) => setDuration(v.replace(/\D/g, ''))} placeholder="20" placeholderTextColor={colors.inkFaint} style={s.input} maxLength={4} keyboardType="number-pad" />
        </View>
      </View>
      <T faint size={12} style={{ marginTop: 8 }}>O horário organiza o plano em manhã, tarde e noite. Não altera os pontos.</T>

      {saved > 0 && (
        <T v="medium" size={13} style={{ color: colors.primary, marginTop: 14 }}>✓ {saved} {saved === 1 ? 'passo salvo' : 'passos salvos'}. Pode adicionar o próximo.</T>
      )}

      <Button title={editing ? 'Salvar alterações' : 'Salvar'} onPress={() => save(false)} disabled={!valid} style={{ marginTop: 20 }} />
      {editing ? (
        <Button
          title="Excluir passo" kind="danger" icon="trash-outline"
          onPress={() => confirm('Excluir passo', `Excluir "${editing.title}"? Os pontos já feitos continuam no histórico.`, 'Excluir', () => { remove('tasks', editing.id); onClose(); })}
        />
      ) : (
        <Button title="Salvar e adicionar outro" kind="ghost" onPress={() => save(true)} disabled={!valid} />
      )}
    </Sheet>
  );
}
