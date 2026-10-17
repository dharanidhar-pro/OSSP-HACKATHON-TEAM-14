import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Database,
} from 'lucide-react';
import type {
  ExecutionMethod,
  LiveSystemTelemetry,
  MemScopeSettings,
} from '../types/memscope';
import {
  Button,
  ConfirmDialog,
} from '../components/ui/Primitives';

interface SettingsViewProps {
  settings: MemScopeSettings | null;
  toolchain: LiveSystemTelemetry['toolchainStatus'] | null;
  onSaveSettings: (updated: Partial<MemScopeSettings>) => Promise<void>;
  onResetWorkspace: () => Promise<void>;
}

export function SettingsView({
  settings,
  toolchain,
  onSaveSettings,
  onResetWorkspace,
}: SettingsViewProps) {
  const [defaultExecutionMethod, setDefaultExecutionMethod] =
    useState<ExecutionMethod>('MEMSCOPE_INTERCEPTOR');
  const [defaultTimeoutMs, setDefaultTimeoutMs] = useState<number>(5000);
  const [defaultMaxHeapKb, setDefaultMaxHeapKb] = useState<number>(65536);
  const [defaultLoopBound, setDefaultLoopBound] = useState<number>(4);
  const [strictZeroLeakExitCode, setStrictZeroLeakExitCode] = useState<boolean>(true);
  const [includeSeededSampleData, setIncludeSeededSampleData] = useState<boolean>(true);
  const [autoGenerateRemediation, setAutoGenerateRemediation] = useState<boolean>(true);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState<boolean>(false);

  useEffect(() => {
    if (settings) {
      setDefaultExecutionMethod(settings.defaultExecutionMethod);
      setDefaultTimeoutMs(settings.defaultTimeoutMs);
      setDefaultMaxHeapKb(settings.defaultMaxHeapKb);
      setDefaultLoopBound(settings.defaultLoopBound);
      setStrictZeroLeakExitCode(settings.strictZeroLeakExitCode);
      setIncludeSeededSampleData(settings.includeSeededSampleData);
      setAutoGenerateRemediation(settings.autoGenerateRemediation);
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (defaultTimeoutMs < 100 || defaultTimeoutMs > 30000) {
      setValidationError('Default timeout must be between 100 ms and 30,000 ms.');
      return;
    }
    if (defaultMaxHeapKb < 64 || defaultMaxHeapKb > 524288) {
      setValidationError('Default max heap limit must be between 64 KB and 524,288 KB.');
      return;
    }
    if (defaultLoopBound < 1 || defaultLoopBound > 10000) {
      setValidationError('Default loop bound must be between 1 and 10,000.');
      return;
    }

    setValidationError(null);
    setSaving(true);
    try {
      await onSaveSettings({
        defaultExecutionMethod,
        defaultTimeoutMs,
        defaultMaxHeapKb,
        defaultLoopBound,
        strictZeroLeakExitCode,
        includeSeededSampleData,
        autoGenerateRemediation,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#1E293B]">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">
          Workspace & Engine Configuration
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure default scanner resource limits, sample baseline visibility, and verify host
          binaries
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form (7 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-[#111827] border border-[#1E293B] rounded-lg p-5 space-y-5"
        >
          <h2 className="text-sm font-semibold text-slate-100">
            Default Scanner Parameters & Guardrails
          </h2>

          <div>
            <label
              htmlFor="settings-default-engine"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Default Detection Engine
            </label>
            <select
              id="settings-default-engine"
              value={defaultExecutionMethod}
              onChange={(e) => setDefaultExecutionMethod(e.target.value as ExecutionMethod)}
              className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            >
              <option value="MEMSCOPE_INTERCEPTOR">
                MemScope Symbolic + Allocation Hook Engine
              </option>
              <option value="PYTHON_TRACEMALLOC_SANDBOX">
                Python3 tracemalloc Arena + C-Hook Bridge
              </option>
              <option value="NATIVE_VALGRIND_STRICT">
                Strict Host Valgrind / GCC Binary
              </option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="settings-timeout"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Default Timeout (ms)
              </label>
              <input
                id="settings-timeout"
                type="number"
                min={100}
                max={30000}
                value={defaultTimeoutMs}
                onChange={(e) => setDefaultTimeoutMs(Number(e.target.value))}
                className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs font-mono text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="settings-maxheap"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Default Max Heap (KB)
              </label>
              <input
                id="settings-maxheap"
                type="number"
                min={64}
                max={524288}
                value={defaultMaxHeapKb}
                onChange={(e) => setDefaultMaxHeapKb(Number(e.target.value))}
                className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs font-mono text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="settings-loopbound"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Default Loop Bound
              </label>
              <input
                id="settings-loopbound"
                type="number"
                min={1}
                max={10000}
                value={defaultLoopBound}
                onChange={(e) => setDefaultLoopBound(Number(e.target.value))}
                className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs font-mono text-slate-100"
              />
            </div>
          </div>

          {validationError && (
            <div
              role="alert"
              className="p-3 bg-red-500/10 border border-red-500/40 rounded-md text-xs text-red-300"
            >
              {validationError}
            </div>
          )}

          <div className="space-y-3 pt-3 border-t border-[#1E293B]">
            <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSeededSampleData}
                onChange={(e) => setIncludeSeededSampleData(e.target.checked)}
                className="rounded border-slate-600 bg-[#0B0F17] text-cyan-500"
              />
              <span>
                Include 4 baseline demonstration scans in Overview & Findings tables
              </span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={strictZeroLeakExitCode}
                onChange={(e) => setStrictZeroLeakExitCode(e.target.checked)}
                className="rounded border-slate-600 bg-[#0B0F17] text-cyan-500"
              />
              <span>
                Return non-zero exit code (1) whenever confirmed unfreed blocks &gt; 0
              </span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={autoGenerateRemediation}
                onChange={(e) => setAutoGenerateRemediation(e.target.checked)}
                className="rounded border-slate-600 bg-[#0B0F17] text-cyan-500"
              />
              <span>
                Automatically generate C remediation diff patches for detected leaks
              </span>
            </label>
          </div>

          <div className="pt-3 border-t border-[#1E293B] flex items-center justify-end gap-3">
            <Button type="submit" variant="primary" size="md" disabled={saving}>
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving Configuration...' : 'Save Configuration'}</span>
            </Button>
          </div>
        </form>

        {/* Right Column (5 cols): Database Maintenance & Host Toolchain */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-100">
                Database Persistence & Reset
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              MemScope persists all scans, allocation tables, and findings in{' '}
              <code className="font-mono text-slate-200">.memscope-data/memscope-db.json</code>.
              You can reset the database to the initial 4 baseline scans at any time.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="md"
              onClick={() => setConfirmResetOpen(true)}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Database to Baseline</span>
            </Button>
          </div>

          {toolchain && (
            <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Container Environment Probe
              </h2>
              <div className="space-y-2 text-xs">
                {[
                  {
                    label: 'MemScope Symbolic AST Engine',
                    ok: toolchain.memscopeInterceptor.available,
                    ver: toolchain.memscopeInterceptor.version,
                  },
                  {
                    label: 'Python 3 tracemalloc',
                    ok: toolchain.python3.available,
                    ver: toolchain.python3.version,
                  },
                  {
                    label: 'Node.js V8 Runtime',
                    ok: toolchain.nodeV8.available,
                    ver: toolchain.nodeV8.version,
                  },
                  {
                    label: 'Host GCC Compiler',
                    ok: toolchain.gcc.available,
                    ver: toolchain.gcc.version,
                  },
                  {
                    label: 'Host Valgrind Binary',
                    ok: toolchain.valgrind.available,
                    ver: toolchain.valgrind.version,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between p-2.5 bg-[#0B0F17] border border-[#1E293B] rounded"
                  >
                    <div>
                      <div className="font-medium text-slate-200">{item.label}</div>
                      <div className="text-[11px] font-mono text-slate-400">{item.ver}</div>
                    </div>
                    {item.ok ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Available</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Not Installed</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmResetOpen}
        title="Reset Workspace Database to Baseline?"
        description="This will replace your current scan history and custom findings with the 4 default baseline diagnostic scans."
        confirmLabel="Confirm Reset"
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={async () => {
          await onResetWorkspace();
          setConfirmResetOpen(false);
        }}
      />
    </div>
  );
}
