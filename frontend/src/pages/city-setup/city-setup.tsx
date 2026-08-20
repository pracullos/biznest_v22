import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  MapPin,
  Search,
  Zap,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { CityResponse } from "@networking/api/model/cityResponse";
import { useCitySetup } from "./composables/use-city-setup";
import { CreateCityDialog } from "./components/create-city-dialog";

const PAGE_SIZE = 6;

function CityCard({
  city,
  joined,
  actionLabel,
  actionDisabled,
  actionLoading,
  onAction,
}: {
  city: CityResponse;
  joined: boolean;
  actionLabel: string;
  actionDisabled?: boolean;
  actionLoading?: boolean;
  onAction: () => void;
}) {
  return (
    <div className="group flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 gap-3 hover:shadow-md hover:border-primary/40 hover:bg-accent/10 transition-all duration-300">
      <div className="flex items-center gap-4 min-w-0">
        <div className="rounded-full bg-primary/10 p-2.5 text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
          <MapPin className="size-4 shrink-0" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
            {city.name}
          </p>
          {(city.province || city.region) && (
            <p className="text-xs text-muted-foreground truncate">
              {[city.province, city.region].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {joined ? (
          <>
            <div className="hidden sm:flex items-center gap-1.5 mr-2 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium">
              <CheckCircle2 className="size-3.5" />
              Active
            </div>
            <Button
              size="sm"
              variant="default"
              className="shadow-sm rounded-full px-4"
              onClick={onAction}
            >
              Enter
              <ArrowRight className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-1" />
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant={actionDisabled ? "outline" : "secondary"}
            className="rounded-full px-4"
            disabled={actionDisabled || actionLoading}
            onClick={onAction}
          >
            {actionLoading ? (
              <Spinner className="size-3.5 mr-1.5" />
            ) : actionDisabled ? (
              <Lock className="size-3.5 mr-1.5" />
            ) : null}
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export function CitySetupPage() {
  const {
    role,
    user,
    myCities,
    availableCities,
    subscription,
    atLimit,
    maxCities,
    usedSlots,
    loading,
    subscribeCity,
    claimCity,
    createCity,
    enterCity,
  } = useCitySetup();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [myPage, setMyPage] = useState(1);

  const isInvestor = role === "investor";
  const isLgu = role === "lgu_admin";

  const actionLabel = isInvestor ? "Subscribe" : "Claim";
  const actionMutation = isInvestor ? subscribeCity : claimCity;

  const filteredCities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableCities;
    return availableCities.filter(
      (c: CityResponse) =>
        c.name.toLowerCase().includes(q) ||
        c.province?.toLowerCase().includes(q) ||
        c.region?.toLowerCase().includes(q),
    );
  }, [availableCities, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCities.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = filteredCities.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // Pagination for My Cities
  const myTotalPages = Math.max(1, Math.ceil(myCities.length / PAGE_SIZE));
  const safeMyPage = Math.min(myPage, myTotalPages);
  const myPageSlice = myCities.slice(
    (safeMyPage - 1) * PAGE_SIZE,
    safeMyPage * PAGE_SIZE,
  );

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  // Helper function to generate pagination items with ellipsis
  const getPaginationItems = (currentPage: number, totalPages: number) => {
    const items = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        items.push(i);
      }
    } else {
      // Always show first page
      items.push(1);

      // Calculate range around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      if (start > 2) {
        items.push("...");
      }

      for (let i = start; i <= end; i++) {
        items.push(i);
      }

      if (end < totalPages - 1) {
        items.push("...");
      }

      // Always show last page
      items.push(totalPages);
    }

    return items;
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-start px-4 py-6 bg-muted/20 min-h-screen">
      <div className="w-full max-w-6xl space-y-8">
        {/* Dynamic Hero Header */}
        <div className="text-center space-y-4 mb-10 mt-4">
          <div className="flex justify-center mb-2">
            <div className="rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 p-2 shadow-sm ring-1 ring-primary/10">
              <img
                src="/images/logo.png"
                alt="BizNest logo"
                className="size-8 object-contain"
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            Welcome, {user?.full_name ?? user?.email?.split("@")[0]}
          </h1>
          <p className="text-base text-muted-foreground max-w-lg mx-auto">
            {isInvestor
              ? "Expand your portfolio by subscribing to cities and accessing real-time geo-intelligence data."
              : isLgu
                ? "Manage your assigned cities or register a new one to the network."
                : "Choose a city to explore its data and get started."}
          </p>
        </div>

        {/* Enhanced Subscription limit bar (investor only) */}
        {isInvestor && subscription && maxCities !== null && (
          <Card className="overflow-hidden border-0 shadow-md ring-1 ring-border/50 relative bg-card">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
            <CardContent className=" relative z-10">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 shadow-inner">
                      <Zap className="size-5 text-primary fill-primary/20" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-foreground">
                        {subscription.plan.name} Plan
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Network allocation limits
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={atLimit ? "destructive" : "secondary"}
                    className="capitalize font-semibold text-sm px-3 py-1 rounded-full shadow-sm"
                  >
                    {usedSlots} / {maxCities} Slots
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary shadow-inner">
                    <div
                      className={`transition-all duration-700 ease-out ${
                        atLimit
                          ? "bg-destructive"
                          : "bg-gradient-to-r from-primary to-primary/70"
                      }`}
                      style={{ width: `${(usedSlots / maxCities) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-xs text-muted-foreground">
                      <strong className="text-foreground">{usedSlots}</strong>{" "}
                      {usedSlots === 1 ? "city" : "cities"} utilized
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <strong className="text-foreground">
                        {maxCities - usedSlots}
                      </strong>{" "}
                      {maxCities - usedSlots === 1 ? "slot" : "slots"} remaining
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
            <Spinner className="size-8 text-primary" />
            <p className="text-sm font-medium animate-pulse">
              Synchronizing city data…
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* My Cities - Left Column */}
            <Card className="flex flex-col h-full border-0 shadow-md ring-1 ring-border/50 rounded-2xl overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-green-400 to-emerald-500" />
              <CardHeader className="pb-4 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-green-500/10 p-2">
                      <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {isLgu ? "Assigned Cities" : "My Cities"}
                      </CardTitle>
                      <CardDescription className="text-sm font-medium">
                        {myCities.length}{" "}
                        {myCities.length === 1
                          ? "city active"
                          : "cities active"}
                      </CardDescription>
                    </div>
                  </div>
                  {isLgu && <CreateCityDialog mutation={createCity} />}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1 overflow-y-auto max-h-[500px] p-4 pt-0 bg-muted/10">
                {myCities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center h-full border-2 border-dashed border-border/60 rounded-xl bg-card/50">
                    <div className="rounded-full bg-muted p-4 mb-3">
                      <MapPin className="size-6 text-muted-foreground/60" />
                    </div>
                    <p className="text-base font-semibold text-foreground">
                      {isInvestor
                        ? "No active subscriptions"
                        : isLgu
                          ? "No cities assigned"
                          : "No cities yet"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
                      {isInvestor
                        ? "Subscribe to a city from the available list to get started."
                        : isLgu
                          ? "Create or claim a city to manage your dashboard."
                          : "Browse and select available cities."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 mt-4">
                    {myPageSlice.map((city: CityResponse) => (
                      <CityCard
                        key={city.id}
                        city={city}
                        joined={true}
                        actionLabel="Enter"
                        onAction={() => void enterCity(city.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {myTotalPages > 1 && (
                  <div className="pt-4 mt-4 border-t border-border/50">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (safeMyPage > 1) setMyPage((p) => p - 1);
                            }}
                            className={
                              safeMyPage <= 1
                                ? "pointer-events-none opacity-50"
                                : ""
                            }
                          />
                        </PaginationItem>

                        {getPaginationItems(safeMyPage, myTotalPages).map(
                          (page, idx) =>
                            typeof page === "number" ? (
                              <PaginationItem key={idx}>
                                <PaginationLink
                                  href="#"
                                  isActive={page === safeMyPage}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setMyPage(page as number);
                                  }}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            ) : (
                              <PaginationItem key={idx}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            ),
                        )}

                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (safeMyPage < myTotalPages)
                                setMyPage((p) => p + 1);
                            }}
                            className={
                              safeMyPage >= myTotalPages
                                ? "pointer-events-none opacity-50"
                                : ""
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Available Cities - Right Column */}
            {availableCities.length > 0 && (
              <Card className="flex flex-col h-full border-0 shadow-md ring-1 ring-border/50 rounded-2xl overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-400 to-indigo-500" />
                <CardHeader className="pb-4 bg-card space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-blue-500/10 p-2">
                      <Search className="size-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        Network Explorer
                      </CardTitle>
                      <CardDescription className="text-sm font-medium">
                        {isInvestor
                          ? atLimit
                            ? "Upgrade plan to access more"
                            : `Showing ${filteredCities.length} available targets`
                          : `Showing ${filteredCities.length} available targets`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
                    <Input
                      placeholder="Search by city, province, or region…"
                      value={search}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-9 h-10 text-sm rounded-lg bg-muted/40 border-border/50 focus-visible:ring-primary/20"
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0 bg-muted/10">
                  {pageSlice.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border/60 rounded-xl bg-card/50">
                      <div className="rounded-full bg-muted p-4 mb-3">
                        <Lock className="size-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-base font-semibold text-foreground">
                        No matches found
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try adjusting your search criteria.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-4">
                      {pageSlice.map((city: CityResponse) => (
                        <CityCard
                          key={city.id}
                          city={city}
                          joined={false}
                          actionLabel={actionLabel}
                          actionDisabled={isInvestor && atLimit}
                          actionLoading={
                            actionMutation.isPending &&
                            actionMutation.variables === city.id
                          }
                          onAction={() => actionMutation.mutate(city.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="pt-4 mt-4 border-t border-border/50">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (safePage > 1) setPage((p) => p - 1);
                              }}
                              className={
                                safePage <= 1
                                  ? "pointer-events-none opacity-50"
                                  : ""
                              }
                            />
                          </PaginationItem>

                          {getPaginationItems(safePage, totalPages).map(
                            (page, idx) =>
                              typeof page === "number" ? (
                                <PaginationItem key={idx}>
                                  <PaginationLink
                                    href="#"
                                    isActive={page === safePage}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setPage(page as number);
                                    }}
                                  >
                                    {page}
                                  </PaginationLink>
                                </PaginationItem>
                              ) : (
                                <PaginationItem key={idx}>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              ),
                          )}

                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (safePage < totalPages)
                                  setPage((p) => p + 1);
                              }}
                              className={
                                safePage >= totalPages
                                  ? "pointer-events-none opacity-50"
                                  : ""
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
