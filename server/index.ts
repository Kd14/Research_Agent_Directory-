import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './api/router';
import { errorMiddleware } from './api/middleware/errorHandler';
import { loadConfig } from './config';
import { GeminiProvider } from './llm/GeminiProvider';
import { FileLogger } from './observability/logger';
import { ResearchPipeline } from './orchestration/ResearchPipeline';
import { EmbeddingCache, GeminiEmbeddingProvider } from './search/embeddings';
import { LLMReranker } from './search/rerank';
import { SearchIndexService } from './search/SearchIndexService';
import { DocumentService } from './services/DocumentService';
import { ExecutionService } from './services/ExecutionService';
import { PlannerService } from './services/PlannerService';
import { ResearchService } from './services/ResearchService';
import { SessionService } from './services/SessionService';
import { ToolService } from './services/ToolService';
import { DocumentStore } from './storage/DocumentStore';
import { SessionStore } from './storage/SessionStore';
import { watchDocumentsDirectory } from './storage/watchDocuments';
import { createToolExecutor, createToolRegistry } from './tools';

async function startServer() {
  const configResult = loadConfig(process.env);
  if (!configResult.ok) {
    console.error(`Configuration error: ${configResult.error.message}`);
    process.exit(1);
  }
  const config = configResult.value;

  const documentStore = new DocumentStore(config.documentsFile, config.dataDir);
  const sessionStore = new SessionStore(config.sessionsDir);
  const logger = new FileLogger(config.logging.logDir);
  const geminiProvider = new GeminiProvider(config, logger);
  const toolRegistry = createToolRegistry();
  const toolExecutor = createToolExecutor(toolRegistry);

  const documentService = new DocumentService(documentStore);
  if (config.documents.watchDir) {
    watchDocumentsDirectory(config.documents.watchDir, documentService);
  }
  const sessionService = new SessionService(sessionStore);

  // Graceful degradation: search stays BM25-only (no network call) if no embedding provider is
  // available. In this app's config, GEMINI_API_KEY is always present by the time we reach here
  // (loadConfig fails fast otherwise), so this branch is exercised by SearchIndexService's own
  // unit tests rather than a live no-key run.
  const embeddingProvider = config.llm.apiKey ? new GeminiEmbeddingProvider(config) : undefined;
  const embeddingCache = config.llm.apiKey ? new EmbeddingCache(path.join(config.dataDir, 'index', 'embeddings.json')) : undefined;
  const reranker = config.search.rerankEnabled ? new LLMReranker(geminiProvider) : undefined;
  const searchIndexService = new SearchIndexService(config, documentService, embeddingProvider, embeddingCache, reranker);

  const toolService = new ToolService(toolRegistry, toolExecutor, documentService, geminiProvider, logger, searchIndexService);
  const plannerService = new PlannerService(geminiProvider, documentService);
  const executionService = new ExecutionService(geminiProvider, toolService, documentService);
  const researchService = new ResearchService(plannerService, executionService, sessionService);
  const researchPipeline = new ResearchPipeline(plannerService, executionService, sessionService, geminiProvider);

  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Serve public static files (e.g. zip downloads)
  app.use(express.static(path.join(process.cwd(), 'public')));

  app.use(createApiRouter({ config, documentService, toolService, researchService, sessionService, researchPipeline }));

  // --- VITE MIDDLEWARE SETUP ---
  if (config.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use(errorMiddleware);

  app.listen(config.port, config.host, () => {
    console.log(`NexusAgent Server running on http://${config.host}:${config.port}`);
  });
}

startServer();
