// Help-Shelf — Supabase client
const SUPABASE_URL = "https://pgwooizptjhjwtrosxlk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnd29vaXpwdGpoand0cm9zeGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTMwMDAsImV4cCI6MjEwMTQyOTAwMH0.F6mmrMdHjjYQXe1evwFC9xK-DfPVhESNvl2WZpDWx_s";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
