import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAllUsersUsersGet } from '@networking/api/generated/users/users'
import { listRolesRolesGet } from '@networking/api/generated/roles/roles'
import {
  assignRoleUserRolesPost,
  removeRoleUserRolesDelete,
  getUserRolesUserRolesUserIdGet,
} from '@networking/api/generated/user-roles/user-roles'

export function useUserManagement() {
  const queryClient = useQueryClient()

  const { data: usersData, isLoading: usersLoading } = useAllUsersUsersGet()
  const users = usersData?.data ?? []

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['/roles/'],
    queryFn: () => listRolesRolesGet().then(r => r.data),
  })

  const { mutateAsync: assignRole, isPending: assigning } = useMutation({
    mutationFn: (data: { user_id: string; role_id: string }) =>
      assignRoleUserRolesPost(data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [`/user-roles/${vars.user_id}`] })
    },
  })

  const { mutateAsync: revokeRole, isPending: revoking } = useMutation({
    mutationFn: (data: { user_id: string; role_id: string }) =>
      removeRoleUserRolesDelete(data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [`/user-roles/${vars.user_id}`] })
    },
  })

  return {
    users,
    roles,
    loading: usersLoading || rolesLoading,
    assignRole,
    revokeRole,
    assigning,
    revoking,
  }
}

export function useUserRoles(userId: string | null) {
  return useQuery({
    queryKey: [`/user-roles/${userId}`],
    queryFn: () => getUserRolesUserRolesUserIdGet(userId!).then(r => r.data),
    enabled: !!userId,
  })
}