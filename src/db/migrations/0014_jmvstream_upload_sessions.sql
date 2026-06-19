drop index if exists jmvstream_video_assets_active_lesson_unique_idx;

create unique index if not exists jmvstream_video_assets_active_lesson_unique_idx
on jmvstream_video_assets (lesson_id)
where lesson_id is not null
  and delete_status = 'none'
  and upload_status in ('processing', 'ready');
