import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Budget Tracker" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm items-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle as="h1">Budget Tracker</CardTitle>
          <CardDescription>Sign in or create an account with your email.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
            next={safeRedirectPath(next)}
            initialError={error === "confirm" ? "That confirmation link is invalid or expired." : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
