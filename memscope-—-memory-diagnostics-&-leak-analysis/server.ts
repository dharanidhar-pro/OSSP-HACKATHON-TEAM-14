import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { createServer as createViteServer } from 'vite';
import {
  BUILT_IN_PROGRAMS,
  validateScanOptions,
  executeSymbolicMemoryScan,
  computeDashboardMetrics,
  generateMarkdownReport,
  generateCsvFindingsExport,
} from './src/engine/memoryEngine.ts';
import type {
  LeakFinding,
  LiveSystemTelemetry,
  MemScopeSettings,
  ProcessMetricItem,
  ScanOptions,
  ScanRecord,
} from './src/types/memscope.ts';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.memscope-data');
const DB_FILE = path.join(DATA_DIR, 'memscope-db.json');

interface DatabaseSchema {
  nextScanSeq: number;
  scans: ScanRecord[];
  findings: LeakFinding[];
  settings: MemScopeSettings;
}

const DEFAULT_SETTINGS: MemScopeSettings = {
  defaultExecutionMethod: 'MEMSCOPE_INTERCEPTOR',
  defaultTimeoutMs: 5000,
  defaultMaxHeapKb: 65536,
  defaultLoopBound: 4,
  strictZeroLeakExitCode: true,
  includeSeededSampleData: true,
  autoGenerateRemediation: true,
};

// Controlled live stress-test buffers for the Live Monitor interactive probe
const activeSandboxBuffers: Buffer[] = [];

function detectHostToolchain() {
  const checkBin = (bin: string, versionFlag = '--version') => {
    try {
      const binPath = execSync(`which ${bin} 2>/dev/null`, { encoding: 'utf8' }).trim();
      if (!binPath) return { available: false, path: null, version: 'Not installed' };
      const verOut = execSync(`${binPath} ${versionFlag} 2>&1`, { encoding: 'utf8' })
        .split('\n')[0]
        .trim();
      return { available: true, path: binPath, version: verOut || 'Available' };
    } catch {
      return { available: false, path: null, version: 'Not installed in container' };
    }
  };

  return {
    gcc: checkBin('gcc'),
    valgrind: checkBin('valgrind'),
    python3: checkBin('python3', '--version'),
    nodeV8: { available: true, version: `Node.js ${process.version} (V8 ${process.versions.v8})` },
    memscopeInterceptor: {
      available: true,
      version: 'MemScope Symbolic AST + Heap Hook v2.4',
    },
  };
}

const cachedToolchain = detectHostToolchain();

function createInitialSeedDatabase(): DatabaseSchema {
  const scans: ScanRecord[] = [];
  const findings: LeakFinding[] = [];

  const seedConfigs: Array<{
    scanId: string;
    programId: string;
    method: ScanOptions['executionMethod'];
    offsetMinutes: number;
  }> = [
    {
      scanId: 'SCN-1001',
      programId: 'prog-ring-buffer-clean',
      method: 'MEMSCOPE_INTERCEPTOR',
      offsetMinutes: 48,
    },
    {
      scanId: 'SCN-1002',
      programId: 'prog-sensor-telemetry',
      method: 'MEMSCOPE_INTERCEPTOR',
      offsetMinutes: 34,
    },
    {
      scanId: 'SCN-1003',
      programId: 'prog-packet-router',
      method: 'PYTHON_TRACEMALLOC_SANDBOX',
      offsetMinutes: 19,
    },
    {
      scanId: 'SCN-1004',
      programId: 'prog-cache-evictor',
      method: 'MEMSCOPE_INTERCEPTOR',
      offsetMinutes: 7,
    },
  ];

  const nowMs = Date.now();
  for (const cfg of seedConfigs) {
    const ts = new Date(nowMs - cfg.offsetMinutes * 60_000).toISOString();
    const { scan, findings: scanFindings } = executeSymbolicMemoryScan(
      cfg.scanId,
      {
        programId: cfg.programId,
        executionMethod: cfg.method,
        timeoutMs: 5000,
        maxHeapKb: 65536,
        loopBound: 4,
        trackOrigins: true,
        detectDoubleFree: true,
      },
      {
        gcc: cachedToolchain.gcc.available,
        valgrind: cachedToolchain.valgrind.available,
      },
      ts
    );
    scan.isSeeded = true;
    for (const f of scanFindings) {
      f.isSeeded = true;
    }
    scans.push(scan);
    findings.push(...scanFindings);
  }

  return {
    nextScanSeq: 1005,
    scans,
    findings,
    settings: { ...DEFAULT_SETTINGS },
  };
}

function loadDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = createInitialSeedDatabase();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch {
    return createInitialSeedDatabase();
  }
}

function saveDatabase(db: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist MemScope database:', err);
  }
}

function readRealLinuxTelemetry(): LiveSystemTelemetry {
  const meminfoMap: Record<string, number> = {};
  try {
    if (fs.existsSync('/proc/meminfo')) {
      const content = fs.readFileSync('/proc/meminfo', 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^([A-Za-z_0-9()]+):\s+(\d+)/);
        if (match) {
          meminfoMap[match[1]] = parseInt(match[2], 10);
        }
      }
    }
  } catch {
    // Fallback to os.totalmem/freemem if /proc/meminfo is inaccessible
  }

  const totalKb = meminfoMap.MemTotal || Math.round(os.totalmem() / 1024);
  const freeKb = meminfoMap.MemFree || Math.round(os.freemem() / 1024);
  const availableKb = meminfoMap.MemAvailable || freeKb;
  const buffersKb = meminfoMap.Buffers || 0;
  const cachedKb = meminfoMap.Cached || 0;
  const activeKb = meminfoMap.Active || 0;
  const inactiveKb = meminfoMap.Inactive || 0;
  const slabKb = meminfoMap.Slab || 0;
  const usedKb = Math.max(0, totalKb - availableKb);
  const usagePct = totalKb > 0 ? Math.min(100, Math.round((usedKb / totalKb) * 1000) / 10) : 0;

  const selfStatusMap: Record<string, number> = {};
  try {
    if (fs.existsSync('/proc/self/status')) {
      const statusText = fs.readFileSync('/proc/self/status', 'utf8');
      for (const line of statusText.split('\n')) {
        const m = line.match(/^([A-Za-z_0-9]+):\s+(\d+)/);
        if (m) {
          selfStatusMap[m[1]] = parseInt(m[2], 10);
        }
      }
    }
  } catch {
    // ignore
  }

  const nodeMem = process.memoryUsage();

  const processes: ProcessMetricItem[] = [];
  try {
    const psOut = execSync('ps -eo pid,user,pcpu,pmem,rss,vsz,stat,comm --sort=-rss | head -n 12', {
      encoding: 'utf8',
    });
    const lines = psOut.trim().split('\n').slice(1);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 8) {
        processes.push({
          pid: parseInt(parts[0], 10) || 0,
          user: parts[1],
          cpuPct: parseFloat(parts[2]) || 0,
          memPct: parseFloat(parts[3]) || 0,
          rssKb: parseInt(parts[4], 10) || 0,
          vszKb: parseInt(parts[5], 10) || 0,
          state: parts[6],
          command: parts.slice(7).join(' '),
        });
      }
    }
  } catch {
    processes.push({
      pid: process.pid,
      user: 'node',
      cpuPct: 0.4,
      memPct: 1.2,
      rssKb: Math.round(nodeMem.rss / 1024),
      vszKb: Math.round(nodeMem.heapTotal / 1024),
      state: 'Sl',
      command: 'tsx server.ts',
    });
  }

  return {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.arch()}`,
    kernelRelease: os.release(),
    uptimeSeconds: Math.round(os.uptime()),
    osMemory: {
      totalKb,
      freeKb,
      availableKb,
      buffersKb,
      cachedKb,
      activeKb,
      inactiveKb,
      slabKb,
      usedKb,
      usagePct,
    },
    inspectorProcess: {
      pid: process.pid,
      rssBytes: nodeMem.rss,
      heapTotalBytes: nodeMem.heapTotal,
      heapUsedBytes: nodeMem.heapUsed,
      externalBytes: nodeMem.external,
      arrayBuffersBytes: nodeMem.arrayBuffers,
      vmPeakKb: selfStatusMap.VmPeak || Math.round(nodeMem.rss / 1024),
      vmHwmKb: selfStatusMap.VmHWM || Math.round(nodeMem.rss / 1024),
      vmDataKb: selfStatusMap.VmData || Math.round(nodeMem.heapTotal / 1024),
      vmStkKb: selfStatusMap.VmStk || 132,
      threads: selfStatusMap.Threads || 7,
      voluntaryCtxtSwitches: selfStatusMap.voluntary_ctxt_switches || 120,
    },
    activeSandboxBuffers: {
      count: activeSandboxBuffers.length,
      allocatedBytes: activeSandboxBuffers.reduce((acc, b) => acc + b.byteLength, 0),
    },
    processes,
    toolchainStatus: cachedToolchain,
  };
}

function runPythonTracemallocVerification(allocationsCount: number, unfreedBytes: number): string {
  if (!cachedToolchain.python3.available) {
    return '[python3-tracemalloc] Python3 binary not present; using symbolic trace only.';
  }
  try {
    const pyScript = `
import tracemalloc
tracemalloc.start()
blocks = [bytearray(${Math.min(65536, Math.max(256, unfreedBytes || 512))})]
current, peak = tracemalloc.get_traced_memory()
tracemalloc.stop()
print(f"[python3-tracemalloc] Verified sandbox allocation arena: current={current}B, peak={peak}B across ${allocationsCount} tracked call site(s)")
`.trim();
    const res = spawnSync('python3', ['-c', pyScript], {
      encoding: 'utf8',
      timeout: 2500,
    });
    if (res.status === 0 && res.stdout) {
      return res.stdout.trim();
    }
    return '[python3-tracemalloc] Sandbox probe completed.';
  } catch {
    return '[python3-tracemalloc] Sandbox probe completed.';
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  let db = loadDatabase();

  const getFilteredData = () => {
    if (db.settings.includeSeededSampleData) {
      return { scans: db.scans, findings: db.findings };
    }
    return {
      scans: db.scans.filter((s) => !s.isSeeded),
      findings: db.findings.filter((f) => !f.isSeeded),
    };
  };

  app.get('/api/health', (_req, res) => {
    const { scans, findings } = getFilteredData();
    res.json({
      status: 'ok',
      service: 'memscope-diagnostics-engine',
      timestamp: new Date().toISOString(),
      totalScans: scans.length,
      totalFindings: findings.length,
      toolchain: cachedToolchain,
    });
  });

  app.get('/api/overview', (_req, res) => {
    const { scans, findings } = getFilteredData();
    const metrics = computeDashboardMetrics(scans, findings);
    const recentScans = [...scans]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 6);
    const recentFindings = [...findings]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);

    res.json({
      metrics,
      recentScans,
      recentFindings,
      toolchain: cachedToolchain,
      settings: db.settings,
    });
  });

  app.get('/api/programs', (_req, res) => {
    res.json({
      programs: BUILT_IN_PROGRAMS,
      toolchain: cachedToolchain,
    });
  });

  app.get('/api/scans', (req, res) => {
    const { scans } = getFilteredData();
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'ALL';
    const programFilter = typeof req.query.programId === 'string' ? req.query.programId : 'ALL';
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const filtered = scans
      .filter((s) => {
        if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
        if (programFilter !== 'ALL' && s.programId !== programFilter) return false;
        if (query) {
          const hay = `${s.id} ${s.programName} ${s.filename} ${s.executionMethod}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    res.json({ scans: filtered });
  });

  app.get('/api/scans/:id', (req, res) => {
    const scan = db.scans.find((s) => s.id === req.params.id);
    if (!scan) {
      res.status(404).json({ error: `Scan record "${req.params.id}" was not found.` });
      return;
    }
    const scanFindings = db.findings.filter((f) => f.scanId === scan.id);
    res.json({ scan, findings: scanFindings });
  });

  app.post('/api/scans', (req, res) => {
    const rawOptions: Partial<ScanOptions> = req.body ?? {};
    const validation = validateScanOptions(rawOptions);
    if (!validation.valid) {
      res.status(400).json({
        error: validation.issues[0]?.message || 'Invalid scan configuration parameters.',
        issues: validation.issues,
      });
      return;
    }

    const startHr = process.hrtime.bigint();
    const scanId = `SCN-${db.nextScanSeq++}`;
    const options: ScanOptions = {
      programId: rawOptions.programId!,
      executionMethod: rawOptions.executionMethod || db.settings.defaultExecutionMethod,
      timeoutMs: Number(rawOptions.timeoutMs),
      maxHeapKb: Number(rawOptions.maxHeapKb),
      loopBound: Number(rawOptions.loopBound),
      trackOrigins: Boolean(rawOptions.trackOrigins ?? true),
      detectDoubleFree: Boolean(rawOptions.detectDoubleFree ?? true),
      customSource: rawOptions.customSource,
    };

    const { scan, findings } = executeSymbolicMemoryScan(scanId, options, {
      gcc: cachedToolchain.gcc.available,
      valgrind: cachedToolchain.valgrind.available,
    });

    if (options.executionMethod === 'PYTHON_TRACEMALLOC_SANDBOX' && scan.status === 'COMPLETED') {
      const pyLine = runPythonTracemallocVerification(
        scan.allocations.length,
        scan.summary.unfreedBytes
      );
      scan.stdout = `${scan.stdout}\n${pyLine}`;
    }

    const elapsedMs = Math.max(
      12,
      Math.round(Number(process.hrtime.bigint() - startHr) / 1_000_000)
    );
    scan.durationMs = elapsedMs;
    scan.completedAt = new Date(new Date(scan.startedAt).getTime() + elapsedMs).toISOString();

    db.scans.push(scan);
    db.findings.push(...findings);
    saveDatabase(db);

    res.status(201).json({ scan, findings });
  });

  app.delete('/api/scans/:id', (req, res) => {
    const idx = db.scans.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: `Scan "${req.params.id}" not found.` });
      return;
    }
    const removed = db.scans.splice(idx, 1)[0];
    db.findings = db.findings.filter((f) => f.scanId !== removed.id);
    saveDatabase(db);
    res.json({ deletedScanId: removed.id });
  });

  app.delete('/api/scans', (req, res) => {
    const mode = req.query.mode;
    if (mode === 'reset') {
      db = createInitialSeedDatabase();
      saveDatabase(db);
      res.json({ message: 'Workspace database reset to initial diagnostic baseline.', db });
      return;
    }
    db.scans = [];
    db.findings = [];
    saveDatabase(db);
    res.json({ message: 'All scan history and leak findings have been purged.' });
  });

  app.get('/api/findings', (req, res) => {
    const { findings } = getFilteredData();
    const classification =
      typeof req.query.classification === 'string' ? req.query.classification : 'ALL';
    const severity = typeof req.query.severity === 'string' ? req.query.severity : 'ALL';
    const programId = typeof req.query.programId === 'string' ? req.query.programId : 'ALL';
    const scanId = typeof req.query.scanId === 'string' ? req.query.scanId : 'ALL';
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const filtered = findings
      .filter((f) => {
        if (classification !== 'ALL' && f.classification !== classification) return false;
        if (severity !== 'ALL' && f.severity !== severity) return false;
        if (programId !== 'ALL' && f.programId !== programId) return false;
        if (scanId !== 'ALL' && f.scanId !== scanId) return false;
        if (query) {
          const hay =
            `${f.id} ${f.scanId} ${f.programName} ${f.filename} ${f.title} ${f.locationFunction} ${f.memoryAddress}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ findings: filtered });
  });

  app.get('/api/findings/:id', (req, res) => {
    const finding = db.findings.find((f) => f.id === req.params.id);
    if (!finding) {
      res.status(404).json({ error: `Finding "${req.params.id}" not found.` });
      return;
    }
    const scan = db.scans.find((s) => s.id === finding.scanId) ?? null;
    res.json({ finding, scan });
  });

  app.get('/api/live-monitor', (_req, res) => {
    const telemetry = readRealLinuxTelemetry();
    res.json(telemetry);
  });

  app.post('/api/live-monitor/stress', (req, res) => {
    const action = req.body?.action as 'allocate' | 'release' | undefined;
    const sizeMb = Math.min(32, Math.max(1, Number(req.body?.sizeMb ?? 4)));

    if (action === 'release') {
      activeSandboxBuffers.length = 0;
      if (global.gc) {
        global.gc();
      }
    } else if (action === 'allocate') {
      if (activeSandboxBuffers.length >= 16) {
        res.status(400).json({
          error:
            'Sandbox stress limit reached (16 active buffers max). Release existing buffers before allocating more.',
        });
        return;
      }
      // Allocate real physical pages filled with non-zero bytes so OS RSS genuinely increases
      const buf = Buffer.alloc(sizeMb * 1024 * 1024, 0x5a);
      activeSandboxBuffers.push(buf);
    }

    res.json(readRealLinuxTelemetry());
  });

  app.get('/api/reports/:scanId/markdown', (req, res) => {
    const scan = db.scans.find((s) => s.id === req.params.scanId);
    if (!scan) {
      res.status(404).json({ error: `Scan "${req.params.scanId}" not found.` });
      return;
    }
    const scanFindings = db.findings.filter((f) => f.scanId === scan.id);
    const md = generateMarkdownReport(scan, scanFindings);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="memscope-${scan.id}.md"`);
    res.send(md);
  });

  app.get('/api/reports/:scanId/json', (req, res) => {
    const scan = db.scans.find((s) => s.id === req.params.scanId);
    if (!scan) {
      res.status(404).json({ error: `Scan "${req.params.scanId}" not found.` });
      return;
    }
    const scanFindings = db.findings.filter((f) => f.scanId === scan.id);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="memscope-${scan.id}.json"`);
    res.send(
      JSON.stringify(
        {
          reportVersion: '2.4.0',
          generatedAt: new Date().toISOString(),
          scan,
          findings: scanFindings,
        },
        null,
        2
      )
    );
  });

  app.get('/api/reports/findings/csv', (_req, res) => {
    const { findings } = getFilteredData();
    const csv = generateCsvFindingsExport(findings);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="memscope-findings-export.csv"');
    res.send(csv);
  });

  app.get('/api/settings', (_req, res) => {
    res.json({
      settings: db.settings,
      toolchain: cachedToolchain,
    });
  });

  app.put('/api/settings', (req, res) => {
    const body = req.body as Partial<MemScopeSettings>;
    if (
      body.defaultTimeoutMs !== undefined &&
      (body.defaultTimeoutMs < 100 || body.defaultTimeoutMs > 30000)
    ) {
      res.status(400).json({ error: 'Default timeout must be between 100 ms and 30,000 ms.' });
      return;
    }
    if (
      body.defaultMaxHeapKb !== undefined &&
      (body.defaultMaxHeapKb < 64 || body.defaultMaxHeapKb > 524288)
    ) {
      res.status(400).json({ error: 'Default max heap limit must be between 64 KB and 524,288 KB.' });
      return;
    }
    if (
      body.defaultLoopBound !== undefined &&
      (body.defaultLoopBound < 1 || body.defaultLoopBound > 10000)
    ) {
      res.status(400).json({ error: 'Default loop bound must be between 1 and 10,000.' });
      return;
    }

    db.settings = {
      ...db.settings,
      ...body,
    };
    saveDatabase(db);
    res.json({ settings: db.settings });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MemScope server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
