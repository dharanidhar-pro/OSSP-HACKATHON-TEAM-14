import React, { useState } from 'react';
import {
  Play,
  ArrowRight,
  RefreshCw,
  FileSearch,
  Database,
  Activity,
} from 'lucide-react';
import type { OverviewResponse } from '../api/client';
import type { LeakFinding, ScanRecord } from '../types/memscope';
import {
  Button,
  ClassificationIndicator,
  EmptyState,
  ErrorPanel,
  MetricCard,
  ScanStatusIndicator,
  SeverityIndicator,
  formatCompactBytes,
  formatDateTime,
} from '../components/ui/Primitives';

interface OverviewViewProps {
  data: OverviewResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onLaunchScanner: (programId?: string) => void;
  onSelectFinding: (finding: LeakFinding) => void;
  onSelectScan: (scan: ScanRecord) => void;
  onNavigateTab: (tab: string) => void;
  onToggleSampleData: (includeSeeded: boolean) => void;
}

export function OverviewView({
  data,
  loading,
  error,
  onRefresh,
  onLaunchScanner,
  onSelectFinding,
  onSelectScan,
  onNavigateTab,
  onToggleSampleData,
}: OverviewViewProps) {
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorPanel
          title="Unable to Load Diagnostic Overview"
          message={error}
          onRetry={onRefresh}
        />
      </div>
    );
  }

  const metrics = data?.metrics;
  const recentScans = data?.recentScans ?? [];
  const recentFindings = data?.recentFindings ?? [];
  const timeline = metrics?.timelineSeries ?? [];

  const maxTimelineBytes = Math.max(
    1024,
    ...timeline.map((item) => Math.max(item.allocatedBytes, item.unfreedBytes))
  );

  return (
    <div className="space-y-6">
      {/* Top Action & Sample Data Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Workspace Diagnostic Overview
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Heap Allocation Telemetry & Leak Analysis</span>
            {metrics?.hasSeededData && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-cyan-400 font-medium">
                  Includes 4 Baseline Demonstration Scans
                </span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onToggleSampleData(false)}
                  className="underline text-slate-300 hover:text-white cursor-pointer"
                >
                  Hide Sample Data
                </button>
              </>
            )}
            {!metrics?.hasSeededData && data && !data.settings.includeSeededSampleData && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onToggleSampleData(true)}
                  className="underline text-cyan-400 hover:text-cyan-300 cursor-pointer"
                >
                  Restore Baseline Sample Scans
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="md" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button variant="primary" size="md" onClick={() => onLaunchScanner()}>
            <Play className="w-3.5 h-3.5" />
            <span>Launch Memory Scan</span>
          </Button>
        </div>
      </div>

      {/* Row 1: Five Compact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Total Scans"
          loading={loading && !metrics}
          value={metrics ? metrics.totalScans : 0}
          subtext={
            metrics?.hasSeededData
              ? 'Persisted runs (incl. baseline)'
              : 'Persisted diagnostic runs'
          }
          tone="default"
        />
        <MetricCard
          label="Confirmed Leaks"
          loading={loading && !metrics}
          value={metrics ? metrics.confirmedLeaks : 0}
          subtext={
            metrics
              ? `${metrics.possibleLeaks} possible · ${metrics.runtimeErrors} runtime hazards`
              : '0 possible'
          }
          tone={metrics && metrics.confirmedLeaks > 0 ? 'critical' : 'nominal'}
        />
        <MetricCard
          label="Unfreed Bytes"
          loading={loading && !metrics}
          value={metrics ? formatCompactBytes(metrics.unfreedBytes) : '0 B'}
          subtext={
            metrics
              ? `${metrics.unfreedBytes.toLocaleString()} B cumulative unfreed`
              : '0 B cumulative'
          }
          tone={metrics && metrics.unfreedBytes > 0 ? 'warning' : 'nominal'}
        />
        <MetricCard
          label="Outstanding Blocks"
          loading={loading && !metrics}
          value={metrics ? metrics.outstandingBlocks : 0}
          subtext="Heap blocks in use at process exit"
          tone={metrics && metrics.outstandingBlocks > 0 ? 'warning' : 'nominal'}
        />
        <MetricCard
          label="Latest Scan Status"
          loading={loading && !metrics}
          value={
            metrics?.latestScanId ? (
              <span className="text-base">{metrics.latestScanId}</span>
            ) : (
              <span className="text-base">None</span>
            )
          }
          subtext={
            metrics?.latestScanProgram
              ? `${metrics.latestScanProgram} (${metrics.latestScanStatus})`
              : 'No scans executed yet'
          }
          tone="accent"
        />
      </div>

      {/* Row 2: Balanced Two-Column Analytical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column (7 cols): Memory Usage & Unfreed Bytes Over Time */}
        <div className="lg:col-span-7 bg-[#111827] border border-[#1E293B] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Heap Allocation vs. Unfreed Memory Across Scans
                </h2>
                <p className="text-xs text-slate-400">
                  Total allocated bytes (slate) compared against leaked bytes remaining at exit (red/amber)
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-cyan-500/50 border border-cyan-400 inline-block rounded-xs" />
                  <span>Allocated (B)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-red-500/80 inline-block rounded-xs" />
                  <span>Unfreed at Exit (B)</span>
                </span>
              </div>
            </div>

            {timeline.length === 0 ? (
              <EmptyState
                title="No Scan Telemetry Available"
                description="Run a diagnostic scan in the Memory Scanner to plot heap allocation vs. unfreed byte retention across executions."
                actionLabel="Launch Memory Scan"
                onAction={() => onLaunchScanner()}
              />
            ) : (
              <div className="relative pt-2">
                <svg
                  viewBox="0 0 640 210"
                  className="w-full h-52 overflow-visible"
                  role="img"
                  aria-label="Bar chart comparing allocated heap bytes and unfreed bytes per scan"
                >
                  {/* Horizontal Grid Lines & Y-Axis Labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = 170 - ratio * 140;
                    const valBytes = Math.round(maxTimelineBytes * ratio);
                    return (
                      <g key={idx}>
                        <line
                          x1="56"
                          y1={y}
                          x2="625"
                          y2={y}
                          stroke="#1E293B"
                          strokeDasharray={ratio === 0 ? undefined : '3 3'}
                          strokeWidth="1"
                        />
                        <text
                          x="50"
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-400 text-[10px] font-mono"
                        >
                          {formatCompactBytes(valBytes)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Bars for each scan */}
                  {timeline.map((pt, idx) => {
                    const slotWidth = 560 / Math.max(1, timeline.length);
                    const centerX = 64 + idx * slotWidth + slotWidth / 2;
                    const barW = Math.min(22, Math.max(10, slotWidth * 0.34));

                    const allocHeight = Math.max(
                      3,
                      (pt.allocatedBytes / maxTimelineBytes) * 140
                    );
                    const unfreedHeight =
                      pt.unfreedBytes > 0
                        ? Math.max(4, (pt.unfreedBytes / maxTimelineBytes) * 140)
                        : 0;

                    return (
                      <g
                        key={pt.scanId}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredBarIndex(idx)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                      >
                        {/* Allocated bar */}
                        <rect
                          x={centerX - barW - 2}
                          y={170 - allocHeight}
                          width={barW}
                          height={allocHeight}
                          rx="2"
                          className="fill-cyan-500/40 stroke-cyan-400"
                          strokeWidth="1"
                        />
                        {/* Unfreed bar */}
                        <rect
                          x={centerX + 2}
                          y={170 - unfreedHeight}
                          width={barW}
                          height={unfreedHeight}
                          rx="2"
                          className="fill-red-500/85"
                        />
                        {/* X-axis Scan Label */}
                        <text
                          x={centerX}
                          y="190"
                          textAnchor="middle"
                          className="fill-slate-300 text-[10px] font-mono"
                        >
                          {pt.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Accessible Tooltip / Active Readout */}
                <div className="mt-2 pt-2.5 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 font-mono">
                  {hoveredBarIndex !== null && timeline[hoveredBarIndex] ? (
                    <>
                      <span>
                        {timeline[hoveredBarIndex].scanId} · {timeline[hoveredBarIndex].programName}
                      </span>
                      <span>
                        Allocated: {timeline[hoveredBarIndex].allocatedBytes.toLocaleString()} B ·{' '}
                        <span className="text-red-400">
                          Unfreed: {timeline[hoveredBarIndex].unfreedBytes.toLocaleString()} B
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-sans">
                      Hover over any scan bar to inspect exact byte counts. Peak workspace allocation:{' '}
                      <span className="font-mono text-slate-200">
                        {formatCompactBytes(maxTimelineBytes)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Leak Findings by Classification & Severity */}
        <div className="lg:col-span-5 bg-[#111827] border border-[#1E293B] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 mb-1">
              Findings by Evidence Classification & Severity
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              Distribution of verified outstanding blocks, interior pointer risks, and runtime errors
            </p>

            {metrics && (
              <div className="space-y-4">
                {[
                  {
                    label: 'Confirmed Leaks (Definitely Lost)',
                    count: metrics.classificationBreakdown.CONFIRMED_LEAK,
                    barColor: 'bg-red-500',
                    textColor: 'text-red-400',
                  },
                  {
                    label: 'Possible Leaks (Interior Pointer / Conditional)',
                    count: metrics.classificationBreakdown.POSSIBLE_LEAK,
                    barColor: 'bg-amber-500',
                    textColor: 'text-amber-400',
                  },
                  {
                    label: 'Runtime Heap Hazards (Double Free / Limit)',
                    count: metrics.classificationBreakdown.RUNTIME_ERROR,
                    barColor: 'bg-rose-500',
                    textColor: 'text-rose-400',
                  },
                  {
                    label: 'Toolchain Evidence Unavailable',
                    count: metrics.classificationBreakdown.EVIDENCE_UNAVAILABLE,
                    barColor: 'bg-slate-500',
                    textColor: 'text-slate-300',
                  },
                ].map((row) => {
                  const total = Math.max(
                    1,
                    metrics.classificationBreakdown.CONFIRMED_LEAK +
                      metrics.classificationBreakdown.POSSIBLE_LEAK +
                      metrics.classificationBreakdown.RUNTIME_ERROR +
                      metrics.classificationBreakdown.EVIDENCE_UNAVAILABLE
                  );
                  const pct = Math.round((row.count / total) * 100);
                  return (
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">{row.label}</span>
                        <span className={`font-mono font-semibold tabular-nums ${row.textColor}`}>
                          {row.count} ({row.count === 0 ? 0 : pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#0B0F17] rounded-sm overflow-hidden border border-[#1E293B]">
                        <div
                          className={`h-full ${row.barColor} transition-all duration-200`}
                          style={{ width: `${row.count === 0 ? 0 : Math.max(6, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Severity Summary Strip */}
          {metrics && (
            <div className="mt-6 pt-4 border-t border-[#1E293B] grid grid-cols-4 gap-2 text-center">
              <div className="bg-[#0B0F17] border border-[#1E293B] rounded p-2">
                <div className="text-[11px] text-slate-400">Critical</div>
                <div className="text-sm font-bold font-mono text-red-400 tabular-nums">
                  {metrics.severityBreakdown.CRITICAL}
                </div>
              </div>
              <div className="bg-[#0B0F17] border border-[#1E293B] rounded p-2">
                <div className="text-[11px] text-slate-400">High</div>
                <div className="text-sm font-bold font-mono text-amber-400 tabular-nums">
                  {metrics.severityBreakdown.HIGH}
                </div>
              </div>
              <div className="bg-[#0B0F17] border border-[#1E293B] rounded p-2">
                <div className="text-[11px] text-slate-400">Medium</div>
                <div className="text-sm font-bold font-mono text-yellow-300 tabular-nums">
                  {metrics.severityBreakdown.MEDIUM}
                </div>
              </div>
              <div className="bg-[#0B0F17] border border-[#1E293B] rounded p-2">
                <div className="text-[11px] text-slate-400">Low</div>
                <div className="text-sm font-bold font-mono text-cyan-400 tabular-nums">
                  {metrics.severityBreakdown.LOW}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Two-Column Recent Scans Table & Recent Findings List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Scans Table (7 cols) */}
        <div className="lg:col-span-7 bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Recent Diagnostic Scans</h2>
              <p className="text-xs text-slate-400">
                Latest instrumented target executions and exit heap balances
              </p>
            </div>
            <Button variant="tertiary" size="sm" onClick={() => onNavigateTab('history')}>
              <span>All Scans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {recentScans.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No Scans Recorded"
                description="Execute a built-in C target or custom snippet in the Memory Scanner."
                actionLabel="Open Scanner"
                onAction={() => onLaunchScanner()}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E293B] text-[11px] font-semibold text-slate-400 bg-[#0B0F17]/60">
                    <th className="py-2.5 px-3">Scan ID</th>
                    <th className="py-2.5 px-3">Target Program</th>
                    <th className="py-2.5 px-3 text-right">Unfreed</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B] text-xs">
                  {recentScans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-[#161F30]/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-cyan-400 whitespace-nowrap">
                        {scan.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-200 truncate max-w-[165px]">
                          {scan.programName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-[165px]">
                          {scan.filename} · {formatDateTime(scan.completedAt)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">
                        {formatCompactBytes(scan.summary.unfreedBytes)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <ScanStatusIndicator
                          status={scan.status}
                          unfreedBytes={scan.summary.unfreedBytes}
                          runtimeErrors={scan.summary.runtimeErrorsCount}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onSelectScan(scan)}
                          aria-label={`Inspect scan ${scan.id}`}
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Findings List (5 cols) */}
        <div className="lg:col-span-5 bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Recent Leak Findings</h2>
              <p className="text-xs text-slate-400">
                Verified unfreed allocations and heap corruption events
              </p>
            </div>
            <Button variant="tertiary" size="sm" onClick={() => onNavigateTab('findings')}>
              <span>All Findings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {recentFindings.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No Leak Findings Recorded"
                description="All analyzed targets either passed cleanly or no scans have been executed."
              />
            </div>
          ) : (
            <div className="divide-y divide-[#1E293B]">
              {recentFindings.map((f) => (
                <div
                  key={f.id}
                  className="p-4 hover:bg-[#161F30]/60 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span className="text-cyan-400">{f.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {f.filename}:{f.locationLine}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums text-slate-200">
                        {formatCompactBytes(f.totalLeakedBytes)}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-100 truncate" title={f.title}>
                      {f.title}
                    </div>
                    <div className="flex items-center gap-3 pt-0.5">
                      <ClassificationIndicator classification={f.classification} />
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <SeverityIndicator severity={f.severity} />
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSelectFinding(f)}
                    aria-label={`View details for finding ${f.id}`}
                  >
                    <FileSearch className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick System Readiness Strip */}
      {data?.toolchain && (
        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5 text-slate-300">
            <Database className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Active Detection Engine:{' '}
              <strong className="text-slate-100">
                {data.toolchain.memscopeInterceptor.version}
              </strong>{' '}
              · Python Sandbox:{' '}
              <strong className="text-slate-100">
                {data.toolchain.python3.available ? data.toolchain.python3.version : 'Unavailable'}
              </strong>{' '}
              · Host Valgrind:{' '}
              <strong className="text-slate-300">
                {data.toolchain.valgrind.available ? 'Installed' : 'Not installed in container'}
              </strong>
            </span>
          </div>
          <Button variant="tertiary" size="sm" onClick={() => onNavigateTab('live')}>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Inspect Live Process Memory</span>
          </Button>
        </div>
      )}
    </div>
  );
}
