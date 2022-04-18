import { createDep } from "./dep"
import { trackEffects, triggerEffects } from "./effect"

export const trackRefValue = (ref: any) => {
  if (!ref.dep) {
    ref.dep = createDep()
  }
  trackEffects(ref.dep)
}

export const triggerRefValue = (ref: any) => {
  triggerEffects(ref.dep)
}