import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface CourseEmailProps {
  actionUrl?: string;
  courseTitle?: string;
  name: string;
  resetUrl?: string;
}

interface CertificateEmailProps extends CourseEmailProps {
  certificateCode: string;
}

interface AccessExpiryWarningEmailProps extends CourseEmailProps {
  daysRemaining: number;
}

interface SupportRequestEmailProps {
  courseTitle?: string;
  message: string;
  studentEmail: string;
  studentName: string;
  subject: string;
}

const styles = {
  body: {
    backgroundColor: "#f7f3ef",
    color: "#17292b",
    fontFamily: "Arial, sans-serif",
  },
  button: {
    backgroundColor: "#326c71",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontWeight: 700,
    padding: "12px 18px",
    textDecoration: "none",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #eadfd8",
    borderRadius: "8px",
    margin: "32px auto",
    padding: "32px",
    width: "560px",
  },
  muted: {
    color: "#667b7d",
    fontSize: "14px",
    lineHeight: "22px",
  },
  panel: {
    backgroundColor: "#f7f3ef",
    border: "1px solid #eadfd8",
    borderRadius: "6px",
    padding: "16px",
  },
  text: {
    fontSize: "16px",
    lineHeight: "26px",
  },
} as const;

const EmailShell = ({
  children,
  preview,
}: Readonly<{
  children: React.ReactNode;
  preview: string;
}>): React.JSX.Element => (
  <Html lang="pt-BR">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>{children}</Container>
    </Body>
  </Html>
);

export const PasswordResetEmail = ({
  actionUrl,
  name,
}: CourseEmailProps): React.JSX.Element => (
  <EmailShell preview="Crie ou redefina sua senha do PROTEA-R Hub.">
    <Heading>Criar ou redefinir senha</Heading>
    <Text style={styles.text}>Ola, {name}.</Text>
    <Text style={styles.text}>
      Use este link para criar ou redefinir sua senha. Ele expira em breve por
      seguranca.
    </Text>
    <Text style={styles.text}>
      Se voce acabou de comprar um curso, este e o link de primeiro acesso.
      Depois de criar a senha, entre na plataforma para acessar suas aulas.
    </Text>
    {actionUrl ? (
      <Section>
        <Button href={actionUrl} style={styles.button}>
          Criar nova senha
        </Button>
      </Section>
    ) : null}
  </EmailShell>
);

export const CertificateIssuedEmail = ({
  actionUrl,
  certificateCode,
  courseTitle,
  name,
}: CertificateEmailProps): React.JSX.Element => (
  <EmailShell preview="Seu certificado PROTEA-R Hub foi emitido.">
    <Heading>Certificado emitido</Heading>
    <Text style={styles.text}>Parabens, {name}.</Text>
    <Text style={styles.text}>
      Seu certificado de conclusao do curso {courseTitle ?? "PROTEA-R"} foi
      emitido com o codigo {certificateCode}.
    </Text>
    {actionUrl ? (
      <Section>
        <Button href={actionUrl} style={styles.button}>
          Ver certificado
        </Button>
      </Section>
    ) : null}
  </EmailShell>
);

export const AccessReleasedEmail = ({
  actionUrl,
  courseTitle,
  name,
  resetUrl,
}: CourseEmailProps): React.JSX.Element => (
  <EmailShell preview="Sua matricula esta ativa no PROTEA-R Hub.">
    <Heading>Acesso liberado</Heading>
    <Text style={styles.text}>Ola, {name}.</Text>
    <Text style={styles.text}>
      Confirmamos sua matricula em {courseTitle ?? "PROTEA-R Hub"}. Ja e
      possivel acessar as aulas disponiveis.
    </Text>
    {actionUrl ? (
      <Section>
        <Button href={actionUrl} style={styles.button}>
          Acessar curso
        </Button>
      </Section>
    ) : null}
    {resetUrl ? (
      <Text style={styles.muted}>
        Se nao lembrar sua senha, recupere o acesso por aqui: {resetUrl}
      </Text>
    ) : null}
  </EmailShell>
);

export const CourseSalesOpenedEmail = ({
  actionUrl,
  courseTitle,
  name,
}: CourseEmailProps): React.JSX.Element => (
  <EmailShell preview="As inscrições do Curso que você acompanha estão abertas.">
    <Heading>Inscrições abertas</Heading>
    <Text style={styles.text}>Olá, {name}.</Text>
    <Text style={styles.text}>
      As inscrições para {courseTitle ?? "o Curso"} estão abertas. Você pediu
      para receber este aviso quando fosse possível comprar.
    </Text>
    {actionUrl ? (
      <Section>
        <Button href={actionUrl} style={styles.button}>
          Conhecer o Curso
        </Button>
      </Section>
    ) : null}
  </EmailShell>
);

export const AccessExpiryWarningEmail = ({
  actionUrl,
  courseTitle,
  daysRemaining,
  name,
}: AccessExpiryWarningEmailProps): React.JSX.Element => (
  <EmailShell preview="Seu acesso ao curso esta perto de vencer.">
    <Heading>Acesso perto do vencimento</Heading>
    <Text style={styles.text}>Ola, {name}.</Text>
    <Text style={styles.text}>
      Seu acesso ao curso {courseTitle ?? "PROTEA-R Hub"} vence em{" "}
      {daysRemaining} {daysRemaining === 1 ? "dia" : "dias"}.
    </Text>
    <Text style={styles.text}>
      Entre na plataforma para concluir as aulas pendentes ou renovar seu
      acesso, se precisar de mais tempo.
    </Text>
    {actionUrl ? (
      <Section>
        <Button href={actionUrl} style={styles.button}>
          Acessar curso
        </Button>
      </Section>
    ) : null}
  </EmailShell>
);

export const SupportRequestEmail = ({
  courseTitle,
  message,
  studentEmail,
  studentName,
  subject,
}: SupportRequestEmailProps): React.JSX.Element => (
  <EmailShell preview={`Novo pedido de suporte: ${subject}`}>
    <Heading>Novo pedido de suporte</Heading>
    <Text style={styles.text}>
      {studentName} enviou uma solicitacao de suporte pela plataforma.
    </Text>
    <Section style={styles.panel}>
      <Text style={styles.text}>
        <strong>Nome:</strong> {studentName}
      </Text>
      <Text style={styles.text}>
        <strong>E-mail:</strong> {studentEmail}
      </Text>
      {courseTitle ? (
        <Text style={styles.text}>
          <strong>Curso:</strong> {courseTitle}
        </Text>
      ) : null}
      <Text style={styles.text}>
        <strong>Assunto:</strong> {subject}
      </Text>
    </Section>
    <Text style={styles.text}>{message}</Text>
  </EmailShell>
);
