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
      panelLabel="Painel administrativo"
      userEmail={session.user.email}
      userName={session.user.name}
    >
      {children}
    </PanelLayout>
  );
}
