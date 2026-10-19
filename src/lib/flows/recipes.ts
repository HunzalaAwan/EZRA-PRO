import { blankFlow, newId } from './catalog'
import type {
  ActionStep,
  BranchStep,
  Condition,
  ConditionField,
  ConditionGroup,
  ConditionOp,
  Duration,
  EmailStep,
  Flow,
  FlowExit,
  FlowGoal,
  FlowPurpose,
  FlowSettings,
  FlowStep,
  FlowTrigger,
  SmsStep,
  TimeUnit,
  WaitStep,
} from './types'

/* ==========================================================================
   Recipes — ready-made automations filed under the outcome they are for.
   Each asks at most three plain questions, then builds a complete draft
   flow with the wording already written, so an owner can turn it on as is
   or change what they like in the builder. Browser- and server-safe.
   ========================================================================== */

interface RecipeQuestionBase {
  id: string
  label: string
  /** One plain line under the control. */
  help?: string
}

/** One guided question. The default's type follows the kind, and number answers are kept between min and max. */
export type RecipeQuestion =
  | (RecipeQuestionBase & { kind: 'activities'; default: string[] })
  | (RecipeQuestionBase & {
      kind: 'percent' | 'days' | 'number'
      default: number
      min: number
      max: number
      /** number: what the number counts ("hours", "guests"). */
      unit?: string
    })
  | (RecipeQuestionBase & { kind: 'yesno'; default: boolean })

export type RecipeAnswers = Record<string, string[] | number | boolean>

export interface RecipeContext {
  activities: { slug: string; name: string }[]
  nowIso: string
  business: string
}

export interface Recipe {
  id: string
  goal: FlowGoal
  name: string
  /** One plain line. */
  blurb: string
  /** What it tends to achieve, in plain words. */
  outcome: string
  /** The steps in a few words each, for the card. */
  steps: string[]
  questions?: RecipeQuestion[]
  build: (answers: RecipeAnswers, ctx: RecipeContext) => Flow
}

/* ---------- small builders: every step gets its own id ---------- */

const dur = (amount: number, unit: TimeUnit = 'days'): Duration => ({ amount, unit })

const cond = (field: ConditionField, op: ConditionOp, value?: Condition['value']): Condition => ({ id: newId('cond'), field, op, value })
const all = (...conditions: Condition[]): ConditionGroup => ({ match: 'all', conditions })
const NOBODY_FILTERED: ConditionGroup = { match: 'all', conditions: [] }

const email = (subject: string, body: string, preheader?: string): EmailStep => ({ id: newId('step'), type: 'email', subject, preheader, body })
const sms = (body: string): SmsStep => ({ id: newId('step'), type: 'sms', body })
const wait = (amount: number, unit: TimeUnit = 'days'): WaitStep => ({ id: newId('step'), type: 'wait', mode: 'for', duration: dur(amount, unit) })
const waitBeforeStart = (amount: number, unit: TimeUnit): WaitStep => ({ id: newId('step'), type: 'wait', mode: 'until_before_start', duration: dur(amount, unit) })
const waitFor = (event: NonNullable<WaitStep['event']>, amount: number, unit: TimeUnit = 'days'): WaitStep => ({
  id: newId('step'),
  type: 'wait',
  mode: 'until_event',
  event,
  timeout: dur(amount, unit),
})
const branch = (label: string, when: ConditionGroup, yes: FlowStep[], no: FlowStep[] = []): BranchStep => ({ id: newId('step'), type: 'branch', label, when, yes, no })
// The "Yes" path runs when the condition holds, so the question asks about the condition: not booked yet.
const notBooked = (yes: FlowStep[]) => branch('Still not booked?', all(cond('flow.booked', 'no')), yes)
const giveCode = (percent: number, validDays: number, prefix: string): ActionStep => ({ id: newId('step'), type: 'action', action: 'give_code', code: { percent, validDays, prefix } })
const addTag = (tag: string): ActionStep => ({ id: newId('step'), type: 'action', action: 'add_tag', tag })
const tellTeam = (message: string, assignee: ActionStep['assignee'] = 'managers'): ActionStep => ({ id: newId('step'), type: 'action', action: 'notify_team', message, assignee })
const addTask = (message: string, due: Duration, assignee: ActionStep['assignee'] = 'managers'): ActionStep => ({
  id: newId('step'),
  type: 'action',
  action: 'create_task',
  message,
  assignee,
  due,
})
const addNote = (message: string): ActionStep => ({ id: newId('step'), type: 'action', action: 'add_note', message })

/* ---------- answers ---------- */

function num(answers: RecipeAnswers, id: string, fallback: number, min = 0, max = 10_000) {
  const value = answers[id]
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function yes(answers: RecipeAnswers, id: string, fallback: boolean) {
  const value = answers[id]
  return typeof value === 'boolean' ? value : fallback
}

/** Chosen activities that still exist. Empty: every activity. */
function chosen(answers: RecipeAnswers, id: string, ctx: RecipeContext): string[] {
  const value = answers[id]
  if (!Array.isArray(value)) return []
  const known = new Set(ctx.activities.map((activity) => activity.slug))
  return value.filter((slug) => known.has(slug))
}

/** "Only for these activities", as a who condition on a booking. */
function forActivities(slugs: string[]): Condition[] {
  return slugs.length > 0 ? [cond('booking.activity', 'any_of', slugs)] : []
}

const ACTIVITIES_QUESTION: RecipeQuestion = { id: 'activities', label: 'Which activities', kind: 'activities', default: [], help: 'Leave empty for all of them.' }

/* ---------- putting a recipe together ---------- */

interface RecipeParts {
  purpose: FlowPurpose
  trigger: FlowTrigger
  who?: ConditionGroup
  steps: FlowStep[]
  exit?: Partial<FlowExit>
  settings?: Partial<FlowSettings>
}

interface RecipeSpec extends Omit<Recipe, 'build'> {
  make: (answers: RecipeAnswers, ctx: RecipeContext) => RecipeParts
}

/** Answers with every question's default filled in. */
export function recipeDefaults(recipe: Pick<Recipe, 'questions'>): RecipeAnswers {
  return Object.fromEntries((recipe.questions ?? []).map((question) => [question.id, question.default]))
}

/** The answers a recipe will really use: defaults for anything missing or of the wrong type, numbers kept in range. */
export function settleAnswers(recipe: Pick<Recipe, 'questions'>, answers: RecipeAnswers): RecipeAnswers {
  const out: RecipeAnswers = { ...answers }
  for (const question of recipe.questions ?? []) {
    const value = answers[question.id]
    switch (question.kind) {
      case 'activities':
        out[question.id] = Array.isArray(value) ? value.filter((slug) => typeof slug === 'string') : question.default
        break
      case 'yesno':
        out[question.id] = typeof value === 'boolean' ? value : question.default
        break
      default: {
        const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : question.default
        out[question.id] = Math.min(question.max, Math.max(question.min, n))
      }
    }
  }
  return out
}

function recipe(spec: RecipeSpec): Recipe {
  const { make, ...meta } = spec
  return {
    ...meta,
    build: (answers, ctx) => {
      const parts = make(settleAnswers(meta, answers), ctx)
      const base = blankFlow({ trigger: parts.trigger, purpose: parts.purpose, name: meta.name, nowIso: ctx.nowIso })
      return {
        ...base,
        name: meta.name,
        description: meta.blurb,
        goal: meta.goal,
        purpose: parts.purpose,
        status: 'draft',
        trigger: parts.trigger,
        who: parts.who ?? NOBODY_FILTERED,
        steps: parts.steps,
        exit: { ...base.exit, ...parts.exit },
        settings: { ...base.settings, ...parts.settings },
        recipeId: meta.id,
        builtIn: false,
        createdAt: ctx.nowIso,
        updatedAt: ctx.nowIso,
        history: [{ at: ctx.nowIso, what: `Started from the “${meta.name}” recipe` }],
      }
    },
  }
}

/* ==========================================================================
   The recipes, by goal
   ========================================================================== */

export const RECIPES: Recipe[] = [
  /* ---------- Fill empty seats ---------- */
  recipe({
    id: 'fill-empty-seats',
    goal: 'fill_seats',
    name: 'Fill empty seats',
    blurb: 'When a trip or visit is running quiet, offer the spare seats to past guests with a code just for them.',
    outcome: 'Usually fills 2–4 seats on a quiet trip or visit',
    steps: ['A trip or visit is under half full', 'Give each past guest their own code', 'Email the open seats', 'Text the ones who have not booked'],
    questions: [
      { id: 'fillBelow', label: 'Start when it is less than this full', kind: 'percent', default: 50, min: 5, max: 95 },
      { id: 'daysBefore', label: 'How many days before it starts', kind: 'days', default: 3, min: 1, max: 30 },
      { id: 'percent', label: 'Discount for past guests', kind: 'percent', default: 15, min: 1, max: 90 },
    ],
    make: (answers) => {
      const daysBefore = num(answers, 'daysBefore', 3, 1, 30)
      const percent = num(answers, 'percent', 15, 1, 90)
      const steps: FlowStep[] = [
        giveCode(percent, Math.min(daysBefore, 7), 'SEATS'),
        email(
          '{activity} on {date}: a few seats left for you',
          'Hi {first_name},\n\nWe have {seats_left} seats left on {activity} on {date} at {time}, and we would love to see you back. As someone who has been with us before, you get first pick and {offer_percent} off with your own code: {offer_code}\n\nThe code covers everyone on your booking and is good until the day.\n\nGrab your seats: {book_link}\n\nSee you soon,\n{business}',
          'As a past guest, you get first pick and {offer_percent} off.',
        ),
      ]
      // A text the day after, only when there is still a day to spare before it starts.
      if (daysBefore >= 2) steps.push(wait(1), notBooked([sms('{business}: {seats_left} seats left on {activity}, {date} at {time}. {offer_percent} off with {offer_code}: {book_link}')]))
      return {
        purpose: 'marketing',
        trigger: { type: 'low_fill', offset: dur(daysBefore), fillBelow: num(answers, 'fillBelow', 50, 5, 95), reach: 'past_guests_of_activity' },
        steps,
        // A guest can hear about another quiet trip or visit, but not every week.
        settings: { reentry: 'every', reentryDays: 14 },
      }
    },
  }),
  recipe({
    id: 'last-minute-locals',
    goal: 'fill_seats',
    name: 'Last-minute seats for locals',
    blurb: 'Shortly before a quiet trip or visit, text guests who live nearby and can come at short notice.',
    outcome: 'Usually fills 1–3 late seats each time',
    steps: ['A trip or visit is under 70% full the day before', 'Give each local their own code', 'Send a short text'],
    questions: [
      { id: 'fillBelow', label: 'Start when it is less than this full', kind: 'percent', default: 70, min: 5, max: 95 },
      { id: 'hoursBefore', label: 'How many hours before it starts', kind: 'number', unit: 'hours', default: 24, min: 2, max: 96 },
      { id: 'percent', label: 'Discount for locals', kind: 'percent', default: 10, min: 1, max: 90 },
    ],
    make: (answers) => ({
      purpose: 'marketing',
      trigger: { type: 'low_fill', offset: dur(num(answers, 'hoursBefore', 24, 2, 96), 'hours'), fillBelow: num(answers, 'fillBelow', 70, 5, 95), reach: 'audience', audienceId: 'aud_local' },
      who: all(cond('guest.local', 'yes')),
      steps: [giveCode(num(answers, 'percent', 10, 1, 90), 2, 'LOCAL'), sms('{business}: last-minute seats on {activity}, {date} at {time}. Locals get {offer_percent} off with {offer_code}: {book_link}')],
      settings: { reentry: 'every', reentryDays: 7 },
    }),
  }),

  /* ---------- Get guests ready ---------- */
  recipe({
    id: 'reminder-what-to-bring',
    goal: 'prepare_guests',
    name: 'Reminder and what to bring',
    blurb: 'An email two days before with where to meet and what to bring, then a short text a few hours before.',
    outcome: 'Usually means fewer no-shows and fewer “where do we meet?” calls',
    steps: ['2 days before the start', 'Email where to meet and what to bring', 'A few hours before, send a short text'],
    questions: [
      ACTIVITIES_QUESTION,
      { id: 'daysBefore', label: 'Email this many days before', kind: 'days', default: 2, min: 1, max: 14 },
      { id: 'hoursBefore', label: 'Text this many hours before', kind: 'number', unit: 'hours', default: 3, min: 1, max: 24 },
    ],
    make: (answers, ctx) => ({
      purpose: 'booking',
      trigger: { type: 'before_start', offset: dur(num(answers, 'daysBefore', 2, 1, 14)) },
      who: all(...forActivities(chosen(answers, 'activities', ctx))),
      steps: [
        email(
          'Getting ready for {activity} on {date}',
          'Hi {first_name},\n\nNot long now. Here is everything you need for {activity} on {date} at {time}.\n\nWhere to meet: {meeting_point}. Please arrive 15 minutes early so we can start on time.\n\nWhat to bring:\n- Comfortable clothes and shoes\n- Water, and a snack if you like\n- Sun protection or a warm layer, depending on the day\n\nYou are booked for {party}. To change the number of guests, sign waivers or check the details, go to {manage_link}\n\nAny questions, just reply to this email.\n\nSee you soon,\n{business}',
          'Where to meet, what to bring and when to arrive.',
        ),
        waitBeforeStart(num(answers, 'hoursBefore', 3, 1, 24), 'hours'),
        sms('Hi {first_name}, see you at {time} for {activity}. Meet at {meeting_point}, 15 min early if you can. Running late? Reply to this text.'),
      ],
    }),
  }),
  recipe({
    id: 'waiver-chaser',
    goal: 'prepare_guests',
    name: 'Waiver chaser',
    blurb: 'Reminds guests who still have waivers to sign, and tells your team if they still have not done it the day before.',
    outcome: 'Usually gets most waivers signed before the day',
    steps: ['2 days before the start', 'If waivers are missing, email the link', 'Wait up to a day for them to sign', 'Still missing: text them and tell your team'],
    questions: [ACTIVITIES_QUESTION, { id: 'daysBefore', label: 'Start this many days before', kind: 'days', default: 2, min: 1, max: 14 }],
    make: (answers, ctx) => {
      const missing = () => all(cond('booking.waiversMissing', 'yes'))
      return {
        purpose: 'booking',
        trigger: { type: 'before_start', offset: dur(num(answers, 'daysBefore', 2, 1, 14)) },
        who: all(...forActivities(chosen(answers, 'activities', ctx))),
        steps: [
          branch('Are any waivers still unsigned?', missing(), [
            email(
              'Quick one before {activity}: waivers to sign',
              'Hi {first_name},\n\nBefore {activity} on {date}, we still need a signed waiver for everyone in your group. It takes about two minutes per person and means we can get started as soon as you arrive.\n\nSign here: {manage_link}\n\nYou can sign for yourself and share the same link with the others in your group.\n\nThank you,\n{business}',
              'Two minutes now saves time on the day.',
            ),
            waitFor('waivers_signed', 1),
            branch('Still unsigned?', missing(), [
              sms('Hi {first_name}, waivers for {activity} on {date} are still unsigned. It takes 2 minutes: {manage_link} Thank you! {business}'),
              tellTeam('Waivers still missing for {first_name}’s booking {reference} ({activity}, {date} at {time}). Worth a call before the day.'),
            ]),
          ]),
        ],
      }
    },
  }),
  recipe({
    id: 'balance-chaser',
    goal: 'prepare_guests',
    name: 'Balance reminder',
    blurb: 'For deposit bookings: a friendly reminder before the balance is due, a text if it is still open, then a heads-up to your team.',
    outcome: 'Usually collects most balances before the day',
    steps: ['3 days before the start, if a balance is open', 'Email the amount and a pay link', 'Wait for them to pay', 'Still open: text them, then tell your team'],
    questions: [{ id: 'daysBefore', label: 'Start this many days before', kind: 'days', default: 3, min: 1, max: 30 }],
    make: (answers) => {
      const daysBefore = num(answers, 'daysBefore', 3, 1, 30)
      const owing = () => all(cond('booking.balanceDue', 'at_least', 1))
      // Both waits have to end before the start: 2 days + 12 hours from 3 days out, 12 + 4 hours from 1 day out.
      const firstWait = daysBefore >= 3 ? dur(2) : daysBefore === 2 ? dur(1) : dur(12, 'hours')
      const secondWait = daysBefore >= 2 ? dur(12, 'hours') : dur(4, 'hours')
      return {
        purpose: 'booking',
        trigger: { type: 'balance_due', offset: dur(daysBefore) },
        steps: [
          email(
            'Your balance for {activity} on {date}',
            'Hi {first_name},\n\nWe are looking forward to {activity} on {date} at {time}. Your deposit is in, and the balance of {balance} is due before the day.\n\nYou can pay it in a few taps here: {manage_link}\n\nIf you have already paid, thank you, and please ignore this email. Any questions about your booking, just reply.\n\n{business}',
            'Pay the rest of your booking in a few taps.',
          ),
          waitFor('paid', firstWait.amount, firstWait.unit),
          branch('Is the balance still open?', owing(), [
            sms('Hi {first_name}, your {balance} balance for {activity} on {date} is still open. Pay here: {manage_link} {business}'),
            waitFor('paid', secondWait.amount, secondWait.unit),
            branch('Still open?', owing(), [
              tellTeam('Balance of {balance} still open on booking {reference} ({activity}, {date}). The guest has had an email and a text.'),
              addTask('Call {first_name} about the {balance} balance on {reference}', dur(1)),
            ]),
          ]),
        ],
      }
    },
  }),
  recipe({
    id: 'weather-heads-up',
    goal: 'prepare_guests',
    name: 'Weather heads-up',
    blurb: 'When the forecast puts a trip or visit in doubt, tell everyone booked straight away, so nobody is left wondering.',
    outcome: 'Usually means fewer calls and calmer guests on uncertain days',
    steps: ['The forecast puts a trip or visit in doubt', 'Text everyone booked', 'Follow with an email that explains what happens next'],
    make: () => ({
      purpose: 'booking',
      trigger: { type: 'weather_alert', reach: 'booked_guests' },
      steps: [
        sms('Hi {first_name}, the forecast for {activity} on {date} is uncertain. We are watching it and will confirm soon. {business}'),
        // A short gap so the text and the email do not land at the same moment.
        wait(15, 'minutes'),
        email(
          'Weather update for {activity} on {date}',
          'Hi {first_name},\n\nA quick heads-up: the forecast for {activity} on {date} at {time} is uncertain, and we are keeping a close eye on it.\n\nHere is what happens next:\n- We will confirm by text and email well before the start\n- If we need to call it off, we will get in touch about another date or a refund\n- If it goes ahead, nothing changes and we will see you as planned\n\nYou do not need to do anything for now. Any questions, just reply.\n\n{business}',
          'Nothing to do for now. Here is what happens next.',
        ),
      ],
      // Weather news cannot wait for the morning.
      settings: { quietHours: false },
    }),
  }),

  /* ---------- Get more reviews ---------- */
  recipe({
    id: 'ask-for-review',
    goal: 'reviews',
    name: 'Ask for a review',
    blurb: 'A thank-you and a review link a few hours after the trip, and a short text later if they have not had the chance.',
    outcome: 'Usually gets 1 in 5 guests to leave a review',
    steps: ['3 hours after it ends', 'Email a thank-you and a review link', 'Wait 3 days', 'Not clicked: send a short text'],
    questions: [ACTIVITIES_QUESTION, { id: 'hoursAfter', label: 'Send this many hours after it ends', kind: 'number', unit: 'hours', default: 3, min: 1, max: 72 }],
    make: (answers, ctx) => ({
      purpose: 'booking',
      trigger: { type: 'after_end', offset: dur(num(answers, 'hoursAfter', 3, 1, 72), 'hours') },
      who: all(...forActivities(chosen(answers, 'activities', ctx))),
      steps: [
        email(
          'How was {activity}, {first_name}?',
          'Hi {first_name},\n\nThank you for joining us on {activity}. We hope it was a highlight.\n\nIf you have a minute, would you tell others what it was like? Honest reviews help other guests choose, and they help a small team like ours more than anything.\n\nLeave a review: {manage_link}\n\nAnd if anything was not right, reply to this email. It comes straight to us.\n\nThank you,\n{business}',
          'Your review takes a minute and helps us more than anything.',
        ),
        wait(3),
        branch('Still not clicked the review link?', all(cond('flow.clicked', 'no')), [
          sms('Hi {first_name}, thanks again for {activity}. If you have a minute, a quick review helps us a lot: {manage_link} {business}'),
        ]),
      ],
    }),
  }),
  recipe({
    id: 'thank-happy-reviewers',
    goal: 'reviews',
    name: 'Thank happy reviewers',
    blurb: 'When a guest leaves 4 or 5 stars, say a proper thank-you and give them a code for next time.',
    outcome: 'Usually brings 4–8% of reviewers back within a few months',
    steps: ['A guest leaves 4 or 5 stars', 'Give them their own code', 'Email a thank-you'],
    questions: [
      { id: 'percent', label: 'Thank-you discount', kind: 'percent', default: 10, min: 1, max: 90 },
      { id: 'validDays', label: 'The code is good for', kind: 'days', default: 60, min: 1, max: 365 },
    ],
    make: (answers) => {
      const validDays = num(answers, 'validDays', 60, 1, 365)
      return {
        purpose: 'marketing',
        trigger: { type: 'review_left', ratings: [4, 5] },
        steps: [
          giveCode(num(answers, 'percent', 10, 1, 90), validDays, 'THANKS'),
          email(
            'Thank you for the kind words, {first_name}',
            `Hi {first_name},\n\nThank you for your review of {activity}. We read every one, and the whole team saw yours. Kind words like that make a long day worth it.\n\nAs a thank-you, here is {offer_percent} off your next booking with us: {offer_code}. It is yours alone and good for the next ${validDays} days.\n\nSee what is coming up: {book_link}\n\nWith thanks,\n{business}`,
            'A small thank-you for your next visit.',
          ),
        ],
      }
    },
  }),
  recipe({
    id: 'catch-unhappy-guests',
    goal: 'reviews',
    name: 'Catch unhappy guests',
    blurb: 'When a guest leaves 1 to 3 stars, alert your team, add a to-do to call them, and send a personal apology.',
    outcome: 'Usually turns a bad day into a fair hearing, and sometimes a return visit',
    steps: ['A guest leaves 1 to 3 stars', 'Tell your team and add a to-do to call them', 'An hour later, email a personal apology'],
    make: () => ({
      purpose: 'booking',
      trigger: { type: 'review_left', ratings: [1, 2, 3] },
      steps: [
        addTag('Unhappy review'),
        tellTeam('{first_name} left a low rating for {activity} on {date} (booking {reference}). Worth a personal reply today.'),
        addTask('Call {first_name} about their {activity} on {date} ({reference})', dur(1), 'owner'),
        wait(1, 'hours'),
        email(
          'Sorry we missed the mark, {first_name}',
          'Hi {first_name},\n\nThank you for telling us honestly how {activity} went. I am sorry it was not the day you hoped for.\n\nI would like to hear more and put it right where we can. Could you reply with what went wrong, or a good time for a quick call? Your reply comes straight to me.\n\nWith apologies,\n{business}',
          'We would like to hear what went wrong and put it right.',
        ),
      ],
    }),
  }),

  /* ---------- Bring guests back ---------- */
  recipe({
    id: 'next-trip',
    goal: 'come_back',
    name: 'Next trip offer',
    blurb: 'Two weeks after their trip, a code for the next one, and a short text if they have not booked.',
    outcome: 'Usually brings back 3–6% of guests',
    steps: ['14 days after it ends', 'Give them their own code', 'Email the offer', 'Wait 5 days', 'Not booked: send a short text'],
    questions: [
      ACTIVITIES_QUESTION,
      { id: 'daysAfter', label: 'Send this many days after it ends', kind: 'days', default: 14, min: 1, max: 120 },
      { id: 'percent', label: 'Discount', kind: 'percent', default: 15, min: 1, max: 90 },
    ],
    make: (answers, ctx) => ({
      purpose: 'marketing',
      trigger: { type: 'after_end', offset: dur(num(answers, 'daysAfter', 14, 1, 120)) },
      // Someone who has already booked their next one does not need a code for it.
      who: all(...forActivities(chosen(answers, 'activities', ctx)), cond('guest.hasUpcomingTrip', 'no')),
      steps: [
        giveCode(num(answers, 'percent', 15, 1, 90), 30, 'NEXT'),
        email(
          '{first_name}, your next trip is {offer_percent} off',
          'Hi {first_name},\n\nThank you again for joining us on {activity}. We hope you are still talking about it.\n\nWhen you are ready for the next one, here is {offer_percent} off any booking with your own code: {offer_code}. It is good for the next 30 days, and friends on the same booking get it too.\n\nSee what is on: {book_link}\n\nSee you again soon,\n{business}',
          'A thank-you code, just for you, good for 30 days.',
        ),
        wait(5),
        notBooked([sms('{business}: hi {first_name}, your {offer_percent} off code {offer_code} is still waiting for your next trip. Book here: {book_link}')]),
      ],
    }),
  }),
  recipe({
    id: 'win-back',
    goal: 'come_back',
    name: 'Win back past guests',
    blurb: 'Guests who have not been back in four months get a code to return, and a last-chance reminder a week later.',
    outcome: 'Usually brings back 2–4% of lapsed guests',
    steps: ['120 days since their last trip', 'Give them their own code', 'Email the offer', 'Wait 7 days', 'Not booked: send a last-chance email'],
    questions: [
      { id: 'daysSince', label: 'Days since their last trip or visit', kind: 'days', default: 120, min: 30, max: 730 },
      { id: 'percent', label: 'Discount', kind: 'percent', default: 20, min: 1, max: 90 },
    ],
    make: (answers) => ({
      purpose: 'marketing',
      trigger: { type: 'lapsed', offset: dur(num(answers, 'daysSince', 120, 30, 730)) },
      steps: [
        giveCode(num(answers, 'percent', 20, 1, 90), 21, 'COMEBACK'),
        email(
          'It has been a while, {first_name}',
          'Hi {first_name},\n\nIt has been a while since your last visit, and we would love to see you again. There are new dates on the calendar and a few new things to try.\n\nHere is {offer_percent} off your next booking: {offer_code}. It is good for the next 3 weeks.\n\nPick a date: {book_link}\n\nHope to see you soon,\n{business}',
          'Here is {offer_percent} off to come back and see us.',
        ),
        wait(7),
        notBooked([
          email(
            'Last few days for your {offer_percent} off',
            'Hi {first_name},\n\nA quick reminder: your code {offer_code} for {offer_percent} off runs out in a few days. If you have been meaning to come back, now is a good time.\n\nBook here: {book_link}\n\nNo pressure at all. We will be here when you are ready.\n\n{business}',
            'Your code {offer_code} runs out soon.',
          ),
        ]),
      ],
    }),
  }),
  recipe({
    id: 'trip-anniversary',
    goal: 'come_back',
    name: 'A year since their trip',
    blurb: 'On the anniversary of their trip, a warm memory and an invitation back.',
    outcome: 'Usually brings back 1–3% of last year’s guests',
    steps: ['A year after their trip', 'Email a memory and an invitation back'],
    questions: [
      { id: 'withCode', label: 'Include a discount code', kind: 'yesno', default: false },
      { id: 'percent', label: 'Discount', kind: 'percent', default: 10, min: 1, max: 90, help: 'Only used with a code.' },
    ],
    make: (answers) => {
      const withCode = yes(answers, 'withCode', false)
      const offerLine = withCode ? '\n\nTo mark the occasion, here is {offer_percent} off your next booking: {offer_code}' : ''
      return {
        purpose: 'marketing',
        trigger: { type: 'trip_anniversary', offset: dur(0) },
        who: all(cond('guest.hasUpcomingTrip', 'no')),
        steps: [
          ...(withCode ? [giveCode(num(answers, 'percent', 10, 1, 90), 30, 'ANNIV')] : []),
          email(
            'One year ago today: {activity}',
            `Hi {first_name},\n\nA year ago today you were out with us on {activity}. We hope it is still a good memory.\n\nFancy doing it again, or trying something new? Here is what is coming up: {book_link}${offerLine}\n\nIt would be lovely to see you back.\n\n{business}`,
            'A year on, and we would love to see you again.',
          ),
        ],
      }
    },
  }),
  recipe({
    id: 'seasonal-return',
    goal: 'come_back',
    name: 'Same time next year',
    blurb: 'A month before the anniversary of their trip, invite them back for the same season while dates are still open.',
    outcome: 'Usually brings back 2–5% of last year’s guests',
    steps: ['30 days before the anniversary', 'Give them their own code', 'Email this season’s dates', 'Wait 10 days', 'Not booked: send a short text'],
    questions: [
      { id: 'daysBefore', label: 'Days before the anniversary', kind: 'days', default: 30, min: 7, max: 120 },
      { id: 'percent', label: 'Discount', kind: 'percent', default: 10, min: 1, max: 90 },
    ],
    make: (answers) => ({
      purpose: 'marketing',
      trigger: { type: 'trip_anniversary', offset: dur(num(answers, 'daysBefore', 30, 7, 120)) },
      who: all(cond('guest.hasUpcomingTrip', 'no')),
      steps: [
        giveCode(num(answers, 'percent', 10, 1, 90), 45, 'AGAIN'),
        email(
          'Same time this year, {first_name}?',
          'Hi {first_name},\n\nAbout a year ago you joined us for {activity}, and that time of year is coming round again. The best dates tend to go first.\n\nIf you would like to make it a tradition, here is {offer_percent} off with your own code {offer_code}, good for the next 45 days.\n\nSee this season’s dates: {book_link}\n\n{business}',
          'Last year you came for {activity}. This season’s dates are open.',
        ),
        wait(10),
        // Plain apostrophe: a curly one would make the text twice as long to send.
        notBooked([sms("{business}: hi {first_name}, this season's dates for {activity} are filling up. {offer_percent} off with {offer_code}: {book_link}")]),
      ],
    }),
  }),
  recipe({
    id: 'new-vip',
    goal: 'come_back',
    name: 'Welcome new VIPs',
    blurb: 'When a guest makes their third booking, thank them, tag them as a VIP and let your team know to look out for them.',
    outcome: 'Usually keeps your best guests coming back',
    steps: ['A guest makes their third booking', 'Tag them VIP and tell your team', 'Give them their own code', 'Email a thank-you'],
    questions: [{ id: 'percent', label: 'VIP thank-you discount', kind: 'percent', default: 15, min: 1, max: 90 }],
    make: (answers) => ({
      purpose: 'marketing',
      trigger: { type: 'became_vip' },
      steps: [
        addTag('VIP'),
        tellTeam('{first_name} just became a VIP with their third booking. Say hello next time they come in.', 'everyone'),
        giveCode(num(answers, 'percent', 15, 1, 90), 90, 'VIP'),
        email(
          'You are one of our regulars now, {first_name}',
          'Hi {first_name},\n\nThree bookings with us. Thank you. Guests like you are the reason we love what we do.\n\nAs a small thank-you, here is {offer_percent} off your next booking: {offer_code}. It is good for the next 90 days, and the team will know to look out for you.\n\nSee what is coming up: {book_link}\n\nWith thanks,\n{business}',
          'A thank-you for coming back, and a little something for next time.',
        ),
      ],
    }),
  }),

  /* ---------- Sell more extras ---------- */
  recipe({
    id: 'before-trip-upgrade',
    goal: 'sell_more',
    name: 'Extras before the day',
    blurb: 'A few days before, offer the extras guests love, and a private upgrade to bigger groups.',
    outcome: 'Usually adds extras to 5–10% of bookings',
    steps: ['3 days before the start', 'Email the extras', 'Group of 4 or more: offer a private upgrade'],
    questions: [
      ACTIVITIES_QUESTION,
      { id: 'daysBefore', label: 'Send this many days before', kind: 'days', default: 3, min: 2, max: 30 },
      { id: 'groupSize', label: 'Offer a private upgrade to groups of at least', kind: 'number', unit: 'guests', default: 4, min: 2, max: 100 },
    ],
    make: (answers, ctx) => ({
      purpose: 'marketing',
      trigger: { type: 'before_start', offset: dur(num(answers, 'daysBefore', 3, 2, 30)) },
      who: all(...forActivities(chosen(answers, 'activities', ctx))),
      steps: [
        email(
          'Make the most of {activity} on {date}',
          'Hi {first_name},\n\nYour {activity} on {date} is nearly here. If you would like to make it a little more special, you can still add extras to your booking, like photos of the day, equipment or refreshments for the group.\n\nSee the extras and add them in a minute: {manage_link}\n\nNo need to do anything if you are all set. We look forward to seeing you.\n\n{business}',
          'A few extras guests love, added in a minute.',
        ),
        wait(1),
        branch(`Is it a group of ${num(answers, 'groupSize', 4, 2, 100)} or more?`, all(cond('booking.partySize', 'at_least', num(answers, 'groupSize', 4, 2, 100))), [
          email(
            'Have {activity} to yourselves, {first_name}?',
            'Hi {first_name},\n\nWith {party} coming along, you might like to have {activity} to yourselves. A private booking means your own time, your own pace and no strangers in the photos.\n\nIf that sounds good, reply to this email or switch here, and we will work out the difference for you: {manage_link}\n\n{business}',
            'With {party}, a private booking may cost less than you think.',
          ),
        ]),
      ],
      exit: { onCancelled: true },
    }),
  }),
  recipe({
    id: 'photo-package',
    goal: 'sell_more',
    name: 'Photos after the trip',
    blurb: 'A couple of hours after it ends, send guests their photos from the day, with a reminder if they have not looked.',
    outcome: 'Usually sells photos to 8–15% of bookings',
    steps: ['2 hours after it ends', 'Email their photos', 'Wait 3 days', 'Not clicked: send a short text'],
    questions: [ACTIVITIES_QUESTION, { id: 'hoursAfter', label: 'Send this many hours after it ends', kind: 'number', unit: 'hours', default: 2, min: 1, max: 72 }],
    make: (answers, ctx) => ({
      purpose: 'marketing',
      trigger: { type: 'after_end', offset: dur(num(answers, 'hoursAfter', 2, 1, 72), 'hours') },
      who: all(...forActivities(chosen(answers, 'activities', ctx))),
      steps: [
        email(
          'Your photos from {activity} are ready',
          'Hi {first_name},\n\nThank you for coming along on {activity}. Our team took photos during the day, and yours are ready to see.\n\nHave a look and get the full set: {manage_link}\n\nThey make a lovely keepsake, and they are easy to share with everyone who came.\n\n{business}',
          'Relive the day and share it with everyone who came.',
        ),
        wait(3),
        branch('Still not looked at the photos?', all(cond('flow.clicked', 'no')), [sms('Hi {first_name}, your photos from {activity} are still waiting for you. Take a look: {manage_link} {business}')]),
      ],
    }),
  }),
  recipe({
    id: 'big-group-organiser',
    goal: 'sell_more',
    name: 'Look after group organisers',
    blurb: 'When someone books for a big group, send them organiser tips, a reminder the day before, and a group offer afterwards.',
    outcome: 'Usually turns 1 in 10 organisers into a repeat group booking',
    steps: ['A booking for 6 or more', 'Tag them Group leader', 'Email organiser tips', 'Text the day before', 'Afterwards: a group offer, if they said yes to emails'],
    questions: [
      { id: 'groupSize', label: 'Groups of at least', kind: 'number', unit: 'guests', default: 6, min: 2, max: 500 },
      { id: 'percent', label: 'Discount on their next group', kind: 'percent', default: 15, min: 1, max: 90 },
    ],
    make: (answers) => ({
      purpose: 'booking',
      trigger: { type: 'booking_made' },
      who: all(cond('booking.partySize', 'at_least', num(answers, 'groupSize', 6, 2, 500))),
      steps: [
        addTag('Group leader'),
        email(
          'Organising {activity} for {party}: a few tips',
          'Hi {first_name},\n\nThank you for bringing your group to us. Organising {party} is no small job, so here are a few things that make it easier:\n\n- Share this link so everyone can sign their own waiver and see the details: {manage_link}\n- Plan to arrive 20 minutes early at {meeting_point}, so we can start together\n- Tell us about dietary needs, access needs or late arrivals by replying here\n\nWe will look after the rest. See you on {date}.\n\n{business}',
          'Everything to make the day easy for you and your group.',
        ),
        waitBeforeStart(1, 'days'),
        sms('Hi {first_name}, all set for {party} on {activity}, {date} at {time}. Meet at {meeting_point}. Any changes, reply here. {business}'),
        wait(2),
        // The offer is marketing, so it only goes to organisers who said yes to emails.
        branch('Did they say yes to marketing emails?', all(cond('guest.emailOptIn', 'yes')), [
          giveCode(num(answers, 'percent', 15, 1, 90), 90, 'GROUP'),
          email(
            'Thank you for organising, {first_name}',
            'Hi {first_name},\n\nThank you for bringing your group to {activity}. We know it takes some organising, and we hope everyone had a great time.\n\nIf you are planning the next outing, here is {offer_percent} off your next group booking: {offer_code}. It is good for 90 days.\n\nPlan the next one: {book_link}\n\n{business}',
            'A thank-you for the organiser, and {offer_percent} off your next group.',
          ),
        ]),
      ],
      exit: { onCancelled: true },
    }),
  }),

  /* ---------- Welcome new subscribers ---------- */
  recipe({
    id: 'welcome-series',
    goal: 'welcome',
    name: 'Welcome new subscribers',
    blurb: 'Thank new subscribers with a first-booking code, show them where to start, then a short text before the code runs out.',
    outcome: 'Usually turns 4–8% of new subscribers into guests',
    steps: ['Someone joins your list', 'Give them their own code', 'Email a welcome', 'Wait 3 days, not booked: email your favourites', 'Wait 4 days, not booked: send a short text'],
    questions: [
      { id: 'percent', label: 'First-booking discount', kind: 'percent', default: 10, min: 1, max: 90 },
      { id: 'validDays', label: 'The code is good for', kind: 'days', default: 30, min: 7, max: 365 },
    ],
    make: (answers) => {
      const validDays = num(answers, 'validDays', 30, 7, 365)
      return {
        purpose: 'marketing',
        trigger: { type: 'joined_list' },
        // A first-booking code is for people who have not booked yet (sign-ups at checkout already have).
        who: all(cond('guest.bookings', 'is', 0)),
        steps: [
          giveCode(num(answers, 'percent', 10, 1, 90), validDays, 'WELCOME'),
          email(
            'Welcome to {business}, {first_name}',
            `Hi {first_name},\n\nThank you for joining our list. We are glad you are here.\n\nWe will only write when there is something worth knowing: new dates, the best times to come and the odd offer just for subscribers.\n\nTo start you off, here is {offer_percent} off your first booking with code {offer_code}. It is good for ${validDays} days.\n\nFind a date: {book_link}\n\nSee you soon,\n{business}`,
            'Here is {offer_percent} off your first booking.',
          ),
          wait(3),
          notBooked([
            email(
              'Where to start: our guests’ favourites',
              'Hi {first_name},\n\nNot sure what to book first? Here is where most of our guests start, and the times that tend to sell out first.\n\nSee the favourites: {book_link}\n\nYour {offer_percent} off code {offer_code} still works. Not sure what suits your group? Just reply and we will help you choose.\n\n{business}',
              'The ones people book most, and why.',
            ),
            wait(4),
            notBooked([sms('{business}: hi {first_name}, your {offer_percent} off code {offer_code} is still there for your first booking. Pick a date: {book_link}')]),
          ]),
        ],
      }
    },
  }),

  /* ---------- Save lost bookings ---------- */
  recipe({
    id: 'abandoned-booking',
    goal: 'recover',
    name: 'Rescue unfinished bookings',
    blurb: 'An hour after someone leaves checkout, help them finish, and offer a small code a day later if they still have not.',
    outcome: 'Usually recovers 5–10% of unfinished bookings',
    steps: ['1 hour after they leave checkout', 'Email a link back to their booking', 'Wait 1 day', 'Not booked: give a code and email it'],
    questions: [
      { id: 'withCode', label: 'Send a code if they still have not booked', kind: 'yesno', default: true },
      { id: 'percent', label: 'Discount', kind: 'percent', default: 10, min: 1, max: 90, help: 'Only used with a code.' },
    ],
    make: (answers) => {
      const withCode = yes(answers, 'withCode', true)
      const followUp: FlowStep[] = withCode
        ? [
            giveCode(num(answers, 'percent', 10, 1, 90), 3, 'FINISH'),
            email(
              'Still deciding? Here is {offer_percent} off',
              'Hi {first_name},\n\nIf you are still deciding, here is a little help: {offer_percent} off your booking with code {offer_code}. It is good for the next 3 days.\n\nFinish your booking: {book_link}\n\nThe busiest times do fill up, so do not leave it too long.\n\n{business}',
              'A code for your booking, good for 3 days.',
            ),
          ]
        : [
            email(
              'Any questions before you book, {first_name}?',
              'Hi {first_name},\n\nWe noticed you did not finish your booking. If something stopped you, like a question about the day or a problem at checkout, reply to this email and we will help.\n\nPick up where you left off: {book_link}\n\n{business}',
              'We are happy to help with anything.',
            ),
          ]
      return {
        purpose: 'marketing',
        trigger: { type: 'checkout_abandoned', offset: dur(1, 'hours') },
        steps: [
          email(
            'Your booking is waiting, {first_name}',
            'Hi {first_name},\n\nYou were one step away from booking {activity}. Seats are still open, so you can pick up right where you left off: {book_link}\n\nIf something stopped you, like a question about the day or a problem at checkout, just reply to this email and we will sort it out.\n\n{business}',
            'Pick up right where you left off.',
          ),
          wait(1),
          notBooked(followUp),
        ],
        exit: { onBooked: true },
      }
    },
  }),
  recipe({
    id: 'cancellation-rescue',
    goal: 'recover',
    name: 'Rebook cancelled guests',
    blurb: 'A day after a guest cancels, invite them to pick a new date, with a small code to make it easy.',
    outcome: 'Usually rebooks 5–10% of cancelled guests',
    steps: ['A guest cancels', 'Wait 1 day', 'Give them their own code', 'Email an invitation to rebook'],
    questions: [
      { id: 'percent', label: 'Discount to rebook', kind: 'percent', default: 10, min: 1, max: 90 },
      { id: 'daysAfter', label: 'Send this many days after they cancel', kind: 'days', default: 1, min: 0, max: 30 },
    ],
    make: (answers) => {
      const daysAfter = num(answers, 'daysAfter', 1, 0, 30)
      return {
        purpose: 'marketing',
        trigger: { type: 'booking_cancelled' },
        // Someone who cancelled to move to another date already has a trip coming up.
        who: all(cond('guest.hasUpcomingTrip', 'no')),
        steps: [
          // 0 days: straight away, with no empty wait step.
          ...(daysAfter > 0 ? [wait(daysAfter)] : []),
          giveCode(num(answers, 'percent', 10, 1, 90), 30, 'REBOOK'),
          email(
            'Another date for {activity}?',
            'Hi {first_name},\n\nWe are sorry you could not make {activity} on {date}. Plans change, and that is completely fine.\n\nWhen you are ready to pick a new date, here is {offer_percent} off with your own code {offer_code}, good for 30 days.\n\nFind a new date: {book_link}\n\nWe hope to see you soon,\n{business}',
            'Plans change. Here is {offer_percent} off when you are ready.',
          ),
        ],
        // The cancellation is what starts it, so it must not end it.
        exit: { onCancelled: false, onBooked: true },
      }
    },
  }),
  recipe({
    id: 'no-show-follow-up',
    goal: 'recover',
    name: 'No-show follow-up',
    blurb: 'When a guest does not turn up, check they are all right, offer a new date and note it on their record.',
    outcome: 'Usually rebooks around 1 in 5 no-shows',
    steps: ['A guest does not turn up', 'Tag them and note it on their record', '2 hours later, email to check in'],
    make: () => ({
      purpose: 'booking',
      trigger: { type: 'no_show' },
      steps: [
        addTag('No-show'),
        addNote('Did not turn up for {activity} on {date} at {time} ({reference}).'),
        wait(2, 'hours'),
        email(
          'We missed you today, {first_name}',
          'Hi {first_name},\n\nWe were sorry not to see you for {activity} today at {time}. We hope everything is all right.\n\nIf something came up, reply to this email and we will see what we can do about another date. You can also look at other times here: {book_link}\n\n{business}',
          'We hope everything is all right.',
        ),
      ],
    }),
  }),

  /* ---------- Gift cards ---------- */
  recipe({
    id: 'gift-card-nudges',
    goal: 'gift_cards',
    name: 'Gift card reminders',
    blurb: 'Reminds holders that their gift card still has credit, a month before it runs out and again the week before.',
    outcome: 'Usually gets most expiring gift cards used',
    steps: ['30 days before a gift card runs out', 'Email a reminder', '7 days before: send a short text'],
    questions: [
      { id: 'firstDays', label: 'First reminder, days before it runs out', kind: 'days', default: 30, min: 2, max: 180 },
      { id: 'secondDays', label: 'Second reminder, days before it runs out', kind: 'days', default: 7, min: 1, max: 180, help: 'Fewer days than the first, or there is no second reminder.' },
    ],
    make: (answers) => {
      const first = num(answers, 'firstDays', 30, 2, 180)
      const second = num(answers, 'secondDays', 7, 1, 180)
      return {
        purpose: 'marketing',
        trigger: { type: 'gift_card_expiring', offset: dur(first) },
        steps: [
          email(
            `Your {business} gift card runs out in ${first} days`,
            `Hi {first_name},\n\nA friendly reminder: your {business} gift card still has credit on it, and it runs out in ${first} days.\n\nPick a date and enter the gift card code at checkout: {book_link}\n\nIf it was a present for someone else, now is a good time to give them a nudge.\n\n{business}`,
            'There is still credit on it. Here is how to use it.',
          ),
          ...(second < first
            ? [wait(first - second), sms(`{business}: hi {first_name}, your gift card runs out in ${second} days and still has credit. Use it at checkout: {book_link}`)]
            : []),
        ],
      }
    },
  }),
  recipe({
    id: 'gift-card-thanks',
    goal: 'gift_cards',
    name: 'Gift card thank-you',
    blurb: 'Thanks the buyer and explains how the gift card works and how to pass it on.',
    outcome: 'Usually means fewer “how do I use this?” questions',
    steps: ['Someone buys a gift card', 'Tag them Gift buyer', 'Email a thank-you and how it works'],
    make: () => ({
      purpose: 'booking',
      trigger: { type: 'gift_card_bought' },
      steps: [
        addTag('Gift buyer'),
        email(
          'Thank you for your gift card order',
          'Hi {first_name},\n\nThank you for buying a {business} gift card. It is a lovely thing to give, and we will take good care of whoever comes along.\n\nHow it works:\n- The code is in your receipt, ready to print or forward\n- It can be used for any booking, at checkout\n- Any credit left over stays on the card for next time\n\nWould you like us to send it to them on a set date? Just reply with their name and email.\n\n{business}',
          'How it works, and how to pass it on.',
        ),
      ],
    }),
  }),

  /* ---------- Keep your team in the loop ---------- */
  recipe({
    id: 'team-big-bookings',
    goal: 'team',
    name: 'Tell the team about big bookings',
    blurb: 'When a big group books, let your team know straight away and add a to-do to check staff and equipment.',
    outcome: 'Usually means no surprises on busy days',
    steps: ['A booking for 8 or more', 'Tell your team', 'Add a to-do to check staff and equipment'],
    questions: [{ id: 'groupSize', label: 'Bookings of at least', kind: 'number', unit: 'guests', default: 8, min: 2, max: 500 }],
    make: (answers) => ({
      purpose: 'booking',
      trigger: { type: 'booking_made' },
      who: all(cond('booking.partySize', 'at_least', num(answers, 'groupSize', 8, 2, 500))),
      steps: [
        tellTeam('New big booking: {first_name} booked {activity} for {party} on {date} at {time} ({reference}).', 'everyone'),
        addTask('Check staff and equipment for {party} on {activity}, {date} at {time} ({reference})', dur(1)),
      ],
      exit: { onCancelled: true },
    }),
  }),
]

export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((entry) => entry.id === id)
}

export function recipesForGoal(goal: FlowGoal): Recipe[] {
  return RECIPES.filter((entry) => entry.goal === goal)
}
