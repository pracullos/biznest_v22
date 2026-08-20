import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listRolesRolesGet,
  getRoleRolesRoleIdGet,
  assignPermissionRolesRoleIdPermissionsPost,
  removePermissionRolesRoleIdPermissionsPermissionIdDelete,
} from '@networking/api/generated/roles/roles'
import { listPermissionsPermissionsGet } from '@networking/api/generated/permissions/permissions'

export function useRolePermissions() {
  const queryClient = useQueryClient()
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['/roles/'],
    queryFn: () => listRolesRolesGet().then(r => r.data),
  })

  const { data: allPermissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['/permissions/'],
    queryFn: () => listPermissionsPermissionsGet().then(r => r.data),
  })

  const { data: selectedRole, isLoading: roleDetailLoading } = useQuery({
    queryKey: [`/roles/${selectedRoleId}`],
    queryFn: () => getRoleRolesRoleIdGet(selectedRoleId!).then(r => r.data),
    enabled: !!selectedRoleId,
  })

  const { mutateAsync: addPermission, isPending: adding } = useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      assignPermissionRolesRoleIdPermissionsPost(roleId, {
        role_id: roleId,
        permission_id: permissionId,
      }),
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: [`/roles/${roleId}`] })
    },
  })

  const { mutateAsync: removePermission, isPending: removing } = useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      removePermissionRolesRoleIdPermissionsPermissionIdDelete(roleId, permissionId),
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: [`/roles/${roleId}`] })
    },
  })

  return {
    roles,
    allPermissions,
    selectedRole,
    selectedRoleId,
    setSelectedRoleId,
    loading: rolesLoading || permissionsLoading,
    roleDetailLoading,
    addPermission,
    removePermission,
    adding,
    removing,
  }
}