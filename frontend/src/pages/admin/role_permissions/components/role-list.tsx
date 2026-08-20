import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RoleResponse } from '@networking/api/model'

interface Props {
  roles: RoleResponse[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function RoleList({ roles, selectedId, onSelect }: Props) {
  if (roles.length === 0) {
    return <p className="text-sm text-muted-foreground px-1">No roles found.</p>
  }

  return (
    <ul className="flex flex-col gap-1">
      {roles.map(role => (
        <li key={role.id}>
          <button
            type="button"
            onClick={() => onSelect(role.id)}
            className={cn(
              'w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
              selectedId === role.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-foreground',
            )}
          >
            <ShieldCheck
              className={cn(
                'size-4 shrink-0',
                selectedId === role.id ? 'text-primary-foreground' : 'text-muted-foreground',
              )}
            />
            <div className="min-w-0">
              <p className="truncate font-medium capitalize">{role.name}</p>
              <p
                className={cn(
                  'truncate text-xs',
                  selectedId === role.id ? 'text-primary-foreground/70' : 'text-muted-foreground',
                )}
              >
                Created {new Date(role.created_at).toLocaleDateString()}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}