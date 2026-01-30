import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });

const connection = neon(process.env.DATABASE_URL!);
const db = drizzle(connection, { schema });

async function main() {
    console.log('🔍 Querying database...\n');

    // Fetch all cases with their stages and options
    const allCases = await db.query.cases.findMany({
        with: {
            stages: {
                with: {
                    options: true,
                },
            },
        },
    });

    console.log(`📚 Found ${allCases.length} cases:\n`);

    allCases.forEach((case_, index) => {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`${index + 1}. ${case_.title}`);
        console.log(`${'='.repeat(80)}`);
        console.log(`Domain: ${case_.clinicalDomain} | Difficulty: ${case_.difficultyLevel}`);
        console.log(`Published: ${case_.isPublished ? '✅' : '❌'}`);
        console.log(`Description: ${case_.description}`);
        console.log(`\nStages: ${case_.stages.length}`);

        case_.stages.forEach((stage, stageIndex) => {
            console.log(`\n  Stage ${stage.stageOrder}: ${stage.narrative.substring(0, 100)}...`);
            console.log(`  Clinical Data: ${JSON.stringify(stage.clinicalData)?.substring(0, 80)}...`);
            console.log(`  Options: ${stage.options.length}`);

            stage.options.forEach((option, optIndex) => {
                const emoji = option.isCorrect ? '✅' : '❌';
                const score = option.scoreWeight > 0 ? `+${option.scoreWeight}` : option.scoreWeight;
                console.log(`    ${emoji} [${score}] ${option.text.substring(0, 60)}...`);
            });
        });
    });

    console.log(`\n${'='.repeat(80)}\n`);

    // Summary stats
    const totalStages = allCases.reduce((sum, c) => sum + c.stages.length, 0);
    const totalOptions = allCases.reduce(
        (sum, c) => sum + c.stages.reduce((s, stage) => s + stage.options.length, 0),
        0
    );

    console.log('📊 Database Summary:');
    console.log(`  Total Cases: ${allCases.length}`);
    console.log(`  Total Stages: ${totalStages}`);
    console.log(`  Total Options: ${totalOptions}`);
    console.log(`  Average Options per Stage: ${(totalOptions / totalStages).toFixed(1)}`);
}

main()
    .then(() => {
        console.log('\n✅ Query complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error querying database:', error);
        process.exit(1);
    });
