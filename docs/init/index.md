### Vue对象定义

Vue类在`core/index`导出，主要代码为：
```js
import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'

initGlobalAPI(Vue)

export default Vue
```
该部分将Vue引入后通过`initGlobalAPI`扩展后再导出

`initGlobalAPI`做了什么呢？，来到其定义：
```js
export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config

  Object.defineProperty(Vue, 'config', configDef)

  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }

  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  Vue.options._base = Vue

  extend(Vue.options.components, builtInComponents)

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
```
`initGlobalAPI`为构造函数扩展了`config`,`util`,`set`,`delete`,`nextTick`,`observable`等方法
同时添加了组件配置（`KeeoAlive`），和`use`,`mixin`,`extend`,`assets`

那么原始的Vue构造函数是什么样的呢？

`Vue`的构造函数，定义在`src/core/instance/index.js`
```js
function Vue (options) {
  this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
```
可以看到，Vue的构造函数只是执行了`_init`方法，而Vue的特性和其他功能都通过剩下的几个函数来扩展的
`initMixin`只做了一件事：定义`_init`方法：
```js
export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}
```
`_init`方法会给实例添加`id`，然后对`options`进行组件化处理
`initLifecycle`将父子组件关系初始化，使父子指针正确指向，同时初始化实例的子组件数组，引用数组，初始化生命周期状态变量
`initEvents`初始化父子组件的事件绑定  
<!-- todo -->
`initRender`初始化组件的插槽，同时为实例提供`$createElement`方法，也就是组件`render`的参数`h`
当这三个方法执行完成后，会调用`beferCreate`钩子
接着会调用`initInjections`,`initState`,`initProvide`进行数据初始化，之后调用`created`钩子
最后判断配置中是否有`el`配置，有则挂载到对应的DOM上

`stateMixin`处理了数据问题，为Vue的原型添加了`$data`,`$props`代理，在原型上添加`$set`,`$delete`和`$watch`方法

`eventMixin`为原型添加了`$on`,`$once`,`$off`,`$emit`方法

`lifecycleMixin`为原型添加了`_update`,`$forceUpdate`,`$destory`方法

`renderMixin`为原型绑定了`renderHelpers`，添加了`$nextTick`和`_render`方法
<!-- todo  这部分的详细解析会在之后补充 -->


### 总结
本节了解了Vue构造函数的定义以及Vue原型方法的初始化过程，这些过程只到‘beforeMount’之前
