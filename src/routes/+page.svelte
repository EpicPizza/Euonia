<script lang="ts">
	import { onMount } from 'svelte';
	import { tick } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { user } from '$lib/stores/user';
	import { firebaseClient } from '$lib/Firebase/firebase.svelte';
	import { onSnapshot, doc, type Unsubscribe } from 'firebase/firestore';
	import OpenAI from 'openai';
	import AuthDialog from '$lib/components/AuthDialog.svelte';
    import { pushState } from '$app/navigation';
	import SystemMessageModal from '$lib/components/SystemMessageModal.svelte';
	import { systemMessage } from '$lib/stores/systemMessage';
	import { selectedModel } from '$lib/stores/model';
	import ModelDialog from '$lib/components/ModelDialog.svelte';

	let showModelDialog = false;
	export let data;

	let showSystemMessageModal = false;

	let userInput = '';
	$: messages = [] as any;
	$: goals = data.goals;
	    let loading: { [key: string]: boolean } = {};
	let chatContainer: HTMLDivElement;
	const firebase = firebaseClient();
	let chats: any[] = [];
	let editingChatId: string | null = null;
	let newChatName = '';

	let chatHistoryCollapsed = false;
	let goalsCollapsed = false;

	function getFormattedDate() {
		const date = new Date();
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const month = months[date.getMonth()];
		const day = date.getDate();
		const year = date.getFullYear().toString().slice(-2);
		return `${month} ${day}, ${year} Entry`;
	}

	let ran = false;

	$: {
		if ($user && ran == false) {
			(async () => {
				ran = true;
                chats = await firebase.getChats($user.uid);
                if (!data.sessionId) {
                    data.sessionId = chats[0].id;
                    pushState(`/?chatId=${chats[0].id}`, {});
                }
            })();
		}
	};

	async function handleNewChat() {
		if ($user) {
			const newChatId = await firebase.createChat($user.uid, getFormattedDate());
			data.sessionId = newChatId;
			pushState(`/?chatId=${newChatId}`, {});
			chats = await firebase.getChats($user.uid);
		} 
	}

	function handleSelectChat(chatId: string) {
        console.log(chatId);

		data.sessionId = chatId;
		pushState(`/?chatId=${chatId}`, {});
	}

	function handleEditChat(chatId: string) {
		editingChatId = chatId;
		const chat = chats.find(c => c.id === chatId);
		if (chat) {
			newChatName = chat.name;
		}
	}

	function formatDeadline(isoString: string) {
		if (!isoString) return 'No deadline';
		try {
			const date = new Date(isoString);
			return date.toLocaleDateString('en-US', {
				weekday: 'short',
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch (e) {
			return isoString;
		}
	}

	async function handleSaveChatName(chatId: string) {
        if($user == undefined) return;

		if (newChatName.trim()) {
			await firebase.updateChatName(chatId, newChatName);
			editingChatId = null;
			newChatName = '';
			chats = await firebase.getChats($user.uid);
		}
	}

	async function scrollToBottom() {
		await tick();
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	$: if (messages) {
		scrollToBottom();
	}
    
	async function handleSend() {
		if (!userInput.trim()) return;

		const currentMessage = userInput;
		messages = [...messages, { role: 'user', text: currentMessage }];
		userInput = '';
		loading[data.sessionId] = true;

		console.log(currentMessage);

				const result = await fetch('/', {
			method: 'POST',
			body: JSON.stringify({ message: currentMessage, chatId: data.sessionId, systemMessage: $systemMessage, model: $selectedModel }),
		});

        goals = (await result.json()).goals;

		loading[data.sessionId] = false;
	}

    let unsubscribe: undefined | Unsubscribe;

	$: if ($user && data.sessionId) {
		const db = firebase.getFirestore();
		const sessionRef = doc(db, 'chats', data.sessionId);

        if(unsubscribe) unsubscribe();

        console.log(data.sessionId);
		unsubscribe = onSnapshot(sessionRef, (doc) => {
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
								text: assistantContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
							});
						}
					} else {
						// Regular user or assistant message with content
						const messageContent = typeof interaction.content === 'string' ? interaction.content.trim().replace(/<think>[\s\S]*?<\/think>/g, '').trim() : '';
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
<div class="bg-[#F8F3EB] text-[#2C3E2F] h-screen p-6 font-poppins">
	<div class="max-w-full mx-auto h-full flex gap-8" style="display: flex;"> 
		<!-- Journal Entries Sidebar -->
		<aside class="h-full flex flex-col bg-white rounded-2xl shadow-md border-none transition-all duration-300 relative"
			style="width: {chatHistoryCollapsed ? '0px' : '25%'}; min-width: {chatHistoryCollapsed ? '0px' : '200px'}; overflow: {chatHistoryCollapsed ? 'visible' : 'hidden'};"
		>
			<div class="flex-grow p-0 overflow-y-auto">
				<header class="p-6 border-b border-gray-200 flex justify-between items-center">
					<h2 class="text-lg font-semibold text-[#2C3E2F] font-eb-garamond">Journal Entries</h2>
					<div class="flex  items-center gap-2">
						<button on:click={handleNewChat} class="text-gray-500 hover:text-gray-800">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
							</svg>
						</button>
						<button on:click={() => chatHistoryCollapsed = !chatHistoryCollapsed} class="text-gray-500 hover:text-gray-800">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
						</button>
					</div>
				</header>
				<div class="space-y-4 p-6">
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					{#each chats as chat}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div class="p-4 rounded-lg cursor-pointer transition-colors"
							 class:bg-gray-200={data.sessionId === chat.id}
							 class:bg-[#F9F7F2]={data.sessionId !== chat.id}
							 class:hover:bg-gray-300={data.sessionId === chat.id}
							 class:hover:bg-gray-200={data.sessionId !== chat.id}
							 on:click={() => handleSelectChat(chat.id)}>
							{#if editingChatId === chat.id}
								<input type="text" bind:value={newChatName} on:keydown={(e) => e.key === 'Enter' && handleSaveChatName(chat.id)} on:blur={() => handleSaveChatName(chat.id)} class="w-full" />
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							{:else}
                                <div class="flex items-center justify-between">
                                    <h3 class="font-bold text-md text-[#2C3E2F]">{chat.name}</h3>
                                    <div on:click|stopPropagation={() => handleEditChat(chat.id)} class="text-gray-500 hover:text-gray-800">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
                                        </svg>
                                    </div>
                                </div>
							{/if}
							
						</div>
					{/each}
				</div>
			</div>
			{#if chatHistoryCollapsed}
				<button on:click={() => chatHistoryCollapsed = false} class="absolute top-1/2 -right-4 transform -translate-y-1/2 bg-white p-1 rounded-full shadow-md">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			{/if}
		</aside>

		<div class="h-full flex flex-col" style="flex-grow: 1;">
		<!-- Top Bar -->
		<header class="mb-6">
			<div class="relative border-none rounded-2xl p-4 text-left bg-white shadow-md flex justify-between items-center">
				<h1 class="text-md sm:text-2xl font-semibold text-[#2C3E2F] font-eb-garamond">
					Eunoia
				</h1>
				<div>
					<button on:click={() => showModelDialog = true} class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-full transition-colors text-sm mr-2">
						Edit Model
					</button>
					<button on:click={() => showSystemMessageModal = true} class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-full transition-colors text-sm mr-2">
						Edit System Message
					</button>
					<button on:click={() => firebase.signOut()} class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-full transition-colors text-sm">
						Sign Out
					</button>
				</div>
			</div>
		</header>

		{#if showModelDialog}
			<ModelDialog on:close={() => showModelDialog = false} />
		{/if}

		{#if showSystemMessageModal}
			<SystemMessageModal on:close={() => showSystemMessageModal = false} />
		{/if}

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
                                            {@html message.text.replaceAll('\n', '<br>').replaceAll('*', '').replace(/ with ID '[a-zA-Z0-9]+'/, '').replace(/, id: '[a-zA-Z0-9]+'}/g, '}')}
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
										{@html message.text.replaceAll('\n', '<br>').replaceAll('*', '')}
									</div>
								</div>
							{/if}
						{/if}
					{/each}
					{#if loading[data.sessionId]}
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
					disabled={!userInput.trim() || loading[data.sessionId] || !$user}
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
		<aside class="h-full flex flex-col bg-white rounded-2xl shadow-md border-none transition-all duration-300 relative"
			style="width: {goalsCollapsed ? '0px' : '25%'}; min-width: {goalsCollapsed ? '0px' : '200px'}; overflow: {goalsCollapsed ? 'visible' : 'hidden'};"
		>
			<div class="flex-grow p-0 overflow-y-auto">
				<header class="p-6 border-b border-gray-200 flex justify-between items-center">
					<h2 class="text-lg font-semibold text-[#2C3E2F] font-eb-garamond">My Goals</h2>
					<button on:click={() => goalsCollapsed = !goalsCollapsed} class="text-gray-500 hover:text-gray-800">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
					</button>
				</header>
				<div class="space-y-6 p-6">
					{#each goals as goal}
						<div class="p-6 rounded-lg bg-[#F9F7F2]">
							<h3 class="font-bold text-md text-[#2C3E2F]">{goal.name}</h3>
							<p class="text-sm text-[#2C3E2F] mt-1">{goal.description}</p>
							<div class="mt-2 text-xs flex justify-between">
								<span class="font-semibold text-[#2C3E2F]">Priority: {goal.priority}</span>
								<span class="text-gray-500">Deadline: {formatDeadline(goal.deadline)}</span>
							</div>
						</div>
					{:else}
						<p class="text-[#2C3E2F] opacity-70">You have no goals set. Let's create some!</p>
					{/each}
				</div>
			</div>
			{#if goalsCollapsed}
				<button on:click={() => goalsCollapsed = false} class="absolute top-1/2 -left-4 transform -translate-y-1/2 bg-white p-1 rounded-full shadow-md">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
			{/if}
		</aside>
	</div>
</div>
{:else}
<div class="landing-page-container" style="background-color: #F8F3EB; width: 100dvw !important;">
    <div class="card top-left">
        <span class="label">Vent</span>
        <div class="card-content">
            <img src="/vent.png" alt="Vent" class="card-image">
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
    
    <div class="absolute bottom-20 w-fit  left-1/2 sm:-translate-x-1/2 z-10 auth-container">
        <AuthDialog on:signIn={() => firebase.signInWithGoogle()} />
    </div>

    <div class="card bottom-left">
        <span class="label">Ideate</span>
        <div class="card-content">
            <img src="/ideate.png" alt="Ideate" class="card-image">
        </div>
    </div>

    <div class="card left-extra">
        <span class="label">Advise</span>
        <div class="card-content">
            <img src="/advise.png" alt="Advise" class="card-image">
        </div>
    </div>
    <div class="card right-extra">
        <span class="label">Imagine</span>
        <div class="card-content">
            <img src="/Imagine.png" alt="Imagine" class="card-image">
        </div>
    </div>
    <div class="card top-center">
        <span class="label">Learn</span>
        <div class="card-content">
            <img src="/Learn.png" alt="Learn" class="card-image">
        </div>
    </div>
    <div class="card bottom-center">
        <span class="label">Heal</span>
        <div class="card-content">
            <img src="/heal.png" alt="Heal" class="card-image">
        </div>
    </div>
    <div class="card middle-top-left">
        <span class="label">Pivot</span>
        <div class="card-content">
            <img src="/Piviot.png" alt="Pivot" class="card-image">
        </div>
    </div>
    <div class="card middle-top-right">
        <span class="label">Reflect</span>
        <div class="card-content">
            <img src="/Reflect.png" alt="Reflect" class="card-image">
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
    width: 220px;
    height: 180px;
    border: none; /* Removed border to match reference image */
    display: flex;
    flex-direction: column;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    z-index: 1;
}

.card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
    z-index: 11;
}

/* Card positioning - spread randomly around the page without overlapping */
.card.top-left {
    top: 20px;
    left: 20px;
}

.card.top-right {
    top: 20px;
    right: 20px;
}

.card.middle-left {
    top: 40%; 
    left: 40px;
}

.card.middle-right {
    top: 52%;
    right: 10%;
}

.card.bottom-left {
    bottom: 20px;
    left: 10%;
}

.card.bottom-right {
    bottom: 20px;
    right: 20px;
}

.card.left-extra {
    left: 250px;
    top: 15%;
}

.card.right-extra {
    right: 20%;
    top: 30%;
}

.card.top-center {
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
}

.card.bottom-center {
    bottom: 20px;
    left: 75%;
    transform: translateX(-50%);
}

.card.middle-top-left {
    top: 45%;
    left: 25%;
}

.card.middle-top-right {
    top: 5%;
    right: 8%;
}

.card.middle-bottom-left {
    bottom: 25%;
    left: 20%;
}

.card.middle-bottom-right {
    bottom: 25%;
    right: 25%;
}

.card-content {
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    z-index: 0;
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
        top: 42%;
        right: 18%;
    }
    
    .card.bottom-left {
        bottom: 80px;
        left: 80px;
    }
    
    .card.bottom-right {
        bottom: 100px;
        right: 120px;
    }
    
    .card.left-extra {
        left: 150px;
        top: 22%;
    }
    
    .card.right-extra {
        right: 24%;
        top: 20%;
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

.landing-page-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center; /* Center vertically */
		overflow-y: auto;
		height: 100dvh; /* Use dynamic viewport height */
		padding: 40px 20px;
		gap: 20px;
	}

@media (max-width: 768px) {

	.card {
		position: relative;
		width: 90%;
		max-width: 300px;
		margin: 0;
		top: auto;
		left: auto;
		right: auto;
		bottom: auto;
		max-height: 150px; /* Limit the height of the card */
	}

	.card-image {
		width: 100%;
		height: 100%;
		object-fit: cover; /* Ensure the image covers the card without distortion */
	}

	.main-title {
		position: relative;
		transform: none;
		left: auto;
		top: auto;
		margin: 0;
		order: 1;
	}

	.auth-container {
		position: relative;
		transform: none;
		left: auto;
		bottom: auto;
		margin: 20px 0 0 0;
		order: 2;
        display: flex;
        justify-content: center;
	}

	.card.top-left {
		order: 0;
	}
	.card.top-right {
		order: 3;
	}
    .card.middle-left {
        order: 4;
    }
    .card.middle-right {
        order: 5;
    }
}


	</style>