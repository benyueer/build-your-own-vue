### 模版编译
找到`compiler`版本的代码：
```js
const { render, staticRenderFns } = compileToFunctions(template, {
  outputSourceRange: process.env.NODE_ENV !== 'production',
  shouldDecodeNewlines,
  shouldDecodeNewlinesForHref,
  delimiters: options.delimiters,
  comments: options.comments
}, this)
```
`render`函数通过`compileToFunctions`得到，这个函数的第一个参数为`template`，是代表模版的字符串，第二个参数为基本配置，之后会展开说明，第三个参数是当前组件实例

`compileToFunctions`的定义在`src/platforms/web/compiler/index.js`
```js
import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
```
`createCompiler`接受一个参数`baseOptions`
```js
import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,
  directives,
  isPreTag,
  isUnaryTag,
  mustUseProp,
  canBeLeftOpenTag,
  isReservedTag,
  getTagNamespace,
  staticKeys: genStaticKeys(modules)
}
```
这会在使用的时候讲到

那么`createCompiler`函数是什么样的呢？他定义在`src/compiler/index.js`:
```js
import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
```
可以看到`createCompiler`函数是`createCompilerCreator`函数的返回值，`createCompilerCreator`函数有一个名为`baseCompile`的函数作为参数
`baseCompile`接收两个参数：`template`-模版字符串和`options`编译配置，然后通过`parse`得到`ast`，然后优化`ast`，最后通过`generate`得到`render函数`

找到`createCompilerCreator`的代码，在`src/compiler/create-compiler.js`:
```js
import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

export function createCompilerCreator (baseCompile: Function): Function {
  return function createCompiler (baseOptions: CompilerOptions) {
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []

      let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg)
      }

      if (options) {
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      finalOptions.warn = warn

      const compiled = baseCompile(template.trim(), finalOptions)
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
```
`createCompilerCreator`函数的返回值就是真正的`createCompiler`
创建`baseCompiler`函数这一段比较绕，初看可能会有点迷糊，这么做的原因是为了兼容不同平台的`baseOptions`，我们只要把这里的`baseCompiler`替换掉外层的同名函数绕过这一段逻辑就能清晰很多

`createCompiler`的返回值包括两个属性：`compile`函数和通过`createCompileToFunctionFn`处理过的`compile`函数

`createCompileToFunctionFn`的定义在`src/compiler/to-function.js`:
```js
export function createCompileToFunctionFn (compile: Function): Function {
  const cache = Object.create(null)

  return function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    options = extend({}, options)
    const warn = options.warn || baseWarn
    delete options.warn


    // check cache
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    if (cache[key]) {
      return cache[key]
    }

    // compile
    const compiled = compile(template, options)

    // turn code into functions
    const res = {}
    const fnGenErrors = []
    res.render = createFunction(compiled.render, fnGenErrors)
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    return (cache[key] = res)
  }
}
```
这是因为默认的`render`是一个字符串，`to-function`将其转换为`render`函数，还做了缓存优化
`createFunction`只是新建了一个函数
```js
function createFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}
```
<img src="../imgs/render-to-function.png">
可以看到`render`的区别

回到`compile`函数，前半部分合并配置得到`finalOptions`，然后执行`baseCompile`得到编译结果并返回
`baseCompile`之前已经简单的分析过，主要就进行了三步操作：
1. 解析模版字符串获得抽象语法树
2. 优化语法树
3. 生成代码

接下来分析这几个步骤

### parser  template -> AST
vue实际上参考了`htmlparser`这个库进行`AST`转换，这个过程还是比较复杂的，我写了一个简单版本，可以访问`html-parser`这个仓库查看

在开始前我们要先知道`parser`需要转换的两部分是什么：
- `template`很好理解，就是代表`HTML`的模版，甚至可以直接理解为`HTML`
- `AST`是*抽象语法树*的缩写，用来描述一个`HTML`是什么样的，这可能和`vDom`有点像，但要更原始；在Vue中，AST的基本属性包括`tag, type, attrs, if, for, children, parent, text`，通过这些属性，能够生成`render`函数然后得到虚拟DOM

怎么得到`AST`呢？实现如下：

通过`parse`函数得到最终结果

`parse`定义在`src/compiler/parser/index.js`(由于这部分代码很长，都贴出来反而不利于理解，请自己打开源码查看)

(完整代码里先进行配置合并，然后定义基本工具函数)；可以看到`parse`调用了`parseHTML`函数并传入了`start, end, chars, comment`方法
这4个方法分别处理开始标签、结束标签、字符和注释

找到`parseHTML`函数的定义`src/compiler/parser/html-parser.js`


<!-- todo -->


经过完整的`parse`过程后，将`template`转化为`ast`对象，例如：
```js
  `
    <div v-if="isShow">
      <p v-highlight="code"></p>
      <ul>
        <li v-for="msg of list">{{msg}}</li>
      </ul>
    </div>
  `
  // 会被转换为：
  {
    tag: 'div',
    type: 1,
    attrsList: [],
    attrsMap: {
      v-if: 'isShow'
    },
    children: [
      {
        tag: 'p',
        type: 1,
        attrsList: [
          {
            name: 'v-highlight',
            value: 'code'
          }
        ],
        attrsMap: {
          v-highlight: 'code'
        },
        directives: [
          {
            arg: null,
            isDynamicArg: false,
            modifiers: undefined,
            name: "highlight",
            rawName: "v-highlight",
            value: "code"
          }
        ],
        hasBindings: true,
        parent: '',
        rawAttrsMap: {
          v-highlight: {
            name: "v-highlight",
            value: "code"
          }
        }
      },
      {
        text: " ",
        type: 3
      },
      {
        tag: "ul",
        type: 1,
        // ...
        children: [
          {
            tag: "li",
            type: 1,
            for: "list",
            alias: "msg",
            attrsMap: {v-for: 'msg of list'},
            children:[
              type: 2,
              text: "{{msg}}",
              tokens: {@binding: 'msg'},
              expression: "_s(msg)",
            ]
          }
        ]
      }
    ],
    if: 'isShow',
    ifConditions: [{
      exp: 'isShow',
      block: // this element
    }],
    parent: undefined,
    plain: true,
    rowAttrsMap: {
      v-if: {
        name: 'v-if',
        value: 'isShow'
      }
    }
  }
```


### optimize
为什么需要优化？有些节点是静态的，渲染之后不会发生变化，因此在比较时可以跳过他们
代码在：`src/compiler/optimizer.js`
```js
export function optimize (root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  markStatic(root)
  // second pass: mark static roots.
  markStaticRoots(root, false)
}
```
优化过程就做两件事：标记静态节点、标记静态根

#### 标记静态节点
```js
function markStatic (node: ASTNode) {
  node.static = isStatic(node)
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) {
        node.static = false
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}
```
首先会执行`isStatic`方法，定义为：
```js
function isStatic (node: ASTNode): boolean {
  if (node.type === 2) { // expression
    return false
  }
  if (node.type === 3) { // text
    return true
  }
  return !!(node.pre || (
    !node.hasBindings && // no dynamic bindings
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) &&
    Object.keys(node).every(isStaticKey)
  ))
}
```
表达式会置为`false`，文本为`true`，之后的条件为`pre`指令为`true`，动态绑定、`v-if, v-for`等都为`false`

然后`node.type === 1`的情况（普通元素），会遍历所有子节点，递归调用`makeStatic`，如果子节点为非静态的则修改父节点
因为`else, else-if`不在`children`中，所以还要遍历`ifConditions`，与子节点逻辑相同

#### 标记静态根
```js
function markStaticRoots (node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}
```
正如注释中所说：能成为静态根的节点，必须本身是静态节点，且子节点不能只是文本节点，否则收益很小

经过优化后，节点有了`static, staticRoot`两个属性，这两个属性标记了节点的静态属性，会影响`render`代码的产生


### codegen
`codegen`就是把`AST`转换为`render`函数的代码，这个过程也比较复杂

首先从一个最简单的例子看起，一个模版`<div></div>`的`AST`为：
```js
{
  tag: 'div",
  children: [],
  type: 1,
  // ...
}
```
那么这个`AST`在`codegen`的过程中是什么样的呢？
首先会进入`generate`函数：
```js
export function generate (
  ast: ASTElement | void,
  options: CompilerOptions
): CodegenResult {
  const state = new CodegenState(options)
  // fix #11483, Root level <script> tags should not be rendered.
  const code = ast ? (ast.tag === 'script' ? 'null' : genElement(ast, state)) : '_c("div")'
  return {
    render: `with(this){return ${code}}`,
    staticRenderFns: state.staticRenderFns
  }
}
```
然后会执行`genElement`(该部分代码较长，请自行查看)
会走到`genChildren`,因为该模版没有children，会返回undefined
最后生成的`code`为：
```js
code = `_c('${el.tag}'${
        data ? `,${data}` : '' // data
      }${
        children ? `,${children}` : '' // children
      })`
```
翻译过来就是：
```js
_c('div')
```
这个`_c`是`createElement`函数的封装，定义在`src/core/instance/render.js`
类似的其他方法还有：
```js
export function installRenderHelpers (target: any) {
  target._o = markOnce
  target._n = toNumber
  target._s = toString
  target._l = renderList
  target._t = renderSlot
  target._q = looseEqual
  target._i = looseIndexOf
  target._m = renderStatic
  target._f = resolveFilter
  target._k = checkKeyCodes
  target._b = bindObjectProps
  target._v = createTextVNode
  target._e = createEmptyVNode
  target._u = resolveScopedSlots
  target._g = bindObjectListeners
  target._d = bindDynamicKeys
  target._p = prependModifier
}
```

再来看看`codegen`的详细过程：
`codegen`的主体就是`generate`函数，`generate`的过程会根据`AST`的属性分别调用不同的方法，主要有`genStatic, genOnce, genFor, genIf, genChildren, genSlot, genComponent, genData`等方法，接下来一一解释这些方法的场景和作用

第一个就是`genStatic`，会处理“静态根”节点

`genOnce`处理`v-once`指令的节点（只渲染一次，之后的渲染会视为静态节点并跳过）

`genFor`处理`v-for`指令

`genIf`处理`v-if`指令

`genChildren`处理子节点或者`template`节点

`genSlot`处理`slot`

`genComponent`处理组件节点

这些方法并不是单独运行的，像`genChildren`会被其他函数调用，而有些方法又会递归调用`genElement`





```js


template: `
    <div v-if="isShow">
      <p v-highlight="code"></p>
      <ul>
        <li v-for="msg of list">this is {{msg}}</li>
      </ul>
      <Comp>
      </Comp>
    </div>
  `,

with(this){
  return (isShow)
    ?
      _c(
        'div',
        [
          _c(
            'p',
            {
              directives:[
                {
                  name:"highlight",
                  rawName:"v-highlight",
                  value:(code),
                  expression:"code"
                }
              ]
            }
          ),
          _v(" "),
          _c(
            'ul',
            _l(
              (list),
              function(msg){
                return _c(
                  'li',
                  [
                    _v("this is "+_s(msg))
                  ]
                )
              }
            ),
            0
          ),
          _v(" "),
          _c('Comp')
        ],
        1
      )
    :
      _e()
  }
```