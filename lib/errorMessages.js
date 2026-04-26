export function getLocalizedErrorMessage(error, t, fallbackKey = 'islemTamamlanamadi') {
  const rawMessage = error?.message || '';
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('email not confirmed') ||
    normalized.includes('invalid credentials')
  ) {
    if (normalized.includes('email not confirmed')) {
      return t('epostaDogrulanmadi');
    }
    return t('hataliGirisBilgileri');
  }

  if (
    normalized.includes('password should be at least') ||
    normalized.includes('weak password')
  ) {
    return t('zayifSifre');
  }

  if (
    normalized.includes('unable to validate email address') ||
    normalized.includes('invalid email') ||
    normalized.includes('email address is invalid')
  ) {
    return t('gecersizEposta');
  }

  if (
    normalized.includes('user already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('already exists')
  ) {
    return t('kullaniciZatenVar');
  }

  if (
    normalized.includes('for security purposes') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests')
  ) {
    return t('cokFazlaIstek');
  }

  if (
    normalized.includes('otp_expired') ||
    normalized.includes('email link is invalid or has expired') ||
    normalized.includes('invalid or has expired') ||
    normalized.includes('expired')
  ) {
    return t('gecersizYenilemeBaglantisi');
  }

  if (
    normalized.includes('network request failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network')
  ) {
    return t('baglantiHatasi');
  }

  return rawMessage || t(fallbackKey);
}
