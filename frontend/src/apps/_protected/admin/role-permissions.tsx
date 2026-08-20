import {createFileRoute} from '@tanstack/react-router'
import {RolePermissionsPage} from "@/pages/admin/role_permissions/role.permissions.tsx";

export const Route = createFileRoute('/_protected/admin/role-permissions')({
    component: RolePermissionsPage,
})