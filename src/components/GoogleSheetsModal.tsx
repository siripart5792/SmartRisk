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

    // 2. จัดการรับข้อมูลจุดเสี่ยงแบบ Batch Sync
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

  // 1. ดึงรหัส PIN ของ Admin จากแท็บ Admin_Config ใน Google Sheets
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

  // 2. ดึงข้อมูลจุดเสี่ยงทั้งหมดจาก Google Sheets มาแสดงผลในแอปอัตโนมัติ
  if (action === "get_points" || action === "fetch_points") {
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
  }

  return ContentService.createTextOutput(JSON.stringify({
    service: "GeoRisk Field Ops Webhook",
    status: "active",
    time: new Date().toISOString()
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
              <p className="text-[11px] text-slate-400">ระบบซิงก์ข้อมูลจุดเสี่ยงแบบ Batch Sync</p>
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
            <span>ซอร์สโค้ด Apps Script Webhook</span>
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
              {/* PRIMARY SYNC ENDPOINT: Google Apps Script Webhook */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-800/60 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Apps Script Webhook (ค่าหลักของระบบ)
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    พร้อมใช้งาน (Active)
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  จุดเชื่อมต่อ Webhook สำหรับรับข้อมูลจุดเสี่ยงแบบ Batch Sync จากอุปกรณ์ภาคสนามโดยตรง ส่งตรงเข้า Google Sheets อัตโนมัติ:
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

                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                  <span>โหมดการทำงาน:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSaveSyncMethod('apps_script')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                        syncMethod === 'apps_script'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      ✓ ผ่าน Webhook (ค่าหลัก)
                    </button>
                    <button
                      onClick={() => onSaveSyncMethod('google_oauth')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                        syncMethod === 'google_oauth'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      ผ่าน Google OAuth
                    </button>
                  </div>
                </div>
              </div>

              {/* Batch Sync Trigger Card */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    การส่งข้อมูลขึ้น Google Sheets (Batch Sync)
                  </span>
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    ค้างส่ง: {pendingCount} จุด
                  </span>
                </div>

                <button
                  onClick={onBatchSyncNow}
                  disabled={isSyncing || pendingCount === 0}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl flex items-center justify-center gap-2 font-bold text-xs md:text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  <UploadCloud className={`w-5 h-5 ${isSyncing ? 'animate-bounce' : ''}`} />
                  <span>
                    {isSyncing
                      ? 'กำลังส่งข้อมูลขึ้น Google Sheets...'
                      : pendingCount > 0
                      ? `ส่งข้อมูลค้างซิงก์ ${pendingCount} จุด ขึ้น Google Sheets ทันที`
                      : 'ข้อมูลทั้งหมดถูกซิงก์เรียบร้อยแล้ว'}
                  </span>
                </button>

                {lastSyncedAt && (
                  <p className="text-[10px] text-center text-slate-400">
                    ซิงก์สำเร็จล่าสุดเมื่อ: {new Date(lastSyncedAt).toLocaleString('th-TH')}
                  </p>
                )}
              </div>

              {/* Direct OAuth / Spreadsheet ID Setup (Alternative) */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    การเชื่อมต่อผ่าน Google OAuth (ทางเลือก)
                  </label>
                  {currentUser ? (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" /> ล็อกอินแล้ว ({currentUser.email})
                    </span>
                  ) : (
                    <button
                      onClick={onSignInGoogle}
                      className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-900 text-xs font-medium"
                    >
                      Sign in with Google
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={inputSheetId}
                    onChange={(e) => setInputSheetId(e.target.value)}
                    placeholder="ใส่ Google Sheet ID สำหรับการดึงข้อมูลกลับมาแคช..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSheetIdSave}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                  >
                    บันทึก
                  </button>
                </div>

                {sheetId && (
                  <button
                    onClick={onPrecacheFromSheet}
                    disabled={!currentUser || isSyncing}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <DownloadCloud className="w-4 h-4 text-blue-400" />
                    <span>ดึงข้อมูลจาก Google Sheet มาเก็บในเครื่อง (Pre-cache สำหรับออฟไลน์)</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Google Apps Script Documentation Tab */
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 space-y-1">
                <h4 className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Webhook ใช้งานได้ทันที</span>
                </h4>
                <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                  URL Webhook ของท่านได้รับการบันทึกลงในระบบเรียบร้อยแล้ว หากต้องการตรวจสอบหรือปรับแต่งสคริปต์ในฝั่ง Google Sheet สามารถดูโค้ดต้นฉบับได้ที่ด้านล่าง:
                </p>
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
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto max-h-[260px]">
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
