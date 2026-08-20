import { createFileRoute } from '@tanstack/react-router'
import {UserManagementPage} from "@/pages/admin/user/user.management.tsx";

export const Route = createFileRoute('/_protected/admin/user-management')({
  component: UserManagementPage,
})
