import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xblfvapvygdtzwvadyld.supabase.co';
const supabaseAnonKey = 'sb_publishable_aq7G8dHgFYl4aeihny2Gug_YRihcQCd';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
