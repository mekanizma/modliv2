import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_OUTFIT_REMINDER_KEY = 'modli_daily_outfit_reminder_v1';
const DAILY_OUTFIT_REMINDER_DEBUG_KEY = 'modli_daily_outfit_reminder_debug_v1';
const NOTIFICATIONS_ENABLED_KEY = 'modli_notifications_enabled_v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // iOS 15+ davranış alanları
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function requestPermissionsIfNeeded() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return true;
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    return await requestPermissionsIfNeeded();
  } catch (error) {
    console.warn('Failed to request notification permission', error);
    return false;
  }
}

export async function getNotificationsEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (value === null) {
      // Varsayılan: bildirimler açık
      return true;
    }
    return value === 'true';
  } catch {
    return true;
  }
}

export async function cancelDailyOutfitReminders() {
  try {
    const [dailyId, debugId] = await Promise.all([
      AsyncStorage.getItem(DAILY_OUTFIT_REMINDER_KEY),
      AsyncStorage.getItem(DAILY_OUTFIT_REMINDER_DEBUG_KEY),
    ]);

    if (dailyId) {
      await Notifications.cancelScheduledNotificationAsync(dailyId);
      await AsyncStorage.removeItem(DAILY_OUTFIT_REMINDER_KEY);
    }

    if (debugId) {
      await Notifications.cancelScheduledNotificationAsync(debugId);
      await AsyncStorage.removeItem(DAILY_OUTFIT_REMINDER_DEBUG_KEY);
    }
  } catch (error) {
    console.warn('Failed to cancel daily outfit reminders', error);
  }
}

export async function setNotificationsEnabled(enabled: boolean) {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
    if (!enabled) {
      await cancelDailyOutfitReminders();
    }
  } catch (error) {
    console.warn('Failed to update notifications preference', error);
  }
}

type EnsureOptions = {
  debugImmediate?: boolean;
};

export async function ensureDailyOutfitReminderScheduled(
  language: 'en' | 'tr',
  options?: EnsureOptions
) {
  try {
    const enabled = await getNotificationsEnabled();
    if (!enabled) return;

    const hasPermission = await requestPermissionsIfNeeded();
    if (!hasPermission) {
      console.warn('Notifications permission not granted');
      return;
    }

    const isDebug = options?.debugImmediate;
    const storageKey = isDebug ? DAILY_OUTFIT_REMINDER_DEBUG_KEY : DAILY_OUTFIT_REMINDER_KEY;

    // Test sürecinde tekrar tekrar görebilmek için debug modunda
    // önce eski planlamaları temizleyelim.
    if (isDebug) {
      console.log('🔔 Debug mode: clearing previous reminders and scheduling test notification');
      await cancelDailyOutfitReminders();
    } else {
      const existingId = await AsyncStorage.getItem(storageKey);
      if (existingId) {
        // Zaten planlanmış, tekrar oluşturma
        console.log('🔔 Daily reminder already scheduled, skipping new schedule');
        return;
      }
    }

    const title =
      language === 'tr'
        ? 'Bugünün kombin önerisi hazır'
        : "Today's outfit suggestion is ready";

    const body =
      language === 'tr'
        ? 'Bugünkü hava durumuna ve gardrobuna göre ne giyeceğini birlikte seçelim.'
        : "Let's pick what to wear today based on the weather and your wardrobe.";

    if (isDebug) {
      // iOS kısıtı sebebiyle (tekrarlı < 60 sn desteklenmiyor),
      // önce ANINDA bir test bildirimi gönderiyoruz:
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: 'daily_outfit_suggestion_debug_once' },
        },
        // trigger: null → hemen göster
        trigger: null,
      });

      // Sonra da 60 sn'de bir tekrarlayan test bildirimi planlıyoruz
      const debugId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: 'daily_outfit_suggestion_debug_repeat' },
        },
        trigger: {
          seconds: 60,
          repeats: true,
        } as Notifications.TimeIntervalTriggerInput,
      });

      await AsyncStorage.setItem(DAILY_OUTFIT_REMINDER_DEBUG_KEY, debugId);
    } else {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: 'daily_outfit_suggestion' },
        },
        trigger: {
          hour: 7,
          minute: 30,
          repeats: true,
        } as unknown as Notifications.DailyTriggerInput,
      });

      await AsyncStorage.setItem(storageKey, id);
    }
  } catch (error) {
    console.warn('Failed to schedule daily outfit reminder', error);
  }
}







