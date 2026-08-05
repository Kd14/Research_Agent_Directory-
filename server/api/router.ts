import { Router } from 'express';
import type { AppConfig } from '../config';
import type { ResearchPipeline } from '../orchestration/ResearchPipeline';
import type { DocumentService } from '../services/DocumentService';
import type { MemoryService } from '../services/MemoryService';
import type { SessionService } from '../services/SessionService';
import type { ToolService } from '../services/ToolService';
import { createDocumentConverterRouter } from './documentConverter.routes';
import { createDocumentsRouter } from './documents.routes';
import { createHealthRouter } from './health.routes';
import { createMcpRouter } from './mcp.routes';
import { createPreferencesRouter } from './preferences.routes';
import { createResearchRouter } from './research.routes';
import { createSessionsRouter } from './sessions.routes';

export interface ApiRouterDeps {
  readonly config: AppConfig;
  readonly documentService: DocumentService;
  readonly toolService: ToolService;
  readonly sessionService: SessionService;
  readonly researchPipeline: ResearchPipeline;
  readonly memoryService: MemoryService;
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();

  router.use(createHealthRouter(deps.config, deps.documentService));
  router.use(createDocumentsRouter(deps.config, deps.documentService));
  router.use(createMcpRouter(deps.toolService));
  router.use(createDocumentConverterRouter(deps.toolService));
  router.use(createResearchRouter(deps.researchPipeline));
  router.use(createSessionsRouter(deps.sessionService));
  router.use(createPreferencesRouter(deps.memoryService));

  return router;
}
