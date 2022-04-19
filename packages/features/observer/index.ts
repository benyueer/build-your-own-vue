import { computed } from "./computed"
import { effect } from "./effect"
import { reactive } from "./reactive"
import { watch } from "./watchApi"

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

// computedTest()

function watchTest() {
  const state: any = reactive({
    msg: 'data1'
  })

  let changeData = ''

  watch(
    () => state.msg,
    (val, old) => {
      changeData = val
    }
  )

  state.msg = 'data2'
  console.log(changeData)
}

watchTest()