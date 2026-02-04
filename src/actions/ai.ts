'use server';

import OpenAI from 'openai';
import { db } from '@/db';
import { cases, caseStages, stageOptions, users } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { auth, currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Zod Schema for the expected AI output (Structured Output)
const OptionSchema = z.object({
    text: z.string(),
    isCorrect: z.boolean(),
    scoreWeight: z.number(),
    feedback: z.string(),
});

const StageSchema = z.object({
    stageOrder: z.number(),
    narrative: z.string(),
    clinicalData: z.object({
        BP: z.string().optional(),
        HR: z.number().optional(),
        RR: z.number().optional(),
        Temp: z.number().optional(),
        SpO2: z.number().optional(),
        notes: z.array(z.string()).optional(),
    }).passthrough().optional().default({}),
    options: z.array(OptionSchema),
});

const CaseSchema = z.object({
    title: z.string(),
    description: z.string(),
    clinicalDomain: z.string(),
    difficultyLevel: z.enum(['Foundation', 'Core', 'Advanced']),
    stages: z.array(StageSchema),
});

export async function generateCaseAction(domain: string, difficulty: string, prompt: string) {
    // 1. Verify Admin
    try {
        await requireAdmin();
    } catch (e) {
        return { success: false, message: 'Unauthorized' };
    }

    const { userId } = await auth();
    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    if (!process.env.OPENAI_API_KEY) {
        return { success: false, message: 'OpenAI API Key is missing' };
    }

    try {
        // 2. Call OpenAI with modern tools API
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Use a smart model for medical safety
            messages: [
                {
                    role: "system",
                    content: `You are a senior medical educator for UKMLA students. 
                    Generate a realistic clinical case based on NICE guidelines.
                    The case should test clinical reasoning and patient management.`
                },
                {
                    role: "user",
                    content: `Generate a clinical case based on the following scenario: "${prompt}".
                    ${domain ? `Domain: '${domain}'.` : `Infer the most appropriate Clinical Domain based on the scenario.`}
                    ${difficulty ? `Difficulty Level: '${difficulty}'.` : `Infer the appropriate Difficulty Level (Foundation, Core, or Advanced) based on the clinical complexity.`}
                    
                    Include 2-3 stages. Each stage must have options (some correct, some incorrect/dangerous).
                    If the user description includes clinical data (vitals), use those if not generate clinical data (vitals) are realistic.`
                }
            ],
            tools: [
                {
                    type: "function",
                    function: {
                        name: "create_case",
                        description: "Generates a medical case structure",
                        parameters: {
                            type: "object",
                            properties: {
                                title: { type: "string" },
                                description: { type: "string" },
                                clinicalDomain: { type: "string" },
                                difficultyLevel: { type: "string", enum: ["Foundation", "Core", "Advanced"] },
                                stages: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            stageOrder: { type: "integer" },
                                            narrative: { type: "string" },
                                            clinicalData: {
                                                type: "object",
                                                properties: {
                                                    BP: { type: "string" },
                                                    HR: { type: "integer" },
                                                    RR: { type: "integer" },
                                                    Temp: { type: "number" },
                                                    SpO2: { type: "integer" },
                                                    notes: { type: "array", items: { type: "string" } }
                                                }
                                            },
                                            options: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        text: { type: "string" },
                                                        isCorrect: { type: "boolean" },
                                                        scoreWeight: { type: "integer" },
                                                        feedback: { type: "string" }
                                                    },
                                                    required: ["text", "isCorrect", "scoreWeight", "feedback"]
                                                }
                                            }
                                        },
                                        required: ["stageOrder", "narrative", "clinicalData", "options"]
                                    }
                                }
                            },
                            required: ["title", "description", "clinicalDomain", "difficultyLevel", "stages"]
                        }
                    }
                }
            ],
            tool_choice: { type: "function", function: { name: "create_case" } }
        });

        const toolCall = completion.choices[0].message.tool_calls?.[0];
        if (!toolCall || toolCall.type !== 'function') throw new Error("No tool call generated");

        const aiData = JSON.parse(toolCall.function.arguments);


        // validate with Zod
        const validatedCase = CaseSchema.parse(aiData);

        // 3. Ensure the current admin user exists in database
        const user = await currentUser();
        if (user?.id) {
            await db
                .insert(users)
                .values({
                    id: user.id,
                    email: user.emailAddresses[0]?.emailAddress || `${user.id}@unknown.local`,
                    firstName: user.firstName || null,
                    lastName: user.lastName || null,
                    imageUrl: user.imageUrl || null,
                    role: 'admin',
                })
                .onConflictDoNothing();
        }

        // 4. Insert into DB (Transaction would be better, but keeping it simple for now)
        const newCase = await db.insert(cases).values({
            userId: userId,
            title: validatedCase.title,
            description: validatedCase.description,
            clinicalDomain: validatedCase.clinicalDomain,
            difficultyLevel: validatedCase.difficultyLevel,
            source: 'ai',
            verificationStatus: 'draft', // Requires human review
            qualityScore: 50, // Default AI score
            isPublished: false,
        }).returning();

        const caseId = newCase[0].id;

        for (const stage of validatedCase.stages) {
            const newStage = await db.insert(caseStages).values({
                caseId: caseId,
                stageOrder: stage.stageOrder,
                narrative: stage.narrative,
                clinicalData: stage.clinicalData,
            }).returning();

            if (stage.options.length > 0) {
                await db.insert(stageOptions).values(
                    stage.options.map(opt => ({
                        stageId: newStage[0].id,
                        text: opt.text,
                        isCorrect: opt.isCorrect,
                        scoreWeight: opt.scoreWeight,
                        feedback: opt.feedback
                    }))
                );
            }
        }

        revalidatePath('/admin');
        return { success: true, message: 'Case generated successfully', caseId };

        // ... existing code ...

    } catch (error: any) {
        console.error("AI Generation Error:", error);
        console.error("Error details:", {
            message: error?.message,
            status: error?.status,
            type: error?.type,
            code: error?.code
        });

        // Return more detailed error message
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        return {
            success: false,
            message: `Failed to generate case: ${errorMessage}`
        };
    }
}

export async function generateClinicalDataAction(narrative: string) {
    try {
        await requireAdmin();
        if (!process.env.OPENAI_API_KEY) {
            return { success: false, message: 'OpenAI API Key is missing' };
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a medical expert. specific clinical data (vitals) based on the provided clinical narrative. Return ONLY a JSON object."
                },
                {
                    role: "user",
                    content: `Generate realistic clinical data (vitals) for a patient with the following situation: "${narrative}".
                    
                    Return a JSON object with these fields (use realistic values):
                    - BP (string, e.g. "120/80")
                    - HR (number)
                    - RR (number)
                    - Temp (number, celsius)
                    - SpO2 (number)
                    - notes (array of strings, optional observations)
                    `
                }
            ],
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("No content generated");

        const data = JSON.parse(content);
        return { success: true, data };
    } catch (error: any) {
        console.error("Clinical Data Generation Error:", error);
        return { success: false, message: error.message };
    }
}

