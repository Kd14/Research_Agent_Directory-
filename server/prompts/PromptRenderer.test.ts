import { describe, expect, it } from 'vitest';
import { loadPrompt, renderPrompt } from './PromptRenderer';

describe('renderPrompt', () => {
  it('substitutes all provided variables', () => {
    const result = renderPrompt('Hello {{name}}, you are {{role}}.', { name: 'Astra', role: 'lead' });
    expect(result).toBe('Hello Astra, you are lead.');
  });

  it('leaves unmatched placeholders untouched', () => {
    const result = renderPrompt('Hello {{name}}, {{missing}}.', { name: 'Astra' });
    expect(result).toBe('Hello Astra, {{missing}}.');
  });

  it('substitutes an empty string variable to produce a blank segment', () => {
    const result = renderPrompt('Line1\n{{feedback}}\nLine3', { feedback: '' });
    expect(result).toBe('Line1\n\nLine3');
  });
});

describe('loadPrompt', () => {
  it('strips the leading version comment from planner.md', () => {
    const template = loadPrompt('planner');
    expect(template.startsWith('<!--')).toBe(false);
    expect(template.startsWith('You are Dr. Astra')).toBe(true);
  });

  it('caches the template on repeated loads', () => {
    const first = loadPrompt('research');
    const second = loadPrompt('research');
    expect(first).toBe(second);
  });

  it('planner.md retains the structural markers the plan JSON schema depends on', () => {
    const template = loadPrompt('planner');
    expect(template).toContain('{{agentRoster}}');
    expect(template).toContain('instructionSet');
    expect(template).toContain('{{userPrompt}}');
  });

  it('research.md retains the structural markers the analysis JSON schema depends on', () => {
    const template = loadPrompt('research');
    expect(template).toContain('thoughtTrace');
    expect(template).toContain('agentOutput');
    expect(template).toContain('keyTakeaways');
  });

  it('synthesis.md retains the report format headings', () => {
    const template = loadPrompt('synthesis');
    expect(template).toContain('## Executive Summary');
    expect(template).toContain('```mermaid');
  });

  it('tool_selection.md retains the single-tool-call instruction', () => {
    const template = loadPrompt('tool_selection');
    expect(template).toContain('Call exactly one of the available tools');
  });
});
