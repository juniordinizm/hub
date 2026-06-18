import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

const { Pool } = pg;
const rawDatabaseUrl =
  process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL or DATABASE_URL_DIRECT is required.");
}

const withVerifiedSslMode = (connectionString) => {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");
    const warningModes = new Set(["prefer", "require", "verify-ca"]);

    if (!(sslMode && !warningModes.has(sslMode))) {
      url.searchParams.set("sslmode", "verify-full");
    }

    return url.toString();
  } catch {
    const separator = connectionString.includes("?") ? "&" : "?";
    return `${connectionString}${separator}sslmode=verify-full`;
  }
};

const databaseUrl = withVerifiedSslMode(rawDatabaseUrl);

const pool = new Pool({ connectionString: databaseUrl });

const modules = [
  {
    title: "Apresentacao e Introducao ao PROTEA-R",
    color: "#326c71",
    lessons: [
      ["Aula 1.1 - Apresentacao do Curso", 12],
      ["Aula 1.2 - O que e o PROTEA-R?", 18],
      ["Aula 1.3 - Como usar este material", 20],
    ],
  },
  {
    title: "Fundamentos Teoricos e Organizacao",
    color: "#4a7c59",
    lessons: [
      ["Aula 2.1 - Bases Cientificas", 22],
      ["Aula 2.2 - Criterios Diagnosticos DSM-5", 25],
      ["Aula 2.3 - Perfil Sensorial", 18],
      ["Aula 2.4 - Organizacao do Processo", 15],
    ],
  },
  {
    title: "Eixo 1 - Entrevista de Anamnese",
    color: "#5a6e3a",
    lessons: [
      ["Aula 3.1 - Entrevista de Anamnese", 25],
      ["Aula 3.2 - Roteiro de Perguntas", 22],
      ["Aula 3.3 - Escuta Ativa", 20],
      ["Aula 3.4 - Documentacao da Entrevista", 24],
      ["Aula 3.5 - Pratica Supervisionada", 19],
    ],
  },
  {
    title: "Eixo 2 - Observacao e Protocolo Comportamental",
    color: "#8b6914",
    lessons: [
      ["Apresentacao - Eixo 2", 10, "presentation"],
      ["Aula 4.1 - Protocolo Comportamental", 28],
      ["Aula 4.2 - Observacao Estruturada", 26],
      ["Aula 4.3 - Registro de Comportamentos", 23],
      ["Aula 4.4 - Analise dos Dados", 25],
      ["Aula 4.5 - Estudo de Caso", 18],
      ["Aula 4.6 - Triangulacao de Dados Clinicos", 22],
      ["Aula 4.7 - Escala de Intensidade Comportamental", 20],
      ["Aula Bonus - Material Complementar do Eixo 2", 15, "bonus"],
    ],
  },
  {
    title: "Codificacao, Interpretacao e Documento",
    color: "#7a3a2a",
    lessons: [
      ["Aula 5.1 - Codificacao dos Itens", 30],
      ["Aula 5.2 - Interpretacao dos Escores", 28],
      ["Aula 5.3 - Elaboracao do Documento", 24],
      ["Aula 5.4 - Revisao e Checklist", 18],
    ],
  },
  {
    title: "Devolutiva aos Responsaveis",
    color: "#2a4a6a",
    lessons: [
      ["Aula 6.1 - Devolutiva Clinica", 20],
      ["Aula 6.2 - Comunicacao com a Familia", 22],
      ["Aula 6.3 - Encaminhamentos e Proximos Passos", 18],
    ],
  },
];

const workloadHours = Math.ceil(
  modules
    .flatMap((moduleData) => moduleData.lessons)
    .reduce((total, lesson) => total + lesson[1] * 60, 0) / 3600
);

const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(`
    insert into app_settings (id)
    values ('global')
    on conflict (id) do nothing
  `);

  const courseResult = await client.query(
    `
      insert into courses (
        slug,
        title,
        subtitle,
        description,
        workload_hours,
        status,
        payment_provider_product_id
      )
      values (
        'protea-r',
        'Sistema PROTEA-R',
        'Avaliacao de suspeita de TEA',
        'Curso para psicologas e neuropsicologas com progressao por modulos.',
        ${workloadHours},
        'active',
        'prod_protea_r'
      )
      on conflict (slug) do update set
        title = excluded.title,
        workload_hours = excluded.workload_hours,
        status = excluded.status,
        payment_provider_product_id = excluded.payment_provider_product_id
      returning id
    `
  );
  const courseId = courseResult.rows[0].id;

  for (const [moduleIndex, moduleData] of modules.entries()) {
    const moduleResult = await client.query(
      `
        insert into modules (course_id, title, sort_order, color)
        values ($1, $2, $3, $4)
        on conflict (course_id, sort_order) do update set
          title = excluded.title,
          color = excluded.color
        returning id
      `,
      [courseId, moduleData.title, moduleIndex + 1, moduleData.color]
    );
    const moduleId = moduleResult.rows[0].id;

    for (const [lessonIndex, lesson] of moduleData.lessons.entries()) {
      await client.query(
        `
          insert into lessons (
            module_id,
            title,
            description,
            lesson_type,
            duration_seconds,
            sort_order,
            video_provider,
            video_embed_url
          )
          values ($1, $2, $3, $4, $5, $6, 'external', null)
          on conflict (module_id, sort_order) do update set
            title = excluded.title,
            duration_seconds = excluded.duration_seconds,
            lesson_type = excluded.lesson_type
        `,
        [
          moduleId,
          lesson[0],
          "Conteudo base importado da arquitetura PROTEA-R.",
          lesson[2] ?? "video",
          lesson[1] * 60,
          lessonIndex + 1,
        ]
      );
    }
  }

  await client.query(`
    insert into faq_items (question, answer, sort_order, category)
    values
      ('Por quanto tempo tenho acesso ao curso?', 'O acesso padrao e de 12 meses apos a compra.', 1, 'acesso'),
      ('Posso assistir pelo celular?', 'Sim, a plataforma e responsiva e funciona em celular e desktop.', 2, 'acesso'),
      ('Como obtenho meu certificado?', 'O certificado e gerado automaticamente ao concluir todas as aulas.', 3, 'certificado')
    on conflict do nothing
  `);

  await client.query("commit");
  console.log("Seed inicial PROTEA-R concluido.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
