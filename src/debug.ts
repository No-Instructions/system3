// CurryLog is a way to add tagged logging that is stripped in production

let curryLog: (initialText: string) => (...args: any[]) => void;

if (process.env.NODE_ENV === "production") {
	curryLog = (initialText: string) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (...args: any[]) => {};
	};
} else {
	curryLog = (initialText: string) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (...args: any[]) => console.log(initialText, ": ", ...args);
	};
}

export { curryLog };
