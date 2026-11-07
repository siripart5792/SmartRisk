import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Code,
  Copy,
  Check,
  DownloadCloud,
  UploadCloud,
  Globe,
  Radio,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { User } from 'firebase/auth';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSignInGoogle: () => Promise<void>;
  onSignOutGoogle: () => Promise<void>;
  sheetId: string;
  onSaveSheetId: (id: string) => void;
  appsScriptUrl: string;
  onSaveAppsScriptUrl: (url: string) => void;
  syncMethod: 'apps_script' | 'google_oauth';
  onSaveSyncMethod: (method: 'apps_script' | 'google_oauth') => void;
  onCreateNewSheet: () => Promise<void>;
  onBatchSyncNow: () => Promise<void>;
  onPrecacheFromSheet: () => Promise<void>;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt?: string;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSignInGoogle,
  onSignOutGoogle,
  sheetId,
  onSaveSheetId,
  appsScriptUrl,
  onSaveAppsScriptUrl,
  syncMethod,
  onSaveSyncMethod,
  onCreateNewSheet,
  onBatchSyncNow,
  onPrecacheFromSheet,
  pendingCount,
  isSyncing,
  lastSyncedAt,
}) => {
  const [activeTab, setActiveTab] = useState<'sync' | 'apps_script'>('sync');
  const [inputUrl, setInputUrl] = useState(appsScriptUrl);
  const [inputSheetId, setInputSheetId] = useState(sheetId);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveWebhookUrl = () => {
    if (!inputUrl.trim()) return;
    onSaveAppsScriptUrl(inputUrl.trim());
    setActionMessage('บันทึก Apps Script Webhook เป็นค่าหลักของระบบเรียบร้อย');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleSheetIdSave = () => {
    let cleanId = inputSheetId.trim();
    const match = cleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      cleanId = match[1];
    }
    onSaveSheetId(cleanId);
    setActionMessage('บันทึก Sheet ID เรียบร้อยแล้ว');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const appsScriptCode = `/**
 * Google Apps Script - Field Risk Assessment & Admin Security Sync
 * จัดเก็บข้อมูลจุดเสี่ยง และรหัส PIN ผู้ดูแลระบบ (Admin PIN) ไว้ใน Google Sheets
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. ตรวจสอบและบันทึกรหัส PIN ผู้ดูแลระบบ (Admin PIN)
    if (payload.action === "set_admin_pin") {
      var configSheet = ss.getSheetByName("Admin_Config");
      if (!configSheet) {
        configSheet = ss.insertSheet("Admin_Config");
        configSheet.appendRow(["Config_Key", "Config_Value", "Updated_At"]);
        configSheet.getRange(1, 1, 1, 3).setBackground("#581c87").setFontColor("#ffffff").setFontWeight("bold");
      }
      var newPin = String(payload.adminPin || "9999");
      if (configSheet.getLastRow() <= 1) {
        configSheet.appendRow(["admin_pin", newPin, new Date().toLocaleString("th-TH")]);
      } else {
        configSheet.getRange(2, 2).setValue(newPin);
        configSheet.getRange(2, 3).setValue(new Date().toLocaleString("th-TH"));
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "บันทึกรหัส PIN ผู้ดูแลระบบลง Google Sheets เรียบร้อยแล้ว"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. รองรับการดึงข้อมูลผ่าน POST
    if (payload.action === "get_points" || payload.action === "fetch_points") {
      return getPointsOutput(ss);
    }

    // 3. จัดการรับข้อมูลจุดเสี่ยงแบบ Batch Sync
    var points = payload.points || [];
    var sheet = ss.getSheetByName("Risk_Points_Log") || ss.getActiveSheet();

    // หากยังไม่มี Header ให้สร้างแถวแรก
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "รหัสจุดเสี่ยง (ID)", "วัน-เวลาที่บันทึก", "หัวข้อจุดเสี่ยง", "หมวดหมู่", 
        "ระดับความรุนแรง", "ละติจูด (Lat)", "ลองจิจูด (Lng)", "ความแม่นยำ (m)", "สถานะ", 
        "ผู้รายงาน", "สิทธิ์", "หน่วยงาน", "รายละเอียด", "หมายเหตุ", "เวลาที่ซิงก์"
      ]);
      sheet.getRange(1, 1, 1, 15).setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    var now = new Date();
    points.forEach(function(p) {
      sheet.appendRow([
        p.id,
        p.createdAt,
        p.title,
        p.category,
        p.severity,
        p.lat,
        p.lng,
        p.accuracy,
        p.status || "pending_review",
        p.reporterName,
        p.reporterRole,
        p.reporterUnit || "-",
        p.description,
        p.notes || "",
        now.toLocaleString("th-TH")
      ]);
    });

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      receivedCount: points.length,
      syncedAt: now.toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. ดึงรหัส PIN ของ Admin
  if (action === "get_admin_pin") {
    var configSheet = ss.getSheetByName("Admin_Config");
    var pin = "9999";
    if (configSheet && configSheet.getLastRow() >= 2) {
      pin = String(configSheet.getRange(2, 2).getValue() || "9999");
    }
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      adminPin: pin
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 2. ดึงข้อมูลจุดเสี่ยงทั้งหมดจาก Google Sheets มาแสดงผลในแผนที่
  if (action === "get_points" || action === "fetch_points") {
    return getPointsOutput(ss);
  }

  return ContentService.createTextOutput(JSON.stringify({
    service: "GeoRisk Field Ops Webhook",
    status: "active",
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function getPointsOutput(ss) {
  var sheet = ss.getSheetByName("Risk_Points_Log") || ss.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      points: []
    })).setMimeType(ContentService.MimeType.JSON);
  }
  var rows = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
  var points = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r[0] || r[2]) {
      points.push({
        id: String(r[0] || ("ROW-" + (i + 2))),
        createdAt: r[1] ? new Date(r[1]).toISOString() : new Date().toISOString(),
        title: String(r[2] || "จุดเสี่ยง"),
        category: String(r[3] || "other"),
        severity: String(r[4] || "high"),
        lat: Number(r[5]) || 0,
        lng: Number(r[6]) || 0,
        accuracy: Number(r[7]) || 5,
        status: String(r[8] || "pending_review"),
        reporterName: String(r[9] || "เจ้าหน้าที่"),
        reporterRole: String(r[10] || "staff"),
        reporterUnit: String(r[11] || "-"),
        description: String(r[12] || ""),
        notes: String(r[13] || ""),
        syncStatus: "synced",
        lastSyncedAt: new Date().toISOString()
      });
    }
  }
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    points: points
  })).setMimeType(ContentService.MimeType.JSON);
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-white">การเชื่อมต่อ Google Sheets</h2>
              <p className="text-[11px] text-slate-400">ระบบซิงก์ข้อมูลจุดเสี่ยงระหว่างอุปกรณ์ภาคสนาม</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex-1 py-2.5 font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'sync'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            การซิงก์ข้อมูล (Sync Management)
          </button>
          <button
            onClick={() => setActiveTab('apps_script')}
            className={`flex-1 py-2.5 font-semibold text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'apps_script'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>ซอร์สโค้ดและวิธีอัปเดต Apps Script</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {actionMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{actionMessage}</span>
            </div>
          )}

          {activeTab === 'sync' ? (
            <>
              {/* INSTANT PULL ACTION BUTTON */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-950 border border-emerald-700/60 shadow-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <DownloadCloud className="w-4 h-4 text-emerald-400" />
                    ดึงข้อมูลจุดเสี่ยงจาก Google Sheets แสดงบนแผนที่
                  </span>
                  <span className="text-[10px] text-slate-400">ซิงก์ทุกเครื่องตรงกัน</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  กดปุ่มนี้เพื่อดึงจุดเสี่ยงทั้งหมดจากฐานข้อมูลกลาง Google Sheets มาแสดงผลบนแผนที่และรายการทันที
                </p>
                <button
                  onClick={onPrecacheFromSheet}
                  disabled={isSyncing}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-emerald-950 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>
                    {isSyncing ? 'กำลังดึงข้อมูลจาก Google Sheets...' : 'ดึงข้อมูลจุดเสี่ยงจาก Google Sheets ทันที'}
                  </span>
                </button>
              </div>

              {/* PRIMARY SYNC ENDPOINT: Google Apps Script Webhook */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Apps Script Webhook (ค่าหลักของระบบ)
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    พร้อมใช้งาน
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  จุดเชื่อมต่อ Webhook สำหรับรับ-ส่งข้อมูลจุดเสี่ยงแบบสองทางกับ Google Sheets โดยตรง:
                </p>

                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 select-all"
                    />
                    <button
                      onClick={handleSaveWebhookUrl}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0"
                    >
                      บันทึก
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(inputUrl);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shrink-0"
                      title="คัดลอก URL"
                    >
                      {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Google Sheet Link / ID (Universal cross-device sync) */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-slate-200">
                      ลิงก์หรือรหัส Google Sheet (วางลิงก์ได้ทันที)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">ดึงข้ามเครื่องได้ทันที</span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  สามารถคัดลอก URL ของ Google Sheet (เช่น https://docs.google.com/spreadsheets/d/...) หรือ Sheet ID มาวางที่นี่เพื่อให้ทุกเครื่องดึงข้อมูลได้ทันที:
                </p>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={inputSheetId}
                    onChange={(e) => setInputSheetId(e.target.value)}
                    placeholder="วางลิงก์ Google Sheet หรือใส่ Sheet ID..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-blue-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 select-all"
                  />
                  <button
                    onClick={handleSheetIdSave}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0"
                  >
                    บันทึก
                  </button>
                </div>
              </div>

              {/* Batch Upload Card */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    ส่งข้อมูลที่บันทึกไว้ขึ้น Google Sheets
                  </span>
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    ค้างส่ง: {pendingCount} จุด
                  </span>
                </div>

                <button
                  onClick={onBatchSyncNow}
                  disabled={isSyncing || pendingCount === 0}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg flex items-center justify-center gap-2 font-bold text-xs active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                  <span>
                    {isSyncing
                      ? 'กำลังส่งข้อมูลขึ้น Google Sheets...'
                      : pendingCount > 0
                      ? `ส่งข้อมูลค้างซิงก์ ${pendingCount} จุด ขึ้น Google Sheets ทันที`
                      : 'ข้อมูลจุดเสี่ยงในเครื่องถูกซิงก์ครบแล้ว'}
                  </span>
                </button>

                {lastSyncedAt && (
                  <p className="text-[10px] text-center text-slate-400">
                    ซิงก์สำเร็จล่าสุดเมื่อ: {new Date(lastSyncedAt).toLocaleString('th-TH')}
                  </p>
                )}
              </div>
            </>
          ) : (
            /* Google Apps Script Documentation Tab */
            <div className="space-y-3.5 text-xs text-slate-300">
              {/* IMPORTANT DEPLOYMENT INSTRUCTION BANNER */}
              <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-600/70 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs sm:text-sm">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>ขั้นตอนสำคัญมากเพื่อให้ดึงข้อมูลข้ามเครื่องได้:</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  หากอุปกรณ์อื่นยังไม่เห็นข้อมูลจุดเสี่ยง ให้เปิด Google Sheet แล้วทำตามขั้นตอนต่อไปนี้ (ใช้เวลาไม่เกิน 1 นาที):
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-100/95 font-medium pl-1">
                  <li>เปิด Google Sheet แล้วไปที่เมนู <strong>ส่วนขยาย (Extensions) &gt; Apps Script</strong></li>
                  <li>คัดลอกโค้ดด้านล่างนี้ วางทับโค้ดเดิมทั้งหมด แล้วกด <strong>บันทึก (Ctrl+S)</strong></li>
                  <li>กดปุ่มสีน้ำเงิน <strong>"การทำให้ใช้งานได้" (Deploy) &gt; "จัดการการทำให้ใช้งานได้" (Manage deployments)</strong></li>
                  <li>คลิก <strong>ไอคอนรูปดินสอ ✏️ (แก้ไข)</strong> ทางขวามือ</li>
                  <li>ตรงช่อง <strong>"เวอร์ชัน" (Version)</strong> ให้คลิกเปลี่ยนเป็น <strong>"เวอร์ชันใหม่" (New version)</strong> *(สำคัญที่สุด)*</li>
                  <li>กดปุ่ม <strong>"ทำให้ใช้งานได้" (Deploy)</strong> แล้วกดเสร็จสิ้น</li>
                </ol>
              </div>

              {/* Code Snippet */}
              <div className="relative">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(appsScriptCode);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2000);
                  }}
                  className="absolute right-2 top-2 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold flex items-center gap-1 z-10 border border-slate-700"
                >
                  {copiedScript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedScript ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}</span>
                </button>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto max-h-[300px]">
                  {appsScriptCode}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
