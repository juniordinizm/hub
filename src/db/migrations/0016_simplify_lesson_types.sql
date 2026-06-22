update lessons
set
  content_json = case
    when lesson_type::text = 'presentation' then jsonb_build_object(
      'type',
      'text',
      'document',
      jsonb_build_object(
        'type',
        'doc',
        'content',
        jsonb_build_array(
          jsonb_build_object(
            'type',
            'paragraph',
            'content',
            jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', 'Material da aula')
            )
          )
        )
      ),
      'resources',
      jsonb_build_array(
        jsonb_build_object(
          'id',
          'resource-1',
          'label',
          'Material da aula',
          'url',
          content_json->>'url'
        )
      )
    )
    when lesson_type::text = 'bonus' then jsonb_build_object(
      'type',
      'text',
      'document',
      jsonb_build_object(
        'type',
        'doc',
        'content',
        jsonb_build_array(
          jsonb_build_object(
            'type',
            'paragraph',
            'content',
            jsonb_build_array(
              jsonb_build_object(
                'type',
                'text',
                'text',
                coalesce(nullif(content_json->>'body', ''), 'Material da aula')
              )
            )
          )
        )
      ),
      'resources',
      case
        when nullif(content_json->>'url', '') is null then '[]'::jsonb
        else jsonb_build_array(
          jsonb_build_object(
            'id',
            'resource-1',
            'label',
            'Material da aula',
            'url',
            content_json->>'url'
          )
        )
      end
    )
    else content_json
  end,
  lesson_type = 'text'
where lesson_type::text in ('presentation', 'bonus');

alter table lessons alter column lesson_type drop default;

create type lesson_type_next as enum ('video', 'text');

alter table lessons
alter column lesson_type type lesson_type_next
using lesson_type::text::lesson_type_next;

drop type lesson_type;

alter type lesson_type_next rename to lesson_type;

alter table lessons alter column lesson_type set default 'video';
