# CLAUDE.md

# AI Engineering Instructions

This project is a LOCAL-FIRST research assistant.

It is intended to run only on a developer workstation.

Do not optimise for cloud deployment, multi-tenancy, distributed systems or
enterprise scalability unless explicitly requested.

Prioritise:

- Simplicity
- Maintainability
- Fast iteration
- Clear architecture
- Small focused modules
- Strong typing
- Observable execution

Avoid introducing unnecessary abstraction.

---

# Current Priorities (Execute in Order)

## P0 — Stabilise Architecture

### 1. Split oversized files

Current code contains large files that mix responsibilities.

Target:

```
server/
    api/
    services/
    llm/
    orchestration/
    tools/
    prompts/
    storage/

client/
    components/
    pages/
    hooks/
    services/
    state/
```

Rules

- Maximum 300 lines per file where practical
- One responsibility per module
- Business logic never lives inside React components
- Route handlers should only validate requests and delegate work

---

### 2. Create Service Layer

Replace direct function calls with services.

Example

```
ResearchService

PlannerService

ExecutionService

SessionService

DocumentService

ToolService
```

The API should never contain orchestration logic.

---

### 3. Introduce LLM Provider Interface

Current implementation is tightly coupled.

Create

```
LLMProvider

generate()

stream()

countTokens()

supportsThinking()

supportsTools()
```

Implement

```
GeminiProvider
```

Future providers should require zero orchestration changes.

---

### 4. Prompt Management

Move prompts into

```
prompts/

planner.md

research.md

synthesis.md

reflection.md

tool_selection.md
```

Support template variables.

Never hardcode prompts inside source files.

Prompt versioning should be possible.

---

### 5. Tool Registry

Replace scattered tool execution with

```
ToolRegistry

ToolDefinition

ToolExecutor
```

Every tool should expose

```
name

description

parameters

execute()

validate()

examples
```

Support automatic discovery.

---

### 6. Session Persistence

Current sessions are ephemeral.

Implement

```
sessions/

metadata.json

history.json

artifacts/

documents/
```

Support

- resume session
- rename session
- duplicate session
- export session
- delete session

---

### 7. Configuration

Centralise configuration.

No hardcoded

- model names
- temperatures
- token limits
- ports
- paths

Configuration should be loaded from

```
config.ts

.env
```

---

# P1 Improvements

## Streaming

Replace request-response generation with streaming.

Requirements

- token streaming
- cancellation
- retry
- reconnect support

---

## Progress Events

Every major step should emit progress.

Example

Planning

Searching

Reading files

Running tools

Synthesising

Finished

UI should subscribe instead of polling.

---

## Better Error Handling

Replace generic errors with

```
ValidationError

ToolError

ProviderError

PlanningError

ExecutionError

ConfigurationError
```

Surface meaningful diagnostics.

---

## Logging

Implement structured logs.

Include

timestamp

duration

tool

tokens

provider

errors

Do not log prompt contents by default.

---

## File Management

Support

drag-drop

folder import

recursive indexing

duplicate detection

large file handling

watch mode

---

## Search

Current search is keyword based.

Improve with

document chunking

BM25

embeddings

hybrid retrieval

reranking

source attribution

---

# P2 Research Improvements

## Multi-agent execution

Planner

↓

Researcher

↓

Critic

↓

Synthesiser

↓

Reviewer

Each agent should have isolated prompts.

---

## Reflection Loop

After synthesis

Evaluate

Missing evidence

Weak arguments

Conflicting sources

Hallucination risk

Automatically request another research iteration if confidence is low.

---

## Memory

Persist

successful tool sequences

user preferences

common prompts

cached research

Avoid repeating identical work.

---

## Artifact Generation

Support

Markdown

PDF

DOCX

HTML

Presentation outline

Citation export

---

## Citation Graph

Track

which tool produced data

which document supplied evidence

which response consumed evidence

Allow traceability.

---

# UI Improvements

Refactor App into

```
ResearchWorkspace

Sidebar

ChatPanel

ResearchTimeline

DocumentPanel

SessionPanel

ToolInspector

SettingsDialog
```

Avoid prop drilling.

Use hooks.

---

# Performance

Lazy load documents.

Cache parsed files.

Cache prompt templates.

Reuse embeddings.

Debounce indexing.

Avoid unnecessary rerenders.

---

# Code Standards

Use strict TypeScript.

Avoid

```
any
```

Prefer

```
type

interface

Result<T,E>

readonly

const
```

Prefer composition.

Avoid inheritance.

Prefer dependency injection over singletons.

Keep functions focused.

---

# Testing

Add

unit tests

provider mocks

tool mocks

integration tests

session persistence tests

prompt rendering tests

---

# Features Worth Implementing

## Prompt Library

Reusable prompt templates.

Versioned.

Searchable.

---

## Research Templates

Predefined workflows

Academic Review

Technical Investigation

Competitive Analysis

Architecture Review

Security Audit

Bug Investigation

---

## Prompt Playground

Edit prompts.

Run against existing sessions.

Compare outputs.

---

## Cost Dashboard

Display

tokens

latency

tool usage

provider statistics

Estimated cost (even if running locally)

---

## Research Timeline

Visual execution graph.

Every planning decision.

Every tool call.

Every generated artifact.

Replayable.

---

## Local Knowledge Base

Index

markdown

pdf

code

documentation

Automatically available to future research sessions.

---

## Plugin System

Support registering

tools

providers

prompt packs

document loaders

exporters

without modifying core code.

---

# Things NOT To Build

Unless explicitly requested do not introduce

- Kubernetes
- Docker orchestration
- Redis
- PostgreSQL
- Authentication
- User accounts
- RBAC
- Multi-tenancy
- Distributed queues
- Event sourcing
- Microservices
- Cloud deployment
- Message brokers

The application runs on a trusted local machine.

Developer productivity is more important than production scalability.

---

# Guiding Principle

Every change should reduce complexity, improve modularity, and make the research pipeline easier to understand.

Prefer incremental refactors over rewrites.

Keep the application runnable after every change.