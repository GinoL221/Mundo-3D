import type { Sequelize } from 'sequelize';
import { createSandboxReleaseCoordinator } from '../SandboxReleaseCoordinatorComposition';
import { CoordinateSandboxRelease } from '../CoordinateSandboxRelease';

function connectionStub(): { connection: Sequelize; define: jest.Mock } {
  const define = jest.fn(() => ({ modelName: 'stub' }));
  return { connection: { define } as unknown as Sequelize, define };
}

describe('createSandboxReleaseCoordinator', () => {
  it('wires a coordinator over the supplied connection without touching storage', () => {
    const { connection, define } = connectionStub();
    const coordinator = createSandboxReleaseCoordinator({
      connection,
      slotId: 'slot-a',
      controlSchema: 'control',
      slotSchema: 'slot',
    });
    expect(coordinator).toBeInstanceOf(CoordinateSandboxRelease);
    // Only model definitions happen at composition time; no queries.
    expect(define).toHaveBeenCalledTimes(2);
    expect((connection as unknown as { query?: unknown }).query).toBeUndefined();
  });

  it.each([
    ['a control schema with a backtick', 'con`trol', 'slot'],
    ['a slot schema with a dot', 'slot', 'slot.db'],
    ['an empty schema', '', 'slot'],
    ['an over-long schema', 'slot', 'a'.repeat(65)],
  ])('refuses %s', (_label, controlSchema, slotSchema) => {
    const { connection } = connectionStub();
    expect(() =>
      createSandboxReleaseCoordinator({
        connection,
        slotId: 'slot-a',
        controlSchema,
        slotSchema,
      }),
    ).toThrow('Sandbox release schemas must be plain identifiers');
  });
});
