import Link from "next/link";
import { route } from "@/lib/routes";
import { requireRole } from "@/lib/session";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  await requireRole(["admin", "support"]);

  return (
    <div className="min-h-screen bg-[#f7f3ef] text-[#17292b]">
      <header className="border-[#d9cbc1] border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link className="font-black text-lg" href={route("/admin")}>
            PROTEA-R Admin
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link href={route("/app")}>Area da aluna</Link>
            <Link href={route("/admin")}>Painel</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
