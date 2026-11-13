"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp, type AuthState } from "./actions";

type Mode = "sign-in" | "sign-up";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [signInState, signInAction, signingIn] = useActionState<AuthState, FormData>(signIn, {
    error: initialError,
  });
  const [signUpState, signUpAction, signingUp] = useActionState<AuthState, FormData>(signUp, {});

  const state = mode === "sign-in" ? signInState : signUpState;
  const pending = signingIn || signingUp;

  return (
    <form action={mode === "sign-in" ? signInAction : signUpAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "auth-error" : undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          minLength={8}
          maxLength={72}
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "auth-error" : undefined}
        />
        {mode === "sign-up" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
      </div>

      {state.error && (
        <p id="auth-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {state.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "sign-in" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        >
          {mode === "sign-in" ? "Create one" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
