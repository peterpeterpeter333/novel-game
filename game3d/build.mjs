// バンドル + 単一HTML生成
// 使い方: node build.mjs
import { buildSync } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

buildSync({
  entryPoints: [join(root, "src/main.js")],
  bundle: true,
  minify: true,
  format: "iife",
  outfile: join(root, "bundle.js"),
});

let js = readFileSync(join(root, "bundle.js"), "utf8");
js = js.replace(/<\/script>/g, "<\\/script>");
let html = readFileSync(join(root, "index.html"), "utf8");
html = html.replace('<script src="bundle.js"></script>', () => "<script>\n" + js + "\n</script>");

mkdirSync(join(root, "../game/dist"), { recursive: true });
writeFileSync(join(root, "../game/dist/kabeuchi_3d.html"), html);

// アーティファクト用（doctype/html/head/body ラッパ無し）
let art = html.replace(/^<!doctype html>\s*/i, "").replace(/<html[^>]*>\s*/i, "").replace(/<\/html>\s*$/i, "");
art = art.replace(/<head>[\s\S]*?<\/head>/i, (m) => {
  const t = m.match(/<title>[\s\S]*?<\/title>/i);
  const s = m.match(/<style>[\s\S]*?<\/style>/i);
  return (t ? t[0] : "") + "\n" + (s ? s[0] : "");
});
art = art.replace(/<body([^>]*)>/i, "").replace(/<\/body>\s*/i, "");
writeFileSync(join(root, "../game/dist/kabeuchi_3d_artifact.html"), art);

console.log("built:", (html.length / 1024).toFixed(0) + "KB");
