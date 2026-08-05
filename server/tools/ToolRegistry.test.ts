import { describe, expect, it } from 'vitest';
import { createToolRegistry, createToolExecutor } from './index';

describe('createToolRegistry', () => {
  it('registers all 10 tools', () => {
    const registry = createToolRegistry();
    const names = registry.list().map(t => t.name).sort();
    expect(names).toEqual([
      'mcp_doc_search',
      'mcp_docx_report_generator',
      'mcp_document_pdf_converter',
      'mcp_html_report_exporter',
      'mcp_hypothesis_tester',
      'mcp_pdf_report_generator',
      'mcp_presentation_outline_generator',
      'mcp_spec_analyzer',
      'mcp_synthesis_engine',
      'mcp_web_grounding'
    ].sort());
  });

  it('excludes the non-function-calling report-engine tools from function declarations', () => {
    const registry = createToolRegistry();
    const declarations = registry.toFunctionDeclarations();
    const names = declarations.map(d => d.name);
    expect(names).not.toContain('mcp_synthesis_engine');
    expect(names).not.toContain('mcp_pdf_report_generator');
    expect(names).not.toContain('mcp_document_pdf_converter');
    expect(names).not.toContain('mcp_html_report_exporter');
    expect(names).not.toContain('mcp_docx_report_generator');
    expect(names).not.toContain('mcp_presentation_outline_generator');
    expect(names).toContain('mcp_doc_search');
  });
});

describe('createToolExecutor', () => {
  it('returns a ToolError for an unknown tool name', async () => {
    const executor = createToolExecutor();
    const result = await executor.run('mcp_does_not_exist', {}, undefined as any);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TOOL_ERROR');
    }
  });

  it('runs a real tool through validate + execute', async () => {
    const executor = createToolExecutor();
    const result = await executor.run(
      'mcp_spec_analyzer',
      { paramCountBillion: 70 },
      { documents: [], llmProvider: {} as any }
    );
    expect(result.ok).toBe(true);
  });
});
