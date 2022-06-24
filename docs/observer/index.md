### 响应式原理
Vue的`data`,`props`以及`watcher`,`computed`等都具备响应性，即依赖变化时会自动求取新值
一个最基本的例子是我们在组件中定义data，然后在template中使用data，那么当data变化时，视图会对应的更新
```js
<div>{{msg}}</div>
{
  data() {
    return {
      msg: 'hello world'
    }
  }
}
```
这其中的过程是什么样的呢？主要包括以下步骤：
1. 编译模版生成`render`函数，函数使用了实例的属性
2. 实例初始化，将数据变为响应性
3. 执行`render`函数，会访问到响应性数据，进行**依赖收集**
4. 当数据变化时会**触发更新**，找到所有的依赖函数，重新运行，对于该例子来说就是`_update`函数，他调用了`render`函数

#### mountComponent
当组件挂载时会调用`mount`方法，`mount`又会调用`mountComponent`,其代码如下：
```js
updateComponent = () => {
  vm._update(vm._render(), hydrating)
}

new Watcher(vm, updateComponent, noop, {
  before () {
    if (vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'beforeUpdate')
    }
  }
}, true /* isRenderWatcher */)
```
`mountComponent`实例化了一个`Watcher`，也就是*渲染Watcher*，将`updateComponent`传入`Watcher`,那么当`updateComponent`访问的响应式数据更新时就会重新执行


### 数据响应化
在*初始化*章节我们描述过实例的数据初始化过程，也就是`initState`方法：
```js
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
```
这个方法会将`props`,`methods`,`data`,`computed`,`watch`初始化

首先看`initProps`:
```js
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    
    defineReactive(props, key, value)
    
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}
```
`props`初始化使用`defineReactive`将每个属性都变为`props`上的响应式属性，然后通过`props`将属性代理到实例的`_props`上


`initData`
```js
function initData (vm: Component) {
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (!isReserved(key)) {
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  observe(data, true /* asRootData */)
}
```
同样做了`initProps`的两件事，先将`data`的属性代理到实例上，不过多了一层过滤:`$`,`_`开头的属性不会被代理，
然后调用`observe`将`data`响应化

*计算属性和监听属性之后会讲到*


可以发现，对于`data`和`props`的处理都用到了数据响应化的方法，这部分的代码在`src/core/observer/index.js`定义

打开这个文件，主要部分就是`Observer`类和两个方法：`observe`,`defineReactive`
`Observer`
```js
/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}
```
`Oberver`类用于给对象的属性添加`getter/setter`，用于依赖收集和派发更新
首先，该类会给传入的值添加`__ob__`属性，指向本次新建的`Observer`实例，然后判断传入的值是不是数组，如果是数组，会处理数组的7个原型方法，以使得通过使用这些方法时也能正常的触发更新，那么这些方法是怎么被修改的呢？代码在`src/core/observer/array.js`:
```js
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})
```
首先用一个数组保存了要修改的方法，然后遍历数组，先缓存原始方法（即在`Array`原型上的旧方法），再定义新的方法，新方法会执行旧方法，完成对应函数应有的操作，然后判断有没有为数组添加新值，会对新值进行依赖收集，最后调用`notify`派发更新
数组方法扩展完成后，会调用`observeArray`对数组的每一项进行响应化：
```js
observeArray (items: Array<any>) {
  for (let i = 0, l = items.length; i < l; i++) {
    observe(items[i])
  }
}
```
通过`observe`方法进行，之后会讲到

对于非数组的值，`Observer`通过`walk`方法处理：
```js
walk (obj: Object) {
  const keys = Object.keys(obj)
  for (let i = 0; i < keys.length; i++) {
    defineReactive(obj, keys[i])
  }
}
```
`walk`会遍历对象，然后通过`defineReactive`将属性响应化

`defineReactive`的作用就是定义一个响应式对象，给对象的属性添加`getter/setter`方法
```js
/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}
```
函数接收5个参数，主要的是前3个：`obj, key, val`，要响应化的对象的属性和值
首先实例化一个`Dep`类，判断对象是否可配置，然后获取旧的`getter/setter`，接着调用`observe`，传入属性值，将属性值也响应化，这其实是一个递归的过程，通过递归使得复杂的多层级的对象的每个属性都能被响应化
然后通过`Object.defineProperty`对要响应化的属性配置新的`getter/setter`
`getter`方法首先求值，然后进行*依赖收集*，也就是`dep.depend`，这个方法会将当前`Watcher`和`Dep`互相添加到依赖列表中；如果当前属性值是一个对象，那么`childOb`就不为空，对`childOb`也进行依赖收集，判断值是否为数组，如果是数组，遍历一次，对每个值进行依赖收集
`setter`方法判断一下值是否改变，没有改变直接`return`，然后修改对应值，接着对新值执行`observe`添加`Observer`实例，最后调用`dep.notify`进行*派发更新*


### 依赖收集
之前说过在`mountComponent`函数中会新建一个`render Watcher`，那么`Watcher`是什么呢？他的定义在`src/core/observer/watcher.js`，由于代码太长就不放在这里了。
`Watcher`是一个类，字面意思就是“观察”或者“监听”，构造函数如下：
```js
constructor (
  vm: Component,
  expOrFn: string | Function,
  cb: Function,
  options?: ?Object,
  isRenderWatcher?: boolean
) {
  this.vm = vm
  if (isRenderWatcher) {
    vm._watcher = this
  }
  vm._watchers.push(this)
  // options
  if (options) {
    this.deep = !!options.deep
    this.user = !!options.user
    this.lazy = !!options.lazy
    this.sync = !!options.sync
    this.before = options.before
  } else {
    this.deep = this.user = this.lazy = this.sync = false
  }
  this.cb = cb
  this.id = ++uid // uid for batching
  this.active = true
  this.dirty = this.lazy // for lazy watchers
  this.deps = []
  this.newDeps = []
  this.depIds = new Set()
  this.newDepIds = new Set()
  this.expression = process.env.NODE_ENV !== 'production'
    ? expOrFn.toString()
    : ''
  // parse expression for getter
  if (typeof expOrFn === 'function') {
    this.getter = expOrFn
  } else {
    this.getter = parsePath(expOrFn)
    if (!this.getter) {
      this.getter = noop
      process.env.NODE_ENV !== 'production' && warn(
        `Failed watching path: "${expOrFn}" ` +
        'Watcher only accepts simple dot-delimited paths. ' +
        'For full control, use a function instead.',
        vm
      )
    }
  }
  this.value = this.lazy
    ? undefined
    : this.get()
}
```
接收以下参数
- vm: 组件实例,
- expOrFn: 求值表达式,
- cb: 回调,
- options: 配置,
- isRenderWatcher: 服务端渲染

构造函数会将配置初始化，得到`deep, user, lazy, sync, before, cb, id , active, dirty`的基本属性
然后初始化`dep`数组，通过求值表达式构建`getter`方法，最后根据`lazy`属性判断是否求值

`Watcher`还有几个方法比较重要：
`get`方法
```js
get () {
  pushTarget(this)
  let value
  const vm = this.vm
  try {
    value = this.getter.call(vm, vm)
  } catch (e) {
    if (this.user) {
      handleError(e, vm, `getter for watcher "${this.expression}"`)
    } else {
      throw e
    }
  } finally {
    // "touch" every property so they are all tracked as
    // dependencies for deep watching
    if (this.deep) {
      traverse(value)
    }
    popTarget()
    this.cleanupDeps()
  }
  return value
}
```
`get`方法会执行`getter`函数，也就是求值，首先会执行`pushTarget(this)`，将当前`Watcher`设置为正在活跃的`Watcher`，然后执行`getter`，还会根据`deep`属性决定是否对子级的属性进行依赖收集，然后执行`popTarget`清除当前`Watcher`
<!-- todo  cleanupDeps -->

那么在求值的过程中发生了什么呢？以渲染`Watcher`举例，此时的求值表达式就是`diff`函数，会调用`render`函数，`render`函数会渲染出`VNode`，在`VIEW`层我们会访问`DATA`层的数据，而且数据是响应式的，当读取数据的值时，会调用响应式数据的`getter`，还记不记得`getter`中的`dep.depend`，让我们先看看这个函数做了什么：
```js
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
```
上面就是`Dep`类的代码，我们来看`depend`函数，他会找到`Dep.target`属性，这个属性就是在`Watcher`的`get`方法中设置的，代表正在求值的`Watcher`，然后调用`Watcher`的`addDep`方法，再来看看该方法的定义：
```js
addDep (dep: Dep) {
  const id = dep.id
  if (!this.newDepIds.has(id)) {
    this.newDepIds.add(id)
    this.newDeps.push(dep)
    if (!this.depIds.has(id)) {
      dep.addSub(this)
    }
  }
}
```
这个方法会在当前`Watcher`的依赖数组中添加访问的响应式数据的`Dep`，同时将自己添加到`Dep`的`Sub`数组中
经过这一过程，使用响应式数据的`render`所对应的`Watcher`都将改数据的`Dep`添加到自身，而响应式数据的`Dep`也都将使用过他的`Watcher`添加到了自己的`Sub`中，这就是依赖收集的过程
<!-- todo   依赖清除 -->


### 派发更新
什么情况下会产生更新呢？自然就是当被使用的响应式数据变化的时候，当我们修改一个响应式数据的值时，会使用他的`setter`函数，之前说过，`setter`函数会在最后调用`dep.notify`，先来看一下`notify`方法做了什么：
```js
notify () {
  // stabilize the subscriber list first
  const subs = this.subs.slice()
  if (process.env.NODE_ENV !== 'production' && !config.async) {
    // subs aren't sorted in scheduler if not running async
    // we need to sort them now to make sure they fire in correct
    // order
    subs.sort((a, b) => a.id - b.id)
  }
  for (let i = 0, l = subs.length; i < l; i++) {
    subs[i].update()
  }
}
```
可以看到`notify`会遍历当前`Dep`的`Sub`数组，这个数组就是使用了该响应式数据的`Watcher`队列，然后依次调用`Watcher`的`update`方法：
```js
update () {
  /* istanbul ignore else */
  if (this.lazy) {
    this.dirty = true
  } else if (this.sync) {
    this.run()
  } else {
    queueWatcher(this)
  }
}
```
`update`会执行`run`方法：
```js
run () {
  if (this.active) {
    const value = this.get()
    if (
      value !== this.value ||
      // Deep watchers and watchers on Object/Arrays should fire even
      // when the value is the same, because the value may
      // have mutated.
      isObject(value) ||
      this.deep
    ) {
      // set new value
      const oldValue = this.value
      this.value = value
      if (this.user) {
        const info = `callback for watcher "${this.expression}"`
        invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info)
      } else {
        this.cb.call(this.vm, value, oldValue)
      }
    }
  }
}
```
`run`方法首先会执行`get`求值，然后判断是否满足执行监听属性的条件
当执行`get`时，对渲染`Watcher`来说就是生成了新`vDom`并diff，然后视图就更新了，这就是派发更新

当然这是同步立即执行的情况，假如所有的`Watcher`都这么配置，那么当页面复杂时，一次更新就要执行多个`Watcher`，由于是同步执行，性能消耗会很大，于是就通过一个`queueWatcher`函数优化这个过程，该函数定义在`src/core/observer/scheduler.js`:
```js
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) {
    has[id] = true
    if (!flushing) {
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    if (!waiting) {
      waiting = true

      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }
      nextTick(flushSchedulerQueue)
    }
  }
}
```
通过`flushing`保存队列执行状态，当队列开始运行前，直接将`Watcher`加入队列，这是因为`flushSchedulerQueue`在执行队列前会将`Watcher`通过id排序，之所以要排序是为了保证先创建的`Watcher`先执行
1. 组件的创建由父到子，渲染`Watcher`也是由父到子，更新顺序也是
2. 当子组件在一次更新中被删除，那么他的`Watcher`也没必要执行，因此父组件的`Watcher`应当先执行
3. 用户定义的`Watcher`在组件实例化阶段被创建，先于组件渲染，也应当先执行
当`flushing`为`true`时，代表队列遍历已经开始，这时需要自行找到插入位置，同样要满足以`id`排序
`waiting`保证了队列清空操作只执行一次

来看看`flushSchedulerQueue`的定义：
```js
function flushSchedulerQueue () {
  currentFlushTimestamp = getNow()
  flushing = true
  let watcher, id
  queue.sort((a, b) => a.id - b.id)
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    watcher.run()
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)
}
```
首先要对队列排序，然后遍历队列更新`Watcher`，这里要注意，队列的长度是动态的，所以不能缓存长度
什么情况下会在队列执行的状态下插入新`Watcher`呢？有一种情况是父子组件更新的时候
当调用父组件的`render Watcher`时，会进行diff，如果有子组件，会执行`updateChild`，这时如果传递的`props`改变，子组件会重新渲染，那么他的`Watcher`也会被添加到队列当中，而且添加的时候队列已经是`flushing`状态
当所有的`Watcher`都执行完成后，会重置调度状态，然后触发`keep-alive`的`active`，和组件的`updated`钩子

这就是派发更新的完整过程，其核心就是将渲染函数传递给`render Watcher`，在组件初始化时将数据都进行响应化，当模版渲染时，就会触发响应式数据的依赖收集，在响应式数据更新的时候，会触发`render Watcher`的更新，渲染出新的DOM