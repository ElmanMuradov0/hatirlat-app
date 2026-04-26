import { supabase } from './supabase';

function parseHashParams(hash) {
  if (!hash) {
    return {};
  }

  return Object.fromEntries(new URLSearchParams(hash).entries());
}

export function parseAuthCallbackUrl(url) {
  if (!url) {
    return { path: '', params: {} };
  }

  const [baseUrl, hash = ''] = url.split('#');
  const normalizedBaseUrl = baseUrl.replace('pingy://', '');
  const [pathPart = '', queryString = ''] = normalizedBaseUrl.split('?');
  const queryParams = Object.fromEntries(new URLSearchParams(queryString).entries());
  const hashParams = parseHashParams(hash);

  return {
    path: pathPart,
    params: {
      ...queryParams,
      ...hashParams,
    },
  };
}

export function getCallbackLocale(url) {
  const { params } = parseAuthCallbackUrl(url);
  return params.lang === 'en' ? 'en' : 'tr';
}

export function getAuthCallbackError(url) {
  const { params } = parseAuthCallbackUrl(url);
  return params.error_description || params.error || null;
}

export async function establishSessionFromUrl(url) {
  const { params } = parseAuthCallbackUrl(url);

  if (params.error_description || params.error) {
    throw new Error(params.error_description || params.error);
  }

  if (!params.access_token || !params.refresh_token) {
    throw new Error('invalid_or_expired_link');
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });

  if (error) {
    throw error;
  }

  return data.session;
}
