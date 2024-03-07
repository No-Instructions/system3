import { App, ButtonComponent, PluginSettingTab } from "obsidian";
import Live from "src/main";

export class LiveSettingsTab extends PluginSettingTab {
	plugin: Live;
	constructor(app: App, plugin: Live) {
		super(app, plugin);
		this.plugin = plugin;
	}
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Obsidian Live" });
		containerEl.createEl("h3", { text: "Login" });

		if (this.plugin.loginManager.hasUser) {
			containerEl.createEl("p", {
				text: `Logged in as ${this.plugin.loginManager.user.name}`,
			});
			new ButtonComponent(containerEl)
				.setButtonText("Logout")
				.onClick((e) =>
					(() => {
						this.plugin.loginManager.logout();
						this.display();
					})()
				);
		} else {
			new ButtonComponent(containerEl)
				.setButtonText("Login with Google")
				.onClick((e) =>
					(async () => {
						await this.plugin.loginManager.login();
						this.display();
					})()
				);
		}
	}
}
