<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	function handleSignIn() {
		dispatch('signIn');
		// This function will be called when the user clicks "Start Chatting"
		// The actual sign-in logic will be handled by the parent component (+page.svelte)
		// which listens for the 'signIn' event.
	}
</script>

	<button
		on:click={handleSignIn}
		class="bg-gray-900 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-full transition-colors text-lg"
	>
		Start Chatting
	</button>