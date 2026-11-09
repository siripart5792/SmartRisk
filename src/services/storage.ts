/**
 * Offline-First IndexedDB and LocalStorage Service
 * Ensures 100% resilient offline data persistence and automatic synchronization queue.
 */

import { RiskPoint, RiskCategory, RiskSeverity, RiskStatus, AppSettings, UserProfile, SyncLog } from '../types';
import { normalizeRiskStatus } from './googleSheets';

const DB_NAME = 'GeoRiskFieldOps_DB';
const DB_VERSION = 1;
const STORE_POINTS = 'risk_points';
const STORE_PENDING = 'pending_sync_queue';
const STORE_LOGS = 'sync_logs';

// Default initial settings
export const DEFAULT_SETTINGS: AppSettings = {
  googleSheetId: '',
  googleSheetName: 'GeoRisk_Field_Survey_Data',
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwBAB992j_bL2VARLUeUegNCwWIqg6fli4ipdLik1rOKVSEwAK2X6Xi1gnkDuwxv07lCQ/exec',
  syncMethod: 'apps_script',
  adminPin: '9999',
  alertRadiusMeters: 200,
  soundAlertEnabled: true,
  vibrationEnabled: true,
  simulatedOffline: false,
  autoSyncOnOnline: true,
};

// Initial realistic field risk points (Route 1095 / Northern Mountain Route Survey)
export const SEED_RISK_POINTS: RiskPoint[] = [
  {
    id: 'RISK-TH-001',
    title: 'ทางโค้งหักศอกรัศมีแคบ บดบังทัศนวิสัย',
    category: 'sharp_curve',
    severity: 'high',
    status: 'approved',
    lat: 18.7904,
    lng: 98.9853,
    accuracy: 3.5,
    reporterName: 'นายสิริภาส (PEA)',
    reporterRole: 'admin',
    reporterUnit: 'ทีมสำรวจสายส่งและระบบจำหน่าย',
    description: 'ทางโค้งหักศอกรูปตัวเอส ไม่มีกระจกโค้งส่องทาง รถสวนทางมองไม่เห็น เสี่ยงหลุดโค้งชนเสาไฟ',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    syncStatus: 'synced',
    lastSyncedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'RISK-TH-002',
    title: 'ทางลาดชันเขาลาดเอียงเกิน 12% ผิวทางลื่น',
    category: 'steep_slope',
    severity: 'high',
    status: 'approved',
    lat: 18.7980,
    lng: 98.9750,
    accuracy: 4.2,
    reporterName: 'สมชาย ประจำการ',
    reporterRole: 'staff',
    reporterUnit: 'ทีมช่างภาคสนามเขต 1',
    description: 'ทางลงเขาลาดชันต่อเนื่องยาว 800 เมตร มีคราบน้ำมันและดินทราย รถบรรทุกหนักเบรกไหม้บ่อย',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    syncStatus: 'synced',
    lastSyncedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'RISK-TH-003',
    title: 'ช่วงทางมืดสนิท ไม่มีไฟส่องสว่างสาธารณะ',
    category: 'no_lighting',
    severity: 'medium',
    status: 'pending_review',
    lat: 18.8050,
    lng: 98.9920,
    accuracy: 2.8,
    reporterName: 'อนุชา ภาคสนาม',
    reporterRole: 'staff',
    reporterUnit: 'ทีมสำรวจเส้นทางฉุกเฉิน',
    description: 'ถนนไม่มีโคมไฟถนนสาธารณะระยะทาง 1.5 กม. ในเวลากลางคืนมืดสนิท มีคนข้ามถนนเสี่ยงถูกชน',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    syncStatus: 'pending',
  },
  {
    id: 'RISK-TH-004',
    title: 'จุดทางแยกอันตราย เกิดอุบัติเหตุบ่อยครั้ง',
    category: 'accident_prone',
    severity: 'high',
    status: 'approved',
    lat: 18.7830,
    lng: 98.9700,
    accuracy: 6.0,
    reporterName: 'นิติ วงศ์ษา',
    reporterRole: 'staff',
    reporterUnit: 'ฝ่ายเทคโนโลยีการสื่อสาร',
    description: 'ทางแยกเชื่อมถนนสายรองตัดสายหลัก ไม่มีสัญญาณไฟชะลอความเร็ว เกิดอุบัติเหตุชนท้ายและชนด้านข้างซ้ำซ้อน',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    syncStatus: 'synced',
    lastSyncedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'RISK-TH-005',
    title: 'เสาไฟฟ้าเอียงใกล้สายไฟแรงสูงพาดข้ามทาง',
    category: 'electrical',
    severity: 'high',
    status: 'approved',
    lat: 18.7750,
    lng: 98.9880,
    accuracy: 3.1,
    reporterName: 'ชัยพร สายตรวจ',
    reporterRole: 'staff',
    reporterUnit: 'หน่วยบรรเทาสาธารณภัย',
    description: 'เสาคอนกรีต 12 เมตร โคนเสาถูกน้ำกัดเซาะ เสาเอียงประมาณ 15 องศา เสี่ยงล้มทับผิวจราจร',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    syncStatus: 'synced',
    lastSyncedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  }
];

class StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private changeListeners: Set<() => void> = new Set();

  constructor() {
    this.initDatabase();
  }

  private initDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not supported, falling back to LocalStorage');
        resolve(null as unknown as IDBDatabase);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_POINTS)) {
          db.createObjectStore(STORE_POINTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PENDING)) {
          db.createObjectStore(STORE_PENDING, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_LOGS)) {
          db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        resolve(null as unknown as IDBDatabase);
      };
    });

    return this.dbPromise;
  }

  public subscribe(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notify() {
    this.changeListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }

  // --- DATA SANITIZATION & MIGRATION HELPER ---
  public sanitizePoint(raw: any): RiskPoint {
    if (!raw) {
      return {
        id: 'PT-' + Date.now(),
        title: 'จุดเสี่ยง',
        category: 'other',
        severity: 'high',
        status: 'pending_review',
        lat: 18.7904,
        lng: 98.9853,
        accuracy: 10,
        reporterName: 'เจ้าหน้าที่',
        reporterRole: 'staff',
        reporterUnit: 'หน่วยปฏิบัติการภาคสนาม',
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      };
    }

    // Map legacy 'critical' or invalid severity to 'high'
    let severity: RiskSeverity = 'medium';
    if (raw.severity === 'high' || raw.severity === 'critical') {
      severity = 'high';
    } else if (raw.severity === 'low') {
      severity = 'low';
    } else if (raw.severity === 'medium') {
      severity = 'medium';
    } else {
      severity = 'high';
    }

    // Map removed categories to current valid categories
    let category: RiskCategory = raw.category || 'other';
    if ((category as string) === 'tree_fall') category = 'other';
    if ((category as string) === 'landslide') category = 'road_damage';

    // Normalize status from Google Sheets / cache to ensure approved status matches correctly
    const status: RiskStatus = normalizeRiskStatus(raw.status);

    const lat = typeof raw.lat === 'number' && !isNaN(raw.lat) ? raw.lat : 18.7904;
    const lng = typeof raw.lng === 'number' && !isNaN(raw.lng) ? raw.lng : 98.9853;

    return {
      ...raw,
      severity,
      category,
      status,
      lat,
      lng,
    };
  }

  // --- RISK POINTS CRUD ---

  public async getAllRiskPoints(): Promise<RiskPoint[]> {
    const db = await this.initDatabase();
    if (!db) {
      const raw = localStorage.getItem(STORE_POINTS);
      if (!raw) {
        this.saveToLocalStorage(STORE_POINTS, SEED_RISK_POINTS);
        return SEED_RISK_POINTS;
      }
      try {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : [];
        return list.map((p: any) => this.sanitizePoint(p));
      } catch {
        return SEED_RISK_POINTS;
      }
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_POINTS, 'readonly');
      const store = tx.objectStore(STORE_POINTS);
      const req = store.getAll();

      req.onsuccess = () => {
        const points = (req.result as any[]) || [];
        if (points.length === 0) {
          // Pre-seed initial points
          this.batchSaveRiskPoints(SEED_RISK_POINTS).then(() => resolve(SEED_RISK_POINTS));
        } else {
          let hasLegacyData = false;
          const sanitized = points.map((p) => {
            if (p.severity === 'critical' || p.category === 'tree_fall' || p.category === 'landslide') {
              hasLegacyData = true;
            }
            return this.sanitizePoint(p);
          });

          // Silently upgrade store in background if legacy data existed
          if (hasLegacyData) {
            this.batchSaveRiskPoints(sanitized).catch(() => {});
          }

          resolve(sanitized);
        }
      };

      req.onerror = () => {
        resolve(SEED_RISK_POINTS);
      };
    });
  }

  public async getRiskPointById(id: string): Promise<RiskPoint | null> {
    const points = await this.getAllRiskPoints();
    return points.find((p) => p.id === id) || null;
  }

  public async saveRiskPoint(point: RiskPoint, markPendingSync: boolean = true): Promise<void> {
    const db = await this.initDatabase();
    const updatedPoint: RiskPoint = {
      ...point,
      updatedAt: new Date().toISOString(),
      syncStatus: markPendingSync ? 'pending' : point.syncStatus,
    };

    if (!db) {
      const points = await this.getAllRiskPoints();
      const idx = points.findIndex((p) => p.id === point.id);
      if (idx >= 0) points[idx] = updatedPoint;
      else points.unshift(updatedPoint);
      this.saveToLocalStorage(STORE_POINTS, points);

      if (markPendingSync) {
        const pending = this.getLocalStorage<RiskPoint[]>(STORE_PENDING, []);
        const pIdx = pending.findIndex((p) => p.id === point.id);
        if (pIdx >= 0) pending[pIdx] = updatedPoint;
        else pending.push(updatedPoint);
        this.saveToLocalStorage(STORE_PENDING, pending);
      }
      this.notify();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_POINTS, STORE_PENDING], 'readwrite');
      const store = tx.objectStore(STORE_POINTS);
      store.put(updatedPoint);

      if (markPendingSync) {
        const pendingStore = tx.objectStore(STORE_PENDING);
        pendingStore.put(updatedPoint);
      }

      tx.oncomplete = () => {
        this.notify();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  public async batchSaveRiskPoints(points: RiskPoint[]): Promise<void> {
    const db = await this.initDatabase();
    if (!db) {
      this.saveToLocalStorage(STORE_POINTS, points);
      this.notify();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_POINTS, 'readwrite');
      const store = tx.objectStore(STORE_POINTS);
      points.forEach((p) => store.put(p));
      tx.oncomplete = () => {
        this.notify();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Synchronizes central points from Google Sheets:
   * - Sets central points as authoritative
   * - Automatically purges hardcoded SEED mock points (RISK-TH-) if real central data exists
   * - Safely retains un-synced points that were created locally on this device
   */
  public async replaceWithCentralPoints(centralPoints: RiskPoint[]): Promise<RiskPoint[]> {
    if (!centralPoints || centralPoints.length === 0) {
      return this.getAllRiskPoints();
    }

    const db = await this.initDatabase();
    const pending = await this.getPendingSyncQueue();
    const pendingMap = new Map(pending.map((p) => [p.id, p]));

    const mergedMap = new Map<string, RiskPoint>();

    // 1. Add all authoritative points from Google Sheets
    centralPoints.forEach((p) => {
      const sanitized = this.sanitizePoint(p);
      if (pendingMap.has(p.id)) {
        mergedMap.set(p.id, pendingMap.get(p.id)!);
      } else {
        mergedMap.set(p.id, { ...sanitized, syncStatus: 'synced' });
      }
    });

    // 2. Add local pending points that haven't been pushed to Google Sheets yet
    pending.forEach((p) => {
      if (!mergedMap.has(p.id)) {
        mergedMap.set(p.id, p);
      }
    });

    const finalPoints = Array.from(mergedMap.values());

    if (!db) {
      this.saveToLocalStorage(STORE_POINTS, finalPoints);
      this.notify();
      return finalPoints;
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_POINTS, 'readwrite');
      const store = tx.objectStore(STORE_POINTS);
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        finalPoints.forEach((p) => store.put(p));
      };
      tx.oncomplete = () => {
        this.notify();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });

    return finalPoints;
  }

  public async deleteRiskPoint(id: string): Promise<void> {
    const db = await this.initDatabase();
    if (!db) {
      const points = (await this.getAllRiskPoints()).filter((p) => p.id !== id);
      this.saveToLocalStorage(STORE_POINTS, points);
      const pending = this.getLocalStorage<RiskPoint[]>(STORE_PENDING, []).filter((p) => p.id !== id);
      this.saveToLocalStorage(STORE_PENDING, pending);
      this.notify();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_POINTS, STORE_PENDING], 'readwrite');
      tx.objectStore(STORE_POINTS).delete(id);
      tx.objectStore(STORE_PENDING).delete(id);
      tx.oncomplete = () => {
        this.notify();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- PENDING SYNC QUEUE ---

  public async getPendingSyncQueue(): Promise<RiskPoint[]> {
    const db = await this.initDatabase();
    if (!db) {
      return this.getLocalStorage<RiskPoint[]>(STORE_PENDING, []);
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PENDING, 'readonly');
      const store = tx.objectStore(STORE_PENDING);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as RiskPoint[]);
      req.onerror = () => resolve([]);
    });
  }

  public async removePendingSyncItem(id: string): Promise<void> {
    const db = await this.initDatabase();
    if (!db) {
      const pending = this.getLocalStorage<RiskPoint[]>(STORE_PENDING, []).filter((p) => p.id !== id);
      this.saveToLocalStorage(STORE_PENDING, pending);
      this.notify();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readwrite');
      tx.objectStore(STORE_PENDING).delete(id);
      tx.oncomplete = () => {
        this.notify();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  public async markPointsAsSynced(syncedIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    const db = await this.initDatabase();

    if (!db) {
      const points = await this.getAllRiskPoints();
      points.forEach((p) => {
        if (syncedIds.includes(p.id)) {
          p.syncStatus = 'synced';
          p.lastSyncedAt = now;
        }
      });
      this.saveToLocalStorage(STORE_POINTS, points);

      const pending = this.getLocalStorage<RiskPoint[]>(STORE_PENDING, []).filter(
        (p) => !syncedIds.includes(p.id)
      );
      this.saveToLocalStorage(STORE_PENDING, pending);
      this.notify();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_POINTS, STORE_PENDING], 'readwrite');
      const pStore = tx.objectStore(STORE_POINTS);
      const qStore = tx.objectStore(STORE_PENDING);

      syncedIds.forEach((id) => {
        const getReq = pStore.get(id);
        getReq.onsuccess = () => {
          if (getReq.result) {
            const updated = {
              ...getReq.result,
              syncStatus: 'synced' as const,
              lastSyncedAt: now,
            };
            pStore.put(updated);
          }
        };
        qStore.delete(id);
      });

      tx.oncomplete = () => {
        this.notify();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- APP SETTINGS & USER PROFILE ---

  public getSettings(): AppSettings {
    const s = this.getLocalStorage<AppSettings>('app_settings', DEFAULT_SETTINGS);
    if (!s.appsScriptUrl) {
      s.appsScriptUrl = DEFAULT_SETTINGS.appsScriptUrl;
    }
    if (!s.syncMethod) {
      s.syncMethod = 'apps_script';
    }
    if (!s.adminPin) {
      s.adminPin = DEFAULT_SETTINGS.adminPin;
    }
    // Ensure fresh app session always starts in normal mode (never trapped in simulated offline)
    s.simulatedOffline = false;
    return s;
  }

  public saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    this.saveToLocalStorage('app_settings', updated);
    this.notify();
    return updated;
  }

  public getUserProfile(): UserProfile {
    return this.getLocalStorage<UserProfile>('user_profile', {
      id: 'USR-8821',
      name: 'นายสิริภาส (PEA)',
      role: 'staff',
      email: 'computerpea2564@gmail.com',
      unit: 'ทีมปฏิบัติการและสำรวจภาคสนาม',
    });
  }

  public saveUserProfile(profile: Partial<UserProfile>): UserProfile {
    const current = this.getUserProfile();
    const updated = { ...current, ...profile };
    this.saveToLocalStorage('user_profile', updated);
    this.notify();
    return updated;
  }

  // --- SYNC LOGS ---

  public async addSyncLog(log: Omit<SyncLog, 'id' | 'timestamp'>): Promise<void> {
    const fullLog: SyncLog = {
      ...log,
      id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    const db = await this.initDatabase();
    if (!db) {
      const logs = this.getLocalStorage<SyncLog[]>(STORE_LOGS, []);
      logs.unshift(fullLog);
      this.saveToLocalStorage(STORE_LOGS, logs.slice(0, 50));
      return;
    }

    const tx = db.transaction(STORE_LOGS, 'readwrite');
    tx.objectStore(STORE_LOGS).put(fullLog);
  }

  public async getSyncLogs(): Promise<SyncLog[]> {
    const db = await this.initDatabase();
    if (!db) {
      return this.getLocalStorage<SyncLog[]>(STORE_LOGS, []);
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_LOGS, 'readonly');
      const req = tx.objectStore(STORE_LOGS).getAll();
      req.onsuccess = () => {
        const logs = req.result as SyncLog[];
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(logs.slice(0, 50));
      };
      req.onerror = () => resolve([]);
    });
  }

  // Helpers
  private getLocalStorage<T>(key: string, defaultValue: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private saveToLocalStorage(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  }
}

export const storageService = new StorageService();
