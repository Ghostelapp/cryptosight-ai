import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MobileApp } from "../mobile-app";
import { colors, useMobile } from "../ui";
function Navigation() {
  const { t } = useMobile();
  const items = {
    index: ["mobileAllMarkets", "stats-chart"],
    analysis: ["mobileAnalysis", "sparkles"],
    paper: ["paper", "wallet"],
    journal: ["journal", "book"],
    account: ["mobileAccount", "person-circle"],
  } as const;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.line,
        },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      {Object.entries(items).map(([name, [label, icon]]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(label),
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={icon}
                size={size}
                color={typeof color === "string" ? color : colors.muted}
              />
            ),
          }}
        />
      ))}
      <Tabs.Screen name="auth" options={{ href: null }} />
    </Tabs>
  );
}
export default function Layout() {
  return (
    <MobileApp>
      <Navigation />
    </MobileApp>
  );
}
