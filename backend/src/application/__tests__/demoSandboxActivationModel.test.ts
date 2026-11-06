import { ActivationModel } from './support/demoSandboxActivationModel';

describe('cross-plane activation reference model', () => {
  it.each([0, 1, 2, 3, 4])('fails closed on interruption after step %i', (step) => {
    const model = new ActivationModel();
    const steps = [
      () => model.reserve('lease-1'),
      () => model.prepare('lease-1'),
      () => model.publish('lease-1'),
      () => model.open('lease-1'),
    ];
    for (let i = 0; i < step; i += 1) expect(steps[i]()).toBe(true);
    model.interrupt();
    expect(model.reserve('lease-2')).toBe(false);
    expect(model.admit('lease-2')).toBe(false);
    expect(model.admit('lease-1')).toBe(false);
    expect(model.prepare('lease-1')).toBe(false);
    expect(model.publish('lease-1')).toBe(false);
    expect(model.open('lease-1')).toBe(false);
    expect(model.reconcile(false)).toBe(false);
    expect(model.reserve('lease-2')).toBe(false);
    expect(model.reconcile(true)).toBe(true);
    expect(model.admit('lease-1')).toBe(false);
    expect(model.prepare('lease-1')).toBe(false);
    expect(model.publish('lease-1')).toBe(false);
    expect(model.open('lease-1')).toBe(false);
    expect(model.reserve('lease-2')).toBe(false);
  });

  it('requires matching identity and ordered preparation before admission', () => {
    const model = new ActivationModel();
    expect(model.reserve('lease-1')).toBe(true);
    expect(model.prepare('lease-2')).toBe(false);
    expect(model.publish('lease-1')).toBe(false);
    expect(model.open('lease-1')).toBe(false);
    expect(model.prepare('lease-1')).toBe(true);
    expect(model.publish('lease-1')).toBe(true);
    expect(model.admit('lease-1')).toBe(false);
    expect(model.open('lease-1')).toBe(true);
    expect(model.admit('lease-1')).toBe(true);
    expect(model.admit('lease-2')).toBe(false);
  });
});
