"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const { requestOtp } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      await requestOtp(phone, "signup", name);
      router.push(`/login/verify?phone=${encodeURIComponent(phone)}&purpose=signup&name=${encodeURIComponent(name)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSignup} className="space-y-4">
            <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" disabled={loading || !phone || !name}>{loading ? "Sending..." : "Sign up"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
