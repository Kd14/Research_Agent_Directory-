# CLAUDE.md

> **Canonical Engineering Specification**
>
> **Project:** Aether Orchestrator (NexusAgent Network)
>
> **Version:** 1.0
>
> **Status:** Living Engineering Specification
>
> **Audience:** Claude Code, Gemini CLI, OpenAI Codex, Cursor, Windsurf, Cline, Roo Code, and all contributors.

---

# Purpose

This document is the authoritative engineering specification for the Aether Orchestrator codebase.

It serves as the single source of truth describing how the repository should evolve, how engineering decisions should be made, how AI coding agents should behave when modifying the codebase, and what architectural constraints must never be violated.

Unlike conventional README files, this document is **not** intended to teach users how to use the software.

Its purpose is to define how the software itself should be engineered.

Every implementation should be evaluated against the principles described here before it is considered complete.

Whenever ambiguity exists between implementation and this document, the principles contained here take precedence unless an explicit Architectural Decision Record (ADR) supersedes them.

---

# Table of Contents

1. Vision
2. Philosophy
3. Engineering Principles
4. Design Goals
5. Non-Goals
6. Repository Philosophy
7. System Overview
8. Architectural Principles
9. AI Engineering Rules
10. Development Workflow
11. Repository Structure
12. Coding Standards
13. Documentation Standards
14. Naming Conventions
15. Quality Standards
16. Definition of Done

---

# Vision

Aether Orchestrator exists to become a production-grade multi-agent research platform capable of coordinating specialised AI systems to perform complex technical reasoning with deterministic, explainable, and verifiable execution.

Rather than relying upon a single general-purpose language model, the system decomposes complex work into specialised responsibilities executed by independent agents.

Each agent possesses:

- a clearly defined role,
- bounded responsibilities,
- explicit tool access,
- deterministic interfaces,
- verifiable outputs.

The orchestrator coordinates these agents through structured planning and controlled execution rather than allowing unconstrained autonomous behaviour.

The platform is designed around one core belief:

> Intelligence becomes substantially more reliable when reasoning, retrieval, verification, and synthesis are separated into independently observable systems.

---

# Philosophy

The architecture intentionally avoids treating the language model as the application.

Instead, language models are considered one component within a much larger software system.

The application owns:

- orchestration
- planning
- execution
- persistence
- validation
- permissions
- security
- observability

The language model provides:

- reasoning
- decomposition
- synthesis
- semantic interpretation
- explanation

This separation dramatically improves reproducibility, debugging, scalability, and maintainability.

---

# Engineering Principles

The following principles are absolute.

## Principle 1 — Determinism Over Magic

Whenever deterministic software can solve a problem, deterministic software should solve the problem.

The LLM should never perform work that can be implemented as ordinary software.

Examples:

Good:

- Parsing JSON
- Sorting data
- Mathematical computation
- Validation
- File management

Bad:

"Ask the model to calculate."

---

## Principle 2 — Explicit State

State should never exist implicitly inside prompts.

Every important piece of information should exist in one of:

- database
- cache
- session object
- vector store
- configuration
- structured context

Never rely upon conversation history alone.

---

## Principle 3 — Tool First

If information can be retrieved using a tool, retrieve it.

Never encourage the model to guess.

Retrieval always takes precedence over generation.

---

## Principle 4 — Explainability

Every major decision should be explainable.

Every report should be reproducible.

Every conclusion should be attributable.

The system should always be capable of answering:

Why was this conclusion reached?

---

## Principle 5 — Small Components

Prefer many small specialised components rather than large generic ones.

Each service should own one responsibility.

Each module should expose one interface.

Each agent should have one purpose.

---

## Principle 6 — Replaceability

Every subsystem should be replaceable.

Examples:

Gemini replaced by Claude.

Claude replaced by GPT.

Pinecone replaced by pgvector.

Express replaced by Fastify.

React replaced by another frontend.

The architecture should remain largely unchanged.

---

# Design Goals

The project aims to optimise for the following qualities.

## Reliability

The same request should produce structurally similar execution plans.

Random behaviour should be minimised.

---

## Transparency

Every tool call should be visible.

Every prompt should be inspectable.

Every intermediate result should be observable.

---

## Extensibility

Adding a new agent should require minimal changes.

Adding a new tool should not require modifying the orchestrator.

Adding a new model provider should require only implementing an adapter.

---

## Production Readiness

Prototype shortcuts are unacceptable.

Engineering decisions should assume:

- large document collections
- long-running sessions
- concurrent users
- distributed services
- monitoring
- deployment
- recovery

---

## Scalability

Every major subsystem should scale independently.

Planning.

Execution.

Retrieval.

Embedding.

Streaming.

Persistence.

Observability.

---

# Non-Goals

This project is **not** intended to become:

- a chatbot
- a wrapper around an LLM API
- an autonomous AGI experiment
- an unstructured prompt collection
- a monolithic AI application

Every addition should reinforce the system architecture rather than dilute it.

---

# Repository Philosophy

The repository should resemble a production software platform rather than an AI demo.

Avoid:

- giant utility files
- hidden globals
- implicit dependencies
- duplicated business logic
- prompt strings scattered throughout the codebase

Prefer:

- explicit services
- dependency injection
- typed interfaces
- modular architecture
- isolated responsibilities

---

# Architectural Principles

The architecture follows layered boundaries.

```
Presentation

↓

API

↓

Application

↓

Orchestration

↓

Agents

↓

Tools

↓

Infrastructure

↓

Persistence
```

Each layer depends only on the layer directly beneath it.

Cross-layer shortcuts are prohibited.

---

# AI Engineering Rules

AI coding assistants should behave as senior engineers working within an established software architecture.

They should never assume the repository is disposable.

They should never replace large sections of working code merely because an alternative implementation exists.

Instead they should:

- preserve architecture
- minimise unnecessary change
- extend existing systems
- improve readability
- improve maintainability
- preserve backwards compatibility whenever possible

When multiple valid implementations exist, choose the implementation that best aligns with the repository's established architectural patterns rather than the shortest implementation.

Large rewrites require explicit justification.

No AI agent should introduce architectural drift.

---

# Development Workflow

Every task follows the same lifecycle.

1. Understand the feature request.
2. Read all relevant existing code.
3. Identify architectural boundaries.
4. Design minimal changes.
5. Implement incrementally.
6. Add tests.
7. Validate behaviour.
8. Update documentation.
9. Run static analysis.
10. Verify production readiness.

Skipping any step should be considered an exception rather than the norm.

---

# Repository Structure

The repository should remain organised according to bounded contexts rather than technologies.

Example:

src/

    agents/
    orchestration/
    planning/
    execution/
    rag/
    mcp/
    infrastructure/
    persistence/
    frontend/
    shared/

Every directory should have a clearly defined responsibility.

No directory should become a miscellaneous dumping ground.

...
---

# Repository Structure

The repository is organised around **business capabilities**, not implementation technologies.

The goal is to ensure that each directory has a clear ownership boundary, well-defined responsibilities, and minimal coupling with adjacent modules.

A developer should be able to navigate to any directory and immediately understand:

- why it exists,
- what belongs there,
- what must never belong there.

---

## Recommended Repository Layout

```
/
├── src/
│
│   ├── agents/
│   │
│   ├── orchestration/
│   │
│   ├── planning/
│   │
│   ├── execution/
│   │
│   ├── mcp/
│   │
│   ├── rag/
│   │
│   ├── llm/
│   │
│   ├── prompts/
│   │
│   ├── reports/
│   │
│   ├── sessions/
│   │
│   ├── persistence/
│   │
│   ├── infrastructure/
│   │
│   ├── telemetry/
│   │
│   ├── shared/
│   │
│   └── api/
│
├── frontend/
│
├── docs/
│
├── tests/
│
├── scripts/
│
├── docker/
│
├── config/
│
├── examples/
│
└── CLAUDE.md
```

The exact structure may evolve, but the underlying architectural boundaries should remain stable.

---

# Directory Responsibilities

## agents/

Contains every autonomous agent implementation.

Each agent owns exactly one responsibility.

Agents should never communicate directly.

All communication occurs through the orchestrator.

Each agent should expose:

```
Agent

↓

Input Schema

↓

Execution

↓

Structured Output
```

An agent should never know:

- database implementation
- frontend state
- HTTP requests
- authentication
- storage details

Agents reason.

The platform executes.

---

## orchestration/

The orchestrator is the heart of the platform.

Its responsibilities include:

- planning execution
- coordinating agents
- dependency resolution
- state transitions
- retries
- scheduling
- streaming progress
- failure recovery

It must never contain:

- UI logic
- database queries
- prompt definitions
- business calculations

Its responsibility is coordination.

Nothing more.

---

## planning/

Responsible for decomposing work.

This module converts:

```
User Goal

↓

Execution Plan

↓

Dependency Graph

↓

Agent Tasks
```

Planning should be deterministic wherever possible.

The planner should generate:

- task graph
- dependencies
- execution order
- required tools
- expected outputs

Planning is separate from execution.

---

## execution/

Responsible for executing already-planned work.

Responsibilities include:

- invoking agents
- executing tools
- collecting outputs
- validating schemas
- retry policies
- timeout handling
- progress events

Execution should never decide:

"What should happen next?"

That is the planner's responsibility.

---

## llm/

Contains provider adapters.

Example:

```
GeminiProvider

ClaudeProvider

OpenAIProvider

AzureProvider

LocalProvider
```

Every provider implements the same interface.

The rest of the application should never care which provider is currently active.

Switching providers should require changing configuration rather than application logic.

---

## prompts/

All prompts belong here.

Never scatter prompt strings throughout the repository.

Each prompt should:

- have a name
- have a version
- have tests
- have documentation
- specify expected inputs
- specify expected outputs

Prompts are application assets.

Treat them like source code.

---

## rag/

Owns document retrieval.

Responsibilities:

- ingestion
- parsing
- chunking
- metadata
- embeddings
- retrieval
- reranking
- citations

Nothing outside this module should understand vector search implementation details.

---

## mcp/

Owns Model Context Protocol integration.

Contains:

- client manager
- transport implementations
- tool registry
- schema validation
- health monitoring
- capability discovery

The orchestrator requests tools.

Only the MCP layer understands how tools actually execute.

---

## persistence/

Owns permanent storage.

Responsibilities:

- repositories
- migrations
- transactions
- database models
- indexing

Business logic must never appear here.

---

## telemetry/

Responsible for observability.

Includes:

- logs
- metrics
- traces
- profiling
- audit events

Every production system eventually depends more upon telemetry than debugging.

Treat it as a first-class subsystem.

---

## shared/

Contains code shared by multiple modules.

Acceptable contents:

- utilities
- constants
- interfaces
- schemas
- validation
- common errors

Do not create a generic "helpers" directory containing unrelated code.

---

# Dependency Rules

Architectural dependencies are strictly one-directional.

```
Frontend

↓

API

↓

Application

↓

Orchestrator

↓

Agents

↓

MCP / RAG

↓

Infrastructure

↓

Persistence
```

Lower layers must never import higher layers.

Examples:

Allowed:

```
Planner

↓

Agent
```

Forbidden:

```
Agent

↓

Planner
```

Violating dependency direction introduces hidden coupling and should be considered an architectural defect.

---

# Module Boundaries

Every module should satisfy four questions.

## What problem does it solve?

One sentence.

If the answer requires a paragraph, the module probably owns too much.

---

## What public API does it expose?

Small.

Stable.

Typed.

---

## What data does it own?

Ownership must be explicit.

Never duplicate ownership.

---

## What does it depend upon?

Dependencies should be minimal.

Every additional dependency increases maintenance cost.

---

# Coding Philosophy

The repository prioritises:

1. Readability
2. Correctness
3. Maintainability
4. Observability
5. Performance

Notice that performance comes after correctness.

Optimise only when measurement demonstrates necessity.

Premature optimisation is discouraged.

---

# TypeScript Standards

TypeScript is treated as a design language rather than a transpiler.

Enable:

```
strict
```

Always.

No exceptions.

---

## Avoid `any`

Never introduce:

```
any
```

Prefer:

```
unknown
```

or

proper generic types.

If `any` becomes necessary, document precisely why.

---

## Interfaces vs Types

Use interfaces for public contracts.

Use types for transformations.

Example:

```
interface AgentRequest {}

interface AgentResponse {}

type ExecutionState =
    | Pending
    | Running
    | Failed
```

---

## Exhaustive Switching

Every switch statement should include exhaustive validation.

Unexpected states should fail loudly.

Silent failures are unacceptable.

---

## Async

Prefer async/await.

Avoid deeply nested promise chains.

Avoid callback-style APIs unless unavoidable.

---

# Naming Conventions

Names communicate architecture.

Poor names create accidental complexity.

Classes:

```
AgentPlanner

ToolRegistry

ExecutionScheduler
```

Interfaces:

```
ResearchAgent

ToolExecutor

EmbeddingProvider
```

Booleans:

```
isRunning

hasCompleted

canRetry
```

Collections:

```
agents

sessions

documents
```

Avoid abbreviations.

Avoid ambiguous nouns.

Avoid meaningless suffixes such as:

ManagerManager

Utils

Helpers

Misc

CommonStuff

---

# Documentation Standards

Every exported class should answer:

Why does this exist?

Every public method should answer:

What contract does it guarantee?

Every complex algorithm should explain:

Why this implementation was chosen.

Code explains *how*.

Documentation explains *why*.

Never duplicate implementation inside comments.

Comments should survive refactoring.

---

# Error Handling Philosophy

Errors are part of the system architecture.

They are not exceptional events.

Every error should be:

- structured
- typed
- actionable
- observable

Never swallow exceptions.

Never log and continue silently unless explicitly intended.

Errors should include sufficient context for post-mortem analysis without exposing secrets.

Examples of contextual fields include:

- request ID
- session ID
- agent ID
- tool name
- execution phase
- retry count

Logging and error reporting should make it possible to reconstruct the execution path of a failed request.

---

# Configuration Philosophy

Configuration belongs outside source code.

Every configurable value should have:

- a documented purpose
- a sensible default where appropriate
- validation at startup

Configuration sources should follow this precedence:

1. Environment variables
2. Configuration files
3. Built-in defaults

Secrets must never be committed to source control or embedded in prompts.

---

# Engineering Decision Framework

When multiple implementations are possible, evaluate them in this order:

1. Correctness
2. Simplicity
3. Maintainability
4. Testability
5. Observability
6. Performance
7. Novelty

Novel approaches should only be adopted when they demonstrably improve the preceding criteria.

The repository values predictable engineering over clever engineering.

---

# Quality Gates

No code should be merged unless it satisfies all of the following:

- Builds successfully
- Passes static type checking
- Passes linting
- Passes unit tests
- Passes integration tests relevant to the change
- Includes documentation updates where behaviour changed
- Does not introduce architectural boundary violations
- Maintains or improves observability
- Avoids unnecessary complexity

These gates apply equally to human contributors and AI coding agents.

---

*End of Part 2.*

**Next:** Part 3 will begin the **complete System Architecture**, including the end-to-end request lifecycle, orchestration engine, execution state machine, session model, event bus, streaming architecture, and the internal design of the multi-agent runtime.

---

# System Architecture

The architecture of Aether Orchestrator is intentionally layered, deterministic, and observable. Every subsystem has a clearly defined responsibility and communicates through well-defined interfaces rather than implicit assumptions.

The architecture is designed to optimise for:

- Reliability
- Explainability
- Extensibility
- Testability
- Replaceability
- Horizontal scalability

No component should assume knowledge about the internal implementation of another component beyond its public contract.

---

# High-Level System Diagram

```text
                          User Request
                               │
                               ▼
                    HTTP / API Gateway
                               │
                               ▼
                    Session Initialisation
                               │
                               ▼
                     Research Orchestrator
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
      Planner            Context Builder      Event Stream
          │                    │                    │
          └──────────────┬─────┴────────────────────┘
                         ▼
                  Execution Scheduler
                         │
          ┌──────────────┼───────────────┐
          ▼              ▼               ▼
     Agent Runtime   Tool Runtime   Verification
          │              │               │
          ▼              ▼               ▼
       MCP Layer    Vector Search    Validators
          │              │
          └──────────────┼──────────────┐
                         ▼
                     Report Builder
                         │
                         ▼
                    Session Storage
                         │
                         ▼
                       Response
```

Every box should be independently testable.

---

# Request Lifecycle

Every request follows exactly the same lifecycle.

```
Receive Request

↓

Validate

↓

Create Session

↓

Build Context

↓

Plan Tasks

↓

Create DAG

↓

Assign Agents

↓

Execute Tasks

↓

Run Verification

↓

Aggregate Results

↓

Generate Report

↓

Persist Session

↓

Return Response

↓

Archive Execution Metadata
```

No shortcuts should bypass this lifecycle unless explicitly documented.

---

# Session Model

Every execution is encapsulated inside a session.

A session represents one complete research task from creation until archival.

A session owns:

- Session ID
- User request
- Metadata
- Configuration
- Context
- Planning graph
- Execution state
- Intermediate outputs
- Tool history
- Verification results
- Final report
- Metrics
- Timing information
- Logs

Sessions should be immutable once completed.

If a user edits a request, create a new session derived from the previous one rather than mutating historical execution data.

---

# Session Lifecycle

```
Created

↓

Queued

↓

Planning

↓

Ready

↓

Executing

↓

Verifying

↓

Synthesising

↓

Completed
```

Failure states:

```
Planning Failed

Execution Failed

Tool Failed

Verification Failed

Cancelled

Expired
```

The state machine should never permit invalid transitions.

---

# Execution State Machine

Every task progresses independently through the following states.

```
Pending

↓

Assigned

↓

Waiting

↓

Running

↓

Succeeded
```

Failure path:

```
Running

↓

Retrying

↓

Failed
```

Retry count should be configurable.

Retries should only occur for transient failures.

Permanent failures should surface immediately.

---

# Planning Engine

The planner converts ambiguous user intent into deterministic execution.

Responsibilities:

- Analyse objectives
- Identify required capabilities
- Determine dependencies
- Select appropriate agents
- Estimate execution cost
- Construct execution graph

The planner never executes work.

Its only output is a plan.

---

# Planning Principles

Planning should minimise:

- duplicated work
- unnecessary tool usage
- repeated retrieval
- repeated embeddings
- repeated prompts

The planner should maximise:

- parallel execution
- cache reuse
- deterministic ordering
- context reuse

---

# Directed Acyclic Graph (DAG)

Every research session should be represented internally as a DAG.

Example:

```
          Research Question
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
 Literature             Documentation
 Search                 Retrieval
        │                    │
        └─────────┬──────────┘
                  ▼
          Technical Analysis
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
 Verification         Benchmarking
        │                   │
        └─────────┬─────────┘
                  ▼
             Report Generation
```

This allows independent branches to execute concurrently.

---

# Task Model

Every task should define:

```
Task ID

Task Type

Assigned Agent

Required Inputs

Dependencies

Expected Outputs

Required Tools

Timeout

Priority

Retry Policy

Validation Rules
```

Tasks should never contain arbitrary free-form metadata.

Everything important should be structured.

---

# Scheduler

The scheduler determines when work executes.

Responsibilities:

- dependency resolution
- concurrency control
- retry management
- timeout enforcement
- cancellation
- resource limits

The scheduler never decides *what* work should exist.

Only *when* it should execute.

---

# Concurrency Model

Independent tasks should execute concurrently whenever possible.

Example:

```
Search Documentation

Search GitHub

Search Web

Analyse PDFs
```

may execute simultaneously.

Dependent tasks should never execute early.

Correctness is more important than throughput.

---

# Agent Runtime

Every agent executes inside the same runtime abstraction.

Responsibilities:

- load system prompt
- receive task
- receive context
- receive tools
- generate reasoning
- invoke tools
- validate output
- return structured response

Agents should never:

- directly access databases
- directly access frontend state
- directly write files
- directly communicate with other agents

Everything flows through orchestration.

---

# Agent Contract

Every agent implements exactly the same interface.

Example:

```
AgentInput

↓

Execute()

↓

Structured Result
```

No special cases.

No hidden methods.

Uniform interfaces simplify orchestration.

---

# Agent Responsibilities

Agents own reasoning.

They do **not** own:

- scheduling
- retries
- persistence
- networking
- authentication
- telemetry

Keeping responsibilities narrow improves reliability.

---

# Agent Context

Every agent receives only the context required to perform its task.

Avoid passing entire conversations whenever possible.

Instead provide:

- task objective
- relevant retrieved documents
- previous outputs
- required constraints
- available tools

Smaller context windows improve consistency and reduce cost.

---

# Context Builder

The Context Builder prepares agent input.

Responsibilities:

- collect retrieved documents
- gather previous task outputs
- compress history
- remove irrelevant information
- order context
- attach citations

Context construction should be deterministic.

The same execution graph should produce the same context.

---

# Context Compression

When token budgets become constrained, remove information in this order:

1. duplicate passages
2. low-relevance retrieval
3. verbose logs
4. historical execution details
5. intermediate reasoning

Never remove:

- user objective
- constraints
- verified facts
- citations

---

# Event Bus

The entire application should communicate through events.

Example:

```
SessionCreated

TaskAssigned

TaskStarted

ToolInvoked

ToolCompleted

VerificationStarted

VerificationCompleted

ReportGenerated

SessionCompleted
```

The event bus enables:

- streaming
- logging
- monitoring
- analytics
- debugging

without introducing tight coupling.

---

# Event Design

Events should be immutable.

Each event should include:

```
timestamp

sessionId

eventType

payload

correlationId
```

Events should never depend upon application state.

They represent facts that have already occurred.

---

# Streaming Architecture

The UI should receive execution updates through Server-Sent Events (SSE).

Every meaningful execution stage should emit events.

Examples:

```
Planning Started

Task Assigned

Agent Thinking

Tool Invoked

Tool Completed

Verification Passed

Report Updated

Execution Complete
```

Streaming should never block execution.

---

# Progress Reporting

Users should always know:

- current stage
- completed tasks
- remaining tasks
- active agent
- running tools
- elapsed time
- estimated completion

Avoid generic progress indicators such as:

"Thinking..."

Instead provide meaningful execution telemetry.

---

# Report Generation Pipeline

Final reports are generated only after verification completes.

Pipeline:

```
Verified Outputs

↓

Merge

↓

Structure

↓

Generate Markdown

↓

Insert Citations

↓

Generate Diagrams

↓

Validate Formatting

↓

Persist

↓

Return
```

Report generation should never invent facts not present in verified outputs.

---

# Report Structure

Every generated report should follow a consistent hierarchy.

Typical sections include:

- Executive Summary
- Objectives
- Methodology
- Findings
- Technical Analysis
- Supporting Evidence
- Risks
- Limitations
- Recommendations
- References

Consistency improves readability and downstream automation.

---

# Failure Recovery

Failures are expected.

The system should degrade gracefully.

Recovery strategy:

1. Retry transient failures.
2. Retry alternative providers if configured.
3. Skip non-critical tasks when permitted.
4. Surface partial results with explicit warnings.
5. Never silently fabricate missing information.

Users should always understand:

- what succeeded
- what failed
- why it failed
- how the failure affected the final report

---

# Architectural Invariants

The following rules are non-negotiable.

- Agents never communicate directly.
- The planner never executes work.
- The executor never creates plans.
- Reports are built from verified outputs.
- Tool execution is isolated.
- State transitions are explicit.
- Every external interaction is logged.
- Every session is reproducible.
- Every architectural boundary is enforced through interfaces rather than convention.

Violation of these invariants should be treated as an architectural defect rather than an implementation detail.

---

*End of Part 3.*

**Next:** Part 4 will cover the complete **Multi-Agent Framework**, including agent taxonomy, specialised roles, prompt architecture, inter-agent contracts, memory management, orchestration heuristics, reasoning standards, verification pipelines, and production-grade AI behaviour specifications.

---

# Multi-Agent Framework

The multi-agent framework is the core intelligence layer of Aether Orchestrator.

Rather than relying on a single general-purpose model instance, the platform decomposes complex work into specialised reasoning domains executed by independent agents.

This separation provides:

- improved reliability,
- reduced hallucination rates,
- clearer accountability,
- parallel execution,
- better context management,
- easier debugging,
- stronger verification.

Agents are treated as **specialised workers**, not autonomous application owners.

The orchestrator remains the authority responsible for coordination, permissions, persistence, and execution control.

---

# Agent Taxonomy

Agents are grouped by capability class.

## Orchestration Agents

Responsible for planning and coordination.

- Lead Research Orchestrator
- Task Planner
- Dependency Analyzer

---

## Retrieval Agents

Responsible for gathering evidence.

- Document Retrieval Agent
- Web Grounding Agent
- Repository Intelligence Agent
- Specification Search Agent

---

## Analysis Agents

Responsible for technical reasoning.

- Compute Analysis Agent
- Architecture Analysis Agent
- Performance Analysis Agent
- Cost Modeling Agent
- Capacity Planning Agent

---

## Verification Agents

Responsible for challenging conclusions.

- Logic Verification Agent
- Consistency Checker
- Mathematical Verifier
- Citation Verifier

---

## Synthesis Agents

Responsible for assembling outputs.

- Report Generator
- Executive Summary Agent
- Diagram Generation Agent
- Recommendation Agent

---

# Agent Design Principles

Every agent must satisfy the following constraints.

## Single Responsibility

An agent should have one primary purpose.

Bad:

"Research and verify and generate reports."

Good:

"Verify technical consistency."

---

## Explicit Inputs

Agents should never rely on hidden conversational context.

All required information must be passed explicitly.

---

## Structured Outputs

Agents must return machine-readable structures before any human-facing formatting occurs.

---

## Tool Isolation

Agents may use only the tools explicitly granted for the task.

---

## Statelessness

Agents should not persist internal state between invocations.

Persistent memory belongs to the platform.

---

# Canonical Agent Roles

## Lead Research Orchestrator

### Responsibilities

- Understand user objectives
- Define research strategy
- Decompose work
- Assign specialist agents
- Resolve conflicts
- Approve synthesis

### Inputs

- User request
- Session metadata
- Available capabilities

### Outputs

- Execution plan
- Task graph
- Research strategy

### Allowed Tools

- Planning utilities only

The Lead Agent should not perform deep technical analysis itself.

---

## Document Retrieval Agent

### Responsibilities

- Query vector store
- Retrieve relevant chunks
- Rank relevance
- Extract citations

### Inputs

- Search query
- Retrieval constraints
- Document filters

### Outputs

- Ranked passages
- Citation metadata
- Confidence scores

### Allowed Tools

- `mcp_doc_search`
- Vector retrieval APIs

---

## Web Grounding Agent

### Responsibilities

- Retrieve recent public information
- Identify authoritative sources
- Extract supporting evidence

### Inputs

- Research query
- Recency constraints
- Domain preferences

### Outputs

- Source summaries
- URLs
- Publication metadata

### Allowed Tools

- `mcp_web_grounding`
- HTTP retrieval tools

---

## Compute Analysis Agent

### Responsibilities

- Calculate throughput
- Estimate bandwidth
- Model memory usage
- Analyse scaling limits

### Inputs

- Hardware specifications
- Workload parameters
- Topology constraints

### Outputs

- Numerical calculations
- Bottleneck analysis
- Capacity estimates

### Allowed Tools

- `mcp_spec_analyzer`
- Calculation utilities

This agent should prefer deterministic calculations over natural-language reasoning whenever possible.

---

## Logic Verification Agent

### Responsibilities

- Detect contradictions
- Challenge assumptions
- Identify unsupported claims
- Verify reasoning chains

### Inputs

- Intermediate findings
- Citations
- Calculations

### Outputs

- Verification report
- Risk flags
- Confidence assessment

### Allowed Tools

- `mcp_hypothesis_tester`
- Validation utilities

This agent acts as an internal red team.

---

## Report Generator Agent

### Responsibilities

- Assemble verified findings
- Structure markdown
- Insert citations
- Generate diagrams

### Inputs

- Verified outputs
- Report template
- Formatting rules

### Outputs

- Final report
- Executive summary
- Mermaid diagrams

### Allowed Tools

- Formatting utilities only

The Report Generator must never introduce new factual claims.

---

# Agent Capability Matrix

| Agent | Retrieval | Analysis | Verification | Synthesis |
|---|---|---|---|---|
| Lead Orchestrator | Limited | Strategic | Limited | Limited |
| Document Retrieval | High | Low | None | None |
| Web Grounding | High | Low | None | None |
| Compute Analysis | Medium | High | Medium | Low |
| Logic Verification | Medium | High | High | Low |
| Report Generator | None | None | Low | High |

This separation reduces role confusion.

---

# Prompt Architecture

Every agent prompt follows the same structure.

```text
Identity
Objective
Responsibilities
Constraints
Available Tools
Reasoning Standards
Output Format
Citation Rules
Failure Handling
```

Using a standard structure improves consistency across providers.

---

# Prompt Example Structure

```text
You are [Agent Name].

Objective:
[Primary goal]

Responsibilities:
- ...
- ...

Constraints:
- Do not invent data.
- Use tools when available.
- Cite all external evidence.

Available Tools:
- tool_a
- tool_b

Output Format:
Return JSON matching schema X.
```

Prompts should be versioned.

---

# Prompt Versioning

Store prompts as immutable assets.

Example:

```text
prompts/
  lead/
    v1.md
    v2.md
  verifier/
    v1.md
```

Never overwrite historical prompt versions without migration notes.

---

# Reasoning Standards

Agents should:

- separate facts from assumptions,
- identify uncertainty,
- prefer citations,
- explain calculations,
- avoid rhetorical language,
- avoid unsupported superlatives.

Bad:

"This is definitely the best architecture."

Good:

"Based on the cited benchmarks, this architecture demonstrates the highest throughput among the evaluated configurations."

---

# Confidence Levels

Agents should assign confidence when appropriate.

| Level | Meaning |
|---|---|
| High | Directly supported by authoritative evidence |
| Medium | Supported by multiple indicators |
| Low | Inferred or weakly supported |

Confidence should never be used to mask uncertainty.

---

# Inter-Agent Contracts

Agents communicate only through structured outputs.

Example:

```json
{
  "finding": "...",
  "evidence": ["..."],
  "confidence": "high",
  "citations": ["doc_123"]
}
```

Free-form conversational exchanges between agents are prohibited.

---

# Context Budgeting

Each agent receives only relevant context.

## Include

- Task objective
- Required constraints
- Relevant retrievals
- Dependency outputs

## Exclude

- Unrelated tasks
- Full session history
- Verbose logs
- Internal telemetry

Smaller contexts improve determinism.

---

# Memory Management

## Short-Term Memory

Exists only during the session.

Contains:

- task outputs
- retrievals
- execution state

## Long-Term Memory

Stored externally.

Contains:

- archived reports
- indexed documents
- reusable knowledge artifacts

Agents do not own memory.

The platform does.

---

# Parallel Reasoning

Independent specialist agents may execute concurrently.

Example:

```text
Document Retrieval
Web Grounding
Repository Analysis
Benchmark Search
```

Results are merged only after completion.

---

# Conflict Resolution

When agents disagree:

1. Prefer deterministic calculations.
2. Prefer authoritative citations.
3. Prefer recent validated data.
4. Escalate unresolved conflicts to the Lead Agent.
5. Surface disagreements explicitly in the final report.

Never silently discard conflicting evidence.

---

# Verification Pipeline

Every significant finding should pass through verification.

```text
Finding

↓

Consistency Check

↓

Citation Validation

↓

Calculation Validation

↓

Risk Assessment

↓

Approved Finding
```

Unverified findings should be marked clearly.

---

# Hallucination Prevention Rules

Agents must:

- use retrieval before generation,
- cite evidence,
- state uncertainty,
- avoid fabricated benchmarks,
- avoid fabricated URLs,
- avoid fabricated specifications,
- avoid fabricated tool outputs.

If evidence is unavailable, say so explicitly.

---

# Numerical Reasoning Rules

For calculations:

1. Show inputs.
2. Show formulas.
3. Show intermediate steps when non-trivial.
4. State assumptions.
5. State units.
6. Verify dimensional consistency.

---

# Tool Usage Policy

Agents should prefer tools over memory.

Example hierarchy:

1. Vector search
2. Database lookup
3. Web retrieval
4. Cached results
5. Model prior knowledge

---

# Failure Behaviour

If a tool fails:

1. Retry if transient.
2. Use alternative source if available.
3. Continue with reduced confidence if permitted.
4. Surface the limitation explicitly.

Never fabricate missing data.

---

# Agent Lifecycle

```text
Initialise

↓

Load Prompt

↓

Receive Context

↓

Reason

↓

Invoke Tools

↓

Integrate Results

↓

Validate Output

↓

Return Structured Response

↓

Terminate
```

Agents should not persist beyond task completion unless explicitly configured for streaming.

---

# Streaming Agent Behaviour

For long-running tasks, agents may emit incremental events:

```text
ReasoningStarted
ToolInvocationStarted
ToolInvocationCompleted
IntermediateFinding
ReasoningCompleted
```

These events are informational and should not alter execution state.

---

# Production Invariants

The following rules must always hold.

- Agents are stateless.
- Agents communicate through structured outputs.
- Agents cannot bypass the orchestrator.
- Agents cannot access unauthorised tools.
- Reports are generated from verified findings.
- Tool outputs are never fabricated.
- Conflicts are surfaced explicitly.
- Every external claim is attributable.

Violation of these rules should be treated as a production-severity defect.

---

*End of Part 4.*

**Next:** Part 5 will cover the complete **MCP Integration Architecture**, including client management, transport layers, server discovery, tool schemas, validation, retries, security boundaries, health monitoring, and production-grade tool execution standards.

---

# Part V — Model Context Protocol (MCP) Architecture

The Model Context Protocol (MCP) is the standardised capability layer through which Aether Orchestrator interacts with external systems.

The orchestrator itself **must never contain direct integrations** with arbitrary APIs, databases, file systems, browsers, or external services.

Instead, all external capabilities are exposed through MCP servers.

This architectural separation ensures:

- provider independence,
- consistent tooling,
- capability discovery,
- permission isolation,
- observability,
- security,
- portability.

MCP is treated as the operating system interface for AI agents.

---

# MCP Philosophy

Agents should never know:

- how a filesystem is implemented,
- how PostgreSQL is queried,
- how GitHub is accessed,
- how HTTP requests are performed,
- how browser automation works.

Agents understand only:

> "A tool exists."

The MCP layer owns implementation.

---

# Design Goals

The MCP layer should satisfy the following goals.

## Standardisation

Every tool behaves identically from the agent's perspective.

---

## Discoverability

Tools should be dynamically discoverable.

No prompt should require hardcoded tool documentation.

---

## Isolation

Every tool executes independently.

Failure of one tool must never corrupt another.

---

## Replaceability

Servers should be interchangeable.

Example:

Filesystem server

↓

S3 storage server

without changing agent prompts.

---

## Security

Every tool invocation must be:

- authenticated
- authorised
- validated
- logged

---

# MCP Layer

```
Agent

↓

Tool Request

↓

MCP Client Manager

↓

Transport

↓

MCP Server

↓

Tool

↓

Response

↓

Validation

↓

Agent
```

Only the MCP Client Manager understands transports.

---

# MCP Client Manager

The Client Manager owns:

- connection lifecycle
- discovery
- registration
- capability cache
- health monitoring
- retries
- reconnection
- transport abstraction

The remainder of the application communicates only with the manager.

---

# Responsibilities

The Client Manager should:

- connect servers
- disconnect servers
- monitor health
- list tools
- invoke tools
- validate schemas
- cache capabilities
- expose diagnostics

It should never contain business logic.

---

# Server Discovery

Servers should be discovered through configuration.

Example:

```json
{
  "mcpServers": {
    "filesystem": {},
    "postgres": {},
    "fetch": {},
    "github": {}
  }
}
```

Dynamic registration should also be supported for cloud deployments.

---

# Server Registration

Every server should register:

- unique identifier
- version
- transport
- capabilities
- health endpoint
- metadata

Example:

```
filesystem

version 1.2

supports:

listTools

callTool

health

shutdown
```

---

# Tool Registry

The registry maintains an in-memory catalogue.

Each tool contains:

```
Tool Name

Description

Input Schema

Output Schema

Version

Owning Server

Permissions

Timeout

Rate Limits
```

The registry should never contain execution logic.

---

# Tool Metadata

Every tool should expose metadata.

Example:

```
Name

Description

Examples

JSON Schema

Tags

Capabilities

Version

Experimental

Deprecated
```

Agents should use metadata for tool selection.

---

# Capability Discovery

Agents should never receive manually maintained tool descriptions.

Instead:

```
Server

↓

listTools()

↓

Registry

↓

Prompt Context
```

Capability discovery should occur automatically during startup.

---

# Transport Layer

The transport layer abstracts communication.

Supported transports include:

- stdio
- Server-Sent Events
- WebSocket
- HTTP
- IPC
- Unix sockets

The application should remain transport agnostic.

---

# Transport Interface

Every transport implements:

```
Connect()

Disconnect()

Request()

Cancel()

Heartbeat()
```

Uniform interfaces simplify testing.

---

# Connection Lifecycle

```
Disconnected

↓

Connecting

↓

Connected

↓

Healthy

↓

Unhealthy

↓

Reconnecting

↓

Connected
```

The lifecycle should be observable.

---

# Heartbeats

Servers should periodically emit health signals.

Example interval:

30 seconds.

Missing heartbeats should trigger diagnostics rather than immediate failure.

---

# Tool Invocation Pipeline

```
Agent

↓

Schema Validation

↓

Permission Check

↓

Timeout Configuration

↓

Invoke Tool

↓

Receive Result

↓

Validate Output

↓

Log Invocation

↓

Return Response
```

Every stage should be measurable.

---

# Tool Schema Validation

Input validation occurs before invocation.

Validation failures should never reach the server.

Output validation occurs after execution.

Malformed responses should be rejected immediately.

---

# JSON Schemas

Every tool must publish JSON Schema.

Avoid:

```
{
    "query": "string"
}
```

Prefer:

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query."
    }
  },
  "required": ["query"]
}
```

Schema quality directly influences LLM reliability.

---

# Permission Model

Permissions should be capability-based.

Examples:

```
filesystem.read

filesystem.write

database.query

browser.navigate

browser.download
```

Avoid broad permissions.

Principle of least privilege always applies.

---

# Tool Isolation

Tools execute inside isolated boundaries.

One tool should never:

- modify another tool's state
- access another tool's memory
- share global mutable data

Isolation simplifies debugging and security.

---

# Timeouts

Every tool invocation must define:

- timeout
- retry policy
- cancellation behaviour

Example:

Filesystem search

10 seconds.

Web search

30 seconds.

Database query

5 seconds.

---

# Cancellation

Long-running tools should support cancellation.

Example:

```
Tool Started

↓

User Cancels

↓

Cancellation Signal

↓

Cleanup

↓

Cancelled Response
```

Cancellation should release all allocated resources.

---

# Retry Strategy

Retry only transient failures.

Retry examples:

- network interruption
- connection reset
- temporary timeout

Do not retry:

- schema violations
- permission failures
- malformed responses
- authentication failures

---

# Health Monitoring

Each server should expose:

```
Healthy

Degraded

Unavailable
```

Metrics:

- uptime
- latency
- failures
- last heartbeat
- reconnect count

---

# Tool Logging

Every invocation should generate structured logs.

Example:

```
Timestamp

Session ID

Agent

Tool

Arguments

Duration

Status

Error

Server
```

Avoid logging sensitive payloads.

---

# Metrics

Collect:

- invocation count
- average latency
- P95 latency
- failures
- retries
- cancellations
- success rate

Metrics should feed dashboards.

---

# Error Handling

Errors should be classified.

Categories:

- Validation
- Authentication
- Authorization
- Timeout
- Transport
- Internal
- Dependency
- Unknown

Never return raw stack traces to agents.

---

# Server Versioning

Servers should publish semantic versions.

Example:

```
1.4.2
```

Breaking changes require major version increments.

The registry should support multiple versions simultaneously during migrations.

---

# Tool Deprecation

Deprecated tools should include:

- replacement
- deprecation version
- removal version
- migration guidance

Never remove production tools without notice.

---

# Security Boundaries

Servers should execute with minimal privileges.

Filesystem server:

Read only by default.

Database server:

Read only unless explicitly configured.

Browser server:

Restricted downloads.

Shell execution:

Disabled unless absolutely required.

---

# Sensitive Operations

Operations affecting:

- filesystem writes
- database mutations
- shell execution
- infrastructure changes

should require explicit approval policies.

---

# Audit Trail

Every invocation should be auditable.

Minimum fields:

- who requested it
- when
- why
- parameters
- outcome
- duration

Audit logs should be immutable.

---

# Production Requirements

A production-ready MCP deployment must support:

- automatic reconnection
- schema validation
- structured logging
- metrics
- tracing
- authentication
- authorisation
- health monitoring
- graceful shutdown

---

# Creating New Tools

Every new tool should satisfy the following checklist.

✓ Single responsibility

✓ Well-defined schema

✓ Clear description

✓ Deterministic behaviour

✓ Structured output

✓ Documentation

✓ Unit tests

✓ Integration tests

✓ Security review

✓ Performance benchmark

---

# Tool Design Guidelines

Good tool:

```
search_documents(query)
```

Bad tool:

```
research_everything_about_topic()
```

Large tools reduce reasoning quality.

Small composable tools improve planning.

---

# MCP Testing Strategy

Every server should include:

Unit Tests

↓

Schema Tests

↓

Transport Tests

↓

Integration Tests

↓

Load Tests

↓

Failure Simulation

↓

Recovery Tests

Testing only happy paths is insufficient.

---

# Architectural Invariants

The following rules must never be violated.

- Agents never communicate directly with external systems.
- Every capability is exposed through MCP.
- Every tool publishes schemas.
- Every invocation is logged.
- Every response is validated.
- Every server is independently deployable.
- Every transport is replaceable.
- Tool failures never crash orchestration.
- The orchestrator never depends on server implementation details.

These invariants form the contractual foundation of the MCP subsystem.

---

*End of Part 5.*

**Next:** Part 6 will cover the complete **LLM Architecture & Prompt Engineering Framework**, including provider abstraction, context engineering, memory systems, hallucination prevention, reasoning standards, prompt lifecycle management, structured outputs, model selection strategies, and production-grade AI orchestration.

---

# Part VI — LLM Architecture & Prompt Engineering Framework

Language Models are reasoning engines—not application frameworks.

Aether Orchestrator is designed such that **all application logic remains deterministic software**, while LLMs provide semantic reasoning, synthesis, decomposition, and interpretation.

This distinction is fundamental.

The application owns execution.

The LLM owns reasoning.

---

# Design Philosophy

The platform treats every model as an interchangeable implementation behind a stable interface.

No business logic should depend on:

- Claude
- GPT
- Gemini
- DeepSeek
- Llama
- Mistral
- Qwen

Instead, the application depends upon a common abstraction.

```
Application

↓

LLM Provider Interface

↓

Claude

GPT

Gemini

Llama

Mistral

...
```

Replacing providers should require configuration changes rather than architectural changes.

---

# Core Responsibilities

The LLM layer is responsible for:

- reasoning
- planning assistance
- summarisation
- extraction
- synthesis
- natural language generation
- semantic interpretation

It is **not** responsible for:

- application state
- authentication
- permissions
- scheduling
- retries
- networking
- persistence
- business rules

---

# Provider Abstraction

Every provider must implement the same interface.

Example:

```typescript
interface LLMProvider {

    generate()

    stream()

    embed()

    tokenize()

    countTokens()

    health()

}
```

No provider-specific methods should leak beyond this boundary.

---

# Provider Capabilities

Providers may differ in:

- context window
- latency
- pricing
- reasoning quality
- multimodal support
- tool calling
- structured outputs

These capabilities should be described through metadata rather than conditional logic.

Example:

```json
{
    "provider": "Claude",

    "supportsVision": true,

    "supportsStreaming": true,

    "maxContext": 200000
}
```

---

# Model Registry

The system should maintain a registry of available models.

Example:

```
claude-opus

claude-sonnet

gpt-5

gpt-5-mini

gemini-2.5-pro

llama-4

deepseek-r1
```

Each model should advertise:

- latency
- cost
- reasoning score
- context limit
- multimodal capabilities
- tool support

---

# Model Selection Strategy

Model selection should be policy-driven.

Example:

| Task | Recommended Capability |
|-------|------------------------|
| Planning | High reasoning |
| Summarisation | Fast generation |
| Verification | High reasoning |
| Retrieval synthesis | Large context |
| Code generation | High reasoning |
| Diagram generation | Medium reasoning |

Never hardcode a specific model into application logic.

---

# Prompt Philosophy

Prompts are executable specifications.

Treat them as production code.

They require:

- reviews
- versioning
- documentation
- testing
- changelogs

Prompt engineering should be systematic rather than experimental.

---

# Prompt Lifecycle

Every prompt progresses through the following lifecycle.

```
Draft

↓

Review

↓

Test

↓

Benchmark

↓

Approve

↓

Deploy

↓

Monitor

↓

Improve
```

Prompt changes should follow the same engineering discipline as source code.

---

# Prompt Repository

Prompts should live in a dedicated directory.

```
prompts/

planner/

verifier/

research/

summariser/

report/

shared/
```

Each prompt should have:

```
system.md

examples.md

tests.md

CHANGELOG.md
```

---

# Prompt Structure

Every system prompt follows the same template.

```
Identity

Mission

Responsibilities

Constraints

Available Tools

Operating Principles

Reasoning Guidelines

Output Schema

Failure Behaviour

Examples
```

Consistency improves model behaviour across providers.

---

# Identity Section

Clearly define the role.

Example:

```
You are the Verification Agent responsible for validating technical correctness.

You do not generate new information.

You only verify existing findings.
```

Avoid vague identities such as:

```
You are an AI assistant.
```

---

# Mission Section

The mission should describe success criteria.

Example:

```
Determine whether the supplied conclusions are technically correct using the available evidence.
```

Mission statements should be measurable.

---

# Constraints

Explicitly define prohibited behaviour.

Examples:

- Never fabricate citations.
- Never invent measurements.
- Never ignore conflicting evidence.
- Never bypass available tools.
- Never produce malformed JSON.

Constraints should be stated positively and negatively where appropriate.

---

# Tool Documentation

Every prompt should include concise tool documentation.

Avoid describing implementation details.

Instead explain:

- when to use the tool,
- expected inputs,
- expected outputs,
- limitations.

---

# Output Contracts

Every prompt should define a strict output schema.

Prefer JSON over free-form text.

Example:

```json
{
    "summary": "...",
    "confidence": "...",
    "citations": []
}
```

Structured outputs reduce downstream parsing complexity.

---

# Structured Output Validation

Every generated structure must be validated before use.

Validation failures should trigger:

1. repair attempt,
2. regeneration,
3. escalation.

Never silently accept malformed responses.

---

# Prompt Testing

Prompts should be unit tested.

Example scenarios:

- insufficient evidence
- conflicting evidence
- malformed tool outputs
- ambiguous questions
- adversarial inputs
- empty retrievals

Regression testing should ensure behaviour remains stable across revisions.

---

# Prompt Versioning

Never modify prompts in-place without preserving history.

Example:

```
planner/

v1/

v2/

v3/
```

Each version should include migration notes describing behavioural changes.

---

# Few-Shot Examples

Examples should illustrate:

- expected reasoning style,
- correct output structure,
- tool usage patterns,
- handling of uncertainty.

Avoid overfitting prompts to narrow examples.

---

# Context Engineering

Context engineering is the process of selecting, ordering, and compressing information before it reaches the model.

Good context engineering is often more valuable than prompt engineering.

Objectives:

- maximise relevance,
- minimise redundancy,
- preserve critical constraints,
- stay within token budgets.

---

# Context Hierarchy

Context should be ordered by importance.

1. System instructions
2. Task objective
3. User constraints
4. Verified findings
5. Retrieved evidence
6. Previous agent outputs
7. Historical context
8. Auxiliary metadata

Higher-priority information should appear earlier in the context window.

---

# Context Assembly Pipeline

```
User Request

↓

Planner

↓

Retrieval

↓

Compression

↓

Deduplication

↓

Ordering

↓

Prompt Assembly

↓

LLM
```

Each stage should be deterministic.

---

# Token Budgeting

Every request should allocate tokens intentionally.

Example policy:

- 10% system instructions
- 10% task definition
- 20% constraints
- 45% retrieved evidence
- 10% prior outputs
- 5% response headroom

Exact allocations may vary by workload but should be measurable and configurable.

---

# Context Compression

When token limits are reached:

1. remove duplicates,
2. remove low-relevance passages,
3. compress historical outputs,
4. summarise verbose logs.

Never compress:

- user requirements,
- system instructions,
- verified facts,
- citations.

---

# Memory Architecture

Memory is external to the language model.

The platform provides memory through explicit context.

Memory types include:

## Working Memory

Current execution state.

## Session Memory

Conversation history relevant to the active session.

## Project Memory

Persistent artefacts such as reports, documents, and indexed knowledge.

## Long-Term Memory

Cross-session organisational knowledge, subject to governance and access controls.

Agents should never assume implicit memory.

---

# Retrieval-Augmented Generation (RAG)

Models should prefer retrieved evidence over prior knowledge.

The retrieval hierarchy is:

1. verified internal documents,
2. trusted external sources,
3. cached retrievals,
4. model prior knowledge.

When retrieval contradicts prior knowledge, the contradiction should be surfaced rather than ignored.

---

# Hallucination Prevention

The platform should minimise hallucinations through architecture rather than prompt wording alone.

Strategies include:

- retrieval-first workflows,
- structured tool use,
- mandatory citations,
- verification agents,
- deterministic calculations,
- schema validation,
- confidence scoring.

If evidence is unavailable, the correct behaviour is to state that the information is unavailable.

---

# Confidence Assessment

Confidence should reflect evidence quality, not model certainty.

Factors include:

- source authority,
- corroboration,
- recency,
- completeness,
- consistency.

Confidence should never be inferred solely from fluent language.

---

# Reasoning Transparency

Where appropriate, the system should preserve high-level reasoning artefacts such as:

- assumptions,
- evidence used,
- rejected alternatives,
- validation outcomes.

Do **not** expose raw chain-of-thought or internal reasoning traces.

Instead provide concise, user-facing explanations of the factors that led to a conclusion.

---

# Cost Optimisation

Model selection should balance:

- quality,
- latency,
- cost.

Examples:

- small models for classification,
- medium models for summarisation,
- large reasoning models for planning and verification.

Escalate to more capable models only when task complexity justifies the additional cost.

---

# Streaming

Models supporting streaming should emit incremental output where beneficial.

Streaming should include:

- partial text,
- progress events,
- tool invocation notifications,
- completion signals.

Streaming must not compromise output validity or schema compliance.

---

# Resilience

If an LLM request fails:

1. retry transient failures,
2. switch providers if policy permits,
3. degrade gracefully,
4. preserve execution state,
5. record diagnostics.

The orchestrator—not the model—owns recovery.

---

# Observability

Record metrics such as:

- prompt version,
- provider,
- model,
- latency,
- token usage,
- cost,
- retries,
- success rate,
- validation failures.

These metrics should support optimisation and capacity planning.

---

# Architectural Invariants

The following rules must always hold.

- Models are replaceable.
- Prompts are versioned.
- Outputs are structured.
- Context is explicit.
- Memory is external.
- Retrieval precedes generation where evidence is required.
- Hallucinations are mitigated through system design.
- Raw chain-of-thought is never requested, stored, or exposed.
- The orchestrator remains the authoritative controller of execution.

These invariants define the contractual boundary between the application and the language model layer.

---

*End of Part 6.*

**Next:** Part 7 will cover the complete **Retrieval-Augmented Generation (RAG) Architecture**, including ingestion pipelines, document parsing, chunking strategies, embedding generation, vector indexing, hybrid retrieval, reranking, citation management, freshness policies, and knowledge lifecycle management.

---

# Part VII — Retrieval-Augmented Generation (RAG) Architecture

Retrieval-Augmented Generation (RAG) is the authoritative knowledge subsystem of Aether Orchestrator.

The primary objective of RAG is to ensure that language models reason over **grounded, attributable evidence** rather than relying solely on parametric memory.

Within this architecture, retrieval is not an optional enhancement—it is the default mechanism for acquiring factual information.

Generation should occur only after relevant evidence has been retrieved, validated, and assembled.

---

# Design Principles

The RAG subsystem is designed around six core principles.

## Ground Truth

Retrieved evidence always takes precedence over model prior knowledge.

---

## Deterministic Retrieval

The same query should produce substantially similar retrieval results under identical conditions.

---

## Source Attribution

Every retrieved passage must maintain provenance.

The system should always know:

- where the passage originated,
- when it was indexed,
- how it was retrieved,
- why it was selected.

---

## Modular Pipeline

Each stage of ingestion and retrieval should be independently replaceable.

---

## Hybrid Intelligence

The system should combine:

- lexical search,
- semantic search,
- metadata filtering,
- reranking,
- deterministic ranking heuristics.

---

## Continuous Evolution

Knowledge is expected to change.

The RAG system should support:

- re-indexing,
- incremental updates,
- versioned documents,
- freshness policies.

---

# High-Level Architecture

```text
            Documents
                │
                ▼
          Document Parser
                │
                ▼
        Content Normalisation
                │
                ▼
          Chunk Generation
                │
                ▼
        Metadata Enrichment
                │
                ▼
      Embedding Generation
                │
                ▼
          Vector Database
                │
                ▼
         Hybrid Retrieval
                │
                ▼
            Reranking
                │
                ▼
        Context Construction
                │
                ▼
             LLM Input
```

Each stage owns exactly one responsibility.

---

# Knowledge Lifecycle

Every document follows the same lifecycle.

```
Discovered

↓

Imported

↓

Parsed

↓

Normalised

↓

Chunked

↓

Embedded

↓

Indexed

↓

Retrieved

↓

Referenced

↓

Archived

↓

Deleted
```

Knowledge should never bypass this lifecycle.

---

# Supported Knowledge Sources

The system should support heterogeneous sources through a common ingestion interface.

Examples include:

- Markdown
- PDF
- HTML
- DOCX
- Plain text
- Source code repositories
- GitHub repositories
- Confluence
- Notion
- SharePoint
- Wikis
- Technical specifications
- API documentation
- Internal reports

Each connector should produce a canonical document representation.

---

# Document Model

Every document should include:

```text
Document ID

Source

Author

Owner

Created

Modified

Version

Language

Tags

Classification

Checksum

Content

Metadata
```

Documents should be immutable after indexing.

Changes create new document versions.

---

# Document Parsing

Parsing converts raw files into structured content.

Responsibilities include:

- extracting text,
- preserving hierarchy,
- identifying tables,
- extracting images,
- recognising code blocks,
- detecting headings,
- preserving lists.

Parsing should maximise semantic fidelity while removing irrelevant formatting artefacts.

---

# Content Normalisation

Before chunking, content should be normalised.

Examples include:

- Unicode normalisation,
- whitespace cleanup,
- heading canonicalisation,
- removal of duplicate boilerplate,
- consistent list formatting,
- code block preservation.

Normalisation should never alter semantic meaning.

---

# Chunking Philosophy

Chunking is one of the most important design decisions in a RAG system.

Poor chunking leads to poor retrieval.

The objective is to produce semantically coherent chunks that preserve enough context for accurate reasoning while remaining compact enough for efficient indexing and retrieval.

---

# Chunking Strategies

The platform should support multiple strategies.

## Fixed-Length Chunking

Simple and efficient.

Suitable for:

- plain text,
- logs,
- transcripts.

---

## Semantic Chunking

Uses document structure.

Suitable for:

- specifications,
- technical documentation,
- design documents.

---

## Hierarchical Chunking

Preserves parent-child relationships.

Suitable for:

- books,
- standards,
- architecture documentation.

---

## Code-Aware Chunking

Splits by logical program structure.

Examples:

- class,
- interface,
- function,
- module,
- package.

---

# Chunk Size

Chunk size should balance retrieval precision and contextual completeness.

General guidance:

- Avoid extremely small fragments that lose context.
- Avoid excessively large chunks that dilute relevance.

Chunk sizing should be configurable and empirically validated for each document domain.

---

# Chunk Overlap

Neighbouring chunks may include controlled overlap to preserve continuity across boundaries.

Overlap should be sufficient to avoid information loss while minimising duplication.

Overlap strategy should be configurable.

---

# Metadata Enrichment

Each chunk should be enriched with metadata.

Recommended fields include:

```text
Document ID

Chunk ID

Section

Heading Path

Page Number

Language

Version

Author

Created

Modified

Source URI

Classification

Tags

Token Count

Checksum
```

Metadata should support filtering, ranking, and auditing.

---

# Embedding Generation

Embeddings convert chunks into high-dimensional vector representations suitable for semantic retrieval.

Embedding providers should be abstracted behind a common interface.

Responsibilities include:

- batching,
- caching,
- retry handling,
- model selection,
- version tracking.

---

# Embedding Versioning

Embeddings should record:

- embedding model,
- model version,
- generation timestamp,
- dimensionality,
- preprocessing pipeline version.

Changing embedding models should trigger controlled re-indexing.

---

# Vector Store

The vector database stores embeddings and associated metadata.

Required capabilities include:

- nearest-neighbour search,
- metadata filtering,
- namespace isolation,
- incremental updates,
- deletion,
- version management.

The application should remain independent of any specific vector database implementation.

---

# Hybrid Retrieval

Semantic retrieval should be combined with traditional information retrieval techniques.

Recommended retrieval pipeline:

```text
Lexical Search

+

Vector Search

↓

Merge Candidates

↓

Metadata Filtering

↓

Reranking

↓

Top Results
```

Hybrid retrieval consistently outperforms either technique alone across diverse document types.

---

# Metadata Filtering

Metadata filters improve precision.

Examples include:

- document type,
- repository,
- language,
- project,
- owner,
- creation date,
- version,
- security classification.

Filtering should occur before expensive reranking operations where possible.

---

# Query Understanding

Before retrieval, user queries may be enriched through deterministic preprocessing.

Examples:

- spelling correction,
- acronym expansion,
- synonym mapping,
- query decomposition,
- entity extraction.

These transformations should preserve user intent.

---

# Retrieval Pipeline

```
User Query

↓

Normalise

↓

Expand

↓

Hybrid Search

↓

Filter

↓

Deduplicate

↓

Rerank

↓

Context Assembly
```

Each stage should emit metrics for observability.

---

# Deduplication

Retrieved passages frequently overlap.

The system should remove redundant results while preserving distinct evidence.

Deduplication should operate on semantic similarity rather than exact string equality alone.

---

# Reranking

Initial retrieval prioritises recall.

Reranking optimises precision.

Rerankers may consider:

- semantic similarity,
- keyword overlap,
- document authority,
- recency,
- citation frequency,
- structural importance.

Reranking should be deterministic where possible.

---

# Context Assembly

Selected passages are assembled into model-ready context.

Responsibilities include:

- ordering,
- deduplication,
- citation insertion,
- token budgeting,
- relevance grouping.

Context should be organised logically rather than by retrieval order alone.

---

# Citation Management

Every retrieved passage should retain provenance.

Minimum citation fields:

```text
Document ID

Chunk ID

Title

Source URI

Section

Version
```

Generated reports should reference these identifiers rather than embedding opaque internal IDs.

---

# Freshness Policy

Knowledge becomes stale over time.

The platform should support configurable freshness rules.

Examples:

- always retrieve latest version,
- prefer stable releases,
- exclude archived documents,
- prioritise recently updated specifications.

Freshness policies should be explicit and auditable.

---

# Incremental Indexing

Large repositories should support incremental updates.

When a document changes:

1. detect modification,
2. reparse affected sections,
3. regenerate changed embeddings,
4. update affected index entries,
5. preserve historical versions if required.

Avoid full re-indexing whenever incremental updates are sufficient.

---

# Knowledge Governance

Knowledge assets should be classified.

Example classifications:

- Public
- Internal
- Confidential
- Restricted

Retrieval policies must respect document classification and user permissions.

---

# Cache Strategy

Multiple cache layers improve performance.

Recommended caches include:

- parsed documents,
- embeddings,
- retrieval results,
- reranking results,
- context assemblies.

Cache invalidation should be driven by document version changes.

---

# Evaluation Framework

The RAG system should be evaluated continuously.

Key metrics include:

- Recall@K
- Precision@K
- Mean Reciprocal Rank (MRR)
- Normalised Discounted Cumulative Gain (NDCG)
- Retrieval latency
- Context relevance
- Citation accuracy

Offline evaluation datasets should be maintained for regression testing.

---

# Failure Handling

If retrieval fails:

1. retry transient infrastructure failures,
2. fall back to lexical search where appropriate,
3. surface reduced confidence,
4. continue only if policy permits.

Never silently substitute unsupported model knowledge for missing retrieved evidence.

---

# Security Considerations

The RAG subsystem must enforce:

- access control,
- tenant isolation,
- document classification,
- audit logging,
- secure deletion,
- encryption at rest,
- encryption in transit.

Retrieved context should never include documents beyond the requester's permissions.

---

# Observability

Record metrics including:

- ingestion throughput,
- indexing latency,
- retrieval latency,
- reranking latency,
- cache hit rate,
- embedding generation time,
- context assembly duration,
- citation coverage.

These metrics should support capacity planning and quality improvement.

---

# Architectural Invariants

The following rules are fundamental.

- Retrieval precedes evidence-based generation.
- Documents remain attributable throughout the pipeline.
- Chunk metadata is preserved.
- Embeddings are versioned.
- Hybrid retrieval is preferred.
- Reranking is explicit.
- Context assembly is deterministic.
- Citations are mandatory for retrieved evidence.
- Knowledge lifecycle events are auditable.
- Security boundaries are enforced during retrieval.

Violation of these invariants should be treated as an architectural defect rather than an implementation detail.

---

*End of Part 7.*

**Next:** Part 8 will cover the **Backend Architecture**, including API design, service layer, repositories, dependency injection, configuration management, authentication, authorisation, error handling, logging, telemetry, persistence, and production deployment standards.

---

# Part VIII — Backend Architecture

The backend is the deterministic execution engine of Aether Orchestrator.

Its primary purpose is to transform user requests into orchestrated execution while maintaining strict guarantees around correctness, security, observability, and reproducibility.

Unlike conventional CRUD applications, the backend coordinates multiple intelligent subsystems rather than simply exposing database operations.

Its responsibilities include:

- request validation,
- session management,
- orchestration,
- agent execution,
- tool coordination,
- persistence,
- telemetry,
- streaming,
- security,
- lifecycle management.

The backend should remain entirely independent of any specific LLM provider.

---

# Backend Design Principles

The backend should optimise for:

- determinism,
- composability,
- modularity,
- observability,
- resilience,
- horizontal scalability,
- testability.

Business rules should always be implemented as deterministic application code.

Language models provide reasoning—not application behaviour.

---

# Architectural Layers

```
Presentation

↓

API

↓

Application

↓

Domain

↓

Infrastructure

↓

Persistence
```

Each layer communicates only with the layer directly below it.

Higher layers should never bypass lower layers.

---

# Layer Responsibilities

## Presentation Layer

Owns:

- HTTP
- WebSockets
- Server-Sent Events
- request parsing
- response formatting

Should contain no business logic.

---

## API Layer

Responsible for:

- routing,
- authentication,
- authorisation,
- validation,
- rate limiting,
- serialization.

Controllers should remain extremely thin.

---

## Application Layer

Owns orchestration of business use cases.

Responsibilities include:

- coordinating services,
- enforcing workflows,
- invoking domain logic,
- transaction boundaries.

Application services should not contain infrastructure code.

---

## Domain Layer

Contains the business model.

Responsibilities:

- entities,
- value objects,
- domain services,
- policies,
- business invariants.

The domain should be completely independent of frameworks.

---

## Infrastructure Layer

Owns:

- LLM providers,
- MCP clients,
- vector databases,
- logging,
- telemetry,
- storage,
- messaging,
- configuration.

Infrastructure implements interfaces defined by higher layers.

---

## Persistence Layer

Owns:

- repositories,
- migrations,
- transactions,
- database models,
- indexing.

Persistence should not contain business rules.

---

# Request Processing Pipeline

Every request follows the same deterministic path.

```text
Receive Request

↓

Authenticate

↓

Authorise

↓

Validate

↓

Create Session

↓

Execute Use Case

↓

Persist Changes

↓

Emit Events

↓

Return Response
```

This pipeline should be observable end-to-end.

---

# API Design

The API should expose stable, versioned contracts.

Example:

```
/api/v1/

research

sessions

reports

documents

agents

health

metrics
```

Versioning should occur at the API boundary rather than within controller implementations.

---

# REST Principles

REST endpoints should represent resources rather than actions.

Good:

```
POST /research

GET /sessions/{id}

GET /reports/{id}
```

Avoid:

```
POST /runResearchNowImmediately
```

Long-running operations should return asynchronous session identifiers.

---

# Streaming Endpoints

Streaming interfaces should use Server-Sent Events (SSE) unless bidirectional communication is required.

Recommended stream events include:

- session.created
- planning.started
- task.started
- tool.invoked
- tool.completed
- verification.completed
- report.generated
- session.completed
- session.failed

Each event should be idempotent and self-describing.

---

# Controller Design

Controllers should perform only:

- input validation,
- authentication,
- response formatting,
- delegation.

Controllers must not:

- invoke databases directly,
- construct prompts,
- call LLM providers,
- execute orchestration logic.

Controllers should be measured in tens of lines—not hundreds.

---

# Application Services

Application services coordinate workflows.

Example responsibilities:

- start research,
- resume sessions,
- cancel execution,
- generate reports,
- import documents.

Services orchestrate work but do not implement infrastructure concerns.

---

# Domain Services

Domain services encapsulate business behaviour that does not naturally belong to a single entity.

Examples:

- execution policy,
- planning strategy,
- citation validation,
- confidence calculation.

Domain services should remain deterministic.

---

# Entities

Entities possess identity and lifecycle.

Examples:

```
Session

Task

Document

Agent

Report

ExecutionPlan
```

Entities should enforce their own invariants.

Invalid states should be impossible to construct.

---

# Value Objects

Value objects represent immutable concepts.

Examples:

```
SessionId

TokenBudget

ConfidenceScore

EmbeddingVector

Citation

ExecutionState
```

Value objects should be immutable and comparable by value.

---

# Repository Pattern

Repositories abstract persistence.

Example interface:

```typescript
interface SessionRepository {

    findById()

    save()

    update()

    delete()

}
```

Business logic should never appear inside repository implementations.

---

# Dependency Injection

All infrastructure dependencies should be injected.

Avoid:

```typescript
const client = new OpenAI(...)
```

Prefer:

```typescript
constructor(
    private readonly llmProvider: LLMProvider
)
```

Dependency injection improves testing and replaceability.

---

# Configuration Management

Configuration should be centralised.

Sources:

1. environment variables,
2. configuration files,
3. secrets manager,
4. runtime overrides.

Configuration should be validated during application startup.

Startup should fail fast if required configuration is missing.

---

# Authentication

Authentication verifies identity.

Supported mechanisms may include:

- OAuth 2.0,
- OpenID Connect,
- API keys,
- JWT,
- enterprise SSO.

Authentication should be handled before entering application logic.

---

# Authorisation

Authorisation determines permitted actions.

Policies should consider:

- user identity,
- organisation,
- tenant,
- document classification,
- tool permissions,
- session ownership.

Permission checks should occur close to the protected resource.

---

# Multi-Tenancy

Where multi-tenancy is required:

- tenant data must be isolated,
- identifiers must include tenant context,
- caches must be tenant-aware,
- retrieval must enforce tenant boundaries.

Cross-tenant data leakage is a critical security defect.

---

# Idempotency

Operations should be idempotent where appropriate.

Examples:

- session creation with idempotency keys,
- document ingestion,
- retryable API calls.

Idempotency prevents duplicate work during retries.

---

# Transactions

Transactional boundaries should be explicit.

Use transactions when multiple operations must succeed or fail together.

Avoid long-running database transactions during LLM or tool execution.

Persist intermediate state before external calls where appropriate.

---

# Error Handling

Errors should be represented as structured types.

Example categories:

- ValidationError
- AuthenticationError
- AuthorizationError
- ResourceNotFoundError
- ConflictError
- DependencyError
- TimeoutError
- InternalError

Internal implementation details should never be exposed to clients.

---

# Error Responses

API errors should include:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "The request is invalid.",
  "requestId": "...",
  "details": []
}
```

Responses should be stable across versions.

---

# Logging

Logging should be structured.

Required fields:

- timestamp,
- request ID,
- session ID,
- user ID (where applicable),
- agent ID,
- task ID,
- correlation ID,
- severity,
- message.

Logs should be machine-readable.

---

# Correlation IDs

Every request should receive a unique correlation identifier.

The identifier should propagate through:

- HTTP requests,
- orchestration,
- MCP calls,
- LLM providers,
- persistence,
- telemetry.

Correlation enables distributed tracing.

---

# Metrics

Collect metrics including:

- request count,
- request latency,
- session duration,
- active sessions,
- tool invocations,
- token consumption,
- LLM cost,
- cache hit rate,
- retry count,
- failure rate.

Metrics should be suitable for Prometheus-compatible monitoring systems.

---

# Distributed Tracing

Trace spans should include:

- API request,
- planner,
- scheduler,
- agent execution,
- MCP invocation,
- retrieval,
- report generation.

Tracing enables diagnosis of latency bottlenecks.

---

# Background Processing

Long-running operations should execute asynchronously.

Suitable workloads include:

- embedding generation,
- document ingestion,
- report generation,
- re-indexing,
- scheduled maintenance.

Background workers should be horizontally scalable.

---

# Caching

Recommended cache layers:

- configuration,
- prompt templates,
- embeddings,
- retrieval results,
- model metadata,
- session snapshots.

Cache invalidation should be explicit and observable.

---

# Rate Limiting

Protect external dependencies through configurable rate limits.

Limits may apply per:

- user,
- tenant,
- API key,
- organisation,
- provider.

Rate limiting policies should be transparent and documented.

---

# Health Checks

Expose health endpoints for:

- application,
- database,
- vector store,
- MCP servers,
- LLM providers,
- cache,
- message queue.

Health checks should distinguish between:

- healthy,
- degraded,
- unavailable.

---

# Graceful Shutdown

Shutdown sequence:

```text
Stop accepting requests

↓

Drain active sessions

↓

Finish in-flight work where possible

↓

Flush telemetry

↓

Close external connections

↓

Terminate
```

Graceful shutdown prevents partial execution and data loss.

---

# Scalability

The backend should scale horizontally.

Stateless application instances are preferred.

Shared state should reside in external systems such as:

- databases,
- caches,
- object storage,
- message queues.

Avoid in-memory state that prevents horizontal scaling.

---

# Production Readiness Checklist

Before deployment, verify:

- configuration validated,
- secrets configured,
- migrations applied,
- health checks operational,
- logging enabled,
- metrics exported,
- tracing configured,
- backups verified,
- alerts configured,
- security review completed.

---

# Architectural Invariants

The backend must always satisfy the following:

- Business logic remains deterministic.
- Infrastructure depends on abstractions.
- Controllers remain thin.
- Services coordinate workflows.
- Domain rules are framework-independent.
- Persistence is isolated.
- Configuration is validated.
- Authentication precedes authorisation.
- Every request is traceable.
- Every external dependency is observable.

Violation of these invariants should be considered an architectural regression and addressed before release.

---

*End of Part 8.*

**Next:** Part 9 will cover the **Frontend Architecture**, including React architecture, state management, streaming UI, accessibility, performance optimisation, component design, design system standards, visualisation, and user experience principles.
---

# Part IX — Frontend Architecture

The frontend is the primary human interface to Aether Orchestrator.

Its responsibility is to present complex orchestration, reasoning, retrieval, and execution in a way that is intuitive, transparent, and responsive without exposing unnecessary implementation complexity.

The frontend should never become a second backend.

Business logic belongs in the backend.

The frontend is responsible for:

- presentation,
- interaction,
- visualisation,
- local state,
- accessibility,
- user experience,
- real-time updates.

---

# Frontend Design Principles

The frontend should optimise for:

- clarity,
- responsiveness,
- accessibility,
- consistency,
- predictability,
- performance,
- composability.

Every screen should answer three questions:

1. What is happening?
2. Why is it happening?
3. What can I do next?

---

# Technology Stack

Recommended baseline stack:

- React
- TypeScript
- Vite
- TanStack Query
- React Router
- Zustand (or equivalent lightweight state store)
- Tailwind CSS (or equivalent design system)
- SSE for streaming
- Vitest
- Playwright

Framework selection should remain replaceable through clean architectural boundaries.

---

# Frontend Architecture

```
Application

↓

Routes

↓

Pages

↓

Layouts

↓

Features

↓

Components

↓

Hooks

↓

Services

↓

API Client
```

Each layer should depend only on the layer below it.

---

# Feature-Based Organisation

Organise by capability rather than component type.

Preferred:

```
features/

research/

documents/

sessions/

reports/

settings/

authentication/
```

Avoid:

```
components/

buttons/

forms/

cards/

tables/
```

at the top level as the primary organisational strategy.

Feature ownership improves scalability.

---

# Component Hierarchy

```
Page

↓

Feature

↓

Container

↓

Presentational Components

↓

Primitive UI Components
```

Business logic should exist at the highest reasonable level.

Primitive components should remain stateless whenever practical.

---

# Component Design Principles

Every component should satisfy:

- single responsibility,
- explicit inputs,
- predictable outputs,
- minimal side effects.

Prefer composition over inheritance.

Prefer small reusable components over highly configurable monoliths.

---

# Presentational vs Container Components

Presentational components:

- render UI,
- receive props,
- emit events,
- contain minimal logic.

Container components:

- fetch data,
- coordinate hooks,
- manage feature-level state,
- compose presentational components.

Keep these responsibilities separate.

---

# State Management Philosophy

State should exist at the lowest level capable of owning it.

Categories:

## Local State

Examples:

- modal visibility,
- input values,
- temporary UI interactions.

Use component state.

---

## Feature State

Examples:

- active research session,
- selected report,
- sidebar filters.

Use feature-scoped state stores.

---

## Server State

Examples:

- sessions,
- reports,
- documents,
- execution status.

Use server-state libraries such as TanStack Query.

Never duplicate server state unnecessarily.

---

## Global State

Use sparingly.

Suitable examples:

- authenticated user,
- theme,
- application configuration.

Avoid turning global state into a dumping ground.

---

# Data Flow

Preferred flow:

```
User

↓

UI Event

↓

Action

↓

API Client

↓

Backend

↓

Updated State

↓

Re-render
```

Avoid circular data flow.

---

# API Client

The frontend should interact with the backend through a single API abstraction.

Responsibilities:

- request execution,
- authentication headers,
- retries,
- error translation,
- response parsing.

Business logic should never be embedded inside the API client.

---

# Server-Sent Events (SSE)

The frontend should consume streamed execution events.

Typical event flow:

```
Planning Started

↓

Task Assigned

↓

Task Running

↓

Tool Invoked

↓

Tool Completed

↓

Verification

↓

Report Updated

↓

Completed
```

Streaming should progressively enhance the experience without compromising correctness.

---

# Real-Time UI

The interface should communicate execution progress continuously.

Recommended visual elements include:

- execution timeline,
- active agent indicator,
- task graph,
- current tool,
- elapsed time,
- completed tasks,
- pending tasks.

Avoid vague indicators such as:

```
Thinking...
```

Prefer concrete execution information.

---

# Optimistic Updates

Optimistic updates should be limited to operations that are easily reversible.

Examples:

- starring reports,
- renaming sessions,
- UI preferences.

Do not use optimistic updates for long-running orchestration.

---

# Error Handling

Errors should be:

- understandable,
- actionable,
- recoverable where possible.

Differentiate between:

- validation errors,
- connectivity issues,
- permission failures,
- execution failures,
- internal errors.

Users should always know what failed and what action, if any, they can take.

---

# Loading States

Every asynchronous operation should define an explicit loading state.

Prefer skeletons and progressive rendering over blocking spinners.

Loading indicators should communicate context.

Examples:

```
Retrieving documentation...

Executing verification...

Generating report...
```

---

# Empty States

Empty states should explain:

- why nothing is displayed,
- how to populate the view,
- recommended next actions.

Avoid blank screens.

---

# Accessibility

Accessibility is a first-class engineering requirement.

Minimum expectations include:

- semantic HTML,
- keyboard navigation,
- focus management,
- screen reader compatibility,
- sufficient colour contrast,
- descriptive labels,
- ARIA only where necessary.

Every interactive feature should be usable without a mouse.

---

# Responsive Design

Support a responsive layout across common viewport sizes.

Breakpoints should be content-driven rather than device-driven.

Avoid designing exclusively for desktop.

---

# Design System

A shared design system should define:

- colours,
- typography,
- spacing,
- elevation,
- border radii,
- motion,
- icons,
- component variants.

Avoid ad hoc styling.

Consistency reduces cognitive load.

---

# Theming

Support at least:

- light mode,
- dark mode.

Themes should be token-driven rather than hardcoded.

---

# Visual Language

Visual hierarchy should communicate execution state.

Examples:

- active work,
- completed work,
- failed work,
- queued work,
- verification status.

Use consistent visual semantics across the application.

---

# Forms

Forms should:

- validate incrementally,
- provide immediate feedback,
- preserve user input,
- explain validation failures.

Validation rules should mirror backend validation where practical.

---

# Navigation

Navigation should remain predictable.

Primary navigation should expose:

- Research
- Sessions
- Documents
- Reports
- Settings

Avoid deeply nested navigation hierarchies.

---

# Search Experience

Search should support:

- incremental suggestions,
- keyboard navigation,
- filtering,
- sorting,
- recent queries.

Search results should surface relevance and source information where available.

---

# Report Viewer

The report viewer should support:

- table of contents,
- anchored headings,
- collapsible sections,
- citations,
- code blocks,
- Mermaid diagrams,
- copy-to-clipboard,
- export.

Large reports should load progressively.

---

# Execution Visualisation

Execution should be represented graphically.

Recommended visualisations include:

- DAG view,
- timeline,
- Gantt chart,
- task dependency graph,
- agent activity feed.

Visualisations should reflect actual execution state rather than inferred progress.

---

# Performance

Performance objectives:

- Initial render < 2 seconds on typical broadband.
- Interaction latency < 100 ms for local UI actions.
- Smooth streaming without dropped frames.
- Avoid unnecessary re-renders.

Measure performance before optimising.

---

# Rendering Strategy

Prefer:

- code splitting,
- lazy loading,
- route-based bundles,
- memoisation where justified,
- virtualisation for large lists.

Avoid premature optimisation that reduces maintainability.

---

# Security

Frontend responsibilities include:

- secure token storage,
- CSRF protection where applicable,
- XSS prevention,
- output encoding,
- avoiding sensitive data in client storage.

Never trust client-side validation alone.

---

# Internationalisation

Design components to support localisation.

Avoid concatenated strings.

Use message identifiers and parameterised formatting.

Text expansion should be considered during layout design.

---

# Offline Behaviour

Where practical:

- preserve drafts,
- cache static assets,
- recover gracefully from connection loss.

The application should clearly indicate offline status.

---

# Testing Strategy

Frontend testing should include:

- unit tests for components and hooks,
- integration tests for feature workflows,
- accessibility testing,
- end-to-end tests for critical user journeys,
- visual regression testing where appropriate.

Tests should focus on behaviour rather than implementation details.

---

# Observability

Capture frontend telemetry including:

- page load time,
- route transitions,
- rendering errors,
- API failures,
- streaming disconnects,
- user interactions (respecting privacy requirements).

Telemetry should aid diagnosis without collecting unnecessary personal data.

---

# Architectural Invariants

The frontend must always satisfy the following:

- Business logic remains in the backend.
- Components remain composable.
- State ownership is explicit.
- Server state is not duplicated unnecessarily.
- Streaming reflects real execution.
- Accessibility is non-negotiable.
- Performance is measured.
- Design system consistency is maintained.
- API interactions occur through a common client abstraction.
- User experience prioritises transparency over visual novelty.

Violation of these invariants should be treated as a frontend architectural regression.

---

*End of Part 9.*

**Next:** Part 10 will cover **Database Architecture & Persistence**, including schema design, PostgreSQL standards, vector storage, migrations, indexing, transaction strategy, event sourcing considerations, audit trails, backups, retention policies, and production data governance.

---

# Part X — Production, Operations & Engineering Standards

The remaining sections of this specification define the operational and engineering practices required to build, deploy, maintain, and evolve Aether Orchestrator as a production-grade platform. While the earlier sections describe *how the system is architected*, these sections describe *how it is operated, secured, tested, monitored, and maintained* throughout its lifecycle.

Rather than introducing new architectural concepts, they establish the standards that ensure the architecture remains reliable, secure, observable, and maintainable at scale.

---

# Database & Persistence

The persistence layer is responsible for maintaining all long-lived system state.

It should provide:

- Strong consistency for critical application data
- ACID-compliant transactions
- Schema versioning through migrations
- Optimised indexing strategies
- Repository abstractions
- Soft deletion where appropriate
- Immutable historical records
- Audit trails
- Automated backup and restore procedures

Persistence should remain implementation-independent, allowing PostgreSQL, object storage, vector databases, and future storage engines to evolve independently behind stable interfaces.

---

# Security Architecture

Security should be integrated into every layer of the platform rather than treated as an isolated feature.

Core principles include:

- Zero Trust architecture
- Least privilege access
- Role-Based Access Control (RBAC)
- Attribute-Based Access Control (ABAC) where appropriate
- Multi-factor authentication
- Secure secret management
- Encryption in transit
- Encryption at rest
- Input validation
- Output encoding
- Secure defaults
- Regular security reviews
- Comprehensive audit logging

All privileged operations should be authenticated, authorised, logged, and traceable.

---

# Authentication & Authorisation

Authentication establishes identity.

Authorisation determines permitted actions.

The platform should support:

- OAuth2
- OpenID Connect
- Enterprise SSO
- API Keys
- JWT authentication
- Service-to-service authentication

Permissions should be granular and capability-based rather than role-only.

---

# Configuration Management

Configuration should be:

- Centralised
- Version controlled
- Environment specific
- Strongly validated
- Secret-aware

Application startup should fail immediately if mandatory configuration is invalid.

---

# Observability

Every component should expose telemetry.

Observability consists of:

- Structured logging
- Metrics
- Distributed tracing
- Health monitoring
- Audit logging
- Performance profiling

Every request should be traceable from API entry through orchestration, agent execution, MCP calls, retrieval, report generation, and persistence.

---

# Monitoring

Production monitoring should include:

- API latency
- Agent execution time
- MCP health
- Retrieval latency
- Database performance
- Vector search performance
- Queue depth
- Token consumption
- LLM costs
- Error rates
- Cache hit rates
- Infrastructure utilisation

Dashboards should support operational, engineering, and business metrics.

---

# Logging Standards

Logs should be:

- Structured
- Searchable
- Correlated
- Privacy-aware
- Machine readable

Every log entry should contain sufficient context for debugging without exposing sensitive user information.

---

# Testing Strategy

Testing should exist at multiple levels.

## Unit Testing

Validate isolated business logic.

---

## Integration Testing

Validate subsystem interactions.

---

## Contract Testing

Ensure stable interfaces between services.

---

## End-to-End Testing

Validate complete user workflows.

---

## Performance Testing

Measure:

- latency
- throughput
- concurrency
- scalability

---

## Load Testing

Verify behaviour under expected production load.

---

## Stress Testing

Identify operational limits and failure behaviour.

---

## Chaos Testing

Intentionally introduce failures to verify resilience.

---

## Security Testing

Perform:

- dependency scanning
- static analysis
- penetration testing
- vulnerability assessment
- secret detection

Testing should be automated wherever practical.

---

# Deployment Strategy

Production deployments should support:

- automated pipelines
- repeatable builds
- infrastructure as code
- immutable deployments
- blue/green deployment
- rolling deployment
- canary releases
- automatic rollback

Deployments should minimise downtime while maximising confidence.

---

# Scalability

The platform should scale horizontally.

Stateless application instances are preferred.

Shared state should reside in external systems such as:

- PostgreSQL
- Redis
- Object Storage
- Vector Database
- Message Queue

Scaling should not require architectural changes.

---

# Performance Optimisation

Performance improvements should be evidence-driven.

Optimisation priorities include:

- caching
- batching
- asynchronous processing
- connection pooling
- efficient retrieval
- streaming
- parallel execution

Premature optimisation should be avoided.

---

# Reliability

Production systems should be resilient to failure.

Required capabilities include:

- retry policies
- circuit breakers
- graceful degradation
- timeout handling
- automatic recovery
- redundancy
- backup strategies
- disaster recovery

Failures should be expected and explicitly designed for.

---

# Data Governance

All data should have clearly defined:

- ownership
- classification
- retention policy
- archival policy
- deletion policy
- access controls
- audit requirements

Knowledge assets should remain versioned and attributable throughout their lifecycle.

---

# Compliance

Where applicable, the platform should support compliance with relevant standards including:

- GDPR
- SOC 2
- ISO 27001
- Internal organisational governance

Compliance should be achieved through architectural design rather than ad hoc processes.

---

# Documentation Standards

Documentation should be treated as a first-class engineering artefact.

Every subsystem should include:

- purpose
- architecture
- interfaces
- configuration
- deployment
- operational guidance
- troubleshooting
- examples

Documentation should evolve alongside code.

---

# Coding Standards

Code should prioritise:

- readability
- simplicity
- determinism
- consistency
- explicitness
- testability

Complexity should be introduced only when justified by measurable benefit.

---

# Versioning

The platform should follow Semantic Versioning.

Major versions represent breaking architectural changes.

Minor versions introduce backwards-compatible functionality.

Patch versions fix defects without changing behaviour.

Public APIs, prompts, MCP servers, schemas, and documentation should all be versioned.

---

# Continuous Improvement

Architecture should evolve through measurable feedback.

Inputs include:

- operational metrics
- user feedback
- benchmarking
- production incidents
- security reviews
- architectural retrospectives

Significant architectural decisions should be documented through Architecture Decision Records (ADRs).

---

# Engineering Principles

Every engineering decision should reinforce the following principles:

- Deterministic software over implicit behaviour.
- Explicit contracts over convention.
- Composition over complexity.
- Modularity over coupling.
- Retrieval over memorisation.
- Verification over assumption.
- Observability over opacity.
- Automation over manual processes.
- Security by default.
- Documentation as part of the product.
- Incremental evolution over large rewrites.
- Production readiness from day one.

---

# Non-Negotiable Architectural Invariants

These principles apply across the entire platform and supersede implementation details.

- The orchestrator owns execution.
- Agents own reasoning.
- Tools execute through MCP.
- Retrieval precedes evidence-based generation.
- Verification precedes synthesis.
- Reports are generated only from verified evidence.
- All external interactions are authenticated, authorised, validated, and logged.
- Every component is independently testable and replaceable.
- Every interface is versioned and documented.
- Every architectural decision prioritises maintainability, reliability, security, and explainability over short-term convenience.

---

# Vision

Aether Orchestrator is designed as a long-lived engineering platform rather than a collection of AI features.

Its architecture deliberately separates reasoning from execution, intelligence from infrastructure, and flexibility from complexity.

Every subsystem should be independently understandable, independently testable, independently deployable, and independently replaceable.

The ultimate objective is to create a platform that remains maintainable, extensible, and reliable over many years of development while embracing the rapid evolution of AI models, tooling, and infrastructure without requiring fundamental architectural redesign.

---

**End of CLAUDE.md**