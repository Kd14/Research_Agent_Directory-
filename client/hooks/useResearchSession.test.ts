// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../services/api';
import { useResearchSession } from './useResearchSession';
import type { ResearchSession } from '../types';

function makeSession(stepCount: number): ResearchSession {
  return {
    id: 'session_test',
    title: 'Test Session',
    userPrompt: 'test prompt',
    selectedDocIds: [],
    executionMode: 'auto',
    currentStepIndex: 0,
    instructionSet: Array.from({ length: stepCount }, (_, i) => ({
      id: `step_${i + 1}`,
      stepNumber: i + 1,
      assignedAgentId: 'literature',
      agentName: 'Agent Hypatia',
      title: `Step ${i + 1}`,
      instruction: `Do thing ${i + 1}`,
      requiredTools: [],
      status: 'pending' as const
    })),
    status: 'planning',
    logs: [],
    agents: {
      literature: {
        id: 'literature',
        role: 'literature',
        name: 'Agent Hypatia',
        title: 'Literature & Theory Researcher',
        avatar: '',
        description: '',
        status: 'idle',
        progress: 0,
        thoughtTrace: [],
        toolsAccess: []
      },
      synthesis: {
        id: 'synthesis',
        role: 'synthesis',
        name: 'Agent Nexus',
        title: 'Report Synthesis',
        avatar: '',
        description: '',
        status: 'idle',
        progress: 0,
        thoughtTrace: [],
        toolsAccess: []
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useResearchSession', () => {
  it('starts a plan and populates the session', async () => {
    const session = makeSession(1);
    vi.spyOn(api, 'planResearch').mockResolvedValue({ success: true, session });
    // The automatic step-execution effect fires as soon as the plan succeeds; keep it
    // pending so it can't race the assertions below with an unmocked (failing) fetch.
    vi.spyOn(api, 'executeResearchStep').mockReturnValue(new Promise(() => {}));

    const onReportReady = vi.fn();
    const { result } = renderHook(() => useResearchSession([], ['literature'], onReportReady));

    await act(async () => {
      await result.current.startResearch('test prompt');
    });

    expect(result.current.session?.id).toBe('session_test');
    expect(result.current.isExecuting).toBe(true);
    expect(result.current.isPaused).toBe(false);
  });

  it('advances currentStepIndex after a successful step and triggers synthesis exactly once after the last step', async () => {
    const session = makeSession(1);
    vi.spyOn(api, 'planResearch').mockResolvedValue({ success: true, session });
    vi.spyOn(api, 'executeResearchStep').mockResolvedValue({
      success: true,
      thoughtTrace: ['thinking'],
      toolCallUsed: null,
      toolArgs: {},
      toolResult: null,
      agentOutput: 'Findings here.',
      keyTakeaways: ['takeaway']
    });
    const synthesizeSpy = vi.spyOn(api, 'synthesizeReport').mockResolvedValue({
      success: true,
      report: '# Final Report'
    });

    const onReportReady = vi.fn();
    const { result } = renderHook(() => useResearchSession([], ['literature'], onReportReady));

    await act(async () => {
      await result.current.startResearch('test prompt');
    });

    // Step executes automatically via the effect; wait for it to advance past the single step.
    await waitFor(() => expect(result.current.currentStepIndex).toBe(1), { timeout: 3000 });

    // currentStepIndex >= steps.length triggers synthesis exactly once.
    await waitFor(() => expect(synthesizeSpy).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await waitFor(() => expect(result.current.session?.finalReport).toBe('# Final Report'));
    expect(onReportReady).toHaveBeenCalledTimes(1);
    expect(result.current.isExecuting).toBe(false);
  });

  it('stops and pauses on step failure without advancing the step index', async () => {
    const session = makeSession(2);
    vi.spyOn(api, 'planResearch').mockResolvedValue({ success: true, session });
    vi.spyOn(api, 'executeResearchStep').mockResolvedValue({
      success: false,
      error: 'tool exploded'
    });

    const onReportReady = vi.fn();
    const { result } = renderHook(() => useResearchSession([], ['literature'], onReportReady));

    await act(async () => {
      await result.current.startResearch('test prompt');
    });

    await waitFor(() => expect(result.current.errorMessage).toBe('tool exploded'));
    expect(result.current.isPaused).toBe(true);
    expect(result.current.currentStepIndex).toBe(0);
  });
});
