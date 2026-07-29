import { describe, expect, it } from 'vitest';
import synthesisEngineTool from './synthesisEngine.tool';

describe('synthesisEngineTool', () => {
  it('is excluded from Gemini function-calling', () => {
    expect(synthesisEngineTool.supportsFunctionCalling).toBe(false);
  });

  it('returns the pre-refactor stub shape', async () => {
    const args = { sections: [], citations: [] };
    const result = await synthesisEngineTool.execute(args, undefined as any);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ status: 'executed', tool: 'mcp_synthesis_engine', args });
    }
  });
});
