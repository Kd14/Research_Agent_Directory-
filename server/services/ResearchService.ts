import type { ExecutionError, PlanningError } from '../errors/AppError';
import { Ok, type Result } from '../result';
import { renderMarkdownReportToPdf } from './PdfReportRenderer';
import type { ExecuteStepInput, ExecuteStepOutput, ExecutionService, SynthesizeInput } from './ExecutionService';
import type { PlanInput, PlanOutput, PlannerService } from './PlannerService';
import type { SessionService } from './SessionService';

export interface PlanOutputWithSession extends PlanOutput {
  readonly id: string;
}

// Thin composition over Planner/Execution/Session services - the API layer never talks to those
// directly. Will grow into the real orchestration entrypoint once streaming (P1) drives a stateful
// pipeline instead of one-request-per-step.
export class ResearchService {
  constructor(
    private readonly planner: PlannerService,
    private readonly execution: ExecutionService,
    private readonly sessions: SessionService
  ) {}

  async plan(input: PlanInput): Promise<Result<PlanOutputWithSession, PlanningError>> {
    const result = await this.planner.plan(input);
    if (!result.ok) return result;

    const metadata = this.sessions.create({
      title: result.value.title,
      userPrompt: result.value.userPrompt,
      selectedDocIds: result.value.selectedDocIds,
      executionMode: result.value.executionMode
    });
    this.sessions.save(metadata.id, {
      instructionSet: result.value.instructionSet,
      agents: result.value.agents,
      logs: result.value.logs,
      agentOutputs: {},
      currentStepIndex: 0
    });

    return Ok({ id: metadata.id, ...result.value });
  }

  async executeStep(
    input: ExecuteStepInput & { sessionId?: string }
  ): Promise<Result<ExecuteStepOutput, ExecutionError>> {
    const result = await this.execution.executeStep(input);

    if (result.ok && input.sessionId) {
      const loaded = this.sessions.load(input.sessionId);
      if (loaded.ok) {
        const agentOutputs = { ...loaded.value.history.agentOutputs, [input.step.id]: result.value.agentOutput };
        this.sessions.save(input.sessionId, { agentOutputs, status: 'executing' });
      }
    }

    return result;
  }

  async synthesize(
    input: SynthesizeInput & { sessionId?: string }
  ): Promise<Result<string, ExecutionError>> {
    const result = await this.execution.synthesize(input);

    if (result.ok && input.sessionId) {
      this.sessions.writeArtifact(input.sessionId, 'report.md', result.value);
      this.sessions.save(input.sessionId, { finalReportArtifact: 'report.md' });

      try {
        const pdf = await renderMarkdownReportToPdf({ markdown: result.value, title: input.userPrompt });
        this.sessions.writeBinaryArtifact(input.sessionId, 'report.pdf', pdf);
        this.sessions.save(input.sessionId, { finalReportPdfArtifact: 'report.pdf' });
      } catch {
        // Best-effort: the markdown report artifact still stands even if PDF export fails.
      }

      this.sessions.save(input.sessionId, { status: 'completed' });
    }

    return result;
  }
}
