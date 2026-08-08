import { Suspense } from "react";
import LoginClient from "./login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-12" />}> 
      <LoginClient />
    </Suspense>
  );
}
