import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { Spinner } from '@/components/ui/spinner'
import { ShieldCheck, Trash2 } from 'lucide-react'
import type { UserResponse, RoleResponse } from '@networking/api/model'
import { useUserRoles } from '../composables/use-user-management'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserResponse | null
  roles: RoleResponse[]
  onAssign: (userId: string, roleId: string) => Promise<unknown>
  onRevoke: (userId: string, roleId: string) => Promise<unknown>
  assigning: boolean
  revoking: boolean
}

export function UserRoleDialog({
  open,
  onOpenChange,
  user,
  roles,
  onAssign,
  onRevoke,
  assigning,
  revoking,
}: Props) {
  const [selectedRoleId, setSelectedRoleId] = useState('')

  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles(
    open ? (user?.id ?? null) : null
  )

  const assignedRoleIds = new Set(userRoles.map(r => r.role_id))
  const availableRoles = roles.filter(r => !assignedRoleIds.has(r.id))

  async function handleAssign() {
    if (!user || !selectedRoleId) return
    await onAssign(user.id, selectedRoleId)
    setSelectedRoleId('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Role</DialogTitle>
          <DialogDescription>
            {user?.username} &middot; {user?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Current Roles</p>

            {rolesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-3" /> Loading…
              </div>
            ) : userRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles assigned.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {userRoles.map(ur => (
                  <div
                    key={ur.role_id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium capitalize">{ur.role.name}</span>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke role?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove <strong>{ur.role.name}</strong> from{' '}
                            <strong>{user?.username}</strong>. The user will lose all associated
                            permissions immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => onRevoke(user!.id, ur.role_id)}
                            disabled={revoking}
                          >
                            {revoking ? <Spinner className="size-3" /> : 'Revoke'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Assign Role</p>

            {availableRoles.length === 0 && !rolesLoading ? (
              <p className="text-xs text-muted-foreground">All available roles already assigned.</p>
            ) : (
              <div className="flex gap-2">
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        <span className="capitalize">{role.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAssign} disabled={!selectedRoleId || assigning} size="sm">
                  {assigning ? <Spinner className="size-3" /> : 'Assign'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}