import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent } from '@/components/ui/card'
import { RoleList } from './components/role-list'
import { RolePermissionsPanel } from './components/role-permissions-panel'
import { useRolePermissions } from './composables/use-role-permissions'

export function RolePermissionsPage() {
  const {
    roles,
    allPermissions,
    selectedRole,
    selectedRoleId,
    setSelectedRoleId,
    loading,
    roleDetailLoading,
    addPermission,
    removePermission,
    adding,
    removing,
  } = useRolePermissions()

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading roles…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Role Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage roles and their associated permissions
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Roles sidebar */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <p className="text-sm font-medium">Roles</p>
              <RoleList
                roles={roles}
                selectedId={selectedRoleId}
                onSelect={setSelectedRoleId}
              />
            </div>
          </CardContent>
        </Card>

        {/* Permissions panel */}
        <Card>
          <CardContent className="p-6">
            {selectedRoleId && selectedRole ? (
              <RolePermissionsPanel
                role={selectedRole}
                allPermissions={allPermissions}
                onAdd={(roleId, permissionId) =>
                  addPermission({ roleId, permissionId })
                }
                onRemove={(roleId, permissionId) =>
                  removePermission({ roleId, permissionId })
                }
                adding={adding}
                removing={removing}
                loading={roleDetailLoading}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                Select a role to manage its permissions
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}