update lessons
set content_json = jsonb_strip_nulls(
  jsonb_build_object(
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
            jsonb_build_object('type', 'text', 'text', content_json ->> 'body')
          )
        )
      )
    ),
    'resources',
    content_json -> 'resources'
  )
)
where content_json ->> 'type' = 'text'
  and content_json ? 'body'
  and not content_json ? 'document';

alter table lessons drop column if exists lesson_type;
drop type if exists lesson_type;
