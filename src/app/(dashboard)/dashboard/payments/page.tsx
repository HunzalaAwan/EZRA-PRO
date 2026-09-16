import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { PayoutSummary, RevenueFeesChart } from '@/components/dashboard/payments/payout-summary'
import { PaymentsPageActions, PaymentsTable } from '@/components/dashboard/payments/payments-table'
import { CURRENT_TENANT } from '@/lib/demo'
import { bankLabel, buildBalance, buildDailyPoints, buildPayouts, buildSettled, toPaymentRow } from '@/lib/data/payouts'
import { formatDateLong } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Payments',
  description:
    'Every charge, refund and payout — with the processing fees behind them and the date the next batch lands.',
}

/** Transactions sent to the browser. The balance row is computed over all of them. */
const WORKING_SET = 400

/* ========================================================================== */

export default function PaymentsPage() {
  const tenant = CURRENT_TENANT
  const currency = tenant.currency

  const settled = buildSettled(tenant.id)
  const destination = bankLabel(tenant.id, currency)
  const payouts = buildPayouts(settled, destination)
  const points = buildDailyPoints(settled)
  const balance = buildBalance(settled, payouts, destination)

  const rows = settled.slice(0, WORKING_SET).map(toPaymentRow)

  return (
    <>
      <PageHeader
        title="Payments"
        description={`${settled.length.toLocaleString('en-US')} charges have settled against trips that ran. Your next payout lands ${formatDateLong(balance.nextPayoutAt)}.`}
        actions={<PaymentsPageActions />}
      />

      <div className="space-y-5">
        <PayoutSummary balance={balance} currency={currency} />

        <RevenueFeesChart points={points} currency={currency} />

        <PaymentsTable
          payments={rows}
          payouts={payouts}
          totalPayments={settled.length}
          currency={currency}
        />
      </div>
    </>
  )
}
