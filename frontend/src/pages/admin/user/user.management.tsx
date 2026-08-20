import { useState } from 'react'
import { MailPlus, MoreHorizontal } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserTable } from './components/user-table'
import { UserRoleDialog } from './components/user-role-dialog'
import { LguInviteDialog } from './components/lgu-invite-dialog'
import { useUserManagement } from './composables/use-user-management'
import type { UserResponse } from '@networking/api/model'

export function UserManagementPage() {
  const { users, roles, loading, assignRole, revokeRole, assigning, revoking } =
    useUserManagement()
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading users…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View all users and manage their roles
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="size-4" />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setInviteOpen(true)}>
              <MailPlus className="size-4" />
              Send LGU magic link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardContent className="p-0">
          <UserTable users={users} onManageRole={setSelectedUser} />
        </CardContent>
      </Card>

      <UserRoleDialog
        open={!!selectedUser}
        onOpenChange={open => { if (!open) setSelectedUser(null) }}
        user={selectedUser}
        roles={roles}
        onAssign={(userId, roleId) => assignRole({ user_id: userId, role_id: roleId })}
        onRevoke={(userId, roleId) => revokeRole({ user_id: userId, role_id: roleId })}
        assigning={assigning}
        revoking={revoking}
      />

      <LguInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}