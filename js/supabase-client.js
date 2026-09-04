// Help-Shelf — Supabase client
const SUPABASE_URL = "https://owgjeselbyuvnecyxmji.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Z2plc2VsYnl1dm5lY3l4bWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MTIxNDgsImV4cCI6MjEwNDA4ODE0OH0.muAbl0XiTTfllIa_rlhstDPWDP88gnsJD_MJx9TjbbQ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);