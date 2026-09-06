import { MAX_RELEASE_DELAY_DAYS } from "@/features/courses/module-content-release";

export const CONTENT_RELEASE_NEXT_MODULE_LATERAL_SQL = `
      left join lateral (
        select min(
          e.content_release_started_at + (m.release_delay_days * interval '24 hours')
        ) as next_module_release_at
        from modules m
        join course_publications cp_release
          on cp_release.id = m.course_publication_id
        where cp_release.course_id = e.course_id
          and cp_release.status = 'published'
          and m.status = 'active'
          and m.release_delay_days > 0
          and m.release_delay_days <= ${MAX_RELEASE_DELAY_DAYS}
          and e.content_release_mode = 'scheduled'
          and e.content_release_started_at is not null
          and e.content_release_started_at
                + (m.release_delay_days * interval '24 hours') > now()
      ) next_release on true
`;
