import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { route } from "@/lib/routes";
import { requireRole } from "@/lib/session";

const navItems = [
  ["Painel", "/admin"],
  ["Catalogo", "/admin/cursos"],
  ["Alunas", "/admin/alunas"],
  ["Financeiro", "/admin/financeiro"],
  ["FAQ", "/admin/faq"],
  ["Configuracoes", "/admin/configuracoes"],
] as const;

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  await requireRole(["admin", "support"]);

  return (
    <SidebarProvider>
      <Sidebar collapsible="none">
        <SidebarHeader>
          <div className="px-3 py-2">
            <p className="font-black text-lg">PROTEA-R Admin</p>
            <p className="text-muted-foreground text-xs">Operacao do curso</p>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navegacao</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(([label, href]) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild>
                      <Link href={route(href)}>{label}</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-3 pb-4">
          <SignOutButton className="w-full" variant="secondary" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/90 px-4 backdrop-blur">
          <span className="font-semibold text-sm">PROTEA-R Admin</span>
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
