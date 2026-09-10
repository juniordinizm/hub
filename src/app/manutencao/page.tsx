import { BrandLogo } from "@/components/brand-logo";

export default function MaintenancePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="max-w-xl text-center">
        <BrandLogo
          className="mx-auto h-10 w-auto max-w-full object-contain"
          preload
        />
        <h1 className="type-page-title mt-3">Ambiente em manutenção</h1>
        <p className="mt-4 text-muted-foreground">
          Estamos preparando a plataforma. Tente novamente mais tarde.
        </p>
      </section>
    </main>
  );
}
