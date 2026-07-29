import type { FunctionDeclaration } from '@google/genai';
import type { ProviderError } from '../errors/AppError';
import type { Result } from '../result';

export interface GenerateOptions {
  readonly systemPrompt?: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly responseSchema?: Record<string, unknown>;
  readonly functionDeclarations?: readonly FunctionDeclaration[];
  readonly enableWebGrounding?: boolean;
  readonly signal?: AbortSignal;
}

export interface GenerateResult {
  readonly text: string;
  readonly toolCalls?: readonly { name: string; args: Record<string, unknown> }[];
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number };
  readonly groundingSources?: readonly { title?: string; url?: string }[];
}

export interface StreamChunk {
  readonly type: 'text' | 'tool_call' | 'usage' | 'done';
  readonly textDelta?: string;
  readonly toolCall?: { name: string; args: Record<string, unknown> };
  readonly usage?: { inputTokens: number; outputTokens: number };
}

export interface LLMProvider {
  readonly name: string;
  generate(prompt: string, options?: GenerateOptions): Promise<Result<GenerateResult, ProviderError>>;
  stream(prompt: string, options?: GenerateOptions): AsyncIterable<StreamChunk>;
  countTokens(text: string): Promise<number>;
  supportsThinking(): boolean;
  supportsTools(): boolean;
}
