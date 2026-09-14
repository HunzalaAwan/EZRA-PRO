/**
 * EZRA PRO — the guest book.
 *
 * Customers are the CRM side of the product: the people who appear in the guest
 * directory, on a booking card, and behind every retention metric. They are
 * synthesised from curated per-country name pools so the directory reads like a
 * real Pacific / Mediterranean / Tasman guest list rather than a lorem
 * generator, and every field comes off a seeded RNG so server and client render
 * byte-identical output.
 *
 * Scale note: the guest base is sized against the booking volume that
 * `departures.ts` implies — roughly one guest per 1.9 in-window bookings. Seven
 * months of departures for operators this busy is tens of thousands of seats; a
 * few hundred guests could not cover that without every "new" customer somehow
 * carrying forty bookings. See `CUSTOMER_COUNTS`.
 *
 * Dates are written without a UTC suffix, matching the rest of the seed data —
 * parsed in local time they hold a fixed distance from NOW in any timezone.
 */

import type { Customer, Tenant } from '@/types'
import { addDays, clamp, createRng, hashSeed, rngInt, rngPick, rngWeighted } from '@/lib/utils'
import { avatarUrl, NOW, seedKey } from './constants'
import { TENANTS } from './tenants'

/* ==========================================================================
   NAME POOLS
   One pool per source market. `first` and `last` are authored as space
   separated strings purely to keep this file legible — they are split once at
   module load.
   ========================================================================== */

interface CountryPool {
  /** ISO 3166-1 alpha-2. This is what lands in `Customer.country`. */
  code: string
  name: string
  /** Template for a plausible local number; every '#' becomes a digit. */
  phone: string
  first: string[]
  last: string[]
  /** Mail providers that actually dominate in that market. */
  domains: string[]
}

function pool(
  code: string,
  name: string,
  phone: string,
  first: string,
  last: string,
  domains: string,
): CountryPool {
  return {
    code,
    name,
    phone,
    first: first.split(' '),
    last: last.split(' '),
    domains: domains.split(' '),
  }
}

/** Gmail is repeated because it really is that dominant almost everywhere. */
const GLOBAL_DOMAINS = 'gmail.com gmail.com gmail.com outlook.com icloud.com yahoo.com'

const POOLS: CountryPool[] = [
  pool(
    'US',
    'United States',
    '+1 (###) ###-####',
    'James Michael Robert David William Richard Joseph Thomas Christopher Daniel Matthew Anthony Mark Steven Andrew Brandon Tyler Nathan Caleb Ethan Emily Sarah Jessica Ashley Amanda Jennifer Lauren Megan Rachel Hannah Olivia Sophia Grace Chloe Madison Natalie Brooke Katherine Danielle Alyssa',
    'Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez Hernandez Lopez Gonzalez Wilson Anderson Thomas Taylor Moore Jackson Martin Perez Thompson White Harris Clark Lewis Walker Young Allen Wright Scott Torres Nguyen Hill Green Adams Baker Nelson Carter Mitchell',
    GLOBAL_DOMAINS + ' comcast.net aol.com me.com',
  ),
  pool(
    'CA',
    'Canada',
    '+1 (###) ###-####',
    'Liam Noah Owen Lucas Jack Benjamin Connor Tristan Felix Gabriel Emma Olivia Charlotte Ava Chloe Zoe Maeve Sadie Camille Genevieve Alexandre Mathieu Simon Etienne Marc',
    'Tremblay Gagnon Roy Cote Bouchard Morin Lavoie Fortin Gauthier Leblanc MacDonald Campbell Stewart Fraser Murray Doucette Beaulieu Pelletier Hebert Ouellet Chan Singh Patel Wong Sharma',
    GLOBAL_DOMAINS + ' shaw.ca rogers.com videotron.ca',
  ),
  pool(
    'GB',
    'United Kingdom',
    '+44 7### ######',
    'Oliver Harry George Jack Charlie Thomas Alfie Freddie Archie Louis Henry Samuel Amelia Isla Poppy Emily Sophie Jessica Freya Florence Imogen Niamh Eleanor Beatrice Harriet',
    'Smith Jones Taylor Brown Williams Wilson Davies Evans Thomas Roberts Walker Wright Robinson Thompson White Hughes Edwards Green Hall Wood Harris Clarke Jackson Bennett Cooper',
    GLOBAL_DOMAINS + ' btinternet.com sky.com hotmail.co.uk',
  ),
  pool(
    'AU',
    'Australia',
    '+61 4## ### ###',
    'Jack Oliver William Noah Thomas Lachlan Cooper Hunter Angus Riley Xavier Flynn Charlotte Olivia Ruby Mia Chloe Zoe Ella Matilda Harper Georgia Indiana Willow Sienna',
    'Smith Jones Williams Brown Wilson Taylor Nguyen Martin Anderson Thompson Walker Harris Ryan White Kelly King Hall Young Wright Lee Campbell Murphy Bennett Gray Watson',
    GLOBAL_DOMAINS + ' bigpond.com optusnet.com.au iinet.net.au',
  ),
  pool(
    'NZ',
    'New Zealand',
    '+64 2# ### ####',
    'Jack Oliver Mason Hunter Kauri Tane Ari Nikau Manaia Toby Ruby Isla Charlotte Aroha Mia Ella Anahera Willow Maia Amelia Hemi Rawiri Wiremu Ngaire Kiri',
    'Smith Williams Brown Wilson Taylor Thompson Anderson Walker Ngata Rangi Heke Kingi Tipene Whitcombe Lowry McKenzie Sutherland Cameron Fraser Hughes Murphy Reid Moana Paora Katene',
    GLOBAL_DOMAINS + ' xtra.co.nz slingshot.co.nz',
  ),
  pool(
    'DE',
    'Germany',
    '+49 1## #######',
    'Lukas Jonas Leon Finn Paul Maximilian Felix Moritz Elias Jannik Niklas Tobias Hannah Lena Mia Emma Sophie Marie Laura Johanna Clara Greta Franziska Annika Charlotte',
    'Mueller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Koch Richter Klein Wolf Neumann Schwarz Zimmermann Braun Krueger Hartmann Lange Werner Krause Lehmann Schmitt',
    GLOBAL_DOMAINS + ' gmx.de web.de t-online.de',
  ),
  pool(
    'FR',
    'France',
    '+33 6 ## ## ## ##',
    'Lucas Hugo Nathan Leo Gabriel Raphael Arthur Jules Theo Antoine Maxime Clement Emma Louise Chloe Manon Camille Sarah Lea Juliette Alice Margaux Ines Clara Elise',
    'Martin Bernard Dubois Thomas Robert Richard Petit Durand Leroy Moreau Simon Laurent Lefebvre Michel Garcia David Bertrand Roux Vincent Fournier Morel Girard Andre Mercier Blanc',
    GLOBAL_DOMAINS + ' orange.fr free.fr laposte.net',
  ),
  pool(
    'IT',
    'Italy',
    '+39 3## ### ####',
    'Lorenzo Francesco Alessandro Matteo Leonardo Riccardo Tommaso Andrea Davide Gabriele Sofia Giulia Aurora Alice Emma Giorgia Martina Chiara Beatrice Elena Federica Ilaria Camilla Valentina Noemi',
    'Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti Costa Giordano Mancini Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso',
    GLOBAL_DOMAINS + ' libero.it virgilio.it tiscali.it',
  ),
  pool(
    'NL',
    'Netherlands',
    '+31 6 ########',
    'Daan Sem Lucas Finn Milan Levi Bram Thijs Jesse Ruben Sanne Emma Julia Lotte Sophie Eva Anna Fenna Noor Tess Maud Roos Isa Lieke Nina',
    'Jansen Vries Bakker Visser Smit Meijer Mulder Bos Vos Peters Hendriks Dekker Brouwer Kuipers Koster Post Boer Willems Maas Verhoeven Hoekstra Timmermans Groot Schouten Linden',
    GLOBAL_DOMAINS + ' ziggo.nl kpnmail.nl',
  ),
  pool(
    'ES',
    'Spain',
    '+34 6## ### ###',
    'Hugo Martin Pablo Alvaro Adrian Diego Mateo Javier Sergio Marcos Lucia Martina Paula Carmen Sara Marta Elena Irene Claudia Andrea Rocio Nerea Alba Julia Ines',
    'Garcia Fernandez Gonzalez Rodriguez Lopez Martinez Sanchez Perez Gomez Martin Jimenez Ruiz Hernandez Diaz Moreno Alvarez Munoz Romero Alonso Gutierrez Navarro Torres Dominguez Vazquez Ramos',
    GLOBAL_DOMAINS + ' telefonica.net',
  ),
  pool(
    'SE',
    'Sweden',
    '+46 7# ### ## ##',
    'Oscar William Lucas Hugo Elias Axel Viktor Emil Alvar Nils Alice Maja Elsa Ebba Astrid Saga Wilma Freja Agnes Signe Linnea Tuva Ingrid Klara Stina',
    'Andersson Johansson Karlsson Nilsson Eriksson Larsson Olsson Persson Svensson Gustafsson Pettersson Jonsson Jansson Hansson Bengtsson Lindberg Lindstrom Berg Sandberg Lundgren Forsberg Holm Dahl Nyberg Wallin',
    GLOBAL_DOMAINS + ' telia.com',
  ),
  pool(
    'CH',
    'Switzerland',
    '+41 7# ### ## ##',
    'Noah Liam Matteo Luca Elias Julian Gabriel Aaron Leon Samuel Mia Emma Sofia Lina Elena Alina Nina Laura Anna Leonie Chiara Jana Nora Selina Livia',
    'Mueller Meier Schmid Keller Weber Huber Schneider Steiner Brunner Baumann Frei Zimmermann Moser Widmer Graf Roth Gerber Suter Wyss Studer Marti Berger Hofer Bachmann Egger',
    GLOBAL_DOMAINS + ' bluewin.ch',
  ),
  pool(
    'GR',
    'Greece',
    '+30 69# ### ####',
    'Giorgos Dimitris Nikos Kostas Yiannis Vasilis Alexandros Stavros Panagiotis Christos Maria Eleni Katerina Sofia Georgia Dimitra Anna Christina Ioanna Despina Marina Athina Zoi Fotini Kalliopi',
    'Papadopoulos Papadakis Vlachos Nikolaidis Georgiou Karagiannis Stavrou Petrou Marinos Dimitriou Antoniou Christou Sakellariou Fotiadis Manolis Katsaros Pappas Samaras Angelopoulos Kalogeras Theodorou Lambrou Zervas Mavros Skoulikas',
    GLOBAL_DOMAINS + ' otenet.gr',
  ),
  pool(
    'JP',
    'Japan',
    '+81 90-####-####',
    'Haruto Yuto Sota Ren Riku Kaito Yuki Sora Hiroto Daiki Yui Aoi Hina Sakura Rin Mio Koharu Akari Yuna Mei Takashi Kenji Naoko Yumi Keiko',
    'Sato Suzuki Takahashi Tanaka Watanabe Ito Yamamoto Nakamura Kobayashi Kato Yoshida Yamada Sasaki Yamaguchi Matsumoto Inoue Kimura Hayashi Shimizu Saito Mori Ikeda Hashimoto Ishikawa Ogawa',
    GLOBAL_DOMAINS + ' docomo.ne.jp ezweb.ne.jp',
  ),
  pool(
    'KR',
    'South Korea',
    '+82 10-####-####',
    'Minjun Seojun Doyun Jiho Hyunwoo Jisung Eunwoo Taeyang Joonho Sangwoo Seoyeon Jiwoo Hayoon Seoyun Jimin Yerin Chaewon Soyoung Hyejin Minseo Jihye Sujin Nayeon Dahye Eunji',
    'Kim Lee Park Choi Jung Kang Cho Yoon Jang Lim Han Oh Seo Shin Kwon Hwang Ahn Song Ryu Hong Jeon Moon Bae Baek Nam',
    GLOBAL_DOMAINS + ' naver.com daum.net',
  ),
  pool(
    'CN',
    'China',
    '+86 1## #### ####',
    'Wei Jing Hao Lei Yan Fang Min Chen Xin Yu Ling Hui Qiang Jun Tao Ping Na Rui Xiang Peng Lan Bo Dan Feng Kai',
    'Wang Li Zhang Liu Chen Yang Huang Zhao Wu Zhou Xu Sun Ma Zhu Hu Guo He Lin Gao Luo Zheng Liang Xie Song Tang',
    GLOBAL_DOMAINS + ' qq.com 163.com',
  ),
  pool(
    'SG',
    'Singapore',
    '+65 8### ####',
    'Weiming Junkai Zhihao Ryan Marcus Bryan Isaac Rachel Charmaine Jolene Denise Priya Shalini Aisyah Nurul Farah Adrian Clarence Sheryl Valerie Xinyi Jiahao Kaiwen Michelle Bernard',
    'Tan Lim Lee Ng Wong Chan Goh Koh Teo Ong Chua Yeo Sim Low Toh Kaur Singh Rajan Menon Abdullah Rahman Ismail Chong Foo Seah',
    GLOBAL_DOMAINS + ' singnet.com.sg',
  ),
  pool(
    'BR',
    'Brazil',
    '+55 ## 9####-####',
    'Joao Pedro Lucas Gabriel Matheus Rafael Guilherme Felipe Bruno Thiago Maria Ana Julia Beatriz Larissa Camila Fernanda Mariana Leticia Isabela Rodrigo Vinicius Caio Gustavo Renata',
    'Silva Santos Oliveira Souza Rodrigues Ferreira Alves Pereira Lima Gomes Costa Ribeiro Martins Carvalho Almeida Lopes Soares Fernandes Vieira Barbosa Rocha Dias Nascimento Moreira Cardoso',
    GLOBAL_DOMAINS + ' uol.com.br bol.com.br',
  ),
  pool(
    'MX',
    'Mexico',
    '+52 ## #### ####',
    'Santiago Mateo Diego Emiliano Sebastian Leonardo Alejandro Daniel Miguel Rodrigo Sofia Valentina Regina Ximena Renata Camila Mariana Fernanda Victoria Natalia Andres Carlos Eduardo Ricardo Lorena',
    'Hernandez Garcia Martinez Lopez Gonzalez Perez Rodriguez Sanchez Ramirez Flores Gomez Diaz Reyes Morales Cruz Ortiz Gutierrez Chavez Ramos Ruiz Mendoza Aguilar Vargas Castillo Juarez',
    GLOBAL_DOMAINS + ' prodigy.net.mx',
  ),
]

const POOL_BY_CODE = new Map(POOLS.map((p) => [p.code, p]))

/** Display names for every country code that can appear in `Customer.country`. */
export const COUNTRY_NAMES: Record<string, string> = POOLS.reduce<Record<string, string>>(
  (acc, p) => {
    acc[p.code] = p.name
    return acc
  },
  {},
)

/** "US" -> "United States". Falls back to the code so the UI never renders blank. */
export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code
}

/**
 * A country-appropriate name pair. Bookings use it to name the rest of a party
 * so a Sao Paulo family does not turn up with three Scandinavian children.
 * Consumes two draws from `rng`.
 */
export function pickLocalName(
  rng: () => number,
  code: string,
): { firstName: string; lastName: string } {
  const market = POOL_BY_CODE.get(code) ?? POOLS[0]
  return { firstName: rngPick(rng, market.first), lastName: rngPick(rng, market.last) }
}

/* ==========================================================================
   SOURCE MARKETS
   Where each operator's guests actually come from. The weights are rough but
   not arbitrary — Maui skews North American and Japanese, Port Douglas
   domestic Australian, Santorini pan-European, Queenstown trans-Tasman.
   ========================================================================== */

type MarketMix = [code: string, weight: number][]

const MARKETS: Record<string, MarketMix> = {
  tnt_bluehorizon: [
    ['US', 52],
    ['CA', 11],
    ['JP', 9],
    ['AU', 6],
    ['DE', 4],
    ['GB', 4],
    ['KR', 4],
    ['BR', 3],
    ['NZ', 2],
    ['FR', 2],
    ['MX', 2],
    ['NL', 1],
  ],
  tnt_coralcay: [
    ['AU', 42],
    ['GB', 11],
    ['US', 8],
    ['DE', 7],
    ['NZ', 6],
    ['JP', 5],
    ['CN', 5],
    ['FR', 4],
    ['IT', 3],
    ['KR', 3],
    ['NL', 3],
    ['SG', 3],
  ],
  tnt_saltline: [
    ['US', 20],
    ['GB', 14],
    ['DE', 12],
    ['FR', 9],
    ['IT', 8],
    ['NL', 7],
    ['GR', 7],
    ['AU', 5],
    ['CH', 4],
    ['SE', 4],
    ['ES', 4],
    ['CA', 3],
    ['JP', 3],
  ],
  tnt_ridgeline: [
    ['NZ', 30],
    ['AU', 22],
    ['US', 12],
    ['GB', 9],
    ['DE', 6],
    ['CN', 5],
    ['SG', 4],
    ['JP', 4],
    ['KR', 3],
    ['CA', 3],
    ['FR', 2],
  ],
}

/** The operator's own market — guests from here get the "local" tag. */
const HOME_MARKET: Record<string, string> = {
  tnt_bluehorizon: 'US',
  tnt_coralcay: 'AU',
  tnt_saltline: 'GR',
  tnt_ridgeline: 'NZ',
}

/**
 * How many guests each operator has on file.
 *
 * Sized so the average guest carries roughly 2.2 bookings inside the departure
 * window, which is what the segment mix below implies. Change these and the
 * booking generator simply spreads itself across more or fewer people.
 */
const CUSTOMER_COUNTS: Record<string, number> = {
  tnt_bluehorizon: 4700,
  tnt_coralcay: 3500,
  tnt_saltline: 3700,
  tnt_ridgeline: 1900,
}

/** Typical order value per booking, minor units, in the tenant's own currency. */
const AVG_ORDER_VALUE: Record<string, number> = {
  tnt_bluehorizon: 42_000,
  tnt_coralcay: 49_000,
  tnt_saltline: 21_000,
  tnt_ridgeline: 38_000,
}

/* ==========================================================================
   SEGMENTS
   ========================================================================== */

type Segment = Customer['segment']

const SEGMENT_MIX: [Segment, number][] = [
  ['new', 45],
  ['returning', 33],
  ['vip', 12],
  ['lapsed', 10],
]

/** How long ago the account was opened, in days before NOW, by segment. */
const SIGNUP_WINDOW: Record<Segment, [number, number]> = {
  new: [1, 300],
  returning: [110, 760],
  vip: [240, 900],
  lapsed: [400, 900],
}

const TAG_POOL = [
  'honeymoon',
  'cruise-passenger',
  'family',
  'group-organiser',
  'photographer',
  'dive-certified',
  'birthday',
  'anniversary',
  'corporate',
  'solo-traveller',
  'accessibility',
  'food-allergy',
  'early-riser',
  'return-visitor',
]

const NOTE_POOL = [
  'Prefers the first departure of the day — gets seasick in afternoon chop.',
  'Travels with an underwater camera rig; needs deck space for it.',
  'Books for the whole extended family every year, usually in July.',
  'Asked to be seated away from the engine on the last trip.',
  'Nut allergy on file — confirm catering before every booking.',
  'Repeat guest via the resort concierge desk; invoice goes to the hotel.',
  'Wants an email the week before, not a text message.',
  'Non-swimmer — always assign a flotation vest and brief the crew.',
  'Celebrating an anniversary this year; flagged for a complimentary upgrade.',
  'Cancelled once for weather and was gracious about it.',
  'Corporate account — purchase order number required on the invoice.',
  'Has asked twice about a private charter. Worth a call.',
]

/* ==========================================================================
   GENERATION
   ========================================================================== */

/** Local-time ISO with no 'Z' — the convention used across the whole seed. */
function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`
}

/** NOW shifted back by `days`, then dropped onto a plausible hour of the day. */
function momentBefore(rng: () => number, days: number): Date {
  const d = addDays(NOW, -days)
  d.setHours(rngInt(rng, 7, 22), rngInt(rng, 0, 59), rngInt(rng, 0, 59), 0)
  return d
}

function fillPhone(rng: () => number, template: string): string {
  let out = ''
  for (const ch of template) out += ch === '#' ? String(rngInt(rng, 0, 9)) : ch
  return out
}

/** Strips accents and punctuation so the local part is always mail-safe. */
function emailPart(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '')
}

function pickTags(rng: () => number, segment: Segment, isLocal: boolean): string[] {
  const tags: string[] = []
  if (segment === 'vip') tags.push('repeat-guest')
  else if (segment === 'returning' && rng() < 0.6) tags.push('repeat-guest')
  if (isLocal) tags.push('local')
  const extra = segment === 'vip' ? rngInt(rng, 1, 2) : rngInt(rng, 0, 2)
  for (let i = 0; i < extra; i++) {
    const tag = rngPick(rng, TAG_POOL)
    if (!tags.includes(tag)) tags.push(tag)
  }
  return tags
}

/**
 * Lifetime value that actually tracks the segment: VIPs book more often *and*
 * spend more per booking, which is the whole reason the segment is worth having.
 */
function lifetimeValueFor(
  rng: () => number,
  tenantId: string,
  segment: Segment,
  bookings: number,
): number {
  if (bookings === 0) return 0
  const base = AVG_ORDER_VALUE[tenantId] ?? 35_000
  const premium = segment === 'vip' ? 1.15 + rng() * 0.75 : 0.7 + rng() * 0.8
  // Rounded to whole currency units so the CRM never shows stray cents.
  return Math.round((base * bookings * premium) / 100) * 100
}

function buildCustomer(tenant: Tenant, index: number, emailSeen: Map<string, number>): Customer {
  const rng = createRng(hashSeed(seedKey('customer', tenant.id, index)))

  const code = rngWeighted(rng, MARKETS[tenant.id] ?? MARKETS.tnt_bluehorizon)
  const market = POOL_BY_CODE.get(code) ?? POOLS[0]
  const firstName = rngPick(rng, market.first)
  const lastName = rngPick(rng, market.last)

  const segment = rngWeighted(rng, SEGMENT_MIX)
  const [minDays, maxDays] = SIGNUP_WINDOW[segment]
  const createdAt = momentBefore(rng, rngInt(rng, minDays, maxDays))

  // A small slice of "new" accounts are enquiries that never converted — the
  // CRM needs a zero-booking, null-last-booking row to render honestly.
  const neverBooked = segment === 'new' && rng() < 0.05

  let totalBookings: number
  if (neverBooked) totalBookings = 0
  else if (segment === 'new') totalBookings = rng() < 0.8 ? 1 : 2
  else if (segment === 'returning') totalBookings = rngInt(rng, 2, 4)
  else if (segment === 'vip') totalBookings = rngInt(rng, 5, 14)
  else totalBookings = rngInt(rng, 1, 3)

  let lastBookingAt: Date | null = null
  if (!neverBooked) {
    if (segment === 'lapsed') {
      // The defining property of a lapsed guest: nothing for at least 9 months.
      lastBookingAt = momentBefore(rng, rngInt(rng, 285, 760))
    } else if (segment === 'new') {
      lastBookingAt =
        rng() < 0.7
          ? new Date(createdAt.getTime() + rngInt(rng, 0, 14) * 86_400_000)
          : addDays(NOW, rngInt(rng, 1, 70))
    } else if (segment === 'returning') {
      lastBookingAt =
        rng() < 0.75 ? momentBefore(rng, rngInt(rng, 1, 150)) : addDays(NOW, rngInt(rng, 1, 80))
    } else {
      lastBookingAt =
        rng() < 0.6 ? momentBefore(rng, rngInt(rng, 1, 100)) : addDays(NOW, rngInt(rng, 1, 90))
    }
    if (lastBookingAt.getTime() < createdAt.getTime()) {
      lastBookingAt = new Date(createdAt.getTime() + 3_600_000)
    }
  }

  const domain = rngPick(rng, market.domains)
  const localPart = `${emailPart(firstName)}.${emailPart(lastName)}`
  const key = `${localPart}@${domain}`
  const seen = emailSeen.get(key) ?? 0
  emailSeen.set(key, seen + 1)
  const email = seen === 0 ? key : `${localPart}${seen + 1}@${domain}`

  const shortSlug = tenant.slug.replace(/-/g, '').slice(0, 3)
  const optInFloor = segment === 'vip' ? 0.86 : segment === 'returning' ? 0.72 : 0.56

  return {
    id: `cus_${shortSlug}_${String(index + 1).padStart(5, '0')}`,
    tenantId: tenant.id,
    firstName,
    lastName,
    email,
    phone: fillPhone(rng, market.phone),
    country: code,
    // Roughly half the book has a photo; the rest exercises the initials avatar.
    ...(rng() < 0.55 ? { avatarUrl: avatarUrl(rngInt(rng, 1, 70)) } : {}),
    createdAt: localIso(createdAt),
    totalBookings,
    lifetimeValue: lifetimeValueFor(rng, tenant.id, segment, totalBookings),
    lastBookingAt: lastBookingAt ? localIso(lastBookingAt) : null,
    tags: pickTags(rng, segment, code === HOME_MARKET[tenant.id]),
    marketingOptIn: rng() < optInFloor,
    ...(rng() < 0.16 ? { notes: rngPick(rng, NOTE_POOL) } : {}),
    segment,
  }
}

/* ==========================================================================
   EXPORTS
   ========================================================================== */

export const CUSTOMERS: Customer[] = TENANTS.flatMap((tenant) => {
  const count = CUSTOMER_COUNTS[tenant.id] ?? 400
  // Scoped per tenant so one operator's guests never collide with another's.
  const emailSeen = new Map<string, number>()
  const rows: Customer[] = new Array(count)
  for (let i = 0; i < count; i++) rows[i] = buildCustomer(tenant, i, emailSeen)
  return rows
})

const CUSTOMERS_BY_TENANT: Record<string, Customer[]> = CUSTOMERS.reduce<Record<string, Customer[]>>(
  (acc, customer) => {
    ;(acc[customer.tenantId] ||= []).push(customer)
    return acc
  },
  {},
)

const CUSTOMERS_BY_ID = new Map(CUSTOMERS.map((customer) => [customer.id, customer]))

export function getCustomersByTenant(tenantId: string): Customer[] {
  return CUSTOMERS_BY_TENANT[tenantId] ?? []
}

export function getCustomerById(id: string): Customer | undefined {
  return CUSTOMERS_BY_ID.get(id)
}

/** Highest lifetime value first — the "top guests" panel reads straight off this. */
export function getTopCustomers(tenantId: string, limit = 10): Customer[] {
  return [...getCustomersByTenant(tenantId)]
    .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
    .slice(0, clamp(limit, 1, 500))
}
