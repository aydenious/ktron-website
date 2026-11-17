// The people of the scene as class-name sets (the colours are in scene.css).
export interface Look {
  /** Names the symbols drawn for this person (`scene-torso-<id>`, …). */
  id: string;
  skin: string;
  shirt: string;
  trousers: string;
  hair: 'short' | 'scarf' | 'bun' | 'cap';
  coat?: boolean;
  print?: boolean;
}

export const LOOKS: { residents: readonly [Look, Look, Look, Look]; driver: Look; qc: Look } = {
  residents: [
    { id: 'r0', skin: 'sc-skin-1', shirt: 'sc-shirt-1', trousers: 'sc-trousers-1', hair: 'short' },
    { id: 'r1', skin: 'sc-skin-2', shirt: 'sc-shirt-2', trousers: 'sc-trousers-2', hair: 'scarf' },
    { id: 'r2', skin: 'sc-skin-3', shirt: 'sc-shirt-3', trousers: 'sc-trousers-3', hair: 'bun' },
    { id: 'r3', skin: 'sc-skin-4', shirt: 'sc-shirt-4', trousers: 'sc-trousers-1', hair: 'short' },
  ],
  driver: { id: 'driver', skin: 'sc-skin-driver', shirt: 'sc-navy-2', trousers: 'sc-trousers-driver', hair: 'cap', print: true },
  qc: { id: 'qc', skin: 'sc-skin-qc', shirt: 'sc-white', trousers: 'sc-trousers-1', hair: 'short', coat: true },
};
