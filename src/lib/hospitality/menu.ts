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
      ['Greek yoghurt, thyme honey & walnuts', 950, 'Strained sheep yoghurt from Naxos, honey from the hills above Pyrgos.', { tags: ['vegetarian', 'nuts', 'gluten_free'], popular: true, prep: 6, photo: 'photo-1488477181946-6428a0291777', demand: 0.8 }],
      ['Strapatsada', 1100, 'Eggs scrambled slowly with grated tomato and feta, toasted village bread.', { tags: ['vegetarian'], prep: 12, photo: 'photo-1525351484163-7529414344d8', demand: 0.6 }],
      ['Koulouri & feta plate', 850, 'Sesame bread ring, barrel feta, olives, cucumber and tomato.', { tags: ['vegetarian'], prep: 5, demand: 0.45 }],
      ['Fig & tahini toast', 900, 'Sourdough, black tahini, fresh figs and sea salt.', { tags: ['vegan'], prep: 6, photo: 'photo-1484723091739-30a097e8f929', demand: 0.4 }],
      ['Freddo espresso', 400, 'Double shot shaken over ice.', { channels: NO_DELIVERY, prep: 3, demand: 0.9 }],
      ['Fresh orange juice', 500, 'Pressed to order.', { tags: ['vegan', 'gluten_free'], channels: NO_DELIVERY, prep: 3, demand: 0.7 }],
    ],
  },
  {
    id: 'starters',
    name: 'Starters',
    service: 'all',
    items: [
      ['Santorini fava with capers', 900, 'Yellow split pea purée, caper leaves, red onion, good oil.', { tags: ['vegan', 'gluten_free'], popular: true, prep: 8, demand: 0.85 }],
      ['Tomato keftedes', 1000, 'Fried fritters of the island’s small tomatoes, mint and yoghurt.', { tags: ['vegetarian'], popular: true, prep: 10, demand: 0.8 }],
      ['Grilled octopus', 1800, 'Sun-dried on the line, grilled over charcoal, fava underneath.', { tags: ['gluten_free', 'shellfish'], popular: true, prep: 14, demand: 0.75 }],
      ['Saganaki with fig', 1200, 'Pan-fried graviera, fig jam, sesame.', { tags: ['vegetarian'], prep: 9, demand: 0.55 }],
      ['Taramosalata & warm pita', 900, 'White cod roe whipped with oil and lemon.', { prep: 5, demand: 0.5 }],
      ['Santorini salad', 1300, 'Cherry tomatoes, cucumber, chloro cheese, capers, barley rusk.', { tags: ['vegetarian'], prep: 7, photo: 'photo-1512621776951-a57141f2eefd', modifiers: [modifier('salad_add', 'Add', [['Grilled chicken', 600], ['Grilled prawns', 900]], { multiple: true })], demand: 0.7 }],
    ],
  },
  {
    id: 'mains',
    name: 'Mains',
    service: 'all',
    items: [
      ['Whole grilled fish of the day', 3400, 'Landed at Ammoudi this morning. Lemon, oil, horta on the side.', { tags: ['gluten_free'], channels: NO_DELIVERY, popular: true, prep: 25, photo: 'photo-1519708227418-c8fd9a32b7a2', modifiers: [modifier('fish_size', 'Size', [['For one', 0], ['For two', 3000]], { required: true })], demand: 0.7 }],
      ['Lamb kleftiko', 2700, 'Shoulder cooked six hours in paper with lemon, garlic and potatoes.', { tags: ['gluten_free'], popular: true, prep: 15, demand: 0.75 }],
      ['Moussaka', 2100, 'Aubergine, spiced lamb, béchamel. The recipe has not changed since 1988.', { prep: 15, photo: 'photo-1574484284002-952d92456975', demand: 0.8 }],
      ['Seafood orzo', 2600, 'Kritharaki with mussels, prawns and squid in a saffron tomato broth.', { tags: ['shellfish'], prep: 18, photo: 'photo-1563379926898-05f4575a45d8', demand: 0.6 }],
      ['Chicken souvlaki plate', 1900, 'Two skewers, pita, tzatziki, chips, salad.', { popular: true, prep: 14, photo: 'photo-1529193591184-b1d58069ecdd', modifiers: [modifier('souvlaki_meat', 'Choose your skewers', [['Chicken', 0], ['Pork', 0], ['Halloumi', 150]], { required: true }), modifier('souvlaki_side', 'Side', [['Chips', 0], ['Lemon potatoes', 0], ['Extra salad', 0]])], demand: 0.9 }],
      ['Gemista', 1800, 'Tomatoes and peppers stuffed with rice, herbs and pine nuts.', { tags: ['vegan', 'gluten_free', 'nuts'], prep: 12, demand: 0.5 }],
    ],
  },
  {
    id: 'grill',
    name: 'From the grill',
    service: 'dinner',
    items: [
      ['Bifteki', 2200, 'Hand-cut beef and lamb patty stuffed with graviera, served with lemon potatoes.', { prep: 16, photo: 'photo-1544025162-d76694265947', demand: 0.6 }],
      ['Lamb chops', 2900, 'Six small chops, oregano and lemon, chips.', { tags: ['gluten_free'], popular: true, prep: 18, photo: 'photo-1600891964092-4316c288032e', demand: 0.65 }],
      ['Halloumi & grilled vegetables', 1700, 'Courgette, pepper, aubergine, halloumi, pomegranate molasses.', { tags: ['vegetarian', 'gluten_free'], prep: 12, demand: 0.5 }],
    ],
  },
  {
    id: 'sides',
    name: 'Sides',
    service: 'all',
    items: [
      ['Lemon potatoes', 600, 'Roasted in stock and lemon.', { tags: ['vegan', 'gluten_free'], prep: 5, demand: 0.8 }],
      ['Horta', 600, 'Wild greens, oil and lemon.', { tags: ['vegan', 'gluten_free'], prep: 5, demand: 0.5 }],
      ['Warm pita', 350, 'Two, brushed with oil.', { tags: ['vegan'], prep: 3, demand: 0.9 }],
      ['Tzatziki', 450, 'Yoghurt, cucumber, garlic.', { tags: ['vegetarian', 'gluten_free'], prep: 2, demand: 0.85 }],
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    service: 'all',
    items: [
      ['Baklava', 800, 'Walnut, cinnamon, syrup. Made on Tuesdays and Fridays.', { tags: ['vegetarian', 'nuts'], popular: true, prep: 4, photo: 'photo-1519676867240-f03562e64548', demand: 0.7 }],
      ['Galaktoboureko', 850, 'Semolina custard in filo, orange syrup.', { tags: ['vegetarian'], prep: 4, demand: 0.55 }],
      ['Sour cherry & mastiha ice cream', 700, 'Two scoops, served with a spoon of vinsanto.', { tags: ['vegetarian', 'gluten_free'], channels: DINE, prep: 3, demand: 0.6 }],
    ],
  },
  {
    id: 'drinks',
    name: 'Drinks',
    service: 'drinks',
    items: [
      ['Assyrtiko, glass', 900, 'Santo Wines, from vines on the slope below us.', { tags: ['vegan'], channels: DINE, prep: 2, demand: 0.9 }],
      ['Mythos, bottle', 500, 'Cold.', { tags: ['vegan'], channels: DINE, prep: 1, demand: 0.7 }],
      ['Sparkling water, 750ml', 350, 'Souroti.', { tags: ['vegan', 'gluten_free'], channels: NO_DELIVERY, prep: 1, demand: 0.8 }],
      ['Mountain tea', 350, 'Sideritis from Crete, with honey.', { tags: ['vegan', 'gluten_free'], channels: DINE, prep: 4, demand: 0.4 }],
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
      ['Pastel de nata & coffee', 550, 'Warm from the oven on the corner, with a galão or an espresso.', { tags: ['vegetarian'], popular: true, prep: 4, photo: 'photo-1509365465985-25d11c17e812', demand: 0.95 }],
      ['Tosta mista', 700, 'Ham and cheese toasted in butter, the proper way.', { prep: 8, demand: 0.6 }],
      ['Açaí bowl', 1100, 'Granola, banana, berries, coconut.', { tags: ['vegan', 'gluten_free'], prep: 6, photo: 'photo-1490474418585-ba9bad8fd0ea', demand: 0.5 }],
      ['Eggs, any way, on sourdough', 1050, 'Two eggs from Sintra, tomato, greens.', { tags: ['vegetarian'], prep: 12, photo: 'photo-1482049016688-2d3e1b311543', modifiers: [modifier('eggs_style', 'How would you like them', [['Poached', 0], ['Fried', 0], ['Scrambled', 0]], { required: true })], demand: 0.7 }],
    ],
  },
  {
    id: 'petiscos',
    name: 'Petiscos',
    description: 'Small plates for the table.',
    service: 'all',
    items: [
      ['Pica-pau', 1300, 'Beef strips in garlic and white wine with pickles and bread.', { popular: true, prep: 12, photo: 'photo-1544025162-d76694265947', demand: 0.75 }],
      ['Peixinhos da horta', 900, 'Green beans in tempura, the original.', { tags: ['vegan'], prep: 8, demand: 0.65 }],
      ['Amêijoas à Bulhão Pato', 1600, 'Clams, garlic, coriander, lemon, more bread.', { tags: ['shellfish', 'gluten_free'], popular: true, prep: 12, photo: 'photo-1615141982883-c7ad0e69fd62', demand: 0.7 }],
      ['Queijo da Serra & marmelada', 1200, 'Runny sheep cheese from the Serra da Estrela with quince paste.', { tags: ['vegetarian'], prep: 4, demand: 0.5 }],
      ['Pão com chouriço', 700, 'Bread baked around chouriço, served hot.', { prep: 8, demand: 0.6 }],
    ],
  },
  {
    id: 'mains',
    name: 'Mains',
    service: 'all',
    items: [
      ['Bacalhau à Brás', 2200, 'Shredded salt cod, eggs, matchstick potatoes, olives.', { popular: true, prep: 16, photo: 'photo-1604908176997-125f25cc6f3d', demand: 0.85 }],
      ['Arroz de pato', 2400, 'Duck rice baked with chouriço and a crisp top.', { popular: true, prep: 18, demand: 0.7 }],
      ['Polvo à lagareiro', 2900, 'Roast octopus, smashed potatoes, a lot of olive oil.', { tags: ['gluten_free', 'shellfish'], prep: 22, demand: 0.65 }],
      ['Bitoque', 1900, 'Thin steak, fried egg, chips, rice, and the sauce.', { prep: 14, photo: 'photo-1600891964092-4316c288032e', modifiers: [modifier('bitoque_egg', 'Egg', [['Fried', 0], ['No egg', 0]])], demand: 0.75 }],
      ['Caldo verde', 900, 'Kale and potato soup with a slice of chouriço.', { tags: ['gluten_free'], prep: 6, demand: 0.6 }],
      ['Legumes grelhados & grão', 1700, 'Grilled vegetables, chickpeas, herbs, lemon.', { tags: ['vegan', 'gluten_free'], prep: 12, demand: 0.45 }],
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    service: 'all',
    items: [
      ['Pastel de nata', 300, 'Just one, or the box of six.', { tags: ['vegetarian'], popular: true, prep: 2, photo: 'photo-1509365465985-25d11c17e812', modifiers: [modifier('nata_qty', 'How many', [['One', 0], ['Box of six', 1500]], { required: true })], demand: 0.95 }],
      ['Sericaia with Elvas plum', 800, 'Alentejo egg pudding, cinnamon, a sugared plum.', { tags: ['vegetarian'], prep: 4, demand: 0.55 }],
      ['Chocolate mousse', 750, 'Dark, dense, olive oil and salt.', { tags: ['vegetarian', 'gluten_free'], prep: 3, demand: 0.6 }],
    ],
  },
  {
    id: 'drinks',
    name: 'Drinks',
    service: 'drinks',
    items: [
      ['Vinho verde, glass', 650, 'Quinta de Soalheiro, Alvarinho.', { tags: ['vegan'], channels: DINE, prep: 2, demand: 0.85 }],
      ['Super Bock, bottle', 400, 'Cold.', { tags: ['vegan'], channels: DINE, prep: 1, demand: 0.7 }],
      ['Ginjinha', 450, 'Sour cherry liqueur, with or without the cherry.', { tags: ['vegan'], channels: DINE, prep: 1, demand: 0.6 }],
      ['Galão', 300, 'Milky coffee in a tall glass.', { tags: ['vegetarian'], channels: NO_DELIVERY, prep: 3, demand: 0.9 }],
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
