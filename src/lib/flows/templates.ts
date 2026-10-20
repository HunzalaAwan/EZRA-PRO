import { blankFlow, type IconName } from '@/lib/flows/catalog'
import { applySimple, newSimpleMessage, type SimpleAutomation, type SimpleMessage } from '@/lib/flows/simple'
import type { Flow, FlowGoal, FlowPurpose, FlowTrigger } from '@/lib/flows/types'

/* ==========================================================================
   Ready-made automations — the ones most businesses add, written and timed,
   so adding one is a click: change a word or a number if you like, then
   turn it on. The six every business starts with (welcome, next trip, we
   miss you, thanks for the review, gift card reminder, a year since your
   trip) are already in the list; these are the rest. Booking messages
   (confirmation, reminders, balance, review request, unfinished booking)
   live under Booking messages and are not repeated here.
   ========================================================================== */

export interface AutomationTemplate {
  id: string
  name: string
  /** One plain line for the card. */
  blurb: string
  icon: IconName
  goal: FlowGoal
  purpose: FlowPurpose
  build: (nowIso: string) => Flow
}

const wait = (amount: number, unit: 'hours' | 'days' = 'days') => ({ amount, unit })

function make(
  id: string,
  { name, description, goal, purpose, trigger, messages, discount }: {
    name: string
    description: string
    goal: FlowGoal
    purpose: FlowPurpose
    trigger: FlowTrigger
    messages: (Partial<SimpleMessage> & Pick<SimpleMessage, 'channel' | 'body'>)[]
    discount?: SimpleAutomation['discount']
  },
): (nowIso: string) => Flow {
  return (nowIso) => {
    const base = blankFlow({ trigger, purpose, name, nowIso, goal })
    const simple: SimpleAutomation = {
      trigger,
      activities: [],
      discount: discount ?? { on: false, percent: 10, validDays: 14, prefix: 'THANKS' },
      messages: messages.map((message) => ({ ...newSimpleMessage(message.channel), ...message })),
      sendAt: '',
    }
    return { ...applySimple(base, simple), description, recipeId: id, history: [{ at: nowIso, what: `Added from “${name}”` }] }
  }
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'waiver-reminder',
    name: 'Waiver reminder',
    blurb: 'Two days before, a nudge to sign. A text the next day if it is still open.',
    icon: 'Hand',
    goal: 'prepare_guests',
    purpose: 'booking',
    build: make('waiver-reminder', {
      name: 'Waiver reminder',
      description: 'Gets waivers signed before the day, not at check-in.',
      goal: 'prepare_guests',
      purpose: 'booking',
      trigger: { type: 'before_start', offset: wait(2) },
      messages: [
        {
          channel: 'email',
          onlyIf: 'waivers_missing',
          subject: 'One quick thing before {activity}',
          body: 'Hi {first_name},\n\nYour group still has a waiver to sign for {activity} on {date}. It takes a minute and saves time when you arrive.\n\nSign it here: {manage_link}\n\nSee you soon,\n{business}',
        },
        {
          channel: 'sms',
          wait: wait(1),
          onlyIf: 'waivers_missing',
          body: 'Hi {first_name}, your waiver for {activity} on {date} is still open. Sign it here: {manage_link}',
        },
      ],
    }),
  },
  {
    id: 'last-minute-seats',
    name: 'Last-minute seats',
    blurb: 'When a trip or visit is under half full 3 days out, offer the seats to past guests.',
    icon: 'Armchair',
    goal: 'fill_seats',
    purpose: 'marketing',
    build: make('last-minute-seats', {
      name: 'Last-minute seats',
      description: 'Fills quiet times with guests who already know you.',
      goal: 'fill_seats',
      purpose: 'marketing',
      trigger: { type: 'low_fill', fillBelow: 50, offset: wait(3), reach: 'past_guests_of_activity' },
      discount: { on: true, percent: 15, validDays: 5, prefix: 'LASTSEATS' },
      messages: [
        {
          channel: 'email',
          subject: 'A few seats left on {activity}, {date}',
          body: 'Hi {first_name},\n\nWe still have room on {activity} on {date} at {time}. Use {offer_code} for {offer_percent}% off if you would like to join us.\n\nBook here: {book_link}\n\n{business}',
        },
      ],
    }),
  },
  {
    id: 'cancel-come-back',
    name: 'Come back after a cancellation',
    blurb: 'Two days after someone cancels, a friendly note and a code to book another time.',
    icon: 'CalendarX',
    goal: 'recover',
    purpose: 'marketing',
    build: make('cancel-come-back', {
      name: 'Come back after a cancellation',
      description: 'Turns a cancelled plan into a new date.',
      goal: 'recover',
      purpose: 'marketing',
      trigger: { type: 'booking_cancelled' },
      discount: { on: true, percent: 10, validDays: 30, prefix: 'NEXTTIME' },
      messages: [
        {
          channel: 'email',
          wait: wait(2),
          subject: 'Another time, {first_name}?',
          body: 'Hi {first_name},\n\nSorry this one didn’t work out. Whenever you are ready, {offer_code} takes {offer_percent}% off your next booking.\n\nPick a new date: {book_link}\n\n{business}',
        },
        {
          channel: 'email',
          wait: wait(7),
          onlyIf: 'not_booked',
          subject: 'Your {offer_percent}% code is still waiting',
          body: 'Hi {first_name},\n\nJust a reminder that {offer_code} is still good for {offer_percent}% off.\n\n{book_link}\n\n{business}',
        },
      ],
    }),
  },
  {
    id: 'missed-trip',
    name: 'Sorry we missed you',
    blurb: 'The day after a guest doesn’t turn up, a kind note with a way to rebook.',
    icon: 'UserX',
    goal: 'recover',
    purpose: 'booking',
    build: make('missed-trip', {
      name: 'Sorry we missed you',
      description: 'A kind note after a no-show, with a way to rebook.',
      goal: 'recover',
      purpose: 'booking',
      trigger: { type: 'no_show' },
      messages: [
        {
          channel: 'email',
          wait: wait(1),
          subject: 'We missed you yesterday, {first_name}',
          body: 'Hi {first_name},\n\nWe were sorry not to see you on {activity}. If plans changed, reply to this email and we will help you find another date.\n\n{business}',
        },
      ],
    }),
  },
  {
    id: 'regular-thanks',
    name: 'Thank your regulars',
    blurb: 'When a guest books for the third time, a thank-you and a code just for them.',
    icon: 'Crown',
    goal: 'come_back',
    purpose: 'marketing',
    build: make('regular-thanks', {
      name: 'Thank your regulars',
      description: 'A thank-you for guests who keep coming back.',
      goal: 'come_back',
      purpose: 'marketing',
      trigger: { type: 'became_vip' },
      discount: { on: true, percent: 15, validDays: 60, prefix: 'REGULAR' },
      messages: [
        {
          channel: 'email',
          subject: 'Thank you for coming back, {first_name}',
          body: 'Hi {first_name},\n\nThree bookings with us! Thank you. Here is {offer_code} for {offer_percent}% off your next one, just for you.\n\n{book_link}\n\n{business}',
        },
      ],
    }),
  },
]

export function templateById(id: string): AutomationTemplate | undefined {
  return AUTOMATION_TEMPLATES.find((template) => template.id === id)
}
