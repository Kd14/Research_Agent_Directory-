import { Router } from 'express';
import type { AppConfig } from '../config';
import type { ResearchPipeline } from '../orchestration/ResearchPipeline';
import type { DocumentService } from '../services/DocumentService';
import type { ResearchService } from '../services/ResearchService';
import type { SessionService } from '../services/SessionService';
import type { ToolService } from '../services/ToolService';
import { createDocumentsRouter } from './documents.routes';
import { createHealthRouter } from './health.routes';
import { createMcpRouter } from './mcp.routes';
import { createResearchRouter } from './research.routes';
import { createSessionsRouter } from './sessions.routes';

export interface ApiRouterDeps {
  readonly config: AppConfig;
  readonly documentService: DocumentService;
  readonly toolService: ToolService;
  readonly researchService: ResearchService;
  readonly sessionService: SessionService;
  readonly researchPipeline: ResearchPipeline;
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();

  router.use(createHealthRouter(deps.config, deps.documentService));
  router.use(createDocumentsRouter(deps.config, deps.documentService));
  router.use(createMcpRouter(deps.toolService));
  router.use(createResearchRouter(deps.researchService, deps.researchPipeline));
  router.use(createSessionsRouter(deps.sessionService));

  return router;
}
