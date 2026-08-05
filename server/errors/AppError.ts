export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 400;
}

export class ToolError extends AppError {
  readonly code = 'TOOL_ERROR';
  readonly httpStatus = 502;

  constructor(message: string, readonly toolName: string, cause?: unknown) {
    super(message, cause);
  }
}

export class ProviderError extends AppError {
  readonly code = 'PROVIDER_ERROR';
  readonly httpStatus = 502;

  constructor(message: string, readonly provider: string, cause?: unknown) {
    super(message, cause);
  }
}

export class PlanningError extends AppError {
  readonly code = 'PLANNING_ERROR';
  readonly httpStatus = 502;
}

export class ExecutionError extends AppError {
  readonly code = 'EXECUTION_ERROR';
  readonly httpStatus = 500;

  constructor(message: string, readonly stepId?: string, cause?: unknown) {
    super(message, cause);
  }
}

export class ReflectionError extends AppError {
  readonly code = 'REFLECTION_ERROR';
  readonly httpStatus = 502;
}

export class ConfigurationError extends AppError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly httpStatus = 500;
}
