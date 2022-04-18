import { createDep, Dep } from "./dep"

const targetMap = new WeakMap()


const effectStack: any[] = [];
let activeEffect: any = null;

export function effect<T = any>(fn: () => T, options?: any) {
  const _effect = new ReactiveEffect(fn)

  if (!options || !options.lazy) {
    _effect.run()
  }
  const runner = _effect.run.bind(_effect)
  // @ts-ignore
  runner.effect = _effect
  return runner
}

export class ReactiveEffect<T = any> {
  active = true
  deps: Dep[] = []

  computed?: boolean

  constructor(
    public fn: () => T,
    public scheduler: (() => void) | null = null
  ) {

  }

  run() {
    if (!this.active) {
      return this.fn()
    }
    if (!effectStack.includes(this)) {
      try {
        effectStack.push(activeEffect = this)
        return this.fn()
      } catch (e) {
        console.log('error', e)
      } finally {
        effectStack.pop()

        const n = effectStack.length
        n > 0 ? activeEffect = activeEffect[n-1] : undefined
      }
    }
  }
}


export const track = (target: object, key: string | symbol) => {
  // const effectFn = effectStack[effectStack.length - 1]
  // if (effectFn) {
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }
  let deps = depsMap.get(key)
  if (!deps) {
    deps = new Set()
    depsMap.set(key, deps)
  }

  trackEffects(deps)
  // deps.add(effectFn)
  // }

}

export const trackEffects = (dep: Dep) => {
  if (dep.has(activeEffect)) return

  if (activeEffect) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}


export const trigger = (target: object, key: string | symbol) => {
  const depsMap = targetMap.get(target)
  if (depsMap) {
    const deps = depsMap.get(key)
    if (deps) {
      // deps.forEach((effect: any) => effect.run())
      triggerEffects(createDep(deps))
    }
  }
}

export const triggerEffects = (dep: Dep | ReactiveEffect[]) => {
  for (let effect of Array.isArray(dep) ? dep : [...dep]) {
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
}