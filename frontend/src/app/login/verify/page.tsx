import { Suspense } from "react";
import VerifyClient from "./verify-client";

export default function VerifyPage({ searchParams }: any) {
  const phone = (searchParams?.phone ?? "").toString();
  const purpose = (searchParams?.purpose ?? "login").toString();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="w-full" />}>
        <VerifyClient phone={phone} purpose={purpose} />
      </Suspense>
    </main>
  );
}
