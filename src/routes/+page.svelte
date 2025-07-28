<script lang="ts">
	import { tick } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { user } from '$lib/stores/user';
	import { firebaseClient } from '$lib/Firebase/firebase.svelte';
	import { onSnapshot, doc } from 'firebase/firestore';
	import OpenAI from 'openai';
	import AuthDialog from '$lib/components/AuthDialog.svelte';
	export let data;

	let userInput = '';
	$: messages = [] as any;
	$: goals = data.goals;
	let loading = false;
	let chatContainer: HTMLDivElement;
	const firebase = firebaseClient();

	async function scrollToBottom() {
		await tick();
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	$: if (messages) {
		scrollToBottom();
	}

	async function handleRefresh() {
		await goto("/", { replaceState: true });
		
		await invalidateAll();

	}

	async function handleSend() {
		if (!userInput.trim()) return;

		const currentMessage = userInput;
		messages = [...messages, { role: 'user', text: currentMessage }];
		userInput = '';
		loading = true;

		console.log(currentMessage);

		await fetch('/', {
			method: 'POST',
			body: JSON.stringify({ message: currentMessage}),
		});

		loading = false;
	}

	$: if ($user && data.sessionId) {
		const db = firebase.getFirestore();
		const sessionRef = doc(db, 'chats', data.sessionId);
		onSnapshot(sessionRef, (doc) => {
			if (doc.exists()) {
				const sessionData = doc.data();
				messages = sessionData.interactions.flatMap((interaction: OpenAI.Chat.Completions.ChatCompletionMessage) => {
					const newMessages = [];

                    //@ts-expect-error
					if (interaction.role === 'tool') {
						const toolContent = typeof interaction.content === 'string' ? interaction.content.trim() : '';
						if (toolContent) {
							newMessages.push({
								role: 'tool',
								text: `Tool Output: ${toolContent}`
							});
						}
					} else if (interaction.tool_calls && interaction.tool_calls.length > 0) {
						// This is an assistant message that calls a tool
						interaction.tool_calls.forEach(toolCall => {
							newMessages.push({
								role: 'assistant', // Display as assistant message, but indicate tool call
								text: `Calling ${toolCall.function.name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}`
							});
						});
						const assistantContent = typeof interaction.content === 'string' ? interaction.content.trim() : '';
						if (assistantContent) { // Also include any content from the assistant message
							newMessages.push({
								role: interaction.role,
								text: assistantContent
							});
						}
					} else {
						// Regular user or assistant message with content
						const messageContent = typeof interaction.content === 'string' ? interaction.content.trim() : '';
						if (messageContent) {
							newMessages.push({
								role: interaction.role,
								text: messageContent
							});
						}
					}
					return newMessages;
				}).filter((i: undefined) => i != undefined).filter((interaction: { text: string }) => interaction.text.trim() !== '');
			}
		});
	}
</script>

{#if $user}
<div class="bg-[#FEF6EB] text-[#2C3E2F] h-screen p-6 font-poppins">
	<div class="max-w-7xl mx-auto h-full flex gap-8"> 
		<div class="w-2/3 h-full flex flex-col">
		<!-- Top Bar -->
		<header class="mb-6">
			<div class="relative border-none rounded-2xl p-4 text-left bg-white shadow-md">
				<h1 class="text-md sm:text-2xl font-semibold text-[#2C3E2F] font-eb-garamond">
					Eunoia
				</h1>
				<button on:click={handleRefresh} class="absolute top-1/2 right-3 -translate-y-1/2 text-[#2C3E2F] hover:text-gray-700 transition-colors" aria-label="Refresh chat">
					Refresh
				</button>
			</div>
		</header>

		<!-- Main Content -->
		<main class="flex-grow flex flex-col gap-6 min-h-0">
			<!-- Chat Display -->
			<div bind:this={chatContainer} class="border-none rounded-2xl flex-grow flex flex-col p-6 bg-white shadow-md overflow-y-auto">
				{#if messages.length > 0}
				<div class="flex-grow space-y-4">
										{#each messages as message}
						{#if message.text.trim() !== ''}
							{#if message.role === 'tool'}
								<div class="flex justify-center">
									<div class="rounded-lg px-6 py-3 max-w-xs lg:max-w-md bg-gray-100 text-gray-600 italic text-sm text-center">
										{#if message.text.startsWith("Tool Output: [")}
											{@const goals = JSON.parse(message.text.replace("Tool Output: ", ""))}
											{#if goals.length > 0}
												<p>Your goals:</p>
												<ul>
													{#each goals as goal}
														<li>- {goal.name}</li>
													{/each}
												</ul>
											{:else}
												<p>No goals found for the specified period.</p>
											{/if}
										{:else}
											{message.text}
										{/if}
									</div>
								</div>
							{:else}
								<div class="flex" class:justify-end={message.role === 'user'}>
									<div
										class="rounded-lg px-6 py-3 max-w-xs lg:max-w-md"
										class:bg-[#2C3E2F]={message.role === 'user'}
										class:text-white={message.role === 'user'}
										class:bg-[#F9F7F2]={message.role === 'assistant'}
										class:text-[#2C3E2F]={message.role === 'assistant'}
									>
										{message.text}
									</div>
								</div>
							{/if}
						{/if}
					{/each}
					{#if loading}
						<div class="flex justify-start">
							<div class="rounded-lg px-4 py-2 bg-[#F9F7F2] text-[#2C3E2F] font-eb-garamond">
								Thinking...
							</div>
						</div>
					{/if}
				</div>
				{:else}
				<div class="flex-grow flex items-center justify-center">
					<p class="text-[#2C3E2F] opacity-70 font-eb-garamond">Start the conversation by sending a message.</p>
				</div>
				{/if}
			</div>
			<!-- Chat Input -->
			<div class="relative flex gap-2 items-center flex-shrink-0">
				<input
					bind:value={userInput}
					on:keydown={(e) => e.key === 'Enter' && handleSend()}
					type="text"
					placeholder="Type your message..."
					class="w-full bg-white border-2 border-[#2C3E2F] rounded-full p-3 focus:outline-none focus:ring-0 focus:border-[#2C3E2F] shadow-sm text-[#2C3E2F] placeholder:text-gray-500"
					disabled={!$user}
				/>
				<button
				on:click={handleSend}
					class="bg-[#2C3E2F] hover:bg-[#1a2a1c] text-white p-3 rounded-full transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
					disabled={!userInput.trim() || loading || !$user}
					aria-label="Send message"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
					</svg>
				</button>
			</div>
		</main>
		</div>

		<!-- Goals Sidebar -->
		<aside class="w-1/3 h-full flex flex-col bg-white rounded-2xl shadow-md border-none">
			<header class="p-6 border-b border-gray-200">
				<h2 class="text-lg font-semibold text-[#2C3E2F] font-eb-garamond">My Goals</h2>
			</header>
			<div class="flex-grow p-6 overflow-y-auto">
				<div class="space-y-6">
					{#each goals as goal}
						<div class="p-6 rounded-lg bg-[#F9F7F2]">
							<h3 class="font-bold text-md text-[#2C3E2F]">{goal.name}</h3>
							<p class="text-sm text-[#2C3E2F] mt-1">{goal.description}</p>
							<div class="mt-2 text-xs flex justify-between">
								<span class="font-semibold text-[#2C3E2F]">Priority: {goal.priority}</span>
								<span class="text-gray-500">Deadline: {goal.deadline}</span>
							</div>
						</div>
					{:else}
						<p class="text-[#2C3E2F] opacity-70">You have no goals set. Let's create some!</p>
					{/each}
				</div>
			</div>
		</aside>
	</div>
</div>
{:else}
<div class="landing-page-container">
    <div class="card top-left">
        <span class="label">Vent</span>
        <div class="card-content">
            <img src="/vent.png" alt="Vent" class="card-image">
        </div>
    </div>
    
    <div class="card top-right">
        <span class="label">Talk</span>
        <div class="card-content">
            <img src="/talk.png" alt="Talk" class="card-image">
        </div>
    </div>

    <div class="card middle-left">
        <span class="label">Plan</span>
        <div class="card-content">
            <img src="/plan.png" alt="Plan" class="card-image">
        </div>
    </div>

    <div class="card middle-right">
        <span class="label">Journal</span>
        <div class="card-content">
            <img src="/journal.png" alt="Journal" class="card-image">
        </div>
    </div>

    <div class="main-title">
        <h1>Grow</h1>
        <h2>with Eunoia</h2>
    </div>
    
    <div class="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
        <AuthDialog on:signIn={() => firebase.signInAnonymouslyAndListen()} />
    </div>

    <div class="card bottom-left">
        <span class="label">Ideate</span>
        <div class="card-content">
            <img src="/ideate.png" alt="Ideate" class="card-image">
        </div>
    </div>
    
    <div class="card bottom-right">
        <span class="label">Heal</span>
        <div class="card-content">
            <img src="/heal.png" alt="Heal" class="card-image">
        </div>
    </div>

    <div class="card left-extra">
        <span class="label">Advice</span>
        <div class="card-content">
            <img src="/advise.png" alt="Advice" class="card-image">
        </div>
    </div>
</div>
{/if}

<style>
	/* Custom scrollbar for webkit browsers */
	.overflow-y-auto::-webkit-scrollbar {
		width: 8px;
	}

	.overflow-y-auto::-webkit-scrollbar-track {
		background: #f1f1f1;
		border-radius: 10px;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb {
		background: #888;
		border-radius: 10px;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb:hover {
		background: #555;
	}

	/* Custom scrollbar for firefox */
	.overflow-y-auto {
		scrollbar-width: thin;
		scrollbar-color: #888 #f1f1f1;
	}

	.font-eb-garamond {
		font-family: 'EB Garamond', serif;
	}

/* Card Styles */
.card {
    background-color: #ffffff;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); /* Lighter shadow */
    overflow: hidden;
    position: absolute;
    width: 180px;
    height: 150px;
    border: none; /* Removed border to match reference image */
    display: flex;
    flex-direction: column;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

/* Card positioning - spread randomly around the page without overlapping */
.card.top-left {
    top: 50px;
    left: 50px;
}

.card.top-right {
    top: 50px;
    right: 50px;
}

.card.middle-left {
    top: 45%; 
    left: 60px;
}

.card.middle-right {
    top: 30%;
    right: 80px;
}

.card.bottom-left {
    bottom: 150px;
    left: 150px;
}

.card.bottom-right {
    bottom: 120px;
    right: 180px;
}

.card.left-extra {
    left: 250px;
    top: 15%;
}

.card.right-extra {
    right: 250px;
    bottom: 35%;
}

.card-content {
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
}

.placeholder {
    font-family: 'Playfair Display', serif;
    font-style: italic;
    color: #2C3E2F;
    opacity: 0.6;
    font-size: 24px;
}

.card-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
    transition: transform 0.3s ease;
}

.card:hover .card-image {
    transform: scale(1.05);
}

.label {
    position: absolute;
    top: 12px;
    right: 12px;
    background-color: #f9f7f2; /* Light cream background for labels */
    color: #2C3E2F;
    padding: 4px 12px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 12px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05); /* Lighter shadow */
    z-index: 2;
    font-family: 'Poppins', sans-serif;
}

/* Main Title Styles */
.main-title {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    width: 300px; /* Slightly wider to accommodate text */
    z-index: 10; /* Ensure title is above cards */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.main-title h1 {
    font-family: 'EB Garamond', serif; /* More elegant serif font that matches reference */
    font-size: 74px; /* Larger font size */
    font-weight: 500;
    color: #2C3E2F;
    margin-bottom: 0;
    line-height: 0.9;
}

.main-title h2 {
    font-family: 'EB Garamond', serif; /* Matching font */
    font-size: 36px; 
    font-weight: 400;
    color: #2C3E2F;
    opacity: 0.9;
    font-style: italic;
}

/* Name Input Styles */
.name-input {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center; /* Center align the contents */
    gap: 15px;
    z-index: 20; /* Ensure it's above cards */
    width: 300px; /* Match the main title width */
    margin: 0 auto; /* Center horizontally */
}

.name-input input {
    width: 220px;
    font-size: 16px;
    border-radius: 100px;
    border: 2px solid #2C3E2F;
    font-family: 'Poppins', sans-serif;
    color: #2C3E2F;
    text-align: center;
    outline: none;
    transition: box-shadow 0.3s ease;
    position: relative; /* Add this */
    margin: 0 auto; /* Center horizontally */
}

.name-input input:focus {
    box-shadow: 0 0 0 3px rgba(44, 62, 47, 0.1); /* Lighter focus effect */
    transform: none; /* Prevent any movement on focus */
}

.name-input input::placeholder {
    color: rgba(44, 62, 47, 0.5);
}

/* Arrow Button Styles */
.arrow-button {
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 40px; /* Fixed width */
    height: 40px;
    background-color: #2C3E2F;
    color: #ffffff;
    border-radius: 50%;
    text-decoration: none;
    transition: transform 0.3s ease, background-color 0.3s ease;
    flex-shrink: 0; /* Prevent shrinking */
}

.arrow-button:hover {
    transform: translateX(5px);
    background-color: #1a2a1c;
}

/* Create a centered container for better layout */
.content-wrapper {
    position: relative;
    width: 100vw;
    height: 100vh;
    max-width: 1400px;
    margin: 0 auto;
}

/* Responsive Styles */
@media (max-width: 1400px) {
    .card {
        width: 160px;
        height: 140px;
    }
    
    .card.top-left {
        top: 60px;
        left: 60px;
    }
    
    .card.top-right {
        top: 60px;
        right: 60px;
    }
    
    .card.middle-left {
        top: 42%;
        left: 100px;
    }
    
    .card.middle-right {
        top: 38%;
        right: 100px;
    }
    
    .card.bottom-left {
        bottom: 80px;
        left: 80px;
    }
    
    .card.bottom-right {
        bottom: 80px;
        right: 80px;
    }
    
    .card.left-extra {
        left: 150px;
        top: 22%;
    }
    
    .card.right-extra {
        right: 150px;
        bottom: 28%;
    }
}

@media (max-width: 1024px) {
    body {
        padding: 20px;
    }
    
    .card {
        width: 140px;
        height: 120px;
    }
    
    .main-title h1 {
        font-size: 64px;
    }
    
    .main-title h2 {
        font-size: 32px;
    }
}

@media (max-width: 768px) {
    body {
        padding: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        overflow-y: auto;
        height: auto;
    }
    
    .card {
        position: relative;
        width: 90%;
        max-width: 300px;
        margin: 10px 0;
        top: auto;
        left: auto;
        right: auto;
        bottom: auto;
    }
    
    .main-title {
        position: relative;
        transform: none;
        left: auto;
        top: auto;
        margin: 30px 0;
    }
    
    .name-input {
        position: relative;
        transform: none;
        left: auto;
        bottom: auto;
        margin: 30px 0;
    }
}


	</style>