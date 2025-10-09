import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fmyomzywzjtxmabvvjcd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  const email = 'test@example.com';
  const password = 'TestPassword123!';
  const fullName = 'Test User';

  console.log(`Creating test user: ${email}`);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm the email
    user_metadata: {
      full_name: fullName
    }
  });

  if (error) {
    console.error('Error creating user:', error);
    process.exit(1);
  }

  console.log('✅ Test user created successfully!');
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('User ID:', data.user.id);
}

createTestUser();
