import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

config({ path: '.env.local' });

const connection = neon(process.env.DATABASE_URL!);
const db = drizzle(connection, { schema });

const domains = [
    ...schema.ukmlaCategories,
    'Critical Care',
    'Musculoskeletal',
] as const;

const clusterTemplates = [
    {
        suffix: 'core_patterns',
        label: 'Core Clinical Patterns',
        keywords: ['presentation', 'classic', 'pattern', 'features', 'history'],
    },
    {
        suffix: 'diagnostic_strategy',
        label: 'Diagnostic Strategy',
        keywords: ['investigation', 'diagnosis', 'test', 'ecg', 'imaging', 'labs'],
    },
    {
        suffix: 'first_line_management',
        label: 'First-line Management',
        keywords: ['first-line', 'initial management', 'treatment', 'therapy', 'plan'],
    },
    {
        suffix: 'emergency_red_flags',
        label: 'Emergency Red Flags',
        keywords: ['emergency', 'red flag', 'urgent', 'shock', 'unstable', 'sepsis'],
    },
    {
        suffix: 'complications_follow_up',
        label: 'Complications and Follow-up',
        keywords: ['complication', 'follow-up', 'monitor', 'safety net', 'review'],
    },
    {
        suffix: 'guidelines_prescribing',
        label: 'Guidelines and Prescribing',
        keywords: ['guideline', 'nice', 'dose', 'prescribing', 'contraindication'],
    },
] as const;

function slugify(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

async function main() {
    const rows = domains.flatMap((domain) => {
        const slug = slugify(domain);

        return clusterTemplates.map((template) => ({
            domain,
            clusterKey: `${slug}_${template.suffix}`,
            clusterLabel: template.label,
            keywords: [...template.keywords, domain.toLowerCase()],
            active: true,
            updatedAt: new Date(),
        }));
    });

    for (const row of rows) {
        await db
            .insert(schema.rivisionNoteTaxonomy)
            .values(row)
            .onConflictDoNothing();
    }

    console.log(`Seeded ${rows.length} rivision taxonomy records.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
