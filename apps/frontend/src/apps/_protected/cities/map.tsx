import { createFileRoute } from '@tanstack/react-router'
import {CityMapPage} from "@/pages/cities/city-map.page.tsx";

export const Route = createFileRoute('/_protected/cities/map')({
  component: CityMapPage,
})
