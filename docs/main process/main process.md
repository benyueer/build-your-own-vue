## 本节先梳理一下Vue应用的主题流程
一般我们在使用Vue时，会使用如下代码挂载Vue应用：
```js
new Vue({
  render: h => h(App),
}).$mount('#app')
```
该代码先是新建了一个Vue实例，传入了`render`方法，然后调用`$mount`方法将该实例挂载到`#app`的`DOM`上
我们可以从`$mount`方法入手，了解整个过程

### mount

在此之前我们要先找到Vue的入口，打开`package.json`，可以看到其配置：
```json
"main": "dist/vue.runtime.common.js",
"module": "dist/vue.runtime.esm.js",
"unpkg": "dist/vue.js",
```
其中`main`代表`commonJS`规则的包结果，`module`代表`ESM`的包结果，当然，这两个都是打包后的代码，并不能体现源码结构，那我们就需要从打包配置下手，打开`scripts/config.js`文件，这是`rollup`的配置，找到`builds`属性，保存了各个模式下的入口位置，其中分为`runtime`和`full`还有`ssr`等模式，我们主要看的就是`full`版本，也叫`compilre`版本，他比`runtime`多了模版编译等功能，我们在日常开发中大多使用`vue-loader`等插件完成了模版编译，只要安装`runtime`版本即可，体积小30%，但有些特殊情况例如这些插件处理不到的地方时，会报警告，提示我们使用`compiler`。
回到正题，我们可以从`web-full`的相关配置中找到入口，为：`web/entry-runtime-with-compiler.js`


在`src/platforms/web/entry-runtime-with-compiler.js`文件中定义了`$mount`方法(只取主要代码)：
```js
const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)
  const options = this.$options
  if (!options.render) {
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
        }
      } else if (template.nodeType) {
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      template = getOuterHTML(el)
    }
    if (template) {
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns
    }
  }
  return mount.call(this, el, hydrating)
}
```
这里先是保存了旧的`mount`方法，然后定义了新的，新方法接收两个参数：`el`、`hydrating`
`el`是要挂载的`DOM`可以是真实`DOM`也可以是`query`信息
`hydrating`时服务端渲染的配置，暂时不用关心
新的`mount`会检查配置中有没有`render`函数，如果有则直接调用旧的`mount`挂载应用，如果没有就会检查`template`，`template`可以是模版字符串，也可以是真实DOM，如果都没配置就会使用`el`属性的`outerHTML`(序列化HTML片段，也就是字符串)；检查完`template`后，会使用模版编辑得到相应的`render`函数，编译过程会在`Compiler`章节讲解

这就是新的`mount`方法，那么被缓存的旧方法做了什么呢

打开`src/platforms/web/runtime/index.js`文件，其中有旧方法的定义：
```js
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}
```


调用了`mountComponent`，该方法在`src/core/instance/lifecycle.js`中定义：
```js
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  vm.$el = el

  callHook(vm, 'beforeMount')

  let updateComponent = () => {
    vm._update(vm._render(), hydrating)
  }

  new Watcher(vm, updateComponent, noop, {
    before () {
      if (vm._isMounted && !vm._isDestroyed) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)
  hydrating = false

  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}
```

`mountComponent`调用了组件的生命周期钩子，然后定义了一个`updateComponent`方法作为渲染`Watcher`的回调(有关`Watcher`等响应式原理会在`Observer`章节讲解)，`updateComponent`调用了实例的`_update`方法，并传入了`render`函数的结果，`_update`同样在`src/core/instance/lifecycle.js`文件中，该文件的`lifecycleMixin`方法为`Vue`的原型添加了`_update`,`$forceUpdate`,`$destory`方法
让我们看看`_update`的定义：
```js
Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
  const vm: Component = this
  const prevEl = vm.$el
  const prevVnode = vm._vnode
  const restoreActiveInstance = setActiveInstance(vm)
  vm._vnode = vnode
  // Vue.prototype.__patch__ is injected in entry points
  // based on the rendering backend used.
  if (!prevVnode) {
    // initial render
    vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
  } else {
    // updates
    vm.$el = vm.__patch__(prevVnode, vnode)
  }
  restoreActiveInstance()
  // update __vue__ reference
  if (prevEl) {
    prevEl.__vue__ = null
  }
  if (vm.$el) {
    vm.$el.__vue__ = vm
  }
  // if parent is an HOC, update its $el as well
  if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
    vm.$parent.$el = vm.$el
  }
  // updated hook is called by the scheduler to ensure that children are
  // updated in a parent's updated hook.
}
```
该函数首先设置`ActiveInstance`，这在diff过程中会用到，然后调用`__patch__`比较新旧DOM，也就是diff算法，diff结束后会`restoreActiveInstance`,修复diff中修改掉的`instance`(目前在`translation-group`中做了修改)；最后更新相关属性指向，对高阶组件进行处理

接下来就是vue的diff过程，会在diff章节讲解

### 总结
本节从`mount`方法出发，描述了vue通过模版生成vNode，到diff后生成新的节点的过程

