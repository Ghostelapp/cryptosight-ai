import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import type { Api, Instrument, Locale, User } from "./types";
import { errorText, type Translate } from "./i18n";
export const colors = {
  bg: "#080d14",
  panel: "#0e1620",
  input: "#0b131e",
  line: "#223143",
  text: "#e1e9f2",
  muted: "#91a5bc",
  cyan: "#43c4dd",
  green: "#36cfa6",
  red: "#ef8190",
};
export type MobileContextValue = {
  api: Api;
  user: User | null;
  locale: Locale;
  t: Translate;
  active: boolean;
  demo: boolean;
  busy: boolean;
  instrument: Instrument;
  selectInstrument: (value: Partial<Instrument>) => void;
  login: () => Promise<void>;
  notify: (message: string) => void;
  run: (fn: () => Promise<void>) => Promise<void>;
};
export const MobileContext = createContext<MobileContextValue | null>(null);
export function useMobile() {
  const value = useContext(MobileContext);
  if (!value) throw new Error("Missing mobile provider");
  return value;
}
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && { backgroundColor: colors.red },
        (disabled || pressed) && { opacity: 0.5 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.text }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Label({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return <Text style={[s.text, muted && s.muted]}>{children}</Text>;
}
export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={s.heading}>
      {children}
    </Text>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        {...props}
        style={[s.input, props.multiline && { minHeight: 90 }, props.style]}
      />
    </View>
  );
}
export function Choices({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.row}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: value === option.value }}
              onPress={() => onChange(option.value)}
              style={[s.chip, value === option.value && s.selectedChip]}
            >
              <Text
                style={{
                  color: value === option.value ? colors.cyan : colors.text,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
export function Metrics({
  values,
}: {
  values: { label: string; value: string; color?: string }[];
}) {
  return (
    <View style={s.metrics}>
      {values.map((item) => (
        <View style={s.metric} key={item.label}>
          <Text style={s.label}>{item.label}</Text>
          <Text style={[s.metricValue, item.color && { color: item.color }]}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      style={[s.notice, error && { color: colors.red }]}
    >
      {children}
    </Text>
  );
}
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, t, login, busy, demo } = useMobile();
  if (user) return <>{children}</>;
  return (
    <Card>
      <Heading>{t("mobilePrivate")}</Heading>
      <Label muted>{t(demo ? "mobileDemoHint" : "mobileLoginHint")}</Label>
      {!demo && (
        <Button
          title={t("mobileLogin")}
          disabled={busy}
          onPress={() => void login()}
        />
      )}
    </Card>
  );
}
export function useRemote<T>(path: string, enabled = true, interval = 0) {
  const { api, active, demo, t } = useMobile();
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [updatedAt, setUpdatedAt] = useState(0);
  const epoch = useRef(0),
    requestId = useRef(0);
  const refetch = useCallback(async () => {
    if (!enabled || !active || demo) return;
    const version = epoch.current,
      ticket = ++requestId.current;
    setLoading(true);
    try {
      const result = await api.request(path);
      if (version === epoch.current && ticket === requestId.current) {
        setData(result);
        setUpdatedAt(Date.now());
        setError("");
      }
    } catch (e) {
      if (version === epoch.current && ticket === requestId.current)
        setError(errorText(t, e));
    } finally {
      if (version === epoch.current && ticket === requestId.current)
        setLoading(false);
    }
  }, [enabled, active, demo, api, path, t]);
  useEffect(() => {
    const version = ++epoch.current;
    queueMicrotask(() => {
      if (version !== epoch.current) return;
      setData(null);
      setUpdatedAt(0);
      setError("");
      setLoading(false);
      void refetch();
    });
    const timer =
      interval && active && enabled && !demo
        ? setInterval(() => void refetch(), interval)
        : undefined;
    return () => {
      epoch.current = version + 1;
      if (timer) clearInterval(timer);
    };
  }, [path, enabled, active, demo, api, refetch, interval]);
  return { data, error, loading, updatedAt, refetch, setData };
}
export function Loading({ loading }: { loading: boolean }) {
  return loading ? (
    <ActivityIndicator color={colors.cyan} style={{ padding: 15 }} />
  ) : null;
}
export const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 18, gap: 18, paddingBottom: 32 },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    borderRadius: 14,
    gap: 14,
  },
  heading: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  text: { fontSize: 15, lineHeight: 23, color: colors.text },
  muted: { color: colors.muted },
  label: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  field: { gap: 7 },
  input: {
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 16,
    padding: 13,
    minHeight: 48,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.line,
  },
  button: {
    backgroundColor: colors.cyan,
    minHeight: 48,
    borderRadius: 9,
    paddingHorizontal: 15,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 9 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  chip: {
    minHeight: 44,
    padding: 12,
    borderRadius: 9,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.line,
  },
  selectedChip: { borderColor: colors.cyan, backgroundColor: "#12303c" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    minWidth: "44%",
    flexGrow: 1,
    flexBasis: "44%",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 14,
    borderRadius: 11,
    gap: 6,
  },
  metricValue: { color: colors.text, fontWeight: "600", fontSize: 21 },
  notice: {
    color: colors.muted,
    backgroundColor: colors.panel,
    padding: 13,
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  listRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
});
