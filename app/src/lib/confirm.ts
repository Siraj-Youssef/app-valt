import { Alert, Platform } from 'react-native';

// Alert.alert com botões não funciona no navegador; lá usamos window.confirm.
export function confirm(title: string, message: string, action: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
}
