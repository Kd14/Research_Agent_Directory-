import docSearchTool from './docSearch.tool';
import webGroundingTool from './webGrounding.tool';
import specAnalyzerTool from './specAnalyzer.tool';
import hypothesisTesterTool from './hypothesisTester.tool';
import synthesisEngineTool from './synthesisEngine.tool';
import pdfReportGeneratorTool from './pdfReportGenerator.tool';
import { ToolExecutor, ToolRegistry } from './types';

export * from './types';

// Statically imported (rather than filesystem-glob "discovered") because the production build
// bundles server/index.ts into a single CJS file via esbuild, which cannot resolve dynamic
// `import()` calls against .ts source paths at runtime. For this tool count, static registration
// is simpler than shipping a parallel dynamic-loader path just for dev.
export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(docSearchTool);
  registry.register(webGroundingTool);
  registry.register(specAnalyzerTool);
  registry.register(hypothesisTesterTool);
  registry.register(synthesisEngineTool);
  registry.register(pdfReportGeneratorTool);
  return registry;
}

export function createToolExecutor(registry: ToolRegistry = createToolRegistry()): ToolExecutor {
  return new ToolExecutor(registry);
}
