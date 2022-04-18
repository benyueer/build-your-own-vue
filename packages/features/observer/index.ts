import { computed } from "./computed"
import { effect } from "./effect"
import { reactive } from "./reactive"

function computedTest() {
  const state: any = reactive({ msg: 'hello' })

  const str = computed(() => {
    return `${state.msg} world`
  })

  let render = ''
  // console.log(str.value)
  const fn = () => {
    render = `${str.value}`
    console.log('fn')
  }

  effect(fn)

  state.msg = 'hello world'
  console.log(render)
}

computedTest()