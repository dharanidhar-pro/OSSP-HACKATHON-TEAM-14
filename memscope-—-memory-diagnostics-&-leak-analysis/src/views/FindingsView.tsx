import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  FileSearch,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { BuiltInProgram, LeakFinding } from '../types/memscope';
import { triggerFileDownload } from '../api/client';
import {
  Button,
  ClassificationIndicator,
  EmptyState,
  SeverityIndicator,
  formatCompactBytes,
  formatDateTime,
} from '../components/ui/Primitives';

interface FindingsViewProps {
  findings: LeakFinding[];
  programs: BuiltInProgram[];
  loading: boolean;
  onSelectFinding: (finding: LeakFinding) => void;
  onLaunchScanner: () => void;
}

const PAGE_SIZE = 8;

export function FindingsView({
  findings,
  programs,
  loading,
  onSelectFinding,
  onLaunchScanner,
}: FindingsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [programFilter, setProgramFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const filteredFindings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return findings.filter((f) => {
      if (classificationFilter !== 'ALL' && f.classification !== classificationFilter)
        return false;
      if (severityFilter !== 'ALL' && f.severity !== severityFilter) return false;
      if (programFilter !== 'ALL' && f.programId !== programFilter) return false;
      if (q) {
        const hay =
          `${f.id} ${f.scanId} ${f.programName} ${f.filename} ${f.locationFunction} ${f.title} ${f.memoryAddress}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [findings, searchQuery, classificationFilter, severityFilter, programFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredFindings.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filteredFindings.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setClassificationFilter('ALL');
    setSeverityFilter('ALL');
    setProgramFilter('ALL');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Leak Findings & Evidence Catalog
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Inspect confirmed unfreed blocks, interior pointer offsets, and heap runtime hazards
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            disabled={findings.length === 0}
            onClick={() =>
              triggerFileDownload('/api/reports/findings/csv', 'memscope-findings-export.csv')
            }
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV ({findings.length})</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
        <div className="lg:col-span-4">
          <label
            htmlFor="findings-search"
            className="block text-[11px] font-medium text-slate-400 mb-1"
          >
            Search Identifier, Function, or File
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="findings-search"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. FND-1002, ingest_sensor, 0x7fff..."
              className="w-full h-9 pl-8 pr-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="lg:col-span-3">
          <label
            htmlFor="findings-classification-filter"
            className="block text-[11px] font-medium text-slate-400 mb-1"
          >
            Evidence Classification
          </label>
          <select
            id="findings-classification-filter"
            value={classificationFilter}
            onChange={(e) => {
              setClassificationFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
          >
            <option value="ALL">All Classifications</option>
            <option value="CONFIRMED_LEAK">Confirmed Leak (Definitely Lost)</option>
            <option value="POSSIBLE_LEAK">Possible Leak (Interior / Conditional)</option>
            <option value="RUNTIME_ERROR">Runtime Hazard (Double Free / Limit)</option>
            <option value="EVIDENCE_UNAVAILABLE">Evidence Unavailable</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label
            htmlFor="findings-severity-filter"
            className="block text-[11px] font-medium text-slate-400 mb-1"
          >
            Severity
          </label>
          <select
            id="findings-severity-filter"
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label
            htmlFor="findings-program-filter"
            className="block text-[11px] font-medium text-slate-400 mb-1"
          >
            Target Program
          </label>
          <select
            id="findings-program-filter"
            value={programFilter}
            onChange={(e) => {
              setProgramFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-9 px-3 bg-[#0B0F17] border border-[#334155] rounded-md text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
          >
            <option value="ALL">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.filename}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-1 flex justify-end">
          <Button
            variant="secondary"
            size="md"
            onClick={handleResetFilters}
            className="w-full"
            aria-label="Reset finding filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      {/* Findings Table */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
        {loading && findings.length === 0 ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-10 bg-[#1E293B] animate-pulse rounded" />
            ))}
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No Matching Leak Findings"
              description={
                findings.length === 0
                  ? 'No leak findings are currently stored in the workspace. Run a memory scan to analyze a target.'
                  : 'No findings match your active search or filter criteria.'
              }
              actionLabel={findings.length === 0 ? 'Launch Memory Scan' : 'Reset Filters'}
              onAction={findings.length === 0 ? onLaunchScanner : handleResetFilters}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1E293B] text-[11px] font-semibold text-slate-400 bg-[#0B0F17]">
                    <th className="py-3 px-4">Finding ID</th>
                    <th className="py-3 px-4">Test Program</th>
                    <th className="py-3 px-4">Allocation Location</th>
                    <th className="py-3 px-4 text-right">Leaked Size</th>
                    <th className="py-3 px-4">Evidence Classification</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {paginated.map((f) => (
                    <tr key={f.id} className="hover:bg-[#161F30]/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-cyan-400 whitespace-nowrap">
                        <div>{f.id}</div>
                        <div className="text-[10px] text-slate-500">Scan {f.scanId}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100 truncate max-w-[180px]">
                          {f.programName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">{f.filename}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="text-slate-200">
                          {f.locationFunction}() : line {f.locationLine}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {f.allocator}() @ {f.memoryAddress}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-100 font-semibold">
                          {formatCompactBytes(f.totalLeakedBytes)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {f.blockCount} blk × {f.allocationSizeBytes} B
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div>
                          <ClassificationIndicator classification={f.classification} />
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {f.confidencePct}% confidence
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <SeverityIndicator severity={f.severity} />
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {formatDateTime(f.timestamp)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onSelectFinding(f)}
                          aria-label={`Inspect finding ${f.id}`}
                        >
                          <FileSearch className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-[#1E293B] bg-[#0B0F17]/50 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing{' '}
                <span className="font-mono text-slate-200">
                  {(currentPage - 1) * PAGE_SIZE + 1}
                </span>{' '}
                –{' '}
                <span className="font-mono text-slate-200">
                  {Math.min(currentPage * PAGE_SIZE, filteredFindings.length)}
                </span>{' '}
                of <span className="font-mono text-slate-200">{filteredFindings.length}</span>{' '}
                finding(s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous findings page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </Button>
                <span className="font-mono text-slate-300 px-2">
                  Page {currentPage} / {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next findings page"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
