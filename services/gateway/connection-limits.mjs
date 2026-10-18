export function createConnectionLimiter(limit) {
  const connections = new Map();
  return (key) => {
    const current = connections.get(key) || 0;
    if (current >= limit) return null;
    connections.set(key, current + 1);
    let reserved = true;
    return () => {
      if (!reserved) return;
      reserved = false;
      const remaining = (connections.get(key) || 1) - 1;
      if (remaining) connections.set(key, remaining);
      else connections.delete(key);
    };
  };
}
