// The people of the scene as class-name sets (the colours are in scene.css).
export interface Look {
  skin: string;
  shirt: string;
  trousers: string;
  hair: 'short' | 'scarf' | 'bun' | 'cap';
  coat?: boolean;
  print?: boolean;
}

export const LOOKS: { residents: readonly [Look, Look, Look, Look]; driver: Look; qc: Look } = {
  residents: [
    { skin: 'sc-skin-1', shirt: 'sc-shirt-1', trousers: 'sc-trousers-1', hair: 'short' },
    { skin: 'sc-skin-2', shirt: 'sc-shirt-2', trousers: 'sc-trousers-2', hair: 'scarf' },
    { skin: 'sc-skin-3', shirt: 'sc-shirt-3', trousers: 'sc-trousers-3', hair: 'bun' },
    { skin: 'sc-skin-4', shirt: 'sc-shirt-4', trousers: 'sc-trousers-1', hair: 'short' },
  ],
  driver: { skin: 'sc-skin-driver', shirt: 'sc-navy-2', trousers: 'sc-trousers-driver', hair: 'cap', print: true },
  qc: { skin: 'sc-skin-qc', shirt: 'sc-white', trousers: 'sc-trousers-1', hair: 'short', coat: true },
};
