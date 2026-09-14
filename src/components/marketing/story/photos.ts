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
  /** Person standing on a cliff edge overlooking vast mountain valley at golden hour — the opener. */
  adventureVista: {
    id: 'photo-1469474968028-56623f02e42e',
    alt: 'Person standing on a rocky cliff overlooking a vast mountain valley bathed in golden light',
    focus: '50% 55%',
  },
  /** Hot air balloons floating at sunrise over dramatic terrain — the dark band. */
  balloonSunrise: {
    id: 'photo-1507608616759-54f48f0af0ee',
    alt: 'Dozens of hot air balloons rising at sunrise over dramatic rocky terrain',
    focus: '50% 40%',
  },
  /** Busy restaurant interior with warm lighting — texture for a chapter. */
  diningScene: {
    id: 'photo-1517248135467-4c7edcad34c4',
    alt: 'A warm, busy restaurant interior with ambient lighting and guests dining',
    focus: '50% 55%',
  },
  /** Group of hikers on a mountain trail with panoramic views. */
  hikingTrail: {
    id: 'photo-1551632811-561732d1e306',
    alt: 'A group of hikers ascending a snow-dusted mountain trail with panoramic views',
    focus: '55% 45%',
  },
  /** People on a zipline through a lush forest canopy. */
  ziplineCanopy: {
    id: 'photo-1530866495561-507c58b85993',
    alt: 'An adventurer on a zipline soaring through a lush green forest canopy',
    focus: '50% 50%',
  },
  /** Vibrant street food market at night with neon lights. */
  streetMarket: {
    id: 'photo-1533174072545-7a4b6ad7a6c3',
    alt: 'A vibrant night market with colourful lights and bustling crowds',
    focus: '50% 50%',
  },
  /** Mount Fuji with a red pagoda in the foreground. */
  fujiPagoda: {
    id: 'photo-1526481280693-3bfa7568e0f3',
    alt: 'A red five-storey pagoda in the foreground with snow-capped Mount Fuji behind',
    focus: '60% 45%',
  },
  /** Aerial view of a theme park or large attraction with crowds. */
  aerialAttraction: {
    id: 'photo-1513889961551-628c1e5e2ee9',
    alt: 'An aerial view of a bustling theme park with rides and colourful attractions',
    focus: '50% 50%',
  },
  /** Rock climber ascending a dramatic cliff face. */
  rockClimbing: {
    id: 'photo-1522163182402-834f871fd851',
    alt: 'A rock climber ascending a dramatic sandstone cliff face against blue sky',
    focus: '50% 55%',
  },
  /** Bali water temple on a still lake, flowers in front. */
  waterTemple: {
    id: 'photo-1544644181-1484b3fdfc62',
    alt: 'A tiered water temple on a still lake, red and yellow flowers in the foreground',
    focus: '55% 50%',
  },
  /** Alpine peaks over a sea of cloud at sunrise. */
  cloudSea: {
    id: 'photo-1506905925346-21bda4d32df4',
    alt: 'Snow-capped peaks catching first light above a valley filled with cloud',
    focus: '50% 40%',
  },
  /** A plated course on a restaurant table, glasses and candlelight. */
  plated: {
    id: 'photo-1414235077428-338989a2e8c0',
    alt: 'A plated course on a white dish at a restaurant table, wine glasses and candlelight behind',
    focus: '50% 55%',
  },
  /** Dramatic mountain peaks with moody storm clouds rolling in. */
  stormyPeaks: {
    id: 'photo-1534088568595-a066f410bcda',
    alt: 'Dramatic mountain peaks silhouetted against dark, moody storm clouds',
    focus: '50% 60%',
  },
  /** Skiers carving down a sunlit powder slope. */
  skiSlope: {
    id: 'photo-1551524559-8af4e6624178',
    alt: 'A skier carving through fresh powder on a sunlit mountain slope',
    focus: '50% 50%',
  },
  /** City skyline at golden hour with warm light reflecting off buildings. */
  cityGoldenHour: {
    id: 'photo-1477959858617-67f85cf4f1df',
    alt: 'A city skyline glowing at golden hour with warm light reflecting off glass towers',
    focus: '50% 45%',
  },
  /** Aerial view of colourful hot air balloons over patchwork fields. */
  aerialBalloons: {
    id: 'photo-1506012787146-f92b2d7d6d96',
    alt: 'Colourful hot air balloons seen from above floating over green patchwork fields',
    focus: '50% 50%',
  },
} as const satisfies Record<string, Photo>

export type PhotoKey = keyof typeof PHOTOS

export function photoUrl(photo: Photo, width = 1600, quality = 78) {
  return `https://images.unsplash.com/${photo.id}?auto=format&fit=crop&w=${width}&q=${quality}`
}
