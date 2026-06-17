import {
  BookOpen01Icon,
  Certificate01Icon,
  CustomerService01Icon,
  HelpCircleIcon,
  Home01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { redirect } from "next/navigation";
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

  const [courses, rawWhatsappUrl] = await Promise.all([
    getStudentCourses(session.user.id),
    getSupportWhatsappUrl(),
  ]);
  const supportWhatsappUrl = rawWhatsappUrl
    ? formatWhatsappUrl(rawWhatsappUrl)
    : null;

  return (
    <PanelLayout
      navContent={
        <StudentNav courses={courses} supportWhatsappUrl={supportWhatsappUrl} />
      }
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
  supportWhatsappUrl,
}: {
  courses: Awaited<ReturnType<typeof getStudentCourses>>;
  supportWhatsappUrl: string | null;
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
            {supportWhatsappUrl ? (
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
            ) : null}
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
