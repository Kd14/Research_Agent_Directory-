import { Type } from '@google/genai';
import type { CitationRecord, InstructionStep } from '../../client/types';
import { ExecutionError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import type { LLMProvider, StandbyEvent } from '../llm/LLMProvider';
import { getDefaultAgents } from '../orchestration/AgentRoster';
import { loadPrompt, renderPrompt } from '../prompts/PromptRenderer';
import type { RecordCitationInput } from '../tools/types';
import type { DocumentService } from './DocumentService';
import type { MemoryService } from './MemoryService';
import type { ToolService } from './ToolService';

function nextCitationId(): string {
  return `citation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** A single real MCP tool invocation made while gathering evidence for one step. */
interface ToolCallRecord {
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly result: unknown;
}

/** Every step is allowed up to this many sequential tool calls before it has to write its analysis -
 *  lets an agent chain evidence-gathering (e.g. search the web, then cross-check against uploaded
 *  documents) rather than being limited to one lookup per directive like a single chat turn. */
const MAX_TOOL_CALLS_PER_STEP = 3;

function buildPriorCallsSection(calls: readonly ToolCallRecord[]): string {
  if (calls.length === 0) return '';
  const rendered = calls
    .map((c, idx) => `${idx + 1}. ${c.name}(${JSON.stringify(c.args)}) ->\n${JSON.stringify(c.result, null, 2)}`)
    .join('\n\n');
  return `Evidence Already Gathered (${calls.length} tool call${calls.length > 1 ? 's' : ''} so far this step):\n${rendered}\n`;
}

function buildContinuationNote(callCount: number): string {
  return callCount === 0
    ? ''
    : 'You may call one more tool ONLY if a genuine evidence gap remains for this directive; otherwise respond with plain text (no function call) to signal you have gathered enough evidence.';
}

export interface ExecuteStepInput {
  readonly step: InstructionStep & { requiredTools?: readonly string[] };
  readonly selectedDocIds?: readonly string[];
  readonly userFeedback?: string;
  /** Optional hook for callers (the SSE pipeline) that want sub-step progress visibility. */
  readonly onPhase?: (phase: 'running_tools' | 'analyzing') => void;
  /** Optional hook for callers that want to surface "LLM unavailable, standing by" state live. */
  readonly onStandby?: (event: StandbyEvent) => void;
}

export interface ExecuteStepOutput {
  readonly agentId: string;
  readonly thoughtTrace: string[];
  readonly toolCallUsed: string | null;
  readonly toolArgs: Record<string, unknown>;
  readonly toolResult: unknown;
  readonly agentOutput: string;
  readonly keyTakeaways: string[];
  readonly citations: readonly CitationRecord[];
}

export interface SynthesizeInput {
  readonly userPrompt: string;
  readonly instructionSet?: readonly any[];
  readonly agentOutputs?: Record<string, string>;
  readonly selectedDocIds?: readonly string[];
}

export class ExecutionService {
  constructor(
    private readonly llmProvider: LLMProvider,
    private readonly toolService: ToolService,
    private readonly documentService: DocumentService,
    private readonly memoryService?: MemoryService
  ) {}

  async executeStep(input: ExecuteStepInput): Promise<Result<ExecuteStepOutput, ExecutionError>> {
    const { step, selectedDocIds, userFeedback, onPhase, onStandby } = input;
    const agentId = step.assignedAgentId as string;
    const agentMap = getDefaultAgents();
    const agent = agentMap[agentId] || agentMap['lead'];

    const documents = this.documentService.list();
    const targetDocs = selectedDocIds?.length
      ? documents.filter(d => selectedDocIds.includes(d.id))
      : documents;

    const docTextSnippet = targetDocs
      .map(d => `--- Document: ${d.title} (${d.category}) ---\n${d.content.slice(0, 2000)}`)
      .join('\n\n');

    try {
      const availableTools = this.toolService.toFunctionDeclarations((step.requiredTools || []) as string[]);

      const citationsCollected: CitationRecord[] = [];
      const recordCitation = (record: RecordCitationInput) => {
        citationsCollected.push({ ...record, id: nextCitationId(), createdAt: new Date().toISOString(), consumedBy: [step.id] });
      };

      const userFeedbackSection = userFeedback ? `Human Supervisor Feedback / Intervention: "${userFeedback}"` : '';

      // Phase 1: let the agent chain up to MAX_TOOL_CALLS_PER_STEP real MCP tool calls to gather
      // evidence for its directive (e.g. search the web, then cross-check uploaded documents),
      // stopping as soon as it signals (by declining to call another function) that it has enough -
      // no fabricated tool calls, and no artificial one-lookup-per-directive ceiling.
      const calls: ToolCallRecord[] = [];
      if (availableTools.length > 0) {
        onPhase?.('running_tools');
        for (let i = 0; i < MAX_TOOL_CALLS_PER_STEP; i++) {
          const toolSelectionPrompt = renderPrompt(loadPrompt('tool_selection'), {
            agentName: agent.name,
            agentTitle: agent.title,
            instruction: step.instruction,
            userFeedbackSection,
            priorCallsSection: buildPriorCallsSection(calls),
            continuationNote: buildContinuationNote(calls.length)
          });
          const toolChoiceResult = await this.llmProvider.generate(toolSelectionPrompt, {
            functionDeclarations: availableTools,
            onStandby
          });
          if (!toolChoiceResult.ok) throw toolChoiceResult.error;

          const call = toolChoiceResult.value.toolCalls?.[0];
          if (!call?.name) {
            // Model declined to call a function. On the very first attempt that means it needs a
            // nudge - fall back to the step's primary declared tool so every step that requires
            // tools still gathers at least one piece of real evidence. On a later attempt it means
            // the model judged its evidence sufficient, so just stop the loop.
            if (calls.length === 0) {
              const fallbackTool = (step.requiredTools as string[])[0];
              const fallbackArgs = fallbackTool === 'mcp_doc_search' ? { query: step.title } : {};
              const toolRunResult = await this.toolService.run(fallbackTool, { ...fallbackArgs, docIds: selectedDocIds }, recordCitation);
              if (!toolRunResult.ok) throw toolRunResult.error;
              calls.push({ name: fallbackTool, args: fallbackArgs, result: toolRunResult.value });
            }
            break;
          }

          const toolArgs = call.args || {};
          const toolRunResult = await this.toolService.run(call.name, { ...toolArgs, docIds: selectedDocIds }, recordCitation);
          if (!toolRunResult.ok) throw toolRunResult.error;
          calls.push({ name: call.name, args: toolArgs, result: toolRunResult.value });
        }
      }

      const toolCallUsed = calls.length ? calls.map(c => c.name).join(', ') : null;
      const toolArgs = calls.length === 1 ? calls[0].args : calls.length > 1 ? { calls: calls.map(c => ({ tool: c.name, args: c.args })) } : {};
      const toolResult = calls.length === 1 ? calls[0].result : calls.length > 1 ? calls.map(c => ({ tool: c.name, args: c.args, result: c.result })) : null;

      // Phase 2: produce the agent's analytical output grounded in the REAL tool result(s) above.
      onPhase?.('analyzing');
      const toolCallSection = calls.length
        ? calls.map((c, idx) => `MCP Tool Call ${idx + 1}: ${c.name}\nTool Arguments: ${JSON.stringify(c.args)}\nTool Result:\n${JSON.stringify(c.result, null, 2)}`).join('\n\n') + '\n'
        : '';
      const analysisPrompt = renderPrompt(loadPrompt('research'), {
        agentName: agent.name,
        agentTitle: agent.title,
        instruction: step.instruction,
        userFeedbackSection,
        toolCallSection,
        docTextSnippet
      });

      const analysisResult = await this.llmProvider.generate(analysisPrompt, {
        onStandby,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thoughtTrace: { type: Type.ARRAY, items: { type: Type.STRING } },
            agentOutput: { type: Type.STRING },
            keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['thoughtTrace', 'agentOutput', 'keyTakeaways']
        }
      });
      if (!analysisResult.ok) throw analysisResult.error;

      const parsed = JSON.parse((analysisResult.value.text ?? '').trim());

      // Best-effort: recording which tool sequence resolved this instruction is pure bookkeeping,
      // never worth failing an otherwise-successful step over.
      if (calls.length) {
        try {
          this.memoryService?.recordToolSequenceSuccess(step.instruction, calls.map(c => c.name));
        } catch {
          // ignore
        }
      }

      return Ok({
        agentId,
        thoughtTrace: parsed.thoughtTrace,
        toolCallUsed,
        toolArgs,
        toolResult,
        agentOutput: parsed.agentOutput,
        keyTakeaways: parsed.keyTakeaways,
        citations: citationsCollected
      });
    } catch (err) {
      return Err(new ExecutionError(
        err instanceof Error ? err.message : 'Agent step execution failed',
        step.id,
        err
      ));
    }
  }

  /** Exposed separately so callers that need to stream the synthesis (e.g. the SSE pipeline) can
   *  build the same prompt without duplicating the aggregation logic. */
  buildSynthesisPrompt(input: SynthesizeInput): string {
    const { userPrompt, instructionSet, agentOutputs, selectedDocIds } = input;

    const documents = this.documentService.list();
    const targetDocs = selectedDocIds?.length
      ? documents.filter(d => selectedDocIds.includes(d.id))
      : documents;

    const aggregatedAgentFindings = (instructionSet || []).map((step: any, i: number) => {
      const out = agentOutputs?.[step.id] || 'Step executed successfully.';
      return `### Step ${i + 1}: ${step.title} (${step.agentName})\n\n**Instruction**: ${step.instruction}\n\n**Findings**:\n${out}`;
    }).join('\n\n---\n\n');

    return renderPrompt(loadPrompt('synthesis'), {
      userPrompt,
      aggregatedAgentFindings,
      docTitles: targetDocs.map(d => `- ${d.title} (${d.category})`).join('\n')
    });
  }

  async synthesize(input: SynthesizeInput): Promise<Result<string, ExecutionError>> {
    const systemPrompt = this.buildSynthesisPrompt(input);

    const result = await this.llmProvider.generate(systemPrompt);
    if (!result.ok) {
      return Err(new ExecutionError(result.error.message, undefined, result.error));
    }

    return Ok(result.value.text);
  }
}
