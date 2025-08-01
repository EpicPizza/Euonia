<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { systemMessage } from '$lib/stores/systemMessage';

  const dispatch = createEventDispatcher();

  let message: string;
  systemMessage.subscribe(value => {
    message = value;
  });

  function handleSave() {
    systemMessage.set(message);
    dispatch('close');
  }
</script>

<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
  <div class="bg-white p-8 rounded-lg shadow-lg w-1/2">
    <h2 class="text-2xl font-bold mb-4">Edit System Message</h2>
    <textarea bind:value={message} class="w-full h-64 p-2 border rounded"></textarea>
    <div class="flex justify-end mt-4">
      <button on:click={handleSave} class="bg-blue-500 text-white px-4 py-2 rounded">Save</button>
      <button on:click={() => dispatch('close')} class="ml-2 bg-gray-300 px-4 py-2 rounded">Cancel</button>
    </div>
  </div>
</div>
