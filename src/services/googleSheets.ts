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
  electrical: 'เสา/สายไฟฟ้าชำรุด',
  landslide: 'ดินสไลด์/หินร่วง',
  flood: 'น้ำท่วมขัง/ทางขาด',
  road_damage: 'ถนนชำรุด/หลุมลึก',
  tree_fall: 'ต้นไม้ล้มขวางทาง',
  bridge_damage: 'สะพานชำรุด',
  signal_deadzone: 'จุดอับสัญญาณ',
  other: 'อื่นๆ',
};

const SEVERITY_NAMES: Record<RiskSeverity, string> = {
  critical: 'วิกฤต (อันตรายมาก)',
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
    for (const [key, val] of Object.entries(SEVERITY_NAMES)) {
      if (val === sevName || key === sevName) {
        severity = key as RiskSeverity;
        break;
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
