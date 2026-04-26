let latestDeepLink = null;

export function setLatestDeepLink(url) {
  latestDeepLink = url || null;
}

export function getLatestDeepLink() {
  return latestDeepLink;
}
