"use client";

import { Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createAuthClient } from "better-auth/react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { type JSX, type ReactNode, useState } from "react";
import { NotificationsButton } from "@/components/notifications-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getInitials } from "@/lib/get-initials";

interface PanelLayoutProps {
  readonly children: ReactNode;
  readonly navContent: ReactNode;
  readonly userEmail: string;
  readonly userImage?: string | null;
  readonly userName: string;
}

const authClient = createAuthClient();

function SidebarHeaderContent() {
  const { state, isMobile } = useSidebar();
  const searchParams = useSearchParams();
  const isFocusMode = searchParams.get("focus") === "1";

  if (state === "collapsed" && !isMobile) {
    return (
      <div className="flex w-full items-center justify-center py-2">
        {isFocusMode ? null : <SidebarTrigger />}
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-between gap-2 px-2 pt-2 pb-1">
      <div className="flex min-w-0 flex-1 items-center">
        <Image
          alt="PROTEA-R"
          className="h-auto max-h-14 w-full object-contain object-left"
          height={100}
          src="/protear/logo-negativo.png"
          width={400}
        />
      </div>
      {isFocusMode ? null : <SidebarTrigger className="shrink-0" />}
    </div>
  );
}

export function PanelLayout({
  children,
  navContent,
  userEmail,
  userName,
  userImage,
}: PanelLayoutProps): JSX.Element {
  const initials = getInitials(userName);
  const [isPending, setIsPending] = useState(false);
  const searchParams = useSearchParams();
  const isFocusMode = searchParams.get("focus") === "1";

  const handleSignOut = async () => {
    setIsPending(true);
    await authClient.signOut();
    window.location.assign("/entrar");
  };

  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      open={isFocusMode ? false : undefined}
    >
      <Sidebar className="border-sidebar-border bg-sidebar" collapsible="icon">
        <SidebarHeader className="flex flex-col gap-0 px-2 pt-2 pb-0">
          <SidebarHeaderContent />
        </SidebarHeader>
        <SidebarContent>{navContent}</SidebarContent>
        <SidebarFooter className="gap-2 px-2 pb-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    className="rounded-xl data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    size="lg"
                  >
                    <Avatar className="size-8 shrink-0 rounded-full">
                      {userImage ? (
                        <AvatarImage
                          alt={userName}
                          referrerPolicy="no-referrer"
                          src={userImage}
                        />
                      ) : null}
                      <AvatarFallback className="rounded-full bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{userName}</span>
                      <span className="truncate text-sidebar-foreground/55 text-xs">
                        {userEmail}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
                  side="top"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="size-8 shrink-0 rounded-full">
                        {userImage ? (
                          <AvatarImage
                            alt={userName}
                            referrerPolicy="no-referrer"
                            src={userImage}
                          />
                        ) : null}
                        <AvatarFallback className="rounded-full bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {userName}
                        </span>
                        <span className="truncate text-muted-foreground text-xs">
                          {userEmail}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    disabled={isPending}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleSignOut();
                    }}
                  >
                    <HugeiconsIcon
                      className="mr-2 size-4"
                      icon={Logout01Icon}
                    />
                    <span>{isPending ? "Saindo..." : "Sair"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-border/40 border-b bg-background px-4">
          <div className="flex flex-1 items-center justify-start">
            {isFocusMode ? null : (
              <SidebarTrigger className="shrink-0 md:hidden" />
            )}
          </div>
          <div className="flex flex-1 items-center justify-center md:hidden">
            <Image
              alt="PROTEA-R"
              className="h-auto max-h-10 w-full object-contain object-center"
              height={100}
              src="/protear/logo-negativo.png"
              width={400}
            />
          </div>
          <div className="flex flex-1 items-center justify-end">
            <NotificationsButton />
          </div>
        </header>
        <ScrollArea className="h-[calc(100svh-3.5rem)] w-full">
          <div className="flex-1">{children}</div>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
