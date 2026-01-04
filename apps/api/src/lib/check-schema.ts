import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_qix6Hjh3ZKVR@ep-misty-shadow-a4oz12xg-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DATABASE_URL);

async function main() {
  // Check table columns
  const tables = ['User', 'Course', 'Tee', 'Hole', 'Round', 'RoundPlayer', 'Game', 'HoleScore'];

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    const cols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = ${table}
      ORDER BY ordinal_position
    `;
    cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`));
  }
}

main().catch(console.error);
