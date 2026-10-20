// The Project builder: the switches, the "Add to project" buttons of the package table, and the Project estimate
// (mock lines 985 and 1055–1114). STUB until #55: the page keeps the static builder of `index.html`.
import type { HomeContext } from "./home";

/**
 * Starts the Project builder. It renders the switches and the Project estimate, wires every `[data-add]` button
 * (the Twin copy too), sends `add/<package>`, and calls `ctx.language.onChange` to render again in a new language.
 */
export function mountBuilder(_ctx: HomeContext): void {}
