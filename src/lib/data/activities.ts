/**
 * The sellable catalogue — the single most important dataset in the product.
 *
 * Activities are authored as compact specs and expanded by {@link buildActivity},
 * which derives every id from one `key` so the whole graph stays consistent:
 *
 *   key 'sunset_catamaran_sail'
 *     -> id      act_sunset_catamaran_sail
 *     -> slug    sunset-catamaran-sail
 *     -> tiers   tier_sunset_catamaran_sail_adult
 *     -> add-ons add_sunset_catamaran_sail_gopro_rental
 *
 * Prices are minor units (cents) in the tenant's own currency. Dates are written
 * without a UTC suffix so they keep a fixed distance from NOW in any runtime
 * timezone — see constants.ts.
 */

import type {
  Activity,
  ActivityMedia,
  ActivityStatus,
  AddOn,
  DifficultyLevel,
  PriceTier,
  PricingModel,
  Tenant,
  VerticalKey,
} from '@/types'
import { slugify } from '@/lib/utils'
import { unsplashUrl } from './constants'
import { getTenantById } from './tenants'

/* ==========================================================================
   AUTHORING TYPES
   ========================================================================== */

interface TierSpec {
  label: string
  price: number
  min?: number
  max?: number
  compareAtPrice?: number
  description?: string
  /** Comps and infants ride free and do not consume a seat. */
  countsTowardCapacity?: boolean
}

interface AddOnSpec {
  label: string
  price: number
  description: string
  maxPerBooking?: number | null
  required?: boolean
  icon?: string
}

/** [unsplash photo id, alt text] — the first entry becomes the primary image. */
type ShotSpec = [photoId: string, alt: string]

interface ActivitySpec {
  /** snake_case; the root of every id and the slug for this activity. */
  key: string
  name: string
  tagline: string
  description: string
  highlights: string[]
  included: string[]
  excluded: string[]
  requirements: string[]
  meetingPoint: string
  status: ActivityStatus
  difficulty: DifficultyLevel
  durationMinutes: number
  minAge: number
  maxCapacity: number
  minParticipants: number
  pricingModel: PricingModel
  tiers: TierSpec[]
  addOns: AddOnSpec[]
  shots: ShotSpec[]
  colorKey: Activity['colorKey']
  policy: { freeCancellationHours: number; lateRefundPercent: number; summary: string }
  resourceIds: string[]
  rating: number
  reviewCount: number
  totalBookings: number
  createdAt: string
  updatedAt: string
  seoTitle: string
  seoDescription: string
  featured: boolean
  /** Defaults to the tenant's vertical; set only for cross-category products. */
  category?: VerticalKey
}

/* ==========================================================================
   EXPANSION
   ========================================================================== */

/** "Child (4-12)" -> "child_4_12", so ids stay readable and collision-free. */
function idPart(label: string): string {
  return slugify(label).replace(/-/g, '_')
}

function buildTiers(key: string, specs: TierSpec[]): PriceTier[] {
  return specs.map((spec) => ({
    id: `tier_${key}_${idPart(spec.label)}`,
    label: spec.label,
    price: spec.price,
    ...(spec.compareAtPrice === undefined ? {} : { compareAtPrice: spec.compareAtPrice }),
    minQuantity: spec.min ?? 0,
    maxQuantity: spec.max ?? 12,
    ...(spec.description === undefined ? {} : { description: spec.description }),
    countsTowardCapacity: spec.countsTowardCapacity ?? true,
  }))
}

function buildAddOns(key: string, specs: AddOnSpec[]): AddOn[] {
  return specs.map((spec) => ({
    id: `add_${key}_${idPart(spec.label)}`,
    label: spec.label,
    price: spec.price,
    description: spec.description,
    maxPerBooking: spec.maxPerBooking === undefined ? null : spec.maxPerBooking,
    required: spec.required ?? false,
    ...(spec.icon === undefined ? {} : { icon: spec.icon }),
  }))
}

function buildMedia(key: string, shots: ShotSpec[]): ActivityMedia[] {
  return shots.map(([photoId, alt], index) => ({
    id: `med_${key}_${index + 1}`,
    url: unsplashUrl(photoId),
    alt,
    type: 'image' as const,
    isPrimary: index === 0,
  }))
}

function buildActivity(tenant: Tenant, spec: ActivitySpec): Activity {
  const tiers = buildTiers(spec.key, spec.tiers)
  return {
    id: `act_${spec.key}`,
    tenantId: tenant.id,
    slug: spec.key.replace(/_/g, '-'),
    name: spec.name,
    tagline: spec.tagline,
    description: spec.description,
    highlights: spec.highlights,
    included: spec.included,
    excluded: spec.excluded,
    requirements: spec.requirements,
    meetingPoint: spec.meetingPoint,
    /* Legacy seam: bases are resolved by the live demo module. */
    locations: [],
    category: spec.category ?? tenant.vertical,
    status: spec.status,
    format: 'departures',
    kind: 'trip',
    difficulty: spec.difficulty,
    durationMinutes: spec.durationMinutes,
    minAge: spec.minAge,
    maxCapacity: spec.maxCapacity,
    minParticipants: spec.minParticipants,
    pricingModel: spec.pricingModel,
    // The headline "from" price is the first tier by authoring convention —
    // always the standard adult/base seat, never an infant or comp rate.
    basePrice: tiers[0].price,
    currency: tenant.currency,
    priceTiers: tiers,
    addOns: buildAddOns(spec.key, spec.addOns),
    media: buildMedia(spec.key, spec.shots),
    colorKey: spec.colorKey,
    cancellationPolicy: spec.policy,
    requiredResourceIds: spec.resourceIds,
    rating: spec.rating,
    reviewCount: spec.reviewCount,
    totalBookings: spec.totalBookings,
    createdAt: spec.createdAt,
    updatedAt: spec.updatedAt,
    seoTitle: spec.seoTitle,
    seoDescription: spec.seoDescription,
    featured: spec.featured,
  }
}

/** Fails loudly at module load if a tenant id ever drifts out of sync. */
function tenantOrThrow(id: string): Tenant {
  const tenant = getTenantById(id)
  if (!tenant) throw new Error(`activities.ts references unknown tenant "${id}"`)
  return tenant
}

/* ==========================================================================
   BLUE HORIZON WATERSPORTS — Maui, HI (USD)
   ========================================================================== */

const BLUE_HORIZON_SPECS: ActivitySpec[] = [
  {
    key: 'sunset_catamaran_sail',
    name: 'Sunset Catamaran Sail & Snorkel',
    tagline: 'Golden hour on the water, with a reef stop before the sun drops.',
    description:
      'We slip out of Ma‘alaea two hours before sunset and sail the lee shore to Coral Gardens, where the water goes glassy in the late light. Snorkel the shallow reef while the crew fires up the grill, then dry off on the trampolines with a mai tai as Lānaʻi turns gold. Nalu is a purpose-built 49-foot sailing catamaran — no engine drone, no cattle-boat crush, four crew for a maximum of forty guests. On the way home we cut the motors, raise the main and let the trades carry you back into the harbour lights.',
    highlights: [
      'Only sailing catamaran running a sunset reef stop out of Ma‘alaea',
      'Coral Gardens snorkel in the calmest water of the day',
      'Fresh-grilled dinner served underway, not reheated from a tray',
      'Two rounds of mai tais, local beer and Maui-grown juices',
      'Capped at 40 guests on a boat certified for 49',
    ],
    included: [
      'Three-hour sail with a crew of four',
      'Mask, snorkel, fins and flotation belt',
      'Grilled dinner with a vegetarian option',
      'Two complimentary drinks per adult, then a cash bar',
      'Freshwater deck shower and towels',
    ],
    excluded: ['Gratuities for the crew', 'Hotel transfers unless added at checkout', 'GoPro rental'],
    requirements: [
      'Swimmers should be comfortable in open water with a flotation belt',
      'Reef-safe sunscreen only — mineral formulas are sold at the dock',
      'Check in 30 minutes before departure; the boat leaves on the hour',
    ],
    meetingPoint: 'Ma‘alaea Harbor, Slip 42 — check in 30 minutes before departure at the Blue Horizon flag.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 180,
    minAge: 4,
    maxCapacity: 40,
    minParticipants: 6,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 14900, min: 1, max: 20, description: 'Ages 13 and up.' },
      { label: 'Child (4-12)', price: 9900, min: 0, max: 10, description: 'Includes a keiki meal and youth snorkel set.' },
      {
        label: 'Infant (0-3)',
        price: 0,
        min: 0,
        max: 4,
        description: 'Rides free on a parent lap. Does not take a seat.',
        countsTowardCapacity: false,
      },
    ],
    addOns: [
      { label: 'GoPro Rental', price: 4500, description: 'HERO12 with a floating grip and a 64GB card you keep.', maxPerBooking: 4, icon: 'Camera' },
      { label: 'Underwater Photo Package', price: 7900, description: 'Our guide shoots your group in the water; edited gallery emailed by 9pm.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Hotel Transfer', price: 2500, description: 'Round-trip shuttle from any Kīhei or Wailea hotel lobby.', maxPerBooking: 8, icon: 'Bus' },
      { label: 'Premium Pupu Platter', price: 3500, description: 'Ahi poke, kalua pork sliders and grilled pineapple for two.', maxPerBooking: 6, icon: 'UtensilsCrossed' },
    ],
    shots: [
      ['1483683804023-6ccdb62f86ef', 'Sailing catamaran heeling gently in glassy water off the Maui coast at golden hour'],
      ['1468413253725-0d5181091126', 'Twin-hull sailboat under full canvas with the sun low on the horizon'],
      ['1530549387789-4c1017266635', 'Snorkeller floating above a shallow coral garden in clear turquoise water'],
      ['1473116763249-2faaef81ccda', 'Guests on the bow trampolines of a catamaran as the sun sets behind Lānaʻi'],
    ],
    colorKey: 'lagoon',
    policy: {
      freeCancellationHours: 48,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 48 hours before departure. Inside 48 hours we refund 50%. If we cancel for weather you choose a full refund or any other date.',
    },
    resourceIds: ['res_catamaran_nalu', 'res_snorkel_gear'],
    rating: 4.9,
    reviewCount: 1284,
    totalBookings: 9412,
    createdAt: '2021-04-02T10:15:00',
    updatedAt: '2026-08-27T14:20:00',
    seoTitle: 'Sunset Catamaran Sail & Snorkel in Maui | Blue Horizon Watersports',
    seoDescription:
      'Sail a 49ft catamaran from Ma‘alaea Harbor to Coral Gardens for a late-afternoon snorkel, grilled dinner and sunset. Small groups, four crew, mai tais included.',
    featured: true,
  },
  {
    key: 'molokini_dawn_patrol',
    name: 'Molokini Crater Dawn Patrol',
    tagline: 'First boat in the crater. 150-foot visibility. No crowds.',
    description:
      'Molokini is a sunken volcanic crater three miles offshore, and by 10am there are fourteen boats moored inside it. We leave the harbour at 6am so you are in the water before the second boat arrives — visibility routinely runs past 150 feet, the reef fish are still feeding, and the whole crater belongs to you for the first forty minutes. Certified divers take two tanks along the back wall; snorkellers work the inner shelf with a guide. We finish with a turtle stop at Makena on the ride home and a hot breakfast on deck.',
    highlights: [
      'In the crater by 7am — ahead of the entire commercial fleet',
      '150ft visibility on a typical morning, the best light of the day',
      'Optional two-tank back wall dive for certified divers',
      'Guided turtle stop at Makena on the return leg',
      'Hot breakfast and Maui coffee served underway',
    ],
    included: [
      'Five-hour trip with four crew and two in-water guides',
      'Mask, snorkel, fins, wetsuit top and flotation',
      'Hot breakfast, fresh fruit and unlimited coffee',
      'Marine sanctuary briefing and reef etiquette talk',
      'Freshwater showers and towels on board',
    ],
    excluded: ['Scuba gear beyond the dive tier', 'Nitrox fills', 'Crew gratuities'],
    requirements: [
      'Divers must present a current certification card and log a dive within 24 months',
      'Comfortable swimming in 40ft of open water',
      'Check in at 5:30am — the boat departs at 6:00am sharp',
      'No alcohol in the 12 hours before a dive tier',
    ],
    meetingPoint: 'Ma‘alaea Harbor, Slip 44 — check in at 5:30am at the Hoku Lani gangway.',
    status: 'live',
    difficulty: 'moderate',
    durationMinutes: 300,
    minAge: 6,
    maxCapacity: 48,
    minParticipants: 10,
    pricingModel: 'tiered',
    tiers: [
      { label: 'Adult Snorkeller', price: 17900, min: 1, max: 20 },
      { label: 'Child (6-12)', price: 12900, min: 0, max: 10, description: 'Youth gear and a dedicated keiki guide in the water.' },
      { label: 'Certified Diver (2 Tanks)', price: 23900, min: 0, max: 12, description: 'Back wall and inner reef. Certification card required at check-in.' },
    ],
    addOns: [
      { label: 'Nitrox Fill', price: 3500, description: 'EAN32 for both tanks. Nitrox certification required.', maxPerBooking: 6, icon: 'Wind' },
      { label: 'Prescription Mask', price: 1500, description: 'Corrective lenses from -2.0 to -6.0, reserved to your name.', maxPerBooking: 4, icon: 'Glasses' },
      { label: 'Underwater Photo Package', price: 8900, description: 'Crater and turtle stop shots, colour-corrected and delivered same day.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Hotel Transfer', price: 2500, description: 'Pre-dawn pickup from Kīhei and Wailea hotels.', maxPerBooking: 8, icon: 'Bus' },
    ],
    shots: [
      ['1544551763-46a013bb70d5', 'Diver descending along the wall of Molokini Crater in brilliant blue water'],
      ['1471922694854-ff1b63b20054', 'Schooling reef fish over hard coral inside a volcanic crater'],
      ['1507525428034-b723cf961d3e', 'Crescent-shaped crater rim rising from calm early-morning ocean'],
      ['1437622368342-7a3d73a34c8f', 'Green sea turtle gliding over the reef at the Makena turtle stop'],
      ['1500375592092-40eb2168fd21', 'Sunrise light on open ocean from the deck of a dive boat'],
    ],
    colorKey: 'info',
    policy: {
      freeCancellationHours: 48,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 48 hours out. Inside that window 50% is refunded. Weather cancellations by us are always fully refundable or rebookable.',
    },
    resourceIds: ['res_catamaran_hokulani', 'res_snorkel_gear', 'res_scuba_tanks'],
    rating: 4.9,
    reviewCount: 2061,
    totalBookings: 14380,
    createdAt: '2021-04-02T10:40:00',
    updatedAt: '2026-09-02T16:05:00',
    seoTitle: 'Molokini Crater Dawn Patrol Snorkel & Dive Tour | Blue Horizon Maui',
    seoDescription:
      'Be the first boat into Molokini Crater. 6am departure, 150ft visibility, guided snorkel or two-tank dive, turtle stop and hot breakfast on the way home.',
    featured: true,
  },
  {
    key: 'turtle_town_kayak',
    name: 'Turtle Town Kayak & Snorkel',
    tagline: 'Paddle out at first light and swim with honu over the lava shelf.',
    description:
      'Turtle Town is a run of lava fingers south of Makena where green sea turtles come in to feed and get cleaned by the reef fish. We launch tandem kayaks off the sand at 7am while the bay is still flat, paddle twenty minutes down the coast, then raft up and drop in to snorkel. Turtles here are used to quiet swimmers, so sightings run well above 90% — but we keep the legal ten feet and let them come to us. Small group, two guides, back on the beach before the wind fills in.',
    highlights: [
      'Over 90% turtle sighting rate across the last three seasons',
      'Launch at 7am while the bay is glass and the trade wind is still asleep',
      'Two guides for a maximum of sixteen paddlers',
      'Stable tandem sit-on-top kayaks — no experience needed',
      'Marine sanctuary briefing so you know how to share the water properly',
    ],
    included: [
      'Tandem kayak, paddle and personal flotation device',
      'Mask, snorkel and fins sized at the beach',
      'Two certified guides, one in the water at all times',
      'Fresh fruit, granola bars and cold water',
      'Dry bag for phones and keys',
    ],
    excluded: ['Hotel transfers unless added', 'Photos of your group in the water', 'Gratuities'],
    requirements: [
      'Able to swim 50 metres unaided',
      'Minimum age 5, and under-12s paddle with an adult',
      'Reef-safe mineral sunscreen only',
      'Arrive by 6:45am — we launch on the tide, not on the clock',
    ],
    meetingPoint: 'Makena Landing Beach Park — meet at the green Blue Horizon trailer by the north boat ramp, 6:45am.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 150,
    minAge: 5,
    maxCapacity: 16,
    minParticipants: 2,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 9900, min: 1, max: 12 },
      { label: 'Child (5-12)', price: 7400, min: 0, max: 8, description: 'Paddles in the bow seat with an adult behind.' },
      {
        label: 'Private Guided Tour (up to 4)',
        price: 42500,
        min: 0,
        max: 1,
        description: 'Your own guide, your own launch window, up to four paddlers.',
      },
    ],
    addOns: [
      { label: 'GoPro Rental', price: 4500, description: 'HERO12 on a floating handle, memory card included.', maxPerBooking: 4, icon: 'Camera' },
      { label: 'Underwater Photo Package', price: 6500, description: 'Guide-shot turtle photos of your group, delivered by evening.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Hotel Transfer', price: 2500, description: 'Round-trip from Wailea and south Kīhei hotels.', maxPerBooking: 6, icon: 'Bus' },
      { label: 'Reef-Safe Sunscreen', price: 1200, description: 'Zinc-based SPF 50 tin — sanctuary compliant and yours to keep.', maxPerBooking: 4, icon: 'Sun' },
    ],
    shots: [
      ['1502933691298-84fc14542831', 'Tandem kayak on flat turquoise water along a lava shoreline at sunrise'],
      ['1437622368342-7a3d73a34c8f', 'Green sea turtle feeding on the lava shelf at Turtle Town'],
      ['1527004013197-933c4bb611b3', 'Kayaks lined up on the sand at Makena Landing before launch'],
      ['1530549387789-4c1017266635', 'Snorkeller watching a turtle from a respectful distance'],
    ],
    colorKey: 'success',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 50,
      summary: 'Cancel free up to 24 hours before your launch. Inside 24 hours we refund half. Surf or wind cancellations on our side are refunded in full.',
    },
    resourceIds: ['res_kayak_fleet', 'res_snorkel_gear'],
    rating: 4.8,
    reviewCount: 968,
    totalBookings: 7240,
    createdAt: '2021-05-19T09:05:00',
    updatedAt: '2026-08-14T11:32:00',
    seoTitle: 'Turtle Town Kayak & Snorkel Tour, Makena Maui | Blue Horizon',
    seoDescription:
      'Sunrise tandem kayak and guided snorkel at Turtle Town, Makena. Over 90% turtle sightings, two guides, sixteen paddlers maximum, gear and fruit included.',
    featured: true,
  },
  {
    key: 'private_sportfishing_charter',
    name: 'Private Sportfishing Charter',
    tagline: 'Makani, six anglers, and the Au‘au Channel to yourselves.',
    description:
      'Makani is a 42-foot sportfisher rigged for the channel between Maui and Lānaʻi — outriggers, a fighting chair, and Captain Tane, who has run this water for nineteen years. Half days chase mahi-mahi and ono along the 100-fathom line; full days push out for ahi and, in season, blue marlin. Everything is private: your party, your crew, your call on where to run. Whatever you land we clean, bag and vacuum-pack at the slip, and plenty of Kīhei restaurants will cook your catch that night.',
    highlights: [
      'Fully private boat — never a shared charter',
      'Nineteen years of local knowledge on the Au‘au Channel',
      'Mahi-mahi, ono, ahi and seasonal blue marlin',
      'All rods, reels, terminal tackle and licences supplied',
      'Catch cleaned, bagged and vacuum-packed at the dock',
    ],
    included: [
      'Exclusive use of Makani with captain and deckhand',
      'Penn International rods, reels and all terminal tackle',
      'Trolling lures, ice and bait to start the day',
      'Cooler with water and soft drinks',
      'Fish cleaning and bagging at the slip',
    ],
    excluded: ['Lunch on full-day charters unless added', 'Live bait beyond the starting supply', 'Crew gratuity (15-20% is customary)'],
    requirements: [
      'Minimum age 8; under-16s need an adult aboard',
      'Bring motion sickness medication taken the night before, not at the dock',
      'Soft-soled shoes only on deck',
      'Hawaii requires no licence for saltwater recreational fishing — we handle the paperwork that does apply',
    ],
    meetingPoint: 'Ma‘alaea Harbor, Slip 12 — board 15 minutes before your charter time; Makani leaves the breakwater on schedule.',
    status: 'live',
    difficulty: 'moderate',
    durationMinutes: 480,
    minAge: 8,
    maxCapacity: 6,
    minParticipants: 1,
    pricingModel: 'per_group',
    tiers: [
      { label: 'Half-Day Charter (up to 6)', price: 129500, min: 0, max: 1, description: 'Four hours along the 100-fathom line.' },
      { label: 'Full-Day Charter (up to 6)', price: 219500, min: 0, max: 1, description: 'Eight hours, offshore to the ahi grounds.' },
      { label: 'Exclusive Marlin Run (10 hours)', price: 289500, min: 0, max: 1, description: 'Dawn departure, heavy tackle, Lānaʻi ledges.' },
    ],
    addOns: [
      { label: 'Fish Cleaning & Vacuum Pack', price: 8500, description: 'Filleted, portioned and sealed for the flight home.', maxPerBooking: 1, icon: 'Package' },
      { label: 'Premium Lunch', price: 6500, description: 'Deli platters, poke bowls and cold drinks for the whole party.', maxPerBooking: 1, icon: 'UtensilsCrossed' },
      { label: 'Live Bait Package', price: 12000, description: 'A full well of opelu and akule loaded before departure.', maxPerBooking: 1, icon: 'Fish' },
      { label: 'Hotel Transfer', price: 2500, description: 'Round-trip shuttle from any south Maui hotel.', maxPerBooking: 6, icon: 'Bus' },
    ],
    shots: [
      ['1473116763249-2faaef81ccda', 'Sportfishing boat running offshore through deep blue channel water'],
      ['1500375592092-40eb2168fd21', 'Open ocean swell on the 100-fathom line off Maui'],
      ['1540202404-a2f29016b523', 'Outriggers set and lines out behind a sportfisher at dawn'],
      ['1505228395891-9a51e7e86bf6', 'Ma‘alaea Harbor at first light before a charter departure'],
    ],
    colorKey: 'sunset',
    policy: {
      freeCancellationHours: 72,
      lateRefundPercent: 25,
      summary: 'Private charters cancel free up to 72 hours out. Inside 72 hours we refund 25%, since the day can rarely be resold. We never charge for a captain-called weather cancellation.',
    },
    resourceIds: ['res_sportfish_makani'],
    rating: 4.9,
    reviewCount: 312,
    totalBookings: 1104,
    createdAt: '2021-06-11T13:20:00',
    updatedAt: '2026-07-30T09:45:00',
    seoTitle: 'Private Sportfishing Charter, Ma‘alaea Maui | Blue Horizon Watersports',
    seoDescription:
      'Charter the 42ft Makani for mahi-mahi, ono, ahi and marlin in the Au‘au Channel. Half day, full day or a ten-hour marlin run. Tackle, ice and fish cleaning included.',
    featured: false,
  },
  {
    key: 'jet_ski_safari',
    name: 'Jet Ski Safari',
    tagline: 'Ninety minutes of open throttle along the Kīhei coast.',
    description:
      'This is not a fenced-off circuit in a car park. We brief you on the sand, run you through the controls in the shallows, then lead a convoy south along the Kīhei coastline with a guide on the lead ski and a sweep on the last. There are two open-water stretches where you can wind it out, a quiet cove where we cut the engines and drift, and a turn at Kamaole that puts Haleakalā over your shoulder the whole way back. Yamaha WaveRunners, life jackets and a full fuel tank included.',
    highlights: [
      'Guided convoy, not a roped-off riding pen',
      'Two open stretches where the throttle comes off the limiter',
      'Silent drift stop in a protected cove — often with turtles below',
      'Yamaha VX Cruisers and FX HO skis, all under two seasons old',
      'Lead guide and sweep rider on every run',
    ],
    included: [
      'Ninety minutes of ride time on a Yamaha WaveRunner',
      'Coast Guard approved life jacket and safety lanyard',
      'On-sand briefing and shallow-water controls session',
      'Full fuel and two escort guides',
      'Freshwater rinse and lockers at the beach base',
    ],
    excluded: ['Photos and video of your ride', 'Wetsuit tops', 'Fuel surcharge for the Squad tier beyond 90 minutes'],
    requirements: [
      'Drivers must be 16 or older with photo ID; passengers from age 8',
      'Combined weight per ski capped at 400lb (180kg)',
      'No alcohol before riding — we will refuse a rider without a refund',
      'Confident swimmer in open water',
    ],
    meetingPoint: 'Kīhei Boat Ramp, trailer bay 2 — look for the blue canopy. Arrive 20 minutes early for the briefing.',
    status: 'live',
    difficulty: 'moderate',
    durationMinutes: 90,
    minAge: 8,
    maxCapacity: 16,
    minParticipants: 1,
    pricingModel: 'per_unit',
    tiers: [
      { label: 'Single Rider (1 Ski)', price: 15900, min: 0, max: 4 },
      { label: 'Tandem (1 Ski, 2 Riders)', price: 19900, min: 0, max: 4, description: 'Riders swap at the halfway cove.' },
      { label: 'Squad (2 Skis, up to 4)', price: 36900, min: 0, max: 2, description: 'Two skis reserved together with a dedicated guide.' },
    ],
    addOns: [
      { label: 'GoPro Rental', price: 4500, description: 'Bar-mounted HERO12 with the card included.', maxPerBooking: 4, icon: 'Camera' },
      { label: 'Action Photo Package', price: 5900, description: 'Our sweep rider shoots the convoy; gallery sent the same afternoon.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Wetsuit Top', price: 1500, description: '2mm shorty top for the windy afternoon runs.', maxPerBooking: 4, icon: 'Shirt' },
    ],
    shots: [
      ['1500375592092-40eb2168fd21', 'Spray thrown from a personal watercraft cutting across open ocean'],
      ['1505228395891-9a51e7e86bf6', 'Kīhei coastline seen from the water with Haleakalā behind'],
      ['1473116763249-2faaef81ccda', 'Riders drifting in a calm turquoise cove with engines off'],
    ],
    colorKey: 'coral',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 24 hours before your slot. Inside 24 hours half is refunded. Rides cancelled for wind or surf are fully refunded.',
    },
    resourceIds: ['res_jetski_fleet'],
    rating: 4.7,
    reviewCount: 742,
    totalBookings: 5860,
    createdAt: '2022-02-08T15:10:00',
    updatedAt: '2026-08-19T10:08:00',
    seoTitle: 'Guided Jet Ski Safari in Kīhei, Maui | Blue Horizon Watersports',
    seoDescription:
      'A 90-minute guided WaveRunner convoy along the Kīhei coast with open-throttle stretches, a silent drift stop and escort guides front and back.',
    featured: false,
  },
  {
    key: 'beginner_surf_lesson',
    name: 'Beginner Surf Lesson',
    tagline: 'Standing up on your first session, or the next one is on us.',
    description:
      'Cove Park in Kīhei has the gentlest, most forgiving beginner wave on the south shore, and we have been teaching on it since 2019. Thirty minutes on the sand covers the pop-up, ocean safety and how to read a set, then you are in waist-deep whitewater with a coach pushing you into waves. Coaches run a maximum of five students each and stay in the water the entire session. About 95% of first-timers ride standing before the hour is out — if you do not, your next lesson is free, no argument.',
    highlights: [
      'Five students per coach, maximum, always in the water with you',
      'The softest beginner break on the south shore',
      '95% of first-timers stand up in session one',
      'Free repeat lesson if you do not get to your feet',
      'Soft-top boards sized to your height and weight, not handed out at random',
    ],
    included: [
      'Two-hour lesson with a certified instructor',
      'Soft-top surfboard and leash for the session',
      'Rash guard and reef-safe sunscreen',
      'Beach-side ocean safety and etiquette briefing',
      'Freshwater rinse and board storage',
    ],
    excluded: ['Board rental after the lesson ends', 'Photos of your session', 'Parking at Cove Park (metered)'],
    requirements: [
      'Able to swim 25 metres and stand comfortably in chest-deep water',
      'Minimum age 6; ages 6-12 take the semi-private or private tier',
      'No sunburn or open wounds — saltwater and sand are unforgiving',
    ],
    meetingPoint: 'Cove Park, Kīhei — meet at the blue Blue Horizon board rack on the grass, 15 minutes before your lesson.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 120,
    minAge: 6,
    maxCapacity: 10,
    minParticipants: 1,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Group Lesson', price: 9500, min: 0, max: 10, description: 'Maximum five students per coach.' },
      { label: 'Semi-Private (2 Students)', price: 16500, min: 0, max: 4, description: 'One coach, two students, twice the waves.' },
      { label: 'Private 1:1', price: 24500, min: 0, max: 2, description: 'Video review included at the end of the session.' },
    ],
    addOns: [
      { label: 'Board Rental Extension', price: 3500, description: 'Keep your board for the rest of the day after the lesson.', maxPerBooking: 6, icon: 'Clock' },
      { label: 'Photo Package', price: 5500, description: 'Beach-shot stills of your first waves, edited and sent that evening.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Rash Guard', price: 1200, description: 'UPF 50 long-sleeve rash guard to keep.', maxPerBooking: 6, icon: 'Shirt' },
    ],
    shots: [
      ['1502680390469-be75c86b636f', 'Beginner surfer riding a small clean wave in the whitewater'],
      ['1509914398892-963f53e6e2f1', 'Soft-top surfboards lined up on the sand before a lesson'],
      ['1505118380757-91f5f5632de0', 'Surf coach walking a student out through shallow water'],
      ['1500375592092-40eb2168fd21', 'Clean small surf breaking along a south-facing Maui beach'],
    ],
    colorKey: 'lagoon',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 24 hours ahead; half refunded inside that. Flat or blown-out conditions are called by the coach and fully refunded.',
    },
    resourceIds: ['res_surfboard_fleet'],
    rating: 4.9,
    reviewCount: 1408,
    totalBookings: 8210,
    createdAt: '2021-07-22T08:50:00',
    updatedAt: '2026-08-31T12:14:00',
    seoTitle: 'Beginner Surf Lessons in Kīhei, Maui | Blue Horizon Watersports',
    seoDescription:
      'Two-hour beginner surf lesson at Cove Park with five students per coach, boards and rash guards included, and a free repeat lesson if you do not stand up.',
    featured: false,
  },
  {
    key: 'night_manta_ray_dive',
    name: 'Night Manta Ray Dive',
    tagline: 'Kneel on the sand, aim your light up, and wait for the wings.',
    description:
      'After dark we anchor over a shallow sand patch and set a ring of dive lights facing upward. The lights raise a column of plankton; the plankton brings the mantas, and they barrel-roll through the beam an arm’s length over your head — wingspans of ten to fourteen feet, again and again, for forty minutes. Divers kneel on the sand at 30 feet. Snorkellers hold a lit float board on the surface and look straight down. It is the single most requested thing we run, and it books out weeks ahead.',
    highlights: [
      'Manta encounter rate above 85% across the last two seasons',
      'Wingspans of 10-14 feet passing within arm’s reach',
      'Choose the dive or the surface snorkel — both watch the same show',
      'Maximum 18 guests with three in-water guides',
      'Full night-diving briefing and light handling practice before entry',
    ],
    included: [
      'Two-and-a-half hour night trip with three guides',
      'Primary dive light and backup light',
      'Tank, weights and lit snorkel board as appropriate to your tier',
      'Hot chocolate, soup and towels on the surface interval',
      'Night-diving briefing and buddy check',
    ],
    excluded: ['Full scuba gear rental for the dive tier', 'Nitrox', 'Underwater video'],
    requirements: [
      'Divers: open water certification and at least 10 logged dives',
      'Snorkellers: confident floating in open water at night with a board',
      'Minimum age 12 for both tiers',
      'No alcohol in the 12 hours prior — this is a night entry',
    ],
    meetingPoint: 'Ma‘alaea Harbor, Slip 39 — check in at the Kai Wa‘a gangway 45 minutes before departure for the night briefing.',
    status: 'live',
    difficulty: 'moderate',
    durationMinutes: 150,
    minAge: 12,
    maxCapacity: 18,
    minParticipants: 4,
    pricingModel: 'tiered',
    tiers: [
      { label: 'Certified Diver', price: 21900, min: 0, max: 10, description: 'Kneeling dive at 30ft with a primary and backup light.' },
      { label: 'Snorkeller', price: 14900, min: 0, max: 12, description: 'Lit float board on the surface, guide alongside.' },
      { label: 'Private Divemaster (1:2)', price: 49500, min: 0, max: 2, description: 'Dedicated divemaster for up to two divers.' },
    ],
    addOns: [
      { label: 'Full Gear Rental', price: 4500, description: 'BCD, regulator, computer and 3mm suit.', maxPerBooking: 8, icon: 'Anchor' },
      { label: 'Dive Light Rental', price: 1800, description: 'Extra 3000-lumen canister light for photography.', maxPerBooking: 4, icon: 'Flashlight' },
      { label: 'Underwater Video', price: 9500, description: 'Guide-shot 4K footage of the manta column, edited to three minutes.', maxPerBooking: 1, icon: 'Video' },
      { label: 'Nitrox Fill', price: 3500, description: 'EAN32 for a longer, cleaner bottom time.', maxPerBooking: 6, icon: 'Wind' },
    ],
    shots: [
      ['1544551763-46a013bb70d5', 'Diver with a torch beam cutting through dark water above a sand patch'],
      ['1471922694854-ff1b63b20054', 'Plankton column lit from below with a large ray passing overhead'],
      ['1530549387789-4c1017266635', 'Snorkellers holding a lit float board on the surface after dark'],
      ['1519681393784-d120267933ba', 'Dive boat under a clear starlit sky waiting on the mooring'],
    ],
    colorKey: 'reef',
    policy: {
      freeCancellationHours: 48,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 48 hours out. Inside that, 50%. Swell or surge cancellations called by the divemaster are refunded in full.',
    },
    resourceIds: ['res_dive_boat_kaiwaa', 'res_scuba_tanks'],
    rating: 4.9,
    reviewCount: 654,
    totalBookings: 3120,
    createdAt: '2021-09-30T18:05:00',
    updatedAt: '2026-09-05T17:40:00',
    seoTitle: 'Night Manta Ray Dive & Snorkel, Maui | Blue Horizon Watersports',
    seoDescription:
      'Dive or snorkel with manta rays after dark off Maui. Lights set on the sand at 30ft, 85%+ encounter rate, three guides and a maximum of 18 guests.',
    featured: true,
  },
  {
    key: 'whale_watch_eco_cruise',
    name: 'Whale Watch Eco Cruise',
    tagline: 'Humpbacks in the Au‘au Channel, with a naturalist and a hydrophone.',
    description:
      'From December to April the Au‘au Channel holds the densest humpback population on earth — mothers, calves and competitive pods, often within a mile of the harbour. Noelani, our sanctuary-trained naturalist, narrates the whole trip, and we drop a hydrophone so you hear the males singing beneath the hull. The boat stays at the legal 100-yard distance; the whales regularly decide otherwise. A dollar from every ticket goes to the Pacific Whale Sanctuary, and we publish the receipts each season.',
    highlights: [
      'Sanctuary-trained naturalist narrating the entire cruise',
      'Hydrophone dropped on every trip to hear the males sing',
      'Guaranteed sighting or your next cruise is free',
      'Covered upper deck and full shade for the whole party',
      'One dollar per ticket funds the Pacific Whale Sanctuary',
    ],
    included: [
      'Two-and-a-half hour cruise with a naturalist aboard',
      'Hydrophone listening session',
      'Binoculars for shared use on deck',
      'Coffee, juice and light snacks',
      'Sighting guarantee — rebook free if we see nothing',
    ],
    excluded: ['Alcoholic drinks (cash bar)', 'Hotel transfers unless added', 'Professional photography'],
    requirements: [
      'Season runs 15 December to 15 April; no departures outside it',
      'Motion sickness medication should be taken an hour before boarding',
      'Under-18s must be accompanied by an adult',
    ],
    meetingPoint: 'Ma‘alaea Harbor, Slip 44 — board 20 minutes before departure; the harbour car park fills fast in season.',
    status: 'paused',
    difficulty: 'easy',
    durationMinutes: 150,
    minAge: 3,
    maxCapacity: 48,
    minParticipants: 8,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 11900, min: 1, max: 20 },
      { label: 'Child (3-12)', price: 6900, min: 0, max: 12 },
      {
        label: 'Infant (0-2)',
        price: 0,
        min: 0,
        max: 4,
        description: 'Free on a parent lap.',
        countsTowardCapacity: false,
      },
    ],
    addOns: [
      { label: 'Hydrophone Headset', price: 1500, description: 'Your own headset instead of the deck speaker.', maxPerBooking: 8, icon: 'Headphones' },
      { label: 'Photo Package', price: 6900, description: 'Naturalist-shot breach and fluke images from your cruise.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Hotel Transfer', price: 2500, description: 'Round-trip from Kīhei, Wailea and Lahaina hotels.', maxPerBooking: 8, icon: 'Bus' },
    ],
    shots: [
      ['1518877593221-1f28583780b4', 'Humpback whale fluke raised above the surface of the Au‘au Channel'],
      ['1500375592092-40eb2168fd21', 'Open channel water between Maui and Lānaʻi on a clear winter morning'],
      ['1473116763249-2faaef81ccda', 'Guests watching from the shaded upper deck of an eco cruise vessel'],
    ],
    colorKey: 'info',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 100,
      summary: 'Cancel any time up to departure for a full refund — whale watching should never feel like a gamble on the forecast.',
    },
    resourceIds: ['res_catamaran_hokulani'],
    rating: 4.8,
    reviewCount: 1893,
    totalBookings: 12640,
    createdAt: '2021-11-05T07:25:00',
    updatedAt: '2026-04-16T13:55:00',
    seoTitle: 'Maui Whale Watch Eco Cruise with Naturalist | Blue Horizon Watersports',
    seoDescription:
      'Humpback whale watching in the Au‘au Channel with a sanctuary-trained naturalist, hydrophone listening and a sighting guarantee. December to April.',
    featured: false,
  },
  {
    key: 'lanai_coast_snorkel_sail',
    name: 'Lānaʻi Coast Snorkel Sail',
    tagline: 'A full day across the channel to reefs the day boats never reach.',
    description:
      'Seven hours, two islands. We sail Nalu across the Au‘au Channel at first light — dolphins ride the bow more often than not — and anchor at Club Lānaʻi for a two-hour snorkel over reef that sees a fraction of Maui’s traffic. Lunch is grilled on deck while you swim, then we work our way down the Lānaʻi shoreline past the Cathedrals before the afternoon trade wind gives us a fast, heeled-over sail home. Forty guests maximum, four crew, and the kind of day people book their trip around.',
    highlights: [
      'Full channel crossing under sail, not a motor shuttle',
      'Spinner dolphins on the bow on roughly four mornings in five',
      'Two hours of snorkelling on uncrowded Lānaʻi reef',
      'Grilled lunch served at anchor with a vegetarian option',
      'Fast downwind sail home past the Cathedrals lava formations',
    ],
    included: [
      'Seven-hour sail with four crew and two in-water guides',
      'Mask, snorkel, fins, wetsuit top and flotation',
      'Continental breakfast and a grilled lunch',
      'Soft drinks all day, plus two adult beverages after the swim',
      'Freshwater showers, towels and shaded seating',
    ],
    excluded: ['Gratuities', 'Hotel transfers unless added', 'Prescription mask rental'],
    requirements: [
      'Comfortable snorkelling in open water away from shore',
      'Channel crossings can be lively — take motion sickness medication the night before',
      'Minimum age 5',
      'Reef-safe mineral sunscreen only',
    ],
    meetingPoint: 'Ma‘alaea Harbor, Slip 42 — check in by 6:45am. The crossing leaves at 7:15am and cannot wait.',
    status: 'live',
    difficulty: 'moderate',
    durationMinutes: 420,
    minAge: 5,
    maxCapacity: 40,
    minParticipants: 12,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 22900, min: 1, max: 16 },
      { label: 'Child (5-12)', price: 16900, min: 0, max: 10 },
      {
        label: 'Infant (0-4)',
        price: 0,
        min: 0,
        max: 3,
        description: 'Free on a parent lap; no seat or gear allocated.',
        countsTowardCapacity: false,
      },
    ],
    addOns: [
      { label: 'Premium Lunch Upgrade', price: 3900, description: 'Grilled ahi or huli-huli chicken instead of the standard plate.', maxPerBooking: 8, icon: 'UtensilsCrossed' },
      { label: 'Prescription Mask', price: 1500, description: 'Corrective lenses reserved to your name for the day.', maxPerBooking: 4, icon: 'Glasses' },
      { label: 'Underwater Photo Package', price: 8900, description: 'Full-day gallery from both snorkel sites, edited and delivered that night.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Hotel Transfer', price: 2500, description: 'Early pickup from Kīhei and Wailea hotels.', maxPerBooking: 8, icon: 'Bus' },
    ],
    shots: [
      ['1439405326854-014607f694d7', 'Sailing catamaran crossing the Au‘au Channel toward Lānaʻi at sunrise'],
      ['1471922694854-ff1b63b20054', 'Uncrowded hard coral reef on the Lānaʻi shoreline'],
      ['1507525428034-b723cf961d3e', 'Clear shallow water and empty sand at the Lānaʻi anchorage'],
      ['1483683804023-6ccdb62f86ef', 'Catamaran heeled over on a fast downwind sail back to Maui'],
      ['1530549387789-4c1017266635', 'Guests snorkelling in a line above a healthy reef'],
    ],
    colorKey: 'lagoon',
    policy: {
      freeCancellationHours: 72,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 72 hours before the crossing. Inside 72 hours we refund half. Channel conditions are captain-called and always fully refunded.',
    },
    resourceIds: ['res_catamaran_nalu', 'res_snorkel_gear'],
    rating: 4.8,
    reviewCount: 877,
    totalBookings: 5140,
    createdAt: '2022-01-17T11:30:00',
    updatedAt: '2026-08-08T15:22:00',
    seoTitle: 'Lānaʻi Coast Snorkel Sail from Maui | Blue Horizon Watersports',
    seoDescription:
      'A seven-hour sailing day from Ma‘alaea to Lānaʻi with two hours of snorkelling, a grilled lunch at anchor and a fast downwind return past the Cathedrals.',
    featured: false,
  },
  {
    key: 'discover_scuba_first_breath',
    name: 'Discover Scuba: First Breath',
    tagline: 'No certification, no pool, no pressure — just your first breath underwater.',
    description:
      'You do not need a licence to breathe underwater for the first time, only a good instructor and calm water. We start in chest-deep sand at Makena with the skills that actually matter: clearing a mask, sharing air, staying neutral. When you are ready we move to a 25-foot reef and swim it together, instructor within arm’s reach the whole dive. Maximum two students per instructor. Most people surface grinning and asking about certification — the course fee credits straight onto your PADI Open Water if you book within a year.',
    highlights: [
      'Two students per instructor, never more',
      'Shallow sand start — nobody is dropped into deep water cold',
      '25-foot guided reef dive with turtles on most outings',
      'Your fee credits toward PADI Open Water within 12 months',
      'Full gear supplied and fitted, down to youth sizes',
    ],
    included: [
      'Three-and-a-half hour session with a PADI professional',
      'Complete scuba equipment and tanks',
      'Confined-water skills session before the ocean dive',
      'Guided reef dive with in-water photos of your first breath',
      'Logbook entry signed by your instructor',
    ],
    excluded: ['PADI Open Water certification itself', 'Prescription mask rental', 'Hotel transfers'],
    requirements: [
      'Minimum age 10',
      'Complete the PADI medical questionnaire — some conditions need a doctor’s sign-off',
      'No flying within 18 hours after the dive',
      'Able to swim 200 metres and float for 10 minutes',
    ],
    meetingPoint: 'Ma‘alaea Harbor, Building C — Harbor Briefing Hale. Check in 45 minutes early for paperwork and gear fitting.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 210,
    minAge: 10,
    maxCapacity: 8,
    minParticipants: 1,
    pricingModel: 'per_person',
    tiers: [
      { label: 'One-Tank Discover Scuba', price: 19900, min: 0, max: 6 },
      { label: 'Two-Tank Discover Scuba', price: 27900, min: 0, max: 6, description: 'A second dive once the nerves are gone — where it really clicks.' },
      { label: 'Private Instructor (1:1)', price: 42500, min: 0, max: 2, description: 'One instructor, one student, entirely your pace.' },
    ],
    addOns: [
      { label: 'Underwater Photo Set', price: 6900, description: 'Instructor-shot photos of your first breath and reef swim.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Full Wetsuit', price: 1500, description: '3mm full suit instead of the standard shorty.', maxPerBooking: 4, icon: 'Shirt' },
      { label: 'PADI eLearning Credit', price: 4900, description: 'Open Water theory access, deducted from the full course if you continue.', maxPerBooking: 4, icon: 'GraduationCap' },
    ],
    shots: [
      ['1544551763-46a013bb70d5', 'Instructor holding a first-time diver steady just beneath the surface'],
      ['1530549387789-4c1017266635', 'Student practising mask clearing in chest-deep clear water'],
      ['1471922694854-ff1b63b20054', 'Shallow Maui reef at 25 feet with reef fish in the foreground'],
      ['1437622368342-7a3d73a34c8f', 'Green sea turtle passing a pair of divers on the reef'],
    ],
    colorKey: 'reef',
    policy: {
      freeCancellationHours: 48,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 48 hours ahead, 50% inside that window. If the medical questionnaire rules you out at check-in you are refunded in full.',
    },
    resourceIds: ['res_dive_boat_kaiwaa', 'res_scuba_tanks', 'res_briefing_hale'],
    rating: 4.9,
    reviewCount: 521,
    totalBookings: 2870,
    createdAt: '2022-03-14T09:00:00',
    updatedAt: '2026-07-11T14:02:00',
    seoTitle: 'Discover Scuba Diving in Maui — No Certification Needed | Blue Horizon',
    seoDescription:
      'Try scuba for the first time with a PADI instructor at a 2:1 ratio. Shallow skills session, guided 25ft reef dive, all gear included and credit toward Open Water.',
    featured: false,
  },
  {
    key: 'sunrise_paddleboard_ocean_yoga',
    name: 'Sunrise Paddleboard & Ocean Yoga',
    tagline: 'Flat water, first light, and a flow that ends with a swim.',
    description:
      'We meet on the sand while it is still grey, paddle four hundred metres into the lee of the point, and tie off on a float line where the water sits like glass. Forty minutes of slow vinyasa follows — the board makes every posture honest — and we finish in savasana with the sun coming over Haleakalā. Afterwards you swim, or paddle back the long way if you would rather. Teachers are 200-hour RYT certified and all boards are wide, stable touring shapes. No yoga experience needed; balance is the practice, not the prerequisite.',
    highlights: [
      'Anchored float line in the calmest water on the coast',
      'Wide, stable touring boards — falling in is optional, not inevitable',
      '200-hour RYT certified teachers, maximum fourteen mats',
      'Finish with a swim as the sun clears the crater',
      'Herbal tea and fresh fruit on the beach afterwards',
    ],
    included: [
      'Ninety-minute session with a certified instructor',
      'Paddleboard, paddle and anchor line',
      'Waterproof dry bag for your phone',
      'Herbal tea and seasonal fruit after class',
      'Freshwater rinse at the beach base',
    ],
    excluded: ['Board rental outside the session', 'Photography', 'Parking fees'],
    requirements: [
      'Able to swim comfortably in open water',
      'Minimum age 12',
      'Arrive 15 minutes early — we launch at first light, not on the hour',
    ],
    meetingPoint: 'Kalama Beach Park, Kīhei — south grass by the board rack. Arrive 15 minutes before sunrise.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 90,
    minAge: 12,
    maxCapacity: 14,
    minParticipants: 3,
    pricingModel: 'per_person',
    category: 'wellness',
    tiers: [
      { label: 'Class + Board', price: 8900, min: 0, max: 8 },
      { label: 'Bring Your Own Board', price: 6500, min: 0, max: 6, description: 'Anchor line and instruction only.' },
      { label: 'Private Session (up to 3)', price: 24500, min: 0, max: 1, description: 'Your own teacher and launch time.' },
    ],
    addOns: [
      { label: 'Board Rental Extension', price: 2500, description: 'Keep your board until noon and paddle the coast.', maxPerBooking: 6, icon: 'Clock' },
      { label: 'Reef-Safe Sunscreen', price: 1200, description: 'Zinc SPF 50 tin, sanctuary compliant.', maxPerBooking: 4, icon: 'Sun' },
      { label: 'Waterproof Phone Case', price: 900, description: 'Floating lanyard case so you can shoot the sunrise.', maxPerBooking: 6, icon: 'Smartphone' },
    ],
    shots: [
      ['1502933691298-84fc14542831', 'Paddleboards on mirror-flat water at sunrise off a Maui beach'],
      ['1505228395891-9a51e7e86bf6', 'First light over Haleakalā seen from the water'],
      ['1527004013197-933c4bb611b3', 'Boards tied to an anchor line in a calm bay'],
    ],
    colorKey: 'success',
    policy: {
      freeCancellationHours: 12,
      lateRefundPercent: 50,
      summary: 'Cancel free up to 12 hours before sunrise. Inside that, half is refunded. Wind cancellations by the teacher are refunded in full.',
    },
    resourceIds: ['res_sup_fleet'],
    rating: 5.0,
    reviewCount: 286,
    totalBookings: 1940,
    createdAt: '2023-02-09T06:40:00',
    updatedAt: '2026-08-22T07:18:00',
    seoTitle: 'Sunrise SUP Yoga in Kīhei, Maui | Blue Horizon Watersports',
    seoDescription:
      'Ninety minutes of paddleboard yoga on an anchored float line at sunrise. Stable boards, RYT-certified teachers, fourteen mats maximum, tea and fruit after.',
    featured: false,
  },
  {
    key: 'two_tank_certified_reef_dive',
    name: 'Two-Tank Certified Reef Dive',
    tagline: 'Two dives, two sites, and a divemaster who actually knows the reef.',
    description:
      'A proper morning of diving for people who already have a card. We run two sites chosen on the day for conditions rather than convenience — typically a lava arch system at 60 feet and a shallower cleaning station where turtles queue up — with a full surface interval, fruit and drinks between them. Groups are capped at six divers per guide and Diego dives with his own camera, so you leave with photos nobody had to ask for. Nitrox is available and the fills are banked the night before.',
    highlights: [
      'Two sites picked on the morning for conditions, not the schedule',
      'Six divers per guide, maximum',
      'Lava arches at 60ft and a shallow turtle cleaning station',
      'Nitrox available, banked and analysed before departure',
      'Guide-shot photos shared with every diver at no charge',
    ],
    included: [
      'Two guided dives with tanks and weights',
      'Divemaster in the water with each group',
      'Full surface interval with fruit, snacks and drinks',
      'Dive computer briefing and site maps',
      'Digital logbook entry emailed after the trip',
    ],
    excluded: ['BCD, regulator and wetsuit unless the rental tier is selected', 'Nitrox fills', 'Gratuities'],
    requirements: [
      'Open Water certification or higher, card presented at check-in',
      'A logged dive within the past 24 months, or add a refresher',
      'No flying for 18 hours after the second dive',
      'Minimum age 12 (Junior Open Water, depth limited)',
    ],
    meetingPoint: 'Ma‘alaea Harbor, Slip 39 — Kai Wa‘a. Check in 45 minutes before departure with your certification card.',
    status: 'live',
    difficulty: 'moderate',
    durationMinutes: 270,
    minAge: 12,
    maxCapacity: 20,
    minParticipants: 4,
    pricingModel: 'tiered',
    tiers: [
      { label: 'Certified Diver (Own Gear)', price: 18900, min: 0, max: 12, description: 'Tanks, weights and guiding only.' },
      { label: 'Certified Diver + Full Rental', price: 23900, min: 0, max: 12, description: 'BCD, regulator, computer and 3mm suit included.' },
      { label: 'Private Guide (max 2 divers)', price: 54500, min: 0, max: 1, description: 'Your own divemaster and your own profile.' },
    ],
    addOns: [
      { label: 'Nitrox Fill', price: 3500, description: 'EAN32 on both tanks, analysed at the dock.', maxPerBooking: 8, icon: 'Wind' },
      { label: 'Dive Computer', price: 1500, description: 'Wrist computer with a nitrox mode.', maxPerBooking: 6, icon: 'Watch' },
      { label: 'Underwater Video', price: 9500, description: '4K footage of your two dives cut to a short film.', maxPerBooking: 1, icon: 'Video' },
      { label: 'Prescription Mask', price: 1500, description: 'Corrective lenses -2.0 to -6.0.', maxPerBooking: 4, icon: 'Glasses' },
    ],
    shots: [
      ['1544551763-46a013bb70d5', 'Diver silhouetted inside a lava arch on a Maui reef'],
      ['1471922694854-ff1b63b20054', 'Reef fish massing over hard coral at a cleaning station'],
      ['1437622368342-7a3d73a34c8f', 'Green sea turtle resting on the reef while fish clean its shell'],
      ['1530549387789-4c1017266635', 'Divers descending a line into clear blue water'],
    ],
    colorKey: 'info',
    policy: {
      freeCancellationHours: 48,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 48 hours out; 50% inside that. Surge or visibility cancellations called by the divemaster are refunded in full.',
    },
    resourceIds: ['res_dive_boat_kaiwaa', 'res_scuba_tanks'],
    rating: 4.8,
    reviewCount: 1102,
    totalBookings: 6480,
    createdAt: '2021-08-06T08:15:00',
    updatedAt: '2026-09-01T10:44:00',
    seoTitle: 'Two-Tank Certified Reef Dive, Maui | Blue Horizon Watersports',
    seoDescription:
      'Two guided morning dives on Maui reef with six divers per guide, sites chosen for conditions, nitrox available and guide-shot photos included.',
    featured: true,
  },
  {
    key: 'west_maui_snorkel_raft',
    name: 'West Maui Snorkel Raft Adventure',
    tagline: 'Twelve guests, one fast RIB, and sea caves the big boats cannot enter.',
    description:
      'Manta is a 28-foot rigid inflatable that gets into places a 55-foot catamaran will never see. We run the west Maui coastline at speed, nose into sea caves and lava tubes, then anchor at two snorkel sites chosen for whatever the morning has given us. Twelve guests maximum means nobody queues for the ladder and the guide is genuinely available. You sit on the tube with your feet braced — it is a wet, fast, loud trip, and that is exactly the point.',
    highlights: [
      'Twelve guests maximum on a boat rated for sixteen',
      'Sea caves and lava tubes closed to larger vessels',
      'Two snorkel stops chosen on the morning for conditions',
      'Fast, low-to-the-water ride along the west Maui cliffs',
      'Guide in the water at both stops, not shouting from the rail',
    ],
    included: [
      'Four-hour raft trip with a captain and an in-water guide',
      'Mask, snorkel, fins and flotation',
      'Cold drinks, fresh fruit and local snacks',
      'Dry bag per party for phones and cameras',
      'Freshwater rinse back at the ramp',
    ],
    excluded: ['Hotel transfers', 'GoPro rental', 'Wetsuit tops'],
    requirements: [
      'Minimum age 8 — the ride is genuinely bumpy',
      'Not suitable during pregnancy or with back or neck injuries',
      'Confident swimming in open water away from shore',
      'No rigid coolers or hard-shell bags on board',
    ],
    meetingPoint: 'Kīhei Boat Ramp — meet at the Manta trailer 20 minutes before departure. Sunscreen on before you arrive, not on the tube.',
    status: 'live',
    difficulty: 'moderate',
    durationMinutes: 240,
    minAge: 8,
    maxCapacity: 12,
    minParticipants: 4,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 13900, min: 1, max: 10 },
      { label: 'Child (8-12)', price: 9900, min: 0, max: 6, description: 'Seated mid-tube with a guide alongside.' },
    ],
    addOns: [
      { label: 'GoPro Rental', price: 4500, description: 'HERO12 with a floating grip and card included.', maxPerBooking: 4, icon: 'Camera' },
      { label: 'Action Photo Package', price: 5900, description: 'Cave and snorkel shots from the guide, sent the same day.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Wetsuit Top', price: 1500, description: '2mm shorty for the ride back into the wind.', maxPerBooking: 6, icon: 'Shirt' },
    ],
    shots: [
      ['1500375592092-40eb2168fd21', 'Rigid inflatable boat running fast along a rugged lava coastline'],
      ['1471922694854-ff1b63b20054', 'Snorkel site over healthy coral on the west Maui shoreline'],
      ['1473116763249-2faaef81ccda', 'Sea cave entrance at the waterline on the west Maui coast'],
    ],
    colorKey: 'coral',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 24 hours ahead, 50% inside that. Small boats are weather-sensitive — any captain-called cancellation is refunded in full.',
    },
    resourceIds: ['res_rib_manta', 'res_snorkel_gear'],
    rating: 4.7,
    reviewCount: 431,
    totalBookings: 2260,
    createdAt: '2022-05-28T10:25:00',
    updatedAt: '2026-09-08T08:30:00',
    seoTitle: 'West Maui Snorkel Raft Adventure | Blue Horizon Watersports',
    seoDescription:
      'A twelve-guest rigid inflatable running west Maui sea caves and two snorkel sites. Fast, small-group, guide in the water at every stop.',
    featured: false,
  },
  {
    key: 'private_catamaran_charter',
    name: 'Private Catamaran Charter',
    tagline: 'Nalu, your crew, and a day written entirely by you.',
    description:
      'Take the whole boat. Weddings, company offsites, milestone birthdays, or just a family who would rather not share the rail — Nalu charters with four crew and an itinerary you set. Sail the Lānaʻi coast, anchor at Coral Gardens for a long swim, or simply drift off Wailea while the caterer works. Our events lead plans the run sheet with you in the fortnight beforehand, handles the licensing for live music, and builds the timeline around your sunset rather than our schedule. Catering, bar and entertainment are all upgradeable.',
    highlights: [
      'Exclusive use of a 49ft sailing catamaran with four crew',
      'Your itinerary, your timings, your playlist',
      'Events lead assigned two weeks out to plan the run sheet',
      'Licensed bar, full catering and live music available',
      'Ceremony-legal deck space for weddings up to 40 guests',
    ],
    included: [
      'Exclusive charter with captain, mate and two hosts',
      'Snorkel gear and flotation for every guest',
      'Soft drinks, water and ice throughout',
      'Bluetooth sound system and deck shade',
      'Dedicated events coordinator from booking to departure',
    ],
    excluded: ['Catering and bar packages', 'Live music and photography', 'Officiant and floral styling'],
    requirements: [
      'Fifty percent deposit at booking, balance due 14 days before',
      'Final guest count confirmed 7 days before departure',
      'Wedding charters need the ceremony run sheet 14 days out',
      'Maximum 40 guests plus crew under the vessel certificate',
    ],
    meetingPoint: 'Ma‘alaea Harbor, Slip 42 — your coordinator meets the party at the harbour gate 30 minutes before boarding.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 240,
    minAge: 0,
    maxCapacity: 40,
    minParticipants: 1,
    pricingModel: 'per_group',
    tiers: [
      { label: 'Three-Hour Sunset Charter (up to 30)', price: 189500, min: 0, max: 1 },
      { label: 'Half-Day Charter (up to 40)', price: 249500, min: 0, max: 1, description: 'Five hours with one snorkel stop.' },
      { label: 'Full-Day Lānaʻi Charter (up to 40)', price: 349500, min: 0, max: 1, description: 'Eight hours, channel crossing and two anchorages.' },
    ],
    addOns: [
      { label: 'Premium Catering', price: 45000, description: 'Chef-prepared island menu for up to 40, served on board.', maxPerBooking: 1, icon: 'ChefHat' },
      { label: 'Open Bar Package', price: 32000, description: 'Licensed bar with local beer, wine and cocktails for four hours.', maxPerBooking: 1, icon: 'Martini' },
      { label: 'Live Musician', price: 55000, description: 'Slack-key guitarist or duo for two sets underway.', maxPerBooking: 1, icon: 'Music' },
      { label: 'Floral Lei Greeting', price: 1800, description: 'Fresh lei presented to each guest at the gangway.', maxPerBooking: 40, icon: 'Flower' },
      { label: 'Onboard Photographer', price: 68000, description: 'Three hours of coverage, 150+ edited images delivered in 48 hours.', maxPerBooking: 1, icon: 'Camera' },
    ],
    shots: [
      ['1483683804023-6ccdb62f86ef', 'Private catamaran anchored in calm water with guests on the trampolines'],
      ['1439405326854-014607f694d7', 'Sailing yacht under canvas on a private charter afternoon'],
      ['1473116763249-2faaef81ccda', 'Charter party gathered on deck as the sun drops toward Lānaʻi'],
      ['1507525428034-b723cf961d3e', 'Anchorage at Coral Gardens with clear water beneath the hull'],
    ],
    colorKey: 'sunset',
    policy: {
      freeCancellationHours: 336,
      lateRefundPercent: 50,
      summary: 'Charters cancel free up to 14 days out. Inside 14 days the deposit is retained and 50% of the balance refunded. Weather cancellations are rebooked at no cost.',
    },
    resourceIds: ['res_catamaran_nalu', 'res_snorkel_gear'],
    rating: 5.0,
    reviewCount: 164,
    totalBookings: 612,
    createdAt: '2021-10-12T12:00:00',
    updatedAt: '2026-08-25T16:50:00',
    seoTitle: 'Private Catamaran Charter in Maui — Weddings & Events | Blue Horizon',
    seoDescription:
      'Charter a 49ft sailing catamaran from Ma‘alaea with four crew, up to 40 guests and an itinerary you set. Catering, licensed bar and live music available.',
    featured: false,
  },
  {
    key: 'keiki_ocean_explorer_camp',
    name: 'Keiki Ocean Explorer Camp',
    tagline: 'Five days of paddling, snorkelling and reef science for ages 6-12.',
    description:
      'A day camp for kids who would rather be in the water than beside it. Mornings move between paddleboards, tandem kayaks and guided snorkelling; afternoons are reef ecology run as fieldwork, not a worksheet — plankton tows, coral identification, and a plastics audit of the beach they swim off. Every instructor is lifeguard certified and the ratio never exceeds four children to one adult. Campers finish the week with a logbook of everything they identified and a genuinely unreasonable amount of enthusiasm for sea cucumbers.',
    highlights: [
      'Four children per instructor, every session, no exceptions',
      'Paddleboarding, kayaking and guided snorkelling each morning',
      'Hands-on reef ecology: plankton tows, coral ID, beach plastics audit',
      'All instructors lifeguard and CPR certified',
      'Species logbook to take home at the end of the week',
    ],
    included: [
      'Five hours of supervised instruction per day',
      'All watercraft, snorkel gear and flotation',
      'Morning snack and afternoon fruit',
      'Camp rash guard and species logbook',
      'Daily photo update to parents',
    ],
    excluded: ['Lunch unless added at checkout', 'Transport to and from the beach base', 'Extended care past 3pm'],
    requirements: [
      'Ages 6-12, able to swim 25 metres unaided',
      'Swim assessment on the first morning — no exceptions',
      'Parent or guardian must sign the medical and waiver forms in person on day one',
      'Reef-safe sunscreen applied before drop-off',
    ],
    meetingPoint: 'Kalama Beach Park, Kīhei — drop-off at the Blue Horizon canopy on the south grass, 8:45am daily.',
    status: 'draft',
    difficulty: 'easy',
    durationMinutes: 300,
    minAge: 6,
    maxCapacity: 12,
    minParticipants: 4,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Single Day', price: 12900, min: 0, max: 4 },
      { label: 'Five-Day Week', price: 54500, min: 0, max: 4, compareAtPrice: 64500, description: 'Monday to Friday, the full curriculum.' },
      { label: 'Sibling Rate (2nd Child)', price: 9900, min: 0, max: 3, description: 'Applies to the second and any subsequent child.' },
    ],
    addOns: [
      { label: 'Camp Lunch', price: 1500, description: 'Sandwich, fruit and a drink prepared daily.', maxPerBooking: 5, icon: 'Sandwich' },
      { label: 'Camp Rash Guard', price: 2400, description: 'Extra UPF 50 rash guard in your child’s size.', maxPerBooking: 3, icon: 'Shirt' },
      { label: 'Extended Care to 4pm', price: 2500, description: 'Supervised beach games and reading after the programme ends.', maxPerBooking: 5, icon: 'Clock' },
    ],
    shots: [
      ['1527004013197-933c4bb611b3', 'Kayaks and paddleboards drawn up on the sand ready for a camp session'],
      ['1502933691298-84fc14542831', 'Young paddlers on stand-up boards in shallow protected water'],
      ['1471922694854-ff1b63b20054', 'Reef fish over shallow coral, the focus of the camp ecology sessions'],
    ],
    colorKey: 'success',
    policy: {
      freeCancellationHours: 168,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 7 days before the camp week starts; 50% inside that. Missed individual days cannot be refunded or carried over.',
    },
    resourceIds: ['res_sup_fleet', 'res_kayak_fleet', 'res_snorkel_gear', 'res_briefing_hale'],
    rating: 4.9,
    reviewCount: 48,
    totalBookings: 210,
    createdAt: '2026-06-18T09:30:00',
    updatedAt: '2026-09-09T15:12:00',
    seoTitle: 'Keiki Ocean Explorer Camp, Kīhei Maui | Blue Horizon Watersports',
    seoDescription:
      'A five-day ocean day camp for ages 6-12 in Kīhei. Paddleboarding, kayaking, guided snorkelling and hands-on reef science at a 4:1 ratio.',
    featured: false,
  },
  {
    key: 'intro_to_wing_foiling',
    name: 'Intro to Wing Foiling',
    tagline: 'The steepest, most addictive learning curve in watersports.',
    description:
      'Wing foiling looks impossible from the beach and feels almost manageable by the end of session two. We start on land with wing handling, move to a board with no foil so you learn to steer the power, then fit the foil once you can hold a line. Josh coaches from a jet ski so you get corrections in the moment rather than a debrief an hour later. Sessions run from the Kīhei flats, where the water is waist-deep for two hundred metres and a mistake costs you nothing but a walk back upwind.',
    highlights: [
      'Waist-deep launch area — no deep-water recoveries while learning',
      'Coached from a jet ski for live, in-the-moment corrections',
      'Progressive kit path: wing, then board, then foil',
      'Maximum three students per coach',
      'Helmet, impact vest and full rig included',
    ],
    included: [
      'Two-and-a-half hour coached session',
      'Wing, board, foil and safety leash',
      'Helmet and impact vest',
      'Land-based wing handling session',
      'Video review at the end of each session',
    ],
    excluded: ['Wetsuits', 'Equipment hire outside coached sessions', 'Photography'],
    requirements: [
      'Minimum age 14 and confident swimming in open water',
      'Prior board sport experience helps but is not required',
      'Wind-dependent — sessions may be moved to the afternoon at short notice',
      'Weight range 45-110kg for the available foil sizes',
    ],
    meetingPoint: 'Kīhei beach base, foil locker — meet at the container 20 minutes before your session for rigging.',
    status: 'draft',
    difficulty: 'challenging',
    durationMinutes: 150,
    minAge: 14,
    maxCapacity: 6,
    minParticipants: 1,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Two-Hour Intro', price: 22900, min: 0, max: 3 },
      { label: 'Three-Session Course', price: 59500, min: 0, max: 3, compareAtPrice: 68700, description: 'Three coached sessions across a week — where it actually clicks.' },
      { label: 'Private Coaching', price: 34500, min: 0, max: 2, description: 'One coach, one student, jet ski support throughout.' },
    ],
    addOns: [
      { label: 'Impact Vest', price: 1200, description: 'Upgraded high-float impact vest for the first sessions.', maxPerBooking: 3, icon: 'Shield' },
      { label: 'Helmet', price: 900, description: 'Watersports helmet in your size, yours for the course.', maxPerBooking: 3, icon: 'HardHat' },
      { label: 'Video Analysis', price: 4500, description: 'Slow-motion review of your session with written notes.', maxPerBooking: 3, icon: 'Video' },
    ],
    shots: [
      ['1500375592092-40eb2168fd21', 'Wind-ruffled water off the Kīhei flats on a trade wind afternoon'],
      ['1502680390469-be75c86b636f', 'Rider carving across flat water on a foil board'],
      ['1509914398892-963f53e6e2f1', 'Foil boards and wings rigged on the beach before a coaching session'],
    ],
    colorKey: 'reef',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 24 hours ahead, 50% inside that. No-wind days are rescheduled at no cost or refunded in full, your choice.',
    },
    resourceIds: ['res_foil_kit'],
    rating: 4.6,
    reviewCount: 22,
    totalBookings: 96,
    createdAt: '2026-07-04T14:45:00',
    updatedAt: '2026-09-10T11:20:00',
    seoTitle: 'Intro to Wing Foiling Lessons in Kīhei, Maui | Blue Horizon',
    seoDescription:
      'Learn to wing foil on the Kīhei flats with jet-ski coaching, three students per coach and all equipment included. Intro session or a three-session course.',
    featured: false,
  },
]

/* ==========================================================================
   CORAL CAY EXPEDITIONS — Port Douglas, QLD (AUD)
   ========================================================================== */

const CORAL_CAY_SPECS: ActivitySpec[] = [
  {
    key: 'outer_reef_triple_dive',
    name: 'Outer Reef Triple-Dive Day',
    tagline: 'Three dives on the Agincourt ribbons, ninety minutes from the marina.',
    description:
      'Sea Flame runs forty nautical miles to the Agincourt ribbon reefs, the outermost formations on the northern Great Barrier Reef and the clearest water in the system. Three dives across three moorings: a drift along the ribbon wall, a bommie system that holds giant trevally, and a shallow afternoon garden where the colour is absurd. Marine biologist Mei-Lin briefs each site with a hand-drawn map and dives with the group. Maximum twelve divers per guide, full nitrox available, and hot food between every dive.',
    highlights: [
      'Three dives at three separate Agincourt mooring sites',
      'Marine biologist briefing and in-water guiding on every dive',
      'Typical visibility 25-35 metres on the outer ribbons',
      'Nitrox available on board with fills between dives',
      'Hot lunch and freshly baked morning tea underway',
    ],
    included: [
      'Full-day trip with three guided dives',
      'Tanks, weights and dive guide',
      'Morning tea, buffet lunch and afternoon tea',
      'Reef tax and marine park environmental charge',
      'Wetsuit, mask, snorkel and fins',
    ],
    excluded: ['BCD and regulator hire unless included in your tier', 'Nitrox fills', 'Underwater photography package'],
    requirements: [
      'Certified divers must present a card and a dive logged within 12 months',
      'Complete the medical declaration before boarding',
      'No flying for 24 hours after a three-dive day',
      'Minimum age 12 for certified diving, 12 for introductory dives',
    ],
    meetingPoint: 'Marina Mirage, Berth 14, Wharf Street, Port Douglas — check in 45 minutes before the 8:00am departure.',
    status: 'live',
    difficulty: 'moderate',
    durationMinutes: 480,
    minAge: 12,
    maxCapacity: 72,
    minParticipants: 12,
    pricingModel: 'tiered',
    tiers: [
      { label: 'Certified Diver (3 Dives)', price: 32900, min: 0, max: 12 },
      { label: 'Introductory Diver (2 Dives)', price: 29900, min: 0, max: 8, description: 'No certification needed; instructor at 1:4 in the water.' },
      { label: 'Snorkeller', price: 24900, min: 0, max: 20, description: 'Guided snorkel tours at all three moorings.' },
      { label: 'Child Snorkeller (4-14)', price: 16900, min: 0, max: 10 },
    ],
    addOns: [
      { label: 'Nitrox Fills', price: 4500, description: 'EAN32 on all three tanks. Nitrox certification required.', maxPerBooking: 8, icon: 'Wind' },
      { label: 'Full Gear Hire', price: 5500, description: 'BCD, regulator, computer and dive torch for the day.', maxPerBooking: 10, icon: 'Anchor' },
      { label: 'Underwater Photo Package', price: 9900, description: 'Biologist-shot images from all three sites, delivered that evening.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Port Douglas Hotel Transfer', price: 2200, description: 'Round-trip coach pickup from Port Douglas accommodation.', maxPerBooking: 10, icon: 'Bus' },
    ],
    shots: [
      ['1544551763-46a013bb70d5', 'Diver drifting along the wall of an Agincourt ribbon reef'],
      ['1471922694854-ff1b63b20054', 'Dense hard coral garden with schooling fish on the outer Great Barrier Reef'],
      ['1507525428034-b723cf961d3e', 'Turquoise water over the ribbon reefs seen from the dive deck'],
      ['1437622368342-7a3d73a34c8f', 'Green turtle cruising over a bommie on the outer reef'],
      ['1500375592092-40eb2168fd21', 'Open ocean crossing from Port Douglas to the outer reef at dawn'],
    ],
    colorKey: 'info',
    policy: {
      freeCancellationHours: 48,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 48 hours before departure; 50% inside that. Reef days cancelled by us for weather are always fully refunded or moved.',
    },
    resourceIds: ['res_vessel_seaflame', 'res_scuba_kit_cc', 'res_snorkel_sets_cc'],
    rating: 4.9,
    reviewCount: 2340,
    totalBookings: 18620,
    createdAt: '2019-09-04T08:20:00',
    updatedAt: '2026-08-29T13:10:00',
    seoTitle: 'Outer Reef Triple-Dive Day, Agincourt Ribbon Reefs | Coral Cay Expeditions',
    seoDescription:
      'Three guided dives on the Agincourt ribbon reefs from Port Douglas with a marine biologist, nitrox available and 25-35m visibility. Snorkellers welcome.',
    featured: true,
  },
  {
    key: 'agincourt_snorkel_sail',
    name: 'Agincourt Ribbon Reefs Snorkel Sail',
    tagline: 'A sailing day on the outer reef, not a pontoon queue.',
    description:
      'Reef Dancer sails to two Agincourt mooring sites with forty-eight guests maximum — roughly a third of what the pontoon operators carry. Guided snorkel tours run continuously from the back deck, so you are never waiting for a slot, and the marine biology talk happens in the water rather than over a PA. Stinger suits are provided year round and the crew fit them properly. Lunch is cooked on board. If the wind is behind us on the way home we shut the engines down and sail.',
    highlights: [
      'Forty-eight guests maximum on the outer reef',
      'Continuous guided snorkel tours, no timed rotations',
      'Marine biology interpretation delivered in the water',
      'Stinger suits provided and fitted year round',
      'Sail home whenever the trade wind allows',
    ],
    included: [
      'Full-day outer reef trip with two mooring sites',
      'Mask, snorkel, fins, flotation vest and stinger suit',
      'Guided snorkel tours with a marine biologist',
      'Morning tea, hot buffet lunch and afternoon tea',
      'Reef tax and environmental management charge',
    ],
    excluded: ['Introductory or certified diving', 'Underwater photography', 'Alcoholic drinks'],
    requirements: [
      'Comfortable swimming in open water with a flotation vest',
      'Stinger suits are compulsory November to May',
      'Minimum age 4',
      'Motion sickness medication is advisable for the outer reef crossing',
    ],
    meetingPoint: 'Marina Mirage, Berth 16, Port Douglas — board from 8:00am for an 8:30am departure.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 450,
    minAge: 4,
    maxCapacity: 48,
    minParticipants: 10,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 25900, min: 1, max: 16 },
      { label: 'Child (4-14)', price: 14900, min: 0, max: 10 },
      { label: 'Family Pass (2 Adults + 2 Children)', price: 74900, min: 0, max: 2, description: 'Saves $17 against individual fares.' },
    ],
    addOns: [
      { label: 'Guided Snorkel Safari', price: 4900, description: 'Small-group biologist tour away from the main mooring.', maxPerBooking: 8, icon: 'Compass' },
      { label: 'Prescription Mask', price: 1800, description: 'Corrective lenses reserved to your name.', maxPerBooking: 4, icon: 'Glasses' },
      { label: 'Reef Photo Package', price: 8900, description: 'In-water photos of your group at both sites.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Port Douglas Hotel Transfer', price: 2200, description: 'Round-trip coach from Port Douglas accommodation.', maxPerBooking: 10, icon: 'Bus' },
    ],
    shots: [
      ['1471922694854-ff1b63b20054', 'Snorkellers above a vivid hard coral garden on the ribbon reefs'],
      ['1439405326854-014607f694d7', 'Sailing vessel under canvas returning from the outer Great Barrier Reef'],
      ['1530549387789-4c1017266635', 'Guided snorkel group following a marine biologist over the reef'],
      ['1507525428034-b723cf961d3e', 'Clear shallow water over reef flats at an Agincourt mooring'],
    ],
    colorKey: 'lagoon',
    policy: {
      freeCancellationHours: 48,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 48 hours out, 50% inside. Any trip we cancel for weather is refunded in full or rebooked at no charge.',
    },
    resourceIds: ['res_vessel_reefdancer', 'res_snorkel_sets_cc'],
    rating: 4.8,
    reviewCount: 1876,
    totalBookings: 14210,
    createdAt: '2019-10-22T09:15:00',
    updatedAt: '2026-08-12T11:40:00',
    seoTitle: 'Agincourt Ribbon Reefs Snorkel Sail from Port Douglas | Coral Cay',
    seoDescription:
      'Sail to two Agincourt outer reef moorings with 48 guests maximum, continuous guided snorkel tours, stinger suits and a hot lunch cooked on board.',
    featured: true,
  },
  {
    key: 'coral_sea_liveaboard',
    name: 'Three-Night Coral Sea Liveaboard',
    tagline: 'Eleven dives, four days, and reef that sees almost no one.',
    description:
      'Coral Light leaves Port Douglas on Wednesday afternoon and returns Saturday evening, running the far northern ribbons and the Coral Sea walls between them. Eleven dives are scheduled including two night dives and a dawn shark encounter at Osprey; the deck crew sets up your kit once and it stays rigged for the trip. Cabins are twin-share or private ensuite, eleven in total, and the boat never carries more than twenty-two guests. It is the trip our repeat divers book a year ahead.',
    highlights: [
      'Eleven dives in four days including two night dives',
      'Dawn shark encounter on the Coral Sea wall',
      'Twenty-two guests maximum across eleven cabins',
      'Kit rigged once by the deck crew and left set up',
      'Nitrox included on every dive for certified divers',
    ],
    included: [
      'Three nights aboard in your selected cabin',
      'Eleven dives with tanks, weights and nitrox',
      'All meals, snacks and non-alcoholic drinks',
      'Marine park and Coral Sea permits',
      'Transfers between Port Douglas accommodation and the berth',
    ],
    excluded: ['Alcoholic drinks', 'Equipment hire beyond tanks and weights', 'Crew gratuities'],
    requirements: [
      'Advanced Open Water or equivalent, with 20 logged dives',
      'Dive insurance covering liveaboard and remote operations is mandatory',
      'Medical declaration signed within 12 months',
      'No flying for 24 hours after the final dive on Saturday',
    ],
    meetingPoint: 'Marina Mirage, Berth 21, Port Douglas — boarding from 3:00pm Wednesday, departure 4:30pm.',
    status: 'live',
    difficulty: 'challenging',
    durationMinutes: 4320,
    minAge: 16,
    maxCapacity: 22,
    minParticipants: 8,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Twin Share Cabin', price: 189500, min: 0, max: 8, description: 'Shared cabin, shared bathroom. Per person.' },
      { label: 'Private Ensuite Cabin', price: 249500, min: 0, max: 6, description: 'Double or twin with a private bathroom. Per person.' },
      { label: 'Solo Traveller Cabin', price: 229500, min: 0, max: 4, description: 'Sole occupancy of a twin cabin — no single supplement games.' },
    ],
    addOns: [
      { label: 'Full Equipment Hire', price: 18500, description: 'BCD, regulator, computer and 5mm suit for the whole trip.', maxPerBooking: 6, icon: 'Anchor' },
      { label: 'Coral Sea Photography Course', price: 24500, description: 'Two workshop sessions and daily image reviews with the biologist.', maxPerBooking: 4, icon: 'Camera' },
      { label: 'Cairns Airport Transfer', price: 6500, description: 'Private transfer between Cairns airport and the berth, each way.', maxPerBooking: 6, icon: 'Plane' },
      { label: 'Dive Insurance (4 days)', price: 4900, description: 'Liveaboard-rated cover arranged through our broker.', maxPerBooking: 6, icon: 'ShieldCheck' },
    ],
    shots: [
      ['1544551763-46a013bb70d5', 'Diver hanging in blue water on a Coral Sea wall'],
      ['1473116763249-2faaef81ccda', 'Liveaboard vessel moored on a remote Coral Sea reef at dusk'],
      ['1471922694854-ff1b63b20054', 'Untouched hard and soft coral on a far northern ribbon reef'],
      ['1519681393784-d120267933ba', 'Night sky above the liveaboard between dive sites'],
      ['1500375592092-40eb2168fd21', 'Open Coral Sea swell on the overnight transit'],
    ],
    colorKey: 'reef',
    policy: {
      freeCancellationHours: 720,
      lateRefundPercent: 25,
      summary: 'Free cancellation up to 30 days before sailing. Inside 30 days we refund 25%, since cabins rarely resell at short notice. Trip insurance is strongly advised.',
    },
    resourceIds: ['res_liveaboard_corallight', 'res_tender_wirra', 'res_scuba_kit_cc'],
    rating: 5.0,
    reviewCount: 412,
    totalBookings: 1840,
    createdAt: '2020-02-11T14:00:00',
    updatedAt: '2026-09-03T09:25:00',
    seoTitle: 'Three-Night Coral Sea Liveaboard from Port Douglas | Coral Cay Expeditions',
    seoDescription:
      'Eleven dives over four days on the far northern ribbons and Coral Sea walls. Twenty-two guests maximum, nitrox included, twin share or private ensuite cabins.',
    featured: true,
  },
  {
    key: 'seawalker_reef_walk',
    name: 'Seawalker Guided Reef Walk',
    tagline: 'Walk the reef floor with your hair dry and your glasses on.',
    description:
      'A surface-supplied helmet keeps your head in a pocket of air, so you descend a ladder to the reef floor at five metres and simply walk — no mask, no regulator, no swimming ability required. Air comes down a hose from the boat and a guide walks with every pair. Fish crowd in almost immediately because the helmets have been going down on this mooring for eleven years. It is the only way we know to put a non-swimmer, a nervous first-timer and a grandparent on the reef floor in the same rotation.',
    highlights: [
      'No swimming ability, certification or mask required',
      'Keep your glasses on and your hair dry inside the helmet',
      'Guide walks with every pair for the full rotation',
      'Reef fish habituated to the helmets over eleven years',
      'Photographs taken by the guide on every walk',
    ],
    included: [
      'Twenty-five minute helmet walk at five metres',
      'Full safety briefing and equalisation training',
      'Guide escort throughout the walk',
      'Photographs of your walk delivered digitally',
      'Access to the reef day trip on Sea Flame',
    ],
    excluded: ['The outer reef day trip fare, which must be booked alongside', 'Diving or snorkelling equipment', 'Lunch'],
    requirements: [
      'Minimum age 12, maximum weight 130kg',
      'No respiratory, cardiac or ear conditions — medical declaration required',
      'Must be able to climb a vertical ladder unassisted',
      'Not available during pregnancy',
    ],
    meetingPoint: 'On board Sea Flame at the Agincourt mooring — report to the lower dive deck ten minutes before your rotation.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 45,
    minAge: 12,
    maxCapacity: 12,
    minParticipants: 1,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 18900, min: 1, max: 8 },
      { label: 'Youth (12-17)', price: 14900, min: 0, max: 6, description: 'Accompanied by an adult in the same rotation.' },
    ],
    addOns: [
      { label: 'Second Walk', price: 9900, description: 'A second rotation later in the day at half price.', maxPerBooking: 4, icon: 'Repeat' },
      { label: 'Walk Video', price: 6900, description: 'Guide-shot video of your rotation, edited and delivered that evening.', maxPerBooking: 1, icon: 'Video' },
      { label: 'Private Rotation', price: 24500, description: 'Exclusive use of the rotation for up to four walkers.', maxPerBooking: 1, icon: 'Users' },
    ],
    shots: [
      ['1471922694854-ff1b63b20054', 'Reef fish crowding around the mooring site used for helmet walks'],
      ['1544551763-46a013bb70d5', 'Guide escorting a pair along the reef floor at five metres'],
      ['1530549387789-4c1017266635', 'Descent ladder from the dive deck down to the reef shelf'],
    ],
    colorKey: 'success',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 100,
      summary: 'Cancel any time up to 24 hours before your reef day for a full refund. If you are medically cleared out at the briefing, the walk is refunded in full on the spot.',
    },
    resourceIds: ['res_vessel_seaflame', 'res_seawalker_helmets'],
    rating: 4.7,
    reviewCount: 1094,
    totalBookings: 8320,
    createdAt: '2020-06-30T10:05:00',
    updatedAt: '2026-07-19T12:35:00',
    seoTitle: 'Seawalker Guided Reef Walk, Great Barrier Reef | Coral Cay Expeditions',
    seoDescription:
      'Walk the Great Barrier Reef floor in a surface-supplied helmet. No swimming or certification needed, glasses stay on, guide escorts every pair.',
    featured: false,
  },
  {
    key: 'low_isles_marine_biology',
    name: 'Low Isles Sail & Marine Biology',
    tagline: 'A coral cay, a glass-bottom boat and a biologist who never stops.',
    description:
      'Low Isles sits fifteen kilometres off Port Douglas: a four-acre coral cay ringed by a lagoon reef you can snorkel straight off the beach. We sail out mid-morning, run glass-bottom boat tours over the giant clam garden, and Mei-Lin leads reef walks at low tide explaining what you are actually standing next to. There is shade, a sandy entry and a lagoon shallow enough for small children — which makes this the trip we send families on when the outer reef would be too much.',
    highlights: [
      'Sheltered lagoon with a sandy entry — ideal for young families',
      'Glass-bottom boat tours over the giant clam garden',
      'Guided reef walk at low tide with a marine biologist',
      'Shade, beach and a working lighthouse on the cay',
      'Sailing passage out and back on the trade wind',
    ],
    included: [
      'Six-hour sailing trip to Low Isles',
      'Mask, snorkel, fins and stinger suit',
      'Glass-bottom boat tour and guided snorkel',
      'Morning tea, tropical buffet lunch and afternoon tea',
      'Marine park environmental charge',
    ],
    excluded: ['Alcoholic drinks', 'Underwater photography', 'Scuba diving (not available at this site)'],
    requirements: [
      'Stinger suits compulsory November to May and provided free',
      'Children under 12 must stay with an adult in the lagoon',
      'Reef-safe sunscreen only — the cay is a protected habitat',
    ],
    meetingPoint: 'Marina Mirage, Berth 16, Port Douglas — board from 9:30am for a 10:00am sail.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 360,
    minAge: 0,
    maxCapacity: 40,
    minParticipants: 8,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 22900, min: 1, max: 14 },
      { label: 'Child (4-14)', price: 12900, min: 0, max: 10 },
      {
        label: 'Infant (0-3)',
        price: 0,
        min: 0,
        max: 4,
        description: 'Free of charge; no gear or seat allocated.',
        countsTowardCapacity: false,
      },
    ],
    addOns: [
      { label: 'Marine Biology Reef Walk', price: 3900, description: 'Small-group low-tide walk with the biologist.', maxPerBooking: 8, icon: 'Footprints' },
      { label: 'Family Photo Package', price: 7500, description: 'Beach and in-water photos of your group on the cay.', maxPerBooking: 1, icon: 'Images' },
      { label: 'Port Douglas Hotel Transfer', price: 2200, description: 'Round-trip coach from Port Douglas accommodation.', maxPerBooking: 8, icon: 'Bus' },
    ],
    shots: [
      ['1507525428034-b723cf961d3e', 'Coral cay ringed by a pale turquoise lagoon on a clear day'],
      ['1471922694854-ff1b63b20054', 'Giant clams and coral seen through the glass-bottom boat viewing panel'],
      ['1439405326854-014607f694d7', 'Sailing vessel anchored off the Low Isles lighthouse'],
      ['1530549387789-4c1017266635', 'Families snorkelling the shallow lagoon reef off the beach'],
    ],
    colorKey: 'coral',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 24 hours before sailing, 50% inside that. Weather cancellations on our side are always refunded in full.',
    },
    resourceIds: ['res_vessel_reefdancer', 'res_glassbottom_marlin', 'res_snorkel_sets_cc'],
    rating: 4.8,
    reviewCount: 1502,
    totalBookings: 11480,
    createdAt: '2019-11-08T10:45:00',
    updatedAt: '2026-08-05T14:15:00',
    seoTitle: 'Low Isles Sail & Marine Biology Day from Port Douglas | Coral Cay',
    seoDescription:
      'Sail to the Low Isles coral cay for lagoon snorkelling, glass-bottom boat tours and a guided low-tide reef walk with a marine biologist. Family friendly.',
    featured: false,
  },
  {
    key: 'reef_scenic_flight_day',
    name: 'Reef Day & Scenic Flight',
    tagline: 'See the ribbons from 1,500 feet, then swim them an hour later.',
    description:
      'The reef only makes sense from the air. This package pairs a full outer reef day on Sea Flame with a thirty-minute scenic flight over the Agincourt ribbons and the Daintree coastline, flown in the morning so you spend the boat trip recognising what you saw. Window seats are guaranteed — the aircraft is loaded to a manifest, not a scramble — and the pilot narrates the reef structure as you cross it. The flight departs Port Douglas airfield at 7:15am and has you at the marina by 8:15am.',
    highlights: [
      'Thirty-minute low-level flight over the Agincourt ribbons',
      'Guaranteed window seat, loaded to a manifest',
      'Full outer reef day on Sea Flame afterwards',
      'Daintree rainforest coastline on the return leg',
      'Pilot narration of the reef structure in flight',
    ],
    included: [
      'Thirty-minute scenic flight with a guaranteed window seat',
      'Transfer from the airfield to Marina Mirage',
      'Full outer reef day with guided snorkelling',
      'Morning tea, buffet lunch and afternoon tea',
      'All reef taxes and environmental charges',
    ],
    excluded: ['Diving of any kind', 'Alcoholic drinks', 'Hotel transfer to the airfield'],
    requirements: [
      'Combined passenger weight is declared at booking for aircraft loading',
      'Flight is weather dependent; the reef day runs regardless',
      'Check in at the airfield by 6:45am',
      'Minimum age 4 for the flight',
    ],
    meetingPoint: 'Port Douglas airfield, general aviation apron — check in at the Coral Cay desk by 6:45am for the 7:15am flight.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 540,
    minAge: 4,
    maxCapacity: 24,
    minParticipants: 4,
    pricingModel: 'tiered',
    tiers: [
      { label: 'Reef Day + Scenic Flight', price: 47900, min: 0, max: 8 },
      { label: 'Reef Day Only', price: 27900, min: 0, max: 12, description: 'For partners who would rather skip the aircraft.' },
      { label: 'Child (4-14) Reef Day + Flight', price: 21900, min: 0, max: 6 },
    ],
    addOns: [
      { label: 'Extended Daintree Loop', price: 12900, description: 'Fifteen extra minutes over Cape Tribulation and the Daintree River mouth.', maxPerBooking: 6, icon: 'Plane' },
      { label: 'Guided Snorkel Safari', price: 4900, description: 'Small-group biologist tour on the outer reef.', maxPerBooking: 8, icon: 'Compass' },
      { label: 'Reef Photo Package', price: 8900, description: 'In-water images from both moorings.', maxPerBooking: 1, icon: 'Images' },
    ],
    shots: [
      ['1507525428034-b723cf961d3e', 'Ribbon reefs seen from the air as pale shapes in deep blue water'],
      ['1471922694854-ff1b63b20054', 'Coral bommie photographed from the surface on the outer reef'],
      ['1470071459604-3b5ec3a7fe05', 'Daintree rainforest coastline meeting the sea on the return flight path'],
      ['1500375592092-40eb2168fd21', 'Open water between the coast and the outer reef at first light'],
    ],
    colorKey: 'sunset',
    policy: {
      freeCancellationHours: 48,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 48 hours out, 50% inside. If the flight is grounded for weather the flight portion is refunded in full and the reef day continues.',
    },
    resourceIds: ['res_vessel_seaflame', 'res_snorkel_sets_cc'],
    rating: 4.9,
    reviewCount: 618,
    totalBookings: 3260,
    createdAt: '2021-03-02T11:55:00',
    updatedAt: '2026-08-18T16:20:00',
    seoTitle: 'Great Barrier Reef Scenic Flight & Outer Reef Day | Coral Cay Expeditions',
    seoDescription:
      'A thirty-minute scenic flight over the Agincourt ribbons and the Daintree coast, paired with a full outer reef snorkelling day from Port Douglas.',
    featured: false,
  },
]

/* ==========================================================================
   SALTLINE KITCHEN & TERRACE — Oia, Santorini (EUR)
   ========================================================================== */

const SALTLINE_SPECS: ActivitySpec[] = [
  {
    key: 'caldera_sunset_tasting',
    name: 'Caldera Sunset Tasting Menu',
    tagline: 'Seven courses timed so the fourth lands as the sun touches the rim.',
    description:
      'Dimitra cooks the Aegean the way her grandmother did, with a decade of Copenhagen discipline behind it. Seven courses move from raw fish cured in vinsanto through fava, grilled octopus and a whole fish for the table, finishing with sour cherry and mastiha. The kitchen paces the menu against the sunset almanac, so the fish arrives while the light is still on the water and dessert comes with the caldera going violet. Forty-two covers a night on the terrace. We hold the last two rail tables for walk-ins at 21:30.',
    highlights: [
      'Seven courses paced to the actual sunset time, not a fixed clock',
      'Caldera rail seating with an unobstructed western view',
      'Fish landed at Ammoudi that morning, never held overnight',
      'Forty-two covers per service — the terrace never feels packed',
      'Optional pairing built on Santorini Assyrtiko and vinsanto',
    ],
    included: [
      'Seven-course tasting menu',
      'Bread, cultured butter and house olives',
      'Still and sparkling water throughout',
      'Table held for the full 2.5 hour service — no turn pressure',
      'Coffee or mountain tea to finish',
    ],
    excluded: ['Wine and cocktails unless the pairing tier is chosen', 'Service charge, which is discretionary', 'Transfers'],
    requirements: [
      'Dietary requirements must be confirmed 48 hours ahead — the menu is built to order',
      'Smart casual; the terrace is exposed and evenings cool quickly after sunset',
      'Card guarantee required; no-shows are charged €45 per cover',
      'Children under 6 dine from the kids menu on the inner row only',
    ],
    meetingPoint: 'Saltline Kitchen & Terrace, Nikolaou Nomikou 24, Oia — arrive 15 minutes before your seating; the last 200m is stepped and pedestrian only.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 150,
    minAge: 6,
    maxCapacity: 42,
    minParticipants: 1,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Seven-Course Tasting', price: 14500, min: 1, max: 8 },
      { label: 'Tasting with Wine Pairing', price: 21500, min: 0, max: 8, description: 'Five Santorini pours chosen by Yiannis.' },
      { label: 'Child Menu (6-12)', price: 5500, min: 0, max: 4, description: 'Three courses from the same kitchen, smaller and simpler.' },
    ],
    addOns: [
      { label: 'Rail Table Upgrade', price: 4000, description: 'Guaranteed front-row caldera table T1 or T2.', maxPerBooking: 1, icon: 'Star' },
      { label: 'Vinsanto Flight', price: 3200, description: 'Three vintages of Santorini vinsanto with the dessert course.', maxPerBooking: 8, icon: 'Wine' },
      { label: 'Celebration Cake', price: 2800, description: 'Sour cherry and mastiha cake with a written message.', maxPerBooking: 1, icon: 'Cake' },
      { label: 'Oia Transfer', price: 3500, description: 'Car to the Oia pedestrian gate and return to your hotel.', maxPerBooking: 2, icon: 'Car' },
    ],
    shots: [
      ['1414235077428-338989a2e8c0', 'Terrace tables set for service with the caldera beyond'],
      ['1504674900247-0877df9cc836', 'Plated tasting course photographed in low evening light'],
      ['1517248135467-4c7edcad34c4', 'Caldera rail seating as the sun drops toward the sea'],
      ['1424847651672-bf20a4b0982b', 'Grilled octopus and fava served family style on the terrace'],
    ],
    colorKey: 'sunset',
    policy: {
      freeCancellationHours: 48,
      lateRefundPercent: 0,
      summary: 'Cancel free up to 48 hours before your seating. Inside 48 hours, or for a no-show, we charge €45 per cover against the card on file.',
    },
    resourceIds: ['res_terrace_table_two', 'res_terrace_table_four'],
    rating: 4.9,
    reviewCount: 612,
    totalBookings: 4180,
    createdAt: '2026-07-01T09:00:00',
    updatedAt: '2026-09-06T18:30:00',
    seoTitle: 'Caldera Sunset Tasting Menu in Oia, Santorini | Saltline Kitchen & Terrace',
    seoDescription:
      'A seven-course Aegean tasting menu paced to the Santorini sunset, served on a caldera rail terrace with 42 covers a night. Wine pairing available.',
    featured: true,
  },
  {
    key: 'chefs_counter_eight_course',
    name: 'Chef’s Counter Eight-Course',
    tagline: 'Eight seats at the pass, one seating a night, Dimitra cooking.',
    description:
      'There are eight stools at the pass and one seating per service, at 20:00. Dimitra cooks the counter herself and talks through every plate as it goes down — where the fish came off the boat, why the fava is whipped rather than smooth, which vines the vinsanto came from. The menu is not published in advance because it is built each morning at Ammoudi and the Pyrgos markets. Expect eight courses, roughly two and a half hours, and a couple of things that never make it onto the terrace menu.',
    highlights: [
      'Eight seats, one seating per night, cooked by the chef-owner',
      'Menu built that morning at the harbour and the Pyrgos market',
      'Courses explained plate by plate as they are finished',
      'Two or three dishes that never appear on the terrace menu',
      'Reserve pairing available from the cellar allocation',
    ],
    included: [
      'Eight-course counter menu',
      'Bread service, house olives and cultured butter',
      'Still and sparkling water',
      'Kitchen tour before service',
      'Printed menu signed by the chef',
    ],
    excluded: ['Wine unless the pairing tier is chosen', 'Discretionary service', 'Transfers'],
    requirements: [
      'Book at least 7 days ahead — the counter books out weeks in advance in season',
      'Dietaries must be declared at booking; some cannot be accommodated at the counter',
      'Minimum age 14',
      'Full prepayment at booking; the seating cannot be held otherwise',
    ],
    meetingPoint: 'Saltline Kitchen & Terrace, Nikolaou Nomikou 24, Oia — present yourself at the host stand at 19:45 for the kitchen tour.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 165,
    minAge: 14,
    maxCapacity: 8,
    minParticipants: 2,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Counter Seat', price: 19500, min: 1, max: 8 },
      { label: 'Counter Seat with Reserve Pairing', price: 28500, min: 0, max: 8, description: 'Seven pours including cellar-only vintages.' },
    ],
    addOns: [
      { label: 'Caviar Supplement', price: 6500, description: 'Thirty grams of oscietra served with the fourth course.', maxPerBooking: 8, icon: 'Sparkles' },
      { label: 'Vinsanto Flight', price: 3200, description: 'Three vintages with the closing course.', maxPerBooking: 8, icon: 'Wine' },
      { label: 'Oia Transfer', price: 3500, description: 'Car to the pedestrian gate and back to your hotel.', maxPerBooking: 2, icon: 'Car' },
    ],
    shots: [
      ['1424847651672-bf20a4b0982b', 'Chef finishing a plate at the open kitchen pass'],
      ['1504674900247-0877df9cc836', 'Counter course plated and set down in front of a guest'],
      ['1517248135467-4c7edcad34c4', 'Eight stools set along the pass before service begins'],
    ],
    colorKey: 'coral',
    policy: {
      freeCancellationHours: 168,
      lateRefundPercent: 0,
      summary: 'Free cancellation up to 7 days before your seating. Inside 7 days the counter is non-refundable, though we will transfer the booking to another date once if we can refill the seat.',
    },
    resourceIds: ['res_chefs_counter'],
    rating: 5.0,
    reviewCount: 188,
    totalBookings: 960,
    createdAt: '2026-07-01T09:20:00',
    updatedAt: '2026-09-04T17:45:00',
    seoTitle: 'Chef’s Counter Eight-Course Menu, Oia Santorini | Saltline Kitchen',
    seoDescription:
      'Eight seats at the pass, one seating a night, cooked and narrated by chef-owner Dimitra Stavrou. Market-built menu with an optional reserve wine pairing.',
    featured: true,
  },
  {
    key: 'assyrtiko_cellar_flight',
    name: 'Assyrtiko Cellar Wine Flight',
    tagline: 'Six glasses under the barrel racks, with the man who bought them.',
    description:
      'Santorini grows its vines in baskets on the ground because the wind would shred them otherwise, and the wine that comes out tastes like nowhere else in Greece. Yiannis pours six glasses in the cellar beneath the kitchen — young Assyrtiko through barrel-aged nykteri to vinsanto — and explains what the volcanic soil and the kouloura training actually do to the fruit. Sixty to ninety minutes, ten seats at the bench, small plates from the kitchen between pours. It runs at 18:00 before service, which is also the coolest part of the day down there.',
    highlights: [
      'Six pours across Assyrtiko, nykteri and vinsanto',
      'Led by the maître d’, not a script',
      'Ten seats at the cellar bench, no more',
      'Small plates from the kitchen between pours',
      'Bottles available at cellar price to take away',
    ],
    included: [
      'Six tasting pours of Santorini wine',
      'Three small plates matched to the flight',
      'Bread, olives and water',
      'Cellar and vineyard training explanation',
      'Tasting notes to take home',
    ],
    excluded: ['Bottles purchased to take away', 'Dinner service afterwards', 'Transfers'],
    requirements: [
      'Minimum age 18 — Greek law, no exceptions',
      'The cellar sits at 18°C; bring a layer',
      'Steps down to the cellar are not wheelchair accessible',
    ],
    meetingPoint: 'Saltline Kitchen & Terrace, Oia — check in at the host stand at 17:50; the cellar entrance is through the kitchen corridor.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 90,
    minAge: 18,
    maxCapacity: 10,
    minParticipants: 2,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Six-Glass Flight', price: 7500, min: 1, max: 10 },
      { label: 'Reserve Flight', price: 12500, min: 0, max: 6, description: 'Includes two library vintages and a 1998 vinsanto.' },
      { label: 'Sommelier Masterclass', price: 16500, min: 0, max: 6, description: 'Ninety minutes, eight pours, blind tasting exercise.' },
    ],
    addOns: [
      { label: 'Cheese Board', price: 2400, description: 'Aged Santorini chloro, graviera and manouri.', maxPerBooking: 5, icon: 'UtensilsCrossed' },
      { label: 'Vinsanto Half Bottle', price: 4800, description: 'Take a 375ml bottle of the closing wine home at cellar price.', maxPerBooking: 4, icon: 'Wine' },
      { label: 'Terrace Table After', price: 3000, description: 'Hold a terrace table for dinner immediately after the flight.', maxPerBooking: 1, icon: 'CalendarPlus' },
    ],
    shots: [
      ['1517248135467-4c7edcad34c4', 'Tasting glasses lined along a cellar bench beneath barrel racks'],
      ['1424847651672-bf20a4b0982b', 'Small plates set out between pours in the cellar'],
      ['1414235077428-338989a2e8c0', 'Stone cellar vaults below the kitchen at Saltline'],
    ],
    colorKey: 'reef',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 24 hours ahead; 50% inside that, since the library bottles are opened for your session.',
    },
    resourceIds: ['res_wine_cellar'],
    rating: 4.8,
    reviewCount: 274,
    totalBookings: 1620,
    createdAt: '2026-07-03T10:10:00',
    updatedAt: '2026-08-28T16:05:00',
    seoTitle: 'Assyrtiko Cellar Wine Flight in Oia, Santorini | Saltline Kitchen & Terrace',
    seoDescription:
      'Six Santorini pours from young Assyrtiko to vinsanto at a ten-seat cellar bench, led by the maître d’ with small plates between glasses.',
    featured: false,
  },
  {
    key: 'aegean_long_lunch',
    name: 'Aegean Long Lunch',
    tagline: 'Three hours, shared plates, and nowhere else to be.',
    description:
      'Lunch at Saltline is deliberately unhurried: plates arrive in three waves and the table is yours until 16:00, no matter when you sit. Expect grilled vegetables from the Pyrgos growers, fava with capers, whatever came off the Ammoudi boats, and a slow-roasted lamb shoulder that takes six hours and disappears in ten minutes. The inner terrace is shaded from noon, which is the only civilised way to eat outdoors in Oia in August. Wine by the glass, carafe or bottle from the same cellar as the evening list.',
    highlights: [
      'Table held until 16:00 regardless of your seating time',
      'Three waves of shared plates rather than fixed courses',
      'Shaded inner terrace — genuinely comfortable in high summer',
      'Slow-roasted lamb shoulder carved at the table',
      'Same cellar list as dinner, by the glass or carafe',
    ],
    included: [
      'Three waves of shared plates for the table',
      'Bread, olives and dips',
      'Still and sparkling water',
      'Table held for up to three hours',
      'Greek coffee or mountain tea to finish',
    ],
    excluded: ['Wine and other drinks', 'Discretionary service', 'Transfers'],
    requirements: [
      'Minimum two guests — the menu is built for sharing',
      'Dietary requirements 24 hours ahead',
      'Last seating is 14:00; the kitchen closes the service at 16:00',
    ],
    meetingPoint: 'Saltline Kitchen & Terrace, Nikolaou Nomikou 24, Oia — the inner terrace entrance, one level below the main gate.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 180,
    minAge: 0,
    maxCapacity: 36,
    minParticipants: 2,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 8500, min: 2, max: 10 },
      { label: 'Child (4-12)', price: 4200, min: 0, max: 6 },
      {
        label: 'Infant (0-3)',
        price: 0,
        min: 0,
        max: 3,
        description: 'High chair provided; no cover charged.',
        countsTowardCapacity: false,
      },
    ],
    addOns: [
      { label: 'Lamb Shoulder', price: 5500, description: 'Six-hour lamb shoulder for the table, carved at the pass.', maxPerBooking: 2, icon: 'UtensilsCrossed' },
      { label: 'House Carafe (500ml)', price: 1800, description: 'Assyrtiko or rosé from the barrel.', maxPerBooking: 6, icon: 'Wine' },
      { label: 'Shaded Rail Table', price: 2500, description: 'Upgrade to a shaded table on the caldera rail.', maxPerBooking: 1, icon: 'Umbrella' },
    ],
    shots: [
      ['1517248135467-4c7edcad34c4', 'Shaded terrace tables laid for a long lunch above the caldera'],
      ['1424847651672-bf20a4b0982b', 'Shared plates of grilled vegetables, fava and fish on a wooden table'],
      ['1504674900247-0877df9cc836', 'Slow-roasted lamb shoulder carved for the table'],
    ],
    colorKey: 'lagoon',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 24 hours ahead. Inside that we refund half, and a no-show is charged €25 per cover.',
    },
    resourceIds: ['res_terrace_table_four', 'res_terrace_table_two'],
    rating: 4.6,
    reviewCount: 341,
    totalBookings: 2740,
    createdAt: '2026-07-02T11:30:00',
    updatedAt: '2026-08-20T13:25:00',
    seoTitle: 'Aegean Long Lunch on the Terrace, Oia Santorini | Saltline Kitchen',
    seoDescription:
      'A three-hour shared-plate lunch on a shaded caldera terrace in Oia. Market vegetables, Ammoudi fish and slow-roasted lamb, with your table held until 16:00.',
    featured: false,
  },
  {
    key: 'sundown_meze_hour',
    name: 'Sundown Meze & Raki Hour',
    tagline: 'The deck, a meze board and a carafe, from 18:00 until it goes dark.',
    description:
      'Not everyone wants a tasting menu. The lower deck runs a walk-up meze service from 18:00: low seating, cushions, a board of whatever the kitchen is proud of that day, and raki poured properly cold. It is the same view as the rail tables above at a third of the spend, and you can stay as long as you like once you have a spot. Boards are built for two and the kitchen will keep adding to them. Twenty-four seats, and on a clear evening in August they are gone by 18:20.',
    highlights: [
      'Same caldera view as the terrace at a third of the spend',
      'Low deck seating with cushions, not dining chairs',
      'Meze board built from whatever the kitchen is proudest of that day',
      'Raki, ouzo and Santorini beer poured properly cold',
      'Stay as long as you like once you are seated',
    ],
    included: [
      'Meze board as selected',
      'Bread, olives and dips',
      'Water',
      'Deck seating with cushions and blankets after dark',
    ],
    excluded: ['Raki, ouzo, wine and beer', 'Hot dishes from the main kitchen', 'Table service after 21:30'],
    requirements: [
      'Minimum age 18 after 21:00 on the deck',
      'Deck seating is first come for walk-ins; reservations hold until 18:15 only',
      'The deck closes in high wind — we move you inside or refund',
    ],
    meetingPoint: 'Saltline Kitchen & Terrace, Oia — take the outside steps down to the lower deck; no need to pass through the restaurant.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 120,
    minAge: 0,
    maxCapacity: 24,
    minParticipants: 1,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Meze Board for Two', price: 6800, min: 0, max: 6, description: 'Eight items, built for two to share.' },
      { label: 'Solo Seat', price: 3600, min: 0, max: 4, description: 'Four items and a seat on the rail.' },
    ],
    addOns: [
      { label: 'Raki Carafe (250ml)', price: 1600, description: 'House raki, served over ice with cucumber.', maxPerBooking: 6, icon: 'Wine' },
      { label: 'Grilled Octopus', price: 2200, description: 'Added to the board straight off the grill.', maxPerBooking: 4, icon: 'UtensilsCrossed' },
      { label: 'Sunset Cushion Reservation', price: 1500, description: 'Holds a front-rail deck spot until 18:45.', maxPerBooking: 2, icon: 'Star' },
    ],
    shots: [
      ['1414235077428-338989a2e8c0', 'Low deck seating with cushions overlooking the caldera at dusk'],
      ['1424847651672-bf20a4b0982b', 'Meze board of small plates set out on a low table'],
      ['1517248135467-4c7edcad34c4', 'Guests on the lower deck as the light goes from the caldera'],
    ],
    colorKey: 'success',
    policy: {
      freeCancellationHours: 6,
      lateRefundPercent: 100,
      summary: 'Cancel any time up to six hours before your slot at no charge. Deck reservations release at 18:15 if you have not arrived.',
    },
    resourceIds: ['res_sunset_deck'],
    rating: 4.7,
    reviewCount: 208,
    totalBookings: 1980,
    createdAt: '2026-07-05T12:40:00',
    updatedAt: '2026-09-07T19:10:00',
    seoTitle: 'Sundown Meze & Raki Hour on the Deck, Oia | Saltline Kitchen & Terrace',
    seoDescription:
      'Walk-up meze and raki service on the lower deck in Oia from 18:00. Same caldera view as the terrace, low seating, boards built for two.',
    featured: false,
  },
  {
    key: 'private_cave_room_dinner',
    name: 'Private Cave Room Dinner',
    tagline: 'A vaulted room cut into the cliff, yours for the evening.',
    description:
      'The cave room is the original 1890s cistern, cut straight into the volcanic rock below the kitchen, and it seats fourteen at one long table. Hire it and the evening is yours: a bespoke menu agreed with Dimitra beforehand, your own service team, and a room that sits at a steady 18°C while August does what August does outside. It suits milestone dinners, small weddings and companies that want a table nobody else can walk past. Booked as a buyout or per guest with a minimum of eight.',
    highlights: [
      'Original 1890s cistern cut into the volcanic cliff',
      'One long table for up to fourteen guests',
      'Menu agreed with the chef in advance, not chosen off a list',
      'Dedicated service team for the evening',
      'Steady 18°C — the coolest room in Oia in high summer',
    ],
    included: [
      'Exclusive use of the cave room for four hours',
      'Bespoke menu planned with the chef',
      'Dedicated captain and two servers',
      'Candlelight, linen and floral centrepiece',
      'Still and sparkling water throughout',
    ],
    excluded: ['Wine and spirits', 'Music and entertainment', 'Transfers to the Oia gate'],
    requirements: [
      'Minimum eight guests; maximum fourteen',
      'Menu confirmed 14 days before the dinner',
      'Fifty percent deposit at booking, balance on the night',
      'The cave is reached by fifteen stone steps and is not wheelchair accessible',
    ],
    meetingPoint: 'Saltline Kitchen & Terrace, Oia — your captain meets the party at the main gate and walks you down to the cave.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 240,
    minAge: 0,
    maxCapacity: 14,
    minParticipants: 8,
    pricingModel: 'per_group',
    tiers: [
      { label: 'Cave Room Buyout (up to 14)', price: 195000, min: 0, max: 1, description: 'Whole room, bespoke menu, dedicated team.' },
      { label: 'Per Guest (minimum 8)', price: 16500, min: 0, max: 14, description: 'Shared cave room hire priced per cover.' },
    ],
    addOns: [
      { label: 'Sommelier Pairing', price: 9500, description: 'Per guest, six pours matched to your bespoke menu.', maxPerBooking: 14, icon: 'Wine' },
      { label: 'Live Bouzouki Duo', price: 45000, description: 'Two sets during dinner, agreed with you in advance.', maxPerBooking: 1, icon: 'Music' },
      { label: 'Floral Styling', price: 28000, description: 'Full table styling by our Oia florist.', maxPerBooking: 1, icon: 'Flower' },
      { label: 'Photographer', price: 52000, description: 'Two hours of coverage, 80+ edited images in 72 hours.', maxPerBooking: 1, icon: 'Camera' },
    ],
    shots: [
      ['1414235077428-338989a2e8c0', 'Long table set with candles in a vaulted stone cave room'],
      ['1517248135467-4c7edcad34c4', 'Whitewashed vaulted ceiling of the 1890s cistern dining room'],
      ['1504674900247-0877df9cc836', 'Bespoke course plated for a private dinner in the cave'],
    ],
    colorKey: 'info',
    policy: {
      freeCancellationHours: 336,
      lateRefundPercent: 0,
      summary: 'Free cancellation up to 14 days before the dinner. Inside 14 days the deposit is retained, as the room and team are committed to your evening.',
    },
    resourceIds: ['res_cave_room'],
    rating: 4.9,
    reviewCount: 96,
    totalBookings: 410,
    createdAt: '2026-07-08T14:15:00',
    updatedAt: '2026-09-01T12:50:00',
    seoTitle: 'Private Cave Room Dinner in Oia, Santorini | Saltline Kitchen & Terrace',
    seoDescription:
      'Hire an 1890s cistern cut into the Santorini cliff for a private dinner of up to fourteen, with a bespoke menu and a dedicated service team.',
    featured: true,
  },
]

/* ==========================================================================
   RIDGELINE ADVENTURE CO. — Queenstown, NZ (NZD)
   ========================================================================== */

const RIDGELINE_SPECS: ActivitySpec[] = [
  {
    key: 'milford_heli_glacier',
    name: 'Milford Sound Heli & Glacier Landing',
    tagline: 'Two alpine landings, a fiord at sea level, and back for lunch.',
    description:
      'We lift from Queenstown, cross the Remarkables and run the Southern Alps to Milford Sound with two landings on the way — one on a snowfield above the Hollyford, one on the glacier itself, where you step out into complete silence at eighteen hundred metres. At the fiord we drop to sea level for a low run past Mitre Peak and Stirling Falls before turning for home over Lake Wakatipu. Four hours door to door. Pilots fly this route every day of the season and will tell you exactly what you are looking at.',
    highlights: [
      'Two alpine landings including a genuine glacier set-down',
      'Low-level run past Mitre Peak and Stirling Falls',
      'Crossing of the Southern Alps main divide both ways',
      'Five seats, every one a window seat',
      'Four hours door to door from central Queenstown',
    ],
    included: [
      'Approximately 2.5 hours of flight time',
      'Two alpine landings with time on the ice',
      'Pilot commentary through noise-cancelling headsets',
      'Glacier boots and jackets for the landings',
      'Transfer between the Brecon Street base and the hangar',
    ],
    excluded: ['Milford Sound boat cruise', 'Meals', 'Accommodation'],
    requirements: [
      'Individual passenger weights declared at booking for loading and balance',
      'Weather dependent — the pilot makes the final call on the morning',
      'Minimum age 2; under-15s must fly with an adult',
      'Closed footwear required for the glacier landings',
    ],
    meetingPoint: 'Ridgeline Base Lodge, 18 Brecon Street, Queenstown — check in 45 minutes before departure for the safety briefing and transfer.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 240,
    minAge: 2,
    maxCapacity: 5,
    minParticipants: 2,
    pricingModel: 'tiered',
    tiers: [
      { label: 'Per Seat', price: 89500, min: 0, max: 5 },
      { label: 'Couples Private Flight', price: 249500, min: 0, max: 1, description: 'Two guests, whole aircraft, no shared seats.' },
      { label: 'Whole-Aircraft Charter (up to 5)', price: 349500, min: 0, max: 1, description: 'Your party only, with a flexible departure window.' },
    ],
    addOns: [
      { label: 'Milford Sound Boat Cruise', price: 12900, description: 'Ninety-minute fiord cruise added between the landings.', maxPerBooking: 5, icon: 'Ship' },
      { label: 'Champagne on the Glacier', price: 18500, description: 'Chilled bottle and glasses carried to the landing site.', maxPerBooking: 2, icon: 'Sparkles' },
      { label: 'Flight Photography Package', price: 14500, description: 'Pilot-side camera footage and stills of your landings.', maxPerBooking: 1, icon: 'Camera' },
      { label: 'Hotel Transfer', price: 3500, description: 'Round-trip car from any central Queenstown hotel.', maxPerBooking: 5, icon: 'Car' },
    ],
    shots: [
      ['1464822759023-fed622ff2c3b', 'Snow-covered peaks of the Southern Alps from the air'],
      ['1506905925346-21bda4d32df4', 'Glacier landing site above a deep alpine valley'],
      ['1470071459604-3b5ec3a7fe05', 'Milford Sound with cloud breaking over the fiord walls'],
      ['1454496522488-7a8e488e8606', 'Ridge line and snowfield at the second landing'],
      ['1476514525535-07fb3b4ae5f1', 'Lake Wakatipu and the Remarkables on the return leg'],
    ],
    colorKey: 'reef',
    policy: {
      freeCancellationHours: 48,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 48 hours before your flight; 50% inside that. Weather cancellations by the pilot are always refunded in full or rescheduled.',
    },
    resourceIds: ['res_heli_tahr', 'res_glacier_kit', 'res_base_lodge'],
    rating: 5.0,
    reviewCount: 742,
    totalBookings: 3140,
    createdAt: '2018-01-22T08:30:00',
    updatedAt: '2026-09-02T11:15:00',
    seoTitle: 'Milford Sound Helicopter Flight with Glacier Landings | Ridgeline Adventure Co.',
    seoDescription:
      'Fly Queenstown to Milford Sound with two alpine landings including a glacier set-down, a low run past Mitre Peak and every seat a window seat.',
    featured: true,
  },
  {
    key: 'remarkables_alpine_climb',
    name: 'Remarkables Alpine Climb',
    tagline: 'A real alpine day on Single Cone, guided one-to-two.',
    description:
      'Single Cone is the highest point on the Remarkables skyline and the most accessible genuine alpine objective above Queenstown. We leave the base lodge at 5:30am, walk in through the Wye Creek basin, rope up for the summit ridge and are usually on top by mid-morning with the whole Wakatipu basin below. This is a climbing day, not a walk: crampons, an axe, exposure and some scrambling. No prior alpine experience is needed but you must be genuinely fit. Guides work at one to two, never wider.',
    highlights: [
      'True alpine summit, not a fenced lookout',
      'One guide to every two climbers, maximum',
      'Roped travel on the summit ridge with real exposure',
      'Crampons, axe, helmet and harness supplied and fitted',
      'Wakatipu basin, Eyre Mountains and the Hector range from the top',
    ],
    included: [
      'Full-day guided climb with an NZOIA or IFMGA guide',
      'Boots, crampons, ice axe, helmet and harness',
      'Transport from the base lodge to the trailhead',
      'Alpine safety and rope-work instruction',
      'Hot drinks and a summit lunch',
    ],
    excluded: ['Personal clothing layers', 'Sunglasses and sunscreen', 'Accommodation and meals off the mountain'],
    requirements: [
      'Strong fitness: 8 hours of movement with 1,100m of ascent',
      'Minimum age 16',
      'No alpine experience required, but hiking experience is essential',
      'Conditions are assessed at 4:30am; objectives can change on the day',
    ],
    meetingPoint: 'Ridgeline Base Lodge, 18 Brecon Street, Queenstown — 5:15am for gear fitting; vehicles leave at 5:30am sharp.',
    status: 'live',
    difficulty: 'challenging',
    durationMinutes: 600,
    minAge: 16,
    maxCapacity: 8,
    minParticipants: 2,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Guided Climb', price: 49500, min: 0, max: 6, description: 'One guide per two climbers.' },
      { label: 'Private Guide (1:1)', price: 89500, min: 0, max: 2, description: 'Your own guide and your own pace.' },
      { label: 'Team of Four', price: 169500, min: 0, max: 1, description: 'Two guides for a private party of four.' },
    ],
    addOns: [
      { label: 'Technical Clothing Hire', price: 6500, description: 'Shell jacket, trousers, gloves and a warm layer.', maxPerBooking: 6, icon: 'Shirt' },
      { label: 'Summit Photography', price: 15500, description: 'Guide-shot images on the ridge and summit, edited and delivered.', maxPerBooking: 1, icon: 'Camera' },
      { label: 'Avalanche Awareness Add-On', price: 9500, description: 'Two-hour transceiver and snowpack session the evening before.', maxPerBooking: 6, icon: 'Radio' },
    ],
    shots: [
      ['1533105079780-92b9be482077', 'Climber moving along an exposed alpine ridge above a glacial basin'],
      ['1464822759023-fed622ff2c3b', 'The Remarkables skyline under early morning alpine light'],
      ['1522163182402-834f871fd851', 'Roped party on the summit ridge of Single Cone'],
      ['1454496522488-7a8e488e8606', 'Wakatipu basin seen from the summit block'],
    ],
    colorKey: 'sunset',
    policy: {
      freeCancellationHours: 72,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 72 hours before the climb, 50% inside. Guides cancel for avalanche or weather risk without hesitation, and that is always refunded in full.',
    },
    resourceIds: ['res_climb_kit', 'res_4wd_landcruiser', 'res_base_lodge'],
    rating: 4.9,
    reviewCount: 386,
    totalBookings: 1620,
    createdAt: '2018-03-09T07:10:00',
    updatedAt: '2026-08-24T09:05:00',
    seoTitle: 'Remarkables Alpine Climb, Single Cone Queenstown | Ridgeline Adventure Co.',
    seoDescription:
      'A guided alpine climb of Single Cone above Queenstown at a 1:2 ratio. Roped ridge travel, all technical gear supplied, no prior alpine experience required.',
    featured: true,
  },
  {
    key: 'shotover_canyon_jetboat',
    name: 'Shotover Canyon Jet Boat',
    tagline: 'Canyon walls at arm’s length and a 360 you will not see coming.',
    description:
      'The Shotover canyons are narrow enough that the driver puts the boat within a metre of rock at speed, which is precisely why people do this. Twenty-five minutes on the water, twelve passengers, and a hull that runs in ten centimetres of river. Expect multiple full-rotation spins, a lot of shouting, and a genuinely close look at schist walls you would never otherwise get near. Drivers hold a commercial jet boat licence and the canyon run is briefed before you board. Fully waterproof jackets and life jackets provided.',
    highlights: [
      'Within a metre of the canyon walls at full speed',
      'Multiple 360-degree spins on the run',
      'Hull draws less than ten centimetres of water',
      'Twelve passengers and a crew of two on every run',
      'Waterproof jackets and life jackets provided',
    ],
    included: [
      'Twenty-five minute canyon jet boat run',
      'Waterproof jacket and life jacket',
      'Safety briefing and secure bag storage',
      'Onboard photo of your run',
      'Shuttle from the Brecon Street base to the jetty',
    ],
    excluded: ['Video of your run', 'Meals', 'Towels'],
    requirements: [
      'Minimum age 5 and minimum height 1.0m',
      'Not suitable during pregnancy or with back, neck or heart conditions',
      'You will get wet — leave phones and loose items in the lockers',
      'No loose hats or sunglasses without a strap',
    ],
    meetingPoint: 'Shotover Canyon jetty — shuttle departs Ridgeline Base Lodge, 18 Brecon Street, 40 minutes before your run.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 90,
    minAge: 5,
    maxCapacity: 12,
    minParticipants: 1,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 16900, min: 1, max: 10 },
      { label: 'Child (5-15)', price: 9900, min: 0, max: 8 },
      { label: 'Family Pass (2 Adults + 2 Children)', price: 46900, min: 0, max: 2, description: 'Saves $7 against individual fares.' },
    ],
    addOns: [
      { label: 'Onboard Video', price: 4900, description: 'Full-run footage from the bow camera, sent within the hour.', maxPerBooking: 1, icon: 'Video' },
      { label: 'Front Row Seats', price: 2500, description: 'The wettest, loudest seats on the boat, reserved.', maxPerBooking: 4, icon: 'Star' },
      { label: 'Queenstown Hotel Transfer', price: 2500, description: 'Round-trip shuttle from central Queenstown.', maxPerBooking: 8, icon: 'Bus' },
    ],
    shots: [
      ['1469474968028-56623f02e42e', 'Jet boat throwing spray through a narrow schist canyon'],
      ['1476514525535-07fb3b4ae5f1', 'Shotover River running green between steep canyon walls'],
      ['1470071459604-3b5ec3a7fe05', 'Canyon walls rising above the river on the jet boat run'],
    ],
    colorKey: 'coral',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 24 hours before your run, 50% inside that. River conditions and flood closures are refunded in full.',
    },
    resourceIds: ['res_jetboat_kawarau', 'res_alpine_coach'],
    rating: 4.8,
    reviewCount: 2914,
    totalBookings: 24680,
    createdAt: '2017-12-01T09:40:00',
    updatedAt: '2026-08-30T15:30:00',
    seoTitle: 'Shotover Canyon Jet Boat, Queenstown | Ridgeline Adventure Co.',
    seoDescription:
      'Twenty-five minutes of canyon jet boating on the Shotover River with 360-degree spins, twelve passengers per run and jackets provided.',
    featured: true,
  },
  {
    key: 'kawarau_raft_expedition',
    name: 'Kawarau Gorge Raft Expedition',
    tagline: 'Grade three to four, including the Dog Leg and the Chinese Dogleg drop.',
    description:
      'The Kawarau runs big, cold and continuous through the gorge below Gibbston, with enough volume to make grade four feel like grade four. Four hours from the put-in to the take-out covering seven named rapids, a swim stop in a calm pool and a run through the Dog Leg that most people remember for years. Guides are NZOIA qualified with a safety kayaker on every trip. Wetsuits, boots, fleeces and helmets are provided; you bring a swimsuit and a willingness to paddle when told.',
    highlights: [
      'Seven named grade 3-4 rapids in four hours on the water',
      'Safety kayaker accompanying every raft',
      'Swim stop in a calm pool below the gorge narrows',
      'Wetsuit, boots, fleece, spray jacket and helmet supplied',
      'Hot shower and a barbecue back at the base',
    ],
    included: [
      'Four-hour guided raft descent',
      'Full wetsuit kit, helmet and buoyancy aid',
      'NZOIA qualified guide and safety kayaker',
      'Transport from the base lodge to the put-in and back',
      'Hot showers and a barbecue at the take-out',
    ],
    excluded: ['Photography package', 'Towels', 'Alcohol at the barbecue'],
    requirements: [
      'Minimum age 13 and minimum weight 40kg',
      'Must be able to swim 50 metres in moving water',
      'Not suitable during pregnancy or with recent shoulder injuries',
      'River grade is flow dependent; trips are re-graded or cancelled in flood',
    ],
    meetingPoint: 'Ridgeline Base Lodge, 18 Brecon Street, Queenstown — check in 30 minutes before departure for wetsuit fitting.',
    status: 'live',
    difficulty: 'challenging',
    durationMinutes: 300,
    minAge: 13,
    maxCapacity: 24,
    minParticipants: 6,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 22900, min: 1, max: 12 },
      { label: 'Youth (13-17)', price: 17900, min: 0, max: 8 },
      { label: 'Whole Raft (up to 8)', price: 149500, min: 0, max: 2, description: 'Your group in your own raft with a dedicated guide.' },
    ],
    addOns: [
      { label: 'Photo & Video Package', price: 7900, description: 'Rapid-by-rapid stills and video from the bank team.', maxPerBooking: 1, icon: 'Camera' },
      { label: 'Gibbston Winery Stop', price: 6500, description: 'Tasting at a Gibbston Valley cellar door on the drive back.', maxPerBooking: 8, icon: 'Wine' },
      { label: 'Thermal Layer Hire', price: 1500, description: 'Extra thermal top under the wetsuit for cold months.', maxPerBooking: 8, icon: 'Shirt' },
    ],
    shots: [
      ['1469474968028-56623f02e42e', 'Raft dropping into whitewater in a steep river gorge'],
      ['1476514525535-07fb3b4ae5f1', 'Kawarau River running green through the Gibbston gorge'],
      ['1470071459604-3b5ec3a7fe05', 'Guides scouting a rapid from the bank before the descent'],
      ['1454496522488-7a8e488e8606', 'Gorge walls above the Kawarau take-out'],
    ],
    colorKey: 'info',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 24 hours ahead, 50% inside. Flood or low-flow cancellations called by the river manager are fully refunded.',
    },
    resourceIds: ['res_raft_fleet', 'res_alpine_coach', 'res_base_lodge'],
    rating: 4.8,
    reviewCount: 1476,
    totalBookings: 11240,
    createdAt: '2018-05-17T10:20:00',
    updatedAt: '2026-08-15T13:40:00',
    seoTitle: 'Kawarau Gorge Whitewater Rafting, Queenstown | Ridgeline Adventure Co.',
    seoDescription:
      'Four hours of grade 3-4 rafting through the Kawarau gorge with seven named rapids, a safety kayaker on every trip and full wetsuit kit supplied.',
    featured: false,
  },
  {
    key: 'moke_lake_ebike_picnic',
    name: 'Moke Lake E-Bike & Picnic',
    tagline: 'Twenty-two kilometres of gravel, one lake, and lunch under the willows.',
    description:
      'Moke Lake sits in a bowl of tussock twenty minutes from town and sees a fraction of the traffic the Wakatipu trails get. We ride out on full-suspension e-bikes — the motor turns the two climbs from a grind into a conversation — loop the lake on gravel, then stop under the willows at the far end where the guide unpacks a proper picnic from the support vehicle. Riders need to be comfortable on a bike but no mountain biking experience is required. Four hours out and back including the picnic.',
    highlights: [
      'Full-suspension e-bikes that make the climbs genuinely easy',
      'Gravel loop around a lake most visitors never reach',
      'Picnic laid out under the willows from the support vehicle',
      'Small groups with a guide and a sweep rider',
      'Helmets, gloves and a bike fitted to you at the depot',
    ],
    included: [
      'Four-hour guided ride with a support vehicle',
      'Full-suspension e-MTB, helmet and gloves',
      'Picnic lunch with local cheese, bread and seasonal produce',
      'Coffee and cold drinks at the lake',
      'Transport of bikes to and from the trailhead',
    ],
    excluded: ['Alcoholic drinks', 'Waterproof clothing', 'Photography'],
    requirements: [
      'Minimum age 10 and minimum height 1.4m for the frame sizes we carry',
      'Comfortable riding a bike on gravel; no mountain biking experience needed',
      'Rider weight limit 120kg',
      'Bring layers — the Moke basin is exposed and the wind gets up after noon',
    ],
    meetingPoint: 'Ridgeline depot, 18 Brecon Street, Queenstown — bike fitting from 9:15am for a 9:45am departure.',
    status: 'live',
    difficulty: 'easy',
    durationMinutes: 240,
    minAge: 10,
    maxCapacity: 12,
    minParticipants: 2,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 18900, min: 1, max: 8 },
      { label: 'Child (10-15)', price: 12900, min: 0, max: 4 },
      { label: 'Private Ride (up to 4)', price: 59500, min: 0, max: 1, description: 'Your own guide, your own pace and a tailored picnic.' },
    ],
    addOns: [
      { label: 'Gibbston Wine Picnic Upgrade', price: 4500, description: 'Two Gibbston Valley wines and an extended cheese board.', maxPerBooking: 8, icon: 'Wine' },
      { label: 'Ride Photography', price: 8500, description: 'Guide-shot images from the lake loop, edited and delivered.', maxPerBooking: 1, icon: 'Camera' },
      { label: 'Waterproof Jacket Hire', price: 1200, description: 'Shell jacket in your size for the ride.', maxPerBooking: 8, icon: 'Shirt' },
    ],
    shots: [
      ['1501785888041-af3ef285b470', 'Still alpine lake ringed by tussock hills under clear sky'],
      ['1476514525535-07fb3b4ae5f1', 'Gravel track skirting the shoreline of Moke Lake'],
      ['1502082553048-f009c37129b9', 'Willows at the far end of the lake where the picnic is laid out'],
    ],
    colorKey: 'success',
    policy: {
      freeCancellationHours: 24,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 24 hours ahead, 50% inside that. Rides cancelled for high wind or snow on the access road are refunded in full.',
    },
    resourceIds: ['res_ebike_fleet', 'res_4wd_landcruiser'],
    rating: 4.9,
    reviewCount: 512,
    totalBookings: 3480,
    createdAt: '2022-10-04T11:05:00',
    updatedAt: '2026-08-11T10:55:00',
    seoTitle: 'Moke Lake E-Bike Tour & Picnic, Queenstown | Ridgeline Adventure Co.',
    seoDescription:
      'A 22km guided e-bike loop around Moke Lake with a picnic under the willows, full-suspension bikes, a support vehicle and small groups.',
    featured: false,
  },
  {
    key: 'ben_lomond_summit_trek',
    name: 'Ben Lomond Summit Guided Trek',
    tagline: '1,748 metres, 360 degrees, and a guide who carries the spare layers.',
    description:
      'Ben Lomond is the summit that sits directly above Queenstown, and the view from the top takes in the whole Wakatipu basin, the Remarkables and, on a clear day, Aoraki. We take the gondola to save the first four hundred metres, then climb the saddle track and the summit ridge over about six hours return. It is a long day on your feet with exposure near the top but no technical climbing. Guides carry spare layers, a hot drink and the first aid kit, and set a pace the slowest person can sustain.',
    highlights: [
      '1,748m summit directly above Queenstown',
      'Gondola ascent included to save the first 400m of climb',
      '360-degree views to the Remarkables and, on a clear day, Aoraki',
      'Guides carry spare layers, hot drinks and the first aid kit',
      'Pace set by the slowest walker, always',
    ],
    included: [
      'Gondola ticket and guided ascent and descent',
      'Guide with mountain first aid and communications',
      'Hot drink and lunch at the summit',
      'Trekking poles and a day pack if required',
      'Spare thermal layers and a shell jacket carried by the guide',
    ],
    excluded: ['Boots (hire available)', 'Personal clothing', 'Transport to the gondola base'],
    requirements: [
      'Good fitness: 6 hours on foot with 1,000m of ascent',
      'Minimum age 12, accompanied by an adult',
      'Sturdy boots or trail shoes with ankle support',
      'The summit ridge is exposed; the guide may turn the party around in high wind',
    ],
    meetingPoint: 'Skyline Gondola base, Brecon Street, Queenstown — meet your guide at the ticket office 20 minutes before departure.',
    status: 'live',
    difficulty: 'moderate',
    durationMinutes: 420,
    minAge: 12,
    maxCapacity: 10,
    minParticipants: 2,
    pricingModel: 'per_person',
    tiers: [
      { label: 'Adult', price: 27900, min: 1, max: 8 },
      { label: 'Student / Backpacker', price: 22900, min: 0, max: 6, description: 'Valid student or hostel ID at the gondola base.' },
      { label: 'Private Guide', price: 69500, min: 0, max: 2, description: 'One guide for your party alone, up to four walkers.' },
    ],
    addOns: [
      { label: 'Boot Hire', price: 2500, description: 'Mountain boots in your size, fitted at the base lodge.', maxPerBooking: 8, icon: 'Footprints' },
      { label: 'Summit Photography', price: 9500, description: 'Guide-shot images along the ridge and at the summit.', maxPerBooking: 1, icon: 'Camera' },
      { label: 'Post-Trek Lodge Meal', price: 4500, description: 'Two courses and a beer at the base lodge on your return.', maxPerBooking: 8, icon: 'UtensilsCrossed' },
    ],
    shots: [
      ['1454496522488-7a8e488e8606', 'Summit ridge of Ben Lomond above the Wakatipu basin'],
      ['1551632811-561732d1e306', 'Guided party climbing the saddle track in morning light'],
      ['1506905925346-21bda4d32df4', 'Lake Wakatipu and the Remarkables seen from the summit'],
      ['1470071459604-3b5ec3a7fe05', 'Cloud breaking across the ridge on the descent'],
    ],
    colorKey: 'lagoon',
    policy: {
      freeCancellationHours: 48,
      lateRefundPercent: 50,
      summary: 'Free cancellation up to 48 hours before the trek, 50% inside. Guides turn parties around for weather without argument, and cancelled days are refunded in full.',
    },
    resourceIds: ['res_climb_kit', 'res_base_lodge'],
    rating: 4.8,
    reviewCount: 694,
    totalBookings: 4920,
    createdAt: '2019-04-18T08:00:00',
    updatedAt: '2026-08-07T12:10:00',
    seoTitle: 'Ben Lomond Summit Guided Trek, Queenstown | Ridgeline Adventure Co.',
    seoDescription:
      'A guided ascent of Ben Lomond (1,748m) above Queenstown with the gondola included, spare layers carried, a summit lunch and small group sizes.',
    featured: false,
  },
]

/* ==========================================================================
   EXPORTS
   ========================================================================== */

const CATALOGUE: [tenantId: string, specs: ActivitySpec[]][] = [
  ['tnt_bluehorizon', BLUE_HORIZON_SPECS],
  ['tnt_coralcay', CORAL_CAY_SPECS],
  ['tnt_saltline', SALTLINE_SPECS],
  ['tnt_ridgeline', RIDGELINE_SPECS],
]

export const ACTIVITIES: Activity[] = CATALOGUE.flatMap(([tenantId, specs]) => {
  const tenant = tenantOrThrow(tenantId)
  return specs.map((spec) => buildActivity(tenant, spec))
})

/** Pre-grouped for the dashboard, which almost always works one tenant at a time. */
export const ACTIVITIES_BY_TENANT: Record<string, Activity[]> = ACTIVITIES.reduce<
  Record<string, Activity[]>
>((acc, activity) => {
  ;(acc[activity.tenantId] ||= []).push(activity)
  return acc
}, {})

const ACTIVITIES_BY_ID = new Map(ACTIVITIES.map((activity) => [activity.id, activity]))

export function getActivitiesByTenant(tenantId: string): Activity[] {
  return ACTIVITIES_BY_TENANT[tenantId] ?? []
}

export function getActivityById(id: string): Activity | undefined {
  return ACTIVITIES_BY_ID.get(id)
}

export function getActivityBySlug(tenantId: string, slug: string): Activity | undefined {
  return getActivitiesByTenant(tenantId).find((activity) => activity.slug === slug)
}

/** Featured + live only — a paused or draft product must never reach the storefront. */
export function getFeaturedActivities(tenantId: string): Activity[] {
  return getActivitiesByTenant(tenantId).filter(
    (activity) => activity.featured && activity.status === 'live',
  )
}

/** Everything sellable on the public storefront for a tenant. */
export function getLiveActivities(tenantId: string): Activity[] {
  return getActivitiesByTenant(tenantId).filter((activity) => activity.status === 'live')
}
