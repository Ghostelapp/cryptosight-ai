export const mobileRedirectUri = "cryptosightai://auth";
export const mobileTokenPattern = /^m_[a-f0-9]{64}$/;
export const mobileRequestPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function serverOrigin(value, allowLocalHttp = false) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new Error("mobile_invalid_server");
  }
  const local =
    /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
      url.hostname,
    );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname) ||
    !(
      url.protocol === "https:" ||
      (allowLocalHttp && local && url.protocol === "http:")
    )
  )
    throw new Error("mobile_invalid_server");
  return url.origin;
}

export function mobileCallback(value, requestId, state) {
  const url = new URL(value);
  if (
    url.protocol !== "cryptosightai:" ||
    url.host !== "auth" ||
    url.pathname ||
    url.username ||
    url.password ||
    url.searchParams.get("requestId") !== requestId ||
    url.searchParams.get("state") !== state ||
    !/^[a-f0-9]{64}$/.test(url.searchParams.get("code") || "")
  )
    throw new Error("mobile_login_failed");
  return url.searchParams.get("code");
}
