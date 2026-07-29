import { GoogleGenAI } from '@google/genai';
import type { AppConfig } from '../config';
import { ProviderError } from '../errors/AppError';
import { noopLogger, withTiming, type LoggerLike } from '../observability/logger';
import { Err, Ok, type Result } from '../result';
import type { GenerateOptions, GenerateResult, LLMProvider, StreamChunk } from './LLMProvider';

function buildGenerationConfig(config: AppConfig, options: GenerateOptions): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? config.llm.defaultTemperature,
    maxOutputTokens: options.maxOutputTokens ?? config.llm.maxOutputTokens,
  };

  if (options.systemPrompt) {
    generationConfig.systemInstruction = options.systemPrompt;
  }

  if (options.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = options.responseSchema;
  }

  if (options.functionDeclarations?.length) {
    generationConfig.tools = [{ functionDeclarations: options.functionDeclarations }];
  } else if (options.enableWebGrounding) {
    generationConfig.tools = [{ googleSearch: {} }];
  }

  return generationConfig;
}

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenAI;

  constructor(private readonly config: AppConfig, private readonly logger: LoggerLike = noopLogger) {
    this.client = new GoogleGenAI({
      apiKey: config.llm.apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<Result<GenerateResult, ProviderError>> {
    return withTiming(
      this.logger,
      { event: 'llm_generate', provider: this.name },
      () => this.generateInternal(prompt, options),
      value => (value.usage ? { input: value.usage.inputTokens, output: value.usage.outputTokens } : undefined)
    );
  }

  private async generateInternal(prompt: string, options: GenerateOptions): Promise<Result<GenerateResult, ProviderError>> {
    try {
      const response = await this.client.models.generateContent({
        model: this.config.llm.model,
        contents: prompt,
        config: buildGenerationConfig(this.config, options),
      });

      const toolCalls = response.functionCalls
        ?.filter((call) => Boolean(call.name))
        .map((call) => ({ name: call.name as string, args: (call.args ?? {}) as Record<string, unknown> }));

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const groundingSources = groundingChunks.length
        ? groundingChunks.map((chunk) => ({ title: chunk.web?.title, url: chunk.web?.uri }))
        : undefined;

      return Ok({
        text: response.text ?? '',
        toolCalls: toolCalls?.length ? toolCalls : undefined,
        usage: response.usageMetadata
          ? {
              inputTokens: response.usageMetadata.promptTokenCount ?? 0,
              outputTokens: response.usageMetadata.candidatesTokenCount ?? 0,
            }
          : undefined,
        groundingSources,
      });
    } catch (err) {
      return Err(
        new ProviderError(err instanceof Error ? err.message : 'Gemini generate() failed', 'gemini', err)
      );
    }
  }

  async *stream(prompt: string, options: GenerateOptions = {}): AsyncIterable<StreamChunk> {
    const start = Date.now();
    let lastUsage: { inputTokens: number; outputTokens: number } | undefined;

    try {
      const stream = await this.client.models.generateContentStream({
        model: this.config.llm.model,
        contents: prompt,
        config: buildGenerationConfig(this.config, options),
      });

      for await (const chunk of stream) {
        if (options.signal?.aborted) return;

        if (chunk.text) {
          yield { type: 'text', textDelta: chunk.text };
        }

        const call = chunk.functionCalls?.[0];
        if (call?.name) {
          yield {
            type: 'tool_call',
            toolCall: { name: call.name, args: (call.args ?? {}) as Record<string, unknown> },
          };
        }

        if (chunk.usageMetadata) {
          lastUsage = {
            inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
            outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
          };
          yield { type: 'usage', usage: lastUsage };
        }
      }

      yield { type: 'done' };
      this.logger.log({
        level: 'info',
        event: 'llm_stream',
        provider: this.name,
        durationMs: Date.now() - start,
        tokens: lastUsage ? { input: lastUsage.inputTokens, output: lastUsage.outputTokens } : undefined,
      });
    } catch (err) {
      this.logger.log({
        level: 'error',
        event: 'llm_stream',
        provider: this.name,
        durationMs: Date.now() - start,
        error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }
  }

  async countTokens(text: string): Promise<number> {
    const response = await this.client.models.countTokens({
      model: this.config.llm.model,
      contents: text,
    });
    return response.totalTokens ?? 0;
  }

  supportsThinking(): boolean {
    return false;
  }

  supportsTools(): boolean {
    return true;
  }
}
