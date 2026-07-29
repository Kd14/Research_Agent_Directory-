import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('returns a ConfigurationError when GEMINI_API_KEY is missing', () => {
    const result = loadConfig({} as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIGURATION_ERROR');
    }
  });

  it('builds a config with defaults when only the API key is set', () => {
    const result = loadConfig({ GEMINI_API_KEY: 'test-key' } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.port).toBe(3000);
      expect(result.value.llm.apiKey).toBe('test-key');
      expect(result.value.llm.model).toBe('gemini-3.6-flash');
      expect(result.value.sessionsDir.endsWith('data/sessions')).toBe(true);
    }
  });

  it('honors env overrides', () => {
    const result = loadConfig({
      GEMINI_API_KEY: 'test-key',
      PORT: '4000',
      GEMINI_MODEL: 'gemini-custom',
      LOG_PROMPTS: 'true',
    } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.port).toBe(4000);
      expect(result.value.llm.model).toBe('gemini-custom');
      expect(result.value.logging.logPrompts).toBe(true);
    }
  });
});
