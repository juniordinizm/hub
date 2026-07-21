export default function StudentAreaLoading(): React.JSX.Element {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex min-h-64 w-full max-w-5xl flex-col justify-center gap-3 px-6 py-12"
    >
      <h1 className="font-semibold text-xl">Carregando área da aluna</h1>
      <p className="text-muted-foreground">
        Aguarde enquanto carregamos seus cursos e progresso.
      </p>
    </div>
  );
}
