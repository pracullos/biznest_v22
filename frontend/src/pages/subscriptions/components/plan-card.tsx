import { Check, MapPin, Infinity, Zap, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { SubscriptionPlanResponse } from '@networking/api/model'

interface PlanMeta {
  tagline: string
  description: string
  price: string
  priceNote: string
  features: string[]
  highlight: boolean
  badge?: string
}

const PLAN_META: Record<string, PlanMeta> = {
  free: {
    tagline: 'Start exploring',
    description: 'Access geo-intelligence tools for a single city. Perfect for individual investors getting started.',
    price: 'Free',
    priceNote: 'No credit card required',
    features: [
      '1 city access',
      'Interactive hazard map overlays',
      'Zoning layer viewer',
      'Flood, landslide & storm surge data',
      'Basic establishment data',
    ],
    highlight: false,
  },
  premium: {
    tagline: 'Scale your research',
    description: 'Monitor multiple cities simultaneously. Ideal for active investors managing a growing portfolio.',
    price: 'Contact us',
    priceNote: 'Billed annually',
    features: [
      'Up to 10 cities',
      'Everything in Free',
      'Saved locations & bookmarks',
      'Hazard risk alerts',
      'Faultline & debris flow layers',
      'Priority support',
    ],
    highlight: true,
    badge: 'Most Popular',
  },
  enterprise: {
    tagline: 'Full platform access',
    description: 'Unlimited city coverage for large-scale investment operations and institutional use.',
    price: 'Contact us',
    priceNote: 'Custom pricing available',
    features: [
      'Unlimited cities',
      'Everything in Premium',
      'API access',
      'Custom data integrations',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    highlight: false,
    badge: 'Enterprise',
  },
}

const DEFAULT_META: PlanMeta = {
  tagline: 'Custom plan',
  description: 'Contact us to learn more about this plan and what it includes.',
  price: 'Contact us',
  priceNote: '',
  features: [],
  highlight: false,
}

interface PlanCardProps {
  plan: SubscriptionPlanResponse
  isCurrent: boolean
}

export function PlanCard({ plan, isCurrent }: PlanCardProps) {
  const meta = PLAN_META[plan.name.toLowerCase()] ?? DEFAULT_META

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-shadow',
        meta.highlight
          ? 'ring-2 ring-primary shadow-lg shadow-primary/10'
          : 'hover:shadow-md',
        isCurrent && !meta.highlight && 'ring-2 ring-primary/50',
      )}
    >
      {(meta.badge || isCurrent) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {meta.badge && (
            <Badge
              className={cn(
                'gap-1 px-2.5 shadow-sm',
                meta.highlight ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
              )}
            >
              {meta.highlight ? <Zap className="size-3" /> : <Star className="size-3" />}
              {meta.badge}
            </Badge>
          )}
          {isCurrent && (
            <Badge variant="outline" className="bg-background gap-1 px-2.5 shadow-sm">
              <Check className="size-3 text-green-500" />
              Current
            </Badge>
          )}
        </div>
      )}

      <CardHeader className="pt-7 pb-4 space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{meta.tagline}</p>
          <h3 className="text-xl font-bold capitalize">{plan.name}</h3>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold">{meta.price}</span>
          </div>
          {meta.priceNote && (
            <p className="text-[11px] text-muted-foreground">{meta.priceNote}</p>
          )}
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{meta.description}</p>
      </CardHeader>

      <Separator />

      <CardContent className="flex flex-col flex-1 pt-5 pb-5 gap-5">
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
          {plan.max_cities === null ? (
            <Infinity className="size-4 shrink-0 text-primary" />
          ) : (
            <MapPin className="size-4 shrink-0 text-primary" />
          )}
          <span className="text-sm font-medium">
            {plan.max_cities === null
              ? 'Unlimited cities'
              : `Up to ${plan.max_cities} ${plan.max_cities === 1 ? 'city' : 'cities'}`}
          </span>
        </div>

        {meta.features.length > 0 && (
          <ul className="space-y-2.5 flex-1">
            {meta.features.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check className="size-4 shrink-0 text-green-500 mt-px" />
                <span className="text-muted-foreground leading-snug">{f}</span>
              </li>
            ))}
          </ul>
        )}

        <Button
          className={cn('w-full mt-auto', meta.highlight && !isCurrent && 'shadow-sm shadow-primary/20')}
          variant={isCurrent ? 'outline' : meta.highlight ? 'default' : 'outline'}
          disabled={isCurrent}
        >
          {isCurrent ? 'Current Plan' : plan.name === 'free' ? 'Select Free Plan' : 'Contact Sales'}
        </Button>
      </CardContent>
    </Card>
  )
}