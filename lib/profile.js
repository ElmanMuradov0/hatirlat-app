import { supabase } from './supabase';

export const FREE_CREDITS = 5;

export async function ensureProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, additional_credits, used_credits, is_premium')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const newProfile = {
    id: userId,
    additional_credits: 0,
    used_credits: 0,
    is_premium: false,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .upsert(newProfile, { onConflict: 'id' })
    .select('id, additional_credits, used_credits')
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted;
}

export function calculateRemainingCredits(profile) {
  const additionalCredits = profile?.additional_credits || 0;
  const usedCredits = profile?.used_credits || 0;
  return Math.max(0, FREE_CREDITS + additionalCredits - usedCredits);
}
