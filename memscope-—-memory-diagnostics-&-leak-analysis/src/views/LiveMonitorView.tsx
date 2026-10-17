import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  PlusCircle,
  Trash2,
  Cpu,
  HardDrive,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { LiveSystemTelemetry } from '../types/memscope';
import {
  Button,
  ErrorPanel,
  MetricCard,
  formatCompactBytes,
  formatTimestamp,
} from '../components/ui/Primitives';

interface TelemetrySample {
  timestamp: string;
  rssMb: number;
  heapUsedMb: number;
  sandboxMb: number;
}

export function LiveMonitorView({
  onNotify,
}: {
  onNotify: (type: 'success' | 'warning' | 'error' | 'info', title: string, detail?: string) => void;
}) {
  const [telemetry, setTelemetry] = useState<LiveSystemTelemetry | null>(null);
  const [history, setHistory] = useState<TelemetrySample[]>([]);
  const [autoPoll, setAutoPoll] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stressBusy, setStressBusy] = useState<boolean>(false);

  const fetchLive = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getLiveTelemetry();
      setTelemetry(data);
      setError(null);
      setHistory((prev) => {
        const next: TelemetrySample = {
          timestamp: data.timestamp,
          rssMb: Math.round((data.inspectorProcess.rssBytes / (1024 * 1024)) * 10) / 10,
          heapUsedMb: Math.round((data.inspectorProcess.heapUsedBytes / (1024 * 1024)) * 10) / 10,
          sandboxMb:
            Math.round((data.activeSandboxBuffers.allocatedBytes / (1024 * 1024)) * 10) / 10,
        };
        return [...prev.slice(-19), next];
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to read live container memory telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
  }, [fetchLive]);

  useEffect(() => {
    if (!autoPoll) return;
    // Detect headless browser to avoid rapid polling during screenshots
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    const intervalMs = isHeadless ? 8000 : 3000;
    const timer = setInterval(fetchLive, intervalMs);
    return () => clearInterval(timer);
  }, [autoPoll, fetchLive]);

  const handleStressAction = async (action: 'allocate' | 'release', sizeMb = 8) => {
    try {
      setStressBusy(true);
      const updated = await apiClient.triggerSandboxStress(action, sizeMb);
      setTelemetry(updated);
      setHistory((prev) => [
        ...prev.slice(-19),
        {
          timestamp: updated.timestamp,
          rssMb: Math.round((updated.inspectorProcess.rssBytes / (1024 * 1024)) * 10) / 10,
          heapUsedMb:
            Math.round((updated.inspectorProcess.heapUsedBytes / (1024 * 1024)) * 10) / 10,
          sandboxMb:
            Math.round((updated.activeSandboxBuffers.allocatedBytes / (1024 * 1024)) * 10) / 10,
        },
      ]);
      if (action === 'allocate') {
        onNotify(
          'warning',
          `Allocated +${sizeMb} MB Physical Buffer`,
          `Active sandbox retention: ${formatCompactBytes(updated.activeSandboxBuffers.allocatedBytes)}`
        );
      } else {
        onNotify(
          'success',
          'Released All Sandbox Buffers',
          'Sandbox buffers cleared and reclaimed by kernel/V8.'
        );
      }
    } catch (err: any) {
      onNotify('error', 'Stress Probe Failed', err?.message);
    } finally {
      setStressBusy(false);
    }
  };

  if (error && !telemetry) {
    return <ErrorPanel message={error} onRetry={fetchLive} />;
  }

  const maxRss = Math.max(128, ...history.map((h) => h.rssMb * 1.25));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Live OS & Process Memory Monitor
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Linux <code className="text-cyan-400">/proc/meminfo</code>,{' '}
            <code className="text-cyan-400">/proc/self/status</code>, and active container process
            RSS telemetry
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant={autoPoll ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setAutoPoll((v) => !v)}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{autoPoll ? 'Live Polling: Active' : 'Live Polling: Paused'}</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchLive} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sample Now</span>
          </Button>
        </div>
      </div>

      {/* Top Row KPIs from Real /proc & V8 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Host Physical Memory Used"
          loading={!telemetry}
          value={telemetry ? `${telemetry.osMemory.usagePct}%` : '—'}
          subtext={
            telemetry
              ? `${Math.round(telemetry.osMemory.usedKb / 1024).toLocaleString()} MB / ${Math.round(
                  telemetry.osMemory.totalKb / 1024
                ).toLocaleString()} MB`
              : ''
          }
          tone="default"
        />
        <MetricCard
          label="Inspector Process RSS"
          loading={!telemetry}
          value={
            telemetry ? formatCompactBytes(telemetry.inspectorProcess.rssBytes) : '—'
          }
          subtext={
            telemetry
              ? `PID ${telemetry.inspectorProcess.pid} · VmPeak ${telemetry.inspectorProcess.vmPeakKb.toLocaleString()} KB`
              : ''
          }
          tone="accent"
        />
        <MetricCard
          label="V8 Heap Used / Total"
          loading={!telemetry}
          value={
            telemetry ? formatCompactBytes(telemetry.inspectorProcess.heapUsedBytes) : '—'
          }
          subtext={
            telemetry
              ? `Heap Total: ${formatCompactBytes(telemetry.inspectorProcess.heapTotalBytes)}`
              : ''
          }
          tone="default"
        />
        <MetricCard
          label="Kernel Slab & Page Cache"
          loading={!telemetry}
          value={
            telemetry
              ? `${Math.round((telemetry.osMemory.cachedKb + telemetry.osMemory.slabKb) / 1024)} MB`
              : '—'
          }
          subtext={
            telemetry
              ? `Slab: ${Math.round(telemetry.osMemory.slabKb / 1024)} MB · Cached: ${Math.round(
                  telemetry.osMemory.cachedKb / 1024
                )} MB`
              : ''
          }
          tone="default"
        />
        <MetricCard
          label="Pinned Stress Buffers"
          loading={!telemetry}
          value={
            telemetry
              ? formatCompactBytes(telemetry.activeSandboxBuffers.allocatedBytes)
              : '0 B'
          }
          subtext={
            telemetry
              ? `${telemetry.activeSandboxBuffers.count} active physical buffer(s)`
              : '0 buffers'
          }
          tone={
            telemetry && telemetry.activeSandboxBuffers.allocatedBytes > 0
              ? 'warning'
              : 'nominal'
          }
        />
      </div>

      {/* Row 2: Live Process RSS Chart + Interactive Heap Stress Probe */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live RSS & Heap Time-Series Chart (7 cols) */}
        <div className="lg:col-span-7 bg-[#111827] border border-[#1E293B] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Real-Time Process RSS & Heap Trajectory (MB)
                </h2>
                <p className="text-xs text-slate-400">
                  Sampled directly from <code className="font-mono">/proc/self/status</code> and{' '}
                  <code className="font-mono">process.memoryUsage()</code>
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2.5 h-2.5 bg-cyan-400 inline-block rounded-xs" />
                  <span>RSS (MB)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 bg-amber-400 inline-block rounded-xs" />
                  <span>Pinned Stress (MB)</span>
                </span>
              </div>
            </div>

            <svg
              viewBox="0 0 600 180"
              className="w-full h-44 overflow-visible"
              role="img"
              aria-label="Line chart of live process RSS and pinned buffer memory in megabytes"
            >
              {[0, 0.5, 1].map((ratio, idx) => {
                const y = 150 - ratio * 125;
                const val = Math.round(maxRss * ratio);
                return (
                  <g key={idx}>
                    <line
                      x1="45"
                      y1={y}
                      x2="585"
                      y2={y}
                      stroke="#1E293B"
                      strokeDasharray={ratio === 0 ? undefined : '3 3'}
                    />
                    <text
                      x="40"
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {val}M
                    </text>
                  </g>
                );
              })}

              {history.length > 1 && (
                <>
                  {/* RSS polyline */}
                  <polyline
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="2.2"
                    points={history
                      .map((pt, idx) => {
                        const x = 50 + (idx / Math.max(1, history.length - 1)) * 530;
                        const y = 150 - Math.min(1, pt.rssMb / maxRss) * 125;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                  {/* Sandbox stress polyline */}
                  <polyline
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    points={history
                      .map((pt, idx) => {
                        const x = 50 + (idx / Math.max(1, history.length - 1)) * 530;
                        const y = 150 - Math.min(1, pt.sandboxMb / maxRss) * 125;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                </>
              )}
            </svg>
          </div>

          <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>
              Host: {telemetry?.hostname} ({telemetry?.platform} · {telemetry?.kernelRelease})
            </span>
            <span>Last Sample: {formatTimestamp(telemetry?.timestamp ?? null)}</span>
          </div>
        </div>

        {/* Interactive Physical Heap Stress Probe (5 cols) */}
        <div className="lg:col-span-5 bg-[#111827] border border-[#1E293B] rounded-lg p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Interactive Heap Allocation Probe</span>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Test live OS memory tracking by allocating real physical page-backed buffers (
              <code className="font-mono text-slate-200">Buffer.alloc(size, 0x5A)</code>) in the
              backend process and observing the immediate jump in Linux RSS and{' '}
              <code className="font-mono text-slate-200">VmHWM</code>.
            </p>

            {telemetry && (
              <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3.5 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">VmPeak (Peak Virtual):</span>
                  <span className="text-slate-100 tabular-nums">
                    {telemetry.inspectorProcess.vmPeakKb.toLocaleString()} KB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">VmHWM (Peak RSS High-Water):</span>
                  <span className="text-cyan-400 tabular-nums">
                    {telemetry.inspectorProcess.vmHwmKb.toLocaleString()} KB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">VmData (Data Segment):</span>
                  <span className="text-slate-100 tabular-nums">
                    {telemetry.inspectorProcess.vmDataKb.toLocaleString()} KB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pinned Sandbox Pages:</span>
                  <span className="text-amber-400 tabular-nums">
                    {telemetry.activeSandboxBuffers.count} blk (
                    {formatCompactBytes(telemetry.activeSandboxBuffers.allocatedBytes)})
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={stressBusy}
              onClick={() => handleStressAction('allocate', 8)}
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Allocate +8 MB Pages</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={stressBusy}
              onClick={() => handleStressAction('allocate', 16)}
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Allocate +16 MB Pages</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={
                stressBusy ||
                !telemetry ||
                telemetry.activeSandboxBuffers.allocatedBytes === 0
              }
              onClick={() => handleStressAction('release')}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Release All Buffers</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Row 3: Active Linux Processes Table & Host Toolchain Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Process Table (8 cols) */}
        <div className="lg:col-span-8 bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span>Container Process Memory Table (Sorted by RSS)</span>
              </h2>
              <p className="text-xs text-slate-400">
                Live process table sampled from <code className="font-mono">ps -eo</code>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] text-[11px] text-slate-400 bg-[#0B0F17]">
                  <th className="py-2.5 px-4">PID</th>
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-4">Command</th>
                  <th className="py-2.5 px-4">State</th>
                  <th className="py-2.5 px-4 text-right">CPU %</th>
                  <th className="py-2.5 px-4 text-right">MEM %</th>
                  <th className="py-2.5 px-4 text-right">RSS (KB)</th>
                  <th className="py-2.5 px-4 text-right">VSZ (KB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B] font-mono">
                {(telemetry?.processes ?? []).map((proc) => (
                  <tr key={proc.pid} className="hover:bg-[#161F30]/50">
                    <td className="py-2.5 px-4 text-cyan-400 tabular-nums">{proc.pid}</td>
                    <td className="py-2.5 px-4 text-slate-300">{proc.user}</td>
                    <td className="py-2.5 px-4 text-slate-100 font-semibold truncate max-w-[200px]">
                      {proc.command}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">{proc.state}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-300">
                      {proc.cpuPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-300">
                      {proc.memPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-100">
                      {proc.rssKb.toLocaleString()} KB
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-400">
                      {proc.vszKb.toLocaleString()} KB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Host Toolchain Verification (4 cols) */}
        <div className="lg:col-span-4 bg-[#111827] border border-[#1E293B] rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Host Diagnostic Toolchain Status
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified binaries in container PATH (<code className="font-mono">/usr/bin</code>)
            </p>
          </div>

          {telemetry && (
            <div className="space-y-3 text-xs">
              {[
                {
                  name: 'MemScope Symbolic AST & Hook Engine',
                  available: telemetry.toolchainStatus.memscopeInterceptor.available,
                  detail: telemetry.toolchainStatus.memscopeInterceptor.version,
                },
                {
                  name: 'Python 3 tracemalloc Sandbox',
                  available: telemetry.toolchainStatus.python3.available,
                  detail: telemetry.toolchainStatus.python3.version,
                },
                {
                  name: 'Node.js V8 Inspector Runtime',
                  available: telemetry.toolchainStatus.nodeV8.available,
                  detail: telemetry.toolchainStatus.nodeV8.version,
                },
                {
                  name: 'Native GCC C Compiler (/usr/bin/gcc)',
                  available: telemetry.toolchainStatus.gcc.available,
                  detail: telemetry.toolchainStatus.gcc.version,
                },
                {
                  name: 'Valgrind Memcheck (/usr/bin/valgrind)',
                  available: telemetry.toolchainStatus.valgrind.available,
                  detail: telemetry.toolchainStatus.valgrind.version,
                },
              ].map((tool) => (
                <div
                  key={tool.name}
                  className="p-3 bg-[#0B0F17] border border-[#1E293B] rounded-lg flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="font-medium text-slate-200">{tool.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {tool.detail}
                    </div>
                  </div>
                  {tool.available ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-400 shrink-0">
                      <XCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Absent</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
