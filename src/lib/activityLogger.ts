import { db, doc, setDoc, getDocs, collection } from './db';
import { safeSetLocalStorage } from './storage';

export interface ActivityLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  category: 'course_modification' | 'wallet_transaction' | 'student_permissions' | 'system_change';
  action: string;
  description: string;
  targetId?: string;
  details?: Record<string, any>;
}

export async function logAdminActivity(
  adminEmail: string,
  category: 'course_modification' | 'wallet_transaction' | 'student_permissions' | 'system_change',
  action: string,
  description: string,
  targetId?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logItem: ActivityLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      adminEmail: adminEmail || 'mohammad.001ekram@gmail.com',
      category,
      action,
      description,
      targetId,
      details
    };
    
    // Write to DB
    await setDoc(doc(db, 'activity_logs', logId), logItem);

    // Save to local cache
    try {
      const logsRaw = localStorage.getItem('memorizer_activity_logs');
      const logs: ActivityLog[] = logsRaw ? JSON.parse(logsRaw) : [];
      logs.unshift(logItem);
      safeSetLocalStorage('memorizer_activity_logs', JSON.stringify(logs.slice(0, 100)));
    } catch (_) {}
  } catch (err) {
    console.warn('Failed to log admin activity:', err);
  }
}

export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  try {
    const snap = await getDocs(collection(db, 'activity_logs'));
    const logs: ActivityLog[] = snap.docs.map(d => d.data() as ActivityLog);
    logs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    if (logs.length > 0) {
      safeSetLocalStorage('memorizer_activity_logs', JSON.stringify(logs.slice(0, 100)));
      return logs;
    }
  } catch (err) {
    console.warn('Error fetching activity logs from DB:', err);
  }

  try {
    const logsRaw = localStorage.getItem('memorizer_activity_logs');
    if (logsRaw) {
      return JSON.parse(logsRaw);
    }
  } catch (_) {}

  return [];
}
