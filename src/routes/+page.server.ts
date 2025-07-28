import { firebaseAdmin, getUser } from "$lib/Firebase/firebase.server";
import type { ContentListUnion } from "@google/genai";
import { redirect } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import type OpenAI from "openai";

async function getAllGoals(): Promise<{ name: string, priority: string, description: string, id: string, deadline: string }[]> {
    const db = firebaseAdmin.getFirestore();
    const goalsSnapshot = await db.collection("goals").orderBy("createdAt", "desc").get();
    return goalsSnapshot.docs.map(doc => doc.data() as any);
} ;

export async function load({ url, cookies }) {
    const session = cookies.get("__session");

    const user = session ? await getUser(session) : undefined;

    const uid = user?.uid;

    const goals = await getAllGoals();

    return {
        sessionId: uid,
        goals
    };
}