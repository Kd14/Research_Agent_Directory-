import type { AgentNode, InstructionStep } from '../../client/types';

export interface RawInstructionStep {
  readonly assignedAgentId?: string;
  readonly agentName?: string;
  readonly title: string;
  readonly instruction: string;
  readonly requiredTools?: readonly string[];
}

// Shared step-shaping logic: guards against an LLM (planner OR the reflection loop's
// additionalStepsNeeded) hallucinating an unavailable assignedAgentId by falling back to the first
// available agent, and gives every step a unique id/stepNumber. Originally lived inline in
// PlannerService.plan(); extracted so ReflectionLoopRunner can build follow-up steps the same way
// instead of duplicating this guard.
export function buildInstructionSteps(
  rawSteps: readonly RawInstructionStep[],
  availableAgentIds: readonly string[],
  agentRoster: Record<string, AgentNode>,
  startingStepNumber = 1
): InstructionStep[] {
  const fallbackAgentId = availableAgentIds[0];

  return rawSteps.map((step, idx) => {
    const assignedAgentId = step.assignedAgentId && availableAgentIds.includes(step.assignedAgentId)
      ? step.assignedAgentId
      : fallbackAgentId;
    const stepNumber = startingStepNumber + idx;

    return {
      id: `step_${stepNumber}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      stepNumber,
      assignedAgentId,
      agentName: assignedAgentId === step.assignedAgentId ? (step.agentName || assignedAgentId.toUpperCase()) : agentRoster[assignedAgentId].name,
      title: step.title,
      instruction: step.instruction,
      requiredTools: step.requiredTools ? [...step.requiredTools] : ['mcp_doc_search'],
      status: 'pending'
    };
  });
}
