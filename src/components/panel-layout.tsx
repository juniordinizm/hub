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
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getInitials } from "@/lib/get-initials";

interface PanelLayoutProps {
  readonly children: React.ReactNode;
  readonly navContent: React.ReactNode;
  readonly panelLabel: string;
  readonly userEmail: string;
  readonly userName: string;
}

export function PanelLayout({
  children,
  navContent,
  panelLabel,
  userEmail,
  userName,
}: PanelLayoutProps): React.JSX.Element {
  const initials = getInitials(userName);

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar
        className="border-sidebar-border bg-sidebar"
        collapsible="offcanvas"
      >
        <SidebarHeader className="px-5 pt-5 pb-0">
          <div className="border-sidebar-border border-b pb-4">
            <p className="font-black text-lg text-sidebar-foreground">
              PROTEA-R
            </p>
            <p className="text-sidebar-foreground/55 text-xs">{panelLabel}</p>
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
                  title={userName}
                >
                  {userName}
                </p>
                <p
                  className="truncate text-sidebar-foreground/55 text-xs"
                  title={userEmail}
                >
                  {userEmail}
                </p>
              </div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>{navContent}</SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="gap-3 px-5 pb-5">
          <SignOutButton className="w-full" variant="secondary" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="overflow-hidden">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center border-border/40 border-b bg-background px-4 md:hidden">
          <SidebarTrigger />
          <span className="ml-3 font-semibold text-sm">PROTEA-R</span>
        </header>
        <ScrollArea className="h-[calc(100svh-3.5rem)] w-full md:h-svh">
          <div className="flex-1">{children}</div>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
