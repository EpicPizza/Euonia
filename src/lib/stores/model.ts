import { writable } from 'svelte/store';

export const selectedModel = writable<string>("mistralai/mistral-nemotron");