import { PageHeader } from '@/components/dashboard/page-header'
import { MarketingTabs } from '@/components/dashboard/marketing/marketing-tabs'

/* ==========================================================================
   /dashboard/marketing — every way the business brings guests in and back:
   automatic emails and texts, one-off campaigns, audiences, sign-up forms,
   referrals and the rules they all follow.
   ========================================================================== */

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 pb-16">
      <PageHeader
        className="mb-0"
        title="Marketing"
        description="Emails and texts that go on their own, campaigns you send, and the forms and rewards that grow your list. Everything here can be switched on or off."
        tabs={<MarketingTabs />}
      />
      {children}
    </div>
  )
}
