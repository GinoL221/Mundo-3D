import { FenceModel } from './support/demoSandboxFenceModel';

describe('sandbox storage fencing reference model', () => {
  it('waits for an admitted transaction before fencing and resetting', () => {
    const model = new FenceModel();
    const operation = model.begin('lease-1', 0);
    expect(operation).not.toBeNull();
    expect(model.fence('reset-1')).toBe(false);
    expect(model.write(operation!, 'old')).toBe(true);
    model.finish(operation!);
    expect(model.fence('reset-1')).toBe(true);
    expect(model.begin('lease-1', 0)).toBeNull();
    expect(model.reset('reset-1')).toBe(true);
    expect(model.activate('reset-1', 'lease-2', 1)).toBe(true);
    expect(model.values()).toEqual([]);
  });

  it('rejects a paused old operation after reset and reallocation', () => {
    const model = new FenceModel();
    expect(model.fence('reset-1')).toBe(true);
    expect(model.reset('reset-1')).toBe(true);
    expect(model.activate('reset-1', 'lease-2', 1)).toBe(true);
    expect(model.begin('lease-1', 0)).toBeNull();
    expect(model.values()).toEqual([]);
    expect(model.begin('lease-2', 1)).not.toBeNull();
  });

  it('keeps a crashed reset closed and rejects the stale reset attempt', () => {
    const model = new FenceModel();
    expect(model.fence('reset-1')).toBe(true);
    expect(model.recover('reset-1', 'reset-2', false)).toBe(false);
    expect(model.begin('lease-1', 0)).toBeNull();
    expect(model.recover('reset-1', 'reset-2', true)).toBe(true);
    expect(model.reset('reset-1')).toBe(false);
    expect(model.activate('reset-1', 'lease-2', 1)).toBe(false);
    expect(model.begin('lease-2', 1)).toBeNull();
    expect(model.reset('reset-2')).toBe(true);
    expect(model.activate('reset-2', 'lease-2', 1)).toBe(true);
  });

  it('rejects reused reset attempts and lease identities across generations', () => {
    const model = new FenceModel();
    expect(model.fence('reset-1')).toBe(true);
    expect(model.recover('reset-1', 'reset-2', true)).toBe(true);
    expect(model.recover('reset-2', 'reset-1', true)).toBe(false);
    expect(model.reset('reset-1')).toBe(false);
    expect(model.reset('reset-2')).toBe(true);
    expect(model.activate('reset-2', 'lease-1', 1)).toBe(false);
    expect(model.activate('reset-2', 'lease-2', 1)).toBe(true);
    expect(model.fence('reset-1')).toBe(false);
    expect(model.fence('reset-3')).toBe(true);
    expect(model.reset('reset-3')).toBe(true);
    expect(model.activate('reset-3', 'lease-1', 2)).toBe(false);
  });

  it('does not activate without successful reset verification or matching generation', () => {
    const model = new FenceModel();
    expect(model.fence('reset-1')).toBe(true);
    expect(model.activate('reset-1', 'lease-2', 1)).toBe(false);
    expect(model.reset('reset-1')).toBe(true);
    expect(model.activate('reset-1', 'lease-2', 2)).toBe(false);
    expect(model.begin('lease-2', 1)).toBeNull();
  });
});
