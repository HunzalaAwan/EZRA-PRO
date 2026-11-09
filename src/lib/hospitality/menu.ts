import { createRng, hashSeed, rngInt } from '@/lib/utils'

import {
  GROUP_KIND_META,
  type Allergen,
  type DietaryTag,
  type GroupKind,
  type Menu,
  type MenuCategory,
  type MenuFaq,
  type MenuGroupRef,
  type MenuItem,
  type MenuItemStatus,
  type MenuMeal,
  type MenuModifier,
  type MenuOption,
  type MenuOptionGroup,
  type MenuVariant,
  type OrderChannel,
  type SpiceLevel,
  type TimeWindow,
} from './types'

/* ==========================================================================
   Menus — one per hospitality tenant, written by hand so they read like a
   real kitchen's board, with sales figures seeded per item.

   Choices are choice groups: sizes, required choices, extras free and paid,
   "first one free" sauces, things to leave out, meals and set menus built
   from other dishes. Groups used on many dishes live in `sharedGroups`.
   ========================================================================== */

const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`

const ALL: OrderChannel[] = ['dine_in', 'pickup', 'delivery']
const DINE: OrderChannel[] = ['dine_in']
const NO_DELIVERY: OrderChannel[] = ['dine_in', 'pickup']

const WEEKDAYS = [1, 2, 3, 4, 5]
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

interface ItemOptions {
  /** Overrides the id made from the name. */
  id?: string
  kind?: 'dish' | 'set'
  tags?: DietaryTag[]
  channels?: OrderChannel[]
  popular?: boolean
  prep?: number
  photo?: string
  /** Legacy shape; nothing in the seed uses it any more. */
  modifiers?: MenuModifier[]
  variants?: MenuVariant[]
  variantLabel?: string
  groups?: MenuGroupRef[]
  meal?: MenuMeal
  availability?: TimeWindow[]
  allergens?: Allergen[]
  spice?: SpiceLevel
  calories?: number
  serves?: number
  kitchenName?: string
  kitchenNote?: string
  station?: string
  faq?: [question: string, answer: string][]
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
  hours?: TimeWindow[]
  items: ItemSpec[]
}

/* --------------------------------------------------------------------------
   Group helpers
   -------------------------------------------------------------------------- */

const key = (label: string) =>
  label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** An option; the id is made from the label. */
const opt = (label: string, price = 0, extra: Partial<MenuOption> = {}): MenuOption => ({ id: `o_${key(label)}`, label, price, ...extra })

/** An option that is another dish on the menu. Name, photo and sold out come from it. */
const dish = (itemId: string, price = 0, extra: Partial<MenuOption> = {}): MenuOption => ({ id: `o_${itemId.replace(/^mi_[a-z]+_/, '')}`, label: '', price, itemId, ...extra })

const group = (id: string, name: string, kind: GroupKind, options: MenuOption[], extra: Partial<MenuOptionGroup> = {}): MenuOptionGroup => ({
  id,
  name,
  kind,
  min: GROUP_KIND_META[kind].min,
  max: GROUP_KIND_META[kind].max,
  ...extra,
  options,
})

const own = (g: MenuOptionGroup): MenuGroupRef => ({ type: 'own', group: g })
const saved = (groupId: string, rules?: Partial<Pick<MenuOptionGroup, 'min' | 'max' | 'freeQty'>>): MenuGroupRef =>
  rules ? { type: 'shared', groupId, rules } : { type: 'shared', groupId }

const leaveOut = (id: string, ingredients: string[]) => own(group(id, 'Leave anything out?', 'remove', ingredients.map((i) => opt(i)), { kitchenName: 'NO' }))

const size = (id: string, label: string, price: number, extra: Partial<MenuVariant> = {}): MenuVariant => ({ id, label, price, ...extra })

/* --------------------------------------------------------------------------
   Saltline Kitchen & Terrace — Oia, Santorini
   -------------------------------------------------------------------------- */

const SL = (slug: string) => `mi_sl_${slug}`

const SALTLINE_GROUPS: MenuOptionGroup[] = [
  group(
    'sg_sl_sauce',
    'Pick a sauce',
    'extras',
    [opt('Tzatziki', 80), opt('Spicy feta (tirokafteri)', 80, { kitchenLabel: 'TIRO' }), opt('Garlic mayo', 80), opt('Ketchup', 50)],
    { min: 0, max: 3, freeQty: 1, kitchenName: 'SAUCE' },
  ),
  group(
    'sg_sl_side',
    'Choose a side',
    'course',
    [dish(SL('chips'), 0, { isDefault: true }), dish(SL('lemon-potatoes'), 100), dish(SL('horta'), 100), dish(SL('santorini-salad'), 200, { label: 'Santorini salad, small', kitchenLabel: 'SM SALAD' })],
    { kitchenName: 'SIDE' },
  ),
  group(
    'sg_sl_drink',
    'Choose a drink',
    'course',
    [dish(SL('cola')), dish(SL('sparkling-water-750ml')), dish(SL('fresh-orange-juice'), 150), dish(SL('mythos-bottle'), 100)],
    { kitchenName: 'DRINK' },
  ),
  group('sg_sl_milk', 'Milk', 'choice', [opt('Fresh milk', 0, { isDefault: true }), opt('Oat', 50), opt('Lactose-free', 30)], { min: 0, max: 1, kitchenName: 'MILK' }),
]

const SALTLINE: CategorySpec[] = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    description: 'Served on the terrace until 11:30.',
    service: 'breakfast',
    hours: [{ days: EVERY_DAY, from: '08:30', to: '11:30' }],
    items: [
      ['Greek yoghurt, thyme honey & walnuts', 950, 'Strained sheep yoghurt from Naxos, honey from the hills above Pyrgos.', { photo: 'photo-1488477181946-6428a0291777', tags: ['vegetarian', 'nuts', 'gluten_free'], allergens: ['milk', 'nuts'], popular: true, prep: 6, station: 'Cold', demand: 0.8 }],
      ['Strapatsada', 1100, 'Eggs scrambled slowly with grated tomato and feta, toasted village bread.', { photo: 'photo-1525351484163-7529414344d8', tags: ['vegetarian'], allergens: ['eggs', 'milk', 'gluten'], prep: 12, demand: 0.6 }],
      ['Koulouri & feta plate', 850, 'Sesame bread ring, barrel feta, olives, cucumber and tomato.', { photo: 'photo-1785398607169-459bf5342afb', tags: ['vegetarian'], allergens: ['gluten', 'sesame', 'milk'], prep: 5, station: 'Cold', demand: 0.45 }],
      ['Fig & tahini toast', 900, 'Sourdough, black tahini, fresh figs and sea salt.', { photo: 'photo-1484723091739-30a097e8f929', tags: ['vegan'], allergens: ['gluten', 'sesame'], prep: 6, demand: 0.4 }],
    ],
  },
  {
    id: 'lunch',
    name: 'Lunch specials',
    description: 'Weekdays from 12:30 to 15:00.',
    service: 'lunch',
    hours: [{ days: WEEKDAYS, from: '12:30', to: '15:00' }],
    items: [
      [
        'Lunch set',
        1800,
        'A starter, a main and a drink. Some mains cost a little more.',
        {
          kind: 'set',
          prep: 18,
          kitchenName: 'LUNCH SET',
          popular: true,
          demand: 0.55,
          groups: [
            own(group('starter', 'Starter', 'course', [dish(SL('santorini-fava-with-capers')), dish(SL('tomato-keftedes')), dish(SL('santorini-salad'), 200)], { kitchenName: 'STARTER' })),
            own(group('main', 'Main', 'course', [dish(SL('moussaka')), dish(SL('chicken-souvlaki-plate')), dish(SL('gemista')), dish(SL('grilled-octopus'), 500)], { askItemChoices: true, kitchenName: 'MAIN' })),
            own(group('drink', 'Drink', 'course', [dish(SL('sparkling-water-750ml')), dish(SL('cola')), dish(SL('assyrtiko-glass'), 300)], { kitchenName: 'DRINK' })),
          ],
        },
      ],
    ],
  },
  {
    id: 'starters',
    name: 'Starters',
    service: 'all',
    items: [
      ['Santorini fava with capers', 900, 'Yellow split pea purée, caper leaves, red onion, good oil.', { photo: 'photo-1476124369491-e7addf5db371', tags: ['vegan', 'gluten_free'], allergens: [], popular: true, prep: 8, station: 'Cold', demand: 0.85 }],
      ['Tomato keftedes', 1000, 'Fried fritters of the island’s small tomatoes, mint and yoghurt.', { photo: 'photo-1562967914-01efa7e87832', tags: ['vegetarian'], allergens: ['gluten', 'milk'], popular: true, prep: 10, station: 'Fryer', demand: 0.8 }],
      [
        'Build your meze',
        1400,
        'Three dips or more with warm bread for the table.',
        {
          tags: ['vegetarian'],
          allergens: ['gluten', 'milk', 'fish'],
          prep: 8,
          station: 'Cold',
          kitchenName: 'MEZE',
          serves: 2,
          demand: 0.6,
          groups: [
            own(group('dips', 'Pick at least 3 dips', 'extras', [opt('Fava', 0, { maxQty: 2 }), opt('Tzatziki', 0, { maxQty: 2 }), opt('Taramosalata', 0, { maxQty: 2 }), dish(SL('tirokafteri'), 100, { label: 'Spicy feta', maxQty: 2 })], { min: 3, max: null, kitchenName: 'DIPS', note: 'Up to 2 of each.' })),
            own(group('bread', 'Bread', 'choice', [opt('Warm pita', 0, { isDefault: true }), opt('Barley rusk'), opt('Gluten-free bread', 150, { kitchenLabel: 'GF BREAD' })], { kitchenName: 'BREAD' })),
          ],
        },
      ],
      ['Tirokafteri', 700, 'Whipped feta with roasted chilli. It bites back.', { tags: ['vegetarian', 'gluten_free', 'spicy'], allergens: ['milk'], spice: 2, prep: 4, station: 'Cold', demand: 0.4 }],
      ['Grilled octopus', 1800, 'Sun-dried on the line, grilled over charcoal, fava underneath.', { photo: 'photo-1778327564742-59ce83f41373', tags: ['gluten_free', 'shellfish'], allergens: ['molluscs'], popular: true, prep: 14, station: 'Grill', kitchenName: 'OCTO', demand: 0.75 }],
      ['Saganaki with fig', 1200, 'Pan-fried graviera, fig jam, sesame.', { photo: 'photo-1778850855907-8fbf7b089621', tags: ['vegetarian'], allergens: ['milk', 'gluten', 'sesame'], prep: 9, demand: 0.55 }],
      ['Taramosalata & warm pita', 900, 'White cod roe whipped with oil and lemon.', { photo: 'photo-1763647818263-62a9256f097c', allergens: ['fish', 'gluten'], prep: 5, station: 'Cold', demand: 0.5 }],
      [
        'Santorini salad',
        1300,
        'Cherry tomatoes, cucumber, chloro cheese, capers, barley rusk.',
        {
          photo: 'photo-1505253716362-afaea1d3d1af',
          tags: ['vegetarian'],
          allergens: ['milk', 'gluten'],
          prep: 7,
          station: 'Cold',
          demand: 0.7,
          groups: [
            own(group('dressing', 'Dressing', 'choice', [opt('Oil & lemon', 0, { isDefault: true }), opt('On the side', 0, { kitchenLabel: 'DRESS SIDE' })])),
            own(group('salad_add', 'Add protein', 'extras', [opt('Grilled chicken', 600), opt('Grilled prawns', 900)], { max: 2, kitchenName: 'ADD' })),
          ],
        },
      ],
    ],
  },
  {
    id: 'mains',
    name: 'Mains',
    service: 'all',
    items: [
      [
        'Whole grilled fish of the day',
        3400,
        'Landed at Ammoudi this morning. Lemon, oil, horta on the side.',
        {
          photo: 'photo-1519708227418-c8fd9a32b7a2',
          tags: ['gluten_free'],
          allergens: ['fish'],
          channels: NO_DELIVERY,
          popular: true,
          prep: 25,
          station: 'Grill',
          kitchenName: 'FISH',
          variantLabel: 'Portion',
          variants: [size('v_one', 'For one', 3400, { isDefault: true, kitchenLabel: 'x1' }), size('v_two', 'For two', 6400, { kitchenLabel: 'x2' })],
          groups: [own(group('cooked', 'Cooked', 'choice', [opt('Grilled', 0, { isDefault: true }), opt('Fried', 0)], { kitchenName: 'COOK' }))],
          faq: [['Is it boned?', 'We fillet it at the pass if you ask in the note.']],
          demand: 0.7,
        },
      ],
      [
        'Gyros pita',
        650,
        'Shaved meat, tomato, onion, tzatziki and a few chips, rolled in a warm pita.',
        {
          tags: [],
          allergens: ['gluten', 'milk'],
          spice: 0,
          popular: true,
          prep: 8,
          station: 'Grill',
          kitchenName: 'GYROS',
          calories: 620,
          demand: 0.9,
          groups: [
            own(group('meat', 'Choose your meat', 'choice', [opt('Pork', 0, { isDefault: true }), opt('Chicken'), opt('Halloumi', 100)], { kitchenName: 'MEAT' })),
            own(
              group(
                'toppings',
                'Add toppings',
                'extras',
                [
                  opt('Extra feta', 100, { maxQty: 2 }),
                  opt('Fried egg', 100, { maxQty: 2 }),
                  opt('Bacon', 150, { maxQty: 2, soldOut: true }),
                  opt('Extra meat', 250, { maxQty: 2 }),
                  opt('Fresh tomato', 0, { maxQty: 2 }),
                ],
                { max: 5, kitchenName: 'ADD' },
              ),
            ),
            saved('sg_sl_sauce'),
            leaveOut('leave', ['Onion', 'Tomato', 'Tzatziki', 'Chips']),
          ],
          meal: { label: 'Make it a meal', price: 450, description: 'With a side and a drink', groups: [saved('sg_sl_side'), saved('sg_sl_drink')] },
          faq: [['Is the pita vegan?', 'Our pita has no milk or egg; the tzatziki does.']],
        },
      ],
      ['Lamb kleftiko', 2700, 'Shoulder cooked six hours in paper with lemon, garlic and potatoes.', { photo: 'photo-1529692236671-f1f6cf9683ba', tags: ['gluten_free'], allergens: [], popular: true, prep: 15, station: 'Oven', kitchenName: 'KLEFT', demand: 0.75 }],
      ['Moussaka', 2100, 'Aubergine, spiced lamb, béchamel. The recipe has not changed since 1988.', { photo: 'photo-1777199311086-ec5ff230aefd', allergens: ['gluten', 'milk', 'eggs'], prep: 15, station: 'Oven', kitchenName: 'MOUSS', demand: 0.8 }],
      ['Seafood orzo', 2600, 'Kritharaki with mussels, prawns and squid in a saffron tomato broth.', { photo: 'photo-1512058564366-18510be2db19', tags: ['shellfish'], allergens: ['gluten', 'crustaceans', 'molluscs', 'celery'], prep: 18, demand: 0.6 }],
      [
        'Chicken souvlaki plate',
        1900,
        'Two skewers, pita, tzatziki, chips, salad.',
        {
          photo: 'photo-1599487488170-d11ec9c172f0',
          allergens: ['gluten', 'milk'],
          popular: true,
          prep: 14,
          station: 'Grill',
          kitchenName: 'SOUVL PL',
          kitchenNote: 'Plate the skewers on the pita.',
          demand: 0.9,
          groups: [
            own(
              group('skewers', 'Choose 2 skewers', 'choice', [opt('Chicken', 0, { maxQty: 2 }), opt('Pork', 0, { maxQty: 2 }), opt('Halloumi', 150, { maxQty: 2, soldOut: true })], {
                min: 2,
                max: 2,
                kitchenName: 'SKEWERS',
              }),
            ),
            saved('sg_sl_side'),
            saved('sg_sl_sauce', { freeQty: 2 }),
            leaveOut('leave', ['Onion', 'Tomato', 'Tzatziki']),
          ],
        },
      ],
      ['Gemista', 1800, 'Tomatoes and peppers stuffed with rice, herbs and pine nuts.', { tags: ['vegan', 'gluten_free', 'nuts'], allergens: ['nuts'], prep: 12, station: 'Oven', demand: 0.5 }],
    ],
  },
  {
    id: 'grill',
    name: 'From the grill',
    service: 'dinner',
    items: [
      ['Bifteki', 2200, 'Hand-cut beef and lamb patty stuffed with graviera, served with lemon potatoes.', { photo: 'photo-1432139555190-58524dae6a55', allergens: ['milk', 'gluten'], prep: 16, station: 'Grill', demand: 0.6 }],
      ['Lamb chops', 2900, 'Six small chops, oregano and lemon, chips.', { photo: 'photo-1544025162-d76694265947', tags: ['gluten_free'], allergens: [], popular: true, prep: 18, station: 'Grill', kitchenName: 'CHOPS', demand: 0.65 }],
      ['Halloumi & grilled vegetables', 1700, 'Courgette, pepper, aubergine, halloumi, pomegranate molasses.', { photo: 'photo-1598511796432-32663d0875bd', tags: ['vegetarian', 'gluten_free'], allergens: ['milk'], prep: 12, station: 'Grill', demand: 0.5 }],
    ],
  },
  {
    id: 'sides',
    name: 'Sides',
    service: 'all',
    items: [
      ['Lemon potatoes', 600, 'Roasted in stock and lemon.', { photo: 'photo-1594551706251-292c67cb277d', tags: ['vegan', 'gluten_free'], allergens: ['celery'], prep: 5, demand: 0.8 }],
      ['Horta', 600, 'Wild greens, oil and lemon.', { photo: 'photo-1709756761957-d9630cf5bd2c', tags: ['vegan', 'gluten_free'], allergens: [], prep: 5, demand: 0.5 }],
      ['Warm pita', 350, 'Two, brushed with oil.', { photo: 'photo-1710444448935-48ece3b2bd8a', tags: ['vegan'], allergens: ['gluten'], prep: 3, demand: 0.9 }],
      ['Tzatziki', 450, 'Yoghurt, cucumber, garlic.', { photo: 'photo-1687540953277-2ead6ffb3a1c', tags: ['vegetarian', 'gluten_free'], allergens: ['milk'], prep: 2, demand: 0.85 }],
      ['Chips', 400, 'Hand-cut, with oregano and salt. Sold with meals.', { tags: ['vegan', 'gluten_free'], allergens: [], status: 'hidden', prep: 5, station: 'Fryer', demand: 0.3 }],
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    service: 'all',
    items: [
      ['Baklava', 800, 'Walnut, cinnamon, syrup. Made on Tuesdays and Fridays.', { photo: 'photo-1519676867240-f03562e64548', tags: ['vegetarian', 'nuts'], allergens: ['nuts', 'gluten', 'milk'], popular: true, prep: 4, station: 'Pastry', demand: 0.7 }],
      ['Galaktoboureko', 850, 'Semolina custard in filo, orange syrup.', { photo: 'photo-1551024506-0bccd828d307', tags: ['vegetarian'], allergens: ['gluten', 'milk', 'eggs'], prep: 4, station: 'Pastry', demand: 0.55 }],
      ['Sour cherry & mastiha ice cream', 700, 'Two scoops, served with a spoon of vinsanto.', { photo: 'photo-1488900128323-21503983a07e', tags: ['vegetarian', 'gluten_free'], allergens: ['milk', 'sulphites'], channels: DINE, prep: 3, station: 'Pastry', demand: 0.6 }],
    ],
  },
  {
    id: 'drinks',
    name: 'Drinks',
    service: 'drinks',
    items: [
      [
        'Freddo espresso',
        350,
        'Shaken over ice.',
        {
          photo: 'photo-1578314675249-a6910f80cc4e',
          allergens: [],
          channels: NO_DELIVERY,
          prep: 3,
          station: 'Bar',
          kitchenName: 'FREDDO',
          demand: 0.9,
          variants: [size('v_single', 'Single', 350, { kitchenLabel: 'SGL' }), size('v_double', 'Double', 400, { isDefault: true, kitchenLabel: 'DBL' })],
          groups: [
            own(group('sweet', 'Sweetness', 'choice', [opt('None'), opt('Medium', 0, { isDefault: true }), opt('Sweet')], { kitchenName: 'SUGAR' })),
            saved('sg_sl_milk'),
          ],
        },
      ],
      ['Fresh orange juice', 500, 'Pressed to order.', { photo: 'photo-1641659735894-45046caad624', tags: ['vegan', 'gluten_free'], allergens: [], channels: NO_DELIVERY, prep: 3, station: 'Bar', demand: 0.7 }],
      ['Assyrtiko, glass', 900, 'Santo Wines, from vines on the slope below us.', { photo: 'photo-1651665849313-91055ad02729', tags: ['vegan'], allergens: ['sulphites'], channels: DINE, prep: 2, station: 'Bar', demand: 0.9 }],
      ['Mythos, bottle', 500, 'Cold.', { photo: 'photo-1644085159285-5fd924740cb3', tags: ['vegan'], allergens: ['gluten'], channels: DINE, prep: 1, station: 'Bar', demand: 0.7 }],
      ['Sparkling water, 750ml', 350, 'Souroti.', { photo: 'photo-1564644411757-a723deba07a8', tags: ['vegan', 'gluten_free'], allergens: [], channels: NO_DELIVERY, prep: 1, station: 'Bar', demand: 0.8 }],
      ['Mountain tea', 350, 'Sideritis from Crete, with honey.', { photo: 'photo-1514733670139-4d87a1941d55', tags: ['vegan', 'gluten_free'], allergens: [], channels: DINE, prep: 4, station: 'Bar', demand: 0.4 }],
      ['Can of cola', 300, '330ml, cold. Sold with meals.', { id: SL('cola'), tags: ['vegan', 'gluten_free'], allergens: [], status: 'hidden', prep: 1, station: 'Bar', demand: 0.3 }],
    ],
  },
]

/* --------------------------------------------------------------------------
   Casa Vela Kitchen — Alfama, Lisbon
   -------------------------------------------------------------------------- */

const CV = (slug: string) => `mi_cv_${slug}`

const CASA_VELA_GROUPS: MenuOptionGroup[] = [
  group('sg_cv_milk', 'Milk', 'choice', [opt('Whole', 0, { isDefault: true }), opt('Oat', 40), opt('Soy', 40), opt('Lactose-free')], { min: 0, max: 1, kitchenName: 'MILK' }),
  group('sg_cv_side', 'Choose a side', 'course', [dish(CV('chips')), dish(CV('rice')), dish(CV('salad'))], { kitchenName: 'SIDE' }),
]

const CASA_VELA: CategorySpec[] = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    description: 'On the rooftop from 07:30. Included for guests on a breakfast rate.',
    service: 'breakfast',
    items: [
      ['Pastel de nata & coffee', 550, 'Warm from the oven on the corner, with a galão or an espresso.', { photo: 'photo-1562044840-a9bf4731635b', tags: ['vegetarian'], allergens: ['gluten', 'eggs', 'milk'], popular: true, prep: 4, station: 'Bar', demand: 0.95, groups: [saved('sg_cv_milk')] }],
      ['Tosta mista', 700, 'Ham and cheese toasted in butter, the proper way.', { photo: 'photo-1528735602780-2552fd46c7af', allergens: ['gluten', 'milk'], prep: 8, demand: 0.6 }],
      ['Açaí bowl', 1100, 'Granola, banana, berries, coconut.', { photo: 'photo-1490474418585-ba9bad8fd0ea', tags: ['vegan', 'gluten_free'], allergens: ['nuts'], prep: 6, station: 'Cold', demand: 0.5 }],
      [
        'Eggs, any way, on sourdough',
        1050,
        'Two eggs from Sintra, tomato, greens.',
        {
          photo: 'photo-1482049016688-2d3e1b311543',
          tags: ['vegetarian'],
          allergens: ['eggs', 'gluten'],
          prep: 12,
          kitchenName: 'EGGS',
          demand: 0.7,
          groups: [
            own(group('eggs_style', 'How would you like them', 'choice', [opt('Poached'), opt('Fried'), opt('Scrambled')], { kitchenName: 'EGGS' })),
            own(group('add', 'Add to it', 'extras', [opt('Bacon', 200), opt('Avocado', 250), opt('Smoked salmon', 400, { soldOut: true })], { max: 3, kitchenName: 'ADD' })),
            own(group('bread', 'Bread', 'choice', [opt('Sourdough', 0, { isDefault: true }), opt('Gluten-free', 100, { kitchenLabel: 'GF' })], { kitchenName: 'BREAD' })),
          ],
        },
      ],
      [
        'Pequeno-almoço completo',
        1600,
        'The full breakfast: a hot drink, a juice and a plate.',
        {
          kind: 'set',
          prep: 14,
          kitchenName: 'PA COMPLETO',
          popular: true,
          demand: 0.6,
          groups: [
            own(group('hot', 'Hot drink', 'choice', [opt('Galão', 0, { isDefault: true }), opt('Espresso'), opt('Tea'), opt('Hot chocolate', 100)], { kitchenName: 'HOT' })),
            own(group('juice', 'Juice', 'choice', [opt('Orange', 0, { isDefault: true }), opt('None')], { kitchenName: 'JUICE' })),
            own(group('plate', 'Plate', 'course', [dish(CV('tosta-mista')), dish(CV('eggs-any-way-on-sourdough')), dish(CV('acai-bowl'), 200)], { askItemChoices: true, kitchenName: 'PLATE' })),
          ],
        },
      ],
    ],
  },
  {
    id: 'petiscos',
    name: 'Petiscos',
    description: 'Small plates for the table.',
    service: 'all',
    items: [
      ['Pica-pau', 1300, 'Beef strips in garlic and white wine with pickles and bread.', { photo: 'photo-1558030006-450675393462', allergens: ['gluten', 'sulphites', 'mustard'], popular: true, prep: 12, demand: 0.75 }],
      ['Peixinhos da horta', 900, 'Green beans in tempura, the original.', { photo: 'photo-1562967914-01efa7e87832', tags: ['vegan'], allergens: ['gluten'], prep: 8, station: 'Fryer', demand: 0.65 }],
      ['Amêijoas à Bulhão Pato', 1600, 'Clams, garlic, coriander, lemon, more bread.', { photo: 'photo-1615141982883-c7ad0e69fd62', tags: ['shellfish', 'gluten_free'], allergens: ['molluscs'], popular: true, prep: 12, kitchenName: 'AMEIJOAS', demand: 0.7 }],
      ['Queijo da Serra & marmelada', 1200, 'Runny sheep cheese from the Serra da Estrela with quince paste.', { photo: 'photo-1541529086526-db283c563270', tags: ['vegetarian'], allergens: ['milk'], prep: 4, station: 'Cold', demand: 0.5 }],
      ['Pão com chouriço', 700, 'Bread baked around chouriço, served hot.', { photo: 'photo-1597604396383-b8ca64ed8fa7', allergens: ['gluten'], spice: 1, prep: 8, demand: 0.6 }],
    ],
  },
  {
    id: 'mains',
    name: 'Mains',
    service: 'all',
    items: [
      ['Bacalhau à Brás', 2200, 'Shredded salt cod, eggs, matchstick potatoes, olives.', { photo: 'photo-1626804475297-41608ea09aeb', allergens: ['fish', 'eggs'], popular: true, prep: 16, kitchenName: 'BRAS', demand: 0.85 }],
      ['Arroz de pato', 2400, 'Duck rice baked with chouriço and a crisp top.', { photo: 'photo-1589302168068-964664d93dc0', allergens: [], popular: true, prep: 18, station: 'Oven', demand: 0.7 }],
      ['Polvo à lagareiro', 2900, 'Roast octopus, smashed potatoes, a lot of olive oil.', { photo: 'photo-1535980156496-87fc2cfcb832', tags: ['gluten_free', 'shellfish'], allergens: ['molluscs'], prep: 22, station: 'Oven', demand: 0.65 }],
      [
        'Bitoque',
        1900,
        'Thin steak, fried egg, two sides, and the sauce.',
        {
          photo: 'photo-1600891964092-4316c288032e',
          allergens: ['eggs'],
          prep: 14,
          station: 'Grill',
          kitchenName: 'BITOQUE',
          demand: 0.75,
          groups: [
            own(group('steak', 'How do you like the steak', 'choice', [opt('Rare'), opt('Medium', 0, { isDefault: true }), opt('Well done')], { kitchenName: 'COOK' })),
            own(group('bitoque_egg', 'Egg', 'choice', [opt('Fried egg', 0, { isDefault: true }), opt('No egg', 0, { kitchenLabel: 'NO EGG' })], { kitchenName: 'EGG' })),
            own(group('sides', 'Two sides', 'course', [dish(CV('chips'), 0, { maxQty: 2 }), dish(CV('rice'), 0, { maxQty: 2 }), dish(CV('salad'), 0, { maxQty: 2 })], { min: 2, max: 2, kitchenName: 'SIDES' })),
          ],
        },
      ],
      [
        'Prego no pão',
        900,
        'Garlicky steak sandwich in a crusty roll.',
        {
          allergens: ['gluten', 'mustard'],
          prep: 10,
          station: 'Grill',
          kitchenName: 'PREGO',
          demand: 0.55,
          groups: [own(group('mustard', 'Mustard', 'extras', [opt('Mild'), opt('Hot')], { kitchenName: 'MUSTARD' }))],
          meal: {
            label: 'Make it a meal',
            price: 500,
            description: 'With a side and a drink',
            groups: [saved('sg_cv_side'), own(group('drink', 'Choose a drink', 'course', [dish(CV('super-bock-bottle'), 100), dish(CV('galao')), dish(CV('sparkling-water'))], { kitchenName: 'DRINK' }))],
          },
        },
      ],
      ['Caldo verde', 900, 'Kale and potato soup with a slice of chouriço.', { tags: ['gluten_free'], allergens: [], prep: 6, demand: 0.6 }],
      ['Legumes grelhados & grão', 1700, 'Grilled vegetables, chickpeas, herbs, lemon.', { photo: 'photo-1512621776951-a57141f2eefd', tags: ['vegan', 'gluten_free'], allergens: [], prep: 12, station: 'Grill', demand: 0.45 }],
      ['Chips', 300, 'Sold with meals.', { tags: ['vegan', 'gluten_free'], allergens: [], status: 'hidden', prep: 5, station: 'Fryer', demand: 0.3 }],
      ['Rice', 300, 'Sold with meals.', { tags: ['vegan', 'gluten_free'], allergens: [], status: 'hidden', prep: 3, demand: 0.3 }],
      ['Salad', 350, 'Sold with meals.', { tags: ['vegan', 'gluten_free'], allergens: [], status: 'hidden', prep: 3, station: 'Cold', demand: 0.3 }],
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    service: 'all',
    items: [
      [
        'Pastel de nata',
        300,
        'Just one, or the box of six.',
        {
          photo: 'photo-1618250713296-ee011768e525',
          tags: ['vegetarian'],
          allergens: ['gluten', 'eggs', 'milk'],
          popular: true,
          prep: 2,
          station: 'Pastry',
          demand: 0.95,
          variantLabel: 'How many',
          variants: [size('v_one', 'One', 300, { isDefault: true }), size('v_box', 'Box of six', 1800, { kitchenLabel: 'BOX 6' })],
          groups: [own(group('add', 'Add', 'extras', [opt('Cinnamon'), opt('Icing sugar')]))],
        },
      ],
      ['Sericaia with Elvas plum', 800, 'Alentejo egg pudding, cinnamon, a sugared plum.', { photo: 'photo-1614610555838-e20ebc8f3fd4', tags: ['vegetarian'], allergens: ['eggs', 'milk'], prep: 4, station: 'Pastry', demand: 0.55 }],
      ['Chocolate mousse', 750, 'Dark, dense, olive oil and salt.', { photo: 'photo-1673551494277-92204546b504', tags: ['vegetarian', 'gluten_free'], allergens: ['eggs', 'milk'], prep: 3, station: 'Pastry', demand: 0.6 }],
    ],
  },
  {
    id: 'drinks',
    name: 'Drinks',
    service: 'drinks',
    items: [
      ['Vinho verde, glass', 650, 'Quinta de Soalheiro, Alvarinho.', { photo: 'photo-1558346489-19413928158b', tags: ['vegan'], allergens: ['sulphites'], channels: DINE, prep: 2, station: 'Bar', demand: 0.85 }],
      ['Super Bock, bottle', 400, 'Cold.', { photo: 'photo-1597822738124-151fb72dcb79', tags: ['vegan'], allergens: ['gluten'], channels: DINE, prep: 1, station: 'Bar', demand: 0.7 }],
      ['Ginjinha', 450, 'Sour cherry liqueur, with or without the cherry.', { photo: 'photo-1470337458703-46ad1756a187', tags: ['vegan'], allergens: [], channels: DINE, prep: 1, station: 'Bar', demand: 0.6 }],
      [
        'Galão',
        300,
        'Milky coffee in a tall glass.',
        {
          photo: 'photo-1509042239860-f550ce710b93',
          tags: ['vegetarian'],
          allergens: ['milk'],
          channels: NO_DELIVERY,
          prep: 3,
          station: 'Bar',
          kitchenName: 'GALAO',
          demand: 0.9,
          variants: [size('v_regular', 'Regular', 300, { isDefault: true }), size('v_large', 'Large', 380, { kitchenLabel: 'LG' })],
          groups: [
            own(
              group(
                'milk',
                'Milk',
                'choice',
                [opt('Whole', 0, { isDefault: true }), opt('Oat', 40, { priceByVariant: { v_regular: 40, v_large: 60 } }), opt('Soy', 40, { priceByVariant: { v_regular: 40, v_large: 60 } }), opt('Lactose-free')],
                { min: 0, max: 1, kitchenName: 'MILK' },
              ),
            ),
          ],
        },
      ],
      ['Sparkling water', 250, 'Água das Pedras. Sold with meals.', { tags: ['vegan', 'gluten_free'], allergens: [], status: 'hidden', prep: 1, station: 'Bar', demand: 0.3 }],
    ],
  },
]

/* --------------------------------------------------------------------------
   Build
   -------------------------------------------------------------------------- */

const SHORT: Record<string, string> = { tnt_saltline: 'sl', tnt_casavela: 'cv' }
const SPECS: Record<string, CategorySpec[]> = { tnt_saltline: SALTLINE, tnt_casavela: CASA_VELA }
const SHARED: Record<string, MenuOptionGroup[]> = { tnt_saltline: SALTLINE_GROUPS, tnt_casavela: CASA_VELA_GROUPS }

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
  const categories: MenuCategory[] = specs.map((spec, index) => {
    const category: MenuCategory = {
      id: `mc_${short}_${spec.id}`,
      tenantId,
      name: spec.name,
      description: spec.description,
      sortOrder: index,
      service: spec.service,
    }
    if (spec.hours) category.hours = spec.hours
    return category
  })
  const items: MenuItem[] = []
  for (const spec of specs) {
    for (const [name, price, description, options = {}] of spec.items) {
      const id = options.id ?? `mi_${short}_${slug(name)}`
      const rng = createRng(hashSeed(id))
      const demand = options.demand ?? 0.5
      const sold = Math.round(demand * rngInt(rng, 180, 260))
      const imageUrl = options.photo ? photo(options.photo) : undefined
      const item: MenuItem = {
        id,
        tenantId,
        categoryId: `mc_${short}_${spec.id}`,
        name,
        description,
        price,
        imageUrl,
        tags: options.tags ?? [],
        channels: options.channels ?? ALL,
        status: options.status ?? 'available',
        popular: options.popular ?? false,
        prepMinutes: options.prep ?? 10,
        modifiers: options.groups ? [] : options.modifiers ?? [],
        sold30d: sold,
        revenue30d: sold * price,
      }
      if (imageUrl) item.photos = [{ url: imageUrl, alt: name }]
      if (options.kind) item.kind = options.kind
      if (options.variants) {
        item.variants = options.variants
        item.price = Math.min(...options.variants.map((v) => v.price))
      }
      if (options.variantLabel) item.variantLabel = options.variantLabel
      if (options.groups) item.groups = options.groups
      if (options.meal) item.meal = options.meal
      if (options.availability) item.availability = options.availability
      if (options.allergens) item.allergens = options.allergens
      if (options.spice !== undefined) item.spice = options.spice
      if (options.calories !== undefined) item.calories = options.calories
      if (options.serves !== undefined) item.serves = options.serves
      if (options.kitchenName) item.kitchenName = options.kitchenName
      if (options.kitchenNote) item.kitchenNote = options.kitchenNote
      if (options.station) item.station = options.station
      if (options.faq) item.faq = options.faq.map(([question, answer], index): MenuFaq => ({ id: `faq_${slug(name)}_${index + 1}`, question, answer }))
      items.push(item)
    }
  }
  return { categories, items, sharedGroups: SHARED[tenantId] ?? [] }
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
