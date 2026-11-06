import React from 'react';
import { Map, Radio, Plus, ListFilter, FileSpreadsheet } from 'lucide-react';

interface MobileBottomNavProps {
  activeView: 'map' | 'radar' | 'list';
  onViewChange: (view: 'map' | 'radar' | 'list') => void;
  onOpenAddModal: () => void;
  onOpenSheetsModal: () => void;
  pointsCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onViewChange,
  onOpenAddModal,
  onOpenSheetsModal,
  pointsCount,
}) => {
  return (
    <nav
      aria-label="เมนูหลักสำหรับมือถือ"
      className="md:hidden shrink-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/90 shadow-2xl px-2 py-1.5 flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {/* 1. Map Tab */}
      <button
        type="button"
        onClick={() => onViewChange('map')}
        className={`flex-1 flex flex-col items-center justify-center py-1 transition-all rounded-xl active:scale-95 ${
          activeView === 'map'
            ? 'text-orange-400 font-bold'
            : 'text-slate-400 hover:text-slate-200 font-medium'
        }`}
      >
        <div className="relative">
          <Map className="w-5 h-5" />
          {activeView === 'map' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-orange-500"></span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 leading-tight">แผนที่</span>
      </button>

      {/* 2. Radar Tab */}
      <button
        type="button"
        onClick={() => onViewChange('radar')}
        className={`flex-1 flex flex-col items-center justify-center py-1 transition-all rounded-xl active:scale-95 ${
          activeView === 'radar'
            ? 'text-emerald-400 font-bold'
            : 'text-slate-400 hover:text-slate-200 font-medium'
        }`}
      >
        <div className="relative">
          <Radio className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          {activeView === 'radar' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 leading-tight">เรดาร์</span>
      </button>

      {/* 3. Center Elevated + Action Button */}
      <div className="flex-1 flex items-center justify-center -mt-4">
        <button
          type="button"
          onClick={onOpenAddModal}
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 text-white shadow-xl shadow-orange-950/80 flex items-center justify-center border-2 border-slate-900 active:scale-90 transition-transform"
          title="บันทึกจุดเสี่ยงใหม่ทันที"
          aria-label="บันทึกจุดเสี่ยงใหม่ทันที"
        >
          <Plus className="w-7 h-7 stroke-[2.5]" />
        </button>
      </div>

      {/* 4. List Tab */}
      <button
        type="button"
        onClick={() => onViewChange('list')}
        className={`flex-1 flex flex-col items-center justify-center py-1 transition-all rounded-xl active:scale-95 ${
          activeView === 'list'
            ? 'text-orange-400 font-bold'
            : 'text-slate-400 hover:text-slate-200 font-medium'
        }`}
      >
        <div className="relative">
          <ListFilter className="w-5 h-5" />
          {pointsCount > 0 && (
            <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-orange-600 text-white text-[8px] font-mono font-bold leading-none">
              {pointsCount > 99 ? '99+' : pointsCount}
            </span>
          )}
          {activeView === 'list' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-orange-500"></span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 leading-tight">รายการ</span>
      </button>

      {/* 5. Google Sheets Tab */}
      <button
        type="button"
        onClick={onOpenSheetsModal}
        className="flex-1 flex flex-col items-center justify-center py-1 transition-all rounded-xl active:scale-95 text-slate-400 hover:text-emerald-400 font-medium"
      >
        <div className="relative">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
        </div>
        <span className="text-[10px] mt-0.5 leading-tight">ชีตข้อมูล</span>
      </button>
    </nav>
  );
};
