import { createRng, hashSeed, rngInt } from '@/lib/utils'

import type { DietaryTag, Menu, MenuCategory, MenuItem, MenuItemStatus, MenuModifier, OrderChannel } from './types'

/* ==========================================================================
   Menus — one per hospitality tenant, written by hand so they read like a
   real kitchen's board, with sales figures seeded per item.
   ========================================================================== */

const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`

const ALL: OrderChannel[] = ['dine_in', 'pickup', 'delivery']
const DINE: OrderChannel[] = ['dine_in']
const NO_DELIVERY: OrderChannel[] = ['dine_in', 'pickup']

interface ItemOptions {
  tags?: DietaryTag[]
  channels?: OrderChannel[]
  popular?: boolean
  prep?: number
  photo?: string
  modifiers?: MenuModifier[]
  status?: MenuItemStatus
  /** Relative demand, 0..1, seeds the 30-day sales figure. */
  demand?: number
}

type ItemSpec = [name: string, price: number, description: string, options?: ItemOptions]

interface CategorySpec {
  id: string
  name: string
  description?: string
  service: MenuCategory['service']
  items: ItemSpec[]
}

const modifier = (id: string, label: string, options: [string, number][], extra: Partial<MenuModifier> = {}): MenuModifier => ({
  id,
  label,
  required: false,
  multiple: false,
  ...extra,
  options: options.map(([optionLabel, priceDelta]) => ({
    id: `${id}_${optionLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    label: optionLabel,
    priceDelta,
  })),
})

/* --------------------------------------------------------------------------
   Saltline Kitchen & Terrace — Oia, Santorini
   -------------------------------------------------------------------------- */

const SALTLINE: CategorySpec[] = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    description: 'Served on the terrace until 11:30.',
    service: 'breakfast',
    items: [
      ['Greek yoghurt, thyme honey & walnuts', 950, 'Strained sheep yoghurt from Naxos, honey from the hills above Pyrgos.', { photo: 'photo-1488477181946-6428a0291777', tags: ['vegetarian', 'nuts', 'gluten_free'], popular: true, prep: 6, demand: 0.8 }],
      ['Strapatsada', 1100, 'Eggs scrambled slowly with grated tomato and feta, toasted village bread.', { photo: 'photo-1525351484163-7529414344d8', tags: ['vegetarian'], prep: 12, demand: 0.6 }],
      ['Koulouri & feta plate', 850, 'Sesame bread ring, barrel feta, olives, cucumber and tomato.', { photo: 'photo-1785398607169-459bf5342afb', tags: ['vegetarian'], prep: 5, demand: 0.45 }],
      ['Fig & tahini toast', 900, 'Sourdough, black tahini, fresh figs and sea salt.', { photo: 'photo-1484723091739-30a097e8f929', tags: ['vegan'], prep: 6, demand: 0.4 }],
      ['Freddo espresso', 400, 'Double shot shaken over ice.', { photo: 'photo-1578314675249-a6910f80cc4e', channels: NO_DELIVERY, prep: 3, demand: 0.9 }],
      ['Fresh orange juice', 500, 'Pressed to order.', { photo: 'photo-1641659735894-45046caad624', tags: ['vegan', 'gluten_free'], channels: NO_DELIVERY, prep: 3, demand: 0.7 }],
    ],
  },
  {
    id: 'starters',
    name: 'Starters',
    service: 'all',
    items: [
      ['Santorini fava with capers', 900, 'Yellow split pea purée, caper leaves, red onion, good oil.', { photo: 'photo-1476124369491-e7addf5db371', tags: ['vegan', 'gluten_free'], popular: true, prep: 8, demand: 0.85 }],
      ['Tomato keftedes', 1000, 'Fried fritters of the island’s small tomatoes, mint and yoghurt.', { photo: 'photo-1562967914-01efa7e87832', tags: ['vegetarian'], popular: true, prep: 10, demand: 0.8 }],
      ['Grilled octopus', 1800, 'Sun-dried on the line, grilled over charcoal, fava underneath.', { photo: 'photo-1778327564742-59ce83f41373', tags: ['gluten_free', 'shellfish'], popular: true, prep: 14, demand: 0.75 }],
      ['Saganaki with fig', 1200, 'Pan-fried graviera, fig jam, sesame.', { photo: 'photo-1778850855907-8fbf7b089621', tags: ['vegetarian'], prep: 9, demand: 0.55 }],
      ['Taramosalata & warm pita', 900, 'White cod roe whipped with oil and lemon.', { photo: 'photo-1763647818263-62a9256f097c', prep: 5, demand: 0.5 }],
      ['Santorini salad', 1300, 'Cherry tomatoes, cucumber, chloro cheese, capers, barley rusk.', { photo: 'photo-1505253716362-afaea1d3d1af', tags: ['vegetarian'], prep: 7, modifiers: [modifier('salad_add', 'Add', [['Grilled chicken', 600], ['Grilled prawns', 900]], { multiple: true })], demand: 0.7 }],
    ],
  },
  {
    id: 'mains',
    name: 'Mains',
    service: 'all',
    items: [
      ['Whole grilled fish of the day', 3400, 'Landed at Ammoudi this morning. Lemon, oil, horta on the side.', { photo: 'photo-1519708227418-c8fd9a32b7a2', tags: ['gluten_free'], channels: NO_DELIVERY, popular: true, prep: 25, modifiers: [modifier('fish_size', 'Size', [['For one', 0], ['For two', 3000]], { required: true })], demand: 0.7 }],
      ['Lamb kleftiko', 2700, 'Shoulder cooked six hours in paper with lemon, garlic and potatoes.', { photo: 'photo-1529692236671-f1f6cf9683ba', tags: ['gluten_free'], popular: true, prep: 15, demand: 0.75 }],
      ['Moussaka', 2100, 'Aubergine, spiced lamb, béchamel. The recipe has not changed since 1988.', { photo: 'photo-1777199311086-ec5ff230aefd', prep: 15, demand: 0.8 }],
      ['Seafood orzo', 2600, 'Kritharaki with mussels, prawns and squid in a saffron tomato broth.', { photo: 'photo-1512058564366-18510be2db19', tags: ['shellfish'], prep: 18, demand: 0.6 }],
      ['Chicken souvlaki plate', 1900, 'Two skewers, pita, tzatziki, chips, salad.', { photo: 'photo-1599487488170-d11ec9c172f0', popular: true, prep: 14, modifiers: [modifier('souvlaki_meat', 'Choose your skewers', [['Chicken', 0], ['Pork', 0], ['Halloumi', 150]], { required: true }), modifier('souvlaki_side', 'Side', [['Chips', 0], ['Lemon potatoes', 0], ['Extra salad', 0]])], demand: 0.9 }],
      ['Gemista', 1800, 'Tomatoes and peppers stuffed with rice, herbs and pine nuts.', { tags: ['vegan', 'gluten_free', 'nuts'], prep: 12, demand: 0.5 }],
    ],
  },
  {
    id: 'grill',
    name: 'From the grill',
    service: 'dinner',
    items: [
      ['Bifteki', 2200, 'Hand-cut beef and lamb patty stuffed with graviera, served with lemon potatoes.', { photo: 'photo-1432139555190-58524dae6a55', prep: 16, demand: 0.6 }],
      ['Lamb chops', 2900, 'Six small chops, oregano and lemon, chips.', { photo: 'photo-1544025162-d76694265947', tags: ['gluten_free'], popular: true, prep: 18, demand: 0.65 }],
      ['Halloumi & grilled vegetables', 1700, 'Courgette, pepper, aubergine, halloumi, pomegranate molasses.', { photo: 'photo-1598511796432-32663d0875bd', tags: ['vegetarian', 'gluten_free'], prep: 12, demand: 0.5 }],
    ],
  },
  {
    id: 'sides',
    name: 'Sides',
    service: 'all',
    items: [
      ['Lemon potatoes', 600, 'Roasted in stock and lemon.', { photo: 'photo-1594551706251-292c67cb277d', tags: ['vegan', 'gluten_free'], prep: 5, demand: 0.8 }],
      ['Horta', 600, 'Wild greens, oil and lemon.', { photo: 'photo-1709756761957-d9630cf5bd2c', tags: ['vegan', 'gluten_free'], prep: 5, demand: 0.5 }],
      ['Warm pita', 350, 'Two, brushed with oil.', { photo: 'photo-1710444448935-48ece3b2bd8a', tags: ['vegan'], prep: 3, demand: 0.9 }],
      ['Tzatziki', 450, 'Yoghurt, cucumber, garlic.', { photo: 'photo-1687540953277-2ead6ffb3a1c', tags: ['vegetarian', 'gluten_free'], prep: 2, demand: 0.85 }],
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    service: 'all',
    items: [
      ['Baklava', 800, 'Walnut, cinnamon, syrup. Made on Tuesdays and Fridays.', { photo: 'photo-1519676867240-f03562e64548', tags: ['vegetarian', 'nuts'], popular: true, prep: 4, demand: 0.7 }],
      ['Galaktoboureko', 850, 'Semolina custard in filo, orange syrup.', { photo: 'photo-1551024506-0bccd828d307', tags: ['vegetarian'], prep: 4, demand: 0.55 }],
      ['Sour cherry & mastiha ice cream', 700, 'Two scoops, served with a spoon of vinsanto.', { photo: 'photo-1488900128323-21503983a07e', tags: ['vegetarian', 'gluten_free'], channels: DINE, prep: 3, demand: 0.6 }],
    ],
  },
  {
    id: 'drinks',
    name: 'Drinks',
    service: 'drinks',
    items: [
      ['Assyrtiko, glass', 900, 'Santo Wines, from vines on the slope below us.', { photo: 'photo-1651665849313-91055ad02729', tags: ['vegan'], channels: DINE, prep: 2, demand: 0.9 }],
      ['Mythos, bottle', 500, 'Cold.', { photo: 'photo-1644085159285-5fd924740cb3', tags: ['vegan'], channels: DINE, prep: 1, demand: 0.7 }],
      ['Sparkling water, 750ml', 350, 'Souroti.', { photo: 'photo-1564644411757-a723deba07a8', tags: ['vegan', 'gluten_free'], channels: NO_DELIVERY, prep: 1, demand: 0.8 }],
      ['Mountain tea', 350, 'Sideritis from Crete, with honey.', { photo: 'photo-1514733670139-4d87a1941d55', tags: ['vegan', 'gluten_free'], channels: DINE, prep: 4, demand: 0.4 }],
    ],
  },
]

/* --------------------------------------------------------------------------
   Casa Vela Kitchen — Alfama, Lisbon
   -------------------------------------------------------------------------- */

const CASA_VELA: CategorySpec[] = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    description: 'On the rooftop from 07:30. Included for guests on a breakfast rate.',
    service: 'breakfast',
    items: [
      ['Pastel de nata & coffee', 550, 'Warm from the oven on the corner, with a galão or an espresso.', { photo: 'photo-1562044840-a9bf4731635b', tags: ['vegetarian'], popular: true, prep: 4, demand: 0.95 }],
      ['Tosta mista', 700, 'Ham and cheese toasted in butter, the proper way.', { photo: 'photo-1528735602780-2552fd46c7af', prep: 8, demand: 0.6 }],
      ['Açaí bowl', 1100, 'Granola, banana, berries, coconut.', { photo: 'photo-1490474418585-ba9bad8fd0ea', tags: ['vegan', 'gluten_free'], prep: 6, demand: 0.5 }],
      ['Eggs, any way, on sourdough', 1050, 'Two eggs from Sintra, tomato, greens.', { photo: 'photo-1482049016688-2d3e1b311543', tags: ['vegetarian'], prep: 12, modifiers: [modifier('eggs_style', 'How would you like them', [['Poached', 0], ['Fried', 0], ['Scrambled', 0]], { required: true })], demand: 0.7 }],
    ],
  },
  {
    id: 'petiscos',
    name: 'Petiscos',
    description: 'Small plates for the table.',
    service: 'all',
    items: [
      ['Pica-pau', 1300, 'Beef strips in garlic and white wine with pickles and bread.', { photo: 'photo-1558030006-450675393462', popular: true, prep: 12, demand: 0.75 }],
      ['Peixinhos da horta', 900, 'Green beans in tempura, the original.', { photo: 'photo-1562967914-01efa7e87832', tags: ['vegan'], prep: 8, demand: 0.65 }],
      ['Amêijoas à Bulhão Pato', 1600, 'Clams, garlic, coriander, lemon, more bread.', { photo: 'photo-1615141982883-c7ad0e69fd62', tags: ['shellfish', 'gluten_free'], popular: true, prep: 12, demand: 0.7 }],
      ['Queijo da Serra & marmelada', 1200, 'Runny sheep cheese from the Serra da Estrela with quince paste.', { photo: 'photo-1541529086526-db283c563270', tags: ['vegetarian'], prep: 4, demand: 0.5 }],
      ['Pão com chouriço', 700, 'Bread baked around chouriço, served hot.', { photo: 'photo-1597604396383-b8ca64ed8fa7', prep: 8, demand: 0.6 }],
    ],
  },
  {
    id: 'mains',
    name: 'Mains',
    service: 'all',
    items: [
      ['Bacalhau à Brás', 2200, 'Shredded salt cod, eggs, matchstick potatoes, olives.', { photo: 'photo-1626804475297-41608ea09aeb', popular: true, prep: 16, demand: 0.85 }],
      ['Arroz de pato', 2400, 'Duck rice baked with chouriço and a crisp top.', { photo: 'photo-1589302168068-964664d93dc0', popular: true, prep: 18, demand: 0.7 }],
      ['Polvo à lagareiro', 2900, 'Roast octopus, smashed potatoes, a lot of olive oil.', { photo: 'photo-1535980156496-87fc2cfcb832', tags: ['gluten_free', 'shellfish'], prep: 22, demand: 0.65 }],
      ['Bitoque', 1900, 'Thin steak, fried egg, chips, rice, and the sauce.', { photo: 'photo-1600891964092-4316c288032e', prep: 14, modifiers: [modifier('bitoque_egg', 'Egg', [['Fried', 0], ['No egg', 0]])], demand: 0.75 }],
      ['Caldo verde', 900, 'Kale and potato soup with a slice of chouriço.', { tags: ['gluten_free'], prep: 6, demand: 0.6 }],
      ['Legumes grelhados & grão', 1700, 'Grilled vegetables, chickpeas, herbs, lemon.', { photo: 'photo-1512621776951-a57141f2eefd', tags: ['vegan', 'gluten_free'], prep: 12, demand: 0.45 }],
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    service: 'all',
    items: [
      ['Pastel de nata', 300, 'Just one, or the box of six.', { photo: 'photo-1618250713296-ee011768e525', tags: ['vegetarian'], popular: true, prep: 2, modifiers: [modifier('nata_qty', 'How many', [['One', 0], ['Box of six', 1500]], { required: true })], demand: 0.95 }],
      ['Sericaia with Elvas plum', 800, 'Alentejo egg pudding, cinnamon, a sugared plum.', { photo: 'photo-1614610555838-e20ebc8f3fd4', tags: ['vegetarian'], prep: 4, demand: 0.55 }],
      ['Chocolate mousse', 750, 'Dark, dense, olive oil and salt.', { photo: 'photo-1673551494277-92204546b504', tags: ['vegetarian', 'gluten_free'], prep: 3, demand: 0.6 }],
    ],
  },
  {
    id: 'drinks',
    name: 'Drinks',
    service: 'drinks',
    items: [
      ['Vinho verde, glass', 650, 'Quinta de Soalheiro, Alvarinho.', { photo: 'photo-1558346489-19413928158b', tags: ['vegan'], channels: DINE, prep: 2, demand: 0.85 }],
      ['Super Bock, bottle', 400, 'Cold.', { photo: 'photo-1597822738124-151fb72dcb79', tags: ['vegan'], channels: DINE, prep: 1, demand: 0.7 }],
      ['Ginjinha', 450, 'Sour cherry liqueur, with or without the cherry.', { photo: 'photo-1470337458703-46ad1756a187', tags: ['vegan'], channels: DINE, prep: 1, demand: 0.6 }],
      ['Galão', 300, 'Milky coffee in a tall glass.', { photo: 'photo-1509042239860-f550ce710b93', tags: ['vegetarian'], channels: NO_DELIVERY, prep: 3, demand: 0.9 }],
    ],
  },
]

/* --------------------------------------------------------------------------
   Build
   -------------------------------------------------------------------------- */

const SHORT: Record<string, string> = { tnt_saltline: 'sl', tnt_casavela: 'cv' }
const SPECS: Record<string, CategorySpec[]> = { tnt_saltline: SALTLINE, tnt_casavela: CASA_VELA }

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function build(tenantId: string, specs: CategorySpec[]): Menu {
  const short = SHORT[tenantId] ?? 'xx'
  const categories: MenuCategory[] = specs.map((spec, index) => ({
    id: `mc_${short}_${spec.id}`,
    tenantId,
    name: spec.name,
    description: spec.description,
    sortOrder: index,
    service: spec.service,
  }))
  const items: MenuItem[] = []
  for (const spec of specs) {
    for (const [name, price, description, options = {}] of spec.items) {
      const id = `mi_${short}_${slug(name)}`
      const rng = createRng(hashSeed(id))
      const demand = options.demand ?? 0.5
      const sold = Math.round(demand * rngInt(rng, 180, 260))
      items.push({
        id,
        tenantId,
        categoryId: `mc_${short}_${spec.id}`,
        name,
        description,
        price,
        imageUrl: options.photo ? photo(options.photo) : undefined,
        tags: options.tags ?? [],
        channels: options.channels ?? ALL,
        status: options.status ?? 'available',
        popular: options.popular ?? false,
        prepMinutes: options.prep ?? 10,
        modifiers: options.modifiers ?? [],
        sold30d: sold,
        revenue30d: sold * price,
      })
    }
  }
  return { categories, items }
}

const cache = new Map<string, Menu>()

export function getMenu(tenantId: string): Menu {
  const cached = cache.get(tenantId)
  if (cached) return cached
  const menu = build(tenantId, SPECS[tenantId] ?? [])
  cache.set(tenantId, menu)
  return menu
}

export function getMenuItem(tenantId: string, id: string): MenuItem | undefined {
  return getMenu(tenantId).items.find((item) => item.id === id)
}
