<script lang="ts">
	import '../app.css';
    import { firebaseClient } from '$lib/Firebase/firebase.svelte';
    import { onMount } from 'svelte';

	let { children } = $props();

    const firebase = firebaseClient();

    onMount(() => {
        firebase.clientInit(() => {});
    });
</script>

{@render children()}
