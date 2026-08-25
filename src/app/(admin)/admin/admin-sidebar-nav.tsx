"use client";

import {
  AccountSetting01Icon,
  Analytics01Icon,
  Book01Icon,
  HistoryIcon,
  Invoice01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
} from "@/components/ui/sidebar";
import { route } from "@/lib/routes";
import type { AppRole } from "@/lib/session";

const adminNavItems = [
  ["Painel", "/admin", Analytics01Icon],
  ["Aprendizagem", "/admin/aprendizagem", Analytics01Icon],
  ["Cursos", "/admin/cursos", Book01Icon],
  ["Alunos", "/admin/alunos", UserGroupIcon],
  ["Financeiro", "/admin/financeiro", Invoice01Icon],
  ["Auditoria", "/admin/auditoria", HistoryIcon],
  ["Configurações", "/admin/configuracoes", AccountSetting01Icon],
] as const;

const supportNavItems = [
  ["Painel", "/admin", Analytics01Icon],
  ["Cursos", "/admin/operacao/cursos", Book01Icon],
  ["Financeiro", "/admin/financeiro", Invoice01Icon],
] as const;

export function AdminSidebarNav({
  role,
}: {
  role: Extract<AppRole, "admin" | "support">;
}): React.JSX.Element {
  const navItems = role === "support" ? supportNavItems : adminNavItems;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map(([label, href, icon]) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuLink href={route(href)} tooltip={label}>
                <HugeiconsIcon icon={icon} size={18} strokeWidth={1.5} />
                <span>{label}</span>
              </SidebarMenuLink>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
