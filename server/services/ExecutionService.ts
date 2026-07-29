import { Type } from '@google/genai';
import type { InstructionStep } from '../../client/types';
import { ExecutionError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import type { LLMProvider } from '../llm/LLMProvider';
import { getDefaultAgents } from '../orchestration/AgentRoster';
import { loadPrompt, renderPrompt } from '../prompts/PromptRenderer';
import type { DocumentService } from './DocumentService';
import type { ToolService } from './ToolService';

export interface ExecuteStepInput {
  readonly step: InstructionStep & { requiredTools?: readonly string[] };
  readonly selectedDocIds?: readonly string[];
  readonly userFeedback?: string;
  /** Optional hook for callers (the SSE pipeline) that want sub-step progress visibility. */
  readonly onPhase?: (phase: 'running_tools' | 'analyzing') => void;
}

export interface ExecuteStepOutput {
  readonly agentId: string;
  readonly thoughtTrace: string[];
  readonly toolCallUsed: string | null;
  readonly toolArgs: Record<string, unknown>;
  readonly toolResult: unknown;
  readonly agentOutput: string;
  readonly keyTakeaways: string[];
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
    private readonly documentService: DocumentService
  ) {}

  async executeStep(input: ExecuteStepInput): Promise<Result<ExecuteStepOutput, ExecutionError>> {
    const { step, selectedDocIds, userFeedback, onPhase } = input;
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
      // Phase 1: let the agent choose a real MCP tool + arguments for its directive via
      // Gemini function calling, then actually execute that tool - no fabricated tool calls.
      const availableTools = this.toolService.toFunctionDeclarations((step.requiredTools || []) as string[]);

      let toolCallUsed: string | null = null;
      let toolArgs: Record<string, unknown> = {};
      let toolResult: unknown = null;

      const userFeedbackSection = userFeedback ? `Human Supervisor Feedback / Intervention: "${userFeedback}"` : '';

      if (availableTools.length > 0) {
        onPhase?.('running_tools');
        const toolSelectionPrompt = renderPrompt(loadPrompt('tool_selection'), {
          agentName: agent.name,
          agentTitle: agent.title,
          instruction: step.instruction,
          userFeedbackSection
        });
        const toolChoiceResult = await this.llmProvider.generate(toolSelectionPrompt, {
          functionDeclarations: availableTools
        });
        if (!toolChoiceResult.ok) throw toolChoiceResult.error;

        const call = toolChoiceResult.value.toolCalls?.[0];
        if (call?.name) {
          toolCallUsed = call.name;
          toolArgs = call.args || {};
        } else {
          // Model declined to call a function - fall back to the step's primary declared tool.
          toolCallUsed = (step.requiredTools as string[])[0];
          toolArgs = toolCallUsed === 'mcp_doc_search' ? { query: step.title } : {};
        }

        const toolRunResult = await this.toolService.run(toolCallUsed as string, { ...toolArgs, docIds: selectedDocIds });
        if (!toolRunResult.ok) throw toolRunResult.error;
        toolResult = toolRunResult.value;
      }

      // Phase 2: produce the agent's analytical output grounded in the REAL tool result above.
      onPhase?.('analyzing');
      const toolCallSection = toolCallUsed
        ? `MCP Tool Invoked: ${toolCallUsed}\nTool Arguments: ${JSON.stringify(toolArgs)}\nTool Result:\n${JSON.stringify(toolResult, null, 2)}\n`
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

      return Ok({
        agentId,
        thoughtTrace: parsed.thoughtTrace,
        toolCallUsed,
        toolArgs,
        toolResult,
        agentOutput: parsed.agentOutput,
        keyTakeaways: parsed.keyTakeaways
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
