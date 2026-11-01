import type { BuildableKindId, ItemId } from '@acorn/shared';
import basic from '../../../../assets/ui/item-atlas.webp?url';
import gear from '../../../../assets/ui/item-gear.webp?url';
import relics from '../../../../assets/ui/item-relics.webp?url';
import shelters from '../../../../assets/ui/item-shelters.webp?url';
import foodDecor from '../../../../assets/ui/item-food-decor.webp?url';
import systems from '../../../../assets/ui/item-systems.webp?url';

/** Visible alpha bounds in the source image, in pixels. */
export interface ArtSpec {
  readonly src: string;
  readonly size: number;
  readonly bounds: readonly [number, number, number, number];
}

const art = (src: string, size: number, bounds: ArtSpec['bounds']): ArtSpec => ({
  src,
  size,
  bounds,
});

/** Exact IDs only: unknown future items retain their SVG silhouettes. */
export const PAINTED_ICONS: Partial<Record<ItemId | BuildableKindId, ArtSpec>> = {
  axe: art(basic, 1254, [82, 121, 200, 182]),
  rod: art(basic, 1254, [387, 101, 194, 200]),
  shovel: art(basic, 1254, [686, 108, 184, 200]),
  torch: art(basic, 1254, [1003, 92, 152, 219]),
  berry: art(basic, 1254, [89, 414, 186, 175]),
  mushroom: art(basic, 1254, [401, 413, 169, 177]),
  meat: art(basic, 1254, [682, 427, 193, 157]),
  roastedMeat: art(basic, 1254, [997, 424, 173, 161]),
  bag: art(basic, 1254, [87, 694, 181, 175]),
  log: art(basic, 1254, [399, 708, 184, 156]),
  stick: art(basic, 1254, [676, 696, 180, 168]),
  rope: art(basic, 1254, [995, 705, 187, 163]),
  reed: art(basic, 1254, [111, 953, 143, 202]),
  bone: art(basic, 1254, [402, 978, 173, 161]),
  stone: art(basic, 1254, [687, 986, 176, 152]),
  forestStew: art(basic, 1254, [991, 984, 183, 153]),
  knightHelmet: art(gear, 1254, [83, 104, 188, 211]),
  mageHat: art(gear, 1254, [350, 91, 262, 224]),
  bearHat: art(gear, 1254, [670, 118, 233, 205]),
  rogueMask: art(gear, 1254, [976, 161, 237, 130]),
  woolCap: art(gear, 1254, [65, 417, 222, 171]),
  linenShirt: art(gear, 1254, [363, 390, 245, 210]),
  workTrousers: art(gear, 1254, [686, 385, 205, 225]),
  winterJacket: art(gear, 1254, [954, 386, 257, 213]),
  travelerTunic: art(gear, 1254, [75, 659, 221, 222]),
  travelerTrousers: art(gear, 1254, [380, 660, 207, 218]),
  leatherBoots: art(gear, 1254, [659, 694, 241, 185]),
  leatherGloves: art(gear, 1254, [959, 692, 246, 181]),
  rustySword: art(gear, 1254, [60, 938, 238, 229]),
  ironSword: art(gear, 1254, [363, 938, 238, 230]),
  huntingKnife: art(gear, 1254, [668, 966, 219, 178]),
  woodenShield: art(gear, 1254, [971, 940, 223, 225]),
  cedarHide: art(relics, 1254, [41, 113, 265, 210]),
  cedarstalkerCoat: art(relics, 1254, [355, 82, 254, 243]),
  kingsRequiem: art(relics, 1254, [672, 73, 222, 275]),
  sunreachPennant: art(relics, 1254, [992, 66, 237, 264]),
  kingCrown: art(relics, 1254, [55, 373, 237, 244]),
  firstBellRelic: art(relics, 1254, [382, 378, 227, 228]),
  lastBellTrophy: art(relics, 1254, [662, 381, 218, 221]),
  watchCaptainHelm: art(relics, 1254, [989, 360, 209, 261]),
  refinedAxe: art(relics, 1254, [44, 660, 258, 243]),
  refinedRod: art(relics, 1254, [348, 649, 247, 254]),
  sentinelTrophy: art(relics, 1254, [656, 655, 248, 242]),
  trailPennant: art(relics, 1254, [991, 647, 235, 261]),
  guardianTrophy: art(relics, 1254, [68, 928, 221, 266]),
  raiderGreatsword: art(relics, 1254, [349, 925, 247, 263]),
  watchGreatsword: art(relics, 1254, [660, 924, 264, 266]),
  raiderDagger: art(relics, 1254, [992, 960, 215, 223]),
  tent: art(shelters, 1254, [53, 126, 259, 198]),
  teepee: art(shelters, 1254, [381, 71, 187, 247]),
  cabin: art(shelters, 1254, [637, 93, 242, 223]),
  largeCabin: art(shelters, 1254, [925, 95, 297, 224]),
  trailWorkbench: art(shelters, 1254, [49, 403, 250, 200]),
  trailPantry: art(shelters, 1254, [379, 384, 189, 226]),
  kitchenGarden: art(shelters, 1254, [636, 410, 266, 201]),
  flowerBed: art(shelters, 1254, [956, 435, 262, 154]),
  campfire: art(shelters, 1254, [59, 657, 215, 223]),
  rowboat: art(shelters, 1254, [342, 678, 261, 199]),
  fence: art(shelters, 1254, [662, 686, 243, 189]),
  gardenPath: art(shelters, 1254, [965, 679, 239, 196]),
  mineSupport: art(shelters, 1254, [56, 947, 235, 222]),
  teepeeBlueprint: art(shelters, 1254, [341, 948, 255, 224]),
  cabinBlueprint: art(shelters, 1254, [642, 949, 267, 219]),
  largeCabinBlueprint: art(shelters, 1254, [947, 950, 267, 221]),
  trailRation: art(foodDecor, 1254, [69, 126, 229, 183]),
  berryTea: art(foodDecor, 1254, [377, 119, 215, 185]),
  perch: art(foodDecor, 1254, [657, 141, 251, 162]),
  trout: art(foodDecor, 1254, [960, 160, 264, 128]),
  goldenCarp: art(foodDecor, 1254, [48, 414, 258, 181]),
  roastedPerch: art(foodDecor, 1254, [347, 435, 257, 152]),
  roastedTrout: art(foodDecor, 1254, [649, 452, 267, 119]),
  roastedGoldenCarp: art(foodDecor, 1254, [955, 415, 271, 170]),
  flower: art(foodDecor, 1254, [81, 682, 190, 222]),
  fernLantern: art(foodDecor, 1254, [392, 665, 162, 234]),
  moonLantern: art(foodDecor, 1254, [700, 668, 150, 230]),
  flowerPlanter: art(foodDecor, 1254, [956, 707, 267, 193]),
  cedarBench: art(foodDecor, 1254, [45, 968, 249, 207]),
  timberTable: art(foodDecor, 1254, [349, 979, 251, 192]),
  wovenRug: art(foodDecor, 1254, [642, 989, 288, 188]),
  lantern: art(foodDecor, 1254, [1038, 956, 138, 223]),
  boneStaff: art(systems, 1254, [77, 64, 225, 285]),
  ironOre: art(systems, 1254, [371, 111, 230, 217]),
  clay: art(systems, 1254, [677, 115, 232, 210]),
  fishDisplay: art(systems, 1254, [973, 100, 230, 223]),
  goldenFishDisplay: art(systems, 1254, [61, 388, 260, 244]),
};

export const SYSTEM_ICONS = {
  health: art(systems, 1254, [396, 426, 222, 192]),
  hunger: art(systems, 1254, [671, 411, 238, 222]),
  settings: art(systems, 1254, [975, 406, 238, 235]),
  character: art(systems, 1254, [68, 693, 217, 233]),
  journal: art(systems, 1254, [363, 694, 250, 237]),
  map: art(systems, 1254, [656, 702, 250, 223]),
  spring: art(systems, 1254, [969, 708, 233, 219]),
  summer: art(systems, 1254, [57, 952, 256, 250]),
  autumn: art(systems, 1254, [374, 957, 234, 242]),
  winter: art(systems, 1254, [671, 960, 217, 241]),
  compass: art(systems, 1254, [1034, 954, 105, 240]),
} as const;

export type SystemIconId = keyof typeof SYSTEM_ICONS;
