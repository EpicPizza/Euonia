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

export async function load({ url, cookies }) {
    const session = cookies.get("__session");

    const user = session ? await getUser(session) : undefined;

    const uid = user?.uid;

    const goals = await getAllGoals(uid);

    const chatId = url.searchParams.get('chatId');

    return {
        sessionId: chatId ?? "",
        goals
    };
}