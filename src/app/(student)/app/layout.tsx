import {
  BookOpen01Icon,
  Certificate01Icon,
  HelpCircleIcon,
  Home01Icon,
  ShieldKeyIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { redirect } from "next/navigation";
import { PanelLayout } from "@/components/panel-layout";
import { SupportSidebarItem } from "@/components/support-sidebar-item";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
} from "@/components/ui/sidebar";
import { isPreviewRole } from "@/features/courses/preview";
import { getStudentCourses } from "@/features/courses/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!(session.role === "student" || isPreviewRole(session.role))) {
    redirect(route("/admin"));
  }

  const courses =
    session.role === "student" ? await getStudentCourses(session.user.id) : [];

  return (
    <PanelLayout
      navContent={<StudentNav courses={courses} />}
      userEmail={session.user.email}
      userImage={(session.user as { image?: string | null }).image ?? null}
      userName={session.user.name}
      userRole={session.role}
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
      <SidebarGroup>
        <SidebarGroupLabel>Menu</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuLink href={route("/app")} tooltip="Início">
                <HugeiconsIcon icon={Home01Icon} size={18} strokeWidth={1.5} />
                <span>Início</span>
              </SidebarMenuLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuLink
                href={route("/app/privacidade")}
                tooltip="Privacidade"
              >
                <HugeiconsIcon
                  icon={ShieldKeyIcon}
                  size={18}
                  strokeWidth={1.5}
                />
                <span>Privacidade</span>
              </SidebarMenuLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuLink
                href={route("/app/certificados")}
                tooltip="Certificados"
              >
                <HugeiconsIcon
                  icon={Certificate01Icon}
                  size={18}
                  strokeWidth={1.5}
                />
                <span>Certificados</span>
              </SidebarMenuLink>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
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
                    tooltip={course.title}
                  >
                    <HugeiconsIcon
                      icon={BookOpen01Icon}
                      size={18}
                      strokeWidth={1.5}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{course.title}</span>
                      <span className="block text-sidebar-foreground text-xs">
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
            <SupportSidebarItem />
            <SidebarMenuItem>
              <SidebarMenuLink
                href={route("/app/perguntas-frequentes")}
                tooltip="Perguntas frequentes"
              >
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
