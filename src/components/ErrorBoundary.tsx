import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Radio } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackView?: 'radar' | 'list';
  onSwitchView?: (view: 'radar' | 'list') => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-100 min-h-[300px]">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h2 className="text-base font-bold text-slate-100 mb-1">
            พบปัญหาในการโหลดส่วนแสดงผลแผนที่
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mb-3 leading-relaxed">
            ระบบความปลอดภัยตรวจพบข้อผิดพลาดจากแผนที่ภายนอก คุณสามารถสลับไปใช้โหมดเรดาร์ออฟไลน์เพื่อสำรวจเส้นทางต่อได้ทันทีโดยไม่ต้องใช้อินเทอร์เน็ต
          </p>

          {this.state.error && (
            <p className="text-[10px] font-mono text-slate-500 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 max-w-xs mb-4 truncate">
              {this.state.error.message || 'Map component load failure'}
            </p>
          )}

          <div className="flex items-center gap-2">
            {this.props.onSwitchView && (
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  this.props.onSwitchView?.('radar');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform"
              >
                <Radio className="w-4 h-4" />
                <span>ใช้โหมดเรดาร์ออฟไลน์</span>
              </button>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <RefreshCw className="w-4 h-4" />
              <span>ลองใหม่อีกครั้ง</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
