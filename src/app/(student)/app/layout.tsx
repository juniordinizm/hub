import Link from "next/link";
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
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const session = await requireSession();

  return (
    <SidebarProvider>
      <Sidebar className="border-border bg-sidebar" collapsible="offcanvas">
        <SidebarHeader>
          <div className="px-3 py-2">
            <p className="font-black text-xl">PROTEA-R</p>
            <p className="text-muted-foreground text-xs">Area da aluna</p>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navegacao</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href={route("/app")}>Inicio</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href={route("/app/certificados")}>Certificados</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {session.role === "student" ? null : (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href={route("/admin")}>Admin</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent p-3">
            <Avatar className="size-10">
              <AvatarFallback>
                {session.user.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold text-sm">
                {session.user.name}
              </p>
              <p className="truncate text-muted-foreground text-xs">
                {session.user.email}
              </p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <SidebarTrigger />
          <span className="ml-3 font-semibold text-sm">PROTEA-R</span>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
