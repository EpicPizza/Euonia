<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { selectedModel } from '$lib/stores/model';

	const dispatch = createEventDispatcher();

	function closeModal() {
		dispatch('close');
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	on:click={closeModal}
>
	<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" on:click|stopPropagation>
		<h2 class="mb-4 text-lg font-semibold">Select a Model</h2>
		<input type="text" class="w-full rounded-md border border-gray-300 p-2" bind:value={$selectedModel} />
		<div class="mt-4 flex justify-end">
			<button
				on:click={closeModal}
				class="rounded-full bg-gray-200 px-4 py-2 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-300"
			>
				Close
			</button>
		</div>
	</div>
</div>
