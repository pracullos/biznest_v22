import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useRegisterForm } from "./composables/use-register-form";
import { RegisterForm } from "./components/register-form";
import { AuthImagePanel } from "./components/auth-image-panel";
import { getRandomQuote } from "@/config/quotes";

export function RegisterPage() {
  const form = useRegisterForm();

  const [quote] = useState(() => getRandomQuote());

  return (
    <>
      <div className="flex flex-col min-h-screen">
        <div className="grid flex-1 lg:grid-cols-[2fr_3fr]">
          <div className="flex flex-col items-start justify-start px-6 py-8 sm:px-12">
            <Link
              to={"/" as never}
              className="mb-8 flex items-center gap-3 text-base font-semibold text-slate-900 dark:text-white"
            >
              <img src="/images/logo.png" alt="BizNest" className="h-8 w-8" />
              BizNest
            </Link>
            <div className="flex flex-col items-center justify-center flex-1 w-full">
              <RegisterForm
                email={form.email}
                setEmail={form.setEmail}
                fullName={form.fullName}
                setFullName={form.setFullName}
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
