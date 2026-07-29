import { describe, expect, it, vi } from 'vitest';
import { ProgressEmitter } from './ProgressEmitter';

describe('ProgressEmitter', () => {
  it('emits a well-formed event with a timestamp', () => {
    const listener = vi.fn();
    const emitter = new ProgressEmitter(listener);

    emitter.emit('planning', 'Decomposing...');

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0];
    expect(event.phase).toBe('planning');
    expect(event.message).toBe('Decomposing...');
    expect(typeof event.timestamp).toBe('string');
  });

  it('includes stepIndex/stepTitle when provided', () => {
    const listener = vi.fn();
    const emitter = new ProgressEmitter(listener);

    emitter.emit('running_tools', 'Running step 1', { stepIndex: 0, stepTitle: 'Step 1' });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'running_tools', stepIndex: 0, stepTitle: 'Step 1' })
    );
  });
});
