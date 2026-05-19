import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/providers/auth.provider.tsx";
import { CityProvider } from "@/providers/city.provider";
import { MapProvider } from "@/providers/map.provider";
import { RouteContext } from "@/context/route.context.tsx";

export function AppProvider() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CityProvider>
            <MapProvider>
              <RouteContext />
            </MapProvider>
          </CityProvider>
        </AuthProvider>
      </QueryClientProvider>
      <Toaster position="top-center" />
    </ThemeProvider>
  );
}
