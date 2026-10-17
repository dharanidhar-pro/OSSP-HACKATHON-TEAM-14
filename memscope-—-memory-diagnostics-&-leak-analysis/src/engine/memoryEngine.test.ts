import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILT_IN_PROGRAMS,
  validateScanOptions,
  executeSymbolicMemoryScan,
  computeDashboardMetrics,
  generateMarkdownReport,
  generateCsvFindingsExport,
} from './memoryEngine.ts';

test('validateScanOptions accepts valid scan configuration and rejects invalid limits', () => {
  const validResult = validateScanOptions({
    programId: 'prog-sensor-telemetry',
    executionMethod: 'MEMSCOPE_INTERCEPTOR',
    timeoutMs: 5000,
    maxHeapKb: 65536,
    loopBound: 4,
    trackOrigins: true,
    detectDoubleFree: true,
  });
  assert.equal(validResult.valid, true);
  assert.equal(validResult.issues.length, 0);

  const invalidResult = validateScanOptions({
    programId: 'unknown-id',
    executionMethod: 'MEMSCOPE_INTERCEPTOR',
    timeoutMs: 20, // below 100ms
    maxHeapKb: 10, // below 64KB
    loopBound: 0, // below 1
  });
  assert.equal(invalidResult.valid, false);
  assert.equal(invalidResult.issues.length, 4);
});

test('executeSymbolicMemoryScan detects early-return definite leak in sensor_buffer_leak.c', () => {
  const { scan, findings } = executeSymbolicMemoryScan(
    'SCN-1001',
    {
      programId: 'prog-sensor-telemetry',
      executionMethod: 'MEMSCOPE_INTERCEPTOR',
      timeoutMs: 5000,
      maxHeapKb: 65536,
      loopBound: 4,
      trackOrigins: true,
      detectDoubleFree: true,
    },
    { gcc: false, valgrind: false },
    '2026-10-16T22:00:00.000Z'
  );

  assert.equal(scan.status, 'COMPLETED');
  assert.equal(scan.summary.confirmedLeaksCount, 1);
  assert.equal(scan.summary.unfreedBytes, 8192); // 2048 * 4 iterations
  assert.equal(findings.length, 1);
  assert.equal(findings[0].classification, 'CONFIRMED_LEAK');
  assert.equal(findings[0].totalLeakedBytes, 8192);
});

test('executeSymbolicMemoryScan detects zero leaks on clean_ring_buffer.c', () => {
  const { scan, findings } = executeSymbolicMemoryScan(
    'SCN-1002',
    {
      programId: 'prog-ring-buffer-clean',
      executionMethod: 'MEMSCOPE_INTERCEPTOR',
      timeoutMs: 5000,
      maxHeapKb: 65536,
      loopBound: 4,
      trackOrigins: true,
      detectDoubleFree: true,
    },
    { gcc: false, valgrind: false },
    '2026-10-16T22:01:00.000Z'
  );

  assert.equal(scan.status, 'COMPLETED');
  assert.equal(scan.summary.unfreedBytes, 0);
  assert.equal(scan.summary.confirmedLeaksCount, 0);
  assert.equal(findings.length, 0);
  assert.equal(scan.exitCode, 0);
});

test('executeSymbolicMemoryScan detects double-free runtime error and leak in lru_cache_dangling.c', () => {
  const { scan, findings } = executeSymbolicMemoryScan(
    'SCN-1003',
    {
      programId: 'prog-cache-evictor',
      executionMethod: 'MEMSCOPE_INTERCEPTOR',
      timeoutMs: 5000,
      maxHeapKb: 65536,
      loopBound: 4,
      trackOrigins: true,
      detectDoubleFree: true,
    },
    { gcc: false, valgrind: false },
    '2026-10-16T22:02:00.000Z'
  );

  assert.equal(scan.status, 'COMPLETED');
  assert.equal(scan.summary.runtimeErrorsCount, 1);
  assert.equal(scan.summary.confirmedLeaksCount, 1);
  assert.equal(scan.exitCode, 2);
  assert.equal(findings.some((f) => f.classification === 'RUNTIME_ERROR'), true);
  assert.equal(findings.some((f) => f.classification === 'CONFIRMED_LEAK'), true);
});

test('executeSymbolicMemoryScan honestly reports TOOLCHAIN_UNAVAILABLE when strict host Valgrind is missing', () => {
  const { scan, findings } = executeSymbolicMemoryScan(
    'SCN-1004',
    {
      programId: 'prog-sensor-telemetry',
      executionMethod: 'NATIVE_VALGRIND_STRICT',
      timeoutMs: 5000,
      maxHeapKb: 65536,
      loopBound: 4,
      trackOrigins: true,
      detectDoubleFree: true,
    },
    { gcc: false, valgrind: false },
    '2026-10-16T22:03:00.000Z'
  );

  assert.equal(scan.status, 'TOOLCHAIN_UNAVAILABLE');
  assert.equal(scan.summary.confirmedLeaksCount, 0);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].classification, 'EVIDENCE_UNAVAILABLE');
});

test('computeDashboardMetrics and report generators produce accurate outputs', () => {
  const r1 = executeSymbolicMemoryScan(
    'SCN-1001',
    {
      programId: 'prog-sensor-telemetry',
      executionMethod: 'MEMSCOPE_INTERCEPTOR',
      timeoutMs: 5000,
      maxHeapKb: 65536,
      loopBound: 4,
      trackOrigins: true,
      detectDoubleFree: true,
    },
    { gcc: false, valgrind: false },
    '2026-10-16T22:00:00.000Z'
  );

  const metrics = computeDashboardMetrics([r1.scan], r1.findings);
  assert.equal(metrics.totalScans, 1);
  assert.equal(metrics.confirmedLeaks, 1);
  assert.equal(metrics.unfreedBytes, 8192);

  const md = generateMarkdownReport(r1.scan, r1.findings);
  assert.ok(md.includes('# MemScope Diagnostic Report — SCN-1001'));
  assert.ok(md.includes('8,192 B'));

  const csv = generateCsvFindingsExport(r1.findings);
  assert.ok(csv.includes('FND-1001-01'));
  assert.ok(csv.includes('CONFIRMED_LEAK'));
  assert.ok(BUILT_IN_PROGRAMS.length >= 5);
});
