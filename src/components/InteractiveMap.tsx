import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
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

// Auto-Pan to User Position when GPS is first acquired
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

// Sub-component for Recenter and Add Button
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
      {/* Quick Add Point Button (Mobile-First Thumb Friendly) */}
      <button
        onClick={onOpenAddModal}
        className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform border-2 border-white/20"
        title="บันทึกจุดเสี่ยงใหม่ตรงพิกัดนี้"
      >
        <Plus className="w-8 h-8 stroke-[2.5]" />
      </button>

      {/* Recenter GPS */}
      <button
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

  // Listen for Google Maps Platform quota event
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
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
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
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

      {/* Map Load Error Fallback Banner */}
      {mapLoadError && (
        <div className="bg-amber-950/90 border-b border-amber-700/80 text-amber-200 px-4 py-2 text-xs flex items-center justify-between gap-2 z-30">
          <span>ไม่สามารถโหลดแผนที่ Google Maps ได้ (กำลังทำงานในโหมดสำรวจออฟไลน์)</span>
          {onSwitchToRadar && (
            <button
              onClick={onSwitchToRadar}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shrink-0"
            >
              เปิดโหมดเรดาร์
            </button>
          )}
        </div>
      )}

      {/* Top Filter Chips */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        <button
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

      {/* Main Google Maps View */}
      <div className="w-full h-full flex-1 relative min-h-[300px]">
        <APIProvider
          apiKey={apiKey}
          libraries={['marker']}
          language="th"
          region="TH"
          onError={(err) => {
            console.warn('APIProvider load error:', err);
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

            {/* Live GPS Current User Position Marker */}
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
                    <div className="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-pulse-ring"></div>
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

            {/* Risk Points Advanced Markers */}
            {visiblePoints.map((point) => {
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
                  <Pin
                    background={color.bg}
                    borderColor={color.border}
                    glyphColor={color.text}
                    scale={point.severity === 'critical' ? 1.25 : 1.05}
                  >
                    <IconComp className="w-4 h-4 text-white" />
                  </Pin>
                </AdvancedMarker>
              );
            })}

            {/* Selected Point InfoWindow */}
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

                  {/* Admin Moderation Actions */}
                  {currentUserRole === 'admin' && selectedPoint.status === 'pending_review' && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          onApprovePoint?.(selectedPoint);
                          setSelectedPoint(null);
                        }}
                        className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium"
                      >
                        อนุมัติ
                      </button>
                      <button
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

                  {/* Navigation External Link */}
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

            <MapControls currentGPS={currentGPS} onOpenAddModal={onOpenAddModal} />
          </Map>
        </APIProvider>
      </div>
    </div>
  );
};
