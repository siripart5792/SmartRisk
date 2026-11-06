import React from 'react';
import {
  AlertTriangle,
  Zap,
  Mountain,
  Waves,
  Cone,
  Volume2,
  VolumeX,
  Check,
  Navigation,
} from 'lucide-react';
import { GeofenceAlert, RiskCategory } from '../types';

interface GeofenceAlertBannerProps {
  alerts: GeofenceAlert[];
  onAcknowledgeAlert: (pointId: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onViewPoint: (alert: GeofenceAlert) => void;
}

const getCategoryIcon = (category: RiskCategory) => {
  switch (category) {
    case 'electrical':
      return Zap;
    case 'landslide':
      return Mountain;
    case 'flood':
      return Waves;
    case 'road_damage':
      return Cone;
    default:
      return AlertTriangle;
  }
};

export const GeofenceAlertBanner: React.FC<GeofenceAlertBannerProps> = ({
  alerts,
  onAcknowledgeAlert,
  isMuted,
  onToggleMute,
  onViewPoint,
}) => {
  // Only show active unacknowledged alerts
  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  if (activeAlerts.length === 0) return null;

  const topAlert = activeAlerts[0];
  const IconComp = getCategoryIcon(topAlert.point.category);
  const isCritical = topAlert.point.severity === 'critical';

  return (
    <div className="absolute top-14 left-3 right-3 z-30 max-w-lg mx-auto animate-in slide-in-from-top duration-300">
      <div
        className={`p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 ${
          isCritical
            ? 'bg-red-950/95 border-red-500 text-white shadow-red-950/80 animate-pulse'
            : 'bg-orange-950/95 border-orange-500 text-white shadow-orange-950/80'
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isCritical ? 'bg-red-600 text-white' : 'bg-orange-600 text-white'
            }`}
          >
            <IconComp className="w-6 h-6 animate-bounce" />
          </div>

          <div className="space-y-0.5 overflow-hidden">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/40 text-red-200">
                เตือนภัยในระยะ {topAlert.distance} เมตร!
              </span>
              {activeAlerts.length > 1 && (
                <span className="text-[10px] text-amber-300 font-semibold">
                  (+อีก {activeAlerts.length - 1} จุด)
                </span>
              )}
            </div>

            <h4
              onClick={() => onViewPoint(topAlert)}
              className="font-bold text-xs md:text-sm text-white truncate cursor-pointer hover:underline"
            >
              {topAlert.point.title}
            </h4>
            <p className="text-[11px] text-slate-200 truncate">
              {topAlert.point.description || 'ระวังอันตรายบริเวณเส้นทาง'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-black/30 hover:bg-black/50 text-slate-300 transition-colors"
            title={isMuted ? 'เปิดเสียงเตือน' : 'ปิดเสียงเตือน'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={() => onAcknowledgeAlert(topAlert.point.id)}
            className="px-3 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs flex items-center gap-1 shadow-md active:scale-95 transition-transform"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>รับทราบ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
