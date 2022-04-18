import { Dep } from "./dep"
import { effect, ReactiveEffect } from "./effect"
import { trackRefValue, triggerRefValue } from "./ref"


class ComputedRefImpl {
  public dep?: Dep = undefined

  private _value = undefined
  private _dirty = true

  public readonly effect: ReactiveEffect

  constructor(getter: () => any) {
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true
        triggerRefValue(this)
      }
    })
  }

  get value() {
    // const self = this
    trackRefValue(this)
    if (this._dirty) {
      this._dirty = false
      this._value = this.effect.run()
    }
    return this._value
  }

}

export const computed = (getter: () => any) => {
  const cRef = new ComputedRefImpl(getter)

  return cRef
}