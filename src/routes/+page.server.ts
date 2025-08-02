import { firebaseAdmin, getUser } from "$lib/Firebase/firebase.server";
import type { ContentListUnion } from "@google/genai";
import { redirect } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import type OpenAI from "openai";

async function getAllGoals(uid: string | undefined): Promise<{ name: string, priority: string, description: string, id: string, deadline: string }[]> {
    const db = firebaseAdmin.getFirestore();
    if (!uid) {
        return [];
    }
    const goalsSnapshot = await db.collection("goals").where("uid", "==", uid).orderBy("createdAt", "desc").get();
    return goalsSnapshot.docs.map(doc => doc.data() as any);
} ;

async function getChats(uid: string): Promise<{ id: string, name: string }[]> {
    const db = firebaseAdmin.getFirestore();
    const chatsSnapshot = await db.collection("chats").where("userId", "==", uid).orderBy("createdAt", "desc").get();
    return chatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
}

function getFormattedDate() {
    const date = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    return `${month} ${day}, ${year} Entry`;
}

async function createChat(uid: string, name: string): Promise<string> {
    const db = firebaseAdmin.getFirestore();
    const chatRef = await db.collection("chats").add({
        userId: uid,
        name,
        createdAt: new Date(),
        interactions: []
    });
    return chatRef.id;
}

export async function load({ url, cookies }) {
    const session = cookies.get("__session");

    const user = session ? await getUser(session) : undefined;

    if (!user) {
        return {
            sessionId: "",
            goals: []
        };
    }

    const uid = user.uid;

    const goals = await getAllGoals(uid);

    let chatId = url.searchParams.get('chatId');

    if (!chatId) {
        const chats = await getChats(uid);
        if (chats.length === 0) {
            chatId = await createChat(uid, getFormattedDate());
        } else {
            chatId = chats[0].id;
        }
        throw redirect(302, `/?chatId=${chatId}`);
    }

    return {
        sessionId: chatId ?? "",
        goals
    };
}