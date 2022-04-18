import { ReactiveEffect } from "./effect"

export type Dep = Set<any>

export const createDep = (effects?: ReactiveEffect[]) => {
  const dep = new Set<any>(effects)
  return dep
}