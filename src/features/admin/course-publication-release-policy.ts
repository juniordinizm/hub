export interface PublishedLessonRelease {
  curriculumKey: string;
  lessonTitle: string;
  moduleTitle: string;
  releaseDelayDays: number;
}

export interface ContentReleaseRegression {
  curriculumKey: string;
  lessonTitle: string;
  nextDelayDays: number;
  nextModuleTitle: string;
  previousDelayDays: number;
}

const assertValidReleaseDelay = (releaseDelayDays: number): void => {
  if (!Number.isSafeInteger(releaseDelayDays) || releaseDelayDays < 0) {
    throw new Error("Atraso de liberação inválido.");
  }
};

export const findContentReleaseRegressions = ({
  hasScheduledReleaseHistory,
  next,
  previous,
}: {
  hasScheduledReleaseHistory: boolean;
  next: PublishedLessonRelease[];
  previous: PublishedLessonRelease[];
}): ContentReleaseRegression[] => {
  for (const lesson of [...previous, ...next]) {
    assertValidReleaseDelay(lesson.releaseDelayDays);
  }

  if (!hasScheduledReleaseHistory) {
    return [];
  }

  const previousByKey = new Map(
    previous.map((lesson) => [lesson.curriculumKey, lesson])
  );
  const regressions: ContentReleaseRegression[] = [];

  for (const lesson of next) {
    const current = previousByKey.get(lesson.curriculumKey);
    if (current && lesson.releaseDelayDays > current.releaseDelayDays) {
      regressions.push({
        curriculumKey: lesson.curriculumKey,
        lessonTitle: lesson.lessonTitle,
        nextDelayDays: lesson.releaseDelayDays,
        nextModuleTitle: lesson.moduleTitle,
        previousDelayDays: current.releaseDelayDays,
      });
    }
  }

  return regressions;
};
