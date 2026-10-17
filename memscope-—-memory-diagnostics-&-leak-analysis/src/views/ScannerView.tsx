import React, { useState, useEffect } from 'react';
import {
  Play,
  FileCode,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileSearch,
  Terminal,
  RotateCcw,
} from 'lucide-react';
import type {
  BuiltInProgram,
  ExecutionMethod,
  LeakFinding,
  LiveSystemTelemetry,
  MemScopeSettings,
  ScanOptions,
  ScanRecord,
} from '../types/memscope';
import { validateScanOptions } from '../engine/memoryEngine';
import { triggerFileDownload } from '../api/client';
import {
  Button,
  ClassificationIndicator,
  ScanStatusIndicator,
  SeverityIndicator,
  formatBytes,
  formatCompactBytes,
} from '../components/ui/Primitives';

interface ScannerViewProps {
  programs: BuiltInProgram[];
  toolchain: LiveSystemTelemetry['toolchainStatus'] | null;
  defaultSettings: MemScopeSettings | null;
  initialProgramId?: string;
  onExecuteScan: (
    options: ScanOptions
  ) => Promise<{ scan: ScanRecord; findings: LeakFinding[] }>;
  onSelectFinding: (finding: LeakFinding) => void;
}

export function ScannerView({
  programs,
  toolchain,
  defaultSettings,
  initialProgramId,
  onExecuteScan,
  onSelectFinding,
}: ScannerViewProps) {
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    initialProgramId || programs[0]?.id || 'prog-sensor-telemetry'
  );
  const [executionMethod, setExecutionMethod] = useState<ExecutionMethod>(
    defaultSettings?.defaultExecutionMethod || 'MEMSCOPE_INTERCEPTOR'
  );
  const [timeoutMs, setTimeoutMs] = useState<number>(
    defaultSettings?.defaultTimeoutMs || 5000
  );
  const [maxHeapKb, setMaxHeapKb] = useState<number>(
    defaultSettings?.defaultMaxHeapKb || 65536
  );
  const [loopBound, setLoopBound] = useState<number>(
    defaultSettings?.defaultLoopBound || 4
  );
  const [trackOrigins, setTrackOrigins] = useState<boolean>(true);
  const [detectDoubleFree, setDetectDoubleFree] = useState<boolean>(true);
  const [customSource, setCustomSource] = useState<string>('');

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStageText, setScanStageText] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<{
    scan: ScanRecord;
    findings: LeakFinding[];
  } | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<
    'allocations' | 'findings' | 'detector' | 'stdio'
  >('allocations');

  useEffect(() => {
    if (initialProgramId) {
      setSelectedProgramId(initialProgramId);
    }
  }, [initialProgramId]);

  const currentProgram =
    programs.find((p) => p.id === selectedProgramId) || programs[0];

  useEffect(() => {
    if (currentProgram && currentProgram.id === 'prog-custom-c' && !customSource) {
      setCustomSource(currentProgram.sourceCode);
    }
  }, [currentProgram, customSource]);

  const handleRunScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isScanning) return;

    const candidateOptions: ScanOptions = {
      programId: selectedProgramId,
      executionMethod,
      timeoutMs: Number(timeoutMs),
      maxHeapKb: Number(maxHeapKb),
      loopBound: Number(loopBound),
      trackOrigins,
      detectDoubleFree,
      customSource:
        selectedProgramId === 'prog-custom-c' ? customSource : undefined,
    };

    const check = validateScanOptions(candidateOptions);
    if (!check.valid) {
      const errMap: Record<string, string> = {};
      for (const issue of check.issues) {
        errMap[issue.field] = issue.message;
      }
      setValidationErrors(errMap);
      return;
    }

    setValidationErrors({});
    setApiError(null);
    setIsScanning(true);
    setScanStageText('Step 5/6: Initializing sandbox & verifying target AST...');

    try {
      await new Promise((r) => setTimeout(r, 160));
      setScanStageText(
        'Step 5/6: Tracing heap allocations (malloc/calloc/realloc) and pointer lifetimes...'
      );
      const res = await onExecuteScan(candidateOptions);
      setCompletedResult(res);
      setActiveResultTab(res.findings.length > 0 ? 'findings' : 'allocations');
      setTimeout(() => {
        document.getElementById('scan-results-panel')?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 60);
    } catch (err: any) {
      setApiError(err?.message || 'Scan execution failed unexpectedly.');
    } finally {
      setIsScanning(false);
      setScanStageText('');
    }
  };

  const handleResetDefaults = () => {
    setTimeoutMs(defaultSettings?.defaultTimeoutMs || 5000);
    setMaxHeapKb(defaultSettings?.defaultMaxHeapKb || 65536);
    setLoopBound(defaultSettings?.defaultLoopBound || 4);
    setExecutionMethod(defaultSettings?.defaultExecutionMethod || 'MEMSCOPE_INTERCEPTOR');
    setValidationErrors({});
    setApiError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Interactive Memory Scanner
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure target C program, resource guardrails, and heap instrumentation method
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleResetDefaults} disabled={isScanning}>
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Parameters</span>
          </Button>
        </div>
      </div>

      {/* 6-Step Guided Workflow Grid */}
      <form onSubmit={handleRunScan} noValidate className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Step 1 (Target Selection) & Step 2 (Program Source & Behavior) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1 */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-100">
                01. Select Target Program
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {programs.length} Targets Available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {programs.map((prog) => {
                const isSelected = prog.id === selectedProgramId;
                return (
                  <button
                    key={prog.id}
                    type="button"
                    disabled={isScanning}
                    onClick={() => {
                      setSelectedProgramId(prog.id);
                      setValidationErrors({});
                    }}
                    className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#161F30] border-cyan-500 text-slate-100'
                        : 'bg-[#0B0F17] border-[#1E293B] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {prog.name}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-cyan-400 mb-1.5">
                      {prog.filename} · {prog.category}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-2">
                      {prog.description}
                    </div>
                  </button>
                );
              })}
            </div>
            {validationErrors.programId && (
              <p className="text-xs text-red-400 mt-2" role="alert">
                {validationErrors.programId}
              </p>
            )}
          </div>

          {/* Step 2: Program Specification & Source Review */}
          {currentProgram && (
            <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-cyan-400" />
                  <span>02. Target Specification & Source Inspection</span>
                </h2>
                <span className="text-xs font-mono text-slate-400">
                  {currentProgram.filename}
                </span>
              </div>

              <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3.5 space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Program Description: </span>
                  <span className="text-slate-200">{currentProgram.description}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Expected Diagnostic Behavior: </span>
                  <span className="text-cyan-300">{currentProgram.expectedBehavior}</span>
                </div>
              </div>

              {currentProgram.id === 'prog-custom-c' ? (
                <div>
                  <label
                    htmlFor="custom-c-source"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Editable C Source Code (malloc / calloc / realloc / free):
                  </label>
                  <textarea
                    id="custom-c-source"
                    rows={14}
                    disabled={isScanning}
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value)}
                    className="w-full bg-[#0B0F17] border border-[#334155] rounded-lg p-3.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                    placeholder="Paste C source code containing malloc/calloc/free..."
                  />
                  {validationErrors.customSource && (
                    <p className="text-xs text-red-400 mt-1.5" role="alert">
                      {validationErrors.customSource}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-xs text-slate-400 mb-1.5">
                    Read-only Target Source ({currentProgram.sourceCode.split('\n').length} lines):
                  </div>
                  <pre className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3.5 text-xs font-mono text-slate-200 overflow-x-auto max-h-72 leading-relaxed">
                    {currentProgram.sourceCode
                      .split('\n')
                      .map((line, i) => `${String(i + 1).padStart(3, ' ')} | ${line}`)
                      .join('\n')}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Step 3 (Resource Guardrails) & Step 4/5 (Execute Scan) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>03. Execution Engine & Resource Guardrails</span>
            </h2>

            {/* Execution Method Selector */}
            <div>
              <label
                htmlFor="execution-method-select"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Execution & Detection Method
              </label>
              <select
                id="execution-method-select"
                disabled={isScanning}
                value={executionMethod}
                onChange={(e) => setExecutionMethod(e.target.value as ExecutionMethod)}
                className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
              >
                <option value="MEMSCOPE_INTERCEPTOR">
                  MemScope Symbolic + Allocation Hook Engine (Recommended)
                </option>
                <option value="PYTHON_TRACEMALLOC_SANDBOX">
                  Python3 tracemalloc Arena + C-Hook Bridge
                </option>
                <option value="NATIVE_VALGRIND_STRICT">
                  Strict Host Valgrind / GCC Binary (Probes /usr/bin/valgrind)
                </option>
              </select>
              {executionMethod === 'NATIVE_VALGRIND_STRICT' &&
                toolchain &&
                (!toolchain.gcc.available || !toolchain.valgrind.available) && (
                  <p className="text-[11px] text-amber-400 mt-1.5 leading-relaxed">
                    Note: Host binaries (gcc/valgrind) are not installed in this container. Running
                    in Strict Host mode will verify and report a genuine TOOLCHAIN_UNAVAILABLE
                    diagnostic without fabricating output.
                  </p>
                )}
            </div>

            {/* Numeric Resource Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="scan-timeout-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Timeout (ms)
                </label>
                <input
                  id="scan-timeout-input"
                  type="number"
                  min={100}
                  max={30000}
                  disabled={isScanning}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-slate-500">100 – 30,000 ms</span>
              </div>

              <div>
                <label
                  htmlFor="scan-maxheap-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Max Heap (KB)
                </label>
                <input
                  id="scan-maxheap-input"
                  type="number"
                  min={64}
                  max={524288}
                  disabled={isScanning}
                  value={maxHeapKb}
                  onChange={(e) => setMaxHeapKb(Number(e.target.value))}
                  className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-slate-500">64 – 524,288 KB</span>
              </div>

              <div>
                <label
                  htmlFor="scan-loopbound-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Loop Unroll Bound
                </label>
                <input
                  id="scan-loopbound-input"
                  type="number"
                  min={1}
                  max={10000}
                  disabled={isScanning}
                  value={loopBound}
                  onChange={(e) => setLoopBound(Number(e.target.value))}
                  className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-slate-500">1 – 10,000 iter</span>
              </div>
            </div>

            {(validationErrors.timeoutMs ||
              validationErrors.maxHeapKb ||
              validationErrors.loopBound) && (
              <div
                role="alert"
                className="bg-red-500/10 border border-red-500/40 rounded-md p-3 text-xs text-red-300 space-y-1"
              >
                {validationErrors.timeoutMs && <div>• {validationErrors.timeoutMs}</div>}
                {validationErrors.maxHeapKb && <div>• {validationErrors.maxHeapKb}</div>}
                {validationErrors.loopBound && <div>• {validationErrors.loopBound}</div>}
              </div>
            )}

            {/* Checkboxes */}
            <div className="space-y-2.5 pt-2 border-t border-[#1E293B]">
              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackOrigins}
                  disabled={isScanning}
                  onChange={(e) => setTrackOrigins(e.target.checked)}
                  className="rounded border-slate-600 bg-[#0B0F17] text-cyan-500 focus:ring-cyan-400"
                />
                <span>Track uninitialized & interior pointer origins (--track-origins=yes)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={detectDoubleFree}
                  disabled={isScanning}
                  onChange={(e) => setDetectDoubleFree(e.target.checked)}
                  className="rounded border-slate-600 bg-[#0B0F17] text-cyan-500 focus:ring-cyan-400"
                />
                <span>Quarantine freed chunks to catch Double Free hazards (CWE-415)</span>
              </label>
            </div>

            {/* Step 4 & 5: Execute Primary Action & Progress */}
            <div className="pt-4 border-t border-[#1E293B] space-y-3">
              <div className="text-xs font-semibold text-slate-300">
                04. Launch Diagnostic Execution
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isScanning}
                className="w-full"
              >
                <Play className="w-4 h-4" />
                <span>
                  {isScanning
                    ? 'Running Memory Scan...'
                    : `Start Memory Scan (${currentProgram?.filename})`}
                </span>
              </Button>

              {isScanning && (
                <div
                  role="status"
                  className="bg-[#0B0F17] border border-cyan-500/40 rounded-md p-3 text-xs text-cyan-300 font-mono"
                >
                  {scanStageText}
                </div>
              )}

              {apiError && (
                <div
                  role="alert"
                  className="bg-red-500/10 border border-red-500/40 rounded-md p-3 text-xs text-red-300"
                >
                  {apiError}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Step 6: Completed Scan Results */}
      {completedResult && (
        <div
          id="scan-results-panel"
          className="bg-[#111827] border border-[#334155] rounded-lg overflow-hidden space-y-0"
        >
          {/* Result Banner */}
          <div className="p-5 bg-[#161F30] border-b border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 text-xs font-mono text-slate-400">
                <span className="text-cyan-400 font-semibold">06. Scan Result: {completedResult.scan.id}</span>
                <span aria-hidden="true">·</span>
                <span>{completedResult.scan.filename}</span>
                <span aria-hidden="true">·</span>
                <span>{completedResult.scan.durationMs} ms</span>
                <span aria-hidden="true">·</span>
                <span>Exit Code {completedResult.scan.exitCode}</span>
              </div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-slate-100">
                  {completedResult.scan.programName}
                </h2>
                <ScanStatusIndicator
                  status={completedResult.scan.status}
                  unfreedBytes={completedResult.scan.summary.unfreedBytes}
                  runtimeErrors={completedResult.scan.summary.runtimeErrorsCount}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  triggerFileDownload(
                    `/api/reports/${completedResult.scan.id}/markdown`,
                    `memscope-${completedResult.scan.id}.md`
                  )
                }
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Markdown Report</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  triggerFileDownload(
                    `/api/reports/${completedResult.scan.id}/json`,
                    `memscope-${completedResult.scan.id}.json`
                  )
                }
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </Button>
            </div>
          </div>

          {/* Actionable Toolchain Error Callout if TOOLCHAIN_UNAVAILABLE */}
          {completedResult.scan.errorMessage && (
            <div
              role="alert"
              className="m-5 p-4 bg-amber-500/10 border border-amber-500/40 rounded-lg flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-semibold text-amber-300">
                  Host Toolchain Unavailable — No Fabricated Leak Results Emitted
                </div>
                <p className="text-slate-200 leading-relaxed">
                  {completedResult.scan.errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#1E293B] border-b border-[#1E293B] bg-[#0B0F17]">
            <div className="p-3.5">
              <div className="text-[11px] text-slate-400">Total Allocations</div>
              <div className="text-base font-bold font-mono text-slate-100 tabular-nums mt-0.5">
                {completedResult.scan.summary.totalAllocations} ({formatCompactBytes(completedResult.scan.summary.totalAllocatedBytes)})
              </div>
            </div>
            <div className="p-3.5">
              <div className="text-[11px] text-slate-400">Total Frees</div>
              <div className="text-base font-bold font-mono text-emerald-400 tabular-nums mt-0.5">
                {completedResult.scan.summary.totalFrees} ({formatCompactBytes(completedResult.scan.summary.totalFreedBytes)})
              </div>
            </div>
            <div className="p-3.5">
              <div className="text-[11px] text-slate-400">Unfreed at Exit</div>
              <div className="text-base font-bold font-mono text-red-400 tabular-nums mt-0.5">
                {formatBytes(completedResult.scan.summary.unfreedBytes)}
              </div>
            </div>
            <div className="p-3.5">
              <div className="text-[11px] text-slate-400">Outstanding Blocks</div>
              <div className="text-base font-bold font-mono text-amber-400 tabular-nums mt-0.5">
                {completedResult.scan.summary.outstandingBlocks} block(s)
              </div>
            </div>
            <div className="p-3.5">
              <div className="text-[11px] text-slate-400">Peak Heap Footprint</div>
              <div className="text-base font-bold font-mono text-cyan-400 tabular-nums mt-0.5">
                {formatCompactBytes(completedResult.scan.summary.peakHeapBytes)}
              </div>
            </div>
          </div>

          {/* Result Navigation Tabs */}
          <div className="px-5 pt-3 border-b border-[#1E293B] flex items-center gap-2 overflow-x-auto">
            {[
              {
                id: 'findings',
                label: `Diagnostic Findings (${completedResult.findings.length})`,
              },
              {
                id: 'allocations',
                label: `Heap Allocation Table (${completedResult.scan.allocations.length})`,
              },
              { id: 'detector', label: 'Detector Evidence Log' },
              { id: 'stdio', label: 'Process Stdout / Stderr' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveResultTab(tab.id as any)}
                className={`px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeResultTab === tab.id
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Body */}
          <div className="p-5">
            {activeResultTab === 'findings' && (
              <div className="space-y-3">
                {completedResult.findings.length === 0 ? (
                  <div className="p-6 bg-[#0B0F17] border border-emerald-500/30 rounded-lg flex items-center gap-3 text-xs text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Zero Memory Leaks Detected</div>
                      <div className="text-slate-300 mt-0.5">
                        Every heap block allocated by {completedResult.scan.filename} was properly
                        released before process termination.
                      </div>
                    </div>
                  </div>
                ) : (
                  completedResult.findings.map((finding) => (
                    <div
                      key={finding.id}
                      className="p-4 bg-[#0B0F17] border border-[#1E293B] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                          <span className="text-cyan-400">{finding.id}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {finding.filename}:{finding.locationLine} ({finding.locationFunction})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-200">
                            {formatBytes(finding.totalLeakedBytes)}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-slate-100">{finding.title}</div>
                        <p className="text-xs text-slate-400">{finding.remediationSummary}</p>
                        <div className="flex items-center gap-3 pt-1">
                          <ClassificationIndicator classification={finding.classification} />
                          <span aria-hidden="true" className="text-slate-600">
                            ·
                          </span>
                          <SeverityIndicator severity={finding.severity} />
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onSelectFinding(finding)}
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                        <span>Inspect Evidence</span>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeResultTab === 'allocations' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1E293B] text-[11px] text-slate-400 bg-[#0B0F17]">
                      <th className="py-2.5 px-3">Block ID</th>
                      <th className="py-2.5 px-3">Address</th>
                      <th className="py-2.5 px-3">Pointer</th>
                      <th className="py-2.5 px-3">Allocator</th>
                      <th className="py-2.5 px-3 text-right">Block Size</th>
                      <th className="py-2.5 px-3 text-right">Calls</th>
                      <th className="py-2.5 px-3 text-right">Total Bytes</th>
                      <th className="py-2.5 px-3">Allocated At</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B] font-mono">
                    {completedResult.scan.allocations.map((alloc) => (
                      <tr key={alloc.blockId} className="hover:bg-[#161F30]/50">
                        <td className="py-2.5 px-3 text-cyan-400">{alloc.blockId}</td>
                        <td className="py-2.5 px-3 text-slate-300">{alloc.address}</td>
                        <td className="py-2.5 px-3 text-slate-100">{alloc.variableName}</td>
                        <td className="py-2.5 px-3 text-slate-300">{alloc.allocator}()</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {alloc.sizeBytes.toLocaleString()} B
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{alloc.callCount}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-100">
                          {alloc.totalBytes.toLocaleString()} B
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {alloc.allocatedInFunction}:{alloc.allocatedAtLine}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          {alloc.status === 'FREED' ? (
                            <span className="text-emerald-400">
                              Freed (line {alloc.freedAtLine})
                            </span>
                          ) : alloc.status === 'DOUBLE_FREE' ? (
                            <span className="text-red-400 font-semibold">
                              Double Free (line {alloc.freedAtLine})
                            </span>
                          ) : alloc.status === 'UNFREED_POSSIBLE' ? (
                            <span className="text-amber-400">Possibly Lost</span>
                          ) : (
                            <span className="text-red-400 font-semibold">Definitely Lost</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeResultTab === 'detector' && (
              <pre className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
                {completedResult.scan.detectorOutput}
              </pre>
            )}

            {activeResultTab === 'stdio' && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Standard Output (stdout)</span>
                  </div>
                  <pre className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3.5 text-xs font-mono text-slate-200 overflow-x-auto">
                    {completedResult.scan.stdout || '(empty stdout)'}
                  </pre>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-1.5">
                    Standard Error (stderr)
                  </div>
                  <pre className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3.5 text-xs font-mono text-amber-300 overflow-x-auto">
                    {completedResult.scan.stderr || '(empty stderr)'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
