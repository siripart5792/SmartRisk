/**
 * Real-time Network Connectivity & Active Health Probe Service
 * Overcomes browser navigator.onLine false-negatives (especially in sandboxed iframes & mobile webviews).
 */

export type ConnectivityListener = (isOnline: boolean) => void;

class ConnectivityService {
  private isOnline: boolean = true;
  private listeners: Set<ConnectivityListener> = new Set();
  private checkIntervalId: NodeJS.Timeout | null = null;
  private isChecking: boolean = false;
  private appsScriptUrl: string = '';

  constructor() {
    // Optimistic initial state - check navigator if available, default to true
    if (typeof navigator !== 'undefined') {
      this.isOnline = navigator.onLine !== false;
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleBrowserEvent(true));
      window.addEventListener('offline', () => this.handleBrowserEvent(false));
      window.addEventListener('focus', () => this.checkConnectivityNow());

      // Start periodic probe
      this.startPeriodicCheck();
      // Run immediate initial probe
      setTimeout(() => this.checkConnectivityNow(), 300);
    }
  }

  public setAppsScriptUrl(url: string) {
    this.appsScriptUrl = url;
  }

  public getStatus(): boolean {
    return this.isOnline;
  }

  public subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    // Immediately inform current status
    listener(this.isOnline);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.isOnline);
      } catch (err) {
        console.error('Connectivity listener error:', err);
      }
    });
  }

  private handleBrowserEvent(onlineFromEvent: boolean) {
    if (onlineFromEvent) {
      this.isOnline = true;
      this.notify();
      // Verify with probe
      this.checkConnectivityNow();
    } else {
      // Before believing browser offline event, verify with probe
      // (some browsers fire offline intermittently during network handover)
      this.checkConnectivityNow();
    }
  }

  /**
   * Actively probes the network using lightweight no-cors requests.
   * If any network request succeeds (even opaque response), internet is 100% confirmed working.
   */
  public async checkConnectivityNow(): Promise<boolean> {
    if (this.isChecking) return this.isOnline;
    this.isChecking = true;

    try {
      const probeResult = await this.probeNetwork();
      if (this.isOnline !== probeResult) {
        this.isOnline = probeResult;
        this.notify();
      }
      return probeResult;
    } catch {
      // In case of unexpected error, fallback to navigator.onLine
      const fallback = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (this.isOnline !== fallback) {
        this.isOnline = fallback;
        this.notify();
      }
      return fallback;
    } finally {
      this.isChecking = false;
    }
  }

  private async probeNetwork(): Promise<boolean> {
    const timestamp = Date.now();

    // Probe 1: Ping Google Apps Script or Google 204
    // Using mode: 'no-cors' allows detecting connectivity even without CORS headers
    const testUrls: string[] = [];
    if (this.appsScriptUrl) {
      testUrls.push(`${this.appsScriptUrl}?action=ping&_=${timestamp}`);
    }
    testUrls.push(`https://www.google.com/generate_204?_=${timestamp}`);

    for (const url of testUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        await fetch(url, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        // If fetch didn't throw a network error, internet is active!
        return true;
      } catch {
        // Try next URL
        continue;
      }
    }

    // Probe 2: Try local origin ping
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`/?_=${timestamp}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok || res.status < 500) {
        return true;
      }
    } catch {
      // Local server unreachable
    }

    // If all probes failed, check navigator
    return typeof navigator !== 'undefined' ? navigator.onLine : false;
  }

  private startPeriodicCheck() {
    if (this.checkIntervalId) clearInterval(this.checkIntervalId);
    // Periodically probe every 12 seconds
    this.checkIntervalId = setInterval(() => {
      this.checkConnectivityNow();
    }, 12000);
  }
}

export const connectivityService = new ConnectivityService();
