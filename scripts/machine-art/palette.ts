/**
 * The colors of the machine art set, as 0xRRGGBB. They match the approved mock's game frame
 * (`game-frame.js`, in commit fc7088f). Copper marks only live things.
 */

/** Solder mask: the board base, with a lighter and a darker speck for a matte look. */
export const MASK = 0x1a2024;
export const MASK_HI = 0x1e2529;
export const MASK_LO = 0x161b1f;
/** Copper under the solder mask: traces and via rings show as raised, slightly lighter lines. */
export const TRACE = 0x2c363c;
export const RING = 0x3c454b;
export const HOLE = 0x070909;
/** Silkscreen: the white print on the board. */
export const SILK = 0xe9ebe6;
/** Tinned pads and pins. */
export const SILVER = 0xaeb3b6;
export const SILVER_DK = 0x6f7477;
/** Chip packages. */
export const EPOXY = 0x1a1d20;
export const EPOXY_LIT = 0x23272b;
export const EPOXY_SHADOW = 0x121416;
/** Copper for live things, like a lit LED. */
export const COPPER = 0xc06a36;
export const COPPER_LIT = 0xe08a4f;
export const LED_DIM = 0x2a2f33;
/** Rack panels: brushed dark metal. */
export const PANEL = 0x14181b;
export const PANEL_HI = 0x171b1e;
export const PANEL_EDGE = 0x22282c;
export const PANEL_INNER = 0x0d1012;
export const SLOT = 0x0a0c0d;
export const SLOT_LIP = 0x070809;
export const VENT = 0x14181a;
export const SCREW = 0x3a4045;
export const SCREW_SLOT = 0x15191c;
/** The dark strip of a connector edge. */
export const EDGE = 0x0c0f11;
/** The beetle Bug: a dark carapace with a muted green sheen, grey legs and antennae. */
export const BEETLE_OUTLINE = 0x161a17;
export const BEETLE_SHELL = 0x2b2f2a;
export const BEETLE_SHEEN = 0x5f7a6a;
export const BEETLE_HEAD = 0x1e221f;
export const BEETLE_LEG = 0x737d74;
