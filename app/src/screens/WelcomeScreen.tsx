import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Label, T, s } from '../components/ui';
import { colors } from '../theme';

// Primeira abertura: só pede o nome. Não há conta; tudo fica guardado neste celular.
export function WelcomeScreen({ onDone }: { onDone: (name: string) => void }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 56 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="compass" size={36} color={colors.onPrimary} />
        </View>
        <T v="displayBold" size={52} style={{ marginTop: 22, letterSpacing: -1.5 }}>rumo<T v="displayBold" size={52} style={{ color: colors.primary }}>.</T></T>
        <T v="display" size={20} dim style={{ marginTop: 2 }}>Um passo de cada vez.</T>
        <T dim style={{ marginTop: 10, marginBottom: 26 }}>Planeje hábitos, some pontos e veja sua rota do mês. Tudo fica salvo neste celular.</T>

        <Label>Nome</Label>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Como quer ser chamado"
          placeholderTextColor={colors.inkFaint}
          style={s.input}
          autoComplete="name"
          maxLength={60}
          returnKeyType="go"
          onSubmitEditing={() => name.trim() && onDone(name.trim())}
        />

        <Button title="Começar" icon="arrow-forward" onPress={() => onDone(name.trim())} disabled={!name.trim()} style={{ marginTop: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
