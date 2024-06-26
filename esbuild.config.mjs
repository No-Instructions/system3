import esbuild from "esbuild";
import process from "process";
import esbuildSvelte from "esbuild-svelte";
import sveltePreprocess from "svelte-preprocess";
import builtins from "builtin-modules";
import { execSync } from "child_process";
import chokidar from "chokidar";
import path from "path";
import fs from "fs";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const gitTag = execSync("git describe --tags --always", {
	encoding: "utf8",
}).trim();
const healthUrl = `"https://api.dnup.org/health?version=${gitTag}"`;
console.log("git tag:", gitTag);
console.log("health URL", healthUrl);

const watch = process.argv[2] === "watch";
const debug = process.argv[2] === "debug" || process.argv[2] === "watch";
const out = process.argv[3] || ".";

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins,
	],
	format: "cjs",
	plugins: [
		esbuildSvelte({
			compilerOptions: { css: true },
			preprocess: sveltePreprocess(),
		}),
	],

	target: "es2018",
	logLevel: "info",
	sourcemap: debug ? "inline" : false,
	define: {
		BUILD_TYPE: debug ? '"debug"' : '"prod"',
		GIT_TAG: `"${gitTag}"`,
		HEALTH_URL: healthUrl,
	},
	treeShaking: true,
	outfile: out + "/main.js",
});

const copyFile = (src, dest) => {
    if (src === dest) {
        return
    }
	fs.copyFileSync(src, dest);
	console.log(`Copied ${src} to ${dest}`);
};

const watchAndMove = (fnames, mapping) => {
	// only usable on top level directory
	const watcher = chokidar.watch(fnames, {
		ignored: /(^|[\/\\])\../, // ignore dotfiles
		persistent: true,
	});

	watcher.on("change", (filePath) => {
		const destName = mapping[filePath] || filePath;
		const destPath = path.join(out, path.basename(destName));
		copyFile(filePath, destPath);
	});
};

const move = (fnames) => {
	// only usable on top level directory
	for (const fname of fnames) {
		copyFile(fname, path.join(out, fname));
	}
};

if (watch) {
	await context.watch();
	watchAndMove(["styles.css", "manifest-beta.json"], {
		"manifest-beta.json": "manifest.json",
	});
} else {
	await context.rebuild();
	move(["styles.css", "manifest.json"]);
	process.exit(0);
}
