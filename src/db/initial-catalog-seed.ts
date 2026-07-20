interface SeedQueryResult {
  rows: Array<{ id: string }>;
}

export interface InitialCatalogSeedClient {
  query: (statement: string, values?: unknown[]) => Promise<SeedQueryResult>;
}

interface SeedLesson {
  durationMinutes: number;
  title: string;
}

interface SeedModule {
  lessons: SeedLesson[];
  title: string;
}

const modules: SeedModule[] = [
  {
    title: "Apresentacao e Introducao ao PROTEA-R",
    lessons: [
      { title: "Aula 1.1 - Apresentacao do Curso", durationMinutes: 12 },
      { title: "Aula 1.2 - O que e o PROTEA-R?", durationMinutes: 18 },
      { title: "Aula 1.3 - Como usar este material", durationMinutes: 20 },
    ],
  },
  {
    title: "Fundamentos Teoricos e Organizacao",
    lessons: [
      { title: "Aula 2.1 - Bases Cientificas", durationMinutes: 22 },
      { title: "Aula 2.2 - Criterios Diagnosticos DSM-5", durationMinutes: 25 },
      { title: "Aula 2.3 - Perfil Sensorial", durationMinutes: 18 },
      { title: "Aula 2.4 - Organizacao do Processo", durationMinutes: 15 },
    ],
  },
  {
    title: "Eixo 1 - Entrevista de Anamnese",
    lessons: [
      { title: "Aula 3.1 - Entrevista de Anamnese", durationMinutes: 25 },
      { title: "Aula 3.2 - Roteiro de Perguntas", durationMinutes: 22 },
      { title: "Aula 3.3 - Escuta Ativa", durationMinutes: 20 },
      { title: "Aula 3.4 - Documentacao da Entrevista", durationMinutes: 24 },
      { title: "Aula 3.5 - Pratica Supervisionada", durationMinutes: 19 },
    ],
  },
  {
    title: "Eixo 2 - Observacao e Protocolo Comportamental",
    lessons: [
      { title: "Apresentacao - Eixo 2", durationMinutes: 10 },
      { title: "Aula 4.1 - Protocolo Comportamental", durationMinutes: 28 },
      { title: "Aula 4.2 - Observacao Estruturada", durationMinutes: 26 },
      { title: "Aula 4.3 - Registro de Comportamentos", durationMinutes: 23 },
      { title: "Aula 4.4 - Analise dos Dados", durationMinutes: 25 },
      { title: "Aula 4.5 - Estudo de Caso", durationMinutes: 18 },
      {
        title: "Aula 4.6 - Triangulacao de Dados Clinicos",
        durationMinutes: 22,
      },
      {
        title: "Aula 4.7 - Escala de Intensidade Comportamental",
        durationMinutes: 20,
      },
      {
        title: "Aula Bonus - Material Complementar do Eixo 2",
        durationMinutes: 15,
      },
    ],
  },
  {
    title: "Codificacao, Interpretacao e Documento",
    lessons: [
      { title: "Aula 5.1 - Codificacao dos Itens", durationMinutes: 30 },
      { title: "Aula 5.2 - Interpretacao dos Escores", durationMinutes: 28 },
      { title: "Aula 5.3 - Elaboracao do Documento", durationMinutes: 24 },
      { title: "Aula 5.4 - Revisao e Checklist", durationMinutes: 18 },
    ],
  },
  {
    title: "Devolutiva aos Responsaveis",
    lessons: [
      { title: "Aula 6.1 - Devolutiva Clinica", durationMinutes: 20 },
      {
        title: "Aula 6.2 - Comunicacao com a Familia",
        durationMinutes: 22,
      },
      {
        title: "Aula 6.3 - Encaminhamentos e Proximos Passos",
        durationMinutes: 18,
      },
    ],
  },
];

const workloadHours = Math.ceil(
  modules
    .flatMap((moduleData) => moduleData.lessons)
    .reduce((total, lesson) => total + lesson.durationMinutes * 60, 0) / 3600
);

const getReturnedId = (result: SeedQueryResult, entity: string): string => {
  const id = result.rows[0]?.id;

  if (!id) {
    throw new Error(`O seed nao retornou o id de ${entity}.`);
  }

  return id;
};

export const runInitialCatalogSeed = async (
  client: InitialCatalogSeedClient
): Promise<void> => {
  await client.query("select pg_advisory_xact_lock(hashtext('seed:protea-r'))");

  await client.query(
    `
      insert into app_settings (id)
      values ('global')
      on conflict (id) do nothing
    `
  );

  const courseResult = await client.query(
    `
      insert into courses (
        slug,
        title,
        subtitle,
        description,
        workload_hours,
        price_in_cents,
        access_duration_months,
        status
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'active')
      on conflict (slug) do update set
        title = excluded.title,
        subtitle = excluded.subtitle,
        description = excluded.description,
        workload_hours = excluded.workload_hours,
        price_in_cents = excluded.price_in_cents,
        access_duration_months = excluded.access_duration_months,
        status = excluded.status
      returning id
    `,
    [
      "protea-r",
      "Sistema PROTEA-R",
      "Avaliacao de suspeita de TEA",
      "Curso para psicologas e neuropsicologas com progressao por modulos.",
      workloadHours,
      0,
      12,
    ]
  );
  const courseId = getReturnedId(courseResult, "curso");

  for (const [moduleIndex, moduleData] of modules.entries()) {
    const moduleResult = await client.query(
      `
        with updated_module as (
          update modules
          set sort_order = $3,
              status = 'active',
              updated_at = now()
          where id = (
            select id
            from modules
            where course_id = $1 and title = $2
            order by created_at, id
            limit 1
          )
          returning id
        ), inserted_module as (
          insert into modules (course_id, title, sort_order, status)
          select $1, $2, $3, 'active'
          where not exists (select 1 from updated_module)
          returning id
        )
        select id from updated_module
        union all
        select id from inserted_module
      `,
      [courseId, moduleData.title, moduleIndex + 1]
    );
    const moduleId = getReturnedId(moduleResult, "modulo");

    for (const [lessonIndex, lesson] of moduleData.lessons.entries()) {
      const durationSeconds = lesson.durationMinutes * 60;

      const lessonResult = await client.query(
        `
          with updated_lesson as (
            update lessons
            set description = $3,
                duration_seconds = $4,
                video_duration_seconds = $5,
                sort_order = $6,
                status = 'active',
                is_published = true,
                updated_at = now()
            where id = (
              select id
              from lessons
              where module_id = $1 and title = $2
              order by created_at, id
              limit 1
            )
            returning id
          ), inserted_lesson as (
            insert into lessons (
              module_id,
              title,
              description,
              duration_seconds,
              video_duration_seconds,
              sort_order,
              status,
              is_published
            )
            select $1, $2, $3, $4, $5, $6, 'active', true
            where not exists (select 1 from updated_lesson)
            returning id
          )
          select id from updated_lesson
          union all
          select id from inserted_lesson
        `,
        [
          moduleId,
          lesson.title,
          "Conteudo base importado da arquitetura PROTEA-R.",
          durationSeconds,
          durationSeconds,
          lessonIndex + 1,
        ]
      );
      getReturnedId(lessonResult, "aula");
    }
  }

  await client.query(`
    insert into faq_items (question, answer, sort_order, is_published)
    select candidate.question, candidate.answer, candidate.sort_order, true
    from (
      values
        ('Por quanto tempo tenho acesso ao curso?', 'O acesso padrao e de 12 meses apos a compra.', 1),
        ('Posso assistir pelo celular?', 'Sim, a plataforma e responsiva e funciona em celular e desktop.', 2),
        ('Como obtenho meu certificado?', 'O certificado e gerado automaticamente ao concluir todas as aulas.', 3)
    ) as candidate(question, answer, sort_order)
    where not exists (
      select 1
      from faq_items
      where question = candidate.question
    )
  `);
};
