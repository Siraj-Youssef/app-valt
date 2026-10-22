import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { T } from '../components/ui';

export function Screen({ children, title, kicker, right }: { children: ReactNode; title?: string; kicker?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 180 }}
      showsVerticalScrollIndicator={false}
    >
      {title && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            {kicker && <T v="medium" size={13} dim>{kicker}</T>}
            <T v="display" size={32}>{title}</T>
          </View>
          {right}
        </View>
      )}
      {children}
    </ScrollView>
  );
}
