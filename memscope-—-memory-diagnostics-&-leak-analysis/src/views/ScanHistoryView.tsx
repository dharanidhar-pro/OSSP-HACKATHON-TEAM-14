import React, { useState, useMemo } from 'react';
import {
  Search,
  Trash2,
  Download,
  Eye,
  RotateCcw,
  Play,
  X,
} from 'lucide-react';
import type { LeakFinding, ScanRecord } from '../types/memscope';
import { triggerFileDownload } from '../api/client';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ScanStatusIndicator,
  formatBytes,
  formatCompactBytes,
  formatDateTime,
} from '../components/ui/Primitives';

interface ScanHistoryViewProps {
  scans: ScanRecord[];
  findings: LeakFinding[];
  selectedScan: ScanRecord | null;
  onSelectScan: (scan: ScanRecord | null) => void;
  onSelectFinding: (finding: LeakFinding) => void;
  onDeleteScan: (scanId: string) => Promise<void>;
  onClearAllScans: (mode: 'purge' | 'reset') => Promise<void>;
  onLaunchScanner: (programId?: string) => void;
}

export function ScanHistoryView({
  scans,
  findings,
  selectedScan,
  onSelectScan,
  onSelectFinding,
  onDeleteScan,
  onClearAllScans,
  onLaunchScanner,
}: ScanHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [scanToDelete, setScanToDelete] = useState<string | null>(null);
  const [confirmPurgeOpen, setConfirmPurgeOpen] = useState(false);

  const filteredScans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scans.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (q) {
        const hay = `${s.id} ${s.programName} ${s.filename} ${s.executionMethod}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scans, searchQuery, statusFilter]);

  const selectedScanFindings = useMemo(() => {
    if (!selectedScan) return [];
    return findings.filter((f) => f.scanId === selectedScan.id);
  }, [selectedScan, findings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Scan Execution History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit historical diagnostic runs, compare heap allocations, and export archival reports
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onClearAllScans('reset')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Baseline Data</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={scans.length === 0}
            onClick={() => setConfirmPurgeOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge History</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4 flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label
            htmlFor="history-search"
            className="block text-[11px] font-medium text-slate-400 mb-1"
          >
            Search Scan ID, Program, or Engine
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="history-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. SCN-1002, sensor_buffer_leak.c..."
              className="w-full h-9 pl-8 pr-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="w-full sm:w-56">
          <label
            htmlFor="history-status-filter"
            className="block text-[11px] font-medium text-slate-400 mb-1"
          >
            Execution Status
          </label>
          <select
            id="history-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="TOOLCHAIN_UNAVAILABLE">Toolchain Unavailable</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Scans Table */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
        {filteredScans.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No Scan Records Found"
              description="Execute a diagnostic run in the Memory Scanner or restore the baseline dataset."
              actionLabel="Launch Memory Scan"
              onAction={() => onLaunchScanner()}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] text-[11px] font-semibold text-slate-400 bg-[#0B0F17]">
                  <th className="py-3 px-4">Scan ID</th>
                  <th className="py-3 px-4">Target Program</th>
                  <th className="py-3 px-4">Detection Engine</th>
                  <th className="py-3 px-4 text-right">Allocs / Frees</th>
                  <th className="py-3 px-4 text-right">Unfreed Bytes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Completed</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {filteredScans.map((scan) => {
                  const isSelected = selectedScan?.id === scan.id;
                  return (
                    <tr
                      key={scan.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-[#161F30]' : 'hover:bg-[#161F30]/60'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-cyan-400 whitespace-nowrap">
                        <div>{scan.id}</div>
                        {scan.isSeeded && (
                          <div className="text-[10px] text-slate-500 font-sans">Baseline</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100">{scan.programName}</div>
                        <div className="text-[11px] font-mono text-slate-400">{scan.filename}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                        {scan.executionMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">
                        {scan.summary.totalAllocations} / {scan.summary.totalFrees}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={
                            scan.summary.unfreedBytes > 0
                              ? 'text-red-400 font-semibold'
                              : 'text-emerald-400'
                          }
                        >
                          {formatCompactBytes(scan.summary.unfreedBytes)}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <ScanStatusIndicator
                          status={scan.status}
                          unfreedBytes={scan.summary.unfreedBytes}
                          runtimeErrors={scan.summary.runtimeErrorsCount}
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {formatDateTime(scan.completedAt)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onSelectScan(scan)}
                            aria-label={`Inspect scan ${scan.id}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </Button>
                          <Button
                            variant="tertiary"
                            size="sm"
                            onClick={() =>
                              triggerFileDownload(
                                `/api/reports/${scan.id}/markdown`,
                                `memscope-${scan.id}.md`
                              )
                            }
                            aria-label={`Download Markdown report for ${scan.id}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="tertiary"
                            size="sm"
                            onClick={() => setScanToDelete(scan.id)}
                            aria-label={`Delete scan ${scan.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Scan Inspector Panel */}
      {selectedScan && (
        <div className="bg-[#111827] border border-cyan-500/40 rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E293B]">
            <div>
              <div className="text-xs font-mono text-cyan-400">
                Inspecting Persisted Scan {selectedScan.id}
              </div>
              <h2 className="text-base font-bold text-slate-100">
                {selectedScan.programName} ({selectedScan.filename})
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onLaunchScanner(selectedScan.programId)}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Re-Scan Target</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  triggerFileDownload(
                    `/api/reports/${selectedScan.id}/markdown`,
                    `memscope-${selectedScan.id}.md`
                  )
                }
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .MD</span>
              </Button>
              <button
                type="button"
                onClick={() => onSelectScan(null)}
                aria-label="Close scan inspector"
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded p-3">
              <div className="text-slate-400">Allocated Bytes</div>
              <div className="text-sm font-bold font-mono text-slate-100 mt-0.5 tabular-nums">
                {formatBytes(selectedScan.summary.totalAllocatedBytes)}
              </div>
            </div>
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded p-3">
              <div className="text-slate-400">Unfreed Bytes</div>
              <div className="text-sm font-bold font-mono text-red-400 mt-0.5 tabular-nums">
                {formatBytes(selectedScan.summary.unfreedBytes)}
              </div>
            </div>
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded p-3">
              <div className="text-slate-400">Outstanding Blocks</div>
              <div className="text-sm font-bold font-mono text-amber-400 mt-0.5 tabular-nums">
                {selectedScan.summary.outstandingBlocks}
              </div>
            </div>
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded p-3">
              <div className="text-slate-400">Findings Emitted</div>
              <div className="text-sm font-bold font-mono text-cyan-400 mt-0.5 tabular-nums">
                {selectedScanFindings.length} finding(s)
              </div>
            </div>
          </div>

          {selectedScanFindings.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                Associated Findings ({selectedScanFindings.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedScanFindings.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 bg-[#0B0F17] border border-[#1E293B] rounded-lg flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="truncate">
                      <div className="font-mono text-cyan-400">{f.id}</div>
                      <div className="text-slate-200 font-medium truncate">{f.title}</div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => onSelectFinding(f)}>
                      Details
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-300 mb-1.5">
              Detector Output Log
            </div>
            <pre className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3.5 text-xs font-mono text-slate-200 overflow-x-auto max-h-56">
              {selectedScan.detectorOutput}
            </pre>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={Boolean(scanToDelete)}
        title={`Delete Scan ${scanToDelete}?`}
        description="This will permanently remove the selected scan record and its associated leak findings from the workspace database."
        confirmLabel="Delete Scan"
        onCancel={() => setScanToDelete(null)}
        onConfirm={async () => {
          if (scanToDelete) {
            await onDeleteScan(scanToDelete);
            setScanToDelete(null);
          }
        }}
      />

      <ConfirmDialog
        open={confirmPurgeOpen}
        title="Purge Entire Scan History?"
        description="This action permanently deletes all recorded scans and leak findings from the database. You can re-seed the baseline sample scans later if needed."
        confirmLabel="Purge All Records"
        onCancel={() => setConfirmPurgeOpen(false)}
        onConfirm={async () => {
          await onClearAllScans('purge');
          setConfirmPurgeOpen(false);
        }}
      />
    </div>
  );
}
