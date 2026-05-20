import type { PropsWithChildren } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";
import { ModeToggle } from "@/components/ui/mode-toggle";

export function GuestLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-card backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link
            to={"/" as never}
            className="flex items-center gap-2 text-md font-semibold"
          >
            <img
              src="/images/logo.png"
              alt="BizNest logo"
              className="size-8 shrink-0"
            />
            BizNest
          </Link>

          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to={"/blog" as never}>Blog</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to={"/about" as never}>About</Link>
            </Button>
            <div className="mx-2 h-4 w-px bg-border" />
            <ModeToggle />
            <div className="mx-2 h-4 w-px bg-border" />
            <Button variant="ghost" size="sm" asChild>
              <Link to={"/login" as never}>Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to={"/register" as never}>Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <Footer />
    </div>
  );
}
