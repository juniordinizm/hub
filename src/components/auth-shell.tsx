import Image from "next/image";
import type { ReactNode } from "react";

export function AuthShell({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1fr_440px]">
      <section className="relative hidden overflow-hidden bg-muted lg:block">
        <Image
          alt="Capa do curso PROTEA-R"
          className="object-cover"
          fill
          priority
          src="/protear/login-capa.png"
        />
      </section>
      <section className="flex min-h-screen items-center px-6 py-10 sm:px-10">
        {children}
      </section>
    </main>
  );
}
