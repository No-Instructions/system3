// Debug Tool
export function curryLog(initialText: string) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (...args: any[]) => console.log(initialText, ": ", ...args);
}

//export function curryLog(initialText: string) {
//	// eslint-disable-next-line @typescript-eslint/no-explicit-any
//	return (...args: any[]) => {};
//}
