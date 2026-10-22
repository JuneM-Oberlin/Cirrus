const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicDir = path.resolve(__dirname, "..", "public");

// Design values (colors, lengths, durations, easings) belong in theme.css.
// Media query breakpoints are the one exception: CSS cannot put a custom
// property inside @media.
const PATTERNS = {
    color: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/,
    length: /(?<![\w.-])-?\d*\.?\d+(px|em|rem|vh|vw)\b/,
    duration: /(?<![\w.-])\d*\.?\d+m?s\b/,
    easing: /cubic-bezier\(/,
};

function withoutComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

test("stylesheets other than theme.css use tokens for every design value", () => {
    const sheets = fs.readdirSync(publicDir).filter((file) => file.endsWith(".css") && file !== "theme.css");
    assert.ok(sheets.length >= 6, "found the component stylesheets");

    const problems = [];
    sheets.forEach((file) => {
        const lines = withoutComments(fs.readFileSync(path.join(publicDir, file), "utf8")).split("\n");
        lines.forEach((line, index) => {
            if (line.trim().startsWith("@media")) {
                return;
            }
            Object.entries(PATTERNS).forEach(([kind, pattern]) => {
                if (pattern.test(line)) {
                    problems.push(`${file}:${index + 1} hard-coded ${kind}: ${line.trim()}`);
                }
            });
        });
    });
    assert.deepEqual(problems, []);
});

test("every token a stylesheet uses is defined in theme.css", () => {
    const theme = fs.readFileSync(path.join(publicDir, "theme.css"), "utf8");
    const defined = new Set([...theme.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    // set at runtime by JavaScript, not by the theme
    ["--view-index", "--heat-amp", "--heat-speed", "--channel-globe-image"].forEach((name) => defined.add(name));

    const missing = [];
    fs.readdirSync(publicDir).filter((file) => file.endsWith(".css")).forEach((file) => {
        const css = fs.readFileSync(path.join(publicDir, file), "utf8");
        for (const match of css.matchAll(/var\((--[\w-]+)/g)) {
            if (!defined.has(match[1])) {
                missing.push(`${file}: ${match[1]}`);
            }
        }
    });
    assert.deepEqual([...new Set(missing)], []);
});
