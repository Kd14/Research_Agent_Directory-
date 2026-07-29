import { describe, expect, it } from 'vitest';
import specAnalyzerTool from './specAnalyzer.tool';

describe('specAnalyzerTool.validate', () => {
  it('rejects a paramCountBillion of the wrong type', () => {
    const result = specAnalyzerTool.validate({ paramCountBillion: { billions: 70 } });
    expect(result.ok).toBe(false);
  });

  it('tolerates a numeric string, matching the pre-refactor Number() coercion', () => {
    const result = specAnalyzerTool.validate({ paramCountBillion: '70' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.paramCountBillion).toBe(70);
    }
  });

  it('defaults missing fields', () => {
    const result = specAnalyzerTool.validate({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.paramCountBillion).toBe(70);
      expect(result.value.precision).toBe('FP8');
    }
  });
});

describe('specAnalyzerTool.execute', () => {
  it('computes VRAM estimates deterministically', async () => {
    const result = await specAnalyzerTool.execute(
      { batchSize: 1, seqLen: 128000, paramCountBillion: 70, precision: 'FP8' },
      undefined as any
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value = result.value as { recommendedH100GPUs: number };
      expect(value.recommendedH100GPUs).toBeGreaterThan(0);
    }
  });
});
