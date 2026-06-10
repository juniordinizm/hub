import Link from "next/link";
import { getCertificatesForUser } from "@/features/certificates/server";
import { formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MyCertificatesPage(): Promise<React.JSX.Element> {
  const session = await requireSession();
  const certificates = await getCertificatesForUser(session.user.id);

  return (
    <div className="min-h-screen px-5 py-6 sm:px-8 lg:px-10">
      <h1 className="font-bold text-3xl tracking-tight">Meus certificados</h1>
      <div className="mt-8 grid gap-4">
        {certificates.length === 0 ? (
          <div className="rounded-md border border-teal-200/10 bg-[#162b2d] p-8">
            <p className="text-sm text-teal-100/65">
              Seus certificados aparecem aqui quando voce conclui 100% de um
              curso.
            </p>
          </div>
        ) : (
          certificates.map((certificate) => (
            <article
              className="rounded-md border border-teal-200/10 bg-[#162b2d] p-6"
              key={certificate.code}
            >
              <p className="text-[#9aad7c] text-xs uppercase tracking-[0.16em]">
                Emitido em {formatDate(certificate.issuedAt)}
              </p>
              <h2 className="mt-2 font-bold text-xl">
                {certificate.courseTitle}
              </h2>
              <p className="mt-1 text-sm text-teal-100/50">
                {certificate.code}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  className="rounded-md bg-[#326c71] px-4 py-2 font-bold text-sm text-white"
                  href={route(`/certificados/${certificate.code}/pdf`)}
                >
                  Baixar PDF
                </Link>
                <Link
                  className="rounded-md border border-teal-200/15 px-4 py-2 text-sm text-teal-100/80"
                  href={route(`/certificados/${certificate.code}`)}
                >
                  Validar
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
