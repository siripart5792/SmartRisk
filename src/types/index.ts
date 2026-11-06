/**
 * Data contracts and type definitions for GeoRisk Field Ops
 */

export type RiskSeverity = 'high' | 'medium' | 'low';

export type RiskCategory =
  | 'sharp_curve'       // โค้งอันตราย
  | 'steep_slope'       // ทางลาดชัน
  | 'no_lighting'       // ไม่มีไฟส่องสว่าง
  | 'accident_prone'    // มีอุบัติเหตุบ่อยครั้ง
  | 'electrical'        // เสา/สายไฟฟ้าชำรุด
  | 'flood'             // น้ำท่วมทาง/ทางขาด
  | 'road_damage'       // ถนนชำรุด/หลุมลึก
  | 'bridge_damage'     // สะพานชำรุด
  | 'signal_deadzone'   // จุดอับสัญญาณ
  | 'other';            // อื่นๆ

export type RiskStatus = 'pending_review' | 'approved' | 'resolved' | 'rejected';

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed';

export type UserRole = 'staff' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  unit: string;
}

export interface RiskPoint {
  id: string;
  title: string;
  category: RiskCategory;
  severity: RiskSeverity;
  status: RiskStatus;
  lat: number;
  lng: number;
  accuracy: number;     // เมตร
  altitude?: number;    // เมตร
  reporterName: string;
  reporterRole: UserRole;
  reporterUnit: string;
  description: string;
  notes?: string;
  createdAt: string;    // ISO string
  updatedAt: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  sheetRowIndex?: number;
}

export interface GPSPosition {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  timestamp: number;
}

export interface GeofenceAlert {
  point: RiskPoint;
  distance: number; // เมตร
  acknowledged: boolean;
  timestamp: number;
}

export interface AppSettings {
  googleSheetId: string;
  googleSheetName: string;
  appsScriptUrl: string;
  syncMethod: 'apps_script' | 'google_oauth';
  adminPin: string;             // รหัส PIN สำหรับสิทธิ์ Admin (เก็บและซิงก์กับ Google Sheets)
  alertRadiusMeters: number;    // e.g. 150m
  soundAlertEnabled: boolean;
  vibrationEnabled: boolean;
  simulatedOffline: boolean;
  autoSyncOnOnline: boolean;
  lastSuccessfulSync?: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  count: number;
  status: 'success' | 'failed';
  message: string;
}
