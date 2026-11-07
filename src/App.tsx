/**
 * GeoRisk Field Ops - Master Application
 * Mobile-first route survey & risk point assessment with Offline-First sync, Google Maps, and Google Sheets.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import {
  RiskPoint,
  GPSPosition,
  GeofenceAlert,
  AppSettings,
  UserProfile,
  UserRole,
  SyncLog,
  SyncStatus,
} from './types';
import { storageService, DEFAULT_SETTINGS, SEED_RISK_POINTS } from './services/storage';
import { connectivityService } from './services/connectivity';
import { audioAlertService } from './services/audioAlert';
import { evaluateGeofence, calculateDistanceMeters } from './services/geofence';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  getAccessToken,
  setCachedAccessToken,
} from './services/firebaseAuth';
import {
  createRiskSpreadsheet,
  appendRiskPointsToSheet,
  fetchRiskPointsFromSheet,
  updatePointStatusInSheet,
  syncPointsViaAppsScriptWebhook,
  fetchRiskPointsFromAppsScript,
} from './services/googleSheets';

import { Header } from './components/Header';
import { InteractiveMap } from './components/InteractiveMap';
import { OfflineRadarFallback } from './components/OfflineRadarFallback';
import { RiskListAndAdmin } from './components/RiskListAndAdmin';
import { AddRiskModal } from './components/AddRiskModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { SettingsModal } from './components/SettingsModal';
import { GeofenceAlertBanner } from './components/GeofenceAlertBanner';
import { AdminPinModal } from './components/AdminPinModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileBottomNav } from './components/MobileBottomNav';

export default function App() {
  // --- STATE ---
  const [points, setPoints] = useState<RiskPoint[]>([]);
  const [pendingQueue, setPendingQueue] = useState<RiskPoint[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [userProfile, setUserProfile] = useState<UserProfile>(storageService.getUserProfile());
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Connectivity with Active Probe
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
    connectivityService.getStatus()
  );
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Active View ('map' | 'radar' | 'list')
  const [activeView, setActiveView] = useState<'map' | 'radar' | 'list'>('map');

  // GPS State
  const [currentGPS, setCurrentGPS] = useState<GPSPosition | null>({
    lat: 18.7915,
    lng: 98.9860,
    accuracy: 3.5,
    heading: 45,
    speed: 0,
    altitude: 310,
    timestamp: Date.now(),
  });

  // Geofence Alerts
  const [activeAlerts, setActiveAlerts] = useState<GeofenceAlert[]>([]);
  const alertedIdsRef = useRef<Set<string>>(new Set());
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'verify' | 'change'>('verify');

  // Firebase Google User
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Effective Online State
  const effectiveOnline = isBrowserOnline && !simulatedOffline;

  // --- INITIAL DATA LOADING ---
  const loadStoredData = useCallback(async () => {
    const allPoints = await storageService.getAllRiskPoints();
    const pending = await storageService.getPendingSyncQueue();
    const currentSettings = storageService.getSettings();
    const logs = await storageService.getSyncLogs();
    const profile = storageService.getUserProfile();

    setPoints(allPoints);
    setPendingQueue(pending);
    setSettings(currentSettings);
    // Keep simulatedOffline defaulting to false for normal operation
    setSyncLogs(logs);
    setUserProfile(profile);
  }, []);

  useEffect(() => {
    loadStoredData();
    const unsubscribe = storageService.subscribe(loadStoredData);
    return () => unsubscribe();
  }, [loadStoredData]);

  // --- AUTO PULL FROM GOOGLE SHEETS ON EVERY ENTRY ---
  const autoPullFromGoogleSheet = useCallback(async () => {
    const currentSettings = storageService.getSettings();
    const webhookUrl = currentSettings.appsScriptUrl;
    const sheetId = currentSettings.googleSheetId;

    if (!webhookUrl && !sheetId) return;

    try {
      // 1. Try pulling from Apps Script Webhook
      if (webhookUrl) {
        const appsScriptPoints = await fetchRiskPointsFromAppsScript(webhookUrl);
        if (appsScriptPoints && appsScriptPoints.length > 0) {
          await storageService.batchSaveRiskPoints(appsScriptPoints);
          const updated = await storageService.getAllRiskPoints();
          setPoints(updated);
          storageService.saveSettings({ lastSuccessfulSync: new Date().toISOString() });
          setSyncStatus('synced');
          return;
        }
      }

      // 2. Try pulling from Google Sheets API if Sheet ID and token are present
      const token = await getAccessToken();
      if (token && sheetId) {
        const sheetPoints = await fetchRiskPointsFromSheet(token, sheetId);
        if (sheetPoints && sheetPoints.length > 0) {
          await storageService.batchSaveRiskPoints(sheetPoints);
          const updated = await storageService.getAllRiskPoints();
          setPoints(updated);
          storageService.saveSettings({ lastSuccessfulSync: new Date().toISOString() });
          setSyncStatus('synced');
        }
      }
    } catch (e) {
      console.warn('Auto pull from Google Sheets on start failed:', e);
    }
  }, []);

  // Run auto-pull every time the user enters/opens the app
  useEffect(() => {
    if (effectiveOnline) {
      autoPullFromGoogleSheet();
    }
  }, [effectiveOnline, autoPullFromGoogleSheet]);

  // --- GOOGLE WORKSPACE AUTH LISTENER ---
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        if (token) setCachedAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setCachedAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // --- ACTIVE CONNECTIVITY MONITORING ---
  useEffect(() => {
    if (settings.appsScriptUrl) {
      connectivityService.setAppsScriptUrl(settings.appsScriptUrl);
    }
  }, [settings.appsScriptUrl]);

  useEffect(() => {
    const unsubscribe = connectivityService.subscribe((online) => {
      setIsBrowserOnline(online);
    });
    // Immediately trigger an active connectivity probe
    connectivityService.checkConnectivityNow();
    return () => unsubscribe();
  }, []);

  // --- REAL-TIME GPS WATCHER ---
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentGPS({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          altitude: pos.coords.altitude,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        console.warn('Geolocation error (using fallback position):', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // --- GEOFENCE EVALUATION ---
  useEffect(() => {
    if (!currentGPS || points.length === 0) return;

    const { newAlerts, allNearby } = evaluateGeofence(
      currentGPS,
      points,
      settings.alertRadiusMeters,
      alertedIdsRef.current
    );

    if (newAlerts.length > 0) {
      // Register into alerted IDs
      newAlerts.forEach((a) => alertedIdsRef.current.add(a.point.id));
      setActiveAlerts((prev) => [...newAlerts, ...prev]);

      // Sound & tactile alert
      if (settings.soundAlertEnabled && !isAudioMuted) {
        const hasHigh = newAlerts.some((a) => a.point.severity === 'high');
        if (hasHigh) {
          audioAlertService.playCriticalAlert();
        } else {
          audioAlertService.playCautionAlert();
        }
      }
    }
  }, [currentGPS, points, settings.alertRadiusMeters, settings.soundAlertEnabled, isAudioMuted]);

  // --- AUTO BACKGROUND SYNC WHEN RECONNECTED ---
  const handleBatchSync = useCallback(async () => {
    if (!effectiveOnline || isSyncing) return;

    const pending = await storageService.getPendingSyncQueue();
    if (pending.length === 0) return;

    setIsSyncing(true);
    setSyncStatus('syncing');

    try {
      if (settings.syncMethod === 'apps_script' && settings.appsScriptUrl) {
        // Sync via Google Apps Script Webhook (Primary default)
        await syncPointsViaAppsScriptWebhook(settings.appsScriptUrl, pending);
      } else {
        // Sync via Direct Google Workspace OAuth Sheets API
        const token = await getAccessToken();
        const sheetId = settings.googleSheetId;

        if (!token || !sheetId) {
          throw new Error('กรุณาเลือกเชื่อมต่อบัญชี Google หรือระบุ Apps Script Webhook');
        }
        await appendRiskPointsToSheet(token, sheetId, pending);
      }

      const syncedIds = pending.map((p) => p.id);
      await storageService.markPointsAsSynced(syncedIds);

      const now = new Date().toISOString();
      storageService.saveSettings({ lastSuccessfulSync: now });

      await storageService.addSyncLog({
        count: syncedIds.length,
        status: 'success',
        message: `ซิงก์สำเร็จ ${syncedIds.length} จุดขึ้น Google Sheets เรียบร้อย`,
      });

      setSyncStatus('synced');
      audioAlertService.playSuccessChime();
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } catch (err: unknown) {
      console.error('Sync failed:', err);
      setSyncStatus('failed');
      await storageService.addSyncLog({
        count: pending.length,
        status: 'failed',
        message: `ซิงก์ล้มเหลว: ${(err as Error).message || 'ข้อผิดพลาดเครือข่าย'}`,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [effectiveOnline, isSyncing, settings.syncMethod, settings.appsScriptUrl, settings.googleSheetId]);

  // Sync Status indicator calculation
  useEffect(() => {
    if (isSyncing) {
      setSyncStatus('syncing');
    } else if (pendingQueue.length > 0) {
      setSyncStatus('pending');
    } else {
      setSyncStatus('synced');
    }
  }, [isSyncing, pendingQueue.length]);

  // Trigger prompt auto-sync whenever pendingQueue has items and online (every time data is added/modified)
  useEffect(() => {
    if (effectiveOnline && settings.autoSyncOnOnline && pendingQueue.length > 0 && !isSyncing) {
      const timer = setTimeout(() => {
        handleBatchSync();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [effectiveOnline, settings.autoSyncOnOnline, pendingQueue.length, isSyncing, handleBatchSync]);

  // Continuous background auto-sync every 15 seconds whenever there are pending items
  useEffect(() => {
    if (!effectiveOnline) return;

    const intervalId = setInterval(() => {
      if (pendingQueue.length > 0 && !isSyncing) {
        handleBatchSync();
      }
    }, 15000);

    return () => clearInterval(intervalId);
  }, [effectiveOnline, pendingQueue.length, isSyncing, handleBatchSync]);

  // --- ACTIONS ---

  const handleToggleSimulatedOffline = () => {
    const updated = !simulatedOffline;
    setSimulatedOffline(updated);
    storageService.saveSettings({ simulatedOffline: updated });
  };

  const handleToggleRole = () => {
    if (userProfile.role === 'staff') {
      // Require Admin PIN to unlock Admin role
      setPinModalMode('verify');
      setIsAdminPinModalOpen(true);
    } else {
      // Lock back to staff role
      const updated = storageService.saveUserProfile({ role: 'staff' });
      setUserProfile(updated);
      audioAlertService.playCautionAlert();
    }
  };

  const handleSuccessAdminUnlock = () => {
    const updated = storageService.saveUserProfile({ role: 'admin' });
    setUserProfile(updated);
    audioAlertService.playSuccessChime();
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.25 } });
  };

  const handleSaveNewPoint = async (point: RiskPoint) => {
    await storageService.saveRiskPoint(point, true);
    audioAlertService.playSuccessChime();

    // If online, immediately try to sync
    if (effectiveOnline && (settings.appsScriptUrl || (settings.googleSheetId && currentUser))) {
      handleBatchSync();
    }
  };

  const handleApprovePoint = async (point: RiskPoint) => {
    const updatedPoint: RiskPoint = {
      ...point,
      status: 'approved',
      updatedAt: new Date().toISOString(),
    };
    await storageService.saveRiskPoint(updatedPoint, true);

    const token = await getAccessToken();
    if (token && settings.googleSheetId && point.sheetRowIndex) {
      updatePointStatusInSheet(token, settings.googleSheetId, point.sheetRowIndex, 'approved', 'อนุมัติโดยแอดมิน');
    }

    // Auto-sync immediately every time!
    if (effectiveOnline) {
      handleBatchSync();
    }
  };

  const handleRejectPoint = async (point: RiskPoint) => {
    const updatedPoint: RiskPoint = {
      ...point,
      status: 'rejected',
      updatedAt: new Date().toISOString(),
    };
    await storageService.saveRiskPoint(updatedPoint, true);

    const token = await getAccessToken();
    if (token && settings.googleSheetId && point.sheetRowIndex) {
      updatePointStatusInSheet(token, settings.googleSheetId, point.sheetRowIndex, 'rejected', 'ไม่อนุมัติโดยแอดมิน');
    }

    // Auto-sync immediately every time!
    if (effectiveOnline) {
      handleBatchSync();
    }
  };

  const handleDeletePoint = async (pointId: string) => {
    await storageService.deleteRiskPoint(pointId);
  };

  const handleCreateNewSheet = async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('กรุณาลงชื่อเข้าใช้ Google ก่อน');

    setIsSyncing(true);
    try {
      const result = await createRiskSpreadsheet(token, 'GeoRisk_Field_Survey_Database');
      storageService.saveSettings({ googleSheetId: result.spreadsheetId });
      setSettings((prev) => ({ ...prev, googleSheetId: result.spreadsheetId }));
      audioAlertService.playSuccessChime();
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePrecacheFromSheet = async () => {
    const token = await getAccessToken();
    const sheetId = settings.googleSheetId;
    if (!token || !sheetId) return;

    setIsSyncing(true);
    try {
      const fetchedPoints = await fetchRiskPointsFromSheet(token, sheetId);
      if (fetchedPoints.length > 0) {
        await storageService.batchSaveRiskPoints(fetchedPoints);
        audioAlertService.playSuccessChime();
        confetti({ particleCount: 40, spread: 50 });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAcknowledgeAlert = (pointId: string) => {
    setActiveAlerts((prev) =>
      prev.map((a) => (a.point.id === pointId ? { ...a, acknowledged: true } : a))
    );
  };

  const handleResetSeedData = async () => {
    await storageService.batchSaveRiskPoints(SEED_RISK_POINTS);
    alertedIdsRef.current.clear();
    setActiveAlerts([]);
    audioAlertService.playSuccessChime();
  };

  // Google Maps API key
  const mapsApiKey =
    (import.meta as unknown as { env: Record<string, string> }).env?.VITE_GOOGLE_MAPS_API_KEY ||
    firebaseConfig.apiKey;

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-full overflow-hidden bg-slate-950 select-none">
      {/* Top Header */}
      <Header
        isOnline={isBrowserOnline}
        simulatedOffline={simulatedOffline}
        onToggleSimulatedOffline={handleToggleSimulatedOffline}
        onRecheckNetwork={() => connectivityService.checkConnectivityNow()}
        pendingCount={pendingQueue.length}
        syncStatus={syncStatus}
        onTriggerSync={handleBatchSync}
        currentUserRole={userProfile.role}
        onToggleRole={handleToggleRole}
        currentUserName={userProfile.name}
        onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {/* Geofence Active Alert Banner */}
      <GeofenceAlertBanner
        alerts={activeAlerts}
        onAcknowledgeAlert={handleAcknowledgeAlert}
        isMuted={isAudioMuted}
        onToggleMute={() => {
          const next = !isAudioMuted;
          setIsAudioMuted(next);
          audioAlertService.setMuted(next);
        }}
        onViewPoint={(alert) => {
          setActiveView('map');
        }}
      />

      {/* Main View Area with Error Boundary Protection */}
      <main className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
        <ErrorBoundary fallbackView="radar" onSwitchView={setActiveView}>
          {activeView === 'map' && (
            <InteractiveMap
              apiKey={mapsApiKey}
              points={points}
              currentGPS={currentGPS}
              onSelectPoint={(point) => {}}
              onOpenAddModal={() => setIsAddModalOpen(true)}
              currentUserRole={userProfile.role}
              onApprovePoint={handleApprovePoint}
              onRejectPoint={handleRejectPoint}
              alertRadiusMeters={settings.alertRadiusMeters}
              onSwitchToRadar={() => setActiveView('radar')}
            />
          )}

          {activeView === 'radar' && (
            <OfflineRadarFallback
              points={points}
              currentGPS={currentGPS}
              alertRadiusMeters={settings.alertRadiusMeters}
              onSelectPoint={(point) => {}}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />
          )}

          {activeView === 'list' && (
            <RiskListAndAdmin
              points={points}
              currentGPS={currentGPS}
              currentUserRole={userProfile.role}
              onSelectPoint={(point) => {
                setActiveView('map');
              }}
              onApprovePoint={handleApprovePoint}
              onRejectPoint={handleRejectPoint}
              onDeletePoint={handleDeletePoint}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Mobile Bottom Navigation Bar (Hidden on md and desktop) */}
      <MobileBottomNav
        activeView={activeView}
        onViewChange={setActiveView}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
        pointsCount={points.length}
      />

      {/* Modals */}
      <AddRiskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSavePoint={handleSaveNewPoint}
        currentGPS={currentGPS}
        currentUserRole={userProfile.role}
        currentUserName={userProfile.name}
      />

      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        currentUser={currentUser}
        onSignInGoogle={async () => {
          await googleSignIn();
        }}
        onSignOutGoogle={async () => {
          await logoutGoogle();
        }}
        sheetId={settings.googleSheetId}
        onSaveSheetId={(id) => {
          storageService.saveSettings({ googleSheetId: id });
          setSettings((prev) => ({ ...prev, googleSheetId: id }));
        }}
        appsScriptUrl={settings.appsScriptUrl}
        onSaveAppsScriptUrl={(url) => {
          storageService.saveSettings({ appsScriptUrl: url });
          setSettings((prev) => ({ ...prev, appsScriptUrl: url }));
        }}
        syncMethod={settings.syncMethod}
        onSaveSyncMethod={(method) => {
          storageService.saveSettings({ syncMethod: method });
          setSettings((prev) => ({ ...prev, syncMethod: method }));
        }}
        onCreateNewSheet={handleCreateNewSheet}
        onBatchSyncNow={handleBatchSync}
        onPrecacheFromSheet={handlePrecacheFromSheet}
        pendingCount={pendingQueue.length}
        isSyncing={isSyncing}
        lastSyncedAt={settings.lastSuccessfulSync}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={(s) => {
          const updated = storageService.saveSettings(s);
          setSettings(updated);
        }}
        userProfile={userProfile}
        onSaveUserProfile={(p) => {
          const updated = storageService.saveUserProfile(p);
          setUserProfile(updated);
        }}
        syncLogs={syncLogs}
        onResetSeedData={handleResetSeedData}
        onOpenChangePinModal={() => {
          setPinModalMode('change');
          setIsAdminPinModalOpen(true);
        }}
      />

      {/* Admin PIN Verification & Management Modal */}
      <AdminPinModal
        isOpen={isAdminPinModalOpen}
        onClose={() => setIsAdminPinModalOpen(false)}
        onSuccessUnlock={handleSuccessAdminUnlock}
        appsScriptUrl={settings.appsScriptUrl}
        sheetId={settings.googleSheetId}
        oauthToken={null}
        currentPin={settings.adminPin}
        mode={pinModalMode}
      />
    </div>
  );
}
