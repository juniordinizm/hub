import Link from "next/link";
import { Button } from "@/components/ui/button";
import { route } from "@/lib/routes";

export default function NotFound(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="font-semibold text-2xl">Página indisponível</h1>
      <p className="text-muted-foreground">
        Este conteúdo não existe, não está disponível ou seu acesso não permite
        abri-lo agora.
      </p>
      <Button asChild>
        <Link href={route("/app")}>Voltar aos meus cursos</Link>
      </Button>
    </main>
  );
}
