import {reactive, computed, effect} from 'vue'

describe('vue', () => {
  it('computed', () => {
    const state: any = reactive({msg: 'hello'})

    const str = computed(() => {
      return `${state.msg} world`
    })

    let render = ''
    effect(() => (render = `${str.value}`))

    state.msg = 'hello world'

    expect(render).toBe('hello world world')
  })
})