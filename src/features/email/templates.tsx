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
}

interface CertificateEmailProps extends CourseEmailProps {
  certificateCode: string;
}

interface AccessExpiryWarningEmailProps extends CourseEmailProps {
  daysRemaining: number;
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

export const InviteEmail = ({
  actionUrl,
  courseTitle,
  name,
}: CourseEmailProps): React.JSX.Element => (
  <EmailShell preview="Seu acesso ao PROTEA-R Hub foi liberado.">
    <Heading>Seu acesso esta pronto</Heading>
    <Text style={styles.text}>Ola, {name}.</Text>
    <Text style={styles.text}>
      Sua matricula em {courseTitle ?? "PROTEA-R Hub"} foi liberada. Use o botao
      abaixo para definir sua senha e acessar a area da aluna.
    </Text>
    {actionUrl ? (
      <Section>
        <Button href={actionUrl} style={styles.button}>
          Definir senha
        </Button>
      </Section>
    ) : null}
    <Text style={styles.muted}>
      Se o botao nao funcionar, copie e cole o link recebido no navegador.
    </Text>
  </EmailShell>
);

export const PasswordResetEmail = ({
  actionUrl,
  name,
}: CourseEmailProps): React.JSX.Element => (
  <EmailShell preview="Redefina sua senha do PROTEA-R Hub.">
    <Heading>Redefinir senha</Heading>
    <Text style={styles.text}>Ola, {name}.</Text>
    <Text style={styles.text}>
      Recebemos uma solicitacao para redefinir sua senha. O link expira em breve
      por seguranca.
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
