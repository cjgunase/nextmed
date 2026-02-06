import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as schema from './schema';

config({ path: '.env.local' });

const connection = neon(process.env.DATABASE_URL!);
const db = drizzle(connection, { schema });

async function main() {
    const creator = await db.query.users.findFirst({
        columns: { id: true, email: true },
    });

    if (!creator) {
        throw new Error('No users found. Create at least one user before running UKMLA seed.');
    }

    const existing = await db.query.ukmlaQuestions.findFirst({
        where: eq(schema.ukmlaQuestions.createdByUserId, creator.id),
        columns: { id: true },
    });

    if (existing) {
        console.log('UKMLA sample questions already exist. Skipping seed.');
        return;
    }

    const questions = [
        {
            stem: 'A 67-year-old man presents with sudden crushing central chest pain radiating to the left arm. ECG shows ST-elevation in leads II, III and aVF. What is the single most appropriate immediate management?',
            explanation: 'Inferior STEMI requires urgent reperfusion. If PCI is available in timeframe, immediate transfer for primary PCI is the best next step.',
            category: 'Cardiology' as const,
            difficultyLevel: 'Core' as const,
            options: [
                { text: 'Immediate transfer for primary PCI', isCorrect: true },
                { text: 'Start oral beta-blocker and observe', isCorrect: false },
                { text: 'Arrange outpatient echocardiography', isCorrect: false },
                { text: 'Discharge with GTN spray', isCorrect: false },
            ],
        },
        {
            stem: 'A 23-year-old woman with type 1 diabetes presents with vomiting, abdominal pain, Kussmaul breathing and blood glucose 28 mmol/L. Which is the most appropriate first-line treatment bundle?',
            explanation: 'DKA management starts with fixed-rate IV insulin, IV fluids, and careful potassium monitoring/replacement using protocol.',
            category: 'EmergencyMedicine' as const,
            difficultyLevel: 'Foundation' as const,
            options: [
                { text: 'Subcutaneous short-acting insulin and oral rehydration', isCorrect: false },
                { text: 'IV fluids, fixed-rate IV insulin, potassium-guided replacement', isCorrect: true },
                { text: 'Immediate bicarbonate infusion in all cases', isCorrect: false },
                { text: 'Stop insulin and give dextrose only', isCorrect: false },
            ],
        },
    ];

    for (const question of questions) {
        const [inserted] = await db
            .insert(schema.ukmlaQuestions)
            .values({
                createdByUserId: creator.id,
                stem: question.stem,
                explanation: question.explanation,
                category: question.category,
                difficultyLevel: question.difficultyLevel,
                source: 'human',
                verificationStatus: 'verified',
                qualityScore: 80,
                rigourScore: 80,
                isPublished: true,
            })
            .returning({ id: schema.ukmlaQuestions.id });

        await db.insert(schema.ukmlaQuestionOptions).values(
            question.options.map((option, index) => ({
                questionId: inserted.id,
                text: option.text,
                isCorrect: option.isCorrect,
                optionOrder: index + 1,
            }))
        );
    }

    console.log('Seeded UKMLA sample questions successfully.');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
