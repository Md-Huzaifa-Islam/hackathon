"use client";

import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-12">
        <div className="text-sm text-muted-foreground">Not signed in.</div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">Name: {user.name ?? "—"}</div>
          <div className="text-sm">Email: {user.email}</div>
          <div className="pt-4">
            <Button variant="ghost" onClick={() => logout()}>Logout</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
