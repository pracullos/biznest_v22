import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { $api } from '@/lib/api-client'

export function useRolePermissions() {
  const queryClient = useQueryClient()
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)

  const { data: roles = [], isLoading: rolesLoading } = $api.useQuery('get', '/roles/')

  const { data: allPermissions = [], isLoading: permissionsLoading } = $api.useQuery('get', '/permissions/')

  const { data: selectedRole, isLoading: roleDetailLoading } = $api.useQuery('get', '/roles/{role_id}', {
    params: { path: { role_id: selectedRoleId ?? '' } },
  }, {
    enabled: !!selectedRoleId,
  })

  const addMutation = $api.useMutation('post', '/roles/{role_id}/permissions', {
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: $api.queryOptions('get', '/roles/{role_id}', {
          params: { path: { role_id: vars.params.path.role_id } },
        }).queryKey,
      })
    },
  })

  const removeMutation = $api.useMutation('delete', '/roles/{role_id}/permissions/{permission_id}', {
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: $api.queryOptions('get', '/roles/{role_id}', {
          params: { path: { role_id: vars.params.path.role_id } },
        }).queryKey,
      })
    },
  })

  async function addPermission({ roleId, permissionId }: { roleId: string; permissionId: string }) {
    return addMutation.mutateAsync({
      params: { path: { role_id: roleId } },
      body: { role_id: roleId, permission_id: permissionId },
    })
  }

  async function removePermission({ roleId, permissionId }: { roleId: string; permissionId: string }) {
    return removeMutation.mutateAsync({
      params: { path: { role_id: roleId, permission_id: permissionId } },
    })
  }

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
    adding: addMutation.isPending,
    removing: removeMutation.isPending,
  }
}
