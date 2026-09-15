/**
 * Photography for the marketing site.
 *
 * Every ID here was fetched and looked at before it was captioned — the alt
 * text describes what is actually in the frame, not what a slug implied.
 * Unsplash serves these under its licence; `next/image` handles the resize
 * and AVIF/WebP negotiation via the remotePatterns in next.config.
 */

export interface Photo {
  id: string
  alt: string
  /** Where the subject sits, so `object-position` keeps it in a tight crop. */
  focus?: string
}

export const PHOTOS = {
  /* ---- land ------------------------------------------------------------ */

  /** A tiny figure on a rock spire, mist and low sun across a forested valley — the opener. */
  ridgeVista: {
    id: 'photo-1469474968028-56623f02e42e',
    alt: 'A lone figure standing on a rock spire above a misty, forested valley in low golden light',
    focus: '50% 55%',
  },
  /** Two hikers with packs on a stony trail, snow-capped peaks ahead. */
  hikersTrail: {
    id: 'photo-1551632811-561732d1e306',
    alt: 'Two hikers with backpacks walking a stony trail towards snow-capped peaks',
    focus: '55% 45%',
  },
  /** A hiker on a rock ledge above cloud-filled alpine valleys. */
  summitLedge: {
    id: 'photo-1519904981063-b0cf448d479e',
    alt: 'A hiker with a red pack standing on a rock ledge above cloud-filled alpine valleys',
    focus: '30% 50%',
  },
  /** A climber on an overhanging limestone wall, karst towers behind. */
  cliffClimb: {
    id: 'photo-1522163182402-834f871fd851',
    alt: 'A climber in a yellow shirt on an overhanging limestone cliff, jungle-covered karst towers behind',
    focus: '40% 40%',
  },
  /** A skier mid-air above a snowy range. */
  skierJump: {
    id: 'photo-1551524559-8af4e6624178',
    alt: 'A skier mid-air with crossed skis above a sunlit snowy mountain range',
    focus: '65% 45%',
  },
  /** Alpine peaks over a sea of cloud at sunrise. */
  cloudSea: {
    id: 'photo-1506905925346-21bda4d32df4',
    alt: 'Snow-capped peaks catching first light above a valley filled with cloud',
    focus: '50% 40%',
  },
  /** Dark storm cloud building — the weather call. */
  stormClouds: {
    id: 'photo-1534088568595-a066f410bcda',
    alt: 'Dark grey storm clouds building across the sky',
    focus: '50% 50%',
  },
  /** Mount Fuji with a red pagoda in the foreground. */
  fujiPagoda: {
    id: 'photo-1526481280693-3bfa7568e0f3',
    alt: 'A red five-storey pagoda in the foreground with snow-capped Mount Fuji behind',
    focus: '60% 45%',
  },
  /** Chicago from the air at dusk, the lake behind. */
  citySkyline: {
    id: 'photo-1477959858617-67f85cf4f1df',
    alt: 'A dense city skyline seen from the air at dusk, a lake stretching to the horizon behind',
    focus: '50% 45%',
  },
  /** A pastel chair-swing ride at a daytime fair. */
  fairSwing: {
    id: 'photo-1513889961551-628c1e5e2ee9',
    alt: 'A pastel chair-swing ride spinning at a daytime fair, riders out on their chains',
    focus: '50% 40%',
  },
  /** Bali water temple on a still lake, flowers in front. */
  waterTemple: {
    id: 'photo-1544644181-1484b3fdfc62',
    alt: 'A tiered water temple on a still lake, red and yellow flowers in the foreground',
    focus: '55% 50%',
  },

  /* ---- table ----------------------------------------------------------- */

  /** An empty upscale dining room set for service. */
  restaurantRoom: {
    id: 'photo-1517248135467-4c7edcad34c4',
    alt: 'An empty restaurant dining room set for service, bentwood chairs and brass screens',
    focus: '50% 55%',
  },
  /** A plated course on a restaurant table, glasses and candlelight. */
  plated: {
    id: 'photo-1414235077428-338989a2e8c0',
    alt: 'A plated course on a white dish at a restaurant table, wine glasses and candlelight behind',
    focus: '50% 55%',
  },
  /** A glass of red on a railing above vineyard rows and a lake. */
  vineyardGlass: {
    id: 'photo-1506377247377-2a5b3b417ebb',
    alt: 'A glass of red wine on a railing above vineyard rows, a lake and hills beyond',
    focus: '50% 50%',
  },

  /* ---- water ----------------------------------------------------------- */

  /** Surfer deep in a turquoise barrel. */
  barrel: {
    id: 'photo-1502680390469-be75c86b636f',
    alt: 'A surfer crouched inside a hollow turquoise wave',
    focus: '50% 50%',
  },
  /** An atoll resort from the air, ringed by reef. */
  atoll: {
    id: 'photo-1516091877740-fde016699f2c',
    alt: 'A small island resort seen from above, ringed by pale reef and deep blue water',
    focus: '50% 50%',
  },
  /** Two scuba divers beside a wall of yellow snapper. */
  diversReef: {
    id: 'photo-1544551763-46a013bb70d5',
    alt: 'Two scuba divers passing a dense school of yellow snapper on a reef wall',
    focus: '55% 45%',
  },
  /** Golden hour, turquoise shallows, an empty run of sand. */
  goldenShore: {
    id: 'photo-1507525428034-b723cf961d3e',
    alt: 'Low sun over turquoise shallows washing onto an empty white-sand beach',
    focus: '50% 60%',
  },
  /** Sunset over a calm shoreline — the closer. */
  sunsetShore: {
    id: 'photo-1473116763249-2faaef81ccda',
    alt: 'The sun setting over a calm shoreline, wet sand reflecting the sky',
    focus: '50% 45%',
  },

  /* ---- the trades on the landing page ------------------------------------ */

  /** POV of a kayaker paddling into a low sun — the hero opener. */
  kayakSunset: {
    id: 'photo-1669659738635-7af645bb8a5b',
    alt: 'A kayaker in a yellow life vest paddling towards a low sun over a calm lake',
    focus: '50% 55%',
  },
  /** A chef spooning sauce over a plated course, dark kitchen behind. */
  chefPlating: {
    id: 'photo-1663530761401-15eefb544889',
    alt: 'A chef spooning sauce over a plated course on a white dish in a dark kitchen',
    focus: '55% 55%',
  },
  /** A barn reception venue draped in white fabric and string lights. */
  weddingVenue: {
    id: 'photo-1510076857177-7470076d4098',
    alt: 'A barn wedding venue draped in white fabric and string lights, the dance floor in front',
    focus: '50% 50%',
  },
  /** A long stone hall set with rows of tables — the gala frame. */
  weddingHall: {
    id: 'photo-1773407377203-faf8b19a2142',
    alt: 'A long stone-walled hall set with rows of tables for a reception, a fireplace at the far end',
    focus: '50% 55%',
  },
  /** Hands shaping a pot on a spinning wheel. */
  potteryClass: {
    id: 'photo-1589051079002-b140a970f568',
    alt: 'Two hands shaping a pot on a spinning pottery wheel',
    focus: '50% 50%',
  },
  /** A guest receiving a head massage by candlelight. */
  spaTreatment: {
    id: 'photo-1598901986949-f593ff2a31a6',
    alt: 'A guest lying back receiving a head massage by candlelight',
    focus: '50% 45%',
  },
  /** A rooftop bar at night above a lit skyline. */
  rooftopBar: {
    id: 'photo-1573047330199-9a915400744f',
    alt: 'A rooftop bar at night, lounge seating above a lit city skyline',
    focus: '50% 55%',
  },
  /** A striped balloon lifting off at sunrise, burner lit — the dawn frame. */
  balloonSunrise: {
    id: 'photo-1663052720693-5d1b34798c89',
    alt: 'A striped hot-air balloon lifting off at sunrise with its burner lit, a mountain behind',
    focus: '50% 45%',
  },
  /** A table set with glasses in a warm dining room before service. */
  dinnerService: {
    id: 'photo-1574966739987-65e38db0f7ce',
    alt: 'A table set with glasses and folded napkins in a warm wood-panelled dining room before service',
    focus: '50% 55%',
  },
  /** A crowd with raised hands facing a stage lit in orange. */
  concertCrowd: {
    id: 'photo-1524368535928-5b5e00ddc76b',
    alt: 'A concert crowd with raised hands facing a stage lit in orange',
    focus: '50% 50%',
  },
  /** A yoga class sitting on red mats, laughing. */
  yogaStudio: {
    id: 'photo-1671581084718-c4c04fc00250',
    alt: 'A yoga class sitting on red mats in a bright studio, everyone laughing',
    focus: '50% 45%',
  },
  /** Six bottles lined up on a wooden table for a tasting. */
  wineCellar: {
    id: 'photo-1776763019245-1245618be4ee',
    alt: 'Six bottles of wine lined up on a wooden table for a tasting',
    focus: '50% 55%',
  },
  /** Hands chopping vegetables side by side at a cooking class. */
  cookingClass: {
    id: 'photo-1683105555403-4c4cae4e2298',
    alt: 'Hands chopping vegetables side by side at a cooking-class counter',
    focus: '50% 50%',
  },
  /** A rainy old-town street, people gathered under café awnings. */
  foodMarket: {
    id: 'photo-1769316964872-9727a69b4ce0',
    alt: 'A rainy old-town street with people gathered under café awnings',
    focus: '50% 55%',
  },
  /** Four friends at an escape-room counter under a neon puzzle sign. */
  escapeRoom: {
    id: 'photo-1551911729-e6d432b63f73',
    alt: 'Four friends at an escape-room counter under a neon puzzle sign',
    focus: '50% 50%',
  },
} as const satisfies Record<string, Photo>

export type PhotoKey = keyof typeof PHOTOS

export function photoUrl(photo: Photo, width = 1600, quality = 78) {
  return `https://images.unsplash.com/${photo.id}?auto=format&fit=crop&w=${width}&q=${quality}`
}
