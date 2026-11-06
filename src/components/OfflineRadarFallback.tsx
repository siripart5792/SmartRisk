import React, { useState } from 'react';
import {
  Compass,
  AlertTriangle,
  Zap,
  Mountain,
  Waves,
  ShieldAlert,
  ChevronRight,
  Crosshair,
  Volume2,
} from 'lucide-react';
import { RiskPoint, GPSPosition } from '../types';
import { calculateDistanceMeters, calculateBearing } from '../services/geofence';

interface OfflineRadarProps {
  points: RiskPoint[];
  currentGPS: GPSPosition | null;
  alertRadiusMeters: number;
  onSelectPoint: (point: RiskPoint) => void;
  onOpenAddModal: () => void;
}

export const OfflineRadarFallback: React.FC<OfflineRadarProps> = ({
  points,
  currentGPS,
  alertRadiusMeters,
  onSelectPoint,
  onOpenAddModal,
}) => {
  const [selectedPoint, setSelectedPoint] = useState<RiskPoint | null>(null);

  // If no GPS yet
  const userLat = currentGPS?.lat ?? 18.7904;
  const userLng = currentGPS?.lng ?? 98.9853;
  const accuracy = currentGPS?.accuracy ?? 5;

  // Calculate distance & bearing for all cached points
  const pointsWithDistance = points
    .map((p) => {
      const distance = calculateDistanceMeters(userLat, userLng, p.lat, p.lng);
      const bearing = calculateBearing(userLat, userLng, p.lat, p.lng);
      return { ...p, distance, bearing };
    })
    .sort((a, b) => a.distance - b.distance);

  // Points within radar max range (e.g. 1000m)
  const maxRangeMeters = 800;
  const radarPoints = pointsWithDistance.filter((p) => p.distance <= maxRangeMeters);

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-slate-950 text-slate-100 overflow-y-auto p-4 max-w-xl mx-auto">
      {/* Tactical Status Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="font-bold text-sm tracking-wide text-emerald-400 uppercase">
              Tactical Offline Radar
            </h2>
          </div>
          <p className="text-[11px] text-slate-400">
            พิกัด: {userLat.toFixed(5)}, {userLng.toFixed(5)} (±{accuracy.toFixed(1)}m)
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-transform"
        >
          + บันทึกจุดเสี่ยง
        </button>
      </div>

      {/* Radar HUD Screen */}
      <div className="relative w-full aspect-square max-h-[340px] my-4 mx-auto flex items-center justify-center">
        {/* Outer Ring */}
        <div className="relative w-full h-full rounded-full border-2 border-emerald-900/60 bg-emerald-950/20 backdrop-blur-sm overflow-hidden flex items-center justify-center shadow-inner shadow-emerald-950">
          {/* Radar Sweep Line */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-emerald-400 origin-left animate-radar"></div>
          </div>

          {/* Distance Rings */}
          <div className="absolute w-[80%] h-[80%] rounded-full border border-emerald-800/30"></div>
          <div className="absolute w-[55%] h-[55%] rounded-full border border-emerald-800/40"></div>
          <div className="absolute w-[30%] h-[30%] rounded-full border border-emerald-700/50"></div>

          {/* Crosshairs */}
          <div className="absolute w-full h-[1px] bg-emerald-900/40"></div>
          <div className="absolute h-full w-[1px] bg-emerald-900/40"></div>

          {/* Ring Labels */}
          <span className="absolute top-2 text-[9px] font-mono text-emerald-500/70 font-bold">N</span>
          <span className="absolute bottom-2 text-[9px] font-mono text-emerald-500/70 font-bold">S</span>
          <span className="absolute left-2 text-[9px] font-mono text-emerald-500/70 font-bold">W</span>
          <span className="absolute right-2 text-[9px] font-mono text-emerald-500/70 font-bold">E</span>
          <span className="absolute text-[8px] font-mono text-emerald-600/70 top-[36%] right-3">500m</span>
          <span className="absolute text-[8px] font-mono text-emerald-600/70 top-[44%] right-8">200m</span>

          {/* Center User Blip */}
          <div className="absolute z-10 w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-lg shadow-cyan-400 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900"></div>
          </div>

          {/* Threat Blips */}
          {radarPoints.map((p) => {
            // Polar to Cartesian projection on Radar Display
            // bearing 0 is North (top), 90 East (right), 180 South (down), 270 West (left)
            const rad = ((p.bearing - 90) * Math.PI) / 180;
            const distanceRatio = Math.min(p.distance / maxRangeMeters, 0.95);
            const radiusPx = (distanceRatio * 150); // half width approx
            const x = radiusPx * Math.cos(rad);
            const y = radiusPx * Math.sin(rad);

            const isCritical = p.severity === 'critical';
            const isHigh = p.severity === 'high';

            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPoint(p);
                  onSelectPoint(p);
                }}
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                }}
                className={`absolute z-20 w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-125 ${
                  isCritical
                    ? 'bg-red-500 shadow-md shadow-red-500/80 animate-ping'
                    : isHigh
                    ? 'bg-amber-500 shadow-md shadow-amber-500/70'
                    : 'bg-yellow-400'
                }`}
                title={`${p.title} (${p.distance}m)`}
              >
                <div
                  className={`w-3 h-3 rounded-full border border-white ${
                    isCritical ? 'bg-red-600' : isHigh ? 'bg-orange-600' : 'bg-yellow-500'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Radar Blip Info Card */}
      {selectedPoint && (
        <div className="mb-4 p-3 rounded-xl bg-slate-900 border border-orange-500/50 shadow-lg animate-in fade-in">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-orange-400">{selectedPoint.title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800">
              {calculateDistanceMeters(userLat, userLng, selectedPoint.lat, selectedPoint.lng)} เมตร
            </span>
          </div>
          <p className="text-xs text-slate-300 line-clamp-2">{selectedPoint.description}</p>
        </div>
      )}

      {/* Nearby Risk Points List (Sorted by proximity) */}
      <div className="flex-1 space-y-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>จุดเสี่ยงใกล้เคียงที่สุด ({pointsWithDistance.length} จุด)</span>
        </h3>

        {pointsWithDistance.slice(0, 5).map((point) => {
          const isDanger = point.distance <= alertRadiusMeters;

          return (
            <div
              key={point.id}
              onClick={() => {
                setSelectedPoint(point);
                onSelectPoint(point);
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                isDanger
                  ? 'bg-red-950/40 border-red-700/60 text-red-200'
                  : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      point.severity === 'critical'
                        ? 'bg-red-500'
                        : point.severity === 'high'
                        ? 'bg-orange-500'
                        : 'bg-yellow-400'
                    }`}
                  />
                  <span className="font-semibold text-xs md:text-sm line-clamp-1">{point.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{point.description}</p>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={`text-xs md:text-sm font-bold ${
                    isDanger ? 'text-red-400 animate-pulse' : 'text-slate-300'
                  }`}
                >
                  {point.distance} ม.
                </span>
                <p className="text-[10px] text-slate-500">ทิศ {point.bearing}°</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
