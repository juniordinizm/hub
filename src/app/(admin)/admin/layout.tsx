import {
  AccountSetting01Icon,
  Analytics01Icon,
  Book01Icon,
  HelpCircleIcon,
  HistoryIcon,
  Invoice01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ["Painel", "/admin", Analytics01Icon],
  ["Catalogo", "/admin/cursos", Book01Icon],
  ["Alunas", "/admin/alunas", UserGroupIcon],
  ["Financeiro", "/admin/financeiro", Invoice01Icon],
  ["FAQ", "/admin/faq", HelpCircleIcon],
  ["Configuracoes", "/admin/configuracoes", AccountSetting01Icon],
  ["Auditoria", "/admin/auditoria", HistoryIcon],
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
      className="h-svh overflow-hidden"
      style={{ "--sidebar-width": "230px" } as React.CSSProperties}
    >
      <Sidebar
        className="border-sidebar-border border-r bg-sidebar"
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
            <div className="flex items-center gap-3">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-semibold text-sidebar-foreground text-sm"
                  title={session.user.name}
                >
                  {session.user.name}
                </p>
                <p
                  className="truncate text-sidebar-foreground/55 text-xs"
                  title={session.user.email}
                >
                  {session.user.email}
                </p>
              </div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <ScrollArea className="h-full w-full">
            <SidebarGroup>
              <SidebarGroupLabel>Navegacao</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map(([label, href, icon]) => (
                    <SidebarMenuItem key={href}>
                      <Link href={route(href)} legacyBehavior passHref>
                        <SidebarMenuButton asChild>
                          <a href={route(href)}>
                            <HugeiconsIcon
                              icon={icon}
                              size={18}
                              strokeWidth={1.5}
                            />
                            <span>{label}</span>
                          </a>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter className="border-sidebar-border border-t px-5 pt-4 pb-5">
          <SignOutButton className="w-full" variant="secondary" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="overflow-hidden">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center border-border/40 border-b bg-background px-4">
          <span className="font-semibold text-sm">PROTEA-R Admin</span>
        </header>
        <ScrollArea className="h-[calc(100svh-3.5rem)] w-full md:h-svh">
          <main className="mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
