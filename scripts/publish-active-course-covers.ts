import { getPool } from "@/db";
import { getCourseCoverStorageKeys } from "@/features/storage/course-cover";
import { publishR2Object } from "@/features/storage/r2";

const publishActiveCourseCovers = async (): Promise<number> => {
  const { rows } = await getPool().query<{ cover_image_json: unknown }>(
    `
      select cover_image_json
      from courses
      where status = 'active'
        and cover_image_json is not null
    `
  );
  const keys = new Set(
    rows.flatMap((row) => getCourseCoverStorageKeys(row.cover_image_json))
  );

  for (const key of keys) {
    await publishR2Object(key);
  }

  return keys.size;
};

if (import.meta.main) {
  try {
    const publishedObjectCount = await publishActiveCourseCovers();
    process.stdout.write(
      `Published ${publishedObjectCount} active course cover objects.\n`
    );
  } finally {
    await getPool().end();
  }
}

export { publishActiveCourseCovers };
