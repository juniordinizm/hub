"use client";

import { ArrowLeftIcon, Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createAuthClient } from "better-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  type JSX,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { route } from "@/lib/routes";
import type { AppRole } from "@/lib/session";

interface PanelLayoutProps {
  readonly children: ReactNode;
  readonly navContent: ReactNode;
  readonly userEmail: string;
  readonly userImage?: string | null;
  readonly userName: string;
  readonly userRole?: AppRole;
}

const authClient = createAuthClient();

function SidebarHeaderContent() {
  const { state, isMobile } = useSidebar();

  if (state === "collapsed" && !isMobile) {
    return (
      <div className="flex w-full items-center justify-center">
        <SidebarTrigger />
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-between gap-2 px-2">
      <div className="flex min-w-0 flex-1 items-center">
        <Image
          alt="PROTEA-R"
          className="h-auto max-h-10 w-[90%] object-contain object-left"
          height={100}
          src="/protear/logo-negativo.svg"
          width={400}
        />
      </div>
      <SidebarTrigger className="shrink-0" />
    </div>
  );
}

interface PreviewContextType {
  courseId: string | null;
  setCourseId: (id: string | null) => void;
}

const PreviewContext = createContext<PreviewContextType | undefined>(undefined);

interface PanelFocusModeContextType {
  isFocusMode: boolean;
  setFocusMode: (isFocusMode: boolean) => void;
}

const PanelFocusModeContext = createContext<
  PanelFocusModeContextType | undefined
>(undefined);

export function PreviewProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [courseId, setCourseId] = useState<string | null>(null);
  return (
    <PreviewContext.Provider value={{ courseId, setCourseId }}>
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreview() {
  return useContext(PreviewContext);
}

export function usePanelFocusMode(): PanelFocusModeContextType {
  const context = useContext(PanelFocusModeContext);

  if (!context) {
    throw new Error("usePanelFocusMode must be used within PanelLayout.");
  }

  return context;
}

export function RegisterPreviewCourseId({
  courseId,
}: {
  readonly courseId: string;
}): JSX.Element | null {
  const preview = usePreview();

  useEffect(() => {
    if (!preview) {
      return;
    }

    preview.setCourseId(courseId);
    return () => {
      preview.setCourseId(null);
    };
  }, [courseId, preview]);

  return null;
}

export function PanelLayout(props: PanelLayoutProps): JSX.Element {
  return (
    <PreviewProvider>
      <PanelLayoutInner {...props} />
    </PreviewProvider>
  );
}

function PanelLayoutInner({
  children,
  navContent,
  userEmail,
  userName,
  userImage,
  userRole,
}: PanelLayoutProps): JSX.Element {
  const initials = getInitials(userName);
  const [isPending, setIsPending] = useState(false);
  const [isFocusMode, setFocusMode] = useState(false);
  const [isMainSidebarOpen, setMainSidebarOpen] = useState(true);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const focusModeContext = useMemo(
    () => ({ isFocusMode, setFocusMode }),
    [isFocusMode]
  );

  const previewContext = usePreview();
  const courseId = previewContext?.courseId ?? null;
  const previewParam = searchParams.get("preview");
  const isPreviewActive =
    (userRole === "admin" || userRole === "support") &&
    (previewParam === "student" || previewParam === "aluno");

  const showBackButton = ![
    "/app",
    "/app/certificados",
    "/app/perguntas-frequentes",
    "/admin",
    "/admin/cursos",
    "/admin/alunos",
    "/admin/financeiro",
    "/admin/faq",
    "/admin/configuracoes",
    "/admin/auditoria",
  ].includes(pathname);

  const handleSignOut = async () => {
    setIsPending(true);
    await authClient.signOut();
    window.location.assign("/entrar");
  };
  const handleMainSidebarOpenChange = useCallback((open: boolean) => {
    setMainSidebarOpen(open);

    if (open) {
      setFocusMode(false);
    }
  }, []);

  return (
    <PanelFocusModeContext.Provider value={focusModeContext}>
      <SidebarProvider
        className="h-svh overflow-hidden"
        onOpenChange={handleMainSidebarOpenChange}
        open={isFocusMode ? false : isMainSidebarOpen}
      >
        <Sidebar
          className="border-sidebar-border bg-sidebar"
          collapsible="icon"
        >
          <SidebarHeader className="mb-6 flex h-16 flex-col justify-center gap-0 px-2">
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
                        <span className="truncate font-semibold">
                          {userName}
                        </span>
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
            <div className="flex flex-1 items-center justify-start gap-2">
              <SidebarTrigger
                className="shrink-0 md:hidden"
                onClick={() => setFocusMode(false)}
              />
              {showBackButton && (
                <Button
                  className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => router.back()}
                  size="sm"
                  variant="ghost"
                >
                  <HugeiconsIcon
                    className="size-4"
                    icon={ArrowLeftIcon}
                    strokeWidth={2.5}
                  />
                  <span>Voltar</span>
                </Button>
              )}
            </div>

            {isPreviewActive && (
              <div className="hidden items-center gap-3 text-sm md:flex">
                <div className="flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-600 dark:text-amber-400">
                  <span className="font-semibold text-xs">
                    Preview de aluno
                  </span>
                  <span className="hidden text-muted-foreground text-xs lg:inline">
                    · Progresso, duração detectada e certificado não serão
                    gravados
                  </span>
                </div>
                {courseId && (
                  <Button
                    asChild
                    className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                    size="sm"
                    variant="outline"
                  >
                    <Link href={route(`/admin/cursos/${courseId}`)}>
                      Voltar ao Admin
                    </Link>
                  </Button>
                )}
              </div>
            )}

            <div className="flex flex-1 items-center justify-end gap-3">
              {isPreviewActive && courseId && (
                <Button
                  asChild
                  className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 md:hidden dark:text-amber-400"
                  size="sm"
                  variant="outline"
                >
                  <Link href={route(`/admin/cursos/${courseId}`)}>
                    Voltar ao Admin
                  </Link>
                </Button>
              )}
              <div className="flex flex-1 items-center justify-center md:hidden">
                <Image
                  alt="PROTEA-R"
                  className="h-auto max-h-10 w-full object-contain object-center"
                  height={100}
                  src="/protear/logo-negativo.svg"
                  width={400}
                />
              </div>
            </div>
          </header>
          <ScrollArea className="h-[calc(100svh-4rem)] w-full">
            <div className="flex-1">{children}</div>
          </ScrollArea>
        </SidebarInset>
      </SidebarProvider>
    </PanelFocusModeContext.Provider>
  );
}
