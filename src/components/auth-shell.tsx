import Image from "next/image";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

export function AuthShell({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1fr_440px]">
      <section className="relative hidden overflow-hidden bg-muted lg:block">
        <Image
          alt=""
          className="object-cover"
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          src="/protear/login-capa.png"
        />
      </section>
      <section className="flex min-h-screen items-center px-6 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <BrandLogo
            className="h-10 w-auto max-w-full object-contain object-left"
            preload
          />
          {children}
        </div>
      </section>
    </main>
  );
}
