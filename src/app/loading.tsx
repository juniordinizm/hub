export default function RootLoading(): React.JSX.Element {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-3 px-6"
    >
      <h1 className="font-semibold text-2xl">Carregando página</h1>
      <p className="text-muted-foreground">
        Estamos preparando as informações solicitadas.
      </p>
    </main>
  );
}
