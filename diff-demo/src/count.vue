<template>
  <p>
    count: {{ state.count }}
  </p>
  <button @click="add">add</button>
</template>
<script>
import {defineComponent, reactive} from 'vue'
export default defineComponent({
  setup() {
    const state = reactive({
      count: 0
    })

    const add = () => {
      state.count++
    }

    return {
      state,
      add
    }
  }
})
</script>