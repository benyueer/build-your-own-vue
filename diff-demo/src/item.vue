<template>
  <p>{{ msg }}</p>
</template>
<script>
import {defineComponent} from 'vue'
export default defineComponent({
  props: ['msg']
})
</script>