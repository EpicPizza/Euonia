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

  const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY
  });


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
    }
  ] satisfies OpenAI.Chat.Completions.ChatCompletionTool[];

  const openai = new OpenAI({
    apiKey: NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  })

  const messages = interactions.length == 0 ? [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": input,
          //"text": `You are an AI-powered, board-certified virtual therapist named Euonia. Your task is to conduct an empathetic, evidence-based conversational therapy session with a user. Follow these guidelines carefully:\n\n1. Core Persona & Tone:\n   - Be warm, compassionate, non-judgmental, patient, and validating.\n   - Create a safe space for the user's thoughts and feelings.\n   - Use gentle, reflective language that mirrors their emotional vocabulary.\n   - Maintain a calm pace and don't rush the conversation.\n   - Use brief, encouraging affirmations when appropriate.\n   - Avoid clinical jargon; use natural, empathetic phrases.\n   - Frame responses around the user's experience.\n\n2. Goal-Setting:\n   - Collaborate with the user to set SMART goals:\n     - Specific\n     - Measurable\n     - Achievable\n     - Relevant\n     - Time-bound\n   - Help the user break down larger goals into manageable steps.\n\n3. Response Format:\n   - Provide short to long responses, tailored to the depth of the user's input.\n   - Use <response> tags to enclose your entire response.\n\n4. Therapy Session:\n   The user's input will be provided between <user_input> tags. Read it carefully and respond as Euonia, following the guidelines above. Here is the user's input:\n\n<user_input>\n${input}\n</user_input>\n\n   Analyze the user's input and respond empathetically, addressing their concerns and emotions. If appropriate, guide them towards setting a SMART goal related to their situation. Remember to maintain your warm and supportive tone throughout the interaction.\n\n   Begin your response now:\n<response>`
        }
      ]
    }
  ] satisfies OpenAI.Chat.Completions.ChatCompletionMessageParam[] : [
    ...interactions, {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": input,
        }
      ]
    }
  ] satisfies OpenAI.Chat.Completions.ChatCompletionMessageParam[];

  const completion = await openai.chat.completions.create({
    model: "moonshotai/kimi-k2-instruct",
    messages: messages,
    temperature: 0.6,
    top_p: 0.9,
    max_tokens: 4096,
    stream: false,
    tools: tools,
  })

  let text = "";

  /*for(let i = 0; i < result.content.length; i++) {
    const part = result.content[i];

    if(part.type == "text") {
      text += part.text.replaceAll("<response>", "").replaceAll("</response>", "").trim();
    } else {
      console.log("TYPE", part.type, "\n\n");
      console.log(part, "\n\n");
    }
  }*/

    console.log(completion.choices[0]);

    if(typeof completion.choices[0]?.message?.content == 'string') {
      text = completion.choices[0]?.message?.content;
    }

    console.log(completion.choices[0].message.tool_calls)
  
  /*  console.log(JSON.stringify(interactions));
    console.log(JSON.stringify(contents));
  
    const response = await ai.models.generateContent({
      model,
      config: {
        toolConfig: {
            functionCallingConfig: {
              // Force it to call any function
              mode: FunctionCallingConfigMode.ANY, 
              allowedFunctionNames: ['set_goal', 'update_goal', 'get_goals', 'resolve_goal'],
            }
          },
          tools: [ { functionDeclarations: tools.functionDeclarations }]
      },
      contents,
    });

    let responseText = response.text ?? "";

    const functionResponses = [] as { name: string, response: any }[];

    for await (const functionCall of response.functionCalls ?? [] ) {
        switch (functionCall.name) {
          case 'set_goal':
            functionResponses.push({ name: 'set_goal', response: await setGoal(functionCall.args as any) });
            break;
          case 'update_goal':
            functionResponses.push({ name: 'update_goal', response: await updateGoal(functionCall.args as any) });
            break;
          case 'get_goals':
            functionResponses.push({ name: 'get_goals', response: { goals: await getGoals(functionCall.args as any) } });
            break;
          case 'resolve_goal':
            functionResponses.push({ name: 'resolve_goal', response: await resolveGoal(functionCall.args as any) });
            break;
        }
    }

    if(functionResponses.length > 0) {
      if(response.candidates && response.candidates.length > 0 && response.candidates[0].content) {
        contents.push(response.candidates[0].content);
      }

      contents.push({ role: 'user', parts: functionResponses.map(response => ({ functionResponse: response })) });

      const final_response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: contents,
        config: {
          toolConfig: {
              functionCallingConfig: {
                mode: FunctionCallingConfigMode.ANY, 
                allowedFunctionNames: ['set_goal', 'update_goal', 'resolve_goal'],
              }
            },
            tools: [ { functionDeclarations: tools.functionDeclarations }]
        },
      });

      const finalFunctionResponses = [] as { name: string, response: any }[];

      for await (const functionCall of final_response.functionCalls ?? [] ) {
        switch (functionCall.name) {
          case 'set_goal':
            finalFunctionResponses.push({ name: 'set_goal', response: await setGoal(functionCall.args as any) });
            break;
          case 'update_goal':
            finalFunctionResponses.push({ name: 'update_goal', response: await updateGoal(functionCall.args as any) });
            break;
          case 'get_goals':
            finalFunctionResponses.push({ name: 'get_goals', response: { goals: await getGoals(functionCall.args as any) } });
            break;
          case 'resolve_goal':
            finalFunctionResponses.push({ name: 'resolve_goal', response: await resolveGoal(functionCall.args as any) });
            break;  
        }
    }

    responseText += (responseText ? "\n\n" : "") + (final_response.text ?? '');

    if(final_response.candidates && final_response.candidates.length > 0 && final_response.candidates[0].content) {
      contents.push(final_response.candidates[0].content);
    }

    if(finalFunctionResponses.length > 0) {
      contents.push({ role: 'user', parts: finalFunctionResponses.map(response => ({ functionResponse: response })) });
    }
  } else {
    if(response.candidates && response.candidates.length > 0 && response.candidates[0].content) {
      contents.push(response.candidates[0].content);
    }
  }

  console.log(typeof responseText);

  if (!responseText.trim() || responseText.trim() == "undefined") {
    responseText = "Request completed.";
    contents.push({ role: 'model', parts: [{ text: responseText }] });
  }*/

  
  await ref.set({
    interactions: [ ...messages, completion.choices[0].message ],
  }, { merge: true });

  const allGoals = await getAllGoals();

  return {
    responseText: text,
    goals: allGoals,
  };
 }

async function setGoal({ name, priority, description, deadline }: { name: string, priority: number, description: string, deadline: string }) {
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
    }

    
    await docRef.set(goal);

    return goal;
}

async function getGoals({ days }: { days: number }): Promise<{ name: string, priority: number, description: string, id: string }[]> {
    const db = firebaseAdmin.getFirestore();

    if(isNaN(days)) {
        days = 7;
    }

    const goals = await db.collection("goals").where("day", ">=", Math.floor((new Date().getTime() - new Date(2023, 5, 24).getTime()) / (1000 * 60 * 60 * 24)) - days).where("day", "<", Math.floor((new Date().getTime() - new Date(2023, 5, 24).getTime()) / (1000 * 60 * 60 * 24)) + days).get();
    return goals.docs.map(doc => doc.data() as any);
} 

async function getAllGoals(): Promise<{ name: string, priority: string, description: string, id: string, deadline: string }[]> {
    const db = firebaseAdmin.getFirestore();
    const goalsSnapshot = await db.collection("goals").orderBy("createdAt", "desc").get();
    return goalsSnapshot.docs.map(doc => doc.data() as any);
} 

async function resolveGoal({ id }: { id: string }) {
    const db = firebaseAdmin.getFirestore();
    await db.collection("goals").doc(id).delete();
    return { success: true, id };
}

async function updateGoal(options: { id: string, name?: string, priority?: number, description?: string, goal_id?: string, deadline?: string }) {
    const db = firebaseAdmin.getFirestore();
    await db.collection("goals").doc(options.id ?? options.goal_id).update({
        ...(options.name ? { name: options.name } : {}),
        ...(options.priority ? { priority: options.priority } : {}),
        ...(options.description ? { description: options.description } : {}),
        ...(options.deadline ? { deadline: options.deadline } : {}),
        updatedAt: new Date().valueOf(),
    });

    return { id: options.id ?? options.goal_id, ...(options.name ? { name: options.name } : {}), ...(options.priority ? { priority: options.priority } : {}), ...(options.description ? { description: options.description } : {}), ...(options.deadline ? { deadline: options.deadline } : {}) };
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