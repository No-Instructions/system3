import { ObservableSet } from "./ObservableSet";
import { User } from "./User";
import PocketBase, { BaseAuthStore } from "pocketbase";

export class LoginManager extends ObservableSet<User> {
	pb: PocketBase;

	setup(): boolean {
		this.pb = new PocketBase("https://auth.dnup.org");
		if (!this.pb.authStore.isValid) {
			this.notifyListeners(); // notify anyway
			return false;
		}
		const user = this.makeUser(this.pb.authStore);
		this.add(user);
		return true;
	}

	get hasUser() {
		return this.items().length > 0;
	}

	private makeUser(authStore: BaseAuthStore): User {
		return new User(authStore.model?.email, authStore.token);
	}

	public get anon(): User {
		return new User("Anonymous", "");
	}

	public get user(): User {
		if (this.items().length == 0) {
			return this.anon;
		} else if (this.items().length == 1) {
			return this.items()[0];
		}
		throw new Error("Unexpected multiple users in login manager");
	}

	logout() {
		this.pb.authStore.clear();
		this.forEach((user) => {
			this.delete(user);
		});
	}

	async login() {
		if (this.hasUser) {
			return;
		}
		await this.pb.collection("users").authWithOAuth2({
			provider: "google",
		});
		this.setup();
	}
}
