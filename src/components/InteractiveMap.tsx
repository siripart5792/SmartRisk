import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  CornerUpRight,
  TrendingDown,
  LightbulbOff,
  Car,
  Globe,
} from 'lucide-react';
import { RiskPoint, GPSPosition, RiskSeverity, RiskCategory, UserRole } from '../types';
import { calculateDistanceMeters } from '../services/geofence';
import { isRiskPointApproved } from '../services/googleSheets';

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
  onTopicChange?: () => void;
  isAcquiringGPS?: boolean;
}

// Icon mapper for risk categories
const getCategoryIcon = (category: RiskCategory) => {
  switch (category) {
    case 'sharp_curve':
      return CornerUpRight;
    case 'steep_slope':
      return TrendingDown;
    case 'no_lighting':
      return LightbulbOff;
    case 'accident_prone':
      return Car;
    case 'electrical':
      return Zap;
    case 'flood':
      return Waves;
    case 'road_damage':
      return Cone;
    case 'bridge_damage':
      return Construction;
    case 'signal_deadzone':
      return Radio;
    default:
      return AlertTriangle;
  }
};

// Colors based on severity (with full legacy migration fallback)
const getSeverityColor = (severity?: RiskSeverity | string) => {
  switch (severity) {
    case 'critical': // Legacy migration safety
    case 'high':
      return { bg: '#dc2626', border: '#7f1d1d', text: '#fee2e2', name: 'สูง (อันตราย)' };
    case 'medium':
      return { bg: '#eab308', border: '#713f12', text: '#fef9c3', name: 'ปานกลาง' };
    case 'low':
      return { bg: '#0284c7', border: '#0c4a6e', text: '#e0f2fe', name: 'ต่ำ / เฝ้าระวัง' };
    default:
      return { bg: '#dc2626', border: '#7f1d1d', text: '#fee2e2', name: 'สูง (อันตราย)' };
  }
};

// SVG strings for Leaflet custom HTML markers
const getCategorySvg = (category: RiskCategory) => {
  switch (category) {
    case 'sharp_curve':
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>';
    case 'steep_slope':
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>';
    case 'no_lighting':
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="m2 2 20 20"/><path d="M8.9 8.9A6 6 0 0 0 6 14v1a3 3 0 0 0 3 3h2"/><path d="M15 18a3 3 0 0 0 3-3v-1a6 6 0 0 0-1.8-4.2"/></svg>';
    case 'accident_prone':
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
    case 'electrical':
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
    case 'flood':
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>';
    case 'road_damage':
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9"/><path d="M12 18H2"/><path d="M14 6h7"/></svg>';
    case 'bridge_damage':
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/></svg>';
    case 'signal_deadzone':
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49"/></svg>';
    default:
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  }
};

// ==========================================
// LEAFLET REAL STREET & SATELLITE MAP ENGINE
// 100% reliable, zero API key failure, smooth touch gestures
// ==========================================
interface LeafletMapProps {
  points: RiskPoint[];
  currentGPS: GPSPosition | null;
  alertRadiusMeters: number;
  onSelectPoint: (p: RiskPoint) => void;
  onOpenAddModal: () => void;
  currentUserRole: UserRole;
  onApprovePoint?: (p: RiskPoint) => void;
  onRejectPoint?: (p: RiskPoint) => void;
  onSwitchToGoogleMaps?: () => void;
  onSwitchToRadar?: () => void;
  isAcquiringGPS?: boolean;
}

const LeafletFieldMap: React.FC<LeafletMapProps> = ({
  points,
  currentGPS,
  alertRadiusMeters,
  onSelectPoint,
  onOpenAddModal,
  currentUserRole,
  onApprovePoint,
  onRejectPoint,
  onSwitchToGoogleMaps,
  onSwitchToRadar,
  isAcquiringGPS,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.LayerGroup | null>(null);
  const geofenceCircleRef = useRef<L.Circle | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapType, setMapType] = useState<'streets' | 'satellite' | 'dark'>('streets');
  const [selectedPoint, setSelectedPoint] = useState<RiskPoint | null>(null);

  // Free browsing mode state: when user zooms or pans, map stays where user wants until they click recenter
  const [isFreeBrowsing, setIsFreeBrowsing] = useState<boolean>(false);
  const isFreeBrowsingRef = useRef<boolean>(false);
  const hasCenteredLiveGPSRef = useRef<boolean>(false);
  const lastFollowedPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const isProgrammaticMoveRef = useRef<boolean>(false);
  const [showTrackingToast, setShowTrackingToast] = useState<boolean>(false);

  // Initialize Leaflet Map once on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const hasValidGPS = currentGPS?.lat && !isNaN(currentGPS.lat);
    const initialLat = hasValidGPS ? currentGPS.lat : 13.7563;
    const initialLng = hasValidGPS ? currentGPS.lng : 100.5018;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: hasValidGPS ? 16 : 14,
      zoomControl: false,
      attributionControl: true,
    });

    if (hasValidGPS) {
      hasCenteredLiveGPSRef.current = true;
      lastFollowedPosRef.current = { lat: currentGPS.lat, lng: currentGPS.lng };
    }

    // Default Streets tile layer (OpenStreetMap)
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    currentTileLayerRef.current = tileLayer;

    // Create Layer Groups
    const markersLayer = L.layerGroup().addTo(map);
    const userLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    userMarkerRef.current = userLayer;
    mapInstanceRef.current = map;

    // Detect user manual pan / drag or pinch zoom to switch to free browsing mode
    const onUserInteraction = () => {
      if (isProgrammaticMoveRef.current) return;
      isFreeBrowsingRef.current = true;
      setIsFreeBrowsing(true);
      setShowTrackingToast(false);
    };

    map.on('dragstart', onUserInteraction);

    // Track user mouse wheel or two-finger pinch on container (ignores programmatic flyTo)
    const container = map.getContainer();
    const onWheel = () => onUserInteraction();
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length >= 2) {
        onUserInteraction();
      }
    };

    container.addEventListener('wheel', onWheel, { passive: true });
    container.addEventListener('touchstart', onTouchStart, { passive: true });

    return () => {
      map.off('dragstart', onUserInteraction);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // Run ONLY once on mount

  // Automatically center on entry, AND continuously follow/focus screen as user moves
  useEffect(() => {
    if (!mapInstanceRef.current || !currentGPS || typeof currentGPS.lat !== 'number' || isNaN(currentGPS.lat)) {
      return;
    }

    // 1. Initial GPS lock upon entry: fly directly to user's real location
    if (!hasCenteredLiveGPSRef.current && !isFreeBrowsingRef.current) {
      hasCenteredLiveGPSRef.current = true;
      lastFollowedPosRef.current = { lat: currentGPS.lat, lng: currentGPS.lng };
      isProgrammaticMoveRef.current = true;
      mapInstanceRef.current.flyTo([currentGPS.lat, currentGPS.lng], 16, {
        animate: true,
        duration: 0.9,
      });
      mapInstanceRef.current.once('moveend', () => {
        setTimeout(() => {
          isProgrammaticMoveRef.current = false;
        }, 150);
      });
      return;
    }

    // 2. Active Movement Tracking: When position moves, smoothly focus camera to follow along
    if (!isFreeBrowsingRef.current) {
      const last = lastFollowedPosRef.current;
      const movedMeters = last
        ? calculateDistanceMeters(last.lat, last.lng, currentGPS.lat, currentGPS.lng)
        : 999;

      // When moved 1.5 meters or more, smoothly pan camera to focus on new moving position
      if (movedMeters >= 1.5) {
        lastFollowedPosRef.current = { lat: currentGPS.lat, lng: currentGPS.lng };
        isProgrammaticMoveRef.current = true;
        mapInstanceRef.current.panTo([currentGPS.lat, currentGPS.lng], {
          animate: true,
          duration: 0.7,
          easeLinearity: 0.25,
        });
        mapInstanceRef.current.once('moveend', () => {
          setTimeout(() => {
            isProgrammaticMoveRef.current = false;
          }, 100);
        });
      }
    }
  }, [currentGPS]);

  // Update Tile Layer when mapType changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    let url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attr = '&copy; OpenStreetMap contributors';

    if (mapType === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attr = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    } else if (mapType === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      attr = '&copy; OpenStreetMap &copy; CARTO';
    }

    const newLayer = L.tileLayer(url, { maxZoom: 19, attribution: attr }).addTo(map);
    currentTileLayerRef.current = newLayer;
  }, [mapType]);

  // Update User GPS Marker and Geofence Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    const userLayer = userMarkerRef.current;
    if (!map || !userLayer) return;

    userLayer.clearLayers();

    if (currentGPS && typeof currentGPS.lat === 'number' && !isNaN(currentGPS.lat)) {
      const { lat, lng, accuracy, heading } = currentGPS;

      // Geofence alert circle
      const circle = L.circle([lat, lng], {
        radius: alertRadiusMeters,
        color: '#f97316',
        fillColor: '#f97316',
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '5, 5',
      });
      userLayer.addLayer(circle);
      geofenceCircleRef.current = circle;

      // GPS Accuracy circle
      const accCircle = L.circle([lat, lng], {
        radius: Math.max(8, accuracy || 5),
        color: '#38bdf8',
        fillColor: '#38bdf8',
        fillOpacity: 0.15,
        weight: 1,
      });
      userLayer.addLayer(accCircle);

      // Custom pulsing blue GPS Blip with heading cone
      const headingAngle = typeof heading === 'number' && !isNaN(heading) ? heading : null;
      const userHtml = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
          <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:rgba(59,130,246,0.3);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:2.5px solid white;box-shadow:0 4px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
            <div style="width:6px;height:6px;border-radius:50%;background:white;"></div>
          </div>
          ${
            headingAngle !== null
              ? `<div style="position:absolute;top:-8px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid #06b6d4;transform:rotate(${headingAngle}deg);transform-origin:center 24px;"></div>`
              : ''
          }
        </div>
      `;

      const userIcon = L.divIcon({
        html: userHtml,
        className: 'user-gps-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 });
      userLayer.addLayer(userMarker);
    }
  }, [currentGPS, alertRadiusMeters]);

  // Update Risk Point Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    points.forEach((point) => {
      if (typeof point.lat !== 'number' || isNaN(point.lat) || typeof point.lng !== 'number' || isNaN(point.lng)) {
        return;
      }

      const color = getSeverityColor(point?.severity);
      const svgIcon = getCategorySvg(point?.category);
      const isHigh = point?.severity === 'high' || (point?.severity as string) === 'critical';
      const isApproved = isRiskPointApproved(point);
      const isPending = !isApproved;

      const markerHtml = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:${color?.bg || '#dc2626'};border:${isPending ? '2.5px dashed #fbbf24' : '2.5px solid white'};box-shadow:${isPending ? '0 0 0 2px rgba(245,158,11,0.5), 0 4px 10px rgba(0,0,0,0.5)' : '0 4px 10px rgba(0,0,0,0.5)'};cursor:pointer;transition:transform 0.15s ease;">
          ${svgIcon}
          ${
            isHigh
              ? `<div style="position:absolute;inset:-4px;border-radius:50%;background:${color?.bg || '#dc2626'};opacity:0.4;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>`
              : ''
          }
          ${
            isPending
              ? `
              <!-- Top-right Amber Clock Badge -->
              <div style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:#d97706;border:1.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.5);z-index:20;" title="ยังไม่ผ่านการอนุมัติ (รอตรวจสอบ)">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <!-- Bottom Pill Badge "รออนุมัติ" -->
              <div style="position:absolute;bottom:-17px;left:50%;transform:translateX(-50%);background:#92400e;color:#fef3c7;font-size:9px;font-weight:700;padding:1px 5px;border-radius:9999px;border:1px solid #fde68a;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,0.6);letter-spacing:0.3px;pointer-events:none;z-index:20;">
                รออนุมัติ
              </div>
              `
              : `
              <!-- Top-right Green Checkmark for Approved Points -->
              <div style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:#16a34a;border:1.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.4);z-index:20;" title="ผ่านการอนุมัติยืนยันแล้ว">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              `
          }
        </div>
      `;

      const icon = L.divIcon({
        html: markerHtml,
        className: 'custom-risk-icon',
        iconSize: [44, 48],
        iconAnchor: [22, 22],
      });

      const marker = L.marker([point.lat, point.lng], { icon });
      marker.on('click', () => {
        setSelectedPoint(point);
        onSelectPoint(point);
      });

      markersLayer.addLayer(marker);
    });
  }, [points, onSelectPoint]);

  // Zoom handlers (activates free browsing mode so map does not snap back to user GPS)
  const handleZoomIn = () => {
    isFreeBrowsingRef.current = true;
    setIsFreeBrowsing(true);
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    isFreeBrowsingRef.current = true;
    setIsFreeBrowsing(true);
    mapInstanceRef.current?.zoomOut();
  };

  // Recenter handler (called when user clicks "ดึงตำแหน่งฉัน" / "ตำแหน่งปัจจุบันของฉัน")
  const handleRecenter = () => {
    isProgrammaticMoveRef.current = true;
    isFreeBrowsingRef.current = false;
    setIsFreeBrowsing(false);
    setShowTrackingToast(true);

    if (currentGPS && typeof currentGPS.lat === 'number' && !isNaN(currentGPS.lat)) {
      lastFollowedPosRef.current = { lat: currentGPS.lat, lng: currentGPS.lng };
      const map = mapInstanceRef.current;
      if (map) {
        map.flyTo([currentGPS.lat, currentGPS.lng], 16, {
          animate: true,
          duration: 0.8,
        });

        map.once('moveend', () => {
          setTimeout(() => {
            isProgrammaticMoveRef.current = false;
            isFreeBrowsingRef.current = false;
            setIsFreeBrowsing(false);
          }, 150);
        });
      }
    } else {
      setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 300);
    }

    setTimeout(() => {
      setShowTrackingToast(false);
    }, 2500);
  };

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden select-none bg-slate-950">
      {/* Real Leaflet Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Map Type & Layer Controls */}
      <div className="absolute top-2.5 sm:top-3 right-2 sm:right-3 z-20 flex items-center bg-slate-900/95 backdrop-blur-md p-0.5 sm:p-1 rounded-xl border border-slate-700/80 shadow-lg text-[11px] sm:text-xs">
        <button
          type="button"
          onClick={() => setMapType('streets')}
          className={`px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-all min-h-[30px] ${
            mapType === 'streets'
              ? 'bg-orange-600 text-white shadow-sm font-semibold'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          ถนน
        </button>
        <button
          type="button"
          onClick={() => setMapType('satellite')}
          className={`px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-all min-h-[30px] ${
            mapType === 'satellite'
              ? 'bg-orange-600 text-white shadow-sm font-semibold'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          ดาวเทียม
        </button>
        <button
          type="button"
          onClick={() => setMapType('dark')}
          className={`px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-all min-h-[30px] ${
            mapType === 'dark'
              ? 'bg-orange-600 text-white shadow-sm font-semibold'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          มืด
        </button>
      </div>

      {/* Selected Point Info Window Card - Mobile Bottom Sheet / Desktop Floating Panel */}
      {selectedPoint && (
        <div className="absolute bottom-20 md:bottom-6 left-2 right-2 sm:left-4 sm:right-auto sm:w-96 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-3.5 sm:p-4 text-xs animate-in slide-in-from-bottom duration-200 max-h-[60dvh] overflow-y-auto">
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: getSeverityColor(selectedPoint.severity)?.bg || '#dc2626' }}
                >
                  {getSeverityColor(selectedPoint.severity)?.name || 'สูง (อันตราย)'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                  {selectedPoint.id}
                </span>
                {!isRiskPointApproved(selectedPoint) ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/50 flex items-center gap-1 shadow-sm">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>ยังไม่อนุมัติ (รอตรวจ)</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>อนุมัติยืนยันแล้ว</span>
                  </span>
                )}
              </div>
              <h3 className="font-bold text-white text-sm sm:text-base leading-snug">{selectedPoint.title}</h3>
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              aria-label="ปิดการแสดงรายละเอียด"
            >
              ✕
            </button>
          </div>

          {!isRiskPointApproved(selectedPoint) && (
            <div className="my-2 p-2.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-amber-200 text-[11px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-300">ยังไม่ได้รับการอนุมัติ: </span>
                <span>จุดเสี่ยงนี้ได้รับการรายงานเข้ามาใหม่ และอยู่ระหว่างรอการตรวจสอบยืนยันจากผู้ดูแลระบบ</span>
              </div>
            </div>
          )}

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
          {currentUserRole === 'admin' && !isRiskPointApproved(selectedPoint) && (
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
            <span>เปิดนำทางใน Google Maps</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Floating Zoom & Map Engine Switcher */}
      <div className="absolute top-13 sm:top-15 right-2 sm:right-3 z-20 flex flex-col gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-lg flex items-center justify-center active:scale-95"
          title="ซูมเข้า"
        >
          <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-lg flex items-center justify-center active:scale-95"
          title="ซูมออก"
        >
          <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        {onSwitchToGoogleMaps && (
          <button
            type="button"
            onClick={onSwitchToGoogleMaps}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-blue-400 border border-slate-700 shadow-lg flex items-center justify-center active:scale-95"
            title="สลับเป็น Google Maps"
          >
            <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
      </div>

      {/* Floating indicator when acquiring GPS on app launch */}
      {isAcquiringGPS && !currentGPS && (
        <div className="absolute top-13 sm:top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-blue-500/60 text-blue-300 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
          <span className="font-medium whitespace-nowrap">กำลังดึงตำแหน่งปัจจุบันของคุณ...</span>
        </div>
      )}

      {/* Toast feedback when recentering to current location and resuming tracking */}
      {showTrackingToast && (
        <div className="absolute top-13 sm:top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-emerald-500/60 text-emerald-300 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <Navigation className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
          <span className="font-semibold whitespace-nowrap">กลับมาโฟกัสตามตำแหน่งปัจจุบันแล้ว</span>
        </div>
      )}

      {/* Floating indicator when user has panned or zoomed away from live GPS */}
      {isFreeBrowsing && (
        <div className="absolute top-13 sm:top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-blue-500/60 text-blue-200 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <Navigation className="w-3.5 h-3.5 text-blue-400 animate-pulse shrink-0" />
          <span className="font-medium whitespace-nowrap">โหมดเลื่อนดูอิสระ</span>
          <button
            type="button"
            onClick={handleRecenter}
            className="text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 px-2.5 py-0.5 rounded-full shadow transition-all whitespace-nowrap"
          >
            ดึงตำแหน่งฉัน
          </button>
        </div>
      )}

      {/* Bottom Floating Action Controls */}
      <div className="absolute bottom-20 md:bottom-6 right-3 sm:right-4 flex flex-col gap-2.5 z-20">
        <button
          type="button"
          onClick={onOpenAddModal}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform border-2 border-white/20"
          title="บันทึกจุดเสี่ยงใหม่ตรงพิกัดนี้"
        >
          <Plus className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.5]" />
        </button>

        <button
          type="button"
          onClick={handleRecenter}
          disabled={!currentGPS}
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-xl border ${
            isFreeBrowsing
              ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-300 ring-4 ring-blue-500/40 shadow-blue-500/30'
              : 'bg-slate-900/90 hover:bg-slate-800 text-blue-400 border-slate-700'
          } disabled:opacity-50`}
          title={isFreeBrowsing ? 'กดเพื่อดึงกลับมาโฟกัสตามตำแหน่งปัจจุบัน' : 'กำลังโฟกัสตามตำแหน่งปัจจุบัน'}
        >
          <Navigation className={`w-5 h-5 sm:w-6 sm:h-6 ${isFreeBrowsing ? 'animate-bounce text-white' : 'text-blue-400'}`} />
        </button>
      </div>
    </div>
  );
};

// ==========================================
// MAIN INTERACTIVE MAP CONTAINER
// Automatic Dual-Engine: Real Street/Satellite Map + Google Maps
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
  onTopicChange,
  isAcquiringGPS,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [mapEngine, setMapEngine] = useState<'real_map' | 'google_maps'>('real_map');
  const [googleLoadFailed, setGoogleLoadFailed] = useState(false);

  // Listen for Google Maps quota / auth failure
  useEffect(() => {
    const handleGoogleError = () => {
      console.warn('Google Maps error detected, switching to Real Street Map engine');
      setGoogleLoadFailed(true);
      setMapEngine('real_map');
    };
    window.addEventListener('gmp-quota-exceeded', handleGoogleError);
    return () => window.removeEventListener('gmp-quota-exceeded', handleGoogleError);
  }, []);

  // Safe Default Center
  const defaultCenter = useMemo(
    () =>
      currentGPS && typeof currentGPS.lat === 'number' && !isNaN(currentGPS.lat)
        ? { lat: currentGPS.lat, lng: currentGPS.lng }
        : { lat: 18.7904, lng: 98.9853 },
    [currentGPS]
  );

  // Filtered Points with coordinate validation
  const visiblePoints = points.filter((p) => {
    if (!p || typeof p.lat !== 'number' || isNaN(p.lat) || typeof p.lng !== 'number' || isNaN(p.lng)) {
      return false;
    }
    if (filterSeverity === 'all') return true;
    if (filterSeverity === 'pending') {
      return !isRiskPointApproved(p);
    }
    if (filterSeverity === 'high') {
      return p.severity === 'high' || (p.severity as string) === 'critical';
    }
    return p.severity === filterSeverity;
  });

  return (
    <div className="relative w-full h-full flex-1 flex flex-col min-h-0 bg-slate-950">
      {/* Top Filter Chips (Floats cleanly over map without blocking alerts) */}
      <div className="absolute top-2.5 sm:top-3 left-2 sm:left-3 z-20 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-1 max-w-[calc(100%-150px)] sm:max-w-[calc(100%-190px)]">
        <button
          type="button"
          onClick={() => {
            setFilterSeverity('all');
            onTopicChange?.();
          }}
          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap shadow-md backdrop-blur-md transition-colors ${
            filterSeverity === 'all'
              ? 'bg-orange-600 text-white border border-orange-500'
              : 'bg-slate-900/80 text-slate-300 border border-slate-700/60 hover:bg-slate-800/80'
          }`}
        >
          ทั้งหมด ({points.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterSeverity('pending');
            onTopicChange?.();
          }}
          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap shadow-md backdrop-blur-md transition-colors flex items-center gap-1 ${
            filterSeverity === 'pending'
              ? 'bg-amber-600 text-white border border-amber-400'
              : 'bg-slate-900/80 text-amber-300 border border-amber-500/40 hover:bg-slate-800/80'
          }`}
        >
          <span>⏳ รออนุมัติ ({points.filter((p) => !isRiskPointApproved(p)).length})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterSeverity('high');
            onTopicChange?.();
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-md backdrop-blur-md transition-colors ${
            filterSeverity === 'high'
              ? 'bg-red-600 text-white border border-red-500'
              : 'bg-slate-900/80 text-red-400 border border-slate-700/60 hover:bg-slate-800/80'
          }`}
        >
          สูง ({points.filter((p) => p.severity === 'high').length})
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterSeverity('medium');
            onTopicChange?.();
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-md backdrop-blur-md transition-colors ${
            filterSeverity === 'medium'
              ? 'bg-amber-600 text-white border border-amber-500'
              : 'bg-slate-900/80 text-amber-400 border border-slate-700/60 hover:bg-slate-800/80'
          }`}
        >
          ปานกลาง ({points.filter((p) => p.severity === 'medium').length})
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterSeverity('low');
            onTopicChange?.();
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-md backdrop-blur-md transition-colors ${
            filterSeverity === 'low'
              ? 'bg-blue-600 text-white border border-blue-500'
              : 'bg-slate-900/80 text-blue-400 border border-slate-700/60 hover:bg-slate-800/80'
          }`}
        >
          เฝ้าระวัง ({points.filter((p) => p.severity === 'low').length})
        </button>
      </div>

      {/* Main View Area: Real Street/Satellite Map OR Google Maps */}
      <div className="w-full h-full flex-1 relative min-h-[300px]">
        {mapEngine === 'real_map' ? (
          <LeafletFieldMap
            points={visiblePoints}
            currentGPS={currentGPS}
            alertRadiusMeters={alertRadiusMeters}
            onSelectPoint={onSelectPoint}
            onOpenAddModal={onOpenAddModal}
            currentUserRole={currentUserRole}
            onApprovePoint={onApprovePoint}
            onRejectPoint={onRejectPoint}
            onSwitchToGoogleMaps={() => setMapEngine('google_maps')}
            onSwitchToRadar={onSwitchToRadar}
            isAcquiringGPS={isAcquiringGPS}
          />
        ) : (
          <APIProvider
            apiKey={apiKey}
            libraries={['marker']}
            language="th"
            region="TH"
            onError={(err) => {
              console.warn('Google Maps APIProvider error, switching to real street map:', err);
              setGoogleLoadFailed(true);
              setMapEngine('real_map');
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
              <GoogleMapsLayer
                points={visiblePoints}
                currentGPS={currentGPS}
                onSelectPoint={onSelectPoint}
                currentUserRole={currentUserRole}
                onApprovePoint={onApprovePoint}
                onRejectPoint={onRejectPoint}
                onOpenAddModal={onOpenAddModal}
              />
            </Map>
          </APIProvider>
        )}
      </div>
    </div>
  );
};

// Safe Subcomponent for Google Maps view
const GoogleMapsLayer: React.FC<{
  points: RiskPoint[];
  currentGPS: GPSPosition | null;
  onSelectPoint: (p: RiskPoint) => void;
  currentUserRole: UserRole;
  onApprovePoint?: (p: RiskPoint) => void;
  onRejectPoint?: (p: RiskPoint) => void;
  onOpenAddModal: () => void;
}> = ({
  points,
  currentGPS,
  onSelectPoint,
  currentUserRole,
  onApprovePoint,
  onRejectPoint,
  onOpenAddModal,
}) => {
  const isLoaded = useApiIsLoaded();
  const map = useMap();
  const [selectedPoint, setSelectedPoint] = useState<RiskPoint | null>(null);
  const hasCenteredGoogleRef = useRef(false);
  const lastGooglePosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!map || !currentGPS || isNaN(currentGPS.lat)) return;

    if (!hasCenteredGoogleRef.current) {
      hasCenteredGoogleRef.current = true;
      lastGooglePosRef.current = { lat: currentGPS.lat, lng: currentGPS.lng };
      map.panTo({ lat: currentGPS.lat, lng: currentGPS.lng });
      map.setZoom(16);
    } else {
      const last = lastGooglePosRef.current;
      const movedMeters = last
        ? calculateDistanceMeters(last.lat, last.lng, currentGPS.lat, currentGPS.lng)
        : 999;
      if (movedMeters >= 2) {
        lastGooglePosRef.current = { lat: currentGPS.lat, lng: currentGPS.lng };
        map.panTo({ lat: currentGPS.lat, lng: currentGPS.lng });
      }
    }
  }, [map, currentGPS]);

  if (!isLoaded || !map) return null;

  return (
    <>
      {currentGPS && !isNaN(currentGPS.lat) && (
        <AdvancedMarker position={{ lat: currentGPS.lat, lng: currentGPS.lng }}>
          <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-xl" />
        </AdvancedMarker>
      )}

      {points.map((p) => {
        const color = getSeverityColor(p?.severity);
        const Icon = getCategoryIcon(p?.category);
        const isApproved = isRiskPointApproved(p);
        const isPending = !isApproved;

        return (
          <AdvancedMarker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            onClick={() => {
              setSelectedPoint(p);
              onSelectPoint(p);
            }}
          >
            <div
              className={`relative flex items-center justify-center w-9 h-9 rounded-full border-2 shadow-lg cursor-pointer ${
                isPending ? 'border-dashed border-amber-300 ring-2 ring-amber-500/40' : 'border-white'
              }`}
              style={{ backgroundColor: color?.bg || '#dc2626' }}
            >
              <Icon className="w-4 h-4 text-white" />
              {isPending ? (
                <>
                  <div
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-600 border border-white flex items-center justify-center text-white shadow font-bold text-[9px]"
                    title="ยังไม่ผ่านการอนุมัติ (รอตรวจสอบ)"
                  >
                    ⏳
                  </div>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-amber-800 text-amber-100 text-[8px] font-bold px-1 py-0.5 rounded border border-amber-300 whitespace-nowrap shadow pointer-events-none">
                    รออนุมัติ
                  </div>
                </>
              ) : (
                <div
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-600 border border-white flex items-center justify-center text-white shadow text-[8px]"
                  title="ผ่านการอนุมัติแล้ว"
                >
                  ✓
                </div>
              )}
            </div>
          </AdvancedMarker>
        );
      })}

      {selectedPoint && (
        <InfoWindow
          position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
          onCloseClick={() => setSelectedPoint(null)}
        >
          <div className="p-1 max-w-[240px] text-xs text-slate-800 space-y-1.5">
            <div className="flex items-center gap-1 flex-wrap">
              <span
                className="px-1.5 py-0.2 rounded text-[9px] font-bold text-white"
                style={{ backgroundColor: getSeverityColor(selectedPoint.severity)?.bg || '#dc2626' }}
              >
                {getSeverityColor(selectedPoint.severity)?.name}
              </span>
              {!isRiskPointApproved(selectedPoint) ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  ⏳ ยังไม่อนุมัติ (รอตรวจ)
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ✓ อนุมัติแล้ว
                </span>
              )}
            </div>
            <h4 className="font-bold text-slate-900">{selectedPoint.title}</h4>
            <p className="text-slate-600 line-clamp-2">{selectedPoint.description}</p>
            {currentUserRole === 'admin' && !isRiskPointApproved(selectedPoint) && (
              <div className="flex gap-1 pt-1">
                <button
                  onClick={() => {
                    onApprovePoint?.(selectedPoint);
                    setSelectedPoint(null);
                  }}
                  className="flex-1 py-1 bg-emerald-600 text-white rounded text-[10px]"
                >
                  อนุมัติ
                </button>
                <button
                  onClick={() => {
                    onRejectPoint?.(selectedPoint);
                    setSelectedPoint(null);
                  }}
                  className="flex-1 py-1 bg-rose-600 text-white rounded text-[10px]"
                >
                  ปฏิเสธ
                </button>
              </div>
            )}
          </div>
        </InfoWindow>
      )}

      <div className="absolute bottom-6 right-4 flex flex-col gap-2 z-20">
        <button
          onClick={onOpenAddModal}
          className="w-14 h-14 rounded-full bg-orange-600 text-white shadow-xl flex items-center justify-center"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>
    </>
  );
};
