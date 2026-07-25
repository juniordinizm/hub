export interface CourseBuilderLesson {
  id: string;
  moduleId: string;
}

export interface LessonReorderGroup {
  lessonIds: string[];
  moduleId: string;
}

export const getAffectedLessonReorderGroups = ({
  activeLessonId,
  currentLessons,
  initialLessons,
}: {
  activeLessonId: string;
  currentLessons: CourseBuilderLesson[];
  initialLessons: CourseBuilderLesson[];
}): LessonReorderGroup[] => {
  const initialLesson = initialLessons.find(
    (lesson) => lesson.id === activeLessonId
  );
  const currentLesson = currentLessons.find(
    (lesson) => lesson.id === activeLessonId
  );

  if (!(initialLesson && currentLesson)) {
    return [];
  }

  const moduleIds = new Set([initialLesson.moduleId, currentLesson.moduleId]);

  return Array.from(moduleIds).map((moduleId) => ({
    lessonIds: currentLessons
      .filter((lesson) => lesson.moduleId === moduleId)
      .map((lesson) => lesson.id),
    moduleId,
  }));
};
