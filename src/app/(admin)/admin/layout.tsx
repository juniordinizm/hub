import { AdminSidebarNav } from "@/app/(admin)/admin/admin-sidebar-nav";
import { PanelLayout } from "@/components/panel-layout";
import { requireRole } from "@/lib/session";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const session = await requireRole(["admin", "support"]);

  return (
    <PanelLayout
      navContent={<AdminSidebarNav />}
      userEmail={session.user.email}
      userImage={(session.user as { image?: string | null }).image ?? null}
      userName={session.user.name}
      userRole={session.role}
    >
      {children}
    </PanelLayout>
  );
}
