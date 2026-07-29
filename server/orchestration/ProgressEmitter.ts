export type ProgressPhase =
  | 'planning'
  | 'searching'
  | 'reading_files'
  | 'running_tools'
  | 'analyzing'
  | 'synthesizing'
  | 'exporting_pdf'
  | 'pdf_export_failed'
  | 'finished'
  | 'error';

export interface ProgressEvent {
  readonly phase: ProgressPhase;
  readonly stepIndex?: number;
  readonly stepTitle?: string;
  readonly message: string;
  readonly timestamp: string;
}

export type ProgressListener = (event: ProgressEvent) => void;

export class ProgressEmitter {
  constructor(private readonly listener: ProgressListener) {}

  emit(phase: ProgressPhase, message: string, extra?: { stepIndex?: number; stepTitle?: string }): void {
    this.listener({
      phase,
      message,
      timestamp: new Date().toISOString(),
      ...extra
    });
  }
}
