/**
 * Google Sheets API v4 Service
 * Handles batch syncing, spreadsheet initialization, and bidirectional caching.
 */

import { RiskPoint, RiskCategory, RiskSeverity, RiskStatus } from '../types';

export interface SheetCreationResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

const CATEGORY_NAMES: Record<RiskCategory, string> = {
  sharp_curve: 'โค้งอันตราย',
  steep_slope: 'ทางลาดชัน',
  no_lighting: 'ไม่มีไฟส่องสว่าง',
  accident_prone: 'มีอุบัติเหตุบ่อยครั้ง',
  electrical: 'เสา/สายไฟฟ้าชำรุด',
  flood: 'น้ำท่วมขัง/ทางขาด',
  road_damage: 'ถนนชำรุด/หลุมลึก',
  bridge_damage: 'สะพานชำรุด',
  signal_deadzone: 'จุดอับสัญญาณ',
  other: 'อื่นๆ',
};

const SEVERITY_NAMES: Record<RiskSeverity, string> = {
  high: 'สูง (อันตราย)',
  medium: 'ปานกลาง',
  low: 'ต่ำ/เฝ้าระวัง',
};

const STATUS_NAMES: Record<RiskStatus, string> = {
  pending_review: 'รอตรวจสอบ',
  approved: 'อนุมัติ/ยืนยันแล้ว',
  resolved: 'แก้ไขแล้ว',
  rejected: 'ไม่อนุมัติ',
};

export const SHEET_HEADERS = [
  'รหัสจุดเสี่ยง (ID)',
  'วัน-เวลาที่บันทึก (Timestamp)',
  'หัวข้อจุดเสี่ยง (Title)',
  'หมวดหมู่ (Category)',
  'ระดับความเสี่ยง (Severity)',
  'ละติจูด (Latitude)',
  'ลองจิจูด (Longitude)',
  'ความแม่นยำ GPS (m)',
  'สถานะการตรวจสอบ (Status)',
  'ผู้รายงาน (Reporter)',
  'บทบาท (Role)',
  'หน่วยงาน (Unit)',
  'รายละเอียด (Description)',
  'หมายเหตุผู้ดูแลระบบ (Notes)',
  'เวลาที่ซิงก์ข้อมูล (Synced At)',
];

/**
 * Creates a brand new Google Spreadsheet configured with headers and formatting
 */
export async function createRiskSpreadsheet(
  accessToken: string,
  title: string = 'GeoRisk_Field_Survey_Database'
): Promise<SheetCreationResult> {
  const requestBody = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: 'Risk_Points_Log',
          gridProperties: {
            frozenRowCount: 1,
            rowCount: 1000,
            columnCount: 15,
          },
        },
      },
    ],
  };

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`สร้าง Google Sheet ไม่สำเร็จ: ${errorText}`);
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl;

  // Insert Header Row
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Risk_Points_Log!A1:O1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [SHEET_HEADERS],
      }),
    }
  );

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
  };
}

/**
 * Batch appends risk points to Google Sheet
 */
export async function appendRiskPointsToSheet(
  accessToken: string,
  spreadsheetId: string,
  points: RiskPoint[],
  sheetTabName: string = 'Risk_Points_Log'
): Promise<{ updatedRows: number }> {
  if (points.length === 0) return { updatedRows: 0 };

  const now = new Date().toLocaleString('th-TH');

  const rows = points.map((p) => [
    p.id,
    new Date(p.createdAt).toLocaleString('th-TH'),
    p.title,
    CATEGORY_NAMES[p.category] || p.category,
    SEVERITY_NAMES[p.severity] || p.severity,
    p.lat,
    p.lng,
    p.accuracy,
    STATUS_NAMES[p.status] || p.status,
    p.reporterName,
    p.reporterRole,
    p.reporterUnit || '-',
    p.description,
    p.notes || '',
    now,
  ]);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    sheetTabName
  )}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: rows,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ส่งข้อมูลขึ้น Google Sheets ไม่สำเร็จ: ${errorText}`);
  }

  const result = await response.json();
  return { updatedRows: result.updates?.updatedRows || points.length };
}

/**
 * Fetches existing risk points from Google Sheet for offline pre-caching
 */
export async function fetchRiskPointsFromSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetTabName: string = 'Risk_Points_Log'
): Promise<RiskPoint[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    sheetTabName
  )}!A2:O`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ไม่สามารถอ่านข้อมูลจาก Google Sheet: ${errorText}`);
  }

  const data = await response.json();
  const rows = data.values as string[][] | undefined;
  if (!rows || rows.length === 0) return [];

  const parsedPoints: RiskPoint[] = [];

  rows.forEach((row, index) => {
    if (!row || row.length < 7) return;

    const [
      id,
      timestampStr,
      title,
      catName,
      sevName,
      latStr,
      lngStr,
      accStr,
      statusStr,
      reporterName,
      reporterRole,
      reporterUnit,
      description,
      notes,
    ] = row;

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng)) return;

    // Map back category
    let category: RiskCategory = 'other';
    for (const [key, val] of Object.entries(CATEGORY_NAMES)) {
      if (val === catName || key === catName) {
        category = key as RiskCategory;
        break;
      }
    }

    // Map back severity
    let severity: RiskSeverity = 'medium';
    if (sevName === 'วิกฤต' || sevName === 'critical') {
      severity = 'high';
    } else {
      for (const [key, val] of Object.entries(SEVERITY_NAMES)) {
        if (val === sevName || key === sevName) {
          severity = key as RiskSeverity;
          break;
        }
      }
    }

    // Map back status
    let status: RiskStatus = 'pending_review';
    for (const [key, val] of Object.entries(STATUS_NAMES)) {
      if (val === statusStr || key === statusStr) {
        status = key as RiskStatus;
        break;
      }
    }

    parsedPoints.push({
      id: id || `SHEET-ROW-${index + 2}`,
      title: title || 'จุดเสี่ยงจากฐานข้อมูลกลาง',
      category,
      severity,
      status,
      lat,
      lng,
      accuracy: parseFloat(accStr) || 5,
      reporterName: reporterName || 'เจ้าหน้าที่',
      reporterRole: (reporterRole as 'staff' | 'admin') || 'staff',
      reporterUnit: reporterUnit || '',
      description: description || '',
      notes: notes || '',
      createdAt: timestampStr ? new Date(timestampStr).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
      lastSyncedAt: new Date().toISOString(),
      sheetRowIndex: index + 2,
    });
  });

  return parsedPoints;
}

/**
 * Updates a specific row in the Google Sheet (e.g. status approval change)
 */
export async function updatePointStatusInSheet(
  accessToken: string,
  spreadsheetId: string,
  rowIndex: number,
  newStatus: RiskStatus,
  notes: string = '',
  sheetTabName: string = 'Risk_Points_Log'
): Promise<void> {
  const statusName = STATUS_NAMES[newStatus] || newStatus;
  const now = new Date().toLocaleString('th-TH');

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    sheetTabName
  )}!I${rowIndex}:O${rowIndex}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [[statusName, '', '', '', '', notes, now]],
    }),
  });

  if (!response.ok) {
    console.warn('Could not update status cell in Google Sheet:', await response.text());
  }
}

/**
 * Batch syncs risk points directly through Google Apps Script Web App Webhook
 * Allows completely keyless / OAuth-free field sync across all field staff devices.
 */
export async function syncPointsViaAppsScriptWebhook(
  webhookUrl: string,
  points: RiskPoint[]
): Promise<{ success: boolean; count: number; message: string }> {
  if (points.length === 0) {
    return { success: true, count: 0, message: 'ไม่มีข้อมูลที่ต้องซิงก์' };
  }

  try {
    const payload = {
      action: 'batch_sync',
      timestamp: new Date().toISOString(),
      points,
    };

    // Use text/plain to bypass CORS preflight blocking in browsers for Apps Script
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Apps Script ส่งกลับรหัสสถานะ ${response.status}`);
    }

    const resText = await response.text();
    let resData: { status?: string; message?: string; receivedCount?: number } = {};
    try {
      resData = JSON.parse(resText);
    } catch {
      // Handled if Apps Script returned raw confirmation
    }

    if (resData.status === 'error') {
      throw new Error(resData.message || 'Apps Script ตอบกลับสถานะล้มเหลว');
    }

    return {
      success: true,
      count: resData.receivedCount || points.length,
      message: `ส่งข้อมูล ${points.length} จุดขึ้น Google Sheets สำเร็จ`,
    };
  } catch (err: unknown) {
    console.error('Apps Script Webhook Sync error:', err);
    throw new Error(
      `ซิงก์ผ่าน Apps Script ไม่สำเร็จ: ${(err as Error).message || 'ข้อผิดพลาดเครือข่าย'}`
    );
  }
}

/**
 * Extracts clean Google Sheet ID from any URL or raw string
 */
export function extractSheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return trimmed;
}

/**
 * Normalizes raw row data from Google Sheets into a strongly-typed RiskPoint
 */
export function parseSheetRowToRiskPoint(row: any[], rowIndex: number): RiskPoint | null {
  if (!row || row.length < 7) return null;

  const [
    id,
    timestampStr,
    title,
    catName,
    sevName,
    latVal,
    lngVal,
    accVal,
    statusStr,
    reporterName,
    reporterRole,
    reporterUnit,
    description,
    notes,
  ] = row;

  const lat = typeof latVal === 'number' ? latVal : parseFloat(String(latVal).replace(/[^\d.-]/g, ''));
  const lng = typeof lngVal === 'number' ? lngVal : parseFloat(String(lngVal).replace(/[^\d.-]/g, ''));

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

  // Map category back
  let category: RiskCategory = 'other';
  const cStr = String(catName || '').trim();
  for (const [key, val] of Object.entries(CATEGORY_NAMES)) {
    if (val === cStr || key === cStr) {
      category = key as RiskCategory;
      break;
    }
  }

  // Map severity back
  let severity: RiskSeverity = 'medium';
  const sStr = String(sevName || '').trim().toLowerCase();
  if (sStr === 'high' || sStr === 'สูง' || sStr === 'วิกฤต' || sStr === 'critical' || sStr.includes('อันตราย')) {
    severity = 'high';
  } else if (sStr === 'low' || sStr === 'ต่ำ' || sStr.includes('เฝ้าระวัง')) {
    severity = 'low';
  } else {
    severity = 'medium';
  }

  // Map status back
  let status: RiskStatus = 'approved';
  const stStr = String(statusStr || '').trim();
  for (const [key, val] of Object.entries(STATUS_NAMES)) {
    if (val === stStr || key === stStr) {
      status = key as RiskStatus;
      break;
    }
  }

  return {
    id: String(id || `ROW-${rowIndex}`),
    title: String(title || 'จุดเสี่ยงจาก Google Sheets'),
    category,
    severity,
    status,
    lat,
    lng,
    accuracy: Number(accVal) || 5,
    reporterName: String(reporterName || 'ระบบส่วนกลาง'),
    reporterRole: (reporterRole as 'staff' | 'admin') || 'staff',
    reporterUnit: String(reporterUnit || '-'),
    description: String(description || ''),
    notes: String(notes || ''),
    createdAt: timestampStr ? new Date(timestampStr).toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: 'synced',
    lastSyncedAt: new Date().toISOString(),
    sheetRowIndex: rowIndex,
  };
}

/**
 * Fetches existing risk points from Google Sheets via Apps Script Webhook (GET request)
 * Detects if the Apps Script deployment needs a new version published.
 */
export async function fetchRiskPointsFromAppsScript(
  appsScriptUrl: string
): Promise<{ success: boolean; points: RiskPoint[]; message: string; isOldVersion?: boolean }> {
  if (!appsScriptUrl || !appsScriptUrl.trim()) {
    return { success: false, points: [], message: 'ไม่มี URL ของ Apps Script' };
  }

  try {
    const url = appsScriptUrl.includes('?')
      ? `${appsScriptUrl}&action=get_points&_t=${Date.now()}`
      : `${appsScriptUrl}?action=get_points&_t=${Date.now()}`;

    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      return { success: false, points: [], message: `Apps Script ตอบกลับ HTTP ${response.status}` };
    }

    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, points: [], message: 'รูปแบบการตอบกลับไม่ใช่ JSON ที่ถูกต้อง' };
    }

    // Check if the script is still running v1 code that doesn't have the action handler
    if (data.service === 'GeoRisk Field Ops Webhook' && !Array.isArray(data.points)) {
      return {
        success: false,
        points: [],
        isOldVersion: true,
        message: 'พบ Webhook แต่สคริปต์ยังเป็นเวอร์ชันเดิม (กรุณากด Deploy > Manage deployments > Edit > New version)',
      };
    }

    if (data.status === 'success' && Array.isArray(data.points)) {
      const parsed: RiskPoint[] = data.points
        .map((p: any, idx: number) => {
          let category: RiskCategory = p.category || 'other';
          if ((category as string) === 'tree_fall') category = 'other';
          if ((category as string) === 'landslide') category = 'road_damage';

          let severity: RiskSeverity = 'medium';
          if (p.severity === 'high' || p.severity === 'critical') severity = 'high';
          else if (p.severity === 'low') severity = 'low';
          else severity = 'medium';

          return {
            id: String(p.id || `SYNC-${Date.now()}-${idx}`),
            title: String(p.title || 'จุดเสี่ยงจาก Google Sheets'),
            category,
            severity,
            status: (p.status as RiskStatus) || 'approved',
            lat: Number(p.lat),
            lng: Number(p.lng),
            accuracy: Number(p.accuracy) || 5,
            reporterName: String(p.reporterName || 'ระบบส่วนกลาง'),
            reporterRole: (p.reporterRole as 'staff' | 'admin') || 'admin',
            reporterUnit: String(p.reporterUnit || ''),
            description: String(p.description || ''),
            notes: String(p.notes || ''),
            createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncStatus: 'synced' as const,
            lastSyncedAt: new Date().toISOString(),
          };
        })
        .filter((p: RiskPoint) => !isNaN(p.lat) && !isNaN(p.lng) && p.lat !== 0 && p.lng !== 0);

      return {
        success: true,
        points: parsed,
        message: `ดึงข้อมูลจาก Apps Script สำเร็จ (${parsed.length} จุด)`,
      };
    }

    return { success: false, points: [], message: data.message || 'ไม่มีข้อมูลจุดเสี่ยงใน Google Sheets' };
  } catch (err: unknown) {
    console.warn('Auto-fetch points from Apps Script failed:', err);
    return {
      success: false,
      points: [],
      message: `เชื่อมต่อ Apps Script ไม่สำเร็จ: ${(err as Error).message || 'ข้อผิดพลาดเครือข่าย'}`,
    };
  }
}

/**
 * Direct fetch from a public Google Sheet without OAuth using Google Visualization API or CSV
 * Ensures 100% instant sync across devices even without Apps Script update!
 */
export async function fetchRiskPointsFromPublicSheet(
  sheetIdOrUrl: string
): Promise<{ success: boolean; points: RiskPoint[]; message: string }> {
  const sheetId = extractSheetId(sheetIdOrUrl);
  if (!sheetId) {
    return { success: false, points: [], message: 'ระบุ Google Sheet ID หรือ Link ไม่ถูกต้อง' };
  }

  // 1. Try Google Visualization API (GViz)
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&_t=${Date.now()}`;
    const res = await fetch(gvizUrl);
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      if (match && match[1]) {
        const json = JSON.parse(match[1]);
        const rows = json.table?.rows || [];
        const parsedPoints: RiskPoint[] = [];

        rows.forEach((r: any, idx: number) => {
          if (!r.c) return;
          const cells = r.c.map((cell: any) => (cell ? cell.v ?? cell.f ?? '' : ''));
          const point = parseSheetRowToRiskPoint(cells, idx + 2);
          if (point) parsedPoints.push(point);
        });

        if (parsedPoints.length > 0) {
          return {
            success: true,
            points: parsedPoints,
            message: `ดึงข้อมูลจาก Google Sheets สำเร็จ (${parsedPoints.length} จุด)`,
          };
        }
      }
    }
  } catch (gvizErr) {
    console.warn('GViz fetch failed, trying CSV export:', gvizErr);
  }

  // 2. Try CSV export fallback
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&_t=${Date.now()}`;
    const res = await fetch(csvUrl);
    if (res.ok) {
      const csvText = await res.text();
      const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 1) {
        // Skip header row
        const parsedPoints: RiskPoint[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCsvLine(lines[i]);
          const point = parseSheetRowToRiskPoint(cells, i + 1);
          if (point) parsedPoints.push(point);
        }

        if (parsedPoints.length > 0) {
          return {
            success: true,
            points: parsedPoints,
            message: `ดึงข้อมูลผ่าน CSV สำเร็จ (${parsedPoints.length} จุด)`,
          };
        }
      }
    }
  } catch (csvErr) {
    console.warn('CSV export fetch failed:', csvErr);
  }

  return {
    success: false,
    points: [],
    message: 'ไม่สามารถอ่าน Google Sheet ได้ กรุณาตรวจสอบว่าแชร์เป็น "ทุกคนที่มีลิงก์ดูได้"',
  };
}

/**
 * Robust CSV Line Parser that respects quoted fields containing commas
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

