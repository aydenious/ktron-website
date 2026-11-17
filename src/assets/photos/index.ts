import type { ImageMetadata } from 'astro';
import hero from './hero.jpg';
import trimming from './trimming.jpg';
import deflashing from './deflashing.jpg';
import inspection from './inspection.jpg';
import sorting from './sorting.jpg';
import quality from './quality.jpg';

export const PHOTO_IDS = ['hero', 'trimming', 'deflashing', 'inspection', 'sorting', 'quality'] as const;
export type PhotoId = (typeof PHOTO_IDS)[number];
export const photos: Record<PhotoId, ImageMetadata> = { hero, trimming, deflashing, inspection, sorting, quality };
/** Where a card crop sits (CSS object-position). A photo taller than 4:3 must have one; the rest centre. */
export const PHOTO_POSITION: Partial<Record<PhotoId, string>> = {};
export const positionOf = (id: PhotoId) => PHOTO_POSITION[id] ?? '50% 50%';
/** The srcset steps a photo can fill: each capped at its real width, duplicates dropped, so no step upscales. */
export const widthsFor = (photo: ImageMetadata, steps: number[]) => [...new Set(steps.map((s) => Math.min(s, photo.width)))];
