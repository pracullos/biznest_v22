import { useQueryClient } from '@tanstack/react-query'
import { $api } from '@/lib/api-client'

export function useUserManagement() {
  const queryClient = useQueryClient()

  const { data: users = [], isLoading: usersLoading } = $api.useQuery('get', '/users/')

  const { data: roles = [], isLoading: rolesLoading } = $api.useQuery('get', '/roles/')

  const assignMutation = $api.useMutation('post', '/user-roles/', {
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: $api.queryOptions('get', '/user-roles/{user_id}', {
          params: { path: { user_id: vars.body.user_id } },
        }).queryKey,
      })
    },
  })

  const revokeMutation = $api.useMutation('delete', '/user-roles/', {
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: $api.queryOptions('get', '/user-roles/{user_id}', {
          params: { path: { user_id: vars.body.user_id } },
        }).queryKey,
      })
    },
  })

  async function assignRole(data: { user_id: string; role_id: string }) {
    return assignMutation.mutateAsync({ body: data })
  }

  async function revokeRole(data: { user_id: string; role_id: string }) {
    return revokeMutation.mutateAsync({ body: data })
  }

  return {
    users,
    roles,
    loading: usersLoading || rolesLoading,
    assignRole,
    revokeRole,
    assigning: assignMutation.isPending,
    revoking: revokeMutation.isPending,
  }
}

export function useUserRoles(userId: string | null) {
  return $api.useQuery('get', '/user-roles/{user_id}', {
    params: { path: { user_id: userId ?? '' } },
  }, {
    enabled: !!userId,
  })
}
