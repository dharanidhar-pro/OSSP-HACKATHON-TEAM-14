export type EvidenceClassification =
  | 'CONFIRMED_LEAK'
  | 'POSSIBLE_LEAK'
  | 'RUNTIME_ERROR'
  | 'EVIDENCE_UNAVAILABLE'
  | 'CLEAN';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type ScanStatus = 'COMPLETED' | 'FAILED' | 'TOOLCHAIN_UNAVAILABLE' | 'RUNNING';

export type ExecutionMethod =
  | 'MEMSCOPE_INTERCEPTOR'
  | 'PYTHON_TRACEMALLOC_SANDBOX'
  | 'NATIVE_VALGRIND_STRICT';

export interface BuiltInProgram {
  id: string;
  name: string;
  filename: string;
  category: 'Telemetry' | 'Networking' | 'Data Structures' | 'Media Processing' | 'Custom';
  description: string;
  expectedBehavior: string;
  defaultMethod: ExecutionMethod;
  sourceCode: string;
  expectedLeakCount: number;
  expectedUnfreedBytes: number;
}

export interface ScanOptions {
  programId: string;
  executionMethod: ExecutionMethod;
  timeoutMs: number;
  maxHeapKb: number;
  loopBound: number;
  trackOrigins: boolean;
  detectDoubleFree: boolean;
  customSource?: string;
}

export interface AllocationRecord {
  blockId: string;
  address: string;
  variableName: string;
  allocator: 'malloc' | 'calloc' | 'realloc' | 'strdup' | 'aligned_alloc';
  sizeBytes: number;
  callCount: number;
  totalBytes: number;
  allocatedAtLine: number;
  allocatedInFunction: string;
  freedAtLine: number | null;
  freedInFunction: string | null;
  status: 'FREED' | 'UNFREED_DEFINITE' | 'UNFREED_POSSIBLE' | 'DOUBLE_FREE' | 'HEAP_EXCEEDED';
}

export interface LeakFinding {
  id: string;
  scanId: string;
  programId: string;
  programName: string;
  filename: string;
  title: string;
  classification: EvidenceClassification;
  severity: SeverityLevel;
  confidencePct: number;
  evidenceSource: string;
  allocator: string;
  allocationSizeBytes: number;
  blockCount: number;
  totalLeakedBytes: number;
  locationFunction: string;
  locationLine: number;
  deallocationInfo: string;
  memoryAddress: string;
  stackTrace: string[];
  sourceSnippet: string;
  executionOutputExcerpt: string;
  whyItMatters: string;
  remediationSummary: string;
  remediationPatch: string;
  timestamp: string;
  isSeeded?: boolean;
}

export interface ScanRecord {
  id: string;
  programId: string;
  programName: string;
  filename: string;
  executionMethod: ExecutionMethod;
  status: ScanStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode: number;
  options: ScanOptions;
  summary: {
    totalAllocations: number;
    totalFrees: number;
    outstandingBlocks: number;
    totalAllocatedBytes: number;
    totalFreedBytes: number;
    unfreedBytes: number;
    peakHeapBytes: number;
    confirmedLeaksCount: number;
    possibleLeaksCount: number;
    runtimeErrorsCount: number;
  };
  allocations: AllocationRecord[];
  findingIds: string[];
  stdout: string;
  stderr: string;
  detectorOutput: string;
  recommendations: string[];
  errorMessage?: string;
  isSeeded?: boolean;
}

export interface DashboardMetrics {
  totalScans: number;
  confirmedLeaks: number;
  possibleLeaks: number;
  runtimeErrors: number;
  unfreedBytes: number;
  outstandingBlocks: number;
  latestScanStatus: ScanStatus | 'NONE';
  latestScanId: string | null;
  latestScanProgram: string | null;
  latestScanTimestamp: string | null;
  hasSeededData: boolean;
  timelineSeries: Array<{
    scanId: string;
    label: string;
    timestamp: string;
    programName: string;
    allocatedBytes: number;
    unfreedBytes: number;
    peakHeapBytes: number;
    confirmedLeaks: number;
  }>;
  severityBreakdown: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  classificationBreakdown: {
    CONFIRMED_LEAK: number;
    POSSIBLE_LEAK: number;
    RUNTIME_ERROR: number;
    EVIDENCE_UNAVAILABLE: number;
  };
}

export interface ProcessMetricItem {
  pid: number;
  user: string;
  command: string;
  cpuPct: number;
  memPct: number;
  rssKb: number;
  vszKb: number;
  state: string;
}

export interface LiveSystemTelemetry {
  timestamp: string;
  hostname: string;
  platform: string;
  kernelRelease: string;
  uptimeSeconds: number;
  osMemory: {
    totalKb: number;
    freeKb: number;
    availableKb: number;
    buffersKb: number;
    cachedKb: number;
    activeKb: number;
    inactiveKb: number;
    slabKb: number;
    usedKb: number;
    usagePct: number;
  };
  inspectorProcess: {
    pid: number;
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
    vmPeakKb: number;
    vmHwmKb: number;
    vmDataKb: number;
    vmStkKb: number;
    threads: number;
    voluntaryCtxtSwitches: number;
  };
  activeSandboxBuffers: {
    count: number;
    allocatedBytes: number;
  };
  processes: ProcessMetricItem[];
  toolchainStatus: {
    gcc: { available: boolean; path: string | null; version: string };
    valgrind: { available: boolean; path: string | null; version: string };
    python3: { available: boolean; path: string | null; version: string };
    nodeV8: { available: boolean; version: string };
    memscopeInterceptor: { available: boolean; version: string };
  };
}

export interface MemScopeSettings {
  defaultExecutionMethod: ExecutionMethod;
  defaultTimeoutMs: number;
  defaultMaxHeapKb: number;
  defaultLoopBound: number;
  strictZeroLeakExitCode: boolean;
  includeSeededSampleData: boolean;
  autoGenerateRemediation: boolean;
}
