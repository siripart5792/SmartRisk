import React, { useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  Download,
  Share2,
  Clock,
  MapPin,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { RiskPoint, GPSPosition, UserRole, RiskStatus } from '../types';
import { calculateDistanceMeters } from '../services/geofence';

interface RiskListProps {
  points: RiskPoint[];
  currentGPS: GPSPosition | null;
  currentUserRole: UserRole;
  onSelectPoint: (point: RiskPoint) => void;
  onApprovePoint: (point: RiskPoint) => void;
  onRejectPoint: (point: RiskPoint) => void;
  onDeletePoint: (pointId: string) => void;
  onOpenAddModal: () => void;
}

export const RiskListAndAdmin: React.FC<RiskListProps> = ({
  points,
  currentGPS,
  currentUserRole,
  onSelectPoint,
  onApprovePoint,
  onRejectPoint,
  onDeletePoint,
  onOpenAddModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const userLat = currentGPS?.lat ?? 18.7904;
  const userLng = currentGPS?.lng ?? 98.9853;

  // Filter and sort points
  const filteredPoints = points
    .filter((p) => {
      const matchSearch =
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.reporterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;

      return matchSearch && matchStatus && matchCat;
    })
    .map((p) => ({
      ...p,
      distance: calculateDistanceMeters(userLat, userLng, p.lat, p.lng),
    }))
    .sort((a, b) => a.distance - b.distance);

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'ID,Timestamp,Title,Category,Severity,Latitude,Longitude,Accuracy,Status,Reporter,Role,Description,SyncStatus',
    ];
    const rows = points.map((p) =>
      [
        `"${p.id}"`,
        `"${p.createdAt}"`,
        `"${p.title.replace(/"/g, '""')}"`,
        `"${p.category}"`,
        `"${p.severity}"`,
        p.lat,
        p.lng,
        p.accuracy,
        `"${p.status}"`,
        `"${p.reporterName}"`,
        `"${p.reporterRole}"`,
        `"${p.description.replace(/"/g, '""')}"`,
        `"${p.syncStatus}"`,
      ].join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GeoRisk_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Search & Actions Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาจุดเสี่ยง, ผู้รายงาน, รหัส..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <button
            onClick={onOpenAddModal}
            className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shrink-0 active:scale-95 transition-transform"
          >
            + บันทึกจุดเสี่ยง
          </button>

          <button
            onClick={handleExportCSV}
            title="ส่งออกไฟล์ CSV"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shrink-0"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[11px] text-slate-500 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> สถานะ:
          </span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
              statusFilter === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            ทั้งหมด ({points.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending_review')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
              statusFilter === 'pending_review'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-900 text-amber-400 hover:text-white'
            }`}
          >
            รอตรวจ ({points.filter((p) => p.status === 'pending_review').length})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-emerald-400 hover:text-white'
            }`}
          >
            อนุมัติแล้ว ({points.filter((p) => p.status === 'approved').length})
          </button>
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-w-3xl mx-auto w-full">
        {filteredPoints.length === 0 ? (
          <div className="text-center py-12 text-slate-500 space-y-2">
            <AlertTriangle className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm">ไม่พบรายการจุดเสี่ยงที่ตรงกับเงื่อนไข</p>
          </div>
        ) : (
          filteredPoints.map((point) => {
            const isCritical = point.severity === 'critical';
            const isHigh = point.severity === 'high';

            return (
              <div
                key={point.id}
                className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-md transition-all space-y-2"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isCritical
                            ? 'bg-red-500'
                            : isHigh
                            ? 'bg-orange-500'
                            : 'bg-yellow-400'
                        }`}
                      />
                      <h3
                        onClick={() => onSelectPoint(point)}
                        className="font-bold text-xs md:text-sm text-slate-100 hover:text-orange-400 cursor-pointer transition-colors"
                      >
                        {point.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="font-mono text-slate-500">{point.id}</span>
                      <span>•</span>
                      <span>{new Date(point.createdAt).toLocaleString('th-TH')}</span>
                    </div>
                  </div>

                  {/* Distance & Sync Badge */}
                  <div className="text-right shrink-0 space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                      {point.distance} เมตร
                    </span>
                    <div>
                      {point.syncStatus === 'synced' ? (
                        <span className="text-[10px] text-emerald-400 flex items-center justify-end gap-1 font-medium">
                          <CheckCircle className="w-3 h-3" /> ซิงก์แล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400 flex items-center justify-end gap-1 font-semibold animate-pulse">
                          <Clock className="w-3 h-3" /> รอซิงก์
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 leading-relaxed">
                  {point.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                </p>

                {/* Footer Meta & Controls */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <span>ผู้บันทึก:</span>
                    <span className="text-slate-200 font-medium">{point.reporterName}</span>
                    <span className="text-slate-500 text-[10px]">({point.reporterRole})</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Admin Moderation Controls */}
                    {currentUserRole === 'admin' && (
                      <>
                        {point.status === 'pending_review' && (
                          <>
                            <button
                              onClick={() => onApprovePoint(point)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/60 font-medium transition-colors"
                            >
                              อนุมัติ
                            </button>
                            <button
                              onClick={() => onRejectPoint(point)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-400 border border-rose-800/60 font-medium transition-colors"
                            >
                              ตีกลับ
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setConfirmDeleteId(point.id)}
                          title="ลบจุดเสี่ยงนี้"
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {/* External Navigation Link */}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-blue-400 hover:text-blue-300"
                      title="เปิดใน Google Maps"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mandatory User Confirmation Dialog for Destructive Delete (Workspace & RBAC rule) */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-red-900/60 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-800 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-white">ยืนยันการลบจุดเสี่ยง</h3>
              <p className="text-xs text-slate-300">
                คุณแน่ใจหรือไม่ว่าต้องการลบจุดเสี่ยงรหัส{' '}
                <span className="font-mono text-red-400">{confirmDeleteId}</span> ออกจากระบบ?
                การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  onDeletePoint(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-950"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
