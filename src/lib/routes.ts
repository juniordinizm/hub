import type { Route } from "next";

export const route = (path: string): Route => path as Route;
