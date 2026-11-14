import { spawn } from "node:child_process";
const python =
  process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const child = spawn(python, ["-X", "utf8", "tests/check_contracts.py"], {
  stdio: "inherit",
});
child.on("error", () => {
  process.stderr.write(
    "Python 3 is required. Install tests/requirements.txt and retry.\n",
  );
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
