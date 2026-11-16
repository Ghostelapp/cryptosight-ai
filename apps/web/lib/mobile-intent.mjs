import { mobileRequestPattern } from "../../../packages/mobile/protocol.mjs";
const key = "cryptosight.mobile-connect";
export function rememberMobileRequest(storage, id, now = Date.now()) {
  if (!mobileRequestPattern.test(id || "")) return false;
  try {
    storage.setItem(key, JSON.stringify({ id, expires: now + 300000 }));
    return true;
  } catch {
    return false;
  }
}
export function consumeMobileRequest(storage, now = Date.now()) {
  try {
    const raw = storage.getItem(key);
    storage.removeItem(key);
    const value = JSON.parse(raw || "null");
    return value &&
      mobileRequestPattern.test(value.id) &&
      value.expires > now &&
      value.expires <= now + 300000
      ? value.id
      : null;
  } catch {
    return null;
  }
}
