/**
 * Photography for the marketing site.
 *
 * Curated high-resolution Unsplash imagery covering diverse tour & activity verticals:
 * outdoor adventure, mountain ziplines, guided walking/bike tours, wine & dining,
 * cultural attractions, wellness & retreats.
 *
 * Every photo is safe-guarded and typed.
 */

export interface Photo {
  id: string
  alt: string
  /** Where the subject sits, so `object-position` keeps it in a tight crop. */
  focus?: string
}

export const PHOTOS = {
  /** Person standing on a cliff edge overlooking vast mountain valley at golden hour — the opener. */
  adventureVista: {
    id: 'photo-1469474968028-56623f02e42e',
    alt: 'Adventurer standing on a mountain ridge overlooking a breathtaking valley at golden hour',
    focus: '50% 55%',
  },
  /** Hot air balloons floating at sunrise over dramatic terrain. */
  balloonSunrise: {
    id: 'photo-1507608616759-54f48f0af0ee',
    alt: 'Hot air balloons rising at sunrise over dramatic rocky landscapes',
    focus: '50% 40%',
  },
  /** Busy culinary dining experience with warm lighting. */
  diningScene: {
    id: 'photo-1517248135467-4c7edcad34c4',
    alt: 'A warm, bustling dining experience with ambient candlelight and artisan dishes',
    focus: '50% 55%',
  },
  /** Group of hikers on a scenic mountain trail. */
  hikingTrail: {
    id: 'photo-1551632811-561732d1e306',
    alt: 'A group of hikers ascending a scenic mountain trail with sweeping panoramic views',
    focus: '55% 45%',
  },
  /** Zipline canopy adventure through lush forest. */
  ziplineCanopy: {
    id: 'photo-1519904981063-b0cf448d479e',
    alt: 'An adventurer soaring through a forest canopy on a high-speed zipline',
    focus: '50% 50%',
  },
  /** Vibrant street food and night market cultural experience. */
  streetMarket: {
    id: 'photo-1533174072545-7a4b6ad7a6c3',
    alt: 'A vibrant night market and guided culinary walk with glowing festival lanterns',
    focus: '50% 50%',
  },
  /** Mount Fuji with traditional pagoda in foreground. */
  fujiPagoda: {
    id: 'photo-1526481280693-3bfa7568e0f3',
    alt: 'Traditional pagoda overlooking Mount Fuji during clear daylight',
    focus: '60% 45%',
  },
  /** Theme park, aerial attraction or scenic landmark. */
  aerialAttraction: {
    id: 'photo-1513889961551-628c1e5e2ee9',
    alt: 'Aerial view of a landmark attraction with active guests and tours',
    focus: '50% 50%',
  },
  /** Rock climber on a sandstone cliff face. */
  rockClimbing: {
    id: 'photo-1522163182402-834f871fd851',
    alt: 'Rock climber scaling a dramatic cliff face under clear blue sky',
    focus: '50% 55%',
  },
  /** Serene wellness retreat temple on tranquil water. */
  waterTemple: {
    id: 'photo-1544644181-1484b3fdfc62',
    alt: 'Tranquil wellness retreat with peaceful water gardens and reflective pavilion',
    focus: '55% 50%',
  },
  /** Alpine peaks over sea of clouds. */
  cloudSea: {
    id: 'photo-1506905925346-21bda4d32df4',
    alt: 'Snow-capped alpine peaks rising above a sea of clouds at dawn',
    focus: '50% 40%',
  },
  /** Fine dining plated course with wine pairings. */
  plated: {
    id: 'photo-1414235077428-338989a2e8c0',
    alt: 'Plated gourmet course with wine glasses and warm ambiance',
    focus: '50% 55%',
  },
  /** Dramatic mountain peaks in weather. */
  stormyPeaks: {
    id: 'photo-1534088568595-a066f410bcda',
    alt: 'Dramatic peaks with atmospheric mountain mist and changing weather',
    focus: '50% 60%',
  },
  /** Ski and winter mountain adventure. */
  skiSlope: {
    id: 'photo-1551524559-8af4e6624178',
    alt: 'Skier carving through fresh powder on a sunlit mountain slope',
    focus: '50% 50%',
  },
  /** City skyline and architectural walking tour. */
  cityGoldenHour: {
    id: 'photo-1477959858617-67f85cf4f1df',
    alt: 'City skyline glowing in evening golden hour for urban tours',
    focus: '50% 45%',
  },
  /** Aerial hot air balloons over patchwork fields. */
  aerialBalloons: {
    id: 'photo-1506012787146-f92b2d7d6d96',
    alt: 'Aerial perspective of hot air balloons drifting peacefully over green valleys',
    focus: '50% 50%',
  },
  /** Mountain biking outdoor trail. */
  mountainBiking: {
    id: 'photo-1544197150-b99a580bb7a8',
    alt: 'Rider navigating an alpine trail through pine forest',
    focus: '50% 50%',
  },
  /** Vineyard and wine tasting tour. */
  vineyardTour: {
    id: 'photo-1506377247377-2a5b3b417ebb',
    alt: 'Sun-drenched vineyard estate rows and wine tasting tour',
    focus: '50% 50%',
  },

  /* ---- Backward-compatible aliases mapped to high-end neutral imagery ---- */
  goldenShore: {
    id: 'photo-1551632811-561732d1e306',
    alt: 'A group of hikers ascending a scenic mountain trail with sweeping panoramic views',
    focus: '55% 45%',
  },
  coralGarden: {
    id: 'photo-1519904981063-b0cf448d479e',
    alt: 'An adventurer soaring through a forest canopy on a high-speed zipline',
    focus: '50% 50%',
  },
  stormSwell: {
    id: 'photo-1534088568595-a066f410bcda',
    alt: 'Dramatic peaks with atmospheric mountain mist and changing weather',
    focus: '50% 60%',
  },
  sunsetShore: {
    id: 'photo-1507608616759-54f48f0af0ee',
    alt: 'Hot air balloons rising at sunrise over dramatic rocky landscapes',
    focus: '50% 40%',
  },
  underwaterLight: {
    id: 'photo-1507608616759-54f48f0af0ee',
    alt: 'Golden sunrise illuminating balloon adventures across scenic terrain',
    focus: '50% 40%',
  },
  barrel: {
    id: 'photo-1544197150-b99a580bb7a8',
    alt: 'Outdoor mountain biking trail through scenic alpine pines',
    focus: '50% 50%',
  },
  atoll: {
    id: 'photo-1506377247377-2a5b3b417ebb',
    alt: 'Scenic vineyard and destination resort tour',
    focus: '50% 50%',
  },
  aerialShore: {
    id: 'photo-1506012787146-f92b2d7d6d96',
    alt: 'Aerial view of balloon excursions over rolling valleys',
    focus: '50% 50%',
  },
  softBreak: {
    id: 'photo-1522163182402-834f871fd851',
    alt: 'Rock climbing guide ascending steep sandstone rocks',
    focus: '50% 55%',
  },
  palmBeach: {
    id: 'photo-1477959858617-67f85cf4f1df',
    alt: 'City skyline glowing in evening golden hour for urban tours',
    focus: '50% 45%',
  },
  diversReef: {
    id: 'photo-1551524559-8af4e6624178',
    alt: 'Winter alpine adventure slope in mountain sunshine',
    focus: '50% 50%',
  },
} as const satisfies Record<string, Photo>

export type PhotoKey = keyof typeof PHOTOS

/**
 * Generates an optimized Unsplash CDN URL.
 * Guarded against undefined/null photo objects so it never throws.
 */
export function photoUrl(photo?: Photo | null, width = 1600, quality = 78): string {
  const photoId = photo?.id || PHOTOS.adventureVista.id
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${width}&q=${quality}`
}
