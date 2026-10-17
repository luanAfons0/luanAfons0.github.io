import { SETTINGS_STORAGE_KEY } from "./game/settings";
import { THEMES } from "./game/theme";

/** The mark in the head of each page that the Theme head script replaces. */
export const THEME_SCRIPT_MARK = "<!--theme-script-->";

/**
 * The Theme head script: a classic inline script that sets the saved Theme (`theme` in the settings)
 * as `data-theme` on the root, before the first paint. It accepts only the ids in `THEMES`, so a new
 * Theme is never missing from a page. With no saved Theme, a Theme that is not in the list, or blocked
 * storage, it sets nothing and the CSS follows the system light or dark setting.
 */
export function themeScriptTag(): string {
	return `<script>
try {
	const savedTheme = JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_STORAGE_KEY)})).theme;
	if (${JSON.stringify(THEMES)}.includes(savedTheme)) document.documentElement.dataset.theme = savedTheme;
} catch {
	// No saved settings, or storage is blocked: follow the system setting.
}
</script>`;
}

/**
 * Puts the Theme head script into a page, at its mark. The `theme-script` plugin in `vite.config.ts`
 * runs it on the Title Screen and the Skip View. It fails when the page has no mark, so a page cannot
 * lose its Theme without notice.
 */
export function withThemeScript(html: string): string {
	if (!html.includes(THEME_SCRIPT_MARK)) throw new Error(`The page has no ${THEME_SCRIPT_MARK} mark.`);
	return html.replace(THEME_SCRIPT_MARK, themeScriptTag());
}
