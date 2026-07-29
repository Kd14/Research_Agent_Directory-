import path from 'path';
import { ConfigurationError } from './errors/AppError';
import { Ok, Err, type Result } from './result';

export interface AppConfig {
  readonly port: number;
  readonly host: string;
  readonly nodeEnv: 'development' | 'production';
  readonly dataDir: string;
  readonly sessionsDir: string;
  readonly documentsFile: string;
  readonly llm: {
    readonly provider: 'gemini';
    readonly apiKey: string;
    readonly model: string;
    readonly embeddingModel: string;
    readonly defaultTemperature: number;
    readonly maxOutputTokens: number;
  };
  readonly upload: {
    readonly maxFileSizeBytes: number;
  };
  readonly documents: {
    /** Absolute path to a folder to auto-import from via fs.watch(). Unset by default. */
    readonly watchDir: string | undefined;
  };
  readonly search: {
    readonly rerankEnabled: boolean;
    readonly bm25Weight: number;
    readonly embeddingWeight: number;
  };
  readonly logging: {
    readonly level: 'debug' | 'info' | 'warn' | 'error';
    readonly logPrompts: boolean;
    readonly logDir: string;
  };
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

export function loadConfig(env: NodeJS.ProcessEnv): Result<AppConfig, ConfigurationError> {
  const apiKey = env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return Err(new ConfigurationError('GEMINI_API_KEY is required but was not set in the environment.'));
  }

  const dataDir = env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(process.cwd(), 'data');

  const config: AppConfig = {
    port: parseIntEnv(env.PORT, 3000),
    host: env.HOST || '0.0.0.0',
    nodeEnv: env.NODE_ENV === 'production' ? 'production' : 'development',
    dataDir,
    sessionsDir: path.join(dataDir, 'sessions'),
    documentsFile: path.join(dataDir, 'documents.json'),
    llm: {
      provider: 'gemini',
      apiKey,
      model: env.GEMINI_MODEL || 'gemini-3.6-flash',
      embeddingModel: env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
      defaultTemperature: parseFloatEnv(env.GEMINI_TEMPERATURE, 1.0),
      maxOutputTokens: parseIntEnv(env.GEMINI_MAX_OUTPUT_TOKENS, 8192),
    },
    upload: {
      maxFileSizeBytes: parseIntEnv(env.MAX_UPLOAD_BYTES, 20 * 1024 * 1024),
    },
    documents: {
      watchDir: env.DOCUMENTS_WATCH_DIR ? path.resolve(env.DOCUMENTS_WATCH_DIR) : undefined,
    },
    search: {
      rerankEnabled: parseBoolEnv(env.SEARCH_RERANK_ENABLED, false),
      bm25Weight: parseFloatEnv(env.SEARCH_BM25_WEIGHT, 0.5),
      embeddingWeight: parseFloatEnv(env.SEARCH_EMBEDDING_WEIGHT, 0.5),
    },
    logging: {
      level: (env.LOG_LEVEL as AppConfig['logging']['level']) || 'info',
      logPrompts: parseBoolEnv(env.LOG_PROMPTS, false),
      logDir: path.join(dataDir, 'logs'),
    },
  };

  return Ok(config);
}
