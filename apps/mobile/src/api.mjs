import {
  serverOrigin,
  mobileTokenPattern,
} from "../../../packages/mobile/protocol.mjs";

export class MobileApiError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

/** @param {string} origin @param {{allowLocalHttp?: boolean, fetcher?: typeof fetch, onUnauthorized?: () => void}} options */
export function mobileClient(
  origin,
  { allowLocalHttp = false, fetcher = fetch, onUnauthorized = () => {} } = {},
) {
  const baseUrl = serverOrigin(origin, allowLocalHttp);
  let token = null;
  return {
    baseUrl,
    /** @param {() => void} handler */
    setOnUnauthorized(handler) {
      onUnauthorized = handler;
    },
    setToken(value) {
      if (value != null && !mobileTokenPattern.test(value))
        throw new MobileApiError("mobile_login_failed");
      token = value;
    },
    /** @param {string} path @param {{method?: string, body?: unknown, key?: string}} options */
    async request(path, { method = "GET", body, key } = {}) {
      if (
        !/^[a-z0-9][a-z0-9/?=&%._:-]*$/i.test(path) ||
        path.includes("..") ||
        path.includes("://")
      )
        throw new MobileApiError("mobile_invalid_server");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const usedToken = token;
      try {
        const response = await fetcher(baseUrl + "/api/v1/" + path, {
          method,
          credentials: "omit",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            Origin: baseUrl,
            ...(usedToken ? { Authorization: "Bearer " + usedToken } : {}),
            ...(key ? { "idempotency-key": key } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        let value;
        try {
          value = await response.json();
        } catch {
          throw new MobileApiError("mobile_invalid_response", response.status);
        }
        if (!response.ok) {
          if (
            response.status === 401 &&
            usedToken &&
            token === usedToken &&
            value.code === "authentication_required"
          ) {
            token = null;
            onUnauthorized();
          }
          throw new MobileApiError(
            value.code || "service_unavailable",
            response.status,
          );
        }
        return value;
      } catch (error) {
        if (error instanceof MobileApiError) throw error;
        throw new MobileApiError("mobile_network_error");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function mutationIntents(makeKey) {
  const pending = new Map();
  return {
    key(name, body) {
      const fingerprint = JSON.stringify(body);
      if (pending.get(name)?.fingerprint !== fingerprint)
        pending.set(name, { fingerprint, value: makeKey() });
      return pending.get(name).value;
    },
    done(name) {
      pending.delete(name);
    },
  };
}

export function base64url(bytes) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "",
    bits = 0,
    value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      output += alphabet[(value >>> bits) & 63];
    }
  }
  if (bits) output += alphabet[(value << (6 - bits)) & 63];
  return output;
}
