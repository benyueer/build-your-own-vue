export const isObject = (value: object): value is object => value !== null && typeof value === 'object';

export const isFunction = (value: any): value is Function => typeof value === 'function';