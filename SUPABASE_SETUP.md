# Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in project details:
   - **Name**: `serra-greenhouse`
   - **Database Password**: (generate a strong password and save it securely)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Start with Free tier
4. Click "Create new project"
5. Wait for project to provision (~2 minutes)

## Step 2: Get Project Credentials

1. In Supabase Dashboard, go to **Settings** > **API**
2. Find and copy:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public key**: `eyJh...` (long JWT token)
3. Update `frontend/.env.local`:
   ```env
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJh...your-anon-key...
   ```

## Step 3: Configure Authentication

1. In Supabase Dashboard, go to **Authentication** > **Providers**
2. Enable **Email** provider (enabled by default)
3. Configure email templates (optional):
   - Go to **Authentication** > **Email Templates**
   - Customize "Confirm signup", "Reset password" templates
4. Set **Site URL** in **Authentication** > **URL Configuration**:
   - For development: `http://localhost:5173`
   - For production: `https://your-app.netlify.app`

## Step 4: Set up Database Schema

You have two options:

### Option A: Using Supabase SQL Editor

1. In Supabase Dashboard, go to **SQL Editor**
2. Create a new query
3. Paste the schema from `specs/001-voglio-fare-una/contracts/supabase-schema.sql`
4. Click "Run"

### Option B: Using MCP Supabase (Recommended for Development)

Follow the MCP Supabase setup instructions to connect Claude Code to your Supabase project. Then Phase 2 tasks will create tables automatically.

## Step 5: Verify Setup

1. In Supabase Dashboard, go to **Table Editor**
2. You should see tables after running migrations:
   - `profiles`
   - `devices`
   - `sensors`
   - `actuators`
   - `sensor_readings`
   - `commands`

## Step 6: Test Connection

1. Start frontend: `cd frontend && npm run dev`
2. Open browser console at `http://localhost:5173`
3. Try this in console:
   ```javascript
   import { supabase } from './src/lib/supabase';
   const { data, error } = await supabase.auth.getSession();
   console.log(data, error);
   ```
4. Should return `{ session: null }` without errors

## Step 7: Optional - Install Supabase CLI

For local development and migrations:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Pull remote schema
supabase db pull
```

## Troubleshooting

### "Invalid API key" error
- Double-check `.env.local` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server after changing `.env.local`

### Database connection issues
- Verify project is fully provisioned in Supabase Dashboard
- Check database status in **Settings** > **Database**

### CORS errors
- Verify Site URL is set correctly in Authentication > URL Configuration
- Add your development URL (`http://localhost:5173`) to allowed URLs

## Next Steps

After Supabase is configured:
- **Phase 2**: Create database tables and RLS policies
- **Phase 3**: Implement authentication UI
