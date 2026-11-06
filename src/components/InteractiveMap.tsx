import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps';
import {
  Zap,
  Mountain,
  Waves,
  Cone,
  Trees,
  Construction,
  Radio,
  AlertTriangle,
  Navigation,
  Compass,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  MapPin,
  Layers,
  Shield,
  LocateFixed,
} from 'lucide-react';
import { RiskPoint, GPSPosition, RiskSeverity, RiskCategory, UserRole } from '../types';

interface InteractiveMapProps {
  apiKey: string;
  points: RiskPoint[];
  currentGPS: GPSPosition | null;
  onSelectPoint: (point: RiskPoint) => void;
  onOpenAddModal: () => void;
  currentUserRole: UserRole;
  onApprovePoint?: (point: RiskPoint) => void;
  onRejectPoint?: (point: RiskPoint) => void;
  alertRadiusMeters: number;
  onSwitchToRadar?: () => void;
}

// Icon mapper for risk categories
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
    case 'tree_fall':
      return Trees;
    case 'bridge_damage':
      return Construction;
    case 'signal_deadzone':
      return Radio;
    default:
      return AlertTriangle;
  }
};

// Colors based on severity
const getSeverityColor = (severity: RiskSeverity) => {
  switch (severity) {
    case 'critical':
      return { bg: '#dc2626', border: '#7f1d1d', text: '#fee2e2', name: 'วิกฤต' };
    case 'high':
      return { bg: '#ea580c', border: '#7c2d12', text: '#ffedd5', name: 'สูง' };
    case 'medium':
      return { bg: '#eab308', border: '#713f12', text: '#fef9c3', name: 'ปานกลาง' };
    case 'low':
      return { bg: '#0284c7', border: '#0c4a6e', text: '#e0f2fe', name: 'เฝ้าระวัง' };
  }
};

// Safe Auto-Pan component
const MapAutoPan: React.FC<{ currentGPS: GPSPosition | null }> = ({ currentGPS }) => {
  const map = useMap();
  const hasAutoCentered = useRef(false);

  useEffect(() => {
    if (map && currentGPS && !hasAutoCentered.current) {
      if (typeof currentGPS.lat === 'number' && !isNaN(currentGPS.lat)) {
        map.panTo({ lat: currentGPS.lat, lng: currentGPS.lng });
        map.setZoom(15);
        hasAutoCentered.current = true;
      }
    }
  }, [map, currentGPS]);

  return null;
};

// Map controls for Google Maps
const MapControls: React.FC<{
  currentGPS: GPSPosition | null;
  onOpenAddModal: () => void;
}> = ({ currentGPS, onOpenAddModal }) => {
  const map = useMap();

  const handleRecenter = useCallback(() => {
    if (map && currentGPS && typeof currentGPS.lat === 'number' && !isNaN(currentGPS.lat)) {
      map.panTo({ lat: currentGPS.lat, lng: currentGPS.lng });
      map.setZoom(16);
    }
  }, [map, currentGPS]);

  return (
    <div className="absolute bottom-6 right-4 flex flex-col gap-2 z-20">
      <button
        type="button"
        onClick={onOpenAddModal}
        className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform border-2 border-white/20"
        title="บันทึกจุดเสี่ยงใหม่ตรงพิกัดนี้"
      >
        <Plus className="w-8 h-8 stroke-[2.5]" />
      </button>

      <button
        type="button"
        onClick={handleRecenter}
        disabled={!currentGPS}
        className="w-12 h-12 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-blue-400 border border-slate-700 shadow-lg flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
        title="ตำแหน่งปัจจุบันของฉัน"
      >
        <Navigation className="w-6 h-6" />
      </button>
    </div>
  );
};

// Safe Marker Layer for Google Maps that waits for API readiness
const GoogleMapsMarkerLayer: React.FC<{
  points: RiskPoint[];
  currentGPS: GPSPosition | null;
  selectedPoint: RiskPoint | null;
  setSelectedPoint: (p: RiskPoint | null) => void;
  onSelectPoint: (p: RiskPoint) => void;
  currentUserRole: UserRole;
  onApprovePoint?: (p: RiskPoint) => void;
  onRejectPoint?: (p: RiskPoint) => void;
}> = ({
  points,
  currentGPS,
  selectedPoint,
  setSelectedPoint,
  onSelectPoint,
  currentUserRole,
  onApprovePoint,
  onRejectPoint,
}) => {
  const isLoaded = useApiIsLoaded();
  if (!isLoaded) return null;

  return (
    <>
      {/* Current GPS Marker */}
      {currentGPS &&
        typeof currentGPS.lat === 'number' &&
        !isNaN(currentGPS.lat) &&
        typeof currentGPS.lng === 'number' &&
        !isNaN(currentGPS.lng) && (
          <AdvancedMarker
            position={{ lat: currentGPS.lat, lng: currentGPS.lng }}
            title="ตำแหน่งปัจจุบันของคุณ"
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping"></div>
              <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
              {typeof currentGPS.heading === 'number' && !isNaN(currentGPS.heading) && (
                <div
                  className="absolute -top-3 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-blue-400"
                  style={{
                    transform: `rotate(${currentGPS.heading}deg)`,
                    transformOrigin: 'center 16px',
                  }}
                />
              )}
            </div>
          </AdvancedMarker>
        )}

      {/* Risk Points with pure custom HTML markers (100% immune to PinElement issues) */}
      {points.map((point) => {
        const IconComp = getCategoryIcon(point.category);
        const color = getSeverityColor(point.severity);

        return (
          <AdvancedMarker
            key={point.id}
            position={{ lat: point.lat, lng: point.lng }}
            onClick={() => {
              setSelectedPoint(point);
              onSelectPoint(point);
            }}
            title={point.title}
          >
            <div
              className="relative flex items-center justify-center w-8 h-8 rounded-full shadow-lg border-2 border-white cursor-pointer transition-transform hover:scale-110 active:scale-95"
              style={{ backgroundColor: color.bg }}
            >
              <IconComp className="w-4 h-4 text-white" />
              {point.severity === 'critical' && (
                <span
                  className="absolute -inset-1 rounded-full animate-ping opacity-70"
                  style={{ backgroundColor: color.bg }}
                ></span>
              )}
            </div>
          </AdvancedMarker>
        );
      })}

      {/* Selected InfoWindow */}
      {selectedPoint && (
        <InfoWindow
          position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
          onCloseClick={() => setSelectedPoint(null)}
          headerContent={
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs md:text-sm">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              <span>{selectedPoint.title}</span>
            </div>
          }
        >
          <div className="p-1 max-w-[260px] text-xs text-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                style={{
                  backgroundColor: getSeverityColor(selectedPoint.severity).bg,
                }}
              >
                {getSeverityColor(selectedPoint.severity).name}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-medium">
                {selectedPoint.status === 'approved'
                  ? 'อนุมัติแล้ว'
                  : selectedPoint.status === 'pending_review'
                  ? 'รอตรวจ'
                  : selectedPoint.status}
              </span>
              <span className="text-[10px] text-slate-500">
                พิกัด: {selectedPoint.lat.toFixed(4)}, {selectedPoint.lng.toFixed(4)}
              </span>
            </div>

            <p className="text-slate-600 line-clamp-3 leading-relaxed">
              {selectedPoint.description}
            </p>

            <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>โดย: {selectedPoint.reporterName}</span>
              <span>{new Date(selectedPoint.createdAt).toLocaleDateString('th-TH')}</span>
            </div>

            {/* Admin Actions */}
            {currentUserRole === 'admin' && selectedPoint.status === 'pending_review' && (
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onApprovePoint?.(selectedPoint);
                    setSelectedPoint(null);
                  }}
                  className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium"
                >
                  อนุมัติ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRejectPoint?.(selectedPoint);
                    setSelectedPoint(null);
                  }}
                  className="flex-1 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-medium"
                >
                  ตีกลับ
                </button>
              </div>
            )}

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.lat},${selectedPoint.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 w-full py-1 bg-blue-50 text-blue-700 rounded text-[11px] font-medium hover:bg-blue-100"
            >
              <span>เปิดนำทางใน Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

// ==========================================
// TACTICAL OFFLINE FIELD MAP (VECTOR CANVAS)
// Completely off-grid resilient, interactive map
// ==========================================
interface TacticalFieldMapProps {
  points: RiskPoint[];
  currentGPS: GPSPosition | null;
  alertRadiusMeters: number;
  onSelectPoint: (p: RiskPoint) => void;
  onOpenAddModal: () => void;
  currentUserRole: UserRole;
  onApprovePoint?: (p: RiskPoint) => void;
  onRejectPoint?: (p: RiskPoint) => void;
  onRetryGoogleMaps?: () => void;
  onSwitchToRadar?: () => void;
}

const TacticalFieldMap: React.FC<TacticalFieldMapProps> = ({
  points,
  currentGPS,
  alertRadiusMeters,
  onSelectPoint,
  onOpenAddModal,
  currentUserRole,
  onApprovePoint,
  onRejectPoint,
  onRetryGoogleMaps,
  onSwitchToRadar,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: currentGPS?.lat || 18.7904,
    lng: currentGPS?.lng || 98.9853,
  });
  const [zoomLevel, setZoomLevel] = useState<number>(14);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedPoint, setSelectedPoint] = useState<RiskPoint | null>(null);

  // Recenter to current GPS
  const handleRecenter = () => {
    if (currentGPS && !isNaN(currentGPS.lat)) {
      setCenter({ lat: currentGPS.lat, lng: currentGPS.lng });
      setZoomLevel(15);
    }
  };

  // Convert GPS (lat, lng) to Screen Pixel (x, y) relative to container center
  const projectCoordinates = useCallback(
    (lat: number, lng: number, width: number, height: number) => {
      // 1 degree lat is ~111,000m
      // Scale factor determined by zoom level
      const scale = Math.pow(2, zoomLevel) * 12;
      const x = width / 2 + (lng - center.lng) * scale;
      const y = height / 2 - (lat - center.lat) * scale;
      return { x, y };
    },
    [center, zoomLevel]
  );

  // Drag pan handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const scale = Math.pow(2, zoomLevel) * 12;

    setCenter((prev) => ({
      lat: prev.lat + dy / scale,
      lng: prev.lng - dx / scale,
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const containerWidth = containerRef.current?.clientWidth || 400;
  const containerHeight = containerRef.current?.clientHeight || 600;

  // Calculate user screen pos
  const userPos = currentGPS
    ? projectCoordinates(currentGPS.lat, currentGPS.lng, containerWidth, containerHeight)
    : null;

  // Geofence radius in pixels
  const geofencePixels = useMemo(() => {
    const scale = Math.pow(2, zoomLevel) * 12;
    // meters to degrees lat: meters / 111000
    const deg = alertRadiusMeters / 111000;
    return Math.max(15, deg * scale);
  }, [zoomLevel, alertRadiusMeters]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full h-full flex-1 overflow-hidden bg-slate-950 select-none cursor-grab active:cursor-grabbing touch-none"
    >
      {/* Grid Pattern Background to visually anchor coordinates */}
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
        <defs>
          <pattern id="tactical-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tactical-grid)" />
      </svg>

      {/* Coordinate & Scale HUD */}
      <div className="absolute top-16 left-3 z-10 flex flex-col gap-1 pointer-events-none">
        <div className="px-2.5 py-1 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-cyan-400 flex items-center gap-1.5 shadow-md">
          <LocateFixed className="w-3 h-3 text-cyan-400" />
          <span>
            {center.lat.toFixed(4)}°N, {center.lng.toFixed(4)}°E (Zoom {zoomLevel})
          </span>
        </div>
      </div>

      {/* SVG Canvas for Geofence & Connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        {userPos && (
          <>
            {/* Geofence Alert Radius Ring */}
            <circle
              cx={userPos.x}
              cy={userPos.y}
              r={geofencePixels}
              fill="rgba(249, 115, 22, 0.08)"
              stroke="#f97316"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              className="animate-pulse"
            />
            {/* User GPS Accuracy Ring */}
            <circle
              cx={userPos.x}
              cy={userPos.y}
              r={Math.max(12, ((currentGPS?.accuracy || 5) / 111000) * Math.pow(2, zoomLevel) * 12)}
              fill="rgba(56, 189, 248, 0.15)"
              stroke="#38bdf8"
              strokeWidth="1"
            />
          </>
        )}
      </svg>

      {/* User Live GPS Marker on Field Map */}
      {userPos && (
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center"
          style={{ left: userPos.x, top: userPos.y }}
        >
          <div className="relative flex items-center justify-center">
            <div className="w-7 h-7 rounded-full bg-blue-500/30 animate-ping"></div>
            <div className="absolute w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-xl flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white"></div>
            </div>
            {currentGPS?.heading !== null && currentGPS?.heading !== undefined && (
              <div
                className="absolute -top-3.5 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[9px] border-b-cyan-400"
                style={{
                  transform: `rotate(${currentGPS.heading}deg)`,
                  transformOrigin: 'center 18px',
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Risk Points Markers on Field Map */}
      {points.map((point) => {
        const pos = projectCoordinates(point.lat, point.lng, containerWidth, containerHeight);
        const IconComp = getCategoryIcon(point.category);
        const color = getSeverityColor(point.severity);

        // Hide markers that are far outside screen bounds
        if (pos.x < -40 || pos.x > containerWidth + 40 || pos.y < -40 || pos.y > containerHeight + 40) {
          return null;
        }

        return (
          <div
            key={point.id}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPoint(point);
              onSelectPoint(point);
            }}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-transform active:scale-95"
            style={{ left: pos.x, top: pos.y }}
          >
            <div
              className="relative flex items-center justify-center w-8 h-8 rounded-full shadow-xl border-2 border-white transition-transform group-hover:scale-125"
              style={{ backgroundColor: color.bg }}
            >
              <IconComp className="w-4 h-4 text-white" />
              {point.severity === 'critical' && (
                <span
                  className="absolute -inset-1 rounded-full animate-ping opacity-75"
                  style={{ backgroundColor: color.bg }}
                ></span>
              )}
            </div>

            {/* Label below marker */}
            <div className="absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] text-slate-200 font-medium pointer-events-none shadow-md">
              {point.title.slice(0, 16)}...
            </div>
          </div>
        );
      })}

      {/* Selected Point Info Window / Bottom Sheet for Tactical Field Map */}
      {selectedPoint && (
        <div className="absolute bottom-20 left-4 right-4 md:left-6 md:w-80 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-4 text-xs animate-in slide-in-from-bottom duration-200">
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: getSeverityColor(selectedPoint.severity).bg }}
                >
                  {getSeverityColor(selectedPoint.severity).name}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                  {selectedPoint.id}
                </span>
              </div>
              <h3 className="font-bold text-white text-sm">{selectedPoint.title}</h3>
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          <p className="text-slate-300 py-2.5 leading-relaxed text-[11px]">
            {selectedPoint.description}
          </p>

          <div className="py-2 border-y border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>ผู้รายงาน: {selectedPoint.reporterName}</span>
            <span>
              {selectedPoint.lat.toFixed(4)}, {selectedPoint.lng.toFixed(4)}
            </span>
          </div>

          {/* Admin Moderation Actions */}
          {currentUserRole === 'admin' && selectedPoint.status === 'pending_review' && (
            <div className="flex items-center gap-2 pt-2.5">
              <button
                type="button"
                onClick={() => {
                  onApprovePoint?.(selectedPoint);
                  setSelectedPoint(null);
                }}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition-colors"
              >
                อนุมัติจุดเสี่ยง
              </button>
              <button
                type="button"
                onClick={() => {
                  onRejectPoint?.(selectedPoint);
                  setSelectedPoint(null);
                }}
                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold text-xs transition-colors"
              >
                ปฏิเสธ
              </button>
            </div>
          )}

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.lat},${selectedPoint.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full mt-2 py-2 bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 rounded-xl font-medium text-xs border border-blue-500/40 transition-colors"
          >
            <span>เปิดนำทางภายนอก</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Tactical Map Floating Controls */}
      <div className="absolute top-16 right-4 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.min(18, z + 1))}
          className="w-10 h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-lg flex items-center justify-center active:scale-95"
          title="ซูมเข้า"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.max(10, z - 1))}
          className="w-10 h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-lg flex items-center justify-center active:scale-95"
          title="ซูมออก"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        {onRetryGoogleMaps && (
          <button
            type="button"
            onClick={onRetryGoogleMaps}
            className="w-10 h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-slate-700 shadow-lg flex items-center justify-center active:scale-95"
            title="ลองเชื่อมต่อ Google Maps ใหม่"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bottom Action Controls */}
      <div className="absolute bottom-6 right-4 flex flex-col gap-2.5 z-20">
        <button
          type="button"
          onClick={onOpenAddModal}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform border-2 border-white/20"
          title="บันทึกจุดเสี่ยงใหม่ตรงพิกัดนี้"
        >
          <Plus className="w-8 h-8 stroke-[2.5]" />
        </button>

        <button
          type="button"
          onClick={handleRecenter}
          disabled={!currentGPS}
          className="w-12 h-12 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-blue-400 border border-slate-700 shadow-lg flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
          title="จัดกึ่งกลางตำแหน่งปัจจุบัน"
        >
          <Navigation className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

// ==========================================
// MAIN INTERACTIVE MAP CONTAINER
// Automatic Dual-Engine: Google Maps + Offline Tactical Map Fallback
// ==========================================
export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  apiKey,
  points,
  currentGPS,
  onSelectPoint,
  onOpenAddModal,
  currentUserRole,
  onApprovePoint,
  onRejectPoint,
  alertRadiusMeters,
  onSwitchToRadar,
}) => {
  const [selectedPoint, setSelectedPoint] = useState<RiskPoint | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);

  // Listen for Google Maps Platform quota / auth failure
  useEffect(() => {
    const handleQuota = () => {
      setQuotaExceeded(true);
      setMapLoadError(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Safe Default Center
  const defaultCenter =
    currentGPS && typeof currentGPS.lat === 'number' && !isNaN(currentGPS.lat)
      ? { lat: currentGPS.lat, lng: currentGPS.lng }
      : { lat: 18.7904, lng: 98.9853 };

  // Filtered Points with valid coordinate validation
  const visiblePoints = points.filter((p) => {
    if (typeof p.lat !== 'number' || isNaN(p.lat) || typeof p.lng !== 'number' || isNaN(p.lng)) {
      return false;
    }
    if (filterSeverity === 'all') return true;
    return p.severity === filterSeverity;
  });

  return (
    <div className="relative w-full h-full flex-1 flex flex-col min-h-0 bg-slate-950">
      {/* Quota Exceeded Banner (Section 8 Mandatory Requirement) */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Offline Mode / Fallback Notice Banner */}
      {mapLoadError && (
        <div className="bg-slate-900 border-b border-orange-500/30 text-slate-200 px-3 py-1.5 text-xs flex items-center justify-between gap-2 z-30">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold text-orange-400">โหมดแผนที่ภาคสนามออฟไลน์</span>
            <span className="hidden sm:inline text-slate-400 text-[11px]">
              (ทำงานแบบ Off-grid 100% พร้อมระบบระบุพิกัด GPS)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMapLoadError(false)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-colors"
            >
              ลองโหลดใหม่
            </button>
            {onSwitchToRadar && (
              <button
                type="button"
                onClick={onSwitchToRadar}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors"
              >
                โหมดเรดาร์
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Filter Chips */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        <button
          type="button"
          onClick={() => setFilterSeverity('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-md backdrop-blur-md transition-colors ${
            filterSeverity === 'all'
              ? 'bg-orange-600 text-white border border-orange-500'
              : 'bg-slate-900/80 text-slate-300 border border-slate-700/60 hover:bg-slate-800/80'
          }`}
        >
          ทั้งหมด ({points.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterSeverity('critical')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-md backdrop-blur-md transition-colors ${
            filterSeverity === 'critical'
              ? 'bg-red-600 text-white border border-red-500'
              : 'bg-slate-900/80 text-red-400 border border-slate-700/60 hover:bg-slate-800/80'
          }`}
        >
          วิกฤต ({points.filter((p) => p.severity === 'critical').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterSeverity('high')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-md backdrop-blur-md transition-colors ${
            filterSeverity === 'high'
              ? 'bg-amber-600 text-white border border-amber-500'
              : 'bg-slate-900/80 text-amber-400 border border-slate-700/60 hover:bg-slate-800/80'
          }`}
        >
          สูง ({points.filter((p) => p.severity === 'high').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterSeverity('medium')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-md backdrop-blur-md transition-colors ${
            filterSeverity === 'medium'
              ? 'bg-yellow-600 text-white border border-yellow-500'
              : 'bg-slate-900/80 text-yellow-400 border border-slate-700/60 hover:bg-slate-800/80'
          }`}
        >
          ปานกลาง ({points.filter((p) => p.severity === 'medium').length})
        </button>
      </div>

      {/* Main View Area: Google Maps or Tactical Field Map */}
      <div className="w-full h-full flex-1 relative min-h-[300px]">
        {mapLoadError ? (
          <TacticalFieldMap
            points={visiblePoints}
            currentGPS={currentGPS}
            alertRadiusMeters={alertRadiusMeters}
            onSelectPoint={(p) => {
              setSelectedPoint(p);
              onSelectPoint(p);
            }}
            onOpenAddModal={onOpenAddModal}
            currentUserRole={currentUserRole}
            onApprovePoint={onApprovePoint}
            onRejectPoint={onRejectPoint}
            onRetryGoogleMaps={() => setMapLoadError(false)}
            onSwitchToRadar={onSwitchToRadar}
          />
        ) : (
          <APIProvider
            apiKey={apiKey}
            libraries={['marker']}
            language="th"
            region="TH"
            onError={(err) => {
              console.warn('APIProvider load error (switching to Tactical Map):', err);
              setMapLoadError(true);
            }}
          >
            <Map
              defaultCenter={defaultCenter}
              defaultZoom={14}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            >
              <MapAutoPan currentGPS={currentGPS} />

              <GoogleMapsMarkerLayer
                points={visiblePoints}
                currentGPS={currentGPS}
                selectedPoint={selectedPoint}
                setSelectedPoint={setSelectedPoint}
                onSelectPoint={onSelectPoint}
                currentUserRole={currentUserRole}
                onApprovePoint={onApprovePoint}
                onRejectPoint={onRejectPoint}
              />

              <MapControls currentGPS={currentGPS} onOpenAddModal={onOpenAddModal} />
            </Map>
          </APIProvider>
        )}
      </div>
    </div>
  );
};
