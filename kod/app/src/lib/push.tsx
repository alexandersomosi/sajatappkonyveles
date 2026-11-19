// Push-értesítés (SPEC §11.2): Expo push token regisztrálása belépés után, koppintásra a megadott képernyő.
// EAS projekt-azonosító nélkül (a tulaj még nem hozta létre) nem kérünk tokent: az appon belüli értesítések így is mennek.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { post } from '../api/http';
import { MINTA_MOD } from '../config';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
  });
}

function projektAzonosito(): string | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as { eas?: { projectId?: string } };
  return extra.eas?.projectId ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
}

async function regisztral() {
  if (Platform.OS === 'web' || MINTA_MOD || !Device.isDevice) return;
  const projectId = projektAzonosito();
  if (!projectId) return; // [OWNER] EAS projekt + FCM/APNs kell hozzá
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alap', { name: 'Értesítések', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#1428DB' });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await post('/me/push-tokens', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
}

function linkre(adat: unknown) {
  const link = (adat as { link?: unknown } | undefined)?.link;
  if (typeof link === 'string' && link.startsWith('/')) router.push(link as never);
}

export function ErtesitesKezelo() {
  useEffect(() => {
    regisztral().catch(() => undefined);
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => linkre(r.notification.request.content.data));
    Notifications.getLastNotificationResponseAsync()
      .then((r) => r && linkre(r.notification.request.content.data))
      .catch(() => undefined);
    return () => sub.remove();
  }, []);
  return null;
}
