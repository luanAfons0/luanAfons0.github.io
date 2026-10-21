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
	type("f-email", "maria@loja.com.br");
	type("f-url", "https://loja.com.br");
	type("f-msg", "I need a faster checkout.");
};
/** Makes the form service answer with `status` and `body`, and returns the fetch spy. */
const service = (status = 200, body: unknown = { success: true }) =>
	vi.spyOn(window, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));
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

	it("stops the Copied timer on dispose", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		const home = mount();
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		copyButton("mail").click();
		await vi.advanceTimersByTimeAsync(0);
		expect(copyButton("mail").textContent).toBe("Copied");

		home.dispose();
		vi.advanceTimersByTime(1600);

		expect(copyButton("mail").textContent).toBe("Copied");
	});

	it("ignores a clipboard answer that comes after dispose", async () => {
		const answers: ((ok: boolean) => void)[] = [];
		vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
			() =>
				new Promise<void>((resolve, reject) => {
					answers.push((ok) => (ok ? resolve() : reject(new Error("denied"))));
				}),
		);
		window.getSelection()?.removeAllRanges();
		const home = mount();
		copyButton("mail").click();
		copyButton("wa").click();
		home.dispose();

		const [mail, wa] = answers;
		mail?.(true);
		wa?.(false);
		await flush();

		expect(copyButton("mail").textContent).toBe("Copy");
		expect(window.getSelection()?.toString()).toBe("");
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
		const fetchSpy = service();
		mount();

		submit();

		for (const id of ["name", "email", "msg"]) {
			expect(el(`#f-${id}`).getAttribute("aria-invalid")).toBe("true");
			expect(el(`#e-${id}`).hidden).toBe(false);
		}
		expect(el("#e-name").textContent).toBe("Add your name so I know who to answer.");
		expect(el("#e-email").textContent).toBe("Add a valid email so I can answer you.");
		expect(el("#e-msg").textContent).toBe("Tell me in a few words what you need.");
		expect(el("#f-url").getAttribute("aria-invalid")).toBe("false");
		expect(el("#e-url").hidden).toBe(true);
		expect(document.activeElement).toBe(el("#f-name"));
		expect(el("#form").hidden).toBe(false);
		expect(el("#sent").hidden).toBe(true);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("turns off the browser check, so the page shows its own errors", () => {
		mount();

		expect(el<HTMLFormElement>("#form").noValidate).toBe(true);
	});

	it("treats a name of only spaces as missing", () => {
		mount();
		fillValid();
		type("f-name", "   ");

		submit();

		expect(el("#f-name").getAttribute("aria-invalid")).toBe("true");
	});

	it.each(["maria", "maria@loja", "@loja.com", "maria @loja.com", "maria@@loja.com"])(
		"rejects the email %s and focuses it",
		(email) => {
			mount();
			fillValid();
			type("f-email", email);

			submit();

			expect(el("#f-email").getAttribute("aria-invalid")).toBe("true");
			expect(document.activeElement).toBe(el("#f-email"));
			expect(el("#f-name").getAttribute("aria-invalid")).toBe("false");
		},
	);

	it("leaves the link optional", async () => {
		service();
		mount();
		fillValid();
		type("f-url", "");

		submit();
		await flush();

		expect(el("#sent").hidden).toBe(false);
	});

	it.each(["loja.com", "ftp://loja.com", "https://", "https://loja", "http:// x.com"])(
		"rejects the link %s and focuses it",
		(url) => {
			mount();
			fillValid();
			type("f-url", url);

			submit();

			expect(el("#f-url").getAttribute("aria-invalid")).toBe("true");
			expect(el("#e-url").textContent).toBe("The link must start with https:// or http://");
			expect(document.activeElement).toBe(el("#f-url"));
			expect(el("#f-name").getAttribute("aria-invalid")).toBe("false");
		},
	);

	it("focuses the message when only it is wrong, and clears an error once fixed", () => {
		service();
		mount();
		fillValid();
		type("f-msg", "");

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
	it("posts every field of the form to the form service as a simple request, with no preflight", async () => {
		const fetchSpy = service();
		mount();
		fillValid();

		submit();
		await flush();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [url, init] = fetchSpy.mock.calls[0] ?? [];
		expect(url).toBe("https://api.web3forms.com/submit");
		expect(init?.method).toBe("POST");
		// FormData and only safe headers: the browser sends no CORS preflight, which the service can block.
		expect(init?.headers).toEqual({ Accept: "application/json" });
		expect(init?.body).toBeInstanceOf(FormData);
		expect(Object.fromEntries(init?.body as FormData)).toEqual({
			access_key: el<HTMLInputElement>('#form input[name="access_key"]').value,
			subject: "New message from the portfolio",
			from_name: "Luan portfolio",
			name: "Maria Silva",
			email: "maria@loja.com.br",
			store_link: "https://loja.com.br",
			message: "I need a faster checkout.",
		});
	});

	it("shows Sending on the button while the message is on its way, and sends once", async () => {
		let answer: (r: Response) => void = () => {};
		const fetchSpy = vi
			.spyOn(window, "fetch")
			.mockImplementation(() => new Promise<Response>((resolve) => (answer = resolve)));
		mount();
		fillValid();
		const button = el<HTMLButtonElement>('#form button[type="submit"]');

		submit();
		submit();

		expect(button.disabled).toBe(true);
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.textContent).toBe("Sending…");
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		answer(new Response(JSON.stringify({ success: true })));
		await flush();

		expect(button.disabled).toBe(false);
		expect(button.textContent).toBe("Send message");
		expect(el("#sent").hidden).toBe(false);
	});

	it("shows the success state with the first name when the service says yes", async () => {
		service();
		mount();
		fillValid();

		submit();
		await flush();

		expect(el("#form").hidden).toBe(true);
		expect(el("#sent").hidden).toBe(false);
		expect(el("#sent").textContent).toContain("Message sent");
		expect(el("#sent-msg").textContent).toBe("Thanks, Maria. I reply within one business day.");
	});

	it.each(["$&", "$`", "$'", "$$"])("writes a first name with %s as it was typed", async (name) => {
		service();
		mount();
		fillValid();
		type("f-name", `${name} Silva`);

		submit();
		await flush();

		expect(el("#sent-msg").textContent).toBe(`Thanks, ${name}. I reply within one business day.`);
	});

	it("writes the success message in Portuguese", async () => {
		service();
		localStorage.setItem("la.lang", "pt");
		mount();
		fillValid();

		submit();
		await flush();

		expect(el("#sent").textContent).toContain("Mensagem enviada");
		expect(el("#sent-msg").textContent).toBe("Obrigado, Maria. Eu respondo em até um dia útil.");
	});

	it.each([
		["a refusal", () => service(400, { success: false, message: "Invalid access key" })],
		["an answer that is not JSON", () => vi.spyOn(window, "fetch").mockResolvedValue(new Response("<html>"))],
		["a network error", () => vi.spyOn(window, "fetch").mockRejectedValue(new TypeError("offline"))],
	])("shows the send error and keeps the text after %s", async (_, answer) => {
		answer();
		mount();
		fillValid();

		submit();
		await flush();

		expect(el("#e-send").hidden).toBe(false);
		expect(el("#e-send").textContent).toBe("The message did not send. Try again, or message me on WhatsApp.");
		expect(el("#form").hidden).toBe(false);
		expect(el("#sent").hidden).toBe(true);
		expect(el<HTMLTextAreaElement>("#f-msg").value).toBe("I need a faster checkout.");
		expect(el<HTMLButtonElement>('#form button[type="submit"]').disabled).toBe(false);
	});

	it("hides the send error when the visitor tries again and it works", async () => {
		const fetchSpy = vi.spyOn(window, "fetch").mockRejectedValueOnce(new TypeError("offline"));
		mount();
		fillValid();
		submit();
		await flush();

		fetchSpy.mockResolvedValue(new Response(JSON.stringify({ success: true })));
		submit();
		await flush();

		expect(el("#e-send").hidden).toBe(true);
		expect(el("#sent").hidden).toBe(false);
	});

	it("changes nothing on the page when the answer comes after dispose()", async () => {
		let answer: (r: Response) => void = () => {};
		vi.spyOn(window, "fetch").mockImplementation(() => new Promise<Response>((resolve) => (answer = resolve)));
		const home = mount();
		fillValid();
		submit();

		home.dispose();
		answer(new Response(JSON.stringify({ success: true })));
		await flush();

		expect(el("#sent").hidden).toBe(true);
		expect(el("#e-send").hidden).toBe(true);
	});

	it("sends form-ready once, and not for an invalid submit", async () => {
		service();
		const count = vi.fn<(vars?: GoatCounterVars) => void>();
		window.goatcounter = { count };
		mount();

		submit();
		expect(count).not.toHaveBeenCalled();

		fillValid();
		submit();
		await flush();
		expect(count.mock.calls.map(([v]) => v?.path)).toEqual(["form-ready"]);
		delete window.goatcounter;
	});

	it("Write another resets the form, shows it, and focuses the name", async () => {
		service();
		mount();
		fillValid();
		submit();
		await flush();

		el("#again").click();

		expect(el("#form").hidden).toBe(false);
		expect(el("#sent").hidden).toBe(true);
		expect(el<HTMLInputElement>("#f-name").value).toBe("");
		expect(el<HTMLInputElement>("#f-email").value).toBe("");
		expect(el<HTMLInputElement>("#f-msg").value).toBe("");
		expect(document.activeElement).toBe(el("#f-name"));
	});
});
