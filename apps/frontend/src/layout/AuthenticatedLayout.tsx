import {
  Link,
  Outlet,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { LogOut, MapPin, ChevronsUpDown, Check, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/context/auth.context";
import { useCityContext } from "@/context/city.context";
import { useRole, useCityIds, useIsRole } from "@/hooks/use-permission";
import { listCitiesCitiesGet } from "@networking/api/generated/cities/cities";
import type { CityResponse } from "@networking/api/model/cityResponse";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getNavSections, type NavSection } from "@/config/navigation";
import { MessageWidget } from "@/components/message-widget";

function NavItems({ sections }: { sections: NavSection[] }) {
  const { location } = useRouterState();

  return (
    <>
      {sections.map((section, i) => (
        <SidebarGroup key={i}>
          {section.title && (
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                const isActive =
                  location.pathname === item.to ||
                  location.pathname.startsWith(item.to + "/");
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link to={item.to as never}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function CitySwitcher() {
  const cityIds = useCityIds();
  const isInvestor = useIsRole('investor');
  const { selectedCity, selectCity } = useCityContext();
  const navigate = useNavigate();

  const { data: allCities = [] } = useQuery({
    queryKey: ["/cities/"],
    queryFn: () => listCitiesCitiesGet().then((r) => r.data),
    enabled: cityIds.length > 0,
  });

  const myCities: CityResponse[] = allCities.filter((c: CityResponse) =>
    cityIds.includes(c.id),
  );

  if (myCities.length === 0) return null;

  const label = selectedCity?.name ?? "Select city";

  return (
    <SidebarGroup className="pb-0">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  tooltip={
                    selectedCity
                      ? `${selectedCity.name} — switch city`
                      : "Select city"
                  }
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <MapPin className="text-primary shrink-0" />
                  <span className="truncate font-medium">{label}</span>
                  <ChevronsUpDown className="ml-auto size-3.5 shrink-0 opacity-50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  Your cities
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {myCities.map((city) => (
                  <DropdownMenuItem
                    key={city.id}
                    onClick={() => void selectCity(city)}
                    className="gap-2"
                  >
                    <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{city.name}</span>
                      {city.province && (
                        <span className="truncate text-xs text-muted-foreground">
                          {city.province}
                        </span>
                      )}
                    </div>
                    {selectedCity?.id === city.id && (
                      <Check className="ml-auto size-3.5 shrink-0 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                {isInvestor && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => void navigate({ to: "/city-setup" as never })}
                      className="gap-2 text-muted-foreground"
                    >
                      <Search className="size-3.5 shrink-0" />
                      <span className="text-sm">Browse cities</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// Bare outlet — no sidebar, no overflow constraint (scrollable content)
const FULLSCREEN_PATHS = ["/city-setup"];
// Bare outlet — no sidebar, overflow-hidden so the map canvas fills the viewport
const FULLSCREEN_MAP_CANVAS_PATHS = ["/hazard", "/zoning"];
const MAP_PATHS = ["/map"];
const FULLSCREEN_MAP_PATHS: string[] = [];

export function AuthenticatedLayout() {
  const { state, signOut } = useAuthContext();
  const { location } = useRouterState();
  const role = useRole();

  if (state.state !== "AUTHENTICATED") return null;

  if (FULLSCREEN_PATHS.some((p) => location.pathname.startsWith(p))) {
    return (
      <>
        <Outlet />
        <MessageWidget />
      </>
    );
  }

  if (
    FULLSCREEN_MAP_CANVAS_PATHS.some((p) => location.pathname.startsWith(p))
  ) {
    return (
      <>
        <div className="h-screen w-full overflow-hidden">
          <Outlet />
        </div>
        <MessageWidget />
      </>
    );
  }

  const isMapPath = MAP_PATHS.some((p) => location.pathname.startsWith(p));
  const isFullscreenMap = FULLSCREEN_MAP_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );
  const { user } = state;

  const sections = getNavSections(state.permissions ?? []);

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider className="h-screen overflow-hidden">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" tooltip="BizNest" asChild>
                  <Link to={"/dashboard" as never}>
                    <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <MapPin className="size-4" />
                    </div>
                    <span className="font-semibold">BizNest</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <CitySwitcher />
            <NavItems sections={sections} />
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  tooltip={user.full_name ?? user.email}
                  className="cursor-default"
                >
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                    {(user.full_name ?? user.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex min-w-0 flex-col text-left leading-tight">
                    <span className="truncate text-sm font-medium">
                      {user.full_name ?? user.email}
                    </span>
                    {role && (
                      <span className="truncate text-xs text-sidebar-foreground/60 capitalize">
                        {role.replace("_", " ")}
                      </span>
                    )}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Sign out"
                  onClick={() => void signOut()}
                  className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
                >
                  <LogOut />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>

          <SidebarRail />
        </Sidebar>

        <SidebarInset
          className={
            isMapPath || isFullscreenMap
              ? "overflow-hidden flex flex-col"
              : "overflow-y-auto"
          }
        >
          {!isFullscreenMap && (
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-1 h-4" />
            </header>
          )}
          {isMapPath || isFullscreenMap ? (
            <div className="flex-1 overflow-hidden relative">
              <Outlet />
            </div>
          ) : (
            <div className="p-6">
              <Outlet />
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>
      <MessageWidget />
    </TooltipProvider>
  );
}
