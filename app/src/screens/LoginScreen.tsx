import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Label, T, Toggle, s } from '../components/ui';
import { authenticate, loadBackend, type Session } from '../data/session';
import { colors } from '../theme';

export function LoginScreen({ onDone, notice }: { onDone: (session: Session) => void; notice?: string | null }) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [showServer, setShowServer] = useState(false);

  useEffect(() => {
    loadBackend().then((b) => {
      setUrl(b.url);
      setKey(b.key);
      if (!b.url || !b.key) setShowServer(true); // build sem banco embutido: pede na primeira vez
    });
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const session = await authenticate(mode, { url, key }, { email, password, name: mode === 'register' ? name : undefined });
      onDone(session);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 56 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="compass" size={36} color={colors.onPrimary} />
        </View>
        <T v="displayBold" size={52} style={{ marginTop: 22, letterSpacing: -1.5 }}>rumo<T v="displayBold" size={52} style={{ color: colors.primary }}>.</T></T>
        <T v="display" size={20} dim style={{ marginTop: 2 }}>Um passo de cada vez.</T>
        <T dim style={{ marginTop: 10, marginBottom: 26 }}>Planeje hábitos, some pontos e veja sua rota do mês, em todos os seus aparelhos.</T>

        <Toggle value={mode} onChange={setMode} options={[{ value: 'register', label: 'Criar conta' }, { value: 'login', label: 'Já tenho conta' }]} />

        {mode === 'register' && (
          <>
            <Label>Nome</Label>
            <TextInput value={name} onChangeText={setName} placeholder="Como quer ser chamado" placeholderTextColor={colors.inkFaint} style={s.input} autoComplete="name" />
          </>
        )}
        <Label>E-mail</Label>
        <TextInput value={email} onChangeText={setEmail} placeholder="voce@email.com" placeholderTextColor={colors.inkFaint} style={s.input} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Label>Senha</Label>
        <TextInput value={password} onChangeText={setPassword} placeholder="mínimo 6 caracteres" placeholderTextColor={colors.inkFaint} style={s.input} secureTextEntry autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />

        <Pressable onPress={() => setShowServer((v) => !v)} style={[s.row, { marginTop: 18 }]}>
          <Ionicons name="server-outline" size={14} color={colors.inkFaint} />
          <T size={13} faint style={{ marginLeft: 6 }}>Banco: {url.replace(/^https?:\/\//, '') || 'não configurado'}</T>
        </Pressable>
        {showServer && (
          <>
            <TextInput value={url} onChangeText={setUrl} placeholder="https://seuprojeto.supabase.co" placeholderTextColor={colors.inkFaint} style={[s.input, { marginTop: 8 }]} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <TextInput value={key} onChangeText={setKey} placeholder="Chave pública (anon / publishable)" placeholderTextColor={colors.inkFaint} style={[s.input, { marginTop: 8 }]} autoCapitalize="none" autoCorrect={false} />
            <T size={12} faint style={{ marginTop: 6 }}>No Supabase: Project Settings → API. Use a mesma URL e chave no computador e no celular.</T>
          </>
        )}

        {error && <T size={13} style={{ color: colors.danger, marginTop: 14 }}>{error}</T>}

        {busy ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 26 }} />
        ) : (
          <Button title={mode === 'register' ? 'Começar' : 'Entrar'} icon="arrow-forward" onPress={submit} disabled={!email || password.length < 6} style={{ marginTop: 24 }} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
