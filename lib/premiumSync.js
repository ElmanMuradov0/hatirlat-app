import { ensureProfile } from './profile';
import {
  configureRevenueCat,
  getCustomerInfo,
  isPremiumActive,
} from './revenuecat';
import { supabase } from './supabase';

export async function syncPremiumStatus(userId, customerInfo = null) {
  if (!userId) {
    return false;
  }

  await configureRevenueCat(userId);

  const profile = await ensureProfile(userId);
  const info = customerInfo || (await getCustomerInfo(userId));
  const premiumEnabled = isPremiumActive(info);

  if (Boolean(profile?.is_premium) !== premiumEnabled) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_premium: premiumEnabled })
      .eq('id', userId);

    if (error) {
      throw error;
    }
  }

  return premiumEnabled;
}
