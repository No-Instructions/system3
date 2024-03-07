import matter from "gray-matter";

interface Frontmatter {
	[key: string]: any; // Flexible to accommodate any frontmatter schema
}

/**
 * Injects a new entry into the frontmatter of a Markdown string idempotently.
 *
 * @param markdownString The Markdown string to modify.
 * @param newEntry The new frontmatter entry to inject.
 * @returns The modified Markdown string with the updated frontmatter.
 */
export function updateFrontMatter(
	markdownString: string,
	newEntry: Frontmatter
): string {
	// Parse the Markdown string to separate frontmatter and content
	const parsed = matter(markdownString);

	// Check and inject the new entry if it doesn't exist
	let entryExists = false;
	for (const key in newEntry) {
		if (parsed.data.hasOwnProperty(key)) {
			entryExists = true;
			parsed.data[key] = newEntry[key];
			break;
		}
	}

	if (!entryExists) {
		// Merge the new entry with the existing frontmatter
		parsed.data = {
			...parsed.data,
			...newEntry,
		};
	}

	// Recombine the frontmatter and content into a single Markdown string
	const result = matter.stringify(parsed.content, parsed.data);
	return result.slice(0, -1); // remove trailing \n
}

export function hasKey(markdownString: string, keyMatch: string) {
	const parsed = matter(markdownString);
	return parsed.data.hasOwnProperty(keyMatch);
}
