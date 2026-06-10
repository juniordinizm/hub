import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { route } from "@/lib/routes";
import { requireRole } from "@/lib/session";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  await requireRole(["admin", "support"]);

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
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
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href={route("/admin")}>Painel</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href={route("/app")}>Area da aluna</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/90 px-4 backdrop-blur">
          <SidebarTrigger />
          <span className="ml-3 font-semibold text-sm">PROTEA-R Admin</span>
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
