import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { api } from './api';

let cachedNotifications: typeof import('expo-notifications') | null = null;

function runningInExpoGo() {
  return Constants.appOwnership === 'expo';
}

async function getNotificationsModule() {
  if (runningInExpoGo()) return null;
  if (cachedNotifications) return cachedNotifications;
  cachedNotifications = await import('expo-notifications');
  return cachedNotifications;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice || runningInExpoGo()) return null;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    console.log('[notifications] Expo push token:', token);
    try { await api.setPushToken(token); } catch (e) { console.warn('[notifications] failed to send token to backend', e); }
    return token;
  } catch (e) {
    console.warn('[notifications] push registration error', e);
    return null;
  }
}

export async function scheduleLocalNotification(title: string, body: string, when: Date) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;
  const trigger = when instanceof Date ? when : new Date(when);
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: { type: 'date', timestamp: (trigger as Date).getTime() } as any,
    });
    return id;
  } catch (e) {
    console.warn('Erro ao agendar notification local', e);
    return null;
  }
}

export async function scheduleMedicationReminders(medications: any[]) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
  const now = new Date();
  for (const med of medications) {
    const times = (med.reminderTime || '').split(',').map((t: string) => t.trim()).filter(Boolean);
    for (const time of times) {
      const [hh, mm] = time.split(':').map(Number);
      if (Number.isNaN(hh)) continue;
      const next = new Date(now);
      next.setHours(hh, mm || 0, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      await scheduleLocalNotification('Lembrete de medicamento', `Tome ${med.name}`, next);
    }
  }
}

export async function scheduleAppointmentReminders(appointments: any[]) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  const now = new Date();
  for (const appt of appointments) {
    try {
      const when = new Date(appt.scheduled_at || appt.scheduledAt);
      const reminderAt = new Date(when.getTime() - 30 * 60 * 1000); // 30 minutos antes
      if (reminderAt.getTime() > Date.now()) {
        await scheduleLocalNotification('Lembrete de consulta', `${appt.specialty} com ${appt.doctor_name || appt.doctorName}`, reminderAt);
      }
    } catch (e) {
      console.warn('Erro ao agendar lembrete de consulta', e);
    }
  }
}

// Optional helper to display immediate local notification
export async function showLocalNow(title: string, body: string) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;
  try { return await Notifications.scheduleNotificationAsync({ content: { title, body, sound: 'default' }, trigger: { seconds: 1 } as any }); } catch (e) { console.warn(e); return null; }
}
