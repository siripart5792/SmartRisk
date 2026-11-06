/**
 * Admin PIN Management Service
 * Syncs and stores Admin security PIN in Google Sheets and caches locally for offline field operations.
 */

import { storageService } from './storage';

export interface PinSyncResult {
  success: boolean;
  pin: string;
  source: 'google_sheets' | 'local_cache';
  message: string;
}

class AdminPinService {
  /**
   * Reads Admin PIN from Google Sheets via Apps Script Webhook or direct OAuth Sheets API.
   * If offline or request fails, falls back to locally cached PIN.
   */
  public async fetchAdminPin(
    appsScriptUrl: string,
    sheetId?: string,
    oauthToken?: string | null
  ): Promise<PinSyncResult> {
    const cachedPin = storageService.getSettings().adminPin || '9999';

    // 1. Try Apps Script Webhook
    if (appsScriptUrl && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const url = `${appsScriptUrl}?action=get_admin_pin&t=${Date.now()}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.adminPin) {
            const remotePin = String(data.adminPin).trim();
            // Cache locally
            storageService.saveSettings({ adminPin: remotePin });
            return {
              success: true,
              pin: remotePin,
              source: 'google_sheets',
              message: 'ดึงรหัส PIN ล่าสุดจาก Google Sheets สำเร็จ',
            };
          }
        }
      } catch (e) {
        console.warn('Apps Script get_admin_pin failed, trying fallback:', e);
      }
    }

    // 2. Try Direct Sheets API if OAuth token and Sheet ID are provided
    if (sheetId && oauthToken && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Admin_Config!A2:B2`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${oauthToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const val = data.values?.[0]?.[1] || data.values?.[0]?.[0];
          if (val) {
            const remotePin = String(val).trim();
            storageService.saveSettings({ adminPin: remotePin });
            return {
              success: true,
              pin: remotePin,
              source: 'google_sheets',
              message: 'ดึงรหัส PIN จากตาราง Admin_Config สำเร็จ',
            };
          }
        }
      } catch (e) {
        console.warn('Direct Sheets API PIN fetch error:', e);
      }
    }

    // 3. Fallback to Local Cached PIN (Guarantees offline field access)
    return {
      success: true,
      pin: cachedPin,
      source: 'local_cache',
      message: 'ใช้รหัส PIN จากแคชในเครื่อง (โหมดออฟไลน์)',
    };
  }

  /**
   * Updates Admin PIN in Google Sheets and updates local cache.
   */
  public async saveAdminPin(
    newPin: string,
    appsScriptUrl: string,
    sheetId?: string,
    oauthToken?: string | null
  ): Promise<{ success: boolean; message: string }> {
    const cleanPin = newPin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      throw new Error('รหัส PIN ต้องมีความยาวอย่างน้อย 4 หลัก');
    }

    // Update locally first
    storageService.saveSettings({ adminPin: cleanPin });

    let syncedToRemote = false;

    // 1. Send to Apps Script Webhook
    if (appsScriptUrl && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'set_admin_pin',
            adminPin: cleanPin,
            updatedAt: new Date().toISOString(),
          }),
        });
        if (res.ok) {
          syncedToRemote = true;
        }
      } catch (e) {
        console.warn('Apps Script set_admin_pin error:', e);
      }
    }

    // 2. Direct Sheets API if available
    if (sheetId && oauthToken && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Admin_Config!A2:B2?valueInputOption=USER_ENTERED`;
        await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${oauthToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [['admin_pin', cleanPin]],
          }),
        });
        syncedToRemote = true;
      } catch (e) {
        console.warn('Direct Sheets API PIN update error:', e);
      }
    }

    return {
      success: true,
      message: syncedToRemote
        ? 'บันทึกรหัส PIN ใหม่ขึ้น Google Sheets เรียบร้อยแล้ว'
        : 'บันทึกรหัส PIN ลงเครื่องแล้ว (จะซิงก์ขึ้น Google Sheets เมื่อมีเน็ต)',
    };
  }

  /**
   * Verifies entered PIN against current active PIN
   */
  public verifyPin(enteredPin: string, correctPin: string): boolean {
    return enteredPin.trim() === correctPin.trim();
  }
}

export const adminPinService = new AdminPinService();
