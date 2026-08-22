import type { Metadata } from "next";
import { PageContainer } from "@/components/page-container";

export const metadata: Metadata = {
  title: "Aviso de privacidade",
};

export default function PrivacyNoticePage(): React.JSX.Element {
  return (
    <PageContainer className="max-w-3xl">
      <article className="space-y-6">
        <header className="space-y-2">
          <h1 className="font-bold text-3xl tracking-tight">
            Aviso de privacidade
          </h1>
          <p className="text-muted-foreground">
            Como o Hub trata dados necessários para oferecer cursos e melhorar
            suas aulas.
          </p>
        </header>
        <section className="space-y-2">
          <h2 className="font-semibold text-xl">Dados de aprendizagem</h2>
          <p>
            O Hub mantém acesso, progresso, conclusão e posição de vídeo para
            entregar o curso contratado, permitir retomar uma aula e emitir
            certificado quando aplicável.
          </p>
          <p>
            Também registra análises opcionais de início, faixa de progresso,
            conclusão e falhas técnicas para identificar problemas nas aulas.
            Não registramos comentários, texto assistido, replay de sessão,
            endereço IP ou user agent nesse recurso.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold text-xl">Controle e retenção</h2>
          <p>
            Você pode desativar as análises opcionais em Configurações. Essa
            escolha não reduz seu acesso, progresso ou certificado. Ao
            desativar, os registros brutos identificáveis já vinculados à sua
            conta são removidos; métricas diárias sem identificação pessoal
            podem permanecer para acompanhamento de qualidade.
          </p>
          <p>
            Registros brutos ficam por até 90 dias e métricas agregadas por até
            13 meses. Mensagens enviadas pelo formulário de suporte ficam
            registradas por até 90 dias para atendimento. Para exercer direitos
            sobre seus dados, use o canal de suporte informado pela PROTEA-R.
          </p>
        </section>
      </article>
    </PageContainer>
  );
}
