import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Link } from "@tanstack/react-router";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/pages/auth/components/password-input";

interface RegisterFormProps {
  email: string;
  setEmail: Dispatch<SetStateAction<string>>;
  fullName: string;
  setFullName: Dispatch<SetStateAction<string>>;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  error: string | null;
  loading: boolean;
  onSubmit: (e: FormEvent) => Promise<void>;
}

export function RegisterForm({
  email,
  setEmail,
  fullName,
  setFullName,
  password,
  setPassword,
  error,
  loading,
  onSubmit,
}: RegisterFormProps) {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fill in your details to get started.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-base">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="juandelacruz@gmail.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 text-base"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="full-name" className="text-base">
            Full name
          </Label>
          <Input
            id="full-name"
            type="text"
            placeholder="Juan dela Cruz"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 text-base"
          />
        </div>

        <PasswordInput
          id="password"
          label="Password"
          placeholder="••••••••"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          labelClassName="text-base"
          inputClassName="h-11 text-base"
        />

        <Button
          type="submit"
          className="mt-4 w-full h-11 text-base"
          disabled={loading}
        >
          {loading && <Spinner className="mr-2 size-4" />}
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
        >
          Sign in
        </Link>
      </p>

      <p className="mt-6 text-center text-xs text-muted-foreground leading-relaxed">
        By continuing, you agree to Biznest&apos;s{" "}
        <a href="#" className="underline hover:no-underline">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline hover:no-underline">
          Privacy Policy
        </a>
        , and to receive periodic emails with updates.
      </p>
    </div>
  );
}
