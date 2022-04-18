import { isObject } from "../shared/src";
import { track, trigger } from "./effect";

export function reactive<T>(obj: object): T {
  if (!isObject(obj)) {
    return obj;
  }

  const observed = new Proxy(obj, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      track(target, key)
      if (isObject(value)) {
        return reactive(value);
      }
      return value
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key)
      return result;
    },
    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key);
      trigger(target, key)
      return result
    }
  })

  return observed as unknown as T;
}