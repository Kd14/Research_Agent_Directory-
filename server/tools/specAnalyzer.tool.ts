import { Type } from '@google/genai';
import { ToolError, ValidationError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import type { ToolDefinition } from './types';

interface SpecAnalyzerArgs {
  readonly batchSize: number;
  readonly seqLen: number;
  readonly paramCountBillion: number;
  readonly precision: string;
}

function isProvidedAndNotNumber(value: unknown): boolean {
  return value !== undefined && typeof value !== 'number' && typeof value !== 'string';
}

const specAnalyzerTool: ToolDefinition<SpecAnalyzerArgs, unknown> = {
  name: 'mcp_spec_analyzer',
  description: 'Computes VRAM memory budget, KV-cache size, and throughput estimates for a given model/workload configuration.',
  category: 'Compute & Spec',
  parameters: {
    type: Type.OBJECT,
    properties: {
      batchSize: { type: Type.NUMBER, description: 'Inference batch size.' },
      seqLen: { type: Type.NUMBER, description: 'Sequence/context length in tokens.' },
      paramCountBillion: { type: Type.NUMBER, description: 'Model parameter count in billions.' },
      precision: { type: Type.STRING, description: 'Numeric precision, e.g. FP8 or FP16.' }
    },
    required: ['paramCountBillion']
  },
  examples: [
    {
      input: { batchSize: 1, seqLen: 128000, paramCountBillion: 70, precision: 'FP8' },
      output: { estimatedTotalVRAM_GB: '...', recommendedH100GPUs: 2 },
      description: 'Estimate VRAM and GPU count needed for a 70B model at 128K context.'
    }
  ],

  validate(args: unknown): Result<SpecAnalyzerArgs, ValidationError> {
    const a = (args ?? {}) as Record<string, unknown>;
    if (
      isProvidedAndNotNumber(a.batchSize) ||
      isProvidedAndNotNumber(a.seqLen) ||
      isProvidedAndNotNumber(a.paramCountBillion)
    ) {
      return Err(new ValidationError('mcp_spec_analyzer: numeric fields must be numbers if provided'));
    }
    if (a.precision !== undefined && typeof a.precision !== 'string') {
      return Err(new ValidationError('mcp_spec_analyzer: "precision" must be a string if provided'));
    }
    return Ok({
      batchSize: Number(a.batchSize) || 1,
      seqLen: Number(a.seqLen) || 128000,
      paramCountBillion: Number(a.paramCountBillion) || 70,
      precision: (a.precision as string) || 'FP8'
    });
  },

  async execute(args: SpecAnalyzerArgs): Promise<Result<unknown, ToolError>> {
    const { batchSize, seqLen, paramCountBillion: paramBillion, precision } = args;

    const bytesPerParam = precision === 'FP8' ? 1 : 2;
    const weightsGB = paramBillion * bytesPerParam;
    const kvCachePerTokenMB = (2 * 64 * 8192 * (precision === 'FP8' ? 1 : 2)) / (1024 * 1024); // approx
    const kvCacheTotalGB = (batchSize * seqLen * kvCachePerTokenMB) / 1024;
    const totalVRAMReqGB = weightsGB + kvCacheTotalGB * 1.25; // plus activation memory

    return Ok({
      parametersBillion: paramBillion,
      sequenceLength: seqLen,
      precision,
      modelWeightsVRAM_GB: weightsGB.toFixed(2),
      kvCacheVRAM_GB: kvCacheTotalGB.toFixed(2),
      estimatedTotalVRAM_GB: totalVRAMReqGB.toFixed(2),
      recommendedH100GPUs: Math.ceil(totalVRAMReqGB / 70),
      throughputTFLOPS: precision === 'FP8' ? 1280 : 840
    });
  }
};

export default specAnalyzerTool;
