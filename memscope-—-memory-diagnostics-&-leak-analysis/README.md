# MemScope — Memory Diagnostics & Leak Analysis

MemScope is a developer observability, heap allocation tracing, and memory leak detection platform engineered for Operating Systems & Systems Programming (OSSP) diagnostics.

## Core Capabilities

1. **Workspace Diagnostic Overview**:
   - Real-time backend metrics: Total Scans, Confirmed Leaks, Unfreed Bytes, Outstanding Allocation Blocks, and Latest Scan Status.
   - Comparative Heap Allocation vs. Unfreed Memory bar chart and Findings Classification distribution.
   - Explicit distinction between baseline demonstration scans and user-triggered executions.

2. **6-Step Interactive Memory Scanner**:
   - Built-in C diagnostic targets (`sensor_buffer_leak.c`, `packet_router_table.c`, `lru_cache_dangling.c`, `tiff_strip_decoder.c`, `clean_ring_buffer.c`) plus an interactive **Custom C Source Diagnostic Sandbox**.
   - Configurable resource guardrails (`Timeout ms`, `Max Heap KB`, `Loop Unroll Bound`, Origin Tracking, Double-Free Quarantine).
   - Multi-engine architecture:
     - **MemScope Symbolic + Allocation Hook Engine**: AST control-flow and pointer-lifetime simulator for `malloc`, `calloc`, `realloc`, `strdup`, and `free`.
     - **Python 3 `tracemalloc` Arena Bridge**: Pairs symbolic C analysis with live container `tracemalloc` heap verification.
     - **Strict Host Valgrind / GCC Probe**: Probes `/usr/bin/gcc` and `/usr/bin/valgrind` and honestly reports `TOOLCHAIN_UNAVAILABLE` if absent in the container rather than fabricating output.

3. **Live OS & Process Memory Monitor**:
   - Reads genuine Linux `/proc/meminfo`, `/proc/self/status` (`VmPeak`, `VmHWM`, `VmData`, `VmStk`), `ps -eo` process RSS tables, and Node.js V8 heap metrics.
   - Includes an interactive **Physical Heap Allocation Probe** (`Buffer.alloc`) to observe real-time RSS and high-water mark changes.

4. **Leak Findings & Evidence Catalog**:
   - Clearly separates **Confirmed Leaks** (`CWE-401`), **Possible Leaks** (interior pointer arithmetic / conditional reachability), **Runtime Heap Hazards** (`CWE-415` Double Free), and **Evidence Unavailable**.
   - Slide-over Evidence Inspector with virtual addresses, stack traces, source context, and unified diff remediation patches.

5. **Scan History & Diagnostic Reports**:
   - Persistent JSON database storage (`.memscope-data/memscope-db.json`).
   - One-click export for Markdown (`.md`), JSON (`.json`), and workspace-wide CSV (`.csv`) reports.
