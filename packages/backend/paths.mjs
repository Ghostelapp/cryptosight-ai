import { resolve } from "node:path";

export function projectRoot(
  cwd = process.cwd(),
  override = process.env.PROJECT_ROOT,
) {
  return (
    override || (/[\\/]apps[\\/]web$/.test(cwd) ? resolve(cwd, "../..") : cwd)
  );
}
