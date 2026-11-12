/* ==========================================================================
   EZRA Pro's fee — 4% of each booking, and nothing else: no monthly fee, no
   setup fee, no contract. The business chooses who pays it (Settings →
   Payments, saved with the booking defaults):

     business  we take it from the booking; the guest pays the listed price
     guest     it is added at checkout as one "Booking fee (4%)" line

   Card processing is between the business and its payment provider, so it is
   never a line the guest sees. Browser- and server-safe: plain arithmetic,
   money in minor units. Activities add the line in `buildQuote`, restaurant
   orders in `cartTotals`; both read `guestBookingFee` so the maths lives here.
   ========================================================================== */

/** The one rate, in percent. */
export const EZRA_FEE_PERCENT = 4

export type FeePayer = 'business' | 'guest'

/** Unless the business says otherwise, it pays the fee and guests pay the price it set. */
export const DEFAULT_FEE_PAYER: FeePayer = 'business'

export const BOOKING_FEE_LABEL = `Booking fee (${EZRA_FEE_PERCENT}%)`

/** What EZRA Pro takes from a booking of this amount, whoever pays it. */
export function ezraFee(amount: number): number {
  return Math.max(0, Math.round((amount * EZRA_FEE_PERCENT) / 100))
}

/** What the guest pays on top of the price: the 4% when the business passes it on, nothing when the business pays it. */
export function guestBookingFee(amount: number, payer: FeePayer | undefined): number {
  return payer === 'guest' ? ezraFee(amount) : 0
}

/** A stored value read back safely. */
export function cleanFeePayer(value: unknown): FeePayer {
  return value === 'guest' ? 'guest' : DEFAULT_FEE_PAYER
}

/** The two choices, in plain words, for Settings and anywhere the choice is explained. */
export const FEE_PAYER_OPTIONS: { value: FeePayer; label: string; description: string }[] = [
  { value: 'business', label: 'We do', description: 'Guests pay the price you set. The 4% comes out of each booking.' },
  { value: 'guest', label: 'Guests', description: `Added at checkout as a "${BOOKING_FEE_LABEL}" line.` },
]
