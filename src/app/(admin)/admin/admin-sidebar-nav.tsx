"use client";

import {
  AccountSetting01Icon,
  Analytics01Icon,
  Book01Icon,
  HelpCircleIcon,
  HistoryIcon,
  Invoice01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { route } from "@/lib/routes";

const navItems = [
  ["Painel", "/admin", Analytics01Icon],
  ["Catálogo", "/admin/cursos", Book01Icon],
  ["Alunos", "/admin/alunos", UserGroupIcon],
  ["Financeiro", "/admin/financeiro", Invoice01Icon],
  ["FAQ", "/admin/faq", HelpCircleIcon],
  ["Configurações", "/admin/configuracoes", AccountSetting01Icon],
  ["Auditoria", "/admin/auditoria", HistoryIcon],
] as const;

export function AdminSidebarNav(): React.JSX.Element {
  return (
    <SidebarMenu>
      {navItems.map(([label, href, icon]) => (
        <SidebarMenuItem key={href}>
          <Link href={route(href)} legacyBehavior passHref>
            <SidebarMenuButton asChild>
              <a href={route(href)}>
                <HugeiconsIcon icon={icon} size={18} strokeWidth={1.5} />
                <span>{label}</span>
              </a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
