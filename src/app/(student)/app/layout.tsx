import Link from "next/link";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const session = await requireSession();

  return (
    <div className="min-h-screen bg-[#0f2224] text-teal-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-teal-200/10 border-r bg-[#0d1e20] p-5 lg:flex lg:flex-col">
        <div>
          <p className="font-black text-xl">PROTEA-R</p>
          <p className="mt-1 text-teal-100/50 text-xs">Area da aluna</p>
        </div>
        <div className="mt-8 rounded-md border border-teal-200/10 bg-[#162b2d] p-4">
          <div className="flex size-11 items-center justify-center rounded-md bg-[#326c71] font-bold">
            {session.user.name.slice(0, 1).toUpperCase()}
          </div>
          <p className="mt-3 font-semibold text-sm">{session.user.name}</p>
          <p className="text-teal-100/50 text-xs">{session.user.email}</p>
        </div>
        <nav className="mt-8 grid gap-2 text-sm">
          <Link
            className="rounded-md px-3 py-2 text-teal-100/80 hover:bg-teal-100/10"
            href={route("/app")}
          >
            Inicio
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-teal-100/80 hover:bg-teal-100/10"
            href={route("/app/certificados")}
          >
            Certificados
          </Link>
          {session.role === "student" ? null : (
            <Link
              className="rounded-md px-3 py-2 text-teal-100/80 hover:bg-teal-100/10"
              href={route("/admin")}
            >
              Admin
            </Link>
          )}
        </nav>
      </aside>
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
