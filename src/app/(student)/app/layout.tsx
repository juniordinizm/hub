import {
  BookOpen01Icon,
  Certificate01Icon,
  CustomerService01Icon,
  HelpCircleIcon,
  Home01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PanelLayout } from "@/components/panel-layout";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuLink,
} from "@/components/ui/sidebar";
import {
  getStudentCourses,
  getSupportWhatsappUrl,
} from "@/features/courses/server";
import { formatWhatsappUrl } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (session.role !== "student") {
    redirect(route("/admin"));
  }

  const courses = await getStudentCourses(session.user.id);

  return (
    <PanelLayout
      navContent={<StudentNav courses={courses} />}
      panelLabel="Área do aluno"
      userEmail={session.user.email}
      userName={session.user.name}
    >
      {children}
    </PanelLayout>
  );
}

function StudentNav({
  courses,
}: {
  courses: Awaited<ReturnType<typeof getStudentCourses>>;
}): React.JSX.Element {
  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuLink href={route("/app")}>
            <HugeiconsIcon icon={Home01Icon} size={18} strokeWidth={1.5} />
            <span>Início</span>
          </SidebarMenuLink>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuLink href={route("/app/certificados")}>
            <HugeiconsIcon
              icon={Certificate01Icon}
              size={18}
              strokeWidth={1.5}
            />
            <span>Certificados</span>
          </SidebarMenuLink>
        </SidebarMenuItem>
      </SidebarMenu>
      {courses.length ? (
        <SidebarGroup>
          <SidebarGroupLabel>Meus cursos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {courses.map((course) => (
                <SidebarMenuItem key={course.courseId}>
                  <SidebarMenuLink
                    className="h-auto py-2"
                    href={route(`/app/cursos/${course.courseId}`)}
                  >
                    <HugeiconsIcon
                      icon={BookOpen01Icon}
                      size={18}
                      strokeWidth={1.5}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{course.title}</span>
                      <span className="block text-sidebar-foreground/45 text-xs">
                        {course.progressPercent}% concluído
                      </span>
                    </span>
                  </SidebarMenuLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}
      <SidebarGroup>
        <SidebarGroupLabel>Suporte</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <Suspense fallback={<SupportNavSkeleton />}>
              <SupportNavItems />
            </Suspense>
            <SidebarMenuItem>
              <SidebarMenuLink href={route("/app/perguntas-frequentes")}>
                <HugeiconsIcon
                  icon={HelpCircleIcon}
                  size={18}
                  strokeWidth={1.5}
                />
                <span>Perguntas frequentes</span>
              </SidebarMenuLink>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

/**
 * Async Server Component that fetches the support WhatsApp URL independently.
 * Wrapped in <Suspense> so the layout never blocks navigation waiting for this data,
 * and the component re-renders on each navigation instead of being cached with the layout.
 */
async function SupportNavItems(): Promise<React.JSX.Element | null> {
  const rawWhatsappUrl = await getSupportWhatsappUrl();
  const supportWhatsappUrl = rawWhatsappUrl
    ? formatWhatsappUrl(rawWhatsappUrl)
    : null;

  if (!supportWhatsappUrl) {
    return null;
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <a href={supportWhatsappUrl} rel="noopener" target="_blank">
          <HugeiconsIcon
            icon={CustomerService01Icon}
            size={18}
            strokeWidth={1.5}
          />
          <span>Suporte ao aluno</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SupportNavSkeleton(): React.JSX.Element {
  return (
    <SidebarMenuItem>
      <div className="flex h-8 items-center gap-2 rounded-md px-2">
        <div className="size-[18px] animate-pulse rounded bg-sidebar-foreground/10" />
        <div className="h-3.5 w-24 animate-pulse rounded bg-sidebar-foreground/10" />
      </div>
    </SidebarMenuItem>
  );
}
