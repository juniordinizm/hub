import { notFound } from "next/navigation";
import { getCertificateByCode } from "@/features/certificates/server";
import { formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function CertificateValidationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<React.JSX.Element> {
  const { code } = await params;
  const certificate = await getCertificateByCode(code);

  if (!certificate) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-5 py-12 text-[#17292b]">
      <section className="mx-auto max-w-2xl rounded-md border border-[#d9cbc1] bg-white p-8">
        <p className="font-semibold text-[#326c71] text-xs uppercase tracking-[0.18em]">
          Certificado valido
        </p>
        <h1 className="mt-4 font-bold text-3xl">{certificate.courseTitle}</h1>
        <dl className="mt-8 grid gap-4 text-sm">
          <div>
            <dt className="text-[#667b7d]">Aluna</dt>
            <dd className="font-semibold">{certificate.studentName}</dd>
          </div>
          <div>
            <dt className="text-[#667b7d]">Carga horaria</dt>
            <dd className="font-semibold">{certificate.workloadHours} horas</dd>
          </div>
          <div>
            <dt className="text-[#667b7d]">Emissao</dt>
            <dd className="font-semibold">
              {formatDate(certificate.issuedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[#667b7d]">Codigo</dt>
            <dd className="font-mono font-semibold">{certificate.code}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
