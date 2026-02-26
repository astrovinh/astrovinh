-- Add role and onboarding_complete to users table
ALTER TABLE public.users ADD COLUMN role text CHECK (role IN ('parent', 'child'));
ALTER TABLE public.users ADD COLUMN onboarding_complete boolean DEFAULT false;

-- Allow users to insert their own row (safety-net for trigger race conditions)
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create users row when a new auth.users row is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, auth_provider)
  VALUES (NEW.id, NEW.raw_app_meta_data->>'provider')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
