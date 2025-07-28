import { json, text, type RequestHandler } from '@sveltejs/kit';
// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node
import OpenAI from 'openai';

import {
    FunctionCallingConfigMode,
    GoogleGenAI,
    Type,
    type ContentListUnion,
    type FunctionDeclaration  
} from '@google/genai';
import { ANTHROPIC_API_KEY, GEMINI_API_KEY, NVIDIA_API_KEY } from '$env/static/private';
import { firebaseAdmin, getUser } from '$lib/Firebase/firebase.server';
import Anthropic from '@anthropic-ai/sdk';
import type { Message, Tool } from '@anthropic-ai/sdk/resources';
import type { MessageBatch, MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/messages.js';
  
 async function main(input: string, uid: string): Promise<{ responseText: string, goals: any[] }> {
  const db = firebaseAdmin.getFirestore();
  const ref = db.collection('chats').doc(uid);
  const doc = await ref.get();   

  const data = doc.data();
  const interactions = data?.interactions.length > 0 ? data?.interactions : []; 

  const systemMessage = {
    "role": "user",
    "content": `SYSTEM: You are “Euonia,” an AI-powered, artist-first journaling assistant dedicated to helping users deepen self-awareness, process emotions, spark creativity, and build a sustainable journaling practice. Follow these guidelines exactly to shape your persona and responses.

**Core Persona & Tone**  
You are empathetic, curious, non-judgmental, and encouraging. Speak with warmth and sincerity, inviting users into an open, safe space. Use reflective, evocative language that honors their inner voice. Maintain gentle pacing—allow silence for contemplation—and validate all entries, no matter how brief or raw.

**Reflection & Thematic Analysis**  
Help users identify key thematic themes or habits that have impacts on their day and quality of life. These can be positive or negative. When identifying these patterns, you should note them for key goal setting (documentation on goal setting is in the next section). Some examples of patterns that are worth noting for discussion and goal setting below:
- When a user scrolls through social media for 30 plus minutes in the morning they don’t wake up on time and miss the bus. Thus you should identify this and make a goal to not use social media in the morning.
- A user does not begin studying or their project because they are a perfectionist, spending too much time on background research, review, etc. You should identify this and make amends.

**Ethical Boundaries & Privacy**  
Maintain a confidential, supportive environment:  
- Remind users that their journal is their personal space and you respect its privacy.  
- Clarify scope: “I’m here to support your journaling practice, not to diagnose or treat mental health conditions.”  
- If entries indicate crisis or self-harm, provide a crisis protocol: “I’m really sorry you’re feeling this way. Please reach out to emergency services (e.g., 911 in the U.S.) or a trusted professional right away.”

**Output**
When generating responses with the user, you should not exceed more than 100 word responses. You should write impactful, strong sentences without fluff or unnecessary wording. You should be open, but also have conviction with your answers.

**Goal-Setting**  
   Collaborate on SMART goals:  
   - **Specific**  
   - **Measurable**
   - **Achievable**
   - **Relevant**
   - **Time-bound**  
How to set a goal.
When a goal opportunity is identified, define it using SMART principles: it must be Specific (“no phone use for 15 minutes after waking”), Measurable (trackable via reflection or outcome), Achievable (reasonable given context), Relevant (aligned with stated emotions, patterns, or values), and Time-bound (typically 3–10 days). Use the set_goal() function with name as a concise behavioral phrase, deadline as a realistic date (based on the intensity of the shift), and priority reflecting urgency: URGENT if emotional well-being is at stake, IMPORTANT for strong growth alignment, NORMAL for habits, OPTIONAL for experiments. Avoid vagueness like “be better this week”—anchor goals in observable action. Frame the goal in empowering terms, as an invitation to experiment with a better version of the user’s daily life.
   Goal Setting Functions:  
**set_goal**: when appropriate with the context of discussions, add a goal for the user to the database with the following properties: name, deadline, priority [URGENT, IMPORTANT, OPTIONAL, NORMAL]. When setting a goal ensure to use the other functions and chat history for contextual information on the appropriate times to set goals that are not repetitive or redundant.
**get_goals**: access goals already set in the past for contextual information to ensure when new goals are set they are not redundant, repetitive, or already set based on how many days the goals were set. To use this function, call the function and its response.
**update_goal**: If the user establishes an intent to reword, reframe, or correct a goal, revise the name, deadline, or priority of an existing goal.  
 **resolve_goal**: when a user has successfully accomplished their SMART goal, you should call this function to resolve it and remove it from active goals. 

END OF PROMPT  

YOUR RESPONSES SHOULD NOT BE MORE THAN A HUNDRED WORDS.
`
  } satisfies OpenAI.Chat.Completions.ChatCompletionMessageParam;


  const tools = [
    {
      "type": "function",
      function: {
        "name": "get_goals",
        "description": "Retrieve goals from a specified previous amount of days.",
        "parameters": {
          "type": "object",
          "properties": {
            "days": {
              "type": "number",
              "description": "Number of days to look back for goals",
              "minimum": 0,
              "maximum": 365
            }
          },
          "required": [
            "days"
          ],
          "additionalProperties": false
        }
      }
    },
    {
      "type": "function",
      function: {
        "name": "set_goal",
        "description": "Add a goal to the database for the user to easily look back to.",
        "parameters": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "The name or title of the task"
            },
            "deadline": {
              "type": "string",
              "format": "date-time",
              "description": "The deadline for the task in ISO 8601 format"
            },
            "priority": {
              "type": "string",
              "enum": [
                "URGENT",
                "IMPORTANT",
                "NORMAL",
                "OPTIONAL",
                "UNIMPORTANT"
              ],
              "description": "The priority level of the task"
            }
          },
          "required": [
            "name",
            "deadline",
            "priority",
            "description"
          ],
          "additionalProperties": false
        }
      }
    },
    {
      "type": "function",
      function: {
        "name": "resolve_goal",
        "description": "Mark a goal as resolved (completed) by its ID.",
        "parameters": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "description": "The ID of the goal to resolve"
            }
          },
          "required": [
            "id"
          ],
          "additionalProperties": false
        }
      }
    },
    {
      "type": "function",
      function: {
        "name": "update_goal",
        "description": "Update an existing goal's properties (name, priority, description, deadline) by its ID.",
        "parameters": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "description": "The ID of the goal to update"
            },
            "name": {
              "type": "string",
              "description": "The new name or title of the task"
            },
            "deadline": {
              "type": "string",
              "format": "date-time",
              "description": "The new deadline for the task in ISO 8601 format"
            },
            "priority": {
              "type": "string",
              "enum": [
                "URGENT",
                "IMPORTANT",
                "NORMAL",
                "OPTIONAL",
                "UNIMPORTANT"
              ],
              "description": "The new priority level of the task"
            },
            "description": {
              "type": "string",
              "description": "The new description of the task"
            }
          },
          "required": [
            "id"
          ],
          "additionalProperties": false
        }
      }
    }
  ] satisfies OpenAI.Chat.Completions.ChatCompletionTool[];

  const openai = new OpenAI({
    apiKey: NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  })

  const messages =( interactions.length == 0 ? [
    {
      "role": "user",
      "content": input,
    }
  ] satisfies OpenAI.Chat.Completions.ChatCompletionMessageParam[] : [
    ...interactions, {
      "role": "user",
      "content": input
    }
  ] satisfies OpenAI.Chat.Completions.ChatCompletionMessageParam[]) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

  let completion = await openai.chat.completions.create({
    model: "moonshotai/kimi-k2-instruct",
    messages: [ systemMessage, ... messages ],
    temperature: 0.6,
    top_p: 0.9,
    max_tokens: 4096,
    stream: false,
    tools: tools,
  });

  let text = "";
  let message = completion.choices[0].message;

  while (message?.tool_calls && message.tool_calls.length > 0) {
    messages.push(message); // Add the assistant's tool call message to interactions
    await ref.set({
      interactions: messages,
    }, { merge: true });

    for (const toolCall of message.tool_calls) {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);
      let result;

      if (functionName === "get_goals") {
        result = await getGoals({ ...functionArgs, uid });
      } else if (functionName === "set_goal") {
        result = await setGoal({ ...functionArgs, uid });
      } else if (functionName === "resolve_goal") {
        result = await resolveGoal({ ...functionArgs, uid });
      } else if (functionName === "update_goal") {
        result = await updateGoal({ ...functionArgs, uid });
      }
      // Add more tool calls here if needed

      messages.push({
        tool_call_id: toolCall.id,
        role: "tool",
        content: (functionName === "get_goals" && Array.isArray(result) && result.length === 0)
          ? "No goals found for the specified period."
          : (functionName === "set_goal" && result && typeof result === 'object' && 'name' in result)
          ? `Goal '${result.name}' has been successfully set.`
          : (functionName === "resolve_goal" && result && typeof result === 'object' && 'success' in result)
          ? (result.success && 'id' in result ? `Goal with ID '${result.id}' has been successfully resolved.` : `Failed to resolve goal: ${'message' in result ? result.message : 'Unknown error.'}`)
          : (functionName === "update_goal" && result && typeof result === 'object' && 'success' in result)
          ? (result.success && 'id' in result ? `Goal with ID '${result.id}' has been successfully updated.` : `Failed to update goal: ${'message' in result ? result.message : 'Unknown error.'}`)
          : JSON.stringify(result),
      });
      await ref.set({
        interactions: messages,
      }, { merge: true });
    }

    completion = await openai.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",
      messages: [ systemMessage, ... messages ],
      temperature: 0.6,
      top_p: 0.9,
      max_tokens: 4096,
      stream: false,
      tools: tools,
    });
    message = completion.choices[0].message;
  }

  if (typeof message?.content === 'string') {
    text = message.content;
  }
  messages.push(message); // Add the final assistant message to interactions

  await ref.set({
    interactions: messages,
  }, { merge: true });
    
 
  const allGoals = await getAllGoals(uid);

  return {
    responseText: text,
    goals: allGoals,
  };
 }

async function setGoal({ name, priority, description, deadline, uid }: { name: string, priority: number, description: string, deadline: string, uid: string }) {
    const db = firebaseAdmin.getFirestore();

    const docRef = db.collection("goals").doc();

    const goal = {
      name,
      priority,
      description: description ?? "",
      createdAt: new Date().valueOf(),
      id: docRef.id,
      day: Math.floor((new Date().getTime() - new Date(2023, 5, 24).getTime()) / (1000 * 60 * 60 * 24)),
      deadline,
      uid,
    }

    
    await docRef.set(goal);

    return goal;
}

async function getGoals({ days, uid }: { days: number, uid: string }): Promise<{ name: string, priority: number, description: string, id: string }[]> {
    const db = firebaseAdmin.getFirestore();

    if(isNaN(days)) {
        days = 7;
    }

    const goals = await db.collection("goals").where("uid", "==", uid).where("day", ">=", Math.floor((new Date().getTime() - new Date(2023, 5, 24).getTime()) / (1000 * 60 * 60 * 24)) - days).where("day", "<", Math.floor((new Date().getTime() - new Date(2023, 5, 24).getTime()) / (1000 * 60 * 60 * 24)) + days).get();
    return goals.docs.map(doc => doc.data() as any);
} 

async function getAllGoals(uid: string): Promise<{ name: string, priority: string, description: string, id: string, deadline: string }[]> {
    const db = firebaseAdmin.getFirestore();
    const goalsSnapshot = await db.collection("goals").where("uid", "==", uid).orderBy("createdAt", "desc").get();
    return goalsSnapshot.docs.map(doc => doc.data() as any);
} 

async function resolveGoal({ id, uid }: { id: string, uid: string }) {
    const db = firebaseAdmin.getFirestore();
    const goalRef = db.collection("goals").doc(id);
    const goalDoc = await goalRef.get();

    if (!goalDoc.exists || goalDoc.data()?.uid !== uid) {
        return { success: false, message: "Goal not found or unauthorized." };
    }

    await goalRef.delete();
    return { success: true, id };
}

async function updateGoal(options: { id: string, name?: string, priority?: number, description?: string, goal_id?: string, deadline?: string, uid: string }) {
    const db = firebaseAdmin.getFirestore();
    const goalRef = db.collection("goals").doc(options.id ?? options.goal_id);
    const goalDoc = await goalRef.get();

    if (!goalDoc.exists || goalDoc.data()?.uid !== options.uid) {
        return { success: false, message: "Goal not found or unauthorized." };
    }

    await goalRef.update({
        ...(options.name ? { name: options.name } : {}),
        ...(options.priority ? { priority: options.priority } : {}),
        ...(options.description ? { description: options.description } : {}),
        ...(options.deadline ? { deadline: options.deadline } : {}),
        updatedAt: new Date().valueOf(),
    });

    return { success: true, id: options.id ?? options.goal_id, ...(options.name ? { name: options.name } : {}), ...(options.priority ? { priority: options.priority } : {}), ...(options.description ? { description: options.description } : {}), ...(options.deadline ? { deadline: options.deadline } : {}) };
}

export const POST: RequestHandler = async ({ request, cookies }) => {
    const sessionCookie = cookies.get('__session');

    if (!sessionCookie) {
        return json({ error: 'No session cookie provided' }, { status: 401 });
    }

    const user = await getUser(sessionCookie);

    if (!user) {
        return json({ error: 'Invalid session cookie' }, { status: 401 });
    }

    const uid = user.uid;
    
    const body = await request.json();
    const { message } = body;

    console.log(message);

    return json(await main(message, uid));
};