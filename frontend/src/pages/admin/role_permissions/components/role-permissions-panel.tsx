import { useState } from 'react'
import { X, Plus, Lock } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import type { RoleWithPermissionsResponse, PermissionResponse } from '@networking/api/model'

interface Props {
  role: RoleWithPermissionsResponse
  allPermissions: PermissionResponse[]
  onAdd: (roleId: string, permissionId: string) => Promise<unknown>
  onRemove: (roleId: string, permissionId: string) => Promise<unknown>
  adding: boolean
  removing: boolean
  loading: boolean
}

export function RolePermissionsPanel({
  role,
  allPermissions,
  onAdd,
  onRemove,
  adding,
  removing,
  loading,
}: Props) {
  const [selectedPermId, setSelectedPermId] = useState('')

  const assigned = role.permissions ?? []
  const assignedIds = new Set(assigned.map(p => p.id))
  const available = allPermissions.filter(p => !assignedIds.has(p.id))

  async function handleAdd() {
    if (!selectedPermId) return
    await onAdd(role.id, selectedPermId)
    setSelectedPermId('')
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold capitalize">{role.name}</h2>
        <p className="text-sm text-muted-foreground">
          {assigned.length} permission{assigned.length !== 1 ? 's' : ''} assigned
        </p>
      </div>

      {/* Current permissions */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Permissions</p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-3" /> Loading…
          </div>
        ) : assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">No permissions assigned to this role.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assigned.map(perm => (
              <AlertDialog key={perm.id}>
                <AlertDialogTrigger asChild>
                  <Badge
                    variant="secondary"
                    className="gap-1.5 cursor-pointer pr-1.5 hover:bg-destructive/15 hover:text-destructive transition-colors"
                  >
                    <Lock className="size-3 shrink-0" />
                    <span>{perm.name}</span>
                    <X className="size-3 shrink-0" />
                  </Badge>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove permission?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Remove <strong>{perm.name}</strong> from the{' '}
                      <strong className="capitalize">{role.name}</strong> role. Users with this
                      role will lose this permission immediately.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onRemove(role.id, perm.id)}
                      disabled={removing}
                    >
                      {removing ? <Spinner className="size-3" /> : 'Remove'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ))}
          </div>
        )}
      </div>

      {/* Add permission */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Add Permission</p>

        {available.length === 0 && !loading ? (
          <p className="text-xs text-muted-foreground">All permissions are already assigned.</p>
        ) : (
          <div className="flex gap-2">
            <Select value={selectedPermId} onValueChange={setSelectedPermId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a permission…" />
              </SelectTrigger>
              <SelectContent>
                {available.map(perm => (
                  <SelectItem key={perm.id} value={perm.id}>
                    <div className="flex flex-col">
                      <span>{perm.name}</span>
                      {perm.description && (
                        <span className="text-xs text-muted-foreground">{perm.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!selectedPermId || adding} size="sm" className="gap-1.5">
              {adding ? <Spinner className="size-3" /> : <Plus className="size-3.5" />}
              Add
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}