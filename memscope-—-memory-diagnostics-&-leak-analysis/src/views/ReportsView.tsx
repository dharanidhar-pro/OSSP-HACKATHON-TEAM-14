import React, { useState, useMemo } from 'react';
import {
  Download,
  FileText,
  FileCode,
  Table,
  Copy,
  Check,
  Play,
} from 'lucide-react';
import type { LeakFinding, ScanRecord } from '../types/memscope';
import {
  generateMarkdownReport,
  generateCsvFindingsExport,
} from '../engine/memoryEngine';
import { triggerFileDownload } from '../api/client';
import {
  Button,
  EmptyState,
  ScanStatusIndicator,
  formatCompactBytes,
  formatDateTime,
} from '../components/ui/Primitives';

interface ReportsViewProps {
  scans: ScanRecord[];
  findings: LeakFinding[];
  onLaunchScanner: () => void;
}

export function ReportsView({
  scans,
  findings,
  onLaunchScanner,
}: ReportsViewProps) {
  const [selectedScanId, setSelectedScanId] = useState<string>(
    scans[0]?.id || ''
  );
  const [previewFormat, setPreviewFormat] = useState<'markdown' | 'json' | 'csv'>(
    'markdown'
  );
  const [copied, setCopied] = useState(false);

  const activeScan = useMemo(() => {
    return scans.find((s) => s.id === selectedScanId) || scans[0] || null;
  }, [scans, selectedScanId]);

  const activeFindings = useMemo(() => {
    if (!activeScan) return [];
    return findings.filter((f) => f.scanId === activeScan.id);
  }, [activeScan, findings]);

  const previewText = useMemo(() => {
    if (!activeScan) return '';
    if (previewFormat === 'markdown') {
      return generateMarkdownReport(activeScan, activeFindings);
    }
    if (previewFormat === 'json') {
      return JSON.stringify(
        {
          reportVersion: '2.4.0',
          generatedAt: activeScan.completedAt,
          scan: activeScan,
          findings: activeFindings,
        },
        null,
        2
      );
    }
    return generateCsvFindingsExport(findings);
  }, [activeScan, activeFindings, findings, previewFormat]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(previewText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (scans.length === 0) {
    return (
      <div className="space-y-6">
        <div className="pb-4 border-b border-[#1E293B]">
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Diagnostic Reports & Artifacts
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Generate structured Markdown, JSON, and CSV compliance artifacts
          </p>
        </div>
        <EmptyState
          title="No Scans Available for Reporting"
          description="Execute at least one memory scan to generate downloadable Markdown, JSON, and CSV diagnostic reports."
          actionLabel="Launch Memory Scan"
          onAction={onLaunchScanner}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Diagnostic Reports & Export Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Preview and download engineering audit reports in Markdown, JSON, or CSV format
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeScan && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  triggerFileDownload(
                    `/api/reports/${activeScan.id}/markdown`,
                    `memscope-${activeScan.id}.md`
                  )
                }
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .MD ({activeScan.id})</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  triggerFileDownload(
                    `/api/reports/${activeScan.id}/json`,
                    `memscope-${activeScan.id}.json`
                  )
                }
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .JSON</span>
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              triggerFileDownload(
                '/api/reports/findings/csv',
                'memscope-findings-export.csv'
              )
            }
          >
            <Table className="w-3.5 h-3.5" />
            <span>Export All Findings (.CSV)</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (4 cols): Scan Selector List */}
        <div className="lg:col-span-4 bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[#1E293B] bg-[#0B0F17]/50">
            <h2 className="text-xs font-semibold text-slate-200">
              Select Scan Record ({scans.length})
            </h2>
          </div>
          <div className="divide-y divide-[#1E293B] max-h-[540px] overflow-y-auto">
            {scans.map((scan) => {
              const isSelected = activeScan?.id === scan.id;
              return (
                <button
                  key={scan.id}
                  type="button"
                  onClick={() => setSelectedScanId(scan.id)}
                  className={`w-full text-left p-4 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#161F30] border-l-2 border-l-cyan-400'
                      : 'hover:bg-[#161F30]/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="text-cyan-400 font-semibold">{scan.id}</span>
                    <span className="text-slate-400">
                      {formatDateTime(scan.completedAt)}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-100 truncate">
                    {scan.programName}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mb-2">
                    {scan.filename} · Unfreed: {formatCompactBytes(scan.summary.unfreedBytes)}
                  </div>
                  <ScanStatusIndicator
                    status={scan.status}
                    unfreedBytes={scan.summary.unfreedBytes}
                    runtimeErrors={scan.summary.runtimeErrorsCount}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column (8 cols): Live Report Artifact Preview */}
        <div className="lg:col-span-8 bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3 bg-[#0B0F17]/50">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewFormat('markdown')}
                className={`px-3 py-1.5 rounded text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                  previewFormat === 'markdown'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Markdown Report</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewFormat('json')}
                className={`px-3 py-1.5 rounded text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                  previewFormat === 'json'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>JSON Payload</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewFormat('csv')}
                className={`px-3 py-1.5 rounded text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                  previewFormat === 'csv'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Workspace CSV</span>
              </button>
            </div>

            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Artifact'}</span>
            </Button>
          </div>

          <div className="p-5 flex-1">
            <pre className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[520px] leading-relaxed whitespace-pre-wrap">
              {previewText}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
