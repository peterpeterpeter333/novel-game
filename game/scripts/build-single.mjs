// 配布用の単一HTMLを生成する。
// 使い方: node game/scripts/build-single.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

let html = read("index.html");

html = html.replace(
  '<link rel="stylesheet" href="css/theme.css">',
  "<style>\n" + read("css/theme.css") + "\n</style>"
);

for (const src of ["js/engine.js", "scenarios/kabeuchi_ch1.js", "js/main.js"]) {
  html = html.replace(
    `<script src="${src}"></script>`,
    "<script>\n" + read(src) + "\n</script>"
  );
}

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/kabeuchi_demo.html"), html);
console.log("built: game/dist/kabeuchi_demo.html (" + html.length + " bytes)");
