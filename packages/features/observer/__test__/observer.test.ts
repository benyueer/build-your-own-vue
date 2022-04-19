import { computed } from "../computed";
import { effect } from "../effect";
import { reactive } from "../reactive";
import { watch } from "../watchApi";

describe('observer', () => {
  it('reactive', () => {
    const state: any = reactive<{name: string}>({
      name: '张三',
      data: {
        age: 18
      }
    })
    const fn = jest.fn(() => {
      return state.name + state.data.age
    })

    const effectFn = effect(fn)
    // effectFn()

    // state.name = '李四'
    // state.name = '王五'
    state.data.age = 20
    state.data.age = 30


    expect(fn).toBeCalledTimes(3);
  });

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

  it('watch', () => {
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

    expect(changeData).toBe('data2')
  })
})