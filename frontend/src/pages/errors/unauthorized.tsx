import { Link } from '@tanstack/react-router'
import { ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center px-4">
      <div className="rounded-full bg-destructive/10 p-5">
        <ShieldOff className="size-10 text-destructive" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Access Denied</h1>
        <p className="text-sm text-muted-foreground">
          You don't have permission to view this page. Contact your administrator if you think this is a mistake.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  )
}
