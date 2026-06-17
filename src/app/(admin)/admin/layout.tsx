import { AdminSidebarNav } from "@/app/(admin)/admin/admin-sidebar-nav";
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
  SidebarProvider,
} from "@/components/ui/sidebar";
import { requireRole } from "@/lib/session";

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
                <AdminSidebarNav />
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
          <div className="w-full px-6 py-8 sm:px-10 lg:px-12">{children}</div>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
