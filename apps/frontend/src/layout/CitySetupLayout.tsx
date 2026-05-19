import { Link, Outlet } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/context/auth.context";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CitySetupLayout() {
  const { state, signOut } = useAuthContext();

  const user = state.state === "AUTHENTICATED" ? state.user : null;
  const userInitials = user
    ? (user.full_name ?? user.email).slice(0, 2).toUpperCase()
    : "??";

  const handleSignOut = () => {
    toast.success("Signed out successfully!", { position: "top-center" });
    setTimeout(() => {
      void signOut();
    }, 800);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <img
              src="/images/logo.png"
              alt="BizNest logo"
              className="size-8 shrink-0"
            />
            <span>BizNest</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={"/dashboard" as never}>Dashboard</Link>
            </Button>
            <div className="mx-1 h-4 w-px bg-border" />
            <ModeToggle />
            <div className="mx-1 h-4 w-px bg-border" />
            <div className="flex items-center gap-2 pl-1">
              <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {userInitials}
              </div>
              <span className="hidden sm:block text-sm max-w-[180px] truncate">
                {user?.full_name ?? user?.email}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    <LogOut className="h-8 w-8" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Sign out</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </TooltipProvider>
  );
}
