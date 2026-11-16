import { Redirect } from "expo-router";
// Authentication is completed only by the pending PKCE browser session.
// Opening this route without its in-memory verifier never creates a session.
export default function AuthCallback() {
  return <Redirect href="/account" />;
}
