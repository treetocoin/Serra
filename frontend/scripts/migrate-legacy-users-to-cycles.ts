/**
 * Migration script to create default cycles for existing users
 *
 * This script:
 * 1. Finds all users without an active cycle
 * 2. Creates a default 12-week cycle for each user
 * 3. Logs the migration process
 *
 * Run with: npx tsx scripts/migrate-legacy-users-to-cycles.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface User {
  id: string;
  email: string | undefined;
  created_at: string;
}

interface MigrationResult {
  totalUsers: number;
  usersWithCycles: number;
  usersWithoutCycles: number;
  cyclesCreated: number;
  errors: string[];
}

async function migrateUsers(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalUsers: 0,
    usersWithCycles: 0,
    usersWithoutCycles: 0,
    cyclesCreated: 0,
    errors: [],
  };

  console.log('🔄 Starting legacy user migration...\n');

  // Step 1: Get all users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    result.errors.push(`Failed to fetch users: ${usersError.message}`);
    return result;
  }

  result.totalUsers = users.users.length;
  console.log(`📊 Found ${result.totalUsers} total users\n`);

  // Step 2: For each user, check if they have an active cycle
  for (const user of users.users) {
    const typedUser: User = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    };

    console.log(`\n👤 Processing user: ${typedUser.email || typedUser.id}`);
    console.log(`   Created: ${new Date(typedUser.created_at).toLocaleDateString()}`);

    // Check for existing active cycle
    const { data: existingCycle, error: cycleError } = await supabase
      .from('cycles')
      .select('id, status, duration_weeks, current_week')
      .eq('user_id', typedUser.id)
      .eq('status', 'active')
      .single();

    if (cycleError && cycleError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (expected for users without cycles)
      console.error(`   ❌ Error checking cycle:`, cycleError);
      result.errors.push(`User ${typedUser.email || typedUser.id}: ${cycleError.message}`);
      continue;
    }

    if (existingCycle) {
      console.log(`   ✅ Already has active cycle (${existingCycle.duration_weeks} weeks, week ${existingCycle.current_week})`);
      result.usersWithCycles++;
      continue;
    }

    // User has no active cycle - create one
    console.log(`   📝 Creating default cycle...`);
    result.usersWithoutCycles++;

    const { data: newCycle, error: createError } = await supabase
      .from('cycles')
      .insert({
        user_id: typedUser.id,
        duration_weeks: 12,
        current_week: 1,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error(`   ❌ Failed to create cycle:`, createError);
      result.errors.push(`User ${typedUser.email || typedUser.id}: ${createError.message}`);
      continue;
    }

    console.log(`   ✅ Cycle created successfully (ID: ${newCycle.id})`);
    result.cyclesCreated++;
  }

  return result;
}

// Main execution
migrateUsers()
  .then((result) => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users:              ${result.totalUsers}`);
    console.log(`Users with cycles:        ${result.usersWithCycles}`);
    console.log(`Users without cycles:     ${result.usersWithoutCycles}`);
    console.log(`Cycles created:           ${result.cyclesCreated}`);
    console.log(`Errors:                   ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log('='.repeat(60));

    if (result.errors.length > 0) {
      console.log('\n⚠️  Migration completed with errors');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('\n❌ Fatal error during migration:', error);
    process.exit(1);
  });
