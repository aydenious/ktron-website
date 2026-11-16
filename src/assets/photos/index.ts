import type { ImageMetadata } from 'astro';
import hero from './hero.jpg';
import trimming from './trimming.jpg';
import deflashing from './deflashing.jpg';
import inspection from './inspection.jpg';
import sorting from './sorting.jpg';
import rework from './rework.jpg';
import quality from './quality.jpg';

export const PHOTO_IDS = ['hero', 'trimming', 'deflashing', 'inspection', 'sorting', 'rework', 'quality'] as const;
export type PhotoId = (typeof PHOTO_IDS)[number];
export const photos: Record<PhotoId, ImageMetadata> = { hero, trimming, deflashing, inspection, sorting, rework, quality };
/** Where a card crop sits (CSS object-position). A photo taller than 4:3 must have one; the rest centre. */
export const PHOTO_POSITION: Partial<Record<PhotoId, string>> = {
  inspection: '50% 65%', // portrait: keeps the whole objective and the stage with its clamps, drops the empty wall and the eyepiece
};
export const positionOf = (id: PhotoId) => PHOTO_POSITION[id] ?? '50% 50%';
