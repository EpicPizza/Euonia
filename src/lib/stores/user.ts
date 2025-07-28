import { writable } from 'svelte/store';
import type { User } from 'firebase/auth';

export const user = writable<User | null | undefined>(undefined);
