/* ==========================================================================
   The three legal documents: privacy, terms and security. Plain data, so
   the route can render any of them with one layout. Each section has an id
   for the table of contents, a heading, paragraphs and an optional list.
   ========================================================================== */

export type LegalKey = 'privacy' | 'terms' | 'security'

export interface LegalSection {
  id: string
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export interface LegalDocument {
  key: LegalKey
  title: string
  summary: string
  updated: string
  sections: LegalSection[]
}

export const LEGAL_DOCUMENTS: Record<LegalKey, LegalDocument> = {
  privacy: {
    key: 'privacy',
    title: 'Privacy policy',
    summary: 'What EZRA Pro collects, why, who it is shared with, and the choices you and your guests have. Written to be read, not skimmed past.',
    updated: '1 September 2026',
    sections: [
      {
        id: 'who',
        heading: 'Who this covers',
        paragraphs: [
          'EZRA Pro is booking and operations software for tours, activities, restaurants, events, classes and venues. This policy covers two kinds of people: operators, who run a business on EZRA Pro, and guests, who book with an operator through a storefront, a widget or a marketplace we sync with.',
          'For guest data, the operator you booked with is the controller and EZRA Pro is the processor acting on their instructions. For operator account data, EZRA Pro is the controller. Where the distinction matters below, we say which one applies.',
        ],
      },
      {
        id: 'collect',
        heading: 'What we collect',
        paragraphs: ['We collect only what a booking, a payout or an account needs to work.'],
        bullets: [
          'Booking details: the product, date, time, party size, price paid, add-ons, and any notes the guest adds such as dietary or accessibility needs.',
          'Contact details: name, email address and phone number, so confirmations, reminders and changes can reach the guest.',
          'Payment details: handled by our payment processor. EZRA Pro stores a token, the last four digits and the card type, never the full card number.',
          'Waivers and certifications, where an operator requires them, including the signature and the time it was given.',
          'Operator account details: business name, address, tax identifiers, bank account for payouts, and the people you invite to your team.',
          'Usage information: the pages and features used, device and browser type, and diagnostic logs, used to keep the service working and to improve it.',
        ],
      },
      {
        id: 'use',
        heading: 'How we use it',
        paragraphs: ['Each use below has a reason, and we do not use booking data for anything else.'],
        bullets: [
          'To take, confirm, change and refund bookings, and to run the day: manifests, check-in, rosters and payouts.',
          'To send confirmations, reminders, waivers and review requests on the operator’s behalf.',
          'To pay operators, reconcile fees and tips, and produce the records a bookkeeper needs.',
          'To keep the service secure, detect fraud and abuse, and meet legal obligations.',
          'To improve the product, using aggregated and de-identified information wherever possible.',
        ],
      },
      {
        id: 'share',
        heading: 'Who we share it with',
        paragraphs: [
          'We share personal data with three kinds of parties, and no others: the operator a guest books with; service providers that act on our instructions, such as our payment processor, email and text delivery, cloud hosting and analytics; and marketplaces or channels the operator has connected, which receive the booking details needed to keep availability in sync.',
          'We do not sell personal data, and we do not share guest lists with other operators.',
        ],
      },
      {
        id: 'retain',
        heading: 'How long we keep it',
        paragraphs: [
          'Booking and payment records are kept for as long as the operator’s account is active and for seven years afterwards, which is what tax and accounting law generally requires. Waivers are kept for the period the operator sets, with a default of three years after the trip. Diagnostic logs are kept for ninety days.',
          'When an operator closes their account, they can export everything first. After the retention period the data is deleted or de-identified.',
        ],
      },
      {
        id: 'rights',
        heading: 'Your rights',
        paragraphs: [
          'Depending on where you live, you may have the right to access, correct, export, restrict or delete personal data we hold about you, and to object to certain uses. Guests should contact the operator they booked with first, since the operator is the controller; we help operators answer these requests within the time the law allows. Operators can exercise their own rights, and act on their guests’ requests, from the dashboard or by writing to us.',
          'If you are in the European Economic Area or the United Kingdom, you can also complain to your local data protection authority.',
        ],
      },
      {
        id: 'cookies',
        heading: 'Cookies',
        paragraphs: [
          'The storefront and the dashboard use strictly necessary cookies to keep you signed in, to hold a checkout in progress and to protect against cross-site request forgery. Analytics cookies are set only where an operator has enabled a tracking integration and the guest has consented under the operator’s banner. We do not use advertising cookies.',
        ],
      },
      {
        id: 'contact',
        heading: 'Contact',
        paragraphs: [
          'Questions about this policy go to privacy@ezrapro.com. We reply within five business days. If we make a material change to this policy we will tell operators by email at least thirty days before it takes effect.',
        ],
      },
    ],
  },

  terms: {
    key: 'terms',
    title: 'Terms of service',
    summary: 'The agreement between an operator and EZRA Pro: what the service is, what it costs, how money moves, and what each side promises.',
    updated: '1 September 2026',
    sections: [
      {
        id: 'agreement',
        heading: 'The agreement',
        paragraphs: [
          'These terms are a contract between the business that opens an EZRA Pro account (the operator, you) and EZRA Pro Ltd (EZRA Pro, we). By opening an account or using the service you accept them. If you are opening an account for a company, you confirm you have the authority to bind it.',
          'Guests who book through your storefront are not party to these terms; their relationship is with you, under your own booking conditions, and with our payment processor for the payment itself.',
        ],
      },
      {
        id: 'service',
        heading: 'The service',
        paragraphs: [
          'EZRA Pro provides online booking, scheduling, a host app, guest records, channel syncing, payments, payouts and analytics, as described on our website and in the product. We may add, change or retire features, and we will give at least thirty days’ notice before retiring one that a plan depends on.',
          'You are responsible for the products you list, their descriptions and prices, your cancellation and refund policy, and for complying with the laws that apply to your business, including licensing, safety and consumer protection.',
        ],
      },
      {
        id: 'fees',
        heading: 'Fees and commission',
        paragraphs: [
          'Each plan charges a commission on bookings taken through EZRA Pro, and some plans charge a monthly platform fee, as set out on the pricing page at the time you subscribe. Commission is charged only on bookings actually taken, and is calculated on the amount the guest pays before taxes. You may pass the commission to the guest as a booking fee, per product, or absorb it.',
          'Payment processing charges set by our payment processor are passed through at cost and shown separately. Prices are in US dollars unless your account is set to another currency. We may change fees with thirty days’ notice; a change never applies to bookings already taken.',
        ],
      },
      {
        id: 'payouts',
        heading: 'Payments and payouts',
        paragraphs: [
          'Guest payments are collected by our payment processor into a balance held for you. We pay that balance, less commission, fees, refunds and chargebacks, to the bank account on your profile the next business day after the money settles. Each payout is itemised.',
          'You authorise us to deduct refunds you issue, chargebacks you lose, and any fees you owe from your balance or from future payouts. If a balance turns negative, you agree to settle it within fourteen days of our notice.',
        ],
      },
      {
        id: 'data',
        heading: 'Your data',
        paragraphs: [
          'You own your data: your products, your bookings, your guest records and your settings. You give us the licence needed to run the service on your behalf, and no more. You can export everything at any time in standard formats, and we will not hold your data hostage on the way out.',
          'We process guest data as your processor, under the Privacy policy, and you are responsible for having a lawful basis to collect it and for the notices you give your guests.',
        ],
      },
      {
        id: 'use',
        heading: 'Acceptable use',
        paragraphs: ['You agree not to use EZRA Pro to do any of the following.'],
        bullets: [
          'Sell anything unlawful, or anything that requires a licence you do not hold.',
          'Send messages to guests who have not booked with you or have opted out.',
          'Probe, scrape or overload the service, or try to reach another operator’s data.',
          'Misrepresent who you are, or list products you cannot deliver.',
        ],
      },
      {
        id: 'term',
        heading: 'Term and cancellation',
        paragraphs: [
          'There is no minimum term. You can cancel any month from the dashboard; the cancellation takes effect at the end of the current billing period, and bookings already taken continue to be honoured, paid out and supported. We can suspend or close an account for a serious breach of these terms, for non-payment after notice, or where the law requires, and we will tell you why unless we are prohibited from doing so.',
        ],
      },
      {
        id: 'liability',
        heading: 'Warranties and liability',
        paragraphs: [
          'We will provide the service with reasonable skill and care and aim for the availability published on our status page. Beyond that, the service is provided as is. To the extent the law allows, neither side is liable to the other for indirect or consequential loss, and our total liability to you in any twelve-month period is limited to the fees you paid us in that period. Nothing in these terms limits liability for fraud, for death or personal injury caused by negligence, or for anything else that cannot lawfully be limited.',
        ],
      },
      {
        id: 'changes',
        heading: 'Changes and contact',
        paragraphs: [
          'We may update these terms. For material changes we will email the account owner at least thirty days in advance; continuing to use the service after that date means you accept the new terms. These terms are governed by the laws of the State of Hawaii, and disputes will be heard in its courts. Questions go to legal@ezrapro.com.',
        ],
      },
    ],
  },

  security: {
    key: 'security',
    title: 'Security',
    summary: 'How EZRA Pro protects the bookings, payments and guest records operators trust it with, and how to reach us if you find something.',
    updated: '1 September 2026',
    sections: [
      {
        id: 'infrastructure',
        heading: 'Infrastructure',
        paragraphs: [
          'EZRA Pro runs on a major cloud provider in regions chosen for each operator’s market, in single-tenant databases per region with encryption at rest. Production is separated from staging and development, and no customer data is used outside production. Infrastructure is defined as code and every change is reviewed before it is applied.',
        ],
      },
      {
        id: 'encryption',
        heading: 'Encryption',
        paragraphs: [
          'All traffic between guests, operators and EZRA Pro is encrypted in transit with TLS 1.2 or higher. Data at rest, including backups, is encrypted with AES-256. Secrets and keys are held in a managed key store, rotated on a schedule, and never committed to source control.',
        ],
      },
      {
        id: 'payments',
        heading: 'Payments',
        paragraphs: [
          'Card details are entered directly into fields served by our payment processor, which is certified to PCI DSS Level 1, and never touch EZRA Pro’s servers. We store a token, the last four digits and the card type. Payouts go only to a bank account verified on the operator’s profile, and a change to that account requires re-authentication and is confirmed by email.',
        ],
      },
      {
        id: 'access',
        heading: 'Access control',
        paragraphs: [
          'Operators control who on their team sees what, with six role levels and permissions down to the field: a guide sees today’s manifest, a bookkeeper sees payouts, and nobody sees the bank account who should not. Every change to a booking, a product or a setting is written to an audit log the operator can read.',
          'Inside EZRA Pro, access to production is limited to a small number of engineers, requires hardware-key two-factor authentication, is granted for a task and expires, and is logged.',
        ],
      },
      {
        id: 'resilience',
        heading: 'Backups and resilience',
        paragraphs: [
          'Databases are backed up continuously with point-in-time recovery for thirty days, and restores are tested every quarter. The booking path is served from more than one availability zone so a single failure does not stop sales. The host app keeps working with no signal and syncs when the connection returns.',
        ],
      },
      {
        id: 'testing',
        heading: 'Testing and monitoring',
        paragraphs: [
          'Code is reviewed before it ships and scanned for vulnerable dependencies on every build. An independent firm performs a penetration test each year and we fix what it finds. Production is monitored around the clock, with an engineer on call.',
        ],
      },
      {
        id: 'incidents',
        heading: 'Incident response',
        paragraphs: [
          'If we confirm a security incident that affects an operator’s data, we notify the account owner without undue delay and within seventy-two hours, tell them what happened, what data was involved and what we are doing about it, and keep them updated until it is closed.',
        ],
      },
      {
        id: 'disclosure',
        heading: 'Responsible disclosure',
        paragraphs: [
          'If you believe you have found a vulnerability in EZRA Pro, please email security@ezrapro.com with enough detail for us to reproduce it. We acknowledge reports within two business days, keep you informed while we fix the issue, and do not pursue legal action against researchers who act in good faith, avoid privacy violations and give us reasonable time to respond.',
        ],
      },
    ],
  },
}

export const LEGAL_KEYS = Object.keys(LEGAL_DOCUMENTS) as LegalKey[]
