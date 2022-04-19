import { isFunction } from "../shared/src"
import { ReactiveEffect } from "./effect"

export function watch(source: () => any, cb: (val: any, old: any) => void, options?: any) {
  return doWatch(source, cb, options)
}

export function doWatch(source: () => any, cb: (val: any, old: any) => void, options?: any) {
  let getter = () => {}
  if (isFunction(source)) {
    getter = source
  }

  
  const scheduler = () => {
    let value = effect.run()
    if (value !== oldValue) {
      cb(value, oldValue)
      oldValue = value
    }
  }
  let effect = new ReactiveEffect(getter, scheduler)
  let oldValue: any = effect.run()

  return () => {
    effect.stop()
  }
}