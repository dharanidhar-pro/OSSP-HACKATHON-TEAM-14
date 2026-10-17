import type {
  BuiltInProgram,
  DashboardMetrics,
  LeakFinding,
  LiveSystemTelemetry,
  MemScopeSettings,
  ScanOptions,
  ScanRecord,
} from '../types/memscope';

export interface OverviewResponse {
  metrics: DashboardMetrics;
  recentScans: ScanRecord[];
  recentFindings: LeakFinding[];
  toolchain: LiveSystemTelemetry['toolchainStatus'];
  settings: MemScopeSettings;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (errBody?.error) {
        errorMsg = errBody.error;
      }
    } catch {
      // keep default errorMsg
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  getOverview: () => requestJson<OverviewResponse>('/api/overview'),

  getPrograms: () =>
    requestJson<{
      programs: BuiltInProgram[];
      toolchain: LiveSystemTelemetry['toolchainStatus'];
    }>('/api/programs'),

  getScans: (params?: { status?: string; programId?: string; q?: string }) => {
    const search = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') search.set('status', params.status);
    if (params?.programId && params.programId !== 'ALL') search.set('programId', params.programId);
    if (params?.q) search.set('q', params.q);
    const qs = search.toString();
    return requestJson<{ scans: ScanRecord[] }>(`/api/scans${qs ? `?${qs}` : ''}`);
  },

  getScanById: (scanId: string) =>
    requestJson<{ scan: ScanRecord; findings: LeakFinding[] }>(`/api/scans/${encodeURIComponent(scanId)}`),

  runScan: (options: ScanOptions) =>
    requestJson<{ scan: ScanRecord; findings: LeakFinding[] }>('/api/scans', {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  deleteScan: (scanId: string) =>
    requestJson<{ deletedScanId: string }>(`/api/scans/${encodeURIComponent(scanId)}`, {
      method: 'DELETE',
    }),

  clearAllScans: (mode: 'purge' | 'reset' = 'purge') =>
    requestJson<{ message: string }>(`/api/scans?mode=${mode}`, {
      method: 'DELETE',
    }),

  getFindings: (params?: {
    classification?: string;
    severity?: string;
    programId?: string;
    scanId?: string;
    q?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.classification && params.classification !== 'ALL')
      search.set('classification', params.classification);
    if (params?.severity && params.severity !== 'ALL') search.set('severity', params.severity);
    if (params?.programId && params.programId !== 'ALL') search.set('programId', params.programId);
    if (params?.scanId && params.scanId !== 'ALL') search.set('scanId', params.scanId);
    if (params?.q) search.set('q', params.q);
    const qs = search.toString();
    return requestJson<{ findings: LeakFinding[] }>(`/api/findings${qs ? `?${qs}` : ''}`);
  },

  getFindingById: (findingId: string) =>
    requestJson<{ finding: LeakFinding; scan: ScanRecord | null }>(
      `/api/findings/${encodeURIComponent(findingId)}`
    ),

  getLiveTelemetry: () => requestJson<LiveSystemTelemetry>('/api/live-monitor'),

  triggerSandboxStress: (action: 'allocate' | 'release', sizeMb = 4) =>
    requestJson<LiveSystemTelemetry>('/api/live-monitor/stress', {
      method: 'POST',
      body: JSON.stringify({ action, sizeMb }),
    }),

  getSettings: () =>
    requestJson<{
      settings: MemScopeSettings;
      toolchain: LiveSystemTelemetry['toolchainStatus'];
    }>('/api/settings'),

  updateSettings: (settings: Partial<MemScopeSettings>) =>
    requestJson<{ settings: MemScopeSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

export function triggerFileDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
