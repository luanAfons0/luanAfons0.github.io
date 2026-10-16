interface GoatCounterVars {
	path?: string | ((defaultPath: string) => string | null);
	title?: string;
	referrer?: string;
	event?: boolean;
	no_session?: boolean;
}

interface GoatCounter extends GoatCounterVars {
	count?: (vars?: GoatCounterVars) => void;
}

interface Window {
	goatcounter?: GoatCounter;
}
