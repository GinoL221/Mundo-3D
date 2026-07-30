import { isReady, markReady, markUnready } from '../readinessState';

describe('readinessState', () => {
  it('defaults isReady() to false', () => {
    expect(isReady()).toBe(false);
  });

  it('flips isReady() to true after markReady()', () => {
    markReady();

    expect(isReady()).toBe(true);
  });

  it('flips isReady() to false after markUnready()', () => {
    markReady();

    markUnready();

    expect(isReady()).toBe(false);
  });
});
