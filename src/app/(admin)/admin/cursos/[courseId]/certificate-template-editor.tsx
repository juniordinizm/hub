"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  disableCertificateForCourseAction,
  enableCertificateForCourseAction,
} from "@/features/admin/actions";
import type { CertificateTemplateSpec } from "@/features/certificates/template-rules";
import {
  type CertificateTemplateEditorTemplate,
  CertificateTemplateForm,
} from "./certificate-template-form";
import { getCertificateEditorStatus } from "./certificate-template-view-model";

const getVersionStatusLabel = (
  status: CertificateTemplateEditorTemplate["status"]
): string => {
  if (status === "published") {
    return "Ativa";
  }
  if (status === "draft") {
    return "Rascunho";
  }
  return "Substituida";
};

const CertificateActivationMenuItem = ({
  canEnable,
  certificateEnabled,
  courseId,
}: {
  canEnable: boolean;
  certificateEnabled: boolean;
  courseId: string;
}): React.JSX.Element => {
  if (certificateEnabled) {
    return (
      <AlertDialogTrigger asChild>
        <DropdownMenuItem variant="destructive">
          Desligar certificado
        </DropdownMenuItem>
      </AlertDialogTrigger>
    );
  }
  if (canEnable) {
    return (
      <form action={enableCertificateForCourseAction.bind(null, courseId)}>
        <DropdownMenuItem asChild>
          <button className="w-full" type="submit">
            Ligar certificado
          </button>
        </DropdownMenuItem>
      </form>
    );
  }
  return (
    <DropdownMenuItem disabled>
      Publique um template para ativar o certificado
    </DropdownMenuItem>
  );
};

export function CertificateTemplateEditor({
  certificateEnabled,
  courseId,
  issuerConfigured,
  templates,
}: {
  certificateEnabled: boolean;
  courseId: string;
  issuerConfigured: boolean;
  templates: Array<
    CertificateTemplateEditorTemplate & { spec: CertificateTemplateSpec }
  >;
}): React.JSX.Element {
  const draft = templates.find((template) => template.status === "draft");
  const active = templates.find((template) => template.status === "published");
  const editable = draft ?? active;
  const status = getCertificateEditorStatus({
    certificateEnabled,
    hasDraft: Boolean(draft),
    hasPublished: Boolean(active),
  });
  const canEnable = Boolean(active && issuerConfigured);

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="flex items-center gap-3">
            <CardTitle>Certificado</CardTitle>
            <Badge variant={status.tone}>{status.label}</Badge>
          </div>
          <CardDescription className="mt-1 max-w-2xl">
            Uma versao publicada por curso. Arte, dados e PDF ficam congelados
            na emissao.
          </CardDescription>
          {active ? null : (
            <p className="mt-2 text-muted-foreground text-xs">
              Publique um template para ativar o certificado neste curso.
            </p>
          )}
        </div>
        <CardAction>
          <Sheet>
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <HugeiconsIcon icon={MoreHorizontalIcon} />
                    <span className="sr-only">Mais acoes</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <SheetTrigger asChild>
                      <DropdownMenuItem>Historico de versoes</DropdownMenuItem>
                    </SheetTrigger>
                    <CertificateActivationMenuItem
                      canEnable={canEnable}
                      certificateEnabled={certificateEnabled}
                      courseId={courseId}
                    />
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Historico de versoes</SheetTitle>
                  <SheetDescription>
                    Versoes anteriores continuam como evidencia dos certificados
                    emitidos.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 flex flex-col gap-3">
                  {templates.length > 0 ? (
                    templates.map((template) => (
                      <div
                        className="flex min-h-10 items-center justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                        key={`${template.version}-${template.status}`}
                      >
                        <span>Versao {template.version}</span>
                        <Badge
                          variant={
                            template.status === "published"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {getVersionStatusLabel(template.status)}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <Empty className="p-8">
                      <EmptyHeader>
                        <EmptyTitle>Nenhuma versao</EmptyTitle>
                        <EmptyDescription>
                          Salve o primeiro rascunho para iniciar o historico.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>
              </SheetContent>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desligar certificado?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Novas emissoes serao interrompidas. Certificados existentes
                    permanecem validos e disponiveis.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <form
                    action={disableCertificateForCourseAction.bind(
                      null,
                      courseId
                    )}
                  >
                    <AlertDialogAction type="submit">
                      Sim, desligar certificado
                    </AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Sheet>
        </CardAction>
      </CardHeader>
      <CardContent>
        <CertificateTemplateForm
          courseId={courseId}
          issuerConfigured={issuerConfigured}
          template={editable}
        />
      </CardContent>
    </Card>
  );
}
