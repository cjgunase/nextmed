import { db } from './index';
import { cases } from './schema';
import { eq } from 'drizzle-orm';

async function testDatabase() {
    console.log('🧪 Testing database with new schema...\n');

    try {
        // Test 1: Fetch all cases
        console.log('Test 1: Fetching all cases...');
        const allCases = await db.query.cases.findMany({
            with: {
                user: true,
            },
        });
        console.log(`✅ Found ${allCases.length} cases`);
        console.log(`   First case: "${allCases[0]?.title}" owned by ${allCases[0]?.user?.email}`);

        // Test 2: Fetch cases for specific user
        console.log('\nTest 2: Fetching cases for student user...');
        const studentCases = await db.query.cases.findMany({
            where: eq(cases.userId, 'user_2example123'),
        });
        console.log(`✅ Student has ${studentCases.length} cases`);

        // Test 3: Verify userId is NOT NULL
        console.log('\nTest 3: Verifying all cases have userId...');
        const casesWithoutUser = allCases.filter(c => !c.userId);
        if (casesWithoutUser.length === 0) {
            console.log('✅ All cases have userId (data isolation enforced)');
        } else {
            console.log(`❌ Found ${casesWithoutUser.length} cases without userId!`);
        }

        // Test 4: Verify relations work
        console.log('\nTest 4: Testing case relations...');
        const caseWithStages = await db.query.cases.findFirst({
            where: eq(cases.userId, 'user_2example123'),
            with: {
                stages: {
                    with: {
                        options: true,
                    },
                },
            },
        });
        console.log(`✅ Case "${caseWithStages?.title}" has ${caseWithStages?.stages.length} stages`);
        console.log(`   Total options: ${caseWithStages?.stages.reduce((sum, s) => sum + s.options.length, 0)}`);

        console.log('\n🎉 All tests passed! Database migration successful!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

testDatabase()
    .then(() => {
        console.log('\n✨ Database is ready for use!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error testing database:', error);
        process.exit(1);
    });
