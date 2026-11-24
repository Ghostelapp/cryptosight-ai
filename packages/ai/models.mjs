// Only trusted provider endpoints receive credentials; redirects are forbidden.
export async function listModels(provider, key, fetcher = fetch) {
  let base, headers;
  if (provider === "local") {
    base = process.env.LOCAL_LLM_URL;
    if (!base) throw new Error("local_provider_not_configured");
    const url = new URL(base);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !(process.env.LOCAL_LLM_ALLOWED_HOSTS || "localhost,127.0.0.1,ollama")
        .split(",")
        .includes(url.hostname)
    )
      throw new Error("provider_host_not_allowed");
    base = base.replace(/\/$/, "") + "/models";
    headers = { authorization: `Bearer ${key}` };
  } else {
    base = {
      openai: "https://api.openai.com/v1/models",
      openrouter: "https://openrouter.ai/api/v1/models/user",
      anthropic: "https://api.anthropic.com/v1/models?limit=100",
      gemini:
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
    }[provider];
    if (!base) throw new Error("invalid_provider");
    headers =
      provider === "gemini"
        ? { "x-goog-api-key": key }
        : provider === "anthropic"
          ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
          : { authorization: `Bearer ${key}` };
  }
  const result = new Map();
  const seen = new Set();
  let next = base;
  const signal = AbortSignal.timeout(20000);
  for (let page = 0; next && page < 20; page++) {
    if (seen.has(next)) throw new Error("model_catalog_unavailable");
    seen.add(next);
    let response, data;
    try {
      response = await fetcher(next, { headers, redirect: "error", signal });
      if (response.status === 401 || response.status === 403)
        throw new Error("provider_key_rejected");
      if (!response.ok) throw new Error("model_catalog_unavailable");
      data = await response.json();
    } catch (e) {
      throw new Error(
        e.message === "provider_key_rejected"
          ? e.message
          : "model_catalog_unavailable",
      );
    }
    const rows = provider === "gemini" ? data.models : data.data;
    if (!Array.isArray(rows)) throw new Error("model_catalog_unavailable");
    for (const row of rows) {
      if (
        provider === "gemini" &&
        !row.supportedGenerationMethods?.includes("generateContent")
      )
        continue;
      // Exclude known non-chat OpenAI products; unknown/new text models remain selectable.
      if (
        provider === "openai" &&
        /(?:embedding|whisper|tts|dall-e|transcribe|moderation|realtime|audio|sora|image)/i.test(
          row.id || "",
        )
      )
        continue;
      if (
        provider === "openrouter" &&
        row.architecture?.output_modalities &&
        !row.architecture.output_modalities.includes("text")
      )
        continue;
      const id =
        provider === "gemini" ? row.name?.replace(/^models\//, "") : row.id;
      if (typeof id !== "string" || !/^[a-zA-Z0-9._:/-]{1,100}$/.test(id))
        continue;
      const name = String(
        row.displayName || row.display_name || row.name || id,
      ).slice(0, 200);
      result.set(id, { id, name });
    }
    next = null;
    if (provider === "gemini" && data.nextPageToken) {
      const url = new URL(base);
      url.searchParams.set("pageToken", data.nextPageToken);
      next = url.href;
    } else if (provider === "anthropic" && data.has_more) {
      if (!data.last_id) throw new Error("model_catalog_unavailable");
      const url = new URL(base);
      url.searchParams.set("after_id", data.last_id);
      next = url.href;
    }
  }
  if (next) throw new Error("model_catalog_unavailable");
  return {
    provider,
    models: [...result.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
