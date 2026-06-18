"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const ROUTE_LABELS: Record<string, string> = {
  app: "Painel do Aluno",
  admin: "Painel Admin",
  cursos: "Cursos",
  certificados: "Certificados",
  alunos: "Alunos",
  configuracoes: "Configurações",
  aulas: "Aulas",
  checkout: "Checkout",
  sucesso: "Sucesso",
};

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) {
    // Se estiver só na raiz do app ou admin, não mostra breadcrumb (ou poderia mostrar só um item)
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const href = `/${segments.slice(0, index + 1).join("/")}`;

          // Se for muito longo, assumimos que é um ID
          const isId = segment.length > 20;
          let label =
            ROUTE_LABELS[segment.toLowerCase()] ||
            segment.charAt(0).toUpperCase() +
              segment.slice(1).replace(/-/g, " ");

          if (isId) {
            label = "Detalhes";
          }

          return (
            <React.Fragment key={href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href as Route}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
