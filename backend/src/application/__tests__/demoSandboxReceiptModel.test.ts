import { ReceiptModel } from './support/demoSandboxReceiptModel';

const identity = { slot: 'slot-a', generation: 4, attempt: 'attempt-a', version: 'seed-v1' };

describe('reset receipt reference model', () => {
  it('rejects a duplicate successful attempt before performing reset effects', () => {
    const model = new ReceiptModel(identity);
    expect(model.reset(identity)).toBe(true);
    expect(model.reset(identity)).toBe(false);
    expect(model.effects()).toBe(1);
  });

  it('releases only for an exact unconsumed receipt and never consumes mismatches', () => {
    const model = new ReceiptModel(identity);
    expect(model.reset(identity)).toBe(true);
    for (const mismatch of [
      { ...identity, slot: 'slot-b' },
      { ...identity, generation: 5 },
      { ...identity, attempt: 'attempt-b' },
      { ...identity, version: 'seed-v2' },
    ]) {
      expect(model.release(mismatch)).toBe(false);
    }
    expect(model.release(identity)).toBe(true);
    expect(model.release(identity)).toBe(false);
    expect(model.effects()).toBe(1);
  });

  it('rejects reset or release for an incorrect identity before any effects', () => {
    const model = new ReceiptModel(identity);
    expect(model.reset({ ...identity, attempt: 'attempt-old' })).toBe(false);
    expect(model.release(identity)).toBe(false);
    expect(model.effects()).toBe(0);
  });
});
