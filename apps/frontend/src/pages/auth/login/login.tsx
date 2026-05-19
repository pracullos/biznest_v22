import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useLoginForm } from "./composables/use-login-form";
import { AuthImagePanel } from "./components/auth-image-panel";
import { LoginForm } from "./components/login-form";
import { getRandomQuote } from "@/config/quotes";

export function LoginPage() {
  const form = useLoginForm();

  const [quote] = useState(() => getRandomQuote());

  return (
    <>
      <div className="flex flex-col min-h-screen">
        <div className="grid flex-1 lg:grid-cols-[2fr_3fr] bg-background">
          <div className="flex flex-col items-start justify-start px-6 py-8 sm:px-12">
            <Link
              to={"/" as never}
              className="mb-8 flex items-center gap-3 text-base font-semibold text-slate-900 dark:text-white"
            >
              <img src="/images/logo.png" alt="BizNest" className="h-8 w-8" />
              BizNest
            </Link>
            <div className="flex flex-col items-center justify-center flex-1 w-full">
              <LoginForm
                email={form.email}
                setEmail={form.setEmail}
                password={form.password}
                setPassword={form.setPassword}
                error={form.error}
                loading={form.loading}
                onSubmit={form.handleSubmit}
              />{" "}
            </div>{" "}
          </div>

          <AuthImagePanel quote={quote} />
        </div>
      </div>
    </>
  );
}
