import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

type Variant = keyof typeof fonts;

// Texto base. `display` usa a serifa da marca (títulos e números grandes).
export function T({ children, style, dim, faint, size = 15, v = 'body', numberOfLines }: {
  children: ReactNode; style?: StyleProp<TextStyle>; dim?: boolean; faint?: boolean;
  size?: number; v?: Variant; numberOfLines?: number;
}) {
  const color = faint ? colors.inkFaint : dim ? colors.inkDim : colors.ink;
  return <Text numberOfLines={numberOfLines} style={[{ color, fontSize: size, fontFamily: fonts[v] }, style]}>{children}</Text>;
}

export function Button({ title, onPress, disabled, kind = 'solid', icon, style }: {
  title: string; onPress: () => void; disabled?: boolean; kind?: 'solid' | 'ghost' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle>;
}) {
  const solid = kind === 'solid';
  const fg = solid ? colors.onPrimary : kind === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, solid ? s.btnSolid : s.btnGhost, { opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}
    >
      {icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 8 }} />}
      <T v="bold" size={15} style={{ color: fg }}>{title}</T>
    </Pressable>
  );
}

export function IconButton({ name, onPress, size = 20, color = colors.ink, style, label }: {
  name: keyof typeof Ionicons.glyphMap; onPress: () => void; size?: number; color?: string; style?: StyleProp<ViewStyle>; label?: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }, style]}>
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

// Escolha de valor por pílulas (substitui o stepper −/+).
export function ChoicePills<V extends string | number>({ value, options, onChange, format }: {
  value: V; options: readonly V[]; onChange: (v: V) => void; format?: (v: V) => string;
}) {
  return (
    <View style={s.pills}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={String(o)} onPress={() => onChange(o)} style={[s.pill, on && s.pillOn]}>
            <T v={on ? 'bold' : 'medium'} size={14} style={{ color: on ? colors.bg : colors.inkDim }}>{format ? format(o) : String(o)}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

// Ajuste fino numérico, discreto (usado nas metas diárias).
export function Nudge({ value, onChange, step = 5, min = 0, max = 9999, suffix }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string;
}) {
  return (
    <View style={s.nudge}>
      <IconButton name="remove" size={18} color={colors.inkDim} onPress={() => onChange(Math.max(min, value - step))} style={s.nudgeBtn} label="Diminuir" />
      <T v="bold" size={15} style={{ minWidth: 54, textAlign: 'center' }}>{value}{suffix ? ` ${suffix}` : ''}</T>
      <IconButton name="add" size={18} color={colors.primary} onPress={() => onChange(Math.min(max, value + step))} style={s.nudgeBtn} label="Aumentar" />
    </View>
  );
}

export function Toggle<V extends string>({ value, options, onChange }: {
  value: V; options: { value: V; label: string; icon?: keyof typeof Ionicons.glyphMap }[]; onChange: (v: V) => void;
}) {
  return (
    <View style={s.toggle}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.toggleItem, on && s.toggleOn]}>
            {o.icon && <Ionicons name={o.icon} size={16} color={on ? colors.primary : colors.inkFaint} style={{ marginRight: 6 }} />}
            <T v={on ? 'bold' : 'medium'} size={14} style={{ color: on ? colors.ink : colors.inkDim }}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Bar({ value, color = colors.primary, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

// Painel inferior sobre Modal; fecha ao tocar fora.
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={[s.row, { justifyContent: 'space-between', marginBottom: 16 }]}>
            <T v="display" size={24}>{title}</T>
            <IconButton name="close" onPress={onClose} style={s.closeBtn} label="Fechar" />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Section({ title, right, children, style }: { title: string; right?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 26 }, style]}>
      <View style={[s.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
        <T v="bold" size={12} style={{ letterSpacing: 1.4, color: colors.inkDim }}>{title.toUpperCase()}</T>
        {right}
      </View>
      {children}
    </View>
  );
}

export const Label = ({ children }: { children: ReactNode }) => <T v="medium" size={13} dim style={s.label}>{children}</T>;

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, borderWidth: 1, borderColor: colors.line },
  btn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, flexDirection: 'row' },
  btnSolid: { backgroundColor: colors.primary },
  btnGhost: { backgroundColor: 'transparent' },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  nudge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 3 },
  nudgeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface },
  toggle: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.line },
  toggleItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 2, borderColor: 'transparent', marginBottom: -1 },
  toggleOn: { borderColor: colors.primary },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, maxHeight: '92%', borderTopWidth: 1, borderColor: colors.line },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt },
  input: { height: 50, borderRadius: radius.sm, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, color: colors.ink, paddingHorizontal: 14, fontSize: 16, fontFamily: fonts.body },
  label: { marginBottom: 8, marginTop: 18 },
});
