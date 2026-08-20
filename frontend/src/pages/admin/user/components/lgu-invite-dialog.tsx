import { useState } from 'react'
import { Copy, Check, Link2, Mail } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLguInvite } from '../composables/use-lgu-invite'

interface LguInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

export function LguInviteDialog({ open, onOpenChange }: LguInviteDialogProps) {
  const {
    email, setEmail,
    regionId, setRegionId,
    provinceId, setProvinceId,
    cityId, setCityId,
    regions, regionsLoading,
    provinces, provincesLoading,
    cities, citiesLoading,
    sending, error, success, result,
    handleSubmit, reset,
  } = useLguInvite()

  function handleOpenChange(val: boolean) {
    if (!val) reset()
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send LGU Invitation</DialogTitle>
          <DialogDescription>
            Send a magic-link registration invite to an LGU administrator.
          </DialogDescription>
        </DialogHeader>

        {success && result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900 dark:bg-green-950/30">
              <Check className="size-4 shrink-0 text-green-600" />
              <p className="text-sm text-green-700 dark:text-green-400">{result.message}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Magic link</p>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
                <p className="flex-1 truncate font-mono text-xs text-foreground">{result.magic_link}</p>
                <CopyButton text={result.magic_link} />
              </div>
              <p className="text-xs text-muted-foreground">
                Expires: {new Date(result.expires_at).toLocaleString()}
              </p>
            </div>

            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="lgu@city.gov.ph"
                  required
                  className="pl-8"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Region</Label>
              <Select
                value={regionId ?? ''}
                onValueChange={val => setRegionId(val || null)}
                disabled={regionsLoading}
              >
                <SelectTrigger className="w-full">
                  {regionsLoading
                    ? <span className="flex items-center gap-2 text-muted-foreground"><Spinner className="size-3.5" /> Loading…</span>
                    : <SelectValue placeholder="Select region" />
                  }
                </SelectTrigger>
                <SelectContent>
                  {regions.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Province</Label>
              <Select
                value={provinceId ?? ''}
                onValueChange={val => setProvinceId(val || null)}
                disabled={!regionId || provincesLoading}
              >
                <SelectTrigger className="w-full">
                  {provincesLoading
                    ? <span className="flex items-center gap-2 text-muted-foreground"><Spinner className="size-3.5" /> Loading…</span>
                    : <SelectValue placeholder="Select province" />
                  }
                </SelectTrigger>
                <SelectContent>
                  {provinces.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>City</Label>
              <Select
                value={cityId ?? ''}
                onValueChange={val => setCityId(val || null)}
                disabled={!provinceId || citiesLoading}
              >
                <SelectTrigger className="w-full">
                  {citiesLoading
                    ? <span className="flex items-center gap-2 text-muted-foreground"><Spinner className="size-3.5" /> Loading…</span>
                    : <SelectValue placeholder="Select city" />
                  }
                </SelectTrigger>
                <SelectContent>
                  {cities.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={sending || !email || !cityId}
            >
              {sending && <Spinner className="mr-2 size-4" />}
              Send invitation
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}