import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  ScanSearch,
  Activity,
  AlertOctagon,
  History,
  FileText,
  BookOpen,
  Settings,
  Menu,
  X,
  Play,
  ChevronRight,
} from 'lucide-react';
import { apiClient, type OverviewResponse } from './api/client';
import type {
  BuiltInProgram,
  LeakFinding,
  ScanOptions,
  ScanRecord,
} from './types/memscope';
import {
  Button,
  MemScopeLogo,
  ToastContainer,
  type ToastMessage,
} from './components/ui/Primitives';
import { FindingDetailModal } from './components/FindingDetailModal';
import { OverviewView } from './views/OverviewView';
import { ScannerView } from './views/ScannerView';
import { LiveMonitorView } from './views/LiveMonitorView';
import { FindingsView } from './views/FindingsView';
import { ScanHistoryView } from './views/ScanHistoryView';
import { ReportsView } from './views/ReportsView';
import { OsspLearningView } from './views/OsspLearningView';
import { SettingsView } from './views/SettingsView';

type NavKey =
  | 'overview'
  | 'scanner'
  | 'live'
  | 'findings'
  | 'history'
  | 'reports'
  | 'learning'
  | 'settings';

interface NavItem {
  id: NavKey;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'scanner', label: 'Memory Scanner', Icon: ScanSearch },
  { id: 'live', label: 'Live Monitor', Icon: Activity },
  { id: 'findings', label: 'Leak Findings', Icon: AlertOctagon },
  { id: 'history', label: 'Scan History', Icon: History },
  { id: 'reports', label: 'Reports', Icon: FileText },
  { id: 'learning', label: 'OSSP Learning', Icon: BookOpen },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

function parseInitialTab(): NavKey {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.replace('#', '').trim().toLowerCase();
  const found = NAV_ITEMS.find((n) => n.id === hash);
  return found ? found.id : 'overview';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavKey>(parseInitialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [overviewData, setOverviewData] = useState<OverviewResponse | null>(null);
  const [programs, setPrograms] = useState<BuiltInProgram[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [findings, setFindings] = useState<LeakFinding[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [scannerProgramId, setScannerProgramId] = useState<string | undefined>(
    undefined
  );
  const [selectedFinding, setSelectedFinding] = useState<LeakFinding | null>(null);
  const [selectedHistoryScan, setSelectedHistoryScan] = useState<ScanRecord | null>(
    null
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (
      type: ToastMessage['type'],
      title: string,
      detail?: string
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, title, detail }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const navigateToTab = useCallback((tab: NavKey) => {
    setActiveTab(tab);
    setSelectedFinding(null);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`);
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setActiveTab(parseInitialTab());
      setSelectedFinding(null);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ov, progRes, scansRes, findingsRes] = await Promise.all([
        apiClient.getOverview(),
        apiClient.getPrograms(),
        apiClient.getScans(),
        apiClient.getFindings(),
      ]);
      setOverviewData(ov);
      setPrograms(progRes.programs);
      setScans(scansRes.scans);
      setFindings(findingsRes.findings);
    } catch (err: any) {
      setError(err?.message || 'Unable to connect to MemScope diagnostic API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const handleExecuteScan = async (options: ScanOptions) => {
    const res = await apiClient.runScan(options);
    await loadWorkspaceData();

    if (res.scan.status === 'TOOLCHAIN_UNAVAILABLE') {
      addToast(
        'warning',
        `Scan ${res.scan.id}: Host Toolchain Absent`,
        'Switch to MemScope Symbolic + Hook Engine for container diagnostics.'
      );
    } else if (res.scan.summary.runtimeErrorsCount > 0) {
      addToast(
        'error',
        `Scan ${res.scan.id}: Runtime Heap Error`,
        `Detected ${res.scan.summary.runtimeErrorsCount} heap hazard(s) and ${res.scan.summary.unfreedBytes} unfreed B.`
      );
    } else if (res.scan.summary.unfreedBytes > 0) {
      addToast(
        'warning',
        `Scan ${res.scan.id}: Memory Leak Detected`,
        `${res.scan.summary.unfreedBytes.toLocaleString()} B unfreed across ${res.scan.summary.outstandingBlocks} block(s).`
      );
    } else {
      addToast(
        'success',
        `Scan ${res.scan.id}: Clean Execution`,
        `Verified 0 leaks in ${res.scan.filename}.`
      );
    }

    return res;
  };

  const handleDeleteScan = async (scanId: string) => {
    await apiClient.deleteScan(scanId);
    if (selectedHistoryScan?.id === scanId) {
      setSelectedHistoryScan(null);
    }
    await loadWorkspaceData();
    addToast('info', `Deleted Scan ${scanId}`, 'Scan record and associated findings removed.');
  };

  const handleClearAllScans = async (mode: 'purge' | 'reset') => {
    await apiClient.clearAllScans(mode);
    setSelectedHistoryScan(null);
    await loadWorkspaceData();
    addToast(
      'info',
      mode === 'reset' ? 'Baseline Dataset Restored' : 'Scan History Purged',
      mode === 'reset'
        ? 'Restored the 4 default diagnostic baseline scans.'
        : 'All historical scan records have been deleted.'
    );
  };

  const handleSaveSettings = async (updated: any) => {
    await apiClient.updateSettings(updated);
    await loadWorkspaceData();
    addToast('success', 'Settings Saved', 'Workspace configuration updated.');
  };

  const handleToggleSampleData = async (includeSeededSampleData: boolean) => {
    await apiClient.updateSettings({ includeSeededSampleData });
    await loadWorkspaceData();
    addToast(
      'info',
      includeSeededSampleData
        ? 'Baseline Sample Scans Enabled'
        : 'Baseline Sample Scans Hidden',
      includeSeededSampleData
        ? 'Showing both baseline sample scans and your custom scans.'
        : 'Showing only scans you executed during this session.'
    );
  };

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F1F5F9] flex flex-col lg:flex-row">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        aria-label="Primary Workspace Navigation"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#111827] border-r border-[#1E293B] flex flex-col justify-between transition-transform duration-150 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="h-14 px-5 border-b border-[#1E293B] flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigateToTab('overview')}
              className="flex items-center gap-2.5 text-left focus:outline-none cursor-pointer"
            >
              <MemScopeLogo className="w-6 h-6 shrink-0" />
              <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
                MemScope
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation sidebar"
              className="lg:hidden text-slate-400 hover:text-slate-200 p-1 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const isActive = activeTab === id;
              const badgeCount =
                id === 'findings'
                  ? findings.length
                  : id === 'history'
                  ? scans.length
                  : null;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigateToTab(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#161F30] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    />
                    <span>{label}</span>
                  </span>
                  {badgeCount !== null && (
                    <span className="font-mono text-[11px] tabular-nums text-slate-400">
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#1E293B] text-[11px] text-slate-400 space-y-1">
          <div className="font-semibold text-slate-300">
            Memory Diagnostics & Leak Analysis
          </div>
          <div className="font-mono text-[10px] text-slate-500">
            Engine v2.4 · Linux /proc + AST Hook
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on Left, Primary Action on Right */}
        <header className="h-14 px-4 sm:px-6 bg-[#111827] border-b border-[#1E293B] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation sidebar"
              className="lg:hidden text-slate-300 hover:text-white p-1.5 rounded-md hover:bg-[#1E293B] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs truncate">
              <button
                type="button"
                onClick={() => navigateToTab('overview')}
                className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                MemScope
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
              <span className="text-slate-100 font-semibold truncate">
                {currentNav.label}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-block text-xs font-mono text-slate-400">
              env: linux-container-x64
            </span>
            {activeTab !== 'scanner' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigateToTab('scanner')}
              >
                <Play className="w-3.5 h-3.5" />
                <span>New Scan</span>
              </Button>
            )}
          </div>
        </header>

        {/* Main Workspace Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              data={overviewData}
              loading={loading}
              error={error}
              onRefresh={loadWorkspaceData}
              onLaunchScanner={(progId) => {
                if (progId) setScannerProgramId(progId);
                navigateToTab('scanner');
              }}
              onSelectFinding={(f) => setSelectedFinding(f)}
              onSelectScan={(s) => {
                setSelectedHistoryScan(s);
                navigateToTab('history');
              }}
              onNavigateTab={(t) => navigateToTab(t as NavKey)}
              onToggleSampleData={handleToggleSampleData}
            />
          )}

          {activeTab === 'scanner' && (
            <ScannerView
              programs={programs}
              toolchain={overviewData?.toolchain ?? null}
              defaultSettings={overviewData?.settings ?? null}
              initialProgramId={scannerProgramId}
              onExecuteScan={handleExecuteScan}
              onSelectFinding={(f) => setSelectedFinding(f)}
            />
          )}

          {activeTab === 'live' && <LiveMonitorView onNotify={addToast} />}

          {activeTab === 'findings' && (
            <FindingsView
              findings={findings}
              programs={programs}
              loading={loading}
              onSelectFinding={(f) => setSelectedFinding(f)}
              onLaunchScanner={() => navigateToTab('scanner')}
            />
          )}

          {activeTab === 'history' && (
            <ScanHistoryView
              scans={scans}
              findings={findings}
              selectedScan={selectedHistoryScan}
              onSelectScan={setSelectedHistoryScan}
              onSelectFinding={(f) => setSelectedFinding(f)}
              onDeleteScan={handleDeleteScan}
              onClearAllScans={handleClearAllScans}
              onLaunchScanner={(progId) => {
                if (progId) setScannerProgramId(progId);
                navigateToTab('scanner');
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              scans={scans}
              findings={findings}
              onLaunchScanner={() => navigateToTab('scanner')}
            />
          )}

          {activeTab === 'learning' && (
            <OsspLearningView
              onLaunchScanner={(progId) => {
                if (progId) setScannerProgramId(progId);
                navigateToTab('scanner');
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={overviewData?.settings ?? null}
              toolchain={overviewData?.toolchain ?? null}
              onSaveSettings={handleSaveSettings}
              onResetWorkspace={() => handleClearAllScans('reset')}
            />
          )}
        </main>
      </div>

      {/* Finding Inspector Slide-Over Modal */}
      <FindingDetailModal
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onNavigateToScan={(scanId) => {
          const found = scans.find((s) => s.id === scanId) ?? null;
          setSelectedHistoryScan(found);
          navigateToTab('history');
        }}
      />

      {/* Toast Notification Stack */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
