import { describe, expect, it, vi } from 'vitest';
import { refreshWhenFontsSettle } from '../../src/components/scene/fonts';

describe('positions are measured again once the fonts have loaded', () => {
  it('refreshes once, after fonts.ready, when the fonts were still loading', async () => {
    let release!: () => void;
    const ready = new Promise<void>((r) => { release = r; });
    const refresh = vi.fn();
    refreshWhenFontsSettle({ status: 'loading', ready }, refresh);
    expect(refresh).not.toHaveBeenCalled();
    release();
    await ready;
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('does nothing when the fonts had already loaded (the first measure was right)', async () => {
    const refresh = vi.fn();
    refreshWhenFontsSettle({ status: 'loaded', ready: Promise.resolve() }, refresh);
    await Promise.resolve();
    expect(refresh).not.toHaveBeenCalled();
  });
});
