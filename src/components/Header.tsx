import React from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  FileSpreadsheet,
  Shield,
  User,
  Radio,
  Sliders,
  Lock,
} from 'lucide-react';
import { UserRole, SyncStatus } from '../types';

interface HeaderProps {
  isOnline: boolean;
  simulatedOffline: boolean;
  onToggleSimulatedOffline: () => void;
  onRecheckNetwork?: () => void;
  pendingCount: number;
  syncStatus: SyncStatus;
  onTriggerSync: () => void;
  currentUserRole: UserRole;
  onToggleRole: () => void;
  currentUserName: string;
  onOpenSheetsModal: () => void;
  onOpenSettingsModal: () => void;
  activeView: 'map' | 'radar' | 'list';
  onViewChange: (view: 'map' | 'radar' | 'list') => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  simulatedOffline,
  onToggleSimulatedOffline,
  onRecheckNetwork,
  pendingCount,
  syncStatus,
  onTriggerSync,
  currentUserRole,
  onToggleRole,
  currentUserName,
  onOpenSheetsModal,
  onOpenSettingsModal,
  activeView,
  onViewChange,
}) => {
  const effectiveOnline = isOnline && !simulatedOffline;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 flex items-center justify-center shadow-md shadow-orange-950/40">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm md:text-base text-white tracking-wide">
                SmartRisk Field
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-orange-950/80 text-orange-400 border border-orange-800/50">
                OPS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              ระบบสำรวจและประเมินจุดเสี่ยงภาคสนาม
            </p>
          </div>
        </div>

        {/* Center: View Switcher (Map / Radar / List) */}
        <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => onViewChange('map')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              activeView === 'map'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            แผนที่
          </button>
          <button
            onClick={() => onViewChange('radar')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
              activeView === 'radar'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            เรดาร์
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          </button>
          <button
            onClick={() => onViewChange('list')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              activeView === 'list'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            รายการ
          </button>
        </div>

        {/* Right side: Status and Actions */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Network Indicator & Toggle */}
          {simulatedOffline ? (
            <button
              onClick={onToggleSimulatedOffline}
              title="กำลังจำลองโหมดออฟไลน์ - คลิกเพื่อกลับสู่โหมดออนไลน์ปกติ"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-950/90 text-amber-300 border border-amber-600/70 hover:bg-amber-900 transition-colors shadow-sm animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <WifiOff className="w-3.5 h-3.5" />
              <span>จำลองออฟไลน์ (แตะปิด)</span>
            </button>
          ) : !isOnline ? (
            <button
              onClick={() => onRecheckNetwork?.()}
              title="ตรวจไม่พบสัญญาณเน็ต - คลิกเพื่อตรวจเช็คสัญญาณใหม่ทันที"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950/90 text-rose-300 border border-rose-800/80 hover:bg-rose-900 transition-colors shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline (แตะเช็คเน็ต)</span>
            </button>
          ) : (
            <button
              onClick={onToggleSimulatedOffline}
              title="เชื่อมต่ออินเทอร์เน็ตปกติ (คลิกเพื่อทดสอบจำลองโหมดออฟไลน์)"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900/60 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Online (ปกติ)</span>
              <span className="sm:hidden">Online</span>
            </button>
          )}

          {/* Pending Sync Count & Sync Now Button */}
          {pendingCount > 0 && (
            <button
              onClick={onTriggerSync}
              disabled={syncStatus === 'syncing' || !effectiveOnline}
              title={
                effectiveOnline
                  ? `มีข้อมูลรอซิงก์ ${pendingCount} รายการ คลิกเพื่อซิงก์`
                  : 'ออฟไลน์อยู่ ข้อมูลจะซิงก์อัตโนมัติเมื่อมีเน็ต'
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                effectiveOnline
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 animate-bounce'
                  : 'bg-slate-800 text-amber-400 border border-amber-500/30'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <span>รอซิงก์ {pendingCount}</span>
            </button>
          )}

          {/* Google Sheets Modal Button */}
          <button
            onClick={onOpenSheetsModal}
            title="จัดการการเชื่อมโยง Google Sheets"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>

          {/* RBAC Role Switcher with PIN Lock */}
          <button
            onClick={onToggleRole}
            title={
              currentUserRole === 'admin'
                ? 'สิทธิ์ผู้ดูแลระบบ (Admin) ปลดล็อกแล้ว - คลิกเพื่อล็อคกลับเป็น Staff'
                : 'คลิกเพื่อใส่รหัส PIN ปลดล็อกสิทธิ์ผู้ดูแลระบบ (Admin)'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              currentUserRole === 'admin'
                ? 'bg-purple-950/90 text-purple-200 border-purple-700/80 hover:bg-purple-900 shadow-sm'
                : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            {currentUserRole === 'admin' ? (
              <>
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-bold">Admin</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300">Staff</span>
              </>
            )}
          </button>

          {/* Settings Modal Button */}
          <button
            onClick={onOpenSettingsModal}
            title="การตั้งค่าระบบและรัศมีเตือนภัย"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
