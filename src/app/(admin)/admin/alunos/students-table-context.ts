import {
  ADMIN_ENROLLMENT_STATUS_FILTERS,
  ADMIN_STUDENT_ACCESS_FILTERS,
  type AdminEnrollmentStatusFilter,
  type AdminStudentAccessFilter,
} from "@/features/admin/student-filters";

export interface StudentsTableFilterOption {
  label: string;
  value: string;
}

export interface StudentsTableContext {
  caption: string;
  courseId?: string;
  emptyDescription: string;
  emptyTitle: string;
  filterLabel: string;
  filterOptions: readonly StudentsTableFilterOption[];
  filterParam: string;
  filterValue?: string;
  hiddenSearchParams?: Record<string, string>;
  pageParam: string;
  searchAction: string;
  searchParam: string;
  searchPlaceholder?: string;
  statusMode: "access" | "enrollment";
}

export const createGlobalStudentsTableContext = (
  accessFilter: AdminStudentAccessFilter = "all"
): StudentsTableContext => {
  const currentFilter = accessFilter === "all" ? undefined : accessFilter;

  return {
    caption: "Alunos cadastrados e estado de acesso",
    emptyDescription: "Os Alunos cadastrados aparecerão aqui.",
    emptyTitle: "Nenhum Aluno cadastrado",
    filterLabel: "Estado do acesso",
    filterOptions: ADMIN_STUDENT_ACCESS_FILTERS,
    filterParam: "access",
    ...(currentFilter ? { filterValue: currentFilter } : {}),
    pageParam: "page",
    searchAction: "/admin/alunos",
    searchParam: "q",
    searchPlaceholder: "Buscar por nome ou e-mail…",
    statusMode: "access",
  };
};

export const createCourseStudentsTableContext = (
  courseId: string,
  statusFilter: AdminEnrollmentStatusFilter = "all"
): StudentsTableContext => {
  const currentFilter = statusFilter === "all" ? undefined : statusFilter;

  return {
    caption: "Alunos matriculados neste Curso",
    courseId,
    emptyDescription: "Este Curso ainda não possui Alunos matriculados.",
    emptyTitle: "Nenhuma matrícula",
    filterLabel: "Status da matrícula",
    filterOptions: ADMIN_ENROLLMENT_STATUS_FILTERS,
    filterParam: "enrollmentStatus",
    ...(currentFilter ? { filterValue: currentFilter } : {}),
    hiddenSearchParams: { tab: "students" },
    pageParam: "enrollmentPage",
    searchAction: `/admin/cursos/${encodeURIComponent(courseId)}`,
    searchParam: "enrollmentQ",
    searchPlaceholder: "Buscar por nome ou e-mail…",
    statusMode: "enrollment",
  };
};
