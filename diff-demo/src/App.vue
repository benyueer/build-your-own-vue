<script setup lang="ts">
import { reactive } from 'vue';
import Item from './item.vue'
import Count from './count.vue'

const state = reactive({
  value: '',
  data: [
    {
      id: 1,
      msg: 'hello',
    },
    {
      id: 2,
      msg: 'world',
    },
    {
      id: 3,
      msg: 'yes',
    },
  ]
})

const addItem = () => {
  state.data.push({
    id: parseInt(Math.random() + ''),
    msg: state.value
  })

  state.value = ''
}
</script>

<template>
  <div>
    <Count />
    <Item :msg="state.value" />
    <div v-for="item in state.data" :key="item.id">
      <Item :msg="item.msg"></Item>
    </div>
    <input type="text" v-model="state.value">
    <button @click="addItem">add</button>
  </div>
</template>

