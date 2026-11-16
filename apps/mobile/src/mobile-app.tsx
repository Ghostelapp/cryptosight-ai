import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import * as WebBrowser from "expo-web-browser";
import { usePathname } from "expo-router";
import {
  mobileCallback,
  mobileRedirectUri,
  mobileTokenPattern,
  serverOrigin,
} from "../../../packages/mobile/protocol.mjs";
import { mobileClient, base64url } from "./api.mjs";
import { translator, errorText } from "./i18n";
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Loading,
  MobileContext,
  Notice,
  colors,
  s,
  useMobile,
} from "./ui";
import type { Instrument, Locale, Session, User } from "./types";

const sessionKey = "cryptosight.session.v1",
  prefsKey = "cryptosight.preferences.v1";
const allowLocalHttp =
  __DEV__ || process.env.EXPO_PUBLIC_ALLOW_LOCAL_HTTP === "true";
const vault = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
type Preferences = { server: string; locale: Locale; biometric: boolean };
type AccountActions = {
  biometric: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  toggleBiometric: () => Promise<void>;
  logout: () => Promise<void>;
  changeServer: () => Promise<void>;
  revalidate: () => Promise<void>;
};
export const AccountContext = createContext<AccountActions | null>(null);
export function useAccountActions() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("Missing account provider");
  return value;
}

function MobileProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false),
    [server, setServer] = useState(""),
    [input, setInput] = useState(process.env.EXPO_PUBLIC_API_URL || "");
  const [locale, setLocaleState] = useState<Locale>("pl"),
    [biometric, setBiometric] = useState(false),
    [locked, setLocked] = useState(false);
  const [session, setSession] = useState<Session | null>(null),
    [user, setUser] = useState<User | null>(null),
    [demo, setDemo] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [instrument, setInstrument] = useState<Instrument>({
    venue: "binance",
    market: "spot",
    symbol: "BTCUSDT",
    timeframe: "1h",
  });
  const busyRef = useRef(false),
    authenticating = useRef(false),
    serverRef = useRef(server),
    sessionRef = useRef(session);
  useEffect(() => {
    serverRef.current = server;
    sessionRef.current = session;
  }, [server, session]);
  const t = useMemo(() => translator(locale), [locale]);
  const clearLocal = useCallback(async () => {
    setSession(null);
    sessionRef.current = null;
    setUser(null);
    setLocked(false);
    await SecureStore.deleteItemAsync(sessionKey);
  }, []);
  const api = useMemo(() => {
    const client = mobileClient(server || "https://localhost.invalid", {
      allowLocalHttp,
    });
    client.setToken(session?.accessToken || null);
    return client;
  }, [server, session?.accessToken]);
  useEffect(() => {
    api.setOnUnauthorized(() => {
      if (
        serverRef.current === server &&
        session?.accessToken &&
        sessionRef.current?.accessToken === session.accessToken
      ) {
        void clearLocal();
        setNotice(t("mobileSessionExpired"));
      }
    });
  }, [api, server, session?.accessToken, t, clearLocal]);
  const prefs = (overrides: Partial<Preferences> = {}) =>
    SecureStore.setItemAsync(
      prefsKey,
      JSON.stringify({ server, locale, biometric, ...overrides }),
      vault,
    );
  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setNotice(errorText(t, e));
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 10000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const rawPrefs = await SecureStore.getItemAsync(prefsKey),
          rawSession = await SecureStore.getItemAsync(sessionKey);
        const saved = rawPrefs ? JSON.parse(rawPrefs) : {};
        const savedServer = saved.server
          ? serverOrigin(saved.server, allowLocalHttp)
          : "";
        if (!mounted) return;
        setServer(savedServer);
        if (savedServer) setInput(savedServer);
        if (["pl", "en", "de"].includes(saved.locale))
          setLocaleState(saved.locale);
        setBiometric(saved.biometric === true);
        const stored = rawSession ? JSON.parse(rawSession) : null;
        if (
          stored &&
          stored.baseUrl === savedServer &&
          mobileTokenPattern.test(stored.accessToken) &&
          Date.parse(stored.expiresAt) > Date.now()
        ) {
          setSession(stored);
          setLocked(saved.biometric === true);
        } else if (rawSession) await SecureStore.deleteItemAsync(sessionKey);
      } catch {
        if (mounted) setNotice(translator("pl")("mobile_invalid_server"));
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (
        state !== "active" &&
        biometric &&
        sessionRef.current &&
        !authenticating.current
      )
        setLocked(true);
    });
    return () => listener.remove();
  }, [biometric]);
  const revalidate = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    const me = await api.request("auth/me");
    if (current !== sessionRef.current) return;
    setUser(me.user || null);
  }, [api]);
  useEffect(() => {
    if (ready && active && !locked && session)
      void revalidate().catch((e) => setNotice(errorText(t, e)));
  }, [ready, active, locked, session, revalidate, t]);
  const login = () =>
    run(async () => {
      authenticating.current = true;
      try {
        const verifier = base64url(await Crypto.getRandomBytesAsync(32));
        const challenge = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          verifier,
          { encoding: Crypto.CryptoEncoding.BASE64 },
        );
        const codeChallenge = challenge
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replace(/=+$/, "");
        const state = Array.from(await Crypto.getRandomBytesAsync(32), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        const grant = await api.request("auth/mobile/start", {
          method: "POST",
          body: { codeChallenge, state },
        });
        const authorization = new URL(grant.authorizeUrl);
        if (
          authorization.origin !== api.baseUrl ||
          authorization.pathname !== "/mobile/connect" ||
          grant.redirectUri !== mobileRedirectUri
        )
          throw new Error("mobile_server_origin");
        setNotice(t("mobileSigningIn"));
        const result = await WebBrowser.openAuthSessionAsync(
          authorization.toString(),
          mobileRedirectUri,
        );
        if (result.type !== "success") {
          setNotice(t("mobileCancelled"));
          return;
        }
        const code = mobileCallback(result.url, grant.requestId, state);
        const exchanged = await api.request("auth/mobile/exchange", {
          method: "POST",
          body: { requestId: grant.requestId, code, codeVerifier: verifier },
        });
        if (
          !mobileTokenPattern.test(exchanged.accessToken) ||
          !(Date.parse(exchanged.expiresAt) > Date.now())
        )
          throw new Error("mobile_login_failed");
        const next = {
          accessToken: exchanged.accessToken,
          expiresAt: exchanged.expiresAt,
          baseUrl: api.baseUrl,
        };
        await SecureStore.setItemAsync(sessionKey, JSON.stringify(next), vault);
        setSession(next);
        sessionRef.current = next;
        setLocked(false);
        setNotice("");
      } finally {
        authenticating.current = false;
      }
    });
  const logout = async () => {
    const current = sessionRef.current;
    await clearLocal();
    if (current) {
      const client = mobileClient(current.baseUrl, { allowLocalHttp });
      client.setToken(current.accessToken);
      await client
        .request("auth/logout", { method: "POST", body: {} })
        .catch(() => {});
    }
  };
  const toggleBiometric = () =>
    run(async () => {
      // This control is reachable only in an unlocked, signed-in account. Let
      // users disable a lock after browser re-authentication if enrollment changed.
      if (biometric) {
        await prefs({ biometric: false });
        setBiometric(false);
        return;
      }
      if (
        !(await LocalAuthentication.hasHardwareAsync()) ||
        !(await LocalAuthentication.isEnrolledAsync())
      )
        throw new Error("mobileBiometricUnavailable");
      authenticating.current = true;
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t("mobileUnlock"),
        });
        if (result.success) {
          await prefs({ biometric: true });
          setBiometric(true);
        }
      } finally {
        authenticating.current = false;
      }
    });
  const unlock = () =>
    run(async () => {
      authenticating.current = true;
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t("mobileUnlock"),
        });
        if (result.success) setLocked(false);
      } finally {
        authenticating.current = false;
      }
    });
  const connect = () =>
    run(async () => {
      const next = serverOrigin(input.trim(), allowLocalHttp),
        client = mobileClient(next, { allowLocalHttp });
      const health = await client.request("health");
      if (health.status !== "ok") throw new Error("mobile_invalid_response");
      await prefs({ server: next });
      setServer(next);
      setDemo(false);
      setNotice(t("mobileConnected"));
    });
  const changeServer = async () => {
    await logout();
    await prefs({ server: "" });
    setServer("");
    setDemo(false);
  };
  const setLocale = async (value: Locale) => {
    await prefs({ locale: value });
    setLocaleState(value);
  };
  const context = {
    api,
    user,
    locale,
    t,
    active: active && !locked,
    demo,
    busy,
    instrument,
    selectInstrument: (value: Partial<Instrument>) =>
      setInstrument((current) => ({ ...current, ...value })),
    login,
    notify: setNotice,
    run,
  };
  return (
    <MobileContext.Provider value={context}>
      <AccountContext.Provider
        value={{
          biometric,
          setLocale,
          toggleBiometric,
          logout,
          changeServer,
          revalidate,
        }}
      >
        <SafeAreaView style={s.container} edges={["top", "left", "right"]}>
          <StatusBar style="light" />
          {!ready ? (
            <Loading loading />
          ) : locked ? (
            <View style={[s.content, { flex: 1, justifyContent: "center" }]}>
              <Card>
                <Heading>{t("mobileLocked")}</Heading>
                <Button
                  title={t("mobileUnlock")}
                  disabled={busy}
                  onPress={() => void unlock()}
                />
                <Button
                  title={t("logout")}
                  secondary
                  onPress={() => void run(logout)}
                />
              </Card>
            </View>
          ) : !server && !demo ? (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView
                contentContainerStyle={[s.content, { paddingTop: 40 }]}
                keyboardShouldPersistTaps="handled"
              >
                <Image
                  source={require("../assets/icon.png")}
                  style={{ width: 88, height: 88, borderRadius: 20 }}
                />
                <Heading>CryptoSight AI</Heading>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 34,
                    fontWeight: "700",
                  }}
                >
                  {t("mobileWelcome")}
                </Text>
                <Label muted>{t("mobileSubtitle")}</Label>
                <Card>
                  <Field
                    label={t("mobileServer")}
                    value={input}
                    onChangeText={setInput}
                    placeholder="https://cryptosight.example.com"
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <Button
                    title={t("mobileConnect")}
                    disabled={busy || !input.trim()}
                    onPress={() => void connect()}
                  />
                  <Button
                    title={t("mobileDemo")}
                    secondary
                    onPress={() => setDemo(true)}
                  />
                </Card>
                <Notice>{t("disclaimer")}</Notice>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            <>
              <View
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  borderBottomColor: colors.line,
                  borderBottomWidth: 1,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "700",
                    fontSize: 18,
                  }}
                >
                  CryptoSight <Text style={{ color: colors.cyan }}>AI</Text>
                </Text>
                {demo && (
                  <Text style={{ color: colors.cyan, fontSize: 12 }}>
                    {t("mobileSample")}
                  </Text>
                )}
                {server.startsWith("http:") && (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {t("mobileLocalHint")}
                  </Text>
                )}
              </View>
              {children}
            </>
          )}
          {!!notice && (
            <View style={{ padding: 12 }}>
              <Notice>{notice}</Notice>
            </View>
          )}
        </SafeAreaView>
      </AccountContext.Provider>
    </MobileContext.Provider>
  );
}
export function MobileApp({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <MobileProvider>{children}</MobileProvider>
    </SafeAreaProvider>
  );
}
export function Screen({
  path,
  children,
}: {
  path: string;
  children: React.ReactNode;
}) {
  const mobile = useMobile(),
    current = usePathname();
  return (
    <MobileContext.Provider
      value={{ ...mobile, active: mobile.active && current === path }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </MobileContext.Provider>
  );
}
