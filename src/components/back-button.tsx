"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className={buttonVariants({ variant: "ghost", size: "sm" }) + " gap-1 -ml-2"}
    >
      <ArrowLeft className="size-4" />
      Volver
    </button>
  );
}
