# MemScope — Memory Leak Detection and Reporting Tool

**A web-based diagnostic platform for tracking dynamic memory allocation and identifying memory blocks that are not properly released.**

![Project](https://img.shields.io/badge/Project-OSSP%20Hackathon-0EA5E9)
![Domain](https://img.shields.io/badge/Domain-Operating%20Systems-14B8A6)
![Focus](https://img.shields.io/badge/Primary%20Focus-CO--4%20Memory%20Management-8B5CF6)
![Team](https://img.shields.io/badge/Team-Team%2014-64748B)

---

## Team Details

| Roll Number | Team Member | Responsibility |
|---|---|---|
| 2520030406 | B.L. Praveen | Frontend development and dashboard integration |
| 2520030163 | T. Dharani Dhar | Backend development and memory analysis |
| 2520030268 | Rishi Alapati | Testing, documentation and report preparation |

**Team Number:** 14  
**Course:** Operating Systems and System Programming (OSSP)  
**Hackathon Date:** 17 October 2026  
**Project Title:** Memory Leak Detection and Reporting Tool

*Note: The responsibility assignments above are suggested roles. Update them to reflect each member's actual contribution.*

---

## 1. Project Overview

MemScope is an educational memory diagnostics application designed to help developers understand and investigate memory leaks in C programs.

Dynamic memory allocation allows programs to request memory while running. When allocated memory is no longer required, it should be released appropriately. If a program fails to release memory, the unreleased allocation may remain until process termination, potentially affecting the reliability of long-running applications.

MemScope provides a centralized interface for running controlled diagnostic examples, reviewing allocation and deallocation information, inspecting findings, and generating reports.

The project demonstrates practical operating system concepts, with a primary focus on **CO-4: Memory Management**.

## 2. Problem Statement

Build a tool that tracks dynamic memory allocation and identifies memory blocks that are not properly released.

Manual investigation of memory-related problems can be time-consuming, particularly when programs contain multiple allocations and complex execution paths. Developers need a clear way to examine allocation behavior, identify potential leaks, and understand the evidence produced by diagnostic tools.

MemScope addresses this problem through a web-based interface that organizes memory analysis into a structured workflow.

## 3. Project Objectives

- Track dynamic memory allocation and deallocation in controlled test programs.
- Identify unreleased memory blocks using the configured detection engine.
- Distinguish correctly cleaned-up programs from programs with memory leaks.
- Present allocation statistics and diagnostic evidence in a readable interface.
- Maintain access to previous scan results where persistence is implemented.
- Generate downloadable diagnostic reports.
- Demonstrate the practical application of OSSP memory management concepts.

## 4. Key Features

### Dashboard
- Overview of diagnostic scan activity.
- Memory allocation and unfreed-memory visualizations.
- Latest scan status and findings.
- Summary metrics for memory analysis.

### Interactive Memory Scanner
- Selection of predefined C programs.
- Configurable execution parameters where supported.
- Controlled execution and diagnostic analysis.
- Scan status, exit code, and execution-time information.

### Memory Leak Detection
- Identification of unreleased allocations based on available evidence.
- Allocation and deallocation statistics.
- Outstanding block counts and unfreed bytes.
- Source-location information where supported by the detection engine.

### Diagnostic Findings
- Finding descriptions and severity classification.
- Inspection of supporting evidence.
- Suggested corrections for identified issues.

### Scan History and Reports
- Review of previous scans where records are persisted.
- Comparison of leaking and clean test cases.
- Downloadable Markdown and JSON reports where supported.

### OSSP Learning
- Educational explanations of dynamic memory allocation.
- Examples involving `malloc()`, `calloc()`, `realloc()`, and `free()`.
- Connections between memory management and operating system concepts.

## 5. How the System Works

MemScope follows a structured diagnostic process:

1. **Select a test program:** Choose a predefined C program from the scanner.
2. **Configure the scan:** Select supported execution and analysis options.
3. **Execute the program:** Run the test in the configured execution environment.
4. **Analyze memory behavior:** Use the implemented detection mechanism to examine allocations and releases.
5. **Display findings:** Present the detected issues, memory statistics, and supporting evidence.
6. **Generate a report:** Export the available results for documentation and further analysis.

The accuracy of each result depends on the detection engine and the evidence collected during execution. Sample data must be distinguished from genuine runtime results.

## 6. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React and web technologies |
| User interface | HTML, CSS, JavaScript/TypeScript, responsive components |
| Data visualization | Charts and diagnostic tables |
| Backend | The API framework implemented in the project |
| Diagnostic programs | C |
| Compiler | GCC, where supported |
| Memory analysis | The configured allocation-tracking or runtime analysis engine |
| Runtime verification | Valgrind Memcheck, if integrated and available |
| Development environment | Visual Studio Code |
| Version control | Git and GitHub |

The final technology list should match the actual source code and running application.

## 7. System Architecture

MemScope is organized around the following logical components:

**Presentation Layer**
- Displays the dashboard, scanner, findings, history, and reports.
- Collects user selections and presents diagnostic results.

**Application Layer**
- Validates scan requests.
- Coordinates diagnostic execution.
- Processes scan results and manages errors.

**Memory Analysis Layer**
- Executes supported C test programs.
- Collects allocation-related evidence through the configured detection engine.
- Identifies outstanding allocations where the method supports that conclusion.

**Storage and Reporting Layer**
- Stores scan information when persistent storage is implemented.
- Produces structured diagnostic reports.
- Provides access to previously recorded results.

## 8. Example Demonstration Scenarios

### Scenario A: Memory Leak

A C program allocates memory but intentionally does not release it.

**Expected result:** The detector reports outstanding allocations when supported by the analysis method.

### Scenario B: Correct Memory Cleanup

A C program allocates memory, uses it, and releases it correctly.

**Expected result:** No confirmed outstanding allocations should be reported for the tested program, subject to the detector's capabilities.

### Scenario C: Partial Memory Cleanup

A program releases some allocations but leaves others unreleased.

**Expected result:** The report distinguishes released allocations from outstanding allocations.

### Scenario D: Report Generation

A completed scan is opened and its diagnostic report is downloaded.

**Expected result:** The exported report contains the recorded information for that scan.

These are expected demonstration scenarios; actual outcomes must be verified in the target environment.

## 9. Installation and Execution

### Prerequisites

Depending on the implementation, the project may require:

- Node.js and npm.
- Python 3.10 or later.
- GCC.
- A compatible Linux environment.
- Valgrind Memcheck, if used by the detector.

### Start the Frontend

For a Vite-based frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed in the terminal, commonly:

`http://localhost:5173`

### Start the Backend

For a FastAPI backend with the documented project structure:

```bash
cd backend
python -m venv .venv
```

Activate the environment.

**Linux/macOS:**

```bash
source .venv/bin/activate
```

**Windows PowerShell:**

```powershell
.venv\Scripts\Activate.ps1
```

Install the dependencies and start the server:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

If FastAPI documentation is enabled, it is usually available at:

`http://127.0.0.1:8000/docs`

> These commands assume the corresponding frontend and backend directories exist. Follow the repository's actual structure if it differs. Runtime memory analysis may require Linux even if the frontend runs on Windows.

## 10. Testing and Validation

The following cases should be tested before final submission:

| Test Case | Validation Objective |
|---|---|
| No-leak program | Verify that allocations are correctly released. |
| Definite-leak program | Verify detection of outstanding allocations. |
| Multiple-leak program | Verify identification of multiple unreleased blocks. |
| Partial-cleanup program | Verify that released and unreleased blocks are distinguished. |
| Repeated allocation | Verify correct handling of repeated allocation and release. |
| Invalid scan request | Verify input validation and error handling. |
| Report export | Verify that generated reports contain the correct scan data. |
| Scan history | Verify that completed scans can be retrieved where persistence is implemented. |

Record actual test results, detector output, and screenshots from the target environment.

## 11. OSSP Syllabus Mapping

The project primarily demonstrates **CO-4: Memory Management**.

| Course Outcome | Relevant Concepts |
|---|---|
| CO-1 | Operating system services, user space, system calls, and application architecture. |
| CO-2 | Process execution, creation, termination, and process control where implemented. |
| CO-4 | Dynamic memory allocation, memory leaks, virtual memory concepts, and memory debugging. |
| CO-5 | File handling, report generation, and data persistence where implemented. |
| CO-6 | Concurrency and synchronization as potential extensions. |

CO-4 forms the central technical focus of MemScope. Other course outcomes provide supporting concepts and should be demonstrated according to the implemented functionality.

## 12. Security and Responsible Implementation

- Restrict execution to approved test programs unless a properly isolated environment is available.
- Avoid executing arbitrary submitted source code directly within the web server process.
- Use execution timeouts and resource limits where supported.
- Validate input parameters and handle execution failures safely.
- Report missing dependencies honestly.
- Do not expose an unrestricted diagnostic service to the public internet.
- Distinguish genuine detection results from sample or demonstration data.

## 13. Limitations

- Detection capabilities depend on the configured analysis engine.
- A single scan cannot guarantee detection of every possible memory leak.
- Memory consumption and leaked memory are different measurements.
- Live monitoring and persistent history depend on the implemented runtime and storage components.
- The project is intended for educational and controlled diagnostic use rather than unrestricted production execution.

## 14. Future Enhancements

- Additional memory-analysis engine integrations.
- Improved source-level allocation tracking.
- Stack-trace grouping and enhanced diagnostics.
- Historical memory usage trends.
- Automated memory checks in CI/CD pipelines.
- Expanded reporting and scan comparison.
- Secure, isolated execution for additional test programs.

## 15. Project Impact

MemScope helps students and developers understand how dynamic memory allocation behaves during program execution.

By connecting practical C examples with structured diagnostic output, the project supports repeatable memory debugging exercises and demonstrates how operating system concepts can be applied to software development.

## 16. Conclusion

MemScope provides a structured approach to investigating dynamic memory allocation and identifying unreleased memory blocks in controlled C programs.

Through its diagnostic interface, analysis workflow, and reporting capabilities, the project connects practical memory debugging with the principles of operating systems and system programming.

---

**MemScope — Track allocations. Detect leaks. Understand memory.**

*Developed by Team 14 for the OSSP Hackathon, 17 October 2026.*
