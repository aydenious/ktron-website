export const SITE_URL = 'https://ktron.my';

export const ADDRESS = {
  street: 'Jalan Paprika 5, Taman Pulai Hijauan',
  postalCode: '81300',
  locality: 'Skudai',
  region: 'Johor',
} as const;

const address = `${ADDRESS.street}, ${ADDRESS.postalCode} ${ADDRESS.locality}, ${ADDRESS.region}`;

export const CONTACT = {
  whatsapp: 'https://wa.me/60105454173',
  tel: 'tel:+60105454173',
  phoneE164: '+60105454173',
  phoneShown: '010-545 4173',
  email: 'sales@ktron.my',
  mailto: 'mailto:sales@ktron.my',
  address,
  directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
} as const;

export const COMPANY = {
  name: 'Ktron Engineering Enterprise',
  reg: 'JM0870519-U',
  line: 'Ktron Engineering Enterprise (JM0870519-U)',
  founded: '2018',
} as const;

/** Area list (PRD §3), in this order; names come from the i18n files. */
export const AREA_KEYS = [
  'area.place.kulai', 'area.place.senai', 'area.place.sedenak', 'area.place.seelong',
  'area.place.skudai', 'area.place.jb', 'area.place.tebrau', 'area.place.pasirgudang',
] as const;
export const AREA_NAMES_EN = ['Kulai', 'Senai', 'Sedenak', 'Seelong', 'Skudai', 'Johor Bahru', 'Tebrau', 'Pasir Gudang'];
