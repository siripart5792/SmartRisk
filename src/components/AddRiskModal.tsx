import React, { useState } from 'react';
import {
  X,
  MapPin,
  Zap,
  Mountain,
  Waves,
  Cone,
  Trees,
  Construction,
  Radio,
  AlertOctagon,
  Check,
} from 'lucide-react';
import {
  RiskCategory,
  RiskSeverity,
  RiskPoint,
  GPSPosition,
  UserRole,
} from '../types';

interface AddRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePoint: (point: RiskPoint) => void;
  currentGPS: GPSPosition | null;
  currentUserRole: UserRole;
  currentUserName: string;
}

const CATEGORIES: { id: RiskCategory; label: string; icon: React.ElementType }[] = [
  { id: 'electrical', label: 'เสา/สายไฟฟ้า', icon: Zap },
  { id: 'landslide', label: 'ดินสไลด์/หิน', icon: Mountain },
  { id: 'flood', label: 'น้ำท่วม/ทางขาด', icon: Waves },
  { id: 'road_damage', label: 'ถนนชำรุด/หลุม', icon: Cone },
  { id: 'tree_fall', label: 'ต้นไม้โค่นขวาง', icon: Trees },
  { id: 'bridge_damage', label: 'สะพานชำรุด', icon: Construction },
  { id: 'signal_deadzone', label: 'จุดอับสัญญาณ', icon: Radio },
  { id: 'other', label: 'ความเสี่ยงอื่นๆ', icon: AlertOctagon },
];

const SEVERITIES: { id: RiskSeverity; label: string; color: string; desc: string }[] = [
  { id: 'critical', label: 'วิกฤต', color: 'bg-red-600 hover:bg-red-500 border-red-500', desc: 'อันตรายถึงชีวิต ห้ามผ่าน' },
  { id: 'high', label: 'สูง', color: 'bg-orange-600 hover:bg-orange-500 border-orange-500', desc: 'เสี่ยงอันตรายรุนแรง รถเล็กผ่านไม่ได้' },
  { id: 'medium', label: 'ปานกลาง', color: 'bg-amber-600 hover:bg-amber-500 border-amber-500', desc: 'ต้องใช้ความระมัดระวังเป็นพิเศษ' },
  { id: 'low', label: 'เฝ้าระวัง', color: 'bg-blue-600 hover:bg-blue-500 border-blue-500', desc: 'ความเสี่ยงต่ำ ควรสังเกตการณ์' },
];

export const AddRiskModal: React.FC<AddRiskModalProps> = ({
  isOpen,
  onClose,
  onSavePoint,
  currentGPS,
  currentUserRole,
  currentUserName,
}) => {
  const [category, setCategory] = useState<RiskCategory>('electrical');
  const [severity, setSeverity] = useState<RiskSeverity>('high');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customLat, setCustomLat] = useState<string>('');
  const [customLng, setCustomLng] = useState<string>('');
  const [isManualCoords, setIsManualCoords] = useState(false);

  if (!isOpen) return null;

  const activeLat = isManualCoords && customLat ? parseFloat(customLat) : (currentGPS?.lat ?? 18.7904);
  const activeLng = isManualCoords && customLng ? parseFloat(customLng) : (currentGPS?.lng ?? 98.9853);
  const activeAcc = currentGPS?.accuracy ?? 4.5;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newPoint: RiskPoint = {
      id: `RISK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      title: title.trim(),
      category,
      severity,
      status: currentUserRole === 'admin' ? 'approved' : 'pending_review',
      lat: Number(activeLat.toFixed(6)),
      lng: Number(activeLng.toFixed(6)),
      accuracy: activeAcc,
      reporterName: currentUserName || 'เจ้าหน้าที่ภาคสนาม',
      reporterRole: currentUserRole,
      reporterUnit: 'ทีมสำรวจเส้นทางภาคสนาม',
      description: description.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    onSavePoint(newPoint);
    onClose();
    // Reset form
    setTitle('');
    setDescription('');
    setIsManualCoords(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600/30 text-orange-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-white">บันทึกจุดเสี่ยงภาคสนาม</h2>
              <p className="text-[11px] text-slate-400">บันทึกพิกัดแบบ Offline ทันที</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* GPS Coordinates Preview */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span>พิกัด GPS ที่บันทึก:</span>
                <span className="text-emerald-400 font-mono text-[11px]">
                  (ความแม่นยำ ±{activeAcc.toFixed(1)}ม.)
                </span>
              </div>
              <div className="font-mono text-xs md:text-sm text-slate-200">
                {activeLat.toFixed(5)}, {activeLng.toFixed(5)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsManualCoords(!isManualCoords)}
              className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              {isManualCoords ? 'ใช้ GPS ปัจจุบัน' : 'ระบุพิกัดเอง'}
            </button>
          </div>

          {/* Manual Coords Input */}
          {isManualCoords && (
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">ละติจูด (Lat)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={customLat}
                  onChange={(e) => setCustomLat(e.target.value)}
                  placeholder={String(activeLat)}
                  className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">ลองจิจูด (Lng)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={customLng}
                  onChange={(e) => setCustomLng(e.target.value)}
                  placeholder={String(activeLng)}
                  className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}

          {/* Category Selector Grid */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              หมวดหมู่จุดเสี่ยง <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-orange-950/80 border-orange-500 text-orange-300 shadow-md shadow-orange-950/50'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium text-center leading-tight">
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              ระดับความรุนแรง <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SEVERITIES.map((sev) => {
                const isSelected = severity === sev.id;
                return (
                  <button
                    key={sev.id}
                    type="button"
                    onClick={() => setSeverity(sev.id)}
                    className={`px-3 py-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? `${sev.color} text-white shadow-md font-bold scale-[1.02]`
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold">{sev.label}</div>
                    <div className="text-[9px] opacity-80 line-clamp-1">{sev.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              หัวข้อความเสี่ยง <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น เสาไฟเอียง 15 องศา, ดินถล่มปิดทาง, น้ำท่วม 30 ซม."
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Description Input */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              รายละเอียดเพิ่มเติม / แนวทางระวังภัย
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุขนาด ความกว้าง รัศมีอันตราย หรือข้อควรระวังสำหรับทีมงานภาคสนาม..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Submit Button (Mobile-First Large Touch Action) */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-600 to-red-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-sm md:text-base shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>บันทึกจุดเสี่ยง (ลงเครื่อง & รอซิงก์)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
