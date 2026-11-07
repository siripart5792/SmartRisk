import React, { useState } from 'react';
import {
  X,
  Sliders,
  Volume2,
  Smartphone,
  WifiOff,
  User,
  Shield,
  History,
  RotateCcw,
  Check,
} from 'lucide-react';
import { AppSettings, UserProfile, SyncLog } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: Partial<AppSettings>) => void;
  userProfile: UserProfile;
  onSaveUserProfile: (profile: Partial<UserProfile>) => void;
  syncLogs: SyncLog[];
  onResetSeedData: () => void;
  onOpenChangePinModal: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  userProfile,
  onSaveUserProfile,
  syncLogs,
  onResetSeedData,
  onOpenChangePinModal,
}) => {
  const [radius, setRadius] = useState(settings.alertRadiusMeters);
  const [sound, setSound] = useState(settings.soundAlertEnabled);
  const [vibrate, setVibrate] = useState(settings.vibrationEnabled);
  const [autoSync, setAutoSync] = useState(settings.autoSyncOnOnline);
  const [name, setName] = useState(userProfile.name);
  const [unit, setUnit] = useState(userProfile.unit);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings({
      alertRadiusMeters: radius,
      soundAlertEnabled: sound,
      vibrationEnabled: vibrate,
      autoSyncOnOnline: autoSync,
    });
    onSaveUserProfile({
      name,
      unit,
    });
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-white">ตั้งค่าระบบและโปรไฟล์</h2>
              <p className="text-[11px] text-slate-400">กำหนดรัศมีแจ้งเตือนและการทำงานออฟไลน์</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* User Profile */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-400" />
                <span>ข้อมูลเจ้าหน้าที่ภาคสนาม</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                {userProfile.role.toUpperCase()}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-slate-400 block mb-1">ชื่อ-นามสกุล / รหัสพนักงาน</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">สังกัดหน่วยงาน / ทีมปฏิบัติการ</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Geofence Alert Radius */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-200">
                รัศมีการแจ้งเตือนจุดเสี่ยงล่วงหน้า (Geofence)
              </label>
              <span className="font-bold text-amber-400 font-mono text-sm">{radius} เมตร</span>
            </div>

            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>50m (ประชิด)</span>
              <span>200m (มาตรฐาน)</span>
              <span>500m</span>
              <span>1,000m (ไกล)</span>
            </div>
          </div>

          {/* Alert Preferences */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <h3 className="font-semibold text-slate-200">การแจ้งเตือนและการซิงก์ข้อมูล</h3>

            <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>เสียงเตือนสังเคราะห์ (Web Audio API - Offline)</span>
              </div>
              <input
                type="checkbox"
                checked={sound}
                onChange={(e) => setSound(e.target.checked)}
                className="w-4 h-4 accent-orange-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-400" />
                <span>การสั่นเตือนบนมือถือ (Haptic Vibration)</span>
              </div>
              <input
                type="checkbox"
                checked={vibrate}
                onChange={(e) => setVibrate(e.target.checked)}
                className="w-4 h-4 accent-orange-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-400" />
                <span>ซิงก์ข้อมูลอัตโนมัติทันทีเมื่อเน็ตกลับมา (Auto Background Sync)</span>
              </div>
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-4 h-4 accent-orange-500 rounded"
              />
            </label>
          </div>

          {/* Admin Security PIN Section */}
          <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-purple-200 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-purple-400" />
                <span>รหัส PIN ผู้ดูแลระบบ (Admin PIN)</span>
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                เก็บใน Google Sheets
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              รหัส PIN ปัจจุบัน: <span className="font-mono text-purple-300 font-bold tracking-widest">••••</span> (เริ่มต้น: 9999) ใช้สำหรับปลดล็อกสิทธิ์ Admin ในการตรวจสอบ อนุมัติ และลบข้อมูล
            </p>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenChangePinModal();
              }}
              className="w-full py-2 px-3 rounded-lg bg-purple-900/60 hover:bg-purple-800/70 text-purple-200 text-xs font-semibold border border-purple-700/60 flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>เปลี่ยนรหัส PIN ผู้ดูแลระบบ (Sync to Google Sheets)</span>
            </button>
          </div>

          {/* Sync History Logs */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
              <History className="w-4 h-4 text-purple-400" />
              <span>ประวัติการซิงก์ข้อมูลล่าสุด</span>
            </h3>

            {syncLogs.length === 0 ? (
              <p className="text-[11px] text-slate-500">ยังไม่มีบันทึกการซิงก์</p>
            ) : (
              <div className="max-h-24 overflow-y-auto space-y-1">
                {syncLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-[10px] p-1.5 rounded bg-slate-900 border border-slate-850"
                  >
                    <span className="text-slate-300">{log.message}</span>
                    <span className="text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('th-TH')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reset seed button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={onResetSeedData}
              className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>คืนค่าข้อมูลจุดเสี่ยงตัวอย่างเริ่มต้น (Reset Seed Data)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs"
          >
            ปิด
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-orange-950"
          >
            {savedNotice ? <Check className="w-4 h-4 text-white" /> : null}
            <span>{savedNotice ? 'บันทึกแล้ว' : 'บันทึกการตั้งค่า'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
