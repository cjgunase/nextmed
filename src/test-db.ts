import 'dotenv/config';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import { users } from './db/schema';

// Load .env.local for Next.js
config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

async function main() {
    const newUsers: typeof users.$inferInsert = {
        id: 'test_user_123',
        email: 'test@example.com',
        role: 'student',
    };

    await db.insert(users).values(newUsers);

    // Check if inserted
    const result = await db.select().from(users);
    console.log('Users in DB:', result);

    const user = await db.select().from(users).where(eq(users.email, 'test@example.com'));

    if (user.length > 0) {
        // Cleanup
        await db.delete(users).where(eq(users.email, 'test@example.com'));
        console.log('User deleted!');
    }
}

main();
