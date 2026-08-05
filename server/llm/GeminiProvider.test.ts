import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config';

const generateContentMock = vi.fn();
const countTokensMock = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: generateContentMock,
      countTokens: countTokensMock,
    },
  })),
}));

const { GeminiProvider } = await import('./GeminiProvider');

const testConfig: AppConfig = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'development',
  dataDir: '/tmp/data',
  sessionsDir: '/tmp/data/sessions',
  documentsFile: '/tmp/data/documents.json',
  llm: {
    provider: 'gemini',
    apiKey: 'test-key',
    model: 'gemini-3.6-flash',
    embeddingModel: 'text-embedding-004',
    defaultTemperature: 1,
    maxOutputTokens: 8192,
  },
  upload: { maxFileSizeBytes: 20 * 1024 * 1024 },
  documents: { watchDir: undefined },
  search: { rerankEnabled: false, bm25Weight: 0.5, embeddingWeight: 0.5 },
  logging: { level: 'info', logPrompts: false, logDir: '/tmp/data/logs' },
  reflection: { enabled: true, maxIterations: 2, confidenceThreshold: 0.6 },
  memory: { researchCacheTtlMs: 86400000 },
  standby: { pollIntervalMs: 15000, maxWaitMs: 0 },
};

describe('GeminiProvider.generate', () => {
  it('maps a successful SDK response to GenerateResult', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: 'hello world',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });

    const provider = new GeminiProvider(testConfig);
    const result = await provider.generate('say hello');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toBe('hello world');
      expect(result.value.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    }
  });

  it('maps function calls into toolCalls', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: '',
      functionCalls: [{ name: 'mcp_doc_search', args: { query: 'insulin' } }],
    });

    const provider = new GeminiProvider(testConfig);
    const result = await provider.generate('pick a tool', {
      functionDeclarations: [{ name: 'mcp_doc_search', description: 'search', parameters: {} }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toolCalls).toEqual([{ name: 'mcp_doc_search', args: { query: 'insulin' } }]);
    }
  });

  it('returns Err(ProviderError) when the SDK throws', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('network down'));

    const provider = new GeminiProvider(testConfig);
    const result = await provider.generate('say hello');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_ERROR');
      expect(result.error.provider).toBe('gemini');
    }
  });
});

describe('GeminiProvider.countTokens', () => {
  it('returns totalTokens from the SDK response', async () => {
    countTokensMock.mockResolvedValueOnce({ totalTokens: 42 });
    const provider = new GeminiProvider(testConfig);
    await expect(provider.countTokens('some text')).resolves.toBe(42);
  });
});
