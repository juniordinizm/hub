import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const NAME_PARTS_PATTERN = /\s+/;

const getInitials = (name: string): string => {
  const [first = "", second = ""] = name.trim().split(NAME_PARTS_PATTERN);
  return `${first.slice(0, 1)}${second.slice(0, 1) || first.slice(1, 2)}`
    .toUpperCase()
    .slice(0, 2);
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const session = await requireRole(["admin", "support"]);
  const initials = getInitials(session.user.name);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "230px" } as React.CSSProperties}
    >
      <Sidebar
        className="min-h-svh border-sidebar-border border-r bg-sidebar"
        collapsible="none"
      >
        <SidebarHeader className="px-5 pt-5 pb-0">
          <div className="border-sidebar-border border-b pb-4">
            <p className="font-black text-lg text-sidebar-foreground">
              PROTEA-R
            </p>
            <p className="text-sidebar-foreground/55 text-xs">
              Painel administrativo
            </p>
          </div>
          <div className="border-sidebar-border border-b py-4">
            <Avatar className="mb-3 size-11">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="truncate font-semibold text-sidebar-foreground text-sm">
              {session.user.name}
            </p>
            <p className="truncate text-sidebar-foreground/55 text-xs">
              {session.user.email}
            </p>
            <p className="mt-1 text-sidebar-foreground/45 text-xs uppercase">
              {session.role === "admin" ? "Administrador" : "Suporte"}
            </p>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3 py-3">
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
        <SidebarFooter className="border-sidebar-border border-t px-5 pt-4 pb-5">
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
