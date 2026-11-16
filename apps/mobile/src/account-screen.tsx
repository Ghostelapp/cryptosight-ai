import { useState } from "react";
import { Alert, Linking, Switch, View } from "react-native";
import { useAccountActions } from "./mobile-app";
import {
  AuthGate,
  Button,
  Card,
  Choices,
  Field,
  Heading,
  Label,
  Notice,
  s,
  useMobile,
  useRemote,
} from "./ui";
import { number } from "./i18n";
import type { Locale } from "./types";
function Settings() {
  const { api, user, instrument, locale, t, busy, run, notify } = useMobile();
  const { biometric, toggleBiometric, logout } = useAccountActions();
  const credentials =
    useRemote<{ id: string; provider: string }[]>("credentials");
  const alerts = useRemote<any[]>("alerts"),
    notifications = useRemote<any[]>("notifications", true, 20000);
  const [provider, setProvider] = useState("openai"),
    [key, setKey] = useState(""),
    [price, setPrice] = useState(""),
    [comparison, setComparison] = useState("above");
  const [deleteConfirmation, setDeleteConfirmation] = useState(""),
    [password, setPassword] = useState("");
  const removeAccount = () =>
    Alert.alert(t("mobileDeleteTitle"), t("mobileDeleteHint"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("deleteAccount"),
        style: "destructive",
        onPress: () =>
          void run(async () => {
            await api.request("account", {
              method: "DELETE",
              body: { ...(user?.has_password ? { password } : {}) },
            });
            setPassword("");
            setDeleteConfirmation("");
            await logout();
          }),
      },
    ]);
  return (
    <>
      <Card>
        <Heading>
          {user?.email || user?.wallet_address || t("walletAccount")}
        </Heading>
        <Label muted>
          {t("timezone")}: {user?.timezone}
        </Label>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Label>{t("mobileBiometric")}</Label>
          <Switch
            accessibilityLabel={t("mobileBiometric")}
            value={biometric}
            disabled={busy}
            onValueChange={() => void toggleBiometric()}
          />
        </View>
        <Label muted>{t("mobileBiometricHint")}</Label>
        <Button
          title={t("logout")}
          secondary
          disabled={busy}
          onPress={() =>
            Alert.alert(t("mobileConfirmLogout"), "", [
              { text: t("cancel"), style: "cancel" },
              { text: t("logout"), onPress: () => void run(logout) },
            ])
          }
        />
      </Card>
      <Card>
        <Heading>{t("apiKey")}</Heading>
        <Notice>{t("keyHint")}</Notice>
        {credentials.data?.map((credential) => (
          <View key={credential.id} style={s.listRow}>
            <Label>{credential.provider} · ✓</Label>
            <Button
              title={t("delete")}
              secondary
              disabled={busy}
              onPress={() =>
                Alert.alert(t("delete"), credential.provider, [
                  { text: t("cancel"), style: "cancel" },
                  {
                    text: t("delete"),
                    style: "destructive",
                    onPress: () =>
                      void run(async () => {
                        await api.request("credentials/" + credential.id, {
                          method: "DELETE",
                          body: {},
                        });
                        await credentials.refetch();
                      }),
                  },
                ])
              }
            />
          </View>
        ))}
        <Choices
          label={t("provider")}
          value={provider}
          onChange={setProvider}
          options={["openai", "gemini", "anthropic", "openrouter"].map(
            (value) => ({ value, label: value }),
          )}
        />
        <Field
          label={t("apiKey")}
          value={key}
          onChangeText={setKey}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="off"
          maxLength={1000}
        />
        <Button
          title={t("mobileProviderKey")}
          disabled={busy || key.trim().length < 8}
          onPress={() =>
            void run(async () => {
              await api.request("credentials", {
                method: "POST",
                body: { provider, key: key.trim() },
              });
              setKey("");
              await credentials.refetch();
              notify(t("mobileSaved"));
            })
          }
        />
        {!!credentials.error && <Notice error>{credentials.error}</Notice>}
      </Card>
      <Card>
        <Heading>{t("mobileAlerts")}</Heading>
        <Label>
          {instrument.symbol} · {instrument.venue}
        </Label>
        <Choices
          label={t("condition")}
          value={comparison}
          onChange={setComparison}
          options={["above", "below"].map((value) => ({
            value,
            label: t(value),
          }))}
        />
        <Field
          label={t("price")}
          value={price}
          onChangeText={(v) => setPrice(v.replace(",", "."))}
          keyboardType="decimal-pad"
        />
        <Label muted>
          {t("channelLabel")}: {t("in_app")}
        </Label>
        <Button
          title={t("mobileAlertCreate")}
          disabled={busy || !(Number(price) > 0)}
          onPress={() =>
            void run(async () => {
              await api.request("alerts", {
                method: "POST",
                body: {
                  kind: "price",
                  condition: {
                    ...instrument,
                    comparison,
                    price: Number(price),
                  },
                  channels: ["in_app"],
                },
              });
              setPrice("");
              await alerts.refetch();
            })
          }
        />
        {alerts.data?.map((alert) => (
          <View key={alert.id} style={s.listRow}>
            <View style={{ flex: 1 }}>
              <Label>
                {alert.condition.symbol} · {t(alert.kind)}
              </Label>
              <Label muted>
                {t(alert.condition.comparison || "condition")}{" "}
                {number(locale, alert.condition.price, 6)}
              </Label>
            </View>
            <Button
              title={t("delete")}
              secondary
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await api.request("alerts/" + alert.id, {
                    method: "DELETE",
                    body: {},
                  });
                  await alerts.refetch();
                })
              }
            />
          </View>
        ))}
        {!!alerts.error && <Notice error>{alerts.error}</Notice>}
      </Card>
      <Card>
        <Heading>{t("notifications")}</Heading>
        {notifications.data?.slice(0, 20).map((notification) => (
          <View key={notification.id}>
            <Label>{t(notification.kind || "notifications")}</Label>
            <Label muted>
              {notification.message ||
                JSON.stringify(notification.payload || notification.body || {})}
            </Label>
          </View>
        ))}
        {!notifications.data?.length && <Label muted>{t("empty")}</Label>}
        {!!notifications.error && <Notice error>{notifications.error}</Notice>}
      </Card>
      <Card>
        <Heading>{t("deleteAccount")}</Heading>
        {user?.role === "admin" ? (
          <Notice>{t("mobileDeleteAdmin")}</Notice>
        ) : (
          <>
            <Notice>{t("mobileDeleteHint")}</Notice>
            <Field
              label="DELETE"
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              autoCapitalize="characters"
            />
            {user?.has_password && (
              <Field
                label={t("password")}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            )}
            <Button
              title={t("deleteAccount")}
              danger
              disabled={
                busy ||
                deleteConfirmation !== "DELETE" ||
                (!!user?.has_password && !password)
              }
              onPress={removeAccount}
            />
          </>
        )}
      </Card>
    </>
  );
}
export function AccountScreen() {
  const { api, t, locale, demo, busy, run } = useMobile(),
    { setLocale, changeServer } = useAccountActions();
  return (
    <>
      <Card>
        <Heading>{t("mobileAccount")}</Heading>
        <Choices
          label={t("language")}
          value={locale}
          onChange={(value) => void run(() => setLocale(value as Locale))}
          options={[
            { value: "pl", label: "Polski" },
            { value: "en", label: "English" },
            { value: "de", label: "Deutsch" },
          ]}
        />
        <Label muted>{demo ? t("mobileDemoHint") : api.baseUrl}</Label>
        {!demo && (
          <Button
            title={t("mobileOpenWeb")}
            secondary
            onPress={() => void Linking.openURL(api.baseUrl)}
          />
        )}
        <Button
          title={t("mobileSetup")}
          secondary
          disabled={busy}
          onPress={() => void run(changeServer)}
        />
      </Card>
      <AuthGate>
        <Settings />
      </AuthGate>
      <Notice>{t("disclaimer")}</Notice>
    </>
  );
}
