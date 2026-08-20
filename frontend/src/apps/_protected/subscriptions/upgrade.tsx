import { createFileRoute } from '@tanstack/react-router'
import {UpgradePage} from "@/pages/subscriptions/upgrade.tsx";

export const Route = createFileRoute('/_protected/subscriptions/upgrade')({
  component: UpgradePage,
})


