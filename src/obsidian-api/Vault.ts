"use strict";
import {
	App,
	FileSystemAdapter,
	TAbstractFile,
	TFolder,
	TFile,
} from "obsidian";
import { Observable } from "lib0/observable";
import { tmpdir } from "os";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	renameSync,
	open,
	writeFileSync,
	unlinkSync,
} from "fs";
import { randomUUID } from "crypto";
import path, { dirname, join } from "path";

// Ok, so we want to factor out the vault behavior...
// So a base vault should support registering and triggerings signals.
// Ideally the plugin would be able to run without obsidian...
// It might be really hard to do that without being able to replicate inotify and stuff...

type FileLike = string | TAbstractFile;

export class FilePath {
	path: string;
	isDir: boolean;
	tfile?: TFile;
	constructor(file: FileLike, isDir?: boolean) {
		this.isDir = isDir || file instanceof TFolder;
		this.path = file instanceof TAbstractFile ? file.path : file;
		this.tfile = file instanceof TFile ? file : undefined;
	}
}
export interface Vault extends Observable<string> {
	get root(): string;
	getFiles(): FilePath[];
	trashLocal(path: string): void;
	fullPath(name: string): string;
	createFolder(path: string): Promise<TFolder>;
	exists(name: string): boolean;
	rename(file: TAbstractFile, newName: string): void;
	getFolderByPath(path: string): TFolder | null;
	getAbstractFileByPath(path: string): TAbstractFile | null;

	on(name: "create", f: (arg0: FilePath) => void): void;
	on(name: "delete", f: (arg0: FilePath) => void): void;
	on(name: "modify", f: (arg0: FilePath) => void): void;
	on(name: "rename", f: (arg0: FilePath, arg1: string) => void): void;
	//once(name: string, f: () => void): void;
	//off(name: string, f: () => void): void;

	emit(name: "create", args: [FilePath]): void;
	emit(name: "delete", args: [FilePath]): void;
	emit(name: "modify", args: [FilePath]): void;
	emit(name: "rename", args: [FilePath, string]): void;
}

export class VaultFacade extends Observable<string> implements Vault {
	app: App;

	constructor(app: App) {
		super();
		this.app = app;

		this.app.vault.on("create", (file: TAbstractFile) => {
			if (file instanceof TFolder) return;
			this.emit("create", [new FilePath(file)]);
		});

		this.app.vault.on("delete", (file: TAbstractFile) => {
			if (file instanceof TFolder) return;
			this.emit("delete", [new FilePath(file)]);
		});

		this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
			if (file instanceof TFolder) return;
			this.emit("rename", [new FilePath(file), oldPath]);
		});

		this.app.vault.on("modify", (file: TAbstractFile) => {
			if (file instanceof TFolder) return;
			this.emit("modify", [new FilePath(file)]);
		});
	}

	public exists(name: string): boolean {
		return existsSync(this.fullPath(name));
	}

	public getName(): string {
		return this.app.vault.getName();
	}

	public get root(): string {
		const vaultRoot = (
			this.app.vault.adapter as FileSystemAdapter
		).getBasePath();
		return vaultRoot + "/";
	}

	fullPath(name: string): string {
		return path.join(this.root, name);
	}

	getFiles(): FilePath[] {
		return this.app.vault.getFiles().map((tfile) => new FilePath(tfile));
	}

	getAbstractFileByPath(path: string): TAbstractFile | null {
		if (!this.exists(path)) {
			return null;
		}
		return this.app.vault.getAbstractFileByPath(path);
	}

	getFolderByPath(path: string): TFolder | null {
		if (!this.exists(path)) {
			return null;
		}
		const maybeFolder = this.app.vault.getAbstractFileByPath(path);
		if (maybeFolder instanceof TFolder) {
			return maybeFolder;
		}
		return null;
	}

	rename(file: TAbstractFile, newName: string) {
		this.app.vault.rename(file, newName);
	}

	createFolder(path: string): Promise<TFolder> {
		return this.app.vault.createFolder(path);
	}

	iterateFolders(fn: (folder: TFolder) => void) {
		function iterateFolders(folder: TFolder) {
			fn(folder);
			// Iterate over child folders
			folder.children.forEach((child) => {
				if (child instanceof TFolder) {
					iterateFolders(child);
				}
			});
		}

		const rootFolder: TFolder = this.app.vault.getRoot();
		iterateFolders(rootFolder);
	}

	trashLocal(path: string) {
		return this.app.vault.adapter.trashLocal(path);
	}
}

export class SimpleVault extends Observable<string> implements Vault {
	_root: string;

	constructor(path: string) {
		super();
		this._root = path;
	}

	public exists(name: string): boolean {
		return existsSync(this.fullPath(name));
	}
	getFiles(): FilePath[] {
		const files: FilePath[] = [];
		const walkDirectory = (dirPath: string): void => {
			const entries = readdirSync(dirPath, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.name.startsWith(".")) continue;
				const fullPath = join(dirPath, entry.name);
				if (entry.isDirectory()) {
					walkDirectory(fullPath);
				} else {
					// Assuming TFile can be constructed from a full path
					files.push(new FilePath(fullPath.slice(this.root.length)));
				}
			}
		};
		walkDirectory(this.root);
		return files.reverse();
	}

	public get root(): string {
		return this._root;
	}

	public trashLocal(path: string): void {
		unlinkSync(this.fullPath(path));
		this.emit("delete", [new FilePath(path)]);
	}

	private mkdirp(dir: string) {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		return dir;
	}

	fullPath(name: string): string {
		return `${this.root}/${name}`;
	}

	public rename(file: TAbstractFile, newName: string): void {
		renameSync(this.fullPath(file.path), this.fullPath(newName));
		this.emit("rename", [new FilePath(this.fullPath(newName)), file.path]);
	}

	public newFile(name: string, contents: string) {
		const dir = this.fullPath(dirname(name));
		if (!this.exists(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		open(this.fullPath(name), "w", (err, fd) => {
			if (err) {
				console.error(err);
			}
			writeFileSync(fd, contents);
		});
		this.emit("create", [new FilePath(name)]);
	}

	getFolderByPath(path: string): TFolder | null {
		if (!this.exists(path)) {
			return null;
		}
		const folder = new TFolder();
		folder.name = path;
		folder.path = path;
		// XXX missing a bunch of vault functionality...
		// @ts-ignore
		folder.vault = this;
		return folder;
	}

	getAbstractFileByPath(path: string): TAbstractFile | null {
		if (!this.exists(path)) {
			return null;
		}
		const file = new TFile();
		// XXX missing a bunch of vault functionality...
		file.path = path;
		// @ts-ignore
		file.vault = this;
		return file;
	}

	createFolder(path: string): Promise<TFolder> {
		// XXX this is upposed to error if the path exists...
		mkdirSync(this.fullPath(path), { recursive: true });
		const dir = this.getFolderByPath(path);
		if (!dir) {
			throw new Error("Failed to create folder");
		}
		return Promise.resolve(dir);
	}
}

export class ShadowVault extends SimpleVault implements Vault {
	constructor(vault: Vault) {
		super(vault.root);
	}
}
export class TestVault extends SimpleVault implements Vault {
	constructor() {
		super(`${tmpdir()}/test-${randomUUID()}`);
	}
}
