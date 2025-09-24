const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTokens() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        user_id,
        google_access_token IS NOT NULL as has_access_token,
        google_refresh_token IS NOT NULL as has_refresh_token,
        google_scope,
        LENGTH(google_access_token) as access_token_length,
        created_at,
        updated_at
      FROM user_tokens
      WHERE user_id LIKE 'T09CAEM8EVA:%'
      ORDER BY updated_at DESC
    `);

    console.log('\n=== Token Status ===');
    console.log(JSON.stringify(result.rows, null, 2));

  } finally {
    client.release();
    await pool.end();
  }
}

checkTokens().catch(console.error);