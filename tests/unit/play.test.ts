import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('gsap', () => ({ gsap: { timeline: vi.fn() } }));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: { create: vi.fn(() => ({})), addEventListener: vi.fn() } }));

afterEach(() => vi.unstubAllGlobals());

describe('the on-screen observer (play.ts)', () => {
  it('goes by the last entry of a batch: a stage that left and came back, or came back and left, ends as the newest entry says', async () => {
    let notify!: (entries: { isIntersecting: boolean }[]) => void;
    vi.stubGlobal('IntersectionObserver', class { constructor(cb: typeof notify) { notify = cb; } observe() {} });
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('document', { documentElement: { style: {} } });
    const calls: [string, boolean][] = [];
    const stage = { querySelector: () => ({}), toggleAttribute: (name: string, on: boolean) => calls.push([name, on]) };
    const { play } = await import('../../src/components/scene/play');
    play({ section: {} as HTMLElement, stage: stage as unknown as HTMLElement, words: [], paint: vi.fn(), header: () => 0 });
    notify([{ isIntersecting: false }, { isIntersecting: true }]);
    notify([{ isIntersecting: true }, { isIntersecting: false }]);
    expect(calls).toEqual([['data-playing', true], ['data-playing', false]]);
  });
});
