import type { AgentNode } from '../../client/types';

// The Critic/Reviewer pipeline-stage personas (server/services/ReflectionService.ts). Kept separate
// from AgentRoster.ts's domain specialists (literature/pipeline/validation) - these are a different
// axis ("which pipeline stage produced this text", not "which subject-matter expert wrote it") and
// are always deployed on every run rather than opt-in, so they never need the availability
// filtering PlannerService applies to the domain roster.
export function getPipelineStageAgents(): Record<'critic' | 'reviewer', AgentNode> {
  return {
    critic: {
      id: 'critic',
      role: 'critic',
      name: 'Agent Critic',
      title: 'Pre-Synthesis Findings Auditor',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
      description: 'Audits raw step findings for missing evidence, weak arguments, and conflicting sources before synthesis begins, requesting additional research steps when confidence is low.',
      status: 'idle',
      progress: 0,
      thoughtTrace: ['Ready to audit aggregated research findings.'],
      toolsAccess: []
    },
    reviewer: {
      id: 'reviewer',
      role: 'reviewer',
      name: 'Agent Reviewer',
      title: 'Final Report Reviewer',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      description: 'Reviews the synthesized final report itself for hallucination risk and unsupported claims, the last check before a report reaches the user.',
      status: 'idle',
      progress: 0,
      thoughtTrace: ['Ready to review the synthesized report.'],
      toolsAccess: []
    }
  };
}
