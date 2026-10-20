// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Home, mountHome } from "./home";
import { loadHomeBody } from "./test-support/page";

let homes: Home[] = [];

function mount(): Home {
	const home = mountHome(document);
	homes.push(home);
	return home;
}

function el<E extends HTMLElement = HTMLElement>(selector: string): E {
	const found = document.querySelector<E>(selector);
	if (!found) throw new Error(`no ${selector}`);
	return found;
}

const submit = () =>
	el<HTMLFormElement>("#form").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
const type = (id: string, value: string) => {
	el<HTMLInputElement>(`#${id}`).value = value;
};
const fillValid = () => {
	type("f-name", "Maria Silva");
	type("f-url", "https://loja.com.br");
	type("f-msg", "I need a faster checkout.");
};
const copyButton = (id: string) => el(`[data-copy="${id}"]`);
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
	loadHomeBody();
	localStorage.clear();
});

afterEach(() => {
	for (const home of homes) home.dispose();
	homes = [];
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("the copy buttons", () => {
	it("writes the text to the clipboard and shows Copied, then Copy again", async () => {
		const write = vi.fn(() => Promise.resolve());
		vi.spyOn(navigator.clipboard, "writeText").mockImplementation(write);
		mount();
		vi.useFakeTimers({ toFake: ["setTimeout"] });

		copyButton("mail").click();
		await vi.advanceTimersByTimeAsync(0);

		expect(write).toHaveBeenCalledWith(el("#mail").textContent);
		expect(copyButton("mail").textContent).toBe("Copied");
		vi.advanceTimersByTime(1600);
		expect(copyButton("mail").textContent).toBe("Copy");
	});

	it("shows Copied in Portuguese", async () => {
		localStorage.setItem("la.lang", "pt");
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		mount();

		copyButton("wa").click();
		await flush();

		expect(copyButton("wa").textContent).toBe("Copiado");
	});

	it("selects the text when the clipboard refuses", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
		mount();

		copyButton("wa").click();
		await flush();

		expect(window.getSelection()?.toString()).toBe(el("#wa").textContent);
		expect(copyButton("wa").textContent).toBe("Copy");
	});

	it("selects the text when the clipboard throws at once", () => {
		vi.spyOn(navigator.clipboard, "writeText").mockImplementation(() => {
			throw new Error("no clipboard");
		});
		mount();

		copyButton("mail").click();

		expect(window.getSelection()?.toString()).toBe(el("#mail").textContent);
	});
});

describe("the form rules", () => {
	it("shows an error under each wrong field, marks it aria-invalid, and focuses the first", () => {
		mount();

		submit();

		for (const id of ["name", "msg"]) {
			expect(el(`#f-${id}`).getAttribute("aria-invalid")).toBe("true");
			expect(el(`#e-${id}`).hidden).toBe(false);
		}
		expect(el("#e-name").textContent).toBe("Add your name so I know who to answer.");
		expect(el("#e-msg").textContent).toBe("Tell me in a few words what you need.");
		expect(el("#f-url").getAttribute("aria-invalid")).toBe("false");
		expect(el("#e-url").hidden).toBe(true);
		expect(document.activeElement).toBe(el("#f-name"));
		expect(el("#form").hidden).toBe(false);
		expect(el("#sent").hidden).toBe(true);
	});

	it("treats a name of only spaces as missing", () => {
		mount();
		type("f-name", "   ");
		type("f-msg", "Hi");

		submit();

		expect(el("#f-name").getAttribute("aria-invalid")).toBe("true");
	});

	it("leaves the link optional", () => {
		mount();
		type("f-name", "Ana");
		type("f-msg", "Hi");

		submit();

		expect(el("#sent").hidden).toBe(false);
	});

	it.each(["loja.com", "ftp://loja.com", "https://", "https://loja", "http:// x.com"])(
		"rejects the link %s and focuses it",
		(url) => {
			mount();
			type("f-name", "Ana");
			type("f-url", url);
			type("f-msg", "Hi");

			submit();

			expect(el("#f-url").getAttribute("aria-invalid")).toBe("true");
			expect(el("#e-url").textContent).toBe("The link must start with https:// or http://");
			expect(document.activeElement).toBe(el("#f-url"));
			expect(el("#f-name").getAttribute("aria-invalid")).toBe("false");
		},
	);

	it("focuses the message when only it is wrong, and clears an error once fixed", () => {
		mount();
		type("f-name", "Ana");

		submit();
		expect(document.activeElement).toBe(el("#f-msg"));

		type("f-msg", "Hi");
		submit();
		expect(el("#e-msg").hidden).toBe(true);
		expect(el("#e-msg").textContent).toBe("");
		expect(el("#f-msg").getAttribute("aria-invalid")).toBe("false");
	});

	it("keeps an error in the language it was shown in, as the mock does", () => {
		mount();
		submit();

		el('.lang button[data-lang="pt"]').click();

		expect(el("#e-name").textContent).toBe("Add your name so I know who to answer.");
		submit();
		expect(el("#e-name").textContent).toBe("Coloque seu nome para eu saber a quem responder.");
	});
});

describe("a valid submit", () => {
	it("shows the success state with the first name and sends nothing", () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		mount();
		fillValid();

		submit();

		expect(el("#form").hidden).toBe(true);
		expect(el("#sent").hidden).toBe(false);
		expect(el("#sent-msg").textContent).toBe("Thanks, Maria. I reply within one business day.");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("writes the success message in Portuguese", () => {
		localStorage.setItem("la.lang", "pt");
		mount();
		fillValid();

		submit();

		expect(el("#sent-msg").textContent).toBe("Obrigado, Maria. Eu respondo em até um dia útil.");
	});

	it("sends form-ready once, and not for an invalid submit", () => {
		const count = vi.fn<(vars?: GoatCounterVars) => void>();
		window.goatcounter = { count };
		mount();

		submit();
		expect(count).not.toHaveBeenCalled();

		fillValid();
		submit();
		expect(count.mock.calls.map(([v]) => v?.path)).toEqual(["form-ready"]);
		delete window.goatcounter;
	});

	it("Write another resets the form, shows it, and focuses the name", () => {
		mount();
		fillValid();
		submit();

		el("#again").click();

		expect(el("#form").hidden).toBe(false);
		expect(el("#sent").hidden).toBe(true);
		expect(el<HTMLInputElement>("#f-name").value).toBe("");
		expect(el<HTMLInputElement>("#f-msg").value).toBe("");
		expect(document.activeElement).toBe(el("#f-name"));
	});
});
