import React, { useState } from 'react';
import {
  BookOpen,
  Cpu,
  Layers,
  ShieldAlert,
  Play,
  Terminal,
} from 'lucide-react';
import { Button } from '../components/ui/Primitives';

interface OsspLearningViewProps {
  onLaunchScanner: (programId?: string) => void;
}

export function OsspLearningView({ onLaunchScanner }: OsspLearningViewProps) {
  const [selectedChunkSize, setSelectedChunkSize] = useState<number>(2048);
  const [prevInUse, setPrevInUse] = useState<boolean>(true);
  const [isMmaped, setIsMmaped] = useState<boolean>(false);

  const alignedChunkSize = Math.ceil((selectedChunkSize + 8) / 16) * 16;
  const flagBits = (prevInUse ? 0x1 : 0) | (isMmaped ? 0x2 : 0);
  const headerHex = `0x${(alignedChunkSize | flagBits).toString(16).padStart(16, '0')}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            OSSP Systems & Allocator Reference
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Operating Systems & Systems Programming architecture guide: Virtual Memory, glibc{' '}
            <code className="font-mono text-cyan-400">ptmalloc</code> chunks, and leak detection
            internals
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onLaunchScanner('prog-sensor-telemetry')}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Test in Memory Scanner</span>
        </Button>
      </div>

      {/* Section 1: Linux Process Virtual Address Space & Interactive Chunk Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Virtual Memory Segments (6 cols) */}
        <div className="lg:col-span-6 bg-[#111827] border border-[#1E293B] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              01. Linux x86_64 Process Virtual Address Space
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            When a C program executes on Linux, the kernel maps its virtual address space into
            distinct segments exposed via <code className="font-mono">/proc/[pid]/maps</code> and{' '}
            <code className="font-mono">/proc/[pid]/status</code>. Memory leaks specifically
            occur in the dynamic Heap and anonymous <code className="font-mono">mmap</code>{' '}
            regions.
          </p>

          <div className="space-y-2 font-mono text-xs">
            {[
              {
                addr: '0x7ffd_ffff_f000',
                segment: 'Stack (VmStk)',
                desc: 'Grows downward ↓ · Automatic local variables & stack frames',
                tone: 'border-slate-700 bg-[#0B0F17] text-slate-300',
              },
              {
                addr: '0x7f8a_4000_0000',
                segment: 'Memory Mapping Segment (mmap)',
                desc: 'Shared libraries (libc.so) & large heap allocations (>= 128 KB)',
                tone: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
              },
              {
                addr: '0x55a1_0240_0000',
                segment: 'Heap Arena (brk / sbrk)',
                desc: 'Grows upward ↑ · Managed by malloc/calloc/realloc/free (Leak Target)',
                tone: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
              },
              {
                addr: '0x55a1_0060_2000',
                segment: '.bss & .data Segments',
                desc: 'Uninitialized and initialized global / static variables',
                tone: 'border-slate-700 bg-[#0B0F17] text-slate-300',
              },
              {
                addr: '0x55a1_0040_0000',
                segment: '.text / .rodata',
                desc: 'Read-only compiled machine instructions and string literals',
                tone: 'border-slate-700 bg-[#0B0F17] text-slate-400',
              },
            ].map((seg) => (
              <div
                key={seg.segment}
                className={`p-3 rounded-md border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${seg.tone}`}
              >
                <div>
                  <div className="font-semibold">{seg.segment}</div>
                  <div className="text-[11px] opacity-80 font-sans">{seg.desc}</div>
                </div>
                <div className="text-[11px] shrink-0 opacity-90">{seg.addr}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive glibc ptmalloc Chunk Header Calculator (6 cols) */}
        <div className="lg:col-span-6 bg-[#111827] border border-[#1E293B] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              02. Interactive glibc ptmalloc Chunk Header Inspector
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every <code className="font-mono">malloc(n)</code> request returns a 16-byte aligned
            user pointer preceded by an 8-byte metadata word storing the chunk size and three
            low-order status bits (<code className="font-mono">A | M | P</code>). Double-freeing a
            chunk corrupts the forward/backward pointers (<code className="font-mono">fd/bk</code>)
            stored in the freed payload.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3.5 text-xs">
            <div>
              <label
                htmlFor="chunk-size-input"
                className="block text-slate-400 mb-1 font-medium"
              >
                Requested Payload (B)
              </label>
              <input
                id="chunk-size-input"
                type="number"
                min={16}
                max={1048576}
                step={16}
                value={selectedChunkSize}
                onChange={(e) =>
                  setSelectedChunkSize(Math.max(16, Number(e.target.value) || 16))
                }
                className="w-full h-8 px-2.5 bg-[#111827] border border-[#334155] rounded font-mono text-slate-100"
              />
            </div>
            <div className="flex items-center pt-4">
              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={prevInUse}
                  onChange={(e) => setPrevInUse(e.target.checked)}
                />
                <span>PREV_INUSE (P=1)</span>
              </label>
            </div>
            <div className="flex items-center pt-4">
              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={isMmaped}
                  onChange={(e) => setIsMmaped(e.target.checked)}
                />
                <span>IS_MMAPPED (M=2)</span>
              </label>
            </div>
          </div>

          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4 font-mono text-xs space-y-2">
            <div className="flex justify-between text-slate-400">
              <span>mchunk_prev_size (8 B):</span>
              <span className="text-slate-200">0x0000000000000000</span>
            </div>
            <div className="flex justify-between text-cyan-400 font-semibold">
              <span>mchunk_size + flags (8 B):</span>
              <span>
                {headerHex} ({alignedChunkSize} B aligned)
              </span>
            </div>
            <div className="p-2.5 bg-[#111827] border border-[#334155] rounded text-slate-200">
              <div>→ User Pointer Returned by malloc({selectedChunkSize}):</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Usable Payload: {alignedChunkSize - 8} B · Overhead: 8 B metadata
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Leak Classification Taxonomy & Detection Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-[#111827] border border-[#1E293B] rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              03. Valgrind & MemScope Leak Classification Taxonomy
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-[#0B0F17] border border-[#1E293B] rounded-lg">
              <div className="font-semibold text-red-400 mb-1">
                1. Confirmed Leak — Definitely Lost (CWE-401)
              </div>
              <p className="text-slate-300 leading-relaxed">
                No pointer to the start or interior of the allocated block remains in any register,
                stack frame, or global variable at program exit. The caller overwrote the pointer
                or returned early without calling <code className="font-mono">free()</code>.
              </p>
            </div>

            <div className="p-3.5 bg-[#0B0F17] border border-[#1E293B] rounded-lg">
              <div className="font-semibold text-amber-400 mb-1">
                2. Possible Leak — Interior Pointer / Conditional Reachability
              </div>
              <p className="text-slate-300 leading-relaxed">
                A pointer still points into the middle of an allocated block (e.g., after{' '}
                <code className="font-mono">ptr += 16</code>) rather than its base address, or
                deallocation depends on a conditional runtime branch. Passing an interior pointer to{' '}
                <code className="font-mono">free()</code> is undefined behavior.
              </p>
            </div>

            <div className="p-3.5 bg-[#0B0F17] border border-[#1E293B] rounded-lg">
              <div className="font-semibold text-rose-400 mb-1">
                3. Runtime Heap Hazard — Double Free (CWE-415) & Quarantine
              </div>
              <p className="text-slate-300 leading-relaxed">
                Calling <code className="font-mono">free(ptr)</code> twice on the same address
                corrupts allocator freelist bins (<code className="font-mono">tcache</code> /{' '}
                <code className="font-mono">fastbins</code>). Always set{' '}
                <code className="font-mono">ptr = NULL</code> immediately after release.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-[#111827] border border-[#1E293B] rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              04. Comparison of Memory Diagnostic Architectures
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] text-[11px] text-slate-400 bg-[#0B0F17]">
                  <th className="py-2.5 px-3">Engine</th>
                  <th className="py-2.5 px-3">Mechanism</th>
                  <th className="py-2.5 px-3">Overhead</th>
                  <th className="py-2.5 px-3">Primary Strength</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                <tr>
                  <td className="py-3 px-3 font-semibold text-cyan-400">
                    MemScope Symbolic + Hook Engine
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    AST control-flow + allocation table simulation
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">&lt; 25 ms</td>
                  <td className="py-3 px-3 text-slate-300">
                    Works in hermetic containers without root or host gcc
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-slate-200">
                    Valgrind Memcheck
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    Dynamic binary translation + V/A shadow bits
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">10× – 30×</td>
                  <td className="py-3 px-3 text-slate-300">
                    Bit-accurate uninitialized read & leak detection on ELF binaries
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-slate-200">
                    AddressSanitizer (ASan + LSan)
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    Compile-time redzones + 1:8 shadow memory
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">~2×</td>
                  <td className="py-3 px-3 text-slate-300">
                    Fast CI execution; catches out-of-bounds & use-after-free
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-slate-200">
                    LD_PRELOAD dlsym Interposer
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    Dynamic linker symbol interposition on malloc/free
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">~1.15×</td>
                  <td className="py-3 px-3 text-slate-300">
                    Lightweight production heap profiling without recompilation
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onLaunchScanner('prog-cache-evictor')}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Analyze Double-Free Target (lru_cache_dangling.c)</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onLaunchScanner('prog-packet-router')}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Analyze Interior Pointer Target (packet_router_table.c)</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
