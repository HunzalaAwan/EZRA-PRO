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
  /** Unsplash unless said otherwise; Pexels ids are the numeric part of the photo URL. */
  source?: 'unsplash' | 'pexels'
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
  /* ---- the closing collage: five trades, five sharp frames ---- */
  /** Two glasses of red wine raised in a toast at a tasting. */
  wineToast: {
    id: 'photo-1510812431401-41d2bd2722f3',
    alt: 'Two glasses of red wine raised in a toast at a tasting',
    focus: '50% 45%',
  },
  /** Two people cooking together at a bright kitchen counter. */
  kitchenClass: {
    id: 'photo-1556910103-1c02745aae4d',
    alt: 'Two people laughing as they cook together at a bright kitchen counter',
    focus: '55% 45%',
  },
  /** A yoga pose in silhouette against a sunset sky. */
  sunsetYoga: {
    id: 'photo-1544367567-0f2fcb009e0b',
    alt: 'A yoga pose in silhouette against a sunset sky',
    focus: '50% 50%',
  },
  /** A long table of guests sharing a supper-club dinner. */
  supperClub: {
    id: 'photo-1528605248644-14dd04022da1',
    alt: 'A long table of guests sharing a supper-club dinner',
    focus: '50% 50%',
  },
  /** Confetti falling over a crowd at a night event. */
  confettiCrowd: {
    id: 'photo-1492684223066-81342ee5ff30',
    alt: 'Confetti falling over a crowd at a night event',
    focus: '50% 45%',
  },

  /* ---- people, from Pexels ------------------------------------------- */

  /** A café worker in a mustard apron holding a tablet, smiling, plants behind. */
  cafeTablet: { id: '6205523', source: 'pexels', alt: 'A smiling café worker in a mustard apron holding a tablet', focus: '50% 30%' },
  /** A waitress in a cap and apron taking an order at a window table. */
  waitressOrder: { id: '4350091', source: 'pexels', alt: 'A waitress in an apron taking an order from a guest at a window table', focus: '50% 35%' },
  /** A tour guide with a lanyard talking to a group of visitors outdoors. */
  guideGroup: { id: '37573881', source: 'pexels', alt: 'A tour guide with a lanyard explaining something to a group of visitors', focus: '50% 40%' },
  /** A café employee in a mustard apron, close portrait, smiling. */
  cafeSmile: { id: '6205508', source: 'pexels', alt: 'A café employee in a mustard apron smiling behind the counter', focus: '50% 30%' },
  /** A woman with a tablet sitting outside a Japanese dessert café. */
  dessertCafe: { id: '4473364', source: 'pexels', alt: 'A café owner with a tablet sitting outside her dessert shop', focus: '50% 30%' },
  /** A shop owner holding a tablet in a clothing store. */
  storeTablet: { id: '36730466', source: 'pexels', alt: 'A shop owner holding a tablet between the rails of a clothing store', focus: '50% 25%' },
  /** A diver in a wetsuit waving from the boat. */
  diverWave: { id: '36741299', source: 'pexels', alt: 'A diver in a wetsuit with a mask on her head waving from a boat', focus: '50% 40%' },
  /** A man readying scuba tanks on a boat deck. */
  scubaDeck: { id: '34118369', source: 'pexels', alt: 'A man preparing scuba tanks on a boat deck', focus: '50% 40%' },
  /** A chef leading a cooking class in a bright kitchen. */
  chefClass: { id: '38939130', source: 'pexels', alt: 'A chef in a white jacket leading a cooking class in a bright kitchen', focus: '50% 40%' },
  /** A florist in an apron with a tablet among the flowers. */
  floristTablet: { id: '3932817', source: 'pexels', alt: 'A florist in an apron holding a tablet among cut flowers', focus: '50% 35%' },
  /** Kayaks in golden evening light beneath limestone cliffs. */
  kayakGolden: { id: '37527658', source: 'pexels', alt: 'Kayaks paddling in golden evening light beneath limestone cliffs', focus: '50% 55%' },
  /** A row of kayaks paddling beneath golden sea cliffs. */
  kayakCliffs: { id: '1683368', source: 'pexels', alt: 'A group of kayaks paddling beneath golden sea cliffs', focus: '50% 55%' },
  /** Divers gearing up at the surface in calm water. */
  diversPrep: { id: '20051782', source: 'pexels', alt: 'Scuba divers at the surface preparing for a dive in calm water', focus: '50% 50%' },
  /** A yoga class on the grass by the sea. */
  yogaSea: { id: '39509205', source: 'pexels', alt: 'A yoga class on the grass beside the sea', focus: '50% 55%' },
  /** A guide with a raised finger and a book in front of a mountain view. */
  guideBook: { id: 'photo-1777523743673-fe2577163ede', alt: 'A tour guide holding a book and pointing while explaining a mountain view', focus: '50% 35%' },
  /** A tour group listening to a guide beside a pond in a park. */
  groupPond: { id: 'photo-1766415007432-80738e830722', alt: 'A tour group gathered around a guide beside a pond', focus: '50% 50%' },
  /** A wedding reception on a lawn in front of a villa at sunset. */
  villaWedding: { id: '33485961', source: 'pexels', alt: 'A wedding reception laid out on a lawn in front of a villa at sunset', focus: '50% 55%' },

  /* ---- the landing hero's side cards, one pair per trade (Pexels) ------- */

  /** A man in a yellow kayak paddling across a lake at sunrise. */
  heroPaddler: { id: '16949958', source: 'pexels', alt: 'A man paddling a yellow kayak across a calm lake at sunrise', focus: '55% 50%' },
  /** A guide in a blue shirt steering two guests in an inflatable kayak into a sea cave. */
  heroKayakGuide: { id: '33425749', source: 'pexels', alt: 'A guide paddling two guests in a blue kayak towards a limestone sea cave', focus: '50% 50%' },
  /** A chef plating a course with tweezers on a wooden board. */
  heroChefTweezers: { id: '4253315', source: 'pexels', alt: 'A chef in a grey apron plating a course with tweezers on a wooden board', focus: '50% 40%' },
  /** A guest raising a glass to a waitress in a restaurant full of greenery. */
  heroToastService: { id: '15761511', source: 'pexels', alt: 'A guest raising a glass of wine to a waitress in a restaurant full of greenery', focus: '50% 40%' },
  /** Reception tables laid under a bright canopy with greenery. */
  heroReceptionTables: { id: '19870060', source: 'pexels', alt: 'Wedding reception tables laid under a bright canopy hung with greenery', focus: '50% 50%' },
  /** A bride and groom under a shower of confetti in the sun. */
  heroConfettiCouple: { id: '19796665', source: 'pexels', alt: 'A bride and groom laughing under a shower of confetti thrown by their guests', focus: '50% 45%' },
  /** Two pairs of hands shaping a pot on a wheel. */
  heroPotteryHands: { id: '33559399', source: 'pexels', alt: 'Two pairs of hands shaping a clay pot together on a pottery wheel', focus: '50% 50%' },
  /** An instructor guiding a student in a yellow shirt at the wheel. */
  heroPotteryLesson: { id: '9304291', source: 'pexels', alt: 'A pottery teacher guiding a student in a yellow shirt at the wheel', focus: '50% 40%' },
  /** A yoga class in a bright studio, arms out in warrior pose. */
  heroYogaClass: { id: '8436610', source: 'pexels', alt: 'A yoga class holding warrior pose in a bright studio with tall windows', focus: '50% 50%' },
  /** Two women in standing splits on pink mats by tall windows with plum curtains, one in blue and one in rose. */
  heroYogaSplit: { id: '29735918', source: 'pexels', alt: 'Two women holding standing splits on yoga mats in front of tall sunny windows', focus: '50% 45%' },
  /** An instructor adjusting a student's arm in a sunny studio. */
  heroYogaTeacher: { id: '8436426', source: 'pexels', alt: 'A yoga instructor adjusting a student\'s raised arm in a sunny studio', focus: '50% 40%' },
  /** Two friends toasting with wine at a rooftop bar in the evening. */
  heroRooftopToast: { id: '34418030', source: 'pexels', alt: 'Two friends toasting with wine at a rooftop bar in the evening', focus: '50% 40%' },
  /** A bartender in a black apron stirring a cocktail. */
  heroBartender: { id: '16807989', source: 'pexels', alt: 'A bartender in a black apron stirring a cocktail at a wooden bar', focus: '50% 35%' },
} as const satisfies Record<string, Photo>

export type PhotoKey = keyof typeof PHOTOS

export function photoUrl(photo: Photo, width = 1600, quality = 78) {
  if (photo.source === 'pexels') {
    return `https://images.pexels.com/photos/${photo.id}/pexels-photo-${photo.id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`
  }
  return `https://images.unsplash.com/${photo.id}?auto=format&fit=crop&w=${width}&q=${quality}`
}
