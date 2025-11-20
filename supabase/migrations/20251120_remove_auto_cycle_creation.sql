-- Remove automatic cycle creation on user signup
-- This allows new users to configure their cycle through the onboarding wizard instead

-- Drop the trigger that creates cycles automatically
DROP TRIGGER IF EXISTS on_user_created_create_cycle ON auth.users;

-- Drop the function (keep it commented out in case we need to restore it later)
DROP FUNCTION IF EXISTS public.create_default_cycle();

-- Note: The cycle event logging triggers (on_cycle_created, on_cycle_updated) are kept
-- as they are still useful for tracking cycle changes when users create/update cycles manually
