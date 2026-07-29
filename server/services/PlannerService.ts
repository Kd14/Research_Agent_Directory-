import { Type } from '@google/genai';
import type { AgentNode, InstructionStep, MCPLogEntry } from '../../client/types';
import { PlanningError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import type { LLMProvider } from '../llm/LLMProvider';
import { getDefaultAgents } from '../orchestration/AgentRoster';
import { loadPrompt, renderPrompt } from '../prompts/PromptRenderer';
import type { DocumentService } from './DocumentService';

export interface PlanInput {
  readonly userPrompt: string;
  readonly docIds?: readonly string[];
  readonly activeAgentIds?: readonly string[];
}

export interface PlanOutput {
  readonly title: string;
  readonly userPrompt: string;
  readonly selectedDocIds: readonly string[];
  readonly executionMode: 'auto';
  readonly currentStepIndex: 0;
  readonly instructionSet: InstructionStep[];
  readonly status: 'planning';
  readonly logs: MCPLogEntry[];
  readonly agents: Record<string, AgentNode>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class PlannerService {
  constructor(
    private readonly llmProvider: LLMProvider,
    private readonly documentService: DocumentService
  ) {}

  async plan(input: PlanInput): Promise<Result<PlanOutput, PlanningError>> {
    const { userPrompt, docIds, activeAgentIds } = input;

    const allSpecialists = getDefaultAgents();
    const domainAgentIds = ['literature', 'pipeline', 'validation'];
    // Domain specialists are opt-in per run; 'synthesis' (final report formatting)
    // is always available alongside the always-on 'lead' orchestrator.
    const selectedDomainIds: string[] = Array.isArray(activeAgentIds) && activeAgentIds.length > 0
      ? domainAgentIds.filter(id => activeAgentIds.includes(id))
      : domainAgentIds;
    const availableAgentIds = [...selectedDomainIds, 'synthesis'];

    const documents = this.documentService.list();
    const selectedDocs = docIds?.length
      ? documents.filter(d => docIds.includes(d.id))
      : documents;

    const docSummaries = selectedDocs.map(d => `- [${d.category}] ${d.title} (${d.fileName}): ${d.summary || d.content.slice(0, 150)}`).join('\n');

    const agentRoster = availableAgentIds
      .map((id, idx) => `${idx + 1}. "${id}": ${allSpecialists[id].name} - ${allSpecialists[id].title} (Tools: ${allSpecialists[id].toolsAccess.join(', ')})`)
      .join('\n');

    const systemPrompt = renderPrompt(loadPrompt('planner'), {
      agentRoster,
      availableAgentIdsList: availableAgentIds.map(id => `"${id}"`).join(' | '),
      userPrompt,
      docSummaries: docSummaries || 'No specific documents selected; using general technical knowledge and MCP search.'
    });

    const result = await this.llmProvider.generate(systemPrompt, {
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          researchGoal: { type: Type.STRING },
          instructionSet: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                stepNumber: { type: Type.INTEGER },
                assignedAgentId: { type: Type.STRING },
                agentName: { type: Type.STRING },
                title: { type: Type.STRING },
                instruction: { type: Type.STRING },
                requiredTools: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ['stepNumber', 'assignedAgentId', 'agentName', 'title', 'instruction', 'requiredTools']
            }
          }
        },
        required: ['title', 'researchGoal', 'instructionSet']
      }
    });

    if (!result.ok) {
      return Err(new PlanningError(result.error.message, result.error));
    }

    try {
      const planData = JSON.parse((result.value.text ?? '').trim());

      // The model is instructed to only use availableAgentIds, but guard against
      // it hallucinating a deselected agent so the UI never references a missing node.
      const fallbackAgentId = availableAgentIds[0];
      const formattedInstructionSet: InstructionStep[] = planData.instructionSet.map((step: any, idx: number) => {
        const assignedAgentId = availableAgentIds.includes(step.assignedAgentId) ? step.assignedAgentId : fallbackAgentId;
        return {
          id: `step_${idx + 1}_${Date.now()}`,
          stepNumber: idx + 1,
          assignedAgentId,
          agentName: assignedAgentId === step.assignedAgentId ? (step.agentName || assignedAgentId.toUpperCase()) : allSpecialists[assignedAgentId].name,
          title: step.title,
          instruction: step.instruction,
          requiredTools: step.requiredTools || ['mcp_doc_search'],
          status: 'pending'
        };
      });

      const initialAgents: Record<string, AgentNode> = {
        lead: allSpecialists.lead,
        ...Object.fromEntries(availableAgentIds.map(id => [id, allSpecialists[id]]))
      };

      const initialLogs: MCPLogEntry[] = [
        {
          id: `log_${Date.now()}_1`,
          timestamp: new Date().toLocaleTimeString(),
          agentId: 'lead',
          agentName: 'Dr. Astra (Lead Orchestrator)',
          type: 'orchestrator_decision',
          message: `Decomposed research query into ${formattedInstructionSet.length} structured MCP instruction steps.`,
          details: `Research Goal: ${planData.researchGoal}`,
          level: 'success'
        }
      ];

      return Ok({
        title: planData.title,
        userPrompt,
        selectedDocIds: docIds || [],
        executionMode: 'auto',
        currentStepIndex: 0,
        instructionSet: formattedInstructionSet,
        status: 'planning',
        logs: initialLogs,
        agents: initialAgents,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      return Err(new PlanningError(err instanceof Error ? err.message : 'Failed to parse research plan', err));
    }
  }
}
