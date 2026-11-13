/* ==========================================================================
   Help videos — the "Watch how it works" button beside each page title.

   HOW TO ADD A VIDEO
   Paste the link into `url` for the page it explains. That's it: the button
   appears on that page as soon as a link is there, and stays hidden while the
   link is empty. Any of these work, copied straight from the browser:

     YouTube   https://www.youtube.com/watch?v=…   https://youtu.be/…   https://www.youtube.com/shorts/…
     Vimeo     https://vimeo.com/123456789          (unlisted: https://vimeo.com/123456789/abcdef1234)
     Loom      https://www.loom.com/share/…
     A file    https://…/bookings.mp4               (.mp4, .webm, .mov or .m4v)

   `title` is the heading of the video window. `duration` is optional and shows
   on the button, e.g. '2 min'.

   KEYS are the page addresses. `[id]` stands for any one activity, booking or
   guest. A page without its own video uses the closest page above it that has
   one (a booking record shows the Bookings video), except Overview and General
   settings, which only show on their own page.

   TABS: some entries have `tabs` for the tabs inside that page (Walk-ins,
   Analytics, Payments, an activity's page and the activity steps). Give a tab
   its own link only if you made a separate video for it; otherwise the page's
   video plays on every tab.

   PREVIEW: to see the button everywhere before the videos are ready, put
   NEXT_PUBLIC_HELP_VIDEO_PREVIEW=<any video link> in .env.local and rebuild.
   Every entry with an empty `url` then plays that link. Don't set it on the
   live site.
   ========================================================================== */

export interface HelpVideo {
  /** Heading of the video window, e.g. 'How Bookings works'. */
  title: string
  /** YouTube, Vimeo, Loom or a direct video file link. Empty hides the button. */
  url: string
  /** Shown on the button, e.g. '2 min'. */
  duration?: string
}

export interface HelpVideoEntry extends HelpVideo {
  /** Only show on this exact address, never on the pages below it. */
  exact?: boolean
  /** Videos for the tabs inside this page, by tab name. */
  tabs?: Record<string, HelpVideo>
}

/** The activity steps (new activity and editing one) share one set of videos. */
const ACTIVITY_STEPS: HelpVideoEntry = {
  title: 'How to set up an activity',
  url: '',
  tabs: {
    basics: { title: 'Activity steps: Basics', url: '' },
    description: { title: 'Activity steps: Details', url: '' },
    media: { title: 'Activity steps: Photos', url: '' },
    pricing: { title: 'Activity steps: Pricing', url: '' },
    schedule: { title: 'Activity steps: Booking and times', url: '' },
    guests: { title: 'Activity steps: Guests', url: '' },
    review: { title: 'Activity steps: Review and publish', url: '' },
  },
}

export const HELP_VIDEOS: Record<string, HelpVideoEntry> = {
  /* ---------- Today ---------- */
  '/dashboard': { title: 'How the Overview works', url: '', exact: true },
  '/dashboard/calendar': { title: 'How the Calendar works', url: '' },
  '/dashboard/bookings': { title: 'How Bookings works', url: '' },
  '/dashboard/bookings/[id]': { title: 'How a booking record works', url: '' },
  '/dashboard/inbox': { title: 'How the Inbox works', url: '' },
  '/dashboard/manifest': { title: 'How the Guest list works', url: '' },

  /* ---------- Desk and day-of ---------- */
  '/dashboard/walk-in': {
    title: 'How Walk-ins works',
    url: '',
    tabs: {
      sale: { title: 'Walk-ins: making a new sale', url: '' },
      log: { title: 'Walk-ins: the walk-ins log', url: '' },
      revenue: { title: 'Walk-ins: walk-in revenue', url: '' },
    },
  },
  '/dashboard/rentals': { title: 'How Rentals works', url: '' },
  '/dashboard/requests': { title: 'How Custom requests works', url: '' },
  '/dashboard/pickups': { title: 'How Pickups works', url: '' },
  '/dashboard/check-in': { title: 'How Check-in works', url: '' },
  '/dashboard/weather': { title: 'How Weather works', url: '' },

  /* ---------- What you sell ---------- */
  '/dashboard/activities': { title: 'How Activities works', url: '' },
  '/dashboard/activities/[id]': {
    title: 'How an activity page works',
    url: '',
    tabs: {
      overview: { title: 'Activity page: Overview', url: '' },
      pricing: { title: 'Activity page: Pricing', url: '' },
      schedule: { title: 'Activity page: Schedule', url: '' },
      performance: { title: 'Activity page: Performance', url: '' },
      reviews: { title: 'Activity page: Reviews', url: '' },
    },
  },
  '/dashboard/activities/new': ACTIVITY_STEPS,
  '/dashboard/activities/[id]/edit': ACTIVITY_STEPS,
  '/dashboard/resources': { title: 'How Resources works', url: '' },
  '/dashboard/availability': { title: 'How Availability works', url: '' },
  '/dashboard/pricing': { title: 'How Pricing works', url: '' },

  /* ---------- Grow ---------- */
  '/dashboard/analytics': {
    title: 'How Analytics works',
    url: '',
    tabs: {
      overview: { title: 'Analytics: Overview', url: '' },
      revenue: { title: 'Analytics: Revenue', url: '' },
      channels: { title: 'Analytics: Channels', url: '' },
      occupancy: { title: 'Analytics: Occupancy', url: '' },
      funnel: { title: 'Analytics: Funnel', url: '' },
      retention: { title: 'Analytics: Retention', url: '' },
      // Restaurant analytics
      orders: { title: 'Analytics: Orders', url: '' },
      menu: { title: 'Analytics: Menu', url: '' },
      timing: { title: 'Analytics: Timing', url: '' },
      guests: { title: 'Analytics: Guests', url: '' },
    },
  },
  '/dashboard/customers': { title: 'How Guests works', url: '' },
  '/dashboard/customers/[id]': { title: 'How a guest profile works', url: '' },
  '/dashboard/marketing': { title: 'How Marketing works', url: '' },
  '/dashboard/marketing/automations': { title: 'How Marketing automations work', url: '' },
  '/dashboard/marketing/campaigns': { title: 'How Marketing campaigns work', url: '' },
  '/dashboard/marketing/audiences': { title: 'How Marketing audiences work', url: '' },
  '/dashboard/marketing/forms': { title: 'How sign-up forms work', url: '' },
  '/dashboard/marketing/templates': { title: 'How email templates work', url: '' },
  '/dashboard/marketing/settings': { title: 'How Marketing settings work', url: '' },
  '/dashboard/abandoned': { title: 'How Unfinished bookings works', url: '' },
  '/dashboard/payments': {
    title: 'How Payments works',
    url: '',
    tabs: {
      transactions: { title: 'Payments: Transactions', url: '' },
      payouts: { title: 'Payments: Payouts', url: '' },
    },
  },
  '/dashboard/reviews': { title: 'How Reviews works', url: '' },

  /* ---------- Your business ---------- */
  '/dashboard/team': { title: 'How Team works', url: '' },
  '/dashboard/storefront': { title: 'How the Storefront works', url: '' },
  '/dashboard/settings': { title: 'How General settings work', url: '', exact: true },
  '/dashboard/settings/locations': { title: 'How Locations work', url: '' },
  '/dashboard/settings/pickup': { title: 'How Pickup zones work', url: '' },
  '/dashboard/settings/waivers': { title: 'How Waivers and forms work', url: '' },
  '/dashboard/settings/channels': { title: 'How Domains and numbers work', url: '' },
  '/dashboard/settings/booking': { title: 'How the Booking flow works', url: '' },
  '/dashboard/settings/payments': { title: 'How Payment settings work', url: '' },
  '/dashboard/settings/integrations': { title: 'How Integrations work', url: '' },
  '/dashboard/settings/billing': { title: 'How Billing works', url: '' },

  /* ---------- Restaurant workspace ---------- */
  '/dashboard/orders': { title: 'How Orders works', url: '' },
  '/dashboard/menu': { title: 'How the Menu works', url: '' },
  '/dashboard/hours': { title: 'How Hours works', url: '' },

  /* ---------- Hotel workspace ---------- */
  '/dashboard/front-desk': { title: 'How the Front desk works', url: '' },
  '/dashboard/stays': { title: 'How Reservations works', url: '' },
  '/dashboard/rooms': { title: 'How Rooms works', url: '' },
  '/dashboard/housekeeping': { title: 'How Housekeeping works', url: '' },
  '/dashboard/rates': { title: 'How Rates and availability works', url: '' },
}
