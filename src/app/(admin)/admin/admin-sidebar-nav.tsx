"use client";

import {
  AccountSetting01Icon,
  Analytics01Icon,
  Book01Icon,
  HelpCircleIcon,
  HistoryIcon,
  Image01Icon,
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

const navItems = [
  ["Painel", "/admin", Analytics01Icon],
  ["Cursos", "/admin/cursos", Book01Icon],
  ["Alunos", "/admin/alunos", UserGroupIcon],
  ["Financeiro", "/admin/financeiro", Invoice01Icon],
  ["FAQ", "/admin/faq", HelpCircleIcon],
  ["Auditoria", "/admin/auditoria", HistoryIcon],
  ["Configurações", "/admin/configuracoes", AccountSetting01Icon],
  ["Banners", "/admin/configuracoes/banners", Image01Icon],
] as const;

export function AdminSidebarNav(): React.JSX.Element {
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
