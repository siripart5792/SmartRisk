import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Delete,
  Check,
  RotateCcw,
  CloudCheck,
} from 'lucide-react';
import { adminPinService } from '../services/adminPinService';
import { audioAlertService } from '../services/audioAlert';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessUnlock: () => void;
  appsScriptUrl: string;
  sheetId?: string;
  oauthToken?: string | null;
  currentPin: string;
  mode?: 'verify' | 'change';
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccessUnlock,
  appsScriptUrl,
  sheetId,
  oauthToken,
  currentPin,
  mode = 'verify',
}) => {
  const [activeMode, setActiveMode] = useState<'verify' | 'change'>(mode);
  const [pinInput, setPinInput] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isSyncingRemote, setIsSyncingRemote] = useState(false);

  // Sync PIN from Google Sheets when modal opens
  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMessage(null);
      setSuccessMessage(null);
      setActiveMode(mode);

      // Attempt background refresh from Google Sheets
      adminPinService.fetchAdminPin(appsScriptUrl, sheetId, oauthToken).catch(() => {});
    }
  }, [isOpen, mode, appsScriptUrl, sheetId, oauthToken]);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    setErrorMessage(null);
    if (activeMode === 'verify') {
      if (pinInput.length < 6) {
        const next = pinInput + num;
        setPinInput(next);
        if (next.length === 4 || next.length === currentPin.length) {
          checkPin(next);
        }
      }
    } else {
      if (newPin.length < 4) {
        setNewPin((prev) => prev + num);
      } else if (confirmPin.length < 4) {
        setConfirmPin((prev) => prev + num);
      }
    }
  };

  const handleDelete = () => {
    setErrorMessage(null);
    if (activeMode === 'verify') {
      setPinInput((prev) => prev.slice(0, -1));
    } else {
      if (confirmPin.length > 0) {
        setConfirmPin((prev) => prev.slice(0, -1));
      } else {
        setNewPin((prev) => prev.slice(0, -1));
      }
    }
  };

  const handleClear = () => {
    setErrorMessage(null);
    setPinInput('');
    setNewPin('');
    setConfirmPin('');
  };

  const checkPin = (entered: string) => {
    if (entered === currentPin || entered === '9999') {
      // Success!
      audioAlertService.playSuccessChime();
      setSuccessMessage('ยืนยันรหัส PIN ถูกต้อง เข้าสู่สิทธิ์ Admin');
      setTimeout(() => {
        onSuccessUnlock();
        onClose();
      }, 500);
    } else {
      // Fail
      setIsShaking(true);
      setErrorMessage('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      audioAlertService.playCriticalAlert();
      setTimeout(() => {
        setIsShaking(false);
        setPinInput('');
      }, 700);
    }
  };

  const handleSaveNewPin = async () => {
    if (newPin.length < 4) {
      setErrorMessage('รหัส PIN ใหม่ต้องมีอย่างน้อย 4 หลัก');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMessage('รหัสยืนยันไม่ตรงกัน กรุณากรอกใหม่');
      setConfirmPin('');
      return;
    }

    setIsSyncingRemote(true);
    try {
      const result = await adminPinService.saveAdminPin(newPin, appsScriptUrl, sheetId, oauthToken);
      audioAlertService.playSuccessChime();
      setSuccessMessage(result.message);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'บันทึก PIN ไม่สำเร็จ');
    } finally {
      setIsSyncingRemote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-slate-900 border border-purple-800/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-950/90 text-purple-400 border border-purple-800/80 flex items-center justify-center">
              {activeMode === 'verify' ? <Lock className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="font-bold text-sm md:text-base text-white">
                {activeMode === 'verify' ? 'ยืนยันรหัส PIN ผู้ดูแลระบบ' : 'ตั้งรหัส PIN ใหม่'}
              </h2>
              <p className="text-[11px] text-purple-300">
                สิทธิ์ Admin จัดเก็บและซิงก์กับ Google Sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Status / Notices */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {activeMode === 'verify' ? (
            <>
              {/* PIN Dots Indicator */}
              <div className={`flex items-center justify-center gap-3 py-3 ${isShaking ? 'animate-bounce' : ''}`}>
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pinInput.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        isFilled
                          ? 'bg-purple-500 border-purple-400 shadow-md shadow-purple-500/50 scale-110'
                          : 'border-slate-700 bg-slate-950'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="text-center text-[11px] text-slate-400">
                กรอกรหัส PIN 4 หลัก เพื่อปลดล็อกสิทธิ์ผู้ดูแลระบบ (Admin)
                <div className="text-[10px] text-purple-400 mt-1">
                  (รหัสเริ่มต้นระบบ: <span className="font-mono font-bold">9999</span> หรือรหัสที่เก็บไว้ใน Sheet)
                </div>
              </div>
            </>
          ) : (
            /* Change PIN Mode */
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">รหัส PIN ใหม่ (4 หลัก)</label>
                <div className="flex items-center justify-center gap-3 py-1 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full border ${
                        newPin.length > idx ? 'bg-purple-500 border-purple-400' : 'border-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">ยืนยันรหัส PIN อีกครั้ง</label>
                <div className="flex items-center justify-center gap-3 py-1 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full border ${
                        confirmPin.length > idx ? 'bg-purple-500 border-purple-400' : 'border-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {confirmPin.length === 4 && (
                <button
                  onClick={handleSaveNewPin}
                  disabled={isSyncingRemote}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>บันทึกลง Google Sheets ทันที</span>
                </button>
              )}
            </div>
          )}

          {/* Numeric Touch Keypad (Field-Friendly Large Buttons) */}
          <div className="grid grid-cols-3 gap-2.5 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                className="h-12 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 text-lg font-bold text-slate-100 border border-slate-800 shadow transition-all flex items-center justify-center"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-12 rounded-2xl bg-slate-950 hover:bg-slate-850 active:scale-95 text-xs font-semibold text-slate-400 border border-slate-800 flex items-center justify-center"
            >
              ล้าง
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-12 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 text-lg font-bold text-slate-100 border border-slate-800 shadow transition-all flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-12 rounded-2xl bg-slate-950 hover:bg-slate-850 active:scale-95 text-slate-300 border border-slate-800 flex items-center justify-center"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Footer Mode Switcher */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            {activeMode === 'verify' ? (
              <button
                onClick={() => {
                  handleClear();
                  setActiveMode('change');
                }}
                className="text-purple-400 hover:underline flex items-center gap-1 mx-auto"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>เปลี่ยนรหัส PIN ผู้ดูแลระบบ</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  handleClear();
                  setActiveMode('verify');
                }}
                className="text-slate-400 hover:underline flex items-center gap-1 mx-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>กลับสู่หน้ายืนยันรหัส</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
