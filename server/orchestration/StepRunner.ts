import type { InstructionStep } from '../../client/types';
import type { ExecuteStepOutput, ExecutionService } from '../services/ExecutionService';
import type { ProgressEmitter } from './ProgressEmitter';

export interface RunStepsOptions {
  readonly steps: readonly InstructionStep[];
  readonly startIndex: number;
  readonly selectedDocIds?: readonly string[];
  readonly signal?: AbortSignal;
  readonly onStepComplete: (stepIndex: number, result: ExecuteStepOutput) => void;
}

export type RunStepsResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly stepIndex: number; readonly message: string; readonly code: string; readonly cancelled?: boolean };

// Extracted from ResearchPipeline.run() so the same per-step loop can drive both a fresh run and a
// resumed one (starting mid-instructionSet) without duplicating the tool-select/execute/analyze
// sequencing in two places.
export class StepRunner {
  constructor(
    private readonly executionService: ExecutionService,
    private readonly progress: ProgressEmitter
  ) {}

  async run(options: RunStepsOptions): Promise<RunStepsResult> {
    const { steps, startIndex, selectedDocIds, signal, onStepComplete } = options;

    for (let i = startIndex; i < steps.length; i++) {
      if (signal?.aborted) {
        return { ok: false, stepIndex: i, message: 'Research run cancelled by client.', code: 'CANCELLED', cancelled: true };
      }

      const step = steps[i];
      this.progress.emit('running_tools', `Running step ${i + 1} of ${steps.length}: ${step.title}`, {
        stepIndex: i,
        stepTitle: step.title
      });

      const stepResult = await this.executionService.executeStep({
        step,
        selectedDocIds,
        userFeedback: undefined,
        onPhase: phase => {
          if (phase === 'analyzing') {
            this.progress.emit('analyzing', `Analyzing findings for step ${i + 1}: ${step.title}`, {
              stepIndex: i,
              stepTitle: step.title
            });
          }
        },
        onStandby: event => {
          this.progress.emit('standby', event.message, { stepIndex: i, stepTitle: step.title });
        }
      });

      if (!stepResult.ok) {
        return { ok: false, stepIndex: i, message: stepResult.error.message, code: stepResult.error.code };
      }

      onStepComplete(i, stepResult.value);

      if (signal?.aborted) {
        return { ok: false, stepIndex: i, message: 'Research run cancelled by client.', code: 'CANCELLED', cancelled: true };
      }
    }

    return { ok: true };
  }
}
