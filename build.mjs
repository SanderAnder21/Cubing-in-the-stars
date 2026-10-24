// Empaqueta src/ + index.html + css/ en dist/.  npm run build  |  npm run serve
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const serve = process.argv.includes("--serve");
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
const copyStatic = () => { cpSync("index.html", "dist/index.html"); cpSync("css", "dist/css", { recursive: true }); };

const options = { entryPoints: ["src/main.js"], bundle: true, format: "esm", splitting: true, outdir: "dist",
  target: "es2022", minify: !serve, sourcemap: serve, logLevel: "info" };

copyStatic();
if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: "dist", port: 8080 });
  console.log(`Abre http://localhost:${port}  (recarga el navegador tras editar index.html o css/)`);
} else {
  await esbuild.build(options);
}
