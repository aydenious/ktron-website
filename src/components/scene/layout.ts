// Where things stand in the "How it works" world (1040 × 400; the view shows 800 of it).
// Spec: docs/plans/2026-11-17-how-it-works-animation-design.md §4.

export const WORLD_W = 1040;
export const VIEW_W = 800;
export const VIEW_H = 400;
export const STEPS = 5;

/** The van's wheels stand on this line. */
export const ROAD_Y = 344;
/** People's feet on the pavement in front of the buildings. */
export const WALK_Y = 316;

/** The van's stop at the factory dock, in both directions. */
export const FACTORY_X = 270;
export const HOUSE_X = [350, 470, 590, 710] as const;
/** The van's stop at each house: its nose ends just short of the door. */
export const STOP_X = HOUSE_X.map((x) => x - 40);
export const INSPECT_X = 880;

/** The driver's marks at the factory. */
export const DOCK_X = 196; // just right of the crate stack on the dock
export const LOAD_X = 226; // at the van's left end, under the roof rack, whichever way the van faces
export const FRONT_X = 190; // in front of the factory between the stack and the van, where the story ends
/** The cab door: the van's nose end, so it moves with the facing. */
export const cabX = (facing: 1 | -1) => FACTORY_X + 38 * facing;

/** Crate k's top-left corner on the factory dock (crates are 20 × 13). */
export const DOCK_SLOTS: readonly (readonly [x: number, y: number])[] = [[132, 281], [154, 281], [143, 268], [143, 255]];

/** The roller door's top edge: it rolls up into the fascia. */
export const ROLLER_TOP = 236;

/** A resident walks from the doorway to the kerb beside the van. */
export const DOOR = { dx: 17, y: 300 } as const;
export const KERB = { dx: 36, y: 312 } as const;
export const KERB_PATH = Math.hypot(KERB.dx - DOOR.dx, KERB.y - DOOR.y);
/** A house door's hinge, from the house centre (the door spans dx 4–30). */
export const HINGE_DX = 4;

/** The view follows the van, keeping it at least 60 units from either edge. */
export const camera = (vanX: number) => Math.min(Math.max(vanX - VIEW_W / 2, 0), WORLD_W - VIEW_W);
