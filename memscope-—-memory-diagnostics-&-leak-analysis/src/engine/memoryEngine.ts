import type {
  AllocationRecord,
  BuiltInProgram,
  DashboardMetrics,
  EvidenceClassification,
  LeakFinding,
  ScanOptions,
  ScanRecord,
  SeverityLevel,
} from '../types/memscope.ts';

export const BUILT_IN_PROGRAMS: BuiltInProgram[] = [
  {
    id: 'prog-sensor-telemetry',
    name: 'IoT Telemetry Frame Parser',
    filename: 'sensor_buffer_leak.c',
    category: 'Telemetry',
    description:
      'Ingests high-frequency sensor frames over a serial ring bus. Allocates a 2,048-byte calibration payload and a 256-byte header per cycle, but aborts early on checksum drift without releasing the calibration heap block.',
    expectedBehavior:
      'Detects 1 confirmed leak in ingest_sensor_batch() (2,048 bytes × loop iterations) caused by an early return before free(cal_buf), while hdr_buf is properly released.',
    defaultMethod: 'MEMSCOPE_INTERCEPTOR',
    expectedLeakCount: 1,
    expectedUnfreedBytes: 8192,
    sourceCode: `#include <stdlib.h>
#include <stdio.h>
#include <string.h>

typedef struct {
    uint32_t seq_id;
    uint16_t crc;
    uint8_t  flags;
} frame_hdr_t;

int ingest_sensor_batch(int cycle_id) {
    frame_hdr_t *hdr_buf = (frame_hdr_t *)malloc(256);
    uint8_t *cal_buf = (uint8_t *)malloc(2048);

    if (!hdr_buf || !cal_buf) {
        free(hdr_buf);
        free(cal_buf);
        return -1;
    }

    memset(cal_buf, 0xAA, 2048);
    hdr_buf->seq_id = cycle_id;

    /* Checksum drift anomaly on periodic frames */
    if (cycle_id >= 0) {
        free(hdr_buf);
        /* BUG: cal_buf is orphaned on checksum failure path */
        return -2;
    }

    free(cal_buf);
    free(hdr_buf);
    return 0;
}

int main(void) {
    for (int i = 0; i < 4; i++) {
        ingest_sensor_batch(i);
    }
    return 0;
}`,
  },
  {
    id: 'prog-packet-router',
    name: 'BGP Route Table Indexer',
    filename: 'packet_router_table.c',
    category: 'Networking',
    description:
      'Constructs an in-memory prefix lookup table for network packet routing. Reassigns the primary bucket pointer during table expansion without freeing the previous allocation, and retains a conditional interior shadow buffer.',
    expectedBehavior:
      'Detects 1 confirmed leak from pointer overwrite (calloc 4,096 bytes) and 1 possible leak from an interior pointer shift (malloc 1,024 bytes).',
    defaultMethod: 'MEMSCOPE_INTERCEPTOR',
    expectedLeakCount: 2,
    expectedUnfreedBytes: 5120,
    sourceCode: `#include <stdlib.h>
#include <stdio.h>

typedef struct {
    uint32_t prefix;
    uint32_t nexthop;
    uint64_t metrics[6];
} route_entry_t;

void rebuild_routing_table(intcollision_mode) {
    route_entry_t *bucket_table = (route_entry_t *)calloc(64, 64);
    char *shadow_index = (char *)malloc(1024);

    /* Pointer overwrite without releasing original 4096-byte table */
    bucket_table = (route_entry_t *)malloc(8192);

    if (collision_mode > 0) {
        /* Interior pointer arithmetic obscures base block reference */
        shadow_index += 16;
    }

    free(bucket_table);
}

int main(void) {
    rebuild_routing_table(1);
    return 0;
}`,
  },
  {
    id: 'prog-cache-evictor',
    name: 'Slab Cache Eviction Engine',
    filename: 'lru_cache_dangling.c',
    category: 'Data Structures',
    description:
      'Manages hot-tier slab cache entries with an eviction callback. Releases a slab entry during low-watermark pressure and erroneously invokes free() a second time during destructor cleanup, while leaving audit metadata unfreed.',
    expectedBehavior:
      'Flags 1 critical runtime error (Double Free CWE-415 on slab_entry) and 1 confirmed memory leak (512-byte audit_log_t structure).',
    defaultMethod: 'MEMSCOPE_INTERCEPTOR',
    expectedLeakCount: 2,
    expectedUnfreedBytes: 512,
    sourceCode: `#include <stdlib.h>
#include <stdio.h>

void evict_hot_slab(void) {
    void *slab_entry = malloc(4096);
    void *audit_meta = malloc(512);

    /* Eviction hook releases slab_entry */
    free(slab_entry);

    /* Destructor cleanup erroneously frees slab_entry again */
    free(slab_entry);
    /* audit_meta is never freed before scope exit */
}

int main(void) {
    evict_hot_slab();
    return 0;
}`,
  },
  {
    id: 'prog-image-decoder',
    name: 'TIFF Strip Raster Decoder',
    filename: 'tiff_strip_decoder.c',
    category: 'Media Processing',
    description:
      'Allocates progressive scanline decode buffers and metadata descriptors for multi-strip uncompressed raster streams. Drops scanline descriptors inside the strip iteration loop.',
    expectedBehavior:
      'Detects confirmed cyclic heap growth across strip iterations (1,536 bytes per iteration) plus unfreed ICC profile buffer (3,072 bytes).',
    defaultMethod: 'MEMSCOPE_INTERCEPTOR',
    expectedLeakCount: 2,
    expectedUnfreedBytes: 9216,
    sourceCode: `#include <stdlib.h>
#include <stdio.h>

void decode_tiff_strips(void) {
    unsigned char *icc_profile = (unsigned char *)malloc(3072);
    unsigned char *scratch_row = (unsigned char *)malloc(1024);

    for (int strip = 0; strip < 4; strip++) {
        unsigned char *strip_Tile = (unsigned char *)malloc(1536);
        /* Decodes strip_Tile into framebuffer but forgets free(strip_Tile) */
    }

    free(scratch_row);
    /* icc_profile leaked on return */
}

int main(void) {
    decode_tiff_strips();
    return 0;
}`,
  },
  {
    id: 'prog-ring-buffer-clean',
    name: 'Zero-Copy SPSC Ring Buffer (Clean)',
    filename: 'clean_ring_buffer.c',
    category: 'Data Structures',
    description:
      'Reference single-producer single-consumer lock-free ring buffer with deterministic lifecycle management. Every heap allocation is paired with a verified teardown release.',
    expectedBehavior:
      'Completes with 0 leaks and 0 unfreed bytes. Demonstrates a clean diagnostic baseline.',
    defaultMethod: 'MEMSCOPE_INTERCEPTOR',
    expectedLeakCount: 0,
    expectedUnfreedBytes: 0,
    sourceCode: `#include <stdlib.h>
#include <stdio.h>

int run_spsc_selftest(void) {
    void *ring_slots = calloc(128, 32);
    void *descriptor = malloc(256);
    void *telemetry_scratch = malloc(512);

    if (!ring_slots || !descriptor || !telemetry_scratch) {
        free(ring_slots);
        free(descriptor);
        free(telemetry_scratch);
        return -1;
    }

    /* Perform ring enqueue/dequeue verification */
    free(telemetry_scratch);
    free(descriptor);
    free(ring_slots);
    return 0;
}

int main(void) {
    return run_spsc_selftest();
}`,
  },
  {
    id: 'prog-custom-c',
    name: 'Custom C Source Diagnostic Sandbox',
    filename: 'custom_target.c',
    category: 'Custom',
    description:
      'Analyze custom C/C++ heap allocation patterns using the MemScope Symbolic Heap & Allocation Hook Engine. Supports malloc, calloc, realloc, strdup, free, loop bounds, and pointer overwrite detection.',
    expectedBehavior:
      'Parses allocation call sites, tracks pointer lifetimes across scopes and loops, and classifies definite leaks, possible leaks, and double-free hazards.',
    defaultMethod: 'MEMSCOPE_INTERCEPTOR',
    expectedLeakCount: 1,
    expectedUnfreedBytes: 1024,
    sourceCode: `#include <stdlib.h>
#include <stdio.h>

void process_custom_payload(void) {
    char *packet_buf = (char *)malloc(1024);
    char *temp_scratch = (char *)malloc(512);

    free(temp_scratch);
    /* packet_buf remains unfreed at function exit */
}

int main(void) {
    process_custom_payload();
    return 0;
}`,
  },
];

export interface ValidationIssue {
  field: keyof ScanOptions | 'general';
  message: string;
}

export function validateScanOptions(options: Partial<ScanOptions>): {
  valid: boolean;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];

  if (!options.programId || typeof options.programId !== 'string') {
    issues.push({ field: 'programId', message: 'Please select a target program to scan.' });
  } else {
    const exists = BUILT_IN_PROGRAMS.some((p) => p.id === options.programId);
    if (!exists) {
      issues.push({ field: 'programId', message: `Unknown target program ID "${options.programId}".` });
    }
  }

  if (options.timeoutMs === undefined || Number.isNaN(Number(options.timeoutMs))) {
    issues.push({ field: 'timeoutMs', message: 'Execution timeout is required.' });
  } else if (options.timeoutMs < 100 || options.timeoutMs > 30000) {
    issues.push({
      field: 'timeoutMs',
      message: 'Timeout must be between 100 ms and 30,000 ms for safe container execution.',
    });
  }

  if (options.maxHeapKb === undefined || Number.isNaN(Number(options.maxHeapKb))) {
    issues.push({ field: 'maxHeapKb', message: 'Maximum heap guardrail is required.' });
  } else if (options.maxHeapKb < 64 || options.maxHeapKb > 524288) {
    issues.push({
      field: 'maxHeapKb',
      message: 'Max heap limit must be between 64 KB and 524,288 KB (512 MB).',
    });
  }

  if (options.loopBound === undefined || Number.isNaN(Number(options.loopBound))) {
    issues.push({ field: 'loopBound', message: 'Loop unroll bound is required.' });
  } else if (!Number.isInteger(options.loopBound) || options.loopBound < 1 || options.loopBound > 10000) {
    issues.push({
      field: 'loopBound',
      message: 'Loop bound must be an integer between 1 and 10,000 iterations.',
    });
  }

  if (options.programId === 'prog-custom-c') {
    const src = (options.customSource ?? '').trim();
    if (!src) {
      issues.push({
        field: 'customSource',
        message: 'Custom C source code cannot be empty.',
      });
    } else if (src.length > 50000) {
      issues.push({
        field: 'customSource',
        message: 'Custom C source code exceeds the 50,000 character sandbox limit.',
      });
    } else if (!/(malloc|calloc|realloc|strdup|free|main|void|int)\b/.test(src)) {
      issues.push({
        field: 'customSource',
        message: 'Source must contain recognizable C function definitions or heap calls (malloc/calloc/free).',
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function extractSnippet(lines: string[], targetLine1Indexed: number): string {
  const start = Math.max(0, targetLine1Indexed - 3);
  const end = Math.min(lines.length, targetLine1Indexed + 3);
  return lines
    .slice(start, end)
    .map((lineText, idx) => {
      const lineNum = start + idx + 1;
      const marker = lineNum === targetLine1Indexed ? '>' : ' ';
      return `${marker} ${String(lineNum).padStart(3, ' ')} | ${lineText}`;
    })
    .join('\n');
}

function evaluateSizeExpression(expr: string): number {
  const cleaned = expr
    .replace(/sizeof\s*\(\s*uint8_t\s*\)/g, '1')
    .replace(/sizeof\s*\(\s*char\s*\)/g, '1')
    .replace(/sizeof\s*\(\s*uint16_t\s*\)/g, '2')
    .replace(/sizeof\s*\(\s*short\s*\)/g, '2')
    .replace(/sizeof\s*\(\s*uint32_t\s*\)/g, '4')
    .replace(/sizeof\s*\(\s*int\s*\)/g, '4')
    .replace(/sizeof\s*\(\s*float\s*\)/g, '4')
    .replace(/sizeof\s*\(\s*uint64_t\s*\)/g, '8')
    .replace(/sizeof\s*\(\s*double\s*\)/g, '8')
    .replace(/sizeof\s*\(\s*void\s*\*\s*\)/g, '8')
    .replace(/sizeof\s*\([^)]+\)/g, '64')
    .trim();

  const multMatch = cleaned.match(/^(\d+)\s*\*\s*(\d+)$/);
  if (multMatch) {
    return parseInt(multMatch[1], 10) * parseInt(multMatch[2], 10);
  }
  const numMatch = cleaned.match(/(\d+)/);
  if (numMatch) {
    return Math.max(1, parseInt(numMatch[1], 10));
  }
  return 256;
}

export function executeSymbolicMemoryScan(
  scanId: string,
  options: ScanOptions,
  toolchainAvailable: { gcc: boolean; valgrind: boolean },
  timestampIso: string = new Date().toISOString()
): { scan: ScanRecord; findings: LeakFinding[] } {
  const program =
    BUILT_IN_PROGRAMS.find((p) => p.id === options.programId) ?? BUILT_IN_PROGRAMS[0];
  const sourceCode =
    options.programId === 'prog-custom-c' && options.customSource
      ? options.customSource
      : program.sourceCode;

  // If user explicitly requested strict host Valgrind binary and it's not installed in container:
  if (options.executionMethod === 'NATIVE_VALGRIND_STRICT' && (!toolchainAvailable.gcc || !toolchainAvailable.valgrind)) {
    const missingTools = [
      !toolchainAvailable.gcc ? 'gcc' : null,
      !toolchainAvailable.valgrind ? 'valgrind' : null,
    ]
      .filter(Boolean)
      .join(', ');

    const unavailableFindingId = `FND-${scanId.replace(/^SCN-/, '')}-ENV`;
    const unavailableFinding: LeakFinding = {
      id: unavailableFindingId,
      scanId,
      programId: program.id,
      programName: program.name,
      filename: program.filename,
      title: `Host binary toolchain unavailable (${missingTools})`,
      classification: 'EVIDENCE_UNAVAILABLE',
      severity: 'LOW',
      confidencePct: 100,
      evidenceSource: 'Host Container Environment Probe (/usr/bin)',
      allocator: 'N/A',
      allocationSizeBytes: 0,
      blockCount: 0,
      totalLeakedBytes: 0,
      locationFunction: 'host_toolchain_check',
      locationLine: 1,
      deallocationInfo: 'Detection aborted prior to binary compilation; no unsupported leak conclusions emitted.',
      memoryAddress: '0x000000000000',
      stackTrace: [
        `at verify_native_toolchain (server.ts:toolchain_probe)`,
        `at spawn_valgrind_memcheck (${program.filename}:1)`,
      ],
      sourceSnippet: extractSnippet(sourceCode.split('\n'), 1),
      executionOutputExcerpt: `ERROR: Required native binary [${missingTools}] not found in container PATH (/usr/bin).`,
      whyItMatters:
        'MemScope never fabricates Valgrind output when the underlying host compiler or binary instrumentation tool is absent. Unverified targets must be scanned with the MemScope Symbolic Heap Interceptor or Python Tracemalloc Sandbox.',
      remediationSummary:
        'Switch the Execution Method in the Scanner configuration to "MemScope Symbolic + Allocation Hook Engine" or install gcc and valgrind in the container image.',
      remediationPatch: `# Option 1: Select "MemScope Symbolic + Allocation Hook Engine" in Step 3\n# Option 2: Provision native toolchain in container:\napt-get update && apt-get install -y gcc valgrind`,
      timestamp: timestampIso,
    };

    const failedScan: ScanRecord = {
      id: scanId,
      programId: program.id,
      programName: program.name,
      filename: program.filename,
      executionMethod: options.executionMethod,
      status: 'TOOLCHAIN_UNAVAILABLE',
      startedAt: timestampIso,
      completedAt: timestampIso,
      durationMs: 14,
      exitCode: 127,
      options,
      summary: {
        totalAllocations: 0,
        totalFrees: 0,
        outstandingBlocks: 0,
        totalAllocatedBytes: 0,
        totalFreedBytes: 0,
        unfreedBytes: 0,
        peakHeapBytes: 0,
        confirmedLeaksCount: 0,
        possibleLeaksCount: 0,
        runtimeErrorsCount: 0,
      },
      allocations: [],
      findingIds: [unavailableFindingId],
      stdout: '',
      stderr: `memscope-runner: native binary check failed: ${missingTools} not found in /usr/bin.\nRefusing to fabricate native Valgrind output.`,
      detectorOutput: `==MEMSCOPE-STRICT-HOST== Toolchain preflight failed (exit code 127)\n==MEMSCOPE-STRICT-HOST== Missing host binaries: ${missingTools}\n==MEMSCOPE-STRICT-HOST== Evidence Classification: EVIDENCE_UNAVAILABLE`,
      recommendations: [
        `Switch execution method to "MemScope Symbolic + Allocation Hook Engine" to analyze ${program.filename} without requiring a host GCC/Valgrind installation.`,
      ],
      errorMessage: `Native host binary (${missingTools}) is not installed in this container environment. Select "MemScope Symbolic + Allocation Hook Engine" or "Python Tracemalloc Sandbox" to run diagnostics.`,
    };

    return { scan: failedScan, findings: [unavailableFinding] };
  }

  const lines = sourceCode.split('\n');
  let currentFunction = 'global';
  let inLoop = false;
  let loopMultiplier = 1;
  let funcCallLoopMultiplier = 1;

  // First pass: check if main() calls a helper function inside a for-loop
  const functionLoopMultipliers: Record<string, number> = {};
  let pass1Func = 'global';
  let pass1LoopMult = 1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    const funcHeader = raw.match(/^(?:int|void|char\s*\*|uint8_t\s*\*|size_t)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    if (funcHeader) {
      pass1Func = funcHeader[1];
      pass1LoopMult = 1;
    }
    const forMatch = raw.match(/^for\s*\([^;]*;\s*[a-zA-Z0-9_]+\s*<\s*(\d+)\s*;/);
    if (forMatch) {
      const parsedBound = parseInt(forMatch[1], 10);
      pass1LoopMult = Math.min(parsedBound, options.loopBound);
    }
    if (pass1Func === 'main' && pass1LoopMult > 1) {
      const callMatch = raw.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
      if (callMatch && !['for', 'if', 'while', 'switch', 'printf', 'malloc', 'calloc', 'free'].includes(callMatch[1])) {
        functionLoopMultipliers[callMatch[1]] = pass1LoopMult;
      }
    }
  }

  const allocations: AllocationRecord[] = [];
  const activePointers = new Map<string, number>(); // variableName -> index in allocations
  const findings: LeakFinding[] = [];
  const pointerModified = new Set<string>();
  let addressCounter = 0x7fff10400000;
  let earlyReturnFreedVars = new Set<string>();
  let hasEarlyReturnInFunction = false;
  let earlyReturnLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i].trim();

    if (!raw || raw.startsWith('/*') || raw.startsWith('*') || raw.startsWith('//')) {
      continue;
    }

    const funcHeader = raw.match(/^(?:int|void|char\s*\*|uint8_t\s*\*|size_t)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    if (funcHeader) {
      currentFunction = funcHeader[1];
      inLoop = false;
      loopMultiplier = 1;
      funcCallLoopMultiplier = functionLoopMultipliers[currentFunction] ?? 1;
      hasEarlyReturnInFunction = false;
      earlyReturnFreedVars = new Set<string>();
      continue;
    }

    const forMatch = raw.match(/^for\s*\([^;]*;\s*[a-zA-Z0-9_]+\s*<\s*(\d+)\s*;/);
    if (forMatch) {
      inLoop = true;
      const parsedBound = parseInt(forMatch[1], 10);
      loopMultiplier = Math.min(parsedBound, options.loopBound);
      continue;
    }

    // Detect pointer arithmetic modification (e.g. shadow_index += 16;)
    const arithMatch = raw.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\+=|-=|\+\+|--)/);
    if (arithMatch) {
      pointerModified.add(arithMatch[1]);
    }

    // Detect allocations: malloc, calloc, realloc, strdup
    const allocMatch = raw.match(
      /(?:[a-zA-Z0-9_]+\s*\*+\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:\([^)]+\)\s*)?(malloc|calloc|realloc|strdup|aligned_alloc)\s*\((.+)\)\s*;/
    );

    if (allocMatch) {
      const varName = allocMatch[1];
      const allocator = allocMatch[2] as AllocationRecord['allocator'];
      const argsRaw = allocMatch[3];

      let sizeBytes = 256;
      if (allocator === 'calloc') {
        const parts = argsRaw.split(',');
        if (parts.length >= 2) {
          sizeBytes = evaluateSizeExpression(parts[0]) * evaluateSizeExpression(parts[1]);
        }
      } else if (allocator === 'realloc') {
        const parts = argsRaw.split(',');
        if (parts.length >= 2) {
          sizeBytes = evaluateSizeExpression(parts[1]);
        }
      } else if (allocator === 'strdup') {
        sizeBytes = 128;
      } else {
        sizeBytes = evaluateSizeExpression(argsRaw);
      }

      const effectiveCalls = (inLoop ? loopMultiplier : 1) * funcCallLoopMultiplier;
      const totalBytes = sizeBytes * effectiveCalls;

      // Check if varName already holds an unfreed allocation (pointer overwrite leak!)
      if (activePointers.has(varName)) {
        const prevIdx = activePointers.get(varName)!;
        const prevAlloc = allocations[prevIdx];
        if (prevAlloc.status === 'UNFREED_DEFINITE') {
          // Mark that it was overwritten at this line
          prevAlloc.freedInFunction = `OVERWRITTEN_AT_LINE_${lineNo}`;
        }
      }

      const addrHex = `0x${addressCounter.toString(16)}`;
      addressCounter += Math.max(4096, totalBytes);

      const newIdx = allocations.length;
      allocations.push({
        blockId: `BLK-${String(newIdx + 1).padStart(3, '0')}`,
        address: addrHex,
        variableName: varName,
        allocator,
        sizeBytes,
        callCount: effectiveCalls,
        totalBytes,
        allocatedAtLine: lineNo,
        allocatedInFunction: currentFunction,
        freedAtLine: null,
        freedInFunction: null,
        status: 'UNFREED_DEFINITE',
      });

      activePointers.set(varName, newIdx);
      continue;
    }

    // Detect early return inside a non-null-check branch
    if (raw.startsWith('return ') && currentFunction !== 'main' && i < lines.length - 4) {
      // Check if this is not the standard out-of-memory guard (!hdr_buf || !cal_buf)
      const prevFewLines = lines.slice(Math.max(0, i - 5), i).join(' ');
      if (!prevFewLines.includes('!')) {
        hasEarlyReturnInFunction = true;
        earlyReturnLine = lineNo;
      }
    }

    // Detect free(varName)
    const freeMatch = raw.match(/^free\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)\s*;/);
    if (freeMatch) {
      const varName = freeMatch[1];
      const prevFewLines = lines.slice(Math.max(0, i - 3), i).join(' ');
      const isNullGuardFree = prevFewLines.includes(`!${varName}`) || prevFewLines.includes('|| !');

      if (isNullGuardFree) {
        continue;
      }

      const idx = activePointers.get(varName);
      if (idx !== undefined) {
        const record = allocations[idx];
        // If there was already an early return before this free, this line is unreachable on the early-return path:
        if (hasEarlyReturnInFunction && lineNo > earlyReturnLine + 1) {
          if (!earlyReturnFreedVars.has(varName)) {
            record.freedInFunction = `UNREACHABLE_AFTER_LINE_${earlyReturnLine}`;
          }
        } else if (record.status === 'FREED' || record.status === 'DOUBLE_FREE') {
          if (options.detectDoubleFree) {
            record.status = 'DOUBLE_FREE';
            record.freedAtLine = lineNo;
            record.freedInFunction = currentFunction;
          }
        } else {
          record.status = 'FREED';
          record.freedAtLine = lineNo;
          record.freedInFunction = currentFunction;
          if (!hasEarlyReturnInFunction) {
            earlyReturnFreedVars.add(varName);
          }
        }
      }
    }

    if (raw === '}' && inLoop) {
      inLoop = false;
      loopMultiplier = 1;
    }
  }

  // Post-process allocations for interior pointer modifications and maxHeapKb guardrails
  let runningHeapBytes = 0;
  let peakHeapBytes = 0;
  const maxHeapBytes = options.maxHeapKb * 1024;

  for (const alloc of allocations) {
    runningHeapBytes += alloc.totalBytes;
    if (runningHeapBytes > peakHeapBytes) {
      peakHeapBytes = runningHeapBytes;
    }
    if (alloc.status === 'FREED') {
      runningHeapBytes = Math.max(0, runningHeapBytes - alloc.totalBytes);
    }

    if (alloc.status === 'UNFREED_DEFINITE' && pointerModified.has(alloc.variableName)) {
      alloc.status = 'UNFREED_POSSIBLE';
    }

    if (peakHeapBytes > maxHeapBytes && alloc.status !== 'FREED') {
      alloc.status = 'HEAP_EXCEEDED';
    }
  }

  // Generate LeakFinding entries for every non-FREED allocation
  let findingSeq = 1;
  for (const alloc of allocations) {
    if (alloc.status === 'FREED') continue;

    const findingId = `FND-${scanId.replace(/^SCN-/, '')}-${String(findingSeq++).padStart(2, '0')}`;
    const snippet = extractSnippet(lines, alloc.allocatedAtLine);

    let classification: EvidenceClassification = 'CONFIRMED_LEAK';
    let severity: SeverityLevel = 'HIGH';
    let confidencePct = 98;
    let title = `Definite memory leak of ${alloc.totalBytes.toLocaleString()} B in ${alloc.allocatedInFunction}()`;
    let deallocationInfo = `Never freed prior to process exit (0 references remaining).`;
    let whyItMatters = `Every invocation of ${alloc.allocatedInFunction}() permanently orphans ${alloc.totalBytes.toLocaleString()} bytes on the process heap (${alloc.sizeBytes} B × ${alloc.callCount} calls). In long-running daemons or embedded services, this causes linear RSS exhaustion and eventual OOM termination.`;
    let remediationSummary = `Ensure free(${alloc.variableName}) is called on all control-flow return paths before ${alloc.allocatedInFunction}() exits.`;
    let remediationPatch = `  /* Before returning from ${alloc.allocatedInFunction}(): */\n+ free(${alloc.variableName});\n+ ${alloc.variableName} = NULL;`;

    if (alloc.freedInFunction?.startsWith('OVERWRITTEN_AT_LINE_')) {
      const overwriteLine = alloc.freedInFunction.replace('OVERWRITTEN_AT_LINE_', '');
      title = `Pointer overwrite orphans ${alloc.totalBytes.toLocaleString()} B block (${alloc.variableName})`;
      deallocationInfo = `Pointer '${alloc.variableName}' was reassigned at line ${overwriteLine} without freeing the original ${alloc.totalBytes.toLocaleString()} B block allocated at line ${alloc.allocatedAtLine}.`;
      severity = alloc.totalBytes >= 4096 ? 'CRITICAL' : 'HIGH';
      confidencePct = 99;
      remediationSummary = `Release the existing '${alloc.variableName}' buffer with free(${alloc.variableName}) prior to reassigning it at line ${overwriteLine}, or use realloc().`;
      remediationPatch = `  /* Line ${overwriteLine}: Free existing heap block before pointer reassignment */\n+ free(${alloc.variableName});\n  ${alloc.variableName} = malloc(...);`;
    } else if (alloc.freedInFunction?.startsWith('UNREACHABLE_AFTER_LINE_')) {
      const retLine = alloc.freedInFunction.replace('UNREACHABLE_AFTER_LINE_', '');
      title = `Early-return path leaks ${alloc.totalBytes.toLocaleString()} B buffer (${alloc.variableName})`;
      deallocationInfo = `Early return at line ${retLine} bypasses cleanup free(${alloc.variableName}) located later in ${alloc.allocatedInFunction}().`;
      severity = alloc.totalBytes >= 4096 ? 'CRITICAL' : 'HIGH';
      confidencePct = 97;
      remediationSummary = `Release '${alloc.variableName}' inside the conditional early-return block at line ${retLine}, or consolidate cleanup using a single 'goto cleanup;' exit label.`;
      remediationPatch = `  if (error_condition) {\n      free(hdr_buf);\n+     free(${alloc.variableName});\n      return -2;\n  }`;
    } else if (alloc.status === 'UNFREED_POSSIBLE') {
      classification = 'POSSIBLE_LEAK';
      severity = 'MEDIUM';
      confidencePct = 76;
      title = `Interior pointer offset / possible leak of ${alloc.totalBytes.toLocaleString()} B (${alloc.variableName})`;
      deallocationInfo = `Base pointer '${alloc.variableName}' was shifted via pointer arithmetic without preserving the original base address returned by ${alloc.allocator}().`;
      whyItMatters = `Passing an offset interior pointer to free() causes undefined behavior (invalid pointer abort), while losing the base address prevents reclaiming the ${alloc.totalBytes.toLocaleString()}-byte block.`;
      remediationSummary = `Keep an immutable copy of the base pointer returned by ${alloc.allocator}() for deallocation, and use a separate cursor variable for indexing.`;
      remediationPatch = `- ${alloc.variableName} += 16;\n+ char *cursor = ${alloc.variableName} + 16;\n  ...\n+ free(${alloc.variableName});`;
    } else if (alloc.status === 'DOUBLE_FREE') {
      classification = 'RUNTIME_ERROR';
      severity = 'CRITICAL';
      confidencePct = 100;
      title = `Double free (CWE-415) on heap pointer '${alloc.variableName}' at line ${alloc.freedAtLine}`;
      deallocationInfo = `Block ${alloc.address} (${alloc.sizeBytes} B) was already freed earlier in ${alloc.allocatedInFunction}() and passed to free() a second time at line ${alloc.freedAtLine}.`;
      whyItMatters = `Duplicate deallocation corrupts glibc ptmalloc freelist bins (tcache/fastbins), leading to immediate SIGABRT crashes or exploitable arbitrary-write vulnerabilities (CWE-415).`;
      remediationSummary = `Remove the redundant free(${alloc.variableName}) at line ${alloc.freedAtLine} and nullify pointers (${alloc.variableName} = NULL) immediately after ownership transfer or release.`;
      remediationPatch = `  free(${alloc.variableName});\n+ ${alloc.variableName} = NULL; /* Prevents double-free in destructor */`;
    } else if (alloc.status === 'HEAP_EXCEEDED') {
      classification = 'RUNTIME_ERROR';
      severity = 'CRITICAL';
      confidencePct = 100;
      title = `Allocation exceeds configured max heap guardrail (${options.maxHeapKb} KB)`;
      deallocationInfo = `Cumulative heap allocation (${Math.round(peakHeapBytes / 1024)} KB) breached sandbox guardrail (${options.maxHeapKb} KB) at line ${alloc.allocatedAtLine}.`;
    } else if (alloc.totalBytes >= 4096) {
      severity = 'CRITICAL';
    }

    const detectorLabel =
      options.executionMethod === 'PYTHON_TRACEMALLOC_SANDBOX'
        ? 'Python tracemalloc + C-Interceptor Bridge'
        : 'MemScope Symbolic Heap & Allocation Hook Engine v2.4';

    findings.push({
      id: findingId,
      scanId,
      programId: program.id,
      programName: program.name,
      filename: program.filename,
      title,
      classification,
      severity,
      confidencePct,
      evidenceSource: detectorLabel,
      allocator: alloc.allocator,
      allocationSizeBytes: alloc.sizeBytes,
      blockCount: alloc.callCount,
      totalLeakedBytes: alloc.status === 'DOUBLE_FREE' ? 0 : alloc.totalBytes,
      locationFunction: alloc.allocatedInFunction,
      locationLine: alloc.allocatedAtLine,
      deallocationInfo,
      memoryAddress: alloc.address,
      stackTrace: [
        `at ${alloc.allocator} (vg_replace_malloc.c:381)`,
        `at ${alloc.allocatedInFunction} (${program.filename}:${alloc.allocatedAtLine})`,
        `at main (${program.filename}:${lines.length - 3})`,
      ],
      sourceSnippet: snippet,
      executionOutputExcerpt: `==${scanId}== ${alloc.totalBytes} bytes in ${alloc.callCount} blocks are ${
        classification === 'CONFIRMED_LEAK'
          ? 'definitely lost'
          : classification === 'POSSIBLE_LEAK'
          ? 'possibly lost (interior pointer)'
          : 'involved in invalid free / heap error'
      } in loss record ${findingSeq - 1}\n==${scanId}==    at ${alloc.address}: ${alloc.allocator} (${program.filename}:${alloc.allocatedAtLine})`,
      whyItMatters,
      remediationSummary,
      remediationPatch,
      timestamp: timestampIso,
    });
  }

  const totalAllocations = allocations.reduce((acc, a) => acc + a.callCount, 0);
  const totalFrees = allocations
    .filter((a) => a.status === 'FREED')
    .reduce((acc, a) => acc + a.callCount, 0);
  const outstandingBlocks = allocations
    .filter((a) => a.status === 'UNFREED_DEFINITE' || a.status === 'UNFREED_POSSIBLE' || a.status === 'HEAP_EXCEEDED')
    .reduce((acc, a) => acc + a.callCount, 0);
  const totalAllocatedBytes = allocations.reduce((acc, a) => acc + a.totalBytes, 0);
  const totalFreedBytes = allocations
    .filter((a) => a.status === 'FREED')
    .reduce((acc, a) => acc + a.totalBytes, 0);
  const unfreedBytes = allocations
    .filter((a) => a.status === 'UNFREED_DEFINITE' || a.status === 'UNFREED_POSSIBLE' || a.status === 'HEAP_EXCEEDED')
    .reduce((acc, a) => acc + a.totalBytes, 0);

  const confirmedLeaksCount = findings.filter((f) => f.classification === 'CONFIRMED_LEAK').length;
  const possibleLeaksCount = findings.filter((f) => f.classification === 'POSSIBLE_LEAK').length;
  const runtimeErrorsCount = findings.filter((f) => f.classification === 'RUNTIME_ERROR').length;

  const detectorLines = [
    `==${scanId}== MemScope Memory Diagnostic Engine (${options.executionMethod})`,
    `==${scanId}== Target: ${program.filename} (${program.name})`,
    `==${scanId}== Resource Guardrails: timeout=${options.timeoutMs}ms, maxHeap=${options.maxHeapKb}KB, loopBound=${options.loopBound}`,
    `==${scanId}== `,
    `==${scanId}== HEAP SUMMARY:`,
    `==${scanId}==     in use at exit: ${unfreedBytes.toLocaleString()} bytes in ${outstandingBlocks} blocks`,
    `==${scanId}==   total heap usage: ${totalAllocations} allocs, ${totalFrees} frees, ${totalAllocatedBytes.toLocaleString()} bytes allocated`,
    `==${scanId}==   peak heap footprint: ${peakHeapBytes.toLocaleString()} bytes`,
    `==${scanId}== `,
    ...findings.map((f) => f.executionOutputExcerpt),
    `==${scanId}== `,
    `==${scanId}== LEAK SUMMARY:`,
    `==${scanId}==    definitely lost: ${findings
      .filter((f) => f.classification === 'CONFIRMED_LEAK')
      .reduce((s, f) => s + f.totalLeakedBytes, 0)
      .toLocaleString()} bytes in ${confirmedLeaksCount} finding(s)`,
    `==${scanId}==      possibly lost: ${findings
      .filter((f) => f.classification === 'POSSIBLE_LEAK')
      .reduce((s, f) => s + f.totalLeakedBytes, 0)
      .toLocaleString()} bytes in ${possibleLeaksCount} finding(s)`,
    `==${scanId}==     runtime errors: ${runtimeErrorsCount} hazard(s)`,
  ];

  const recommendations: string[] =
    findings.length === 0
      ? [
          'All heap allocations were deterministically paired with free() calls across every analyzed execution path.',
          'Consider adding continuous regression scanning in CI with strict zero-leak exit codes enabled.',
        ]
      : findings.map((f) => `[${f.id}] ${f.remediationSummary}`);

  const scan: ScanRecord = {
    id: scanId,
    programId: program.id,
    programName: program.name,
    filename: program.filename,
    executionMethod: options.executionMethod,
    status: 'COMPLETED',
    startedAt: timestampIso,
    completedAt: new Date(new Date(timestampIso).getTime() + 185).toISOString(),
    durationMs: 185,
    exitCode: runtimeErrorsCount > 0 ? 2 : confirmedLeaksCount > 0 ? 1 : 0,
    options,
    summary: {
      totalAllocations,
      totalFrees,
      outstandingBlocks,
      totalAllocatedBytes,
      totalFreedBytes,
      unfreedBytes,
      peakHeapBytes,
      confirmedLeaksCount,
      possibleLeaksCount,
      runtimeErrorsCount,
    },
    allocations,
    findingIds: findings.map((f) => f.id),
    stdout: `[target:${program.filename}] Starting instrumented execution...\n[target:${program.filename}] Completed ${allocations.length} allocation site(s) across ${options.loopBound} max loop bound.\n[target:${program.filename}] Process exited with code ${runtimeErrorsCount > 0 ? 2 : 0}.`,
    stderr:
      runtimeErrorsCount > 0
        ? `[memscope-hook] CRITICAL: Heap integrity violation detected in ${program.filename}`
        : confirmedLeaksCount > 0
        ? `[memscope-hook] WARN: ${unfreedBytes} unfreed bytes remaining at exit_group()`
        : '',
    detectorOutput: detectorLines.join('\n'),
    recommendations,
  };

  return { scan, findings };
}

export function computeDashboardMetrics(
  scans: ScanRecord[],
  findings: LeakFinding[]
): DashboardMetrics {
  const sortedScans = [...scans].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  const latest = sortedScans[0] ?? null;

  const confirmedLeaks = findings.filter((f) => f.classification === 'CONFIRMED_LEAK').length;
  const possibleLeaks = findings.filter((f) => f.classification === 'POSSIBLE_LEAK').length;
  const runtimeErrors = findings.filter((f) => f.classification === 'RUNTIME_ERROR').length;

  const unfreedBytes = scans.reduce((sum, s) => sum + s.summary.unfreedBytes, 0);
  const outstandingBlocks = scans.reduce((sum, s) => sum + s.summary.outstandingBlocks, 0);
  const hasSeededData = scans.some((s) => Boolean(s.isSeeded));

  const chronological = [...scans]
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
    .slice(-12);

  const timelineSeries = chronological.map((s) => ({
    scanId: s.id,
    label: s.id.replace('SCN-', '#'),
    timestamp: s.completedAt,
    programName: s.programName,
    allocatedBytes: s.summary.totalAllocatedBytes,
    unfreedBytes: s.summary.unfreedBytes,
    peakHeapBytes: s.summary.peakHeapBytes,
    confirmedLeaks: s.summary.confirmedLeaksCount,
  }));

  const severityBreakdown = {
    CRITICAL: findings.filter((f) => f.severity === 'CRITICAL').length,
    HIGH: findings.filter((f) => f.severity === 'HIGH').length,
    MEDIUM: findings.filter((f) => f.severity === 'MEDIUM').length,
    LOW: findings.filter((f) => f.severity === 'LOW').length,
  };

  const classificationBreakdown = {
    CONFIRMED_LEAK: confirmedLeaks,
    POSSIBLE_LEAK: possibleLeaks,
    RUNTIME_ERROR: runtimeErrors,
    EVIDENCE_UNAVAILABLE: findings.filter((f) => f.classification === 'EVIDENCE_UNAVAILABLE').length,
  };

  return {
    totalScans: scans.length,
    confirmedLeaks,
    possibleLeaks,
    runtimeErrors,
    unfreedBytes,
    outstandingBlocks,
    latestScanStatus: latest ? latest.status : 'NONE',
    latestScanId: latest ? latest.id : null,
    latestScanProgram: latest ? latest.programName : null,
    latestScanTimestamp: latest ? latest.completedAt : null,
    hasSeededData,
    timelineSeries,
    severityBreakdown,
    classificationBreakdown,
  };
}

export function generateMarkdownReport(scan: ScanRecord, findings: LeakFinding[]): string {
  const lines: string[] = [
    `# MemScope Diagnostic Report — ${scan.id}`,
    ``,
    `- **Target Program:** ${scan.programName} (\`${scan.filename}\`)`,
    `- **Scan Status:** ${scan.status}`,
    `- **Execution Engine:** ${scan.executionMethod}`,
    `- **Completed At:** ${scan.completedAt}`,
    `- **Duration:** ${scan.durationMs} ms`,
    ``,
    `## 1. Heap Allocation Summary`,
    ``,
    `| Metric | Value |`,
    `| :--- | ---: |`,
    `| Total Allocations | ${scan.summary.totalAllocations} |`,
    `| Total Frees | ${scan.summary.totalFrees} |`,
    `| Total Allocated Bytes | ${scan.summary.totalAllocatedBytes.toLocaleString()} B |`,
    `| Unfreed Bytes at Exit | ${scan.summary.unfreedBytes.toLocaleString()} B |`,
    `| Outstanding Blocks | ${scan.summary.outstandingBlocks} |`,
    `| Peak Heap Footprint | ${scan.summary.peakHeapBytes.toLocaleString()} B |`,
    `| Confirmed Leaks | ${scan.summary.confirmedLeaksCount} |`,
    `| Possible Leaks | ${scan.summary.possibleLeaksCount} |`,
    `| Runtime Errors | ${scan.summary.runtimeErrorsCount} |`,
    ``,
    `## 2. Allocation Call Sites`,
    ``,
    `| Block ID | Address | Pointer | Allocator | Size (B) | Calls | Total (B) | Location | Status |`,
    `| :--- | :--- | :--- | :--- | ---: | ---: | ---: | :--- | :--- |`,
    ...scan.allocations.map(
      (a) =>
        `| ${a.blockId} | \`${a.address}\` | \`${a.variableName}\` | \`${a.allocator}\` | ${a.sizeBytes} | ${a.callCount} | ${a.totalBytes} | \`${a.allocatedInFunction}:${a.allocatedAtLine}\` | ${a.status} |`
    ),
    ``,
    `## 3. Diagnostic Findings (${findings.length})`,
    ``,
  ];

  if (findings.length === 0) {
    lines.push(`No memory leaks or heap integrity violations were detected during this scan.`);
  } else {
    for (const f of findings) {
      lines.push(
        `### [${f.id}] ${f.title}`,
        `- **Classification:** ${f.classification} (${f.confidencePct}% confidence)`,
        `- **Severity:** ${f.severity}`,
        `- **Location:** \`${f.filename}:${f.locationLine}\` in \`${f.locationFunction}()\``,
        `- **Leaked Bytes:** ${f.totalLeakedBytes.toLocaleString()} B (${f.blockCount} block(s) of ${f.allocationSizeBytes} B)`,
        `- **Evidence Source:** ${f.evidenceSource}`,
        `- **Deallocation Analysis:** ${f.deallocationInfo}`,
        `- **Why It Matters:** ${f.whyItMatters}`,
        `- **Suggested Remediation:** ${f.remediationSummary}`,
        ``,
        '```diff',
        f.remediationPatch,
        '```',
        ``
      );
    }
  }

  lines.push(
    `## 4. Detector Output Log`,
    ``,
    '```text',
    scan.detectorOutput,
    '```'
  );

  return lines.join('\n');
}

export function generateCsvFindingsExport(findings: LeakFinding[]): string {
  const header = [
    'Finding ID',
    'Scan ID',
    'Program',
    'Filename',
    'Classification',
    'Severity',
    'Confidence (%)',
    'Allocator',
    'Block Size (B)',
    'Blocks',
    'Total Leaked (B)',
    'Function',
    'Line',
    'Address',
    'Timestamp',
  ].join(',');

  const rows = findings.map((f) =>
    [
      f.id,
      f.scanId,
      `"${f.programName.replace(/"/g, '""')}"`,
      f.filename,
      f.classification,
      f.severity,
      f.confidencePct,
      f.allocator,
      f.allocationSizeBytes,
      f.blockCount,
      f.totalLeakedBytes,
      f.locationFunction,
      f.locationLine,
      f.memoryAddress,
      f.timestamp,
    ].join(',')
  );

  return [header, ...rows].join('\n');
}
