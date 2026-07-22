"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  disableCertificateForCourseAction,
  publishCertificateTemplateAction,
  saveCertificateTemplateDraftAction,
} from "@/features/admin/actions";
import type {
  CertificateTemplateField,
  CertificateTemplateSpec,
} from "@/features/certificates/template-rules";

const fieldLabels: Record<CertificateTemplateField["field"], string> = {
  completedAt: "Data de conclusao",
  courseFreeStatement: "Texto de curso livre",
  courseTitle: "Curso",
  issuedAt: "Data de emissao",
  issuerCnpj: "CNPJ",
  issuerName: "Empresa",
  qrCode: "QR de validacao",
  signatureImage: "Assinatura visual",
  signerName: "Responsavel",
  studentName: "Nome da aluna",
  validationCode: "Codigo",
  workloadHours: "Carga horaria",
};

const createDefaultFields = (): CertificateTemplateField[] => [
  {
    align: "center",
    color: "#17292b",
    field: "courseFreeStatement",
    fontSize: 9,
    height: 4,
    visible: false,
    width: 70,
    x: 15,
    y: 65,
  },
  {
    align: "center",
    color: "#17292b",
    field: "studentName",
    fontSize: 30,
    height: 8,
    visible: true,
    width: 70,
    x: 15,
    y: 35,
  },
  {
    align: "center",
    color: "#17292b",
    field: "courseTitle",
    fontSize: 18,
    height: 8,
    visible: true,
    width: 70,
    x: 15,
    y: 47,
  },
  {
    align: "center",
    color: "#17292b",
    field: "workloadHours",
    fontSize: 12,
    height: 5,
    visible: true,
    width: 70,
    x: 15,
    y: 58,
  },
  {
    align: "left",
    color: "#17292b",
    field: "completedAt",
    fontSize: 10,
    height: 4,
    visible: true,
    width: 25,
    x: 15,
    y: 78,
  },
  {
    align: "left",
    color: "#17292b",
    field: "issuedAt",
    fontSize: 10,
    height: 4,
    visible: true,
    width: 25,
    x: 15,
    y: 84,
  },
  {
    align: "left",
    color: "#17292b",
    field: "issuerName",
    fontSize: 10,
    height: 4,
    visible: true,
    width: 38,
    x: 15,
    y: 90,
  },
  {
    align: "left",
    color: "#17292b",
    field: "issuerCnpj",
    fontSize: 10,
    height: 4,
    visible: true,
    width: 38,
    x: 15,
    y: 95,
  },
  {
    align: "center",
    color: "#17292b",
    field: "signerName",
    fontSize: 10,
    height: 4,
    visible: false,
    width: 25,
    x: 55,
    y: 84,
  },
  {
    align: "center",
    color: "#17292b",
    field: "signatureImage",
    fontSize: 10,
    height: 9,
    visible: false,
    width: 25,
    x: 55,
    y: 72,
  },
  {
    align: "left",
    color: "#17292b",
    field: "validationCode",
    fontSize: 8,
    height: 4,
    visible: true,
    width: 30,
    x: 5,
    y: 5,
  },
  {
    align: "center",
    color: "#17292b",
    field: "qrCode",
    fontSize: 10,
    height: 14,
    visible: true,
    width: 10,
    x: 84,
    y: 80,
  },
];

interface Template {
  backgroundUrl: string;
  signatureKey: string | null;
  signerName: string | null;
  signerRole: string | null;
  spec: CertificateTemplateSpec;
  status: "draft" | "published" | "superseded";
  version: number;
}

const previewValues = {
  long: {
    completedAt: "22 de julho de 2026",
    courseFreeStatement: "Certificado de conclusão de curso livre.",
    courseTitle: "Especialização em Técnicas Avançadas de Harmonização Facial",
    issuedAt: "22 de julho de 2026",
    issuerCnpj: "12.345.678/0001-90",
    issuerName: "Instituto Protea Educação Profissional",
    qrCode: "QR",
    signatureImage: "Assinatura",
    signerName: "Dra. Maria Fernanda de Albuquerque",
    studentName: "Ana Carolina de Souza e Silva",
    validationCode: "PRT-12345678",
    workloadHours: "120 horas",
  },
  short: {
    completedAt: "22/07/2026",
    courseFreeStatement: "Curso livre.",
    courseTitle: "Botox",
    issuedAt: "22/07/2026",
    issuerCnpj: "12.345.678/0001-90",
    issuerName: "Protea",
    qrCode: "QR",
    signatureImage: "Assinatura",
    signerName: "Dra. Ana",
    studentName: "Ana",
    validationCode: "PRT-123",
    workloadHours: "8 horas",
  },
} as const;

const getTemplateStatusLabel = (status: Template["status"]): string => {
  if (status === "published") {
    return "ativa";
  }
  if (status === "draft") {
    return "rascunho";
  }
  return "substituida";
};

const getCertificateStateLabel = ({
  certificateEnabled,
  hasDraft,
}: {
  certificateEnabled: boolean;
  hasDraft: boolean;
}): string => {
  if (certificateEnabled) {
    return "ativo";
  }
  return hasDraft ? "rascunho" : "desligado";
};

export function CertificateTemplateEditor({
  certificateEnabled,
  courseId,
  templates,
}: {
  certificateEnabled: boolean;
  courseId: string;
  templates: Template[];
}): React.JSX.Element {
  const editable = templates.find((template) => template.status === "draft");
  const workingTemplate =
    editable ?? templates.find((template) => template.status === "published");
  const [backgroundSelected, setBackgroundSelected] = useState(false);
  const [fields, setFields] = useState<CertificateTemplateField[]>(
    workingTemplate?.spec.fields ?? createDefaultFields
  );
  const [signerName, setSignerName] = useState(
    workingTemplate?.signerName ?? ""
  );
  const [signerRole, setSignerRole] = useState(
    workingTemplate?.signerRole ?? ""
  );
  const [previewVariant, setPreviewVariant] = useState<"long" | "short">(
    "short"
  );
  const spec = useMemo<CertificateTemplateSpec>(
    () => ({
      backgroundKey: workingTemplate?.spec.backgroundKey ?? "",
      fields,
    }),
    [workingTemplate?.spec.backgroundKey, fields]
  );
  const updateField = (
    fieldName: CertificateTemplateField["field"],
    key: "visible" | "x" | "y",
    value: boolean | number
  ): void => {
    setFields((current) =>
      current.map((field) =>
        field.field === fieldName ? { ...field, [key]: value } : field
      )
    );
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="font-semibold text-xl">Certificado</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        A arte fica congelada na emissao. Ajuste os campos padronizados sobre a
        pagina A4 horizontal e salve um rascunho antes de publicar.
      </p>
      <p className="mt-2 font-medium text-sm">
        Estado:{" "}
        {getCertificateStateLabel({
          certificateEnabled,
          hasDraft: Boolean(editable),
        })}
      </p>
      <form
        action={saveCertificateTemplateDraftAction}
        className="mt-5 grid gap-6"
      >
        <input name="courseId" type="hidden" value={courseId} />
        <input name="spec" type="hidden" value={JSON.stringify(spec)} />
        <input
          name="signatureKey"
          type="hidden"
          value={workingTemplate?.signatureKey ?? ""}
        />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="relative aspect-[1.414/1] overflow-hidden rounded-md border bg-muted p-3">
            <Button
              className="absolute top-5 right-5 z-10"
              onClick={() =>
                setPreviewVariant((current) =>
                  current === "short" ? "long" : "short"
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Testar dados {previewVariant === "short" ? "longos" : "curtos"}
            </Button>
            <div
              className="relative h-full w-full rounded bg-background bg-center bg-cover shadow-sm"
              style={
                workingTemplate
                  ? { backgroundImage: `url(${workingTemplate.backgroundUrl})` }
                  : undefined
              }
            >
              {fields
                .filter((field) => field.visible)
                .map((field) => (
                  <div
                    className="absolute overflow-hidden border border-primary/50 bg-primary/10 px-1 text-[8px] text-primary"
                    key={field.field}
                    style={{
                      height: `${field.height}%`,
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: `${field.width}%`,
                    }}
                  >
                    {previewValues[previewVariant][field.field]}
                  </div>
                ))}
            </div>
          </div>
          <div className="grid content-start gap-3">
            <label className="grid gap-1 text-sm">
              Arte A4 horizontal (PNG, JPEG ou WebP, max. 10 MiB)
              <input
                accept="image/png,image/jpeg,image/webp"
                name="background"
                onChange={(event) =>
                  setBackgroundSelected(Boolean(event.currentTarget.files?.[0]))
                }
                required={!workingTemplate?.spec.backgroundKey}
                type="file"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Responsavel
              <input
                className="rounded border bg-background p-2"
                name="signerName"
                onChange={(event) => setSignerName(event.target.value)}
                value={signerName}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Cargo
              <input
                className="rounded border bg-background p-2"
                name="signerRole"
                onChange={(event) => setSignerRole(event.target.value)}
                value={signerRole}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Assinatura visual opcional
              <input
                accept="image/png,image/jpeg,image/webp"
                name="signature"
                type="file"
              />
            </label>
            {backgroundSelected ? (
              <p className="text-muted-foreground text-xs">
                Nova arte sera usada apenas neste rascunho e nas proximas
                emissoes.
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <fieldset className="rounded-md border p-3" key={field.field}>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>{fieldLabels[field.field]}</span>
                <input
                  checked={field.visible}
                  onChange={(event) =>
                    updateField(field.field, "visible", event.target.checked)
                  }
                  type="checkbox"
                />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <label className="grid gap-1">
                  Horizontal: {field.x}%
                  <input
                    max="100"
                    min="0"
                    onChange={(event) =>
                      updateField(field.field, "x", Number(event.target.value))
                    }
                    type="range"
                    value={field.x}
                  />
                </label>
                <label className="grid gap-1">
                  Vertical: {field.y}%
                  <input
                    max="100"
                    min="0"
                    onChange={(event) =>
                      updateField(field.field, "y", Number(event.target.value))
                    }
                    type="range"
                    value={field.y}
                  />
                </label>
              </div>
            </fieldset>
          ))}
        </div>
        <Button type="submit" variant="outline">
          Salvar rascunho
        </Button>
      </form>
      <form
        action={publishCertificateTemplateAction.bind(null, courseId)}
        className="mt-3"
      >
        <Button type="submit">Publicar certificado</Button>
      </form>
      {certificateEnabled ? (
        <form
          action={disableCertificateForCourseAction.bind(null, courseId)}
          className="mt-3"
        >
          <Button type="submit" variant="outline">
            Desligar certificado neste curso
          </Button>
        </form>
      ) : null}
      {templates.length ? (
        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium">Historico</h3>
          <ul className="mt-2 space-y-1 text-muted-foreground text-sm">
            {templates.map((template) => (
              <li key={`${template.version}-${template.status}`}>
                Versao {template.version}:{" "}
                {getTemplateStatusLabel(template.status)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
