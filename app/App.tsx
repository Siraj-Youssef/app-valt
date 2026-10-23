import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './src/components/ui';
import { loadDb, put, saveNow, useDb } from './src/data/store';
import type { Goal, ProfileSettings, Task } from './src/data/types';
import { todayKey } from './src/lib/dates';
import { buildModel } from './src/lib/model';
import { GoalsScreen } from './src/screens/GoalsScreen';
import { MapScreen } from './src/screens/MapScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { YouScreen } from './src/screens/YouScreen';
import { GoalSheet, LogSheet } from './src/sheets/GoalSheets';
import { TaskSheet, type TaskSheetProps } from './src/sheets/TaskSheet';
import { ShellContext, type ShellApi } from './src/shell';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();

type IconName = keyof typeof Ionicons.glyphMap;
const TABS: { name: string; icon: IconName; iconOn: IconName; component: () => React.JSX.Element }[] = [
  { name: 'Hoje', icon: 'sunny-outline', iconOn: 'sunny', component: TodayScreen },
  { name: 'Mapa', icon: 'map-outline', iconOn: 'map', component: MapScreen },
  { name: 'Metas', icon: 'flag-outline', iconOn: 'flag', component: GoalsScreen },
  { name: 'Você', icon: 'person-circle-outline', iconOn: 'person-circle', component: YouScreen },
];

export default function App() {
  const [fontsLoaded] = useFonts({ SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const [booting, setBooting] = useState(true);
  const hasProfile = !!useDb().cols.settings.profile;

  useEffect(() => {
    loadDb().finally(() => setBooting(false));
    // Ao sair do app, grava na hora (sem esperar o agrupamento de 250 ms).
    const sub = AppState.addEventListener('change', (st) => { if (st !== 'active') saveNow(); });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {booting || !fontsLoaded ? (
        <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : hasProfile ? (
        <Main />
      ) : (
        <WelcomeScreen onDone={(name) => put<ProfileSettings>('settings', 'profile', { name, startDate: todayKey() })} />
      )}
    </SafeAreaProvider>
  );
}

function Main() {
  const m = buildModel(useDb());
  const [taskSheet, setTaskSheet] = useState<Omit<TaskSheetProps, 'onClose'>>({ visible: false, mode: 'weekly' });
  const [goalSheet, setGoalSheet] = useState<{ visible: boolean; editing: (Goal & { id: string }) | null }>({ visible: false, editing: null });
  const [logSheet, setLogSheet] = useState<{ visible: boolean; goalId: string | null }>({ visible: false, goalId: null });

  const api = useMemo<ShellApi>(() => ({
    openTask: ({ mode, date, editing }: { mode: 'weekly' | 'once'; date?: string; editing?: (Task & { id: string }) | null }) =>
      setTaskSheet({ visible: true, mode, date, editing }),
    openGoal: (editing) => setGoalSheet({ visible: true, editing: editing ?? null }),
    openLog: (goalId) => setLogSheet({ visible: true, goalId: goalId ?? null }),
  }), []);

  const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, primary: colors.primary, text: colors.ink, border: colors.line } };

  return (
    <ShellContext.Provider value={api}>
      <NavigationContainer theme={theme}>
        <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} api={api} />}>
          {TABS.map((t) => <Tab.Screen key={t.name} name={t.name} component={t.component} />)}
        </Tab.Navigator>
      </NavigationContainer>
      <TaskSheet {...taskSheet} onClose={() => setTaskSheet((t) => ({ ...t, visible: false }))} />
      <GoalSheet visible={goalSheet.visible} editing={goalSheet.editing} onClose={() => setGoalSheet({ visible: false, editing: null })} />
      <LogSheet visible={logSheet.visible} initialGoalId={logSheet.goalId} goals={m.goals} onClose={() => setLogSheet({ visible: false, goalId: null })} />
    </ShellContext.Provider>
  );
}

// Barra de abas com rótulos e um botão "+" contextual: na aba Metas cria meta; nas outras, um novo passo.
function TabBar({ state, navigation, api }: BottomTabBarProps & { api: ShellApi }) {
  const insets = useSafeAreaInsets();
  const onGoals = state.routes[state.index].name === 'Metas';
  const showFab = state.routes[state.index].name !== 'Você';
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {showFab && (
        <Pressable
          onPress={() => (onGoals ? api.openGoal(null) : api.openTask({ mode: 'weekly' }))}
          accessibilityLabel={onGoals ? 'Nova meta' : 'Novo passo'}
          style={({ pressed }) => [tb.fab, { bottom: Math.max(insets.bottom, 8) + 74 }, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <Ionicons name="add" size={26} color={colors.onPrimary} />
          <T v="bold" size={14} style={{ color: colors.onPrimary, marginLeft: 4 }}>{onGoals ? 'Meta' : 'Passo'}</T>
        </Pressable>
      )}
      <View style={[tb.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tab = TABS[index];
          return (
            <Pressable key={route.key} onPress={() => navigation.navigate(route.name)} style={tb.item} accessibilityRole="tab" accessibilityState={{ selected: focused }}>
              <View style={[tb.iconWrap, focused && { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={focused ? tab.iconOn : tab.icon} size={22} color={focused ? colors.primary : colors.inkFaint} />
              </View>
              <T v={focused ? 'bold' : 'medium'} size={11} style={{ color: focused ? colors.primary : colors.inkFaint, marginTop: 2 }}>{route.name}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.line },
  item: { flex: 1, alignItems: 'center' },
  iconWrap: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute', right: 20, height: 52, paddingHorizontal: 18, borderRadius: 16, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
