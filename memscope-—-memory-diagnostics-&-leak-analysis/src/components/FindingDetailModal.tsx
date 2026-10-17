import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  FileCode,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import type { LeakFinding } from '../types/memscope';
import {
  Button,
  ClassificationIndicator,
  SeverityIndicator,
  formatBytes,
  formatDateTime,
} from './ui/Primitives';

interface FindingDetailModalProps {
  finding: LeakFinding | null;
  onClose: () => void;
  onNavigateToScan: (scanId: string) => void;
}

export function FindingDetailModal({
  finding,
  onClose,
  onNavigateToScan,
}: FindingDetailModalProps) {
  const [copiedPatch, setCopiedPatch] = useState(false);

  if (!finding) return null;

  const handleCopyPatch = () => {
    navigator.clipboard?.writeText(finding.remediationPatch);
    setCopiedPatch(true);
    setTimeout(() => setCopiedPatch(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finding-modal-title"
    >
      <div className="bg-[#111827] border-l border-[#334155] w-full max-w-2xl h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#1E293B]">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mb-1.5">
                <span>{finding.id}</span>
                <span aria-hidden="true">·</span>
                <span>{finding.filename}:{finding.locationLine}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDateTime(finding.timestamp)}</span>
                {finding.isSeeded && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-cyan-400">Baseline Sample</span>
                  </>
                )}
              </div>
              <h2 id="finding-modal-title" className="text-lg font-semibold text-slate-100 leading-snug">
                {finding.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close finding details"
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-[#1E293B] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Classification & Evidence Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">Classification</div>
              <ClassificationIndicator classification={finding.classification} />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Severity</div>
              <SeverityIndicator severity={finding.severity} />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Total Unfreed</div>
              <div className="text-xs font-mono font-semibold text-slate-100 tabular-nums">
                {formatBytes(finding.totalLeakedBytes)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Confidence</div>
              <div className="text-xs font-mono font-semibold text-slate-100 tabular-nums">
                {finding.confidencePct}% ({finding.blockCount} blk × {finding.allocationSizeBytes} B)
              </div>
            </div>
          </div>

          {/* Allocation & Release Lifecycle */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <span>Allocation & Deallocation Evidence</span>
            </h3>
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span className="text-slate-400">Evidence Source:</span>
                <span className="sm:col-span-2 text-slate-200 font-mono">{finding.evidenceSource}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span className="text-slate-400">Allocation Site:</span>
                <span className="sm:col-span-2 text-slate-200 font-mono">
                  {finding.allocator}() in {finding.locationFunction}() at {finding.filename}:{finding.locationLine}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span className="text-slate-400">Heap Virtual Address:</span>
                <span className="sm:col-span-2 text-cyan-300 font-mono">{finding.memoryAddress}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span className="text-slate-400">Release Analysis:</span>
                <span className="sm:col-span-2 text-slate-200">{finding.deallocationInfo}</span>
              </div>
            </div>
          </div>

          {/* Source Code Context & Call Stack */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Source Location ({finding.filename}:{finding.locationLine})</span>
              </h3>
              <pre className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3.5 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
                {finding.sourceSnippet}
              </pre>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Call Stack & Detector Trace</span>
              </h3>
              <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3.5 space-y-2">
                <div className="text-xs font-mono text-slate-300 space-y-1">
                  {finding.stackTrace.map((frame, i) => (
                    <div key={i} className="truncate">
                      <span className="text-slate-500 mr-2">#{i}</span>
                      <span>{frame}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-[#1E293B]">
                  <pre className="text-xs font-mono text-amber-300/90 overflow-x-auto whitespace-pre-wrap">
                    {finding.executionOutputExcerpt}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Why It Matters & Remediation */}
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-300 mb-1">Why This Result Matters</h3>
              <p className="text-xs text-slate-300 leading-relaxed bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3.5">
                {finding.whyItMatters}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-emerald-400" />
                  <span>Suggested Remediation</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCopyPatch}
                  className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer"
                >
                  {copiedPatch ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPatch ? 'Copied Patch' : 'Copy Remediation Patch'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-300 mb-2">{finding.remediationSummary}</p>
              <pre className="bg-[#0B0F17] border border-emerald-500/30 rounded-lg p-3.5 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                {finding.remediationPatch}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 mt-6 border-t border-[#1E293B] flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              onClose();
              onNavigateToScan(finding.scanId);
            }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View Originating Scan ({finding.scanId})</span>
          </Button>
          <Button variant="primary" size="md" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      </div>
    </div>
  );
}
