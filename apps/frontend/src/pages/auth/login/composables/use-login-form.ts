import { useState } from "react";
import type { FormEvent } from "react";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { useAuthContext } from "@/context/auth.context";

function getErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<{ detail?: string }>;
  return (
    axiosErr?.response?.data?.detail ??
    "Something went wrong. Please try again."
  );
}

export function useLoginForm() {
  const auth = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.signIn(email, password);
      toast.success("Logged in successfully!", { position: "top-center" });
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      toast.error(errorMsg, { position: "top-center" });
    } finally {
      setLoading(false);
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    handleSubmit,
  };
}
