export type SpriteKind =
  | 'palm'
  | 'pine'
  | 'cactus'
  | 'rock'
  | 'bush'
  | 'billboard'
  | 'lamp'
  | 'tower'
  | 'neonSign'
  | 'gate';

export type LayerKind = 'mountains' | 'city' | 'mesas';

export interface Theme {
  id: string;
  name: string;
  tagline: string;
  seed: number;
  sky: string[];
  sun: [string, string];
  sunStripes: boolean;
  stars: boolean;
  cloud: string;
  fog: string;
  grass: [string, string];
  rumble: [string, string];
  road: [string, string];
  lane: string;
  edge: string | null;
  layer: LayerKind;
  far: [string, string];
  near: [string, string];
  foliage: [string, string];
  trunk: string;
  rock: [string, string];
  accent: [string, string];
  lamp: string;
  deco: SpriteKind[];
  lamps: boolean;
  towers: boolean;
  billboards: boolean;
  preview: string;
  bpm: number;
  transpose: number;
}

export const THEMES: Theme[] = [
  {
    id: 'sunset',
    name: 'Sunset Coast',
    tagline: 'Palm-lined cliffs under a burning sky',
    seed: 1337,
    sky: ['#12072e', '#3b1470', '#b02a7c', '#ff6a4d', '#ffb36b'],
    sun: ['#fff1b0', '#ff5a3d'],
    sunStripes: true,
    stars: true,
    cloud: '#ff9a7a',
    fog: '#ffb36b',
    grass: ['#1f8f6a', '#1a7d5d'],
    rumble: ['#ff3d6e', '#fafafa'],
    road: ['#4b4a5e', '#454457'],
    lane: '#ffeab8',
    edge: null,
    layer: 'mountains',
    far: ['#7b2f94', '#e0667f'],
    near: ['#2d1257', '#8a2f78'],
    foliage: ['#136b48', '#35c27f'],
    trunk: '#6b4326',
    rock: ['#5a3a4f', '#9b6a78'],
    accent: ['#ff3d6e', '#ffd166'],
    lamp: '#ffd9a0',
    deco: ['palm', 'palm', 'palm', 'bush', 'rock'],
    lamps: true,
    towers: false,
    billboards: true,
    preview: 'linear-gradient(180deg,#2a0f5e 0%,#c0307a 45%,#ff8a4d 70%,#1f8f6a 71%,#14604a 100%)',
    bpm: 112,
    transpose: 0,
  },
  {
    id: 'neon',
    name: 'Neon Metropolis',
    tagline: 'Midnight sprint through a cyber skyline',
    seed: 9001,
    sky: ['#03010c', '#10043a', '#34086a', '#a3157c', '#e0338f'],
    sun: ['#ffe66d', '#ff2e93'],
    sunStripes: true,
    stars: true,
    cloud: '#c43ba0',
    fog: '#e0338f',
    grass: ['#0b0820', '#0e0a2b'],
    rumble: ['#00f0ff', '#ff2e93'],
    road: ['#17142e', '#1b1736'],
    lane: '#7df9ff',
    edge: '#00f0ff',
    layer: 'city',
    far: ['#3a0f6e', '#b0207f'],
    near: ['#0a0620', '#2a0b5a'],
    foliage: ['#0a3a4a', '#12b5c9'],
    trunk: '#201040',
    rock: ['#1a1038', '#3a2a70'],
    accent: ['#00f0ff', '#ff2e93'],
    lamp: '#7df9ff',
    deco: ['bush', 'rock', 'neonSign'],
    lamps: true,
    towers: true,
    billboards: true,
    preview: 'linear-gradient(180deg,#05020f 0%,#34086a 40%,#e0338f 68%,#0b0820 69%,#17142e 100%)',
    bpm: 124,
    transpose: -2,
  },
  {
    id: 'desert',
    name: 'Canyon Rush',
    tagline: 'Blazing mesas and endless open highway',
    seed: 4242,
    sky: ['#1d5fa8', '#4b94d4', '#9cc9ea', '#ffe3b5', '#ffd9a0'],
    sun: ['#ffffff', '#fff0b0'],
    sunStripes: false,
    stars: false,
    cloud: '#ffffff',
    fog: '#ffd9a0',
    grass: ['#dba25c', '#d19852'],
    rumble: ['#e0442a', '#f4efe4'],
    road: ['#5d5d63', '#57575d'],
    lane: '#f7f2de',
    edge: null,
    layer: 'mesas',
    far: ['#c27250', '#f0b080'],
    near: ['#8c4a36', '#c97d55'],
    foliage: ['#2f6b3a', '#5ea34f'],
    trunk: '#7a5230',
    rock: ['#8a5238', '#cf8a5f'],
    accent: ['#e0442a', '#1fb5b0'],
    lamp: '#fff2c0',
    deco: ['cactus', 'cactus', 'rock', 'bush', 'rock'],
    lamps: false,
    towers: false,
    billboards: true,
    preview: 'linear-gradient(180deg,#2b6fb8 0%,#9cc9ea 40%,#ffd9a0 70%,#dba25c 71%,#b97a3a 100%)',
    bpm: 108,
    transpose: 3,
  },
];

export interface CarSpec {
  id: string;
  name: string;
  tag: string;
  body: string;
  accent: string;
  top: number;
  accel: number;
  grip: number;
  nitro: number;
}

export const CARS: CarSpec[] = [
  { id: 'vortex', name: 'Vortex GT', tag: 'Balanced all-rounder', body: '#e8173a', accent: '#ffffff', top: 1.0, accel: 1.0, grip: 1.0, nitro: 1.0 },
  { id: 'phantom', name: 'Phantom R', tag: 'Top-speed missile', body: '#14c8e8', accent: '#0b1630', top: 1.07, accel: 0.86, grip: 0.9, nitro: 1.0 },
  { id: 'mamba', name: 'Mamba X', tag: 'Corner-carving demon', body: '#ffc21a', accent: '#111111', top: 0.95, accel: 1.14, grip: 1.15, nitro: 0.9 },
  { id: 'nightfall', name: 'Nightfall', tag: 'Huge nitro reserves', body: '#8a4dff', accent: '#ff3df0', top: 0.98, accel: 1.0, grip: 1.0, nitro: 1.4 },
];

export const RIVAL_COLORS = [
  { body: '#2f6bff', accent: '#ffffff' },
  { body: '#2ee59d', accent: '#06281c' },
  { body: '#f5f5f5', accent: '#e8173a' },
  { body: '#ff7a1a', accent: '#111111' },
  { body: '#d62fff', accent: '#ffffff' },
  { body: '#1b1b24', accent: '#ffd23f' },
  { body: '#9be22b', accent: '#10300a' },
  { body: '#ff4f9a', accent: '#ffffff' },
];
