import {reactive, computed, effect } from 'vue'

function computedTest() {
  const state: any = reactive({ msg: 'hello' })

  const str = computed(() => {
    return `${state.msg} world`
  })

  let render = ''
  const fn = () => {
    render = `${str.value}`
    console.log('fn')
  }
    
  effect(fn)

  state.msg = 'hello world'
  console.log(render, str.value)
}

computedTest()