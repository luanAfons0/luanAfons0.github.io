/**
 * The ink plate of the Dungeon Title Screen: one fixed view of a torch-lit corridor (stone, moss,
 * a torch, a banner with its Part label, a door, and a Slime on the flagstones), drawn by a small
 * raycaster and then printed as a 1-bit pen-and-ink plate: ink lines on the edges and the mortar,
 * hatching for the tones, on pulp paper. It ports `renderInkPlate` of the approved mock
 * (`dungeon-frame.js`, in commit 2487e66), so the plate matches the mock.
 */

import { createPixmap, fillRect, line, outlineRect, type Pixmap, plot, seededRandom, text } from "../art-kit/pixmap.ts";
import { slime } from "./bugs.ts";
import { type GeneratedFile, pngFile } from "./files.ts";
import * as c from "./palette.ts";
import { colorAt, SIZE, stoneWall } from "./stone.ts";
import { door, stoneA, stoneB, torchWall } from "./textures.ts";

const WIDTH = 320;
const HEIGHT = 240;
const WRAP = SIZE - 1;

export function plate(): GeneratedFile[] {
	return [pngFile("title/ink-plate.png", inkPlate())];
}

/** The corridor: 1 stone, 2 mossy stone, 3 torch, 4 door, 5 banner, "." floor. */
const MAP = ["1235421", "1.....2", "2.....1", "1.....1", "1.....1", "1111111"];
const CAMERA = { x: 2.2, y: 3.3, angle: -1.15, plane: 0.66 } as const;
const SLIME = { x: 3.3, y: 2.1, scale: 0.25 } as const;
/** The torch light: its place (z is up, 0 to 1) and its reach, in tiles. */
const LIGHT = { x: 2.5, y: 1.08, z: 0.72, reach: 1.7 } as const;

/** What the raycaster knows about each pixel, for the ink: depth, surface, texel tone, and drawn lines. */
interface Gbuffer {
	depth: Float32Array;
	surface: Uint8Array;
	tone: Float32Array;
	line: Uint8Array;
}

/** Surface ids: they tell the ink where one thing ends and the next begins. */
const CEILING = 1;
const FLOOR = 2;
const BUG = 5;
const WALL = 10; // plus the side: 10 or 11
const FLAME = 12;

function inkPlate(): Pixmap {
	const n = WIDTH * HEIGHT;
	const image = createPixmap(WIDTH, HEIGHT, c.FOG);
	const g: Gbuffer = {
		depth: new Float32Array(n),
		surface: new Uint8Array(n),
		tone: new Float32Array(n),
		line: new Uint8Array(n),
	};
	renderScene(image.pixels, g);
	ink(image.pixels, g);
	return image;
}

function renderScene(buffer: Int32Array, g: Gbuffer): void {
	const walls = [undefined, stoneA(), stoneB(), torchWall(false), door(), banner()];
	const floor = flagstones();
	const bug = slime(false);
	const [w, h] = [WIDTH, HEIGHT];
	const horizon = h >> 1;
	const zBuffer = new Float64Array(w);
	const dirX = Math.cos(CAMERA.angle);
	const dirY = Math.sin(CAMERA.angle);
	const planeX = -dirY * CAMERA.plane;
	const planeY = dirX * CAMERA.plane;

	// The floor and the ceiling, row by row, lit by the torch.
	const [rayX0, rayY0, rayX1, rayY1] = [dirX - planeX, dirY - planeY, dirX + planeX, dirY + planeY];
	for (let y = horizon; y < h; y++) {
		const rowDistance = (0.5 * h) / (y - horizon + 0.5);
		const fog = fogAt(rowDistance);
		const ceilingFog = Math.min(0.9, fog * 1.4);
		const stepX = (rowDistance * (rayX1 - rayX0)) / w;
		const stepY = (rowDistance * (rayY1 - rayY0)) / w;
		let fx = CAMERA.x + rowDistance * rayX0;
		let fy = CAMERA.y + rowDistance * rayY0;
		const ceilingRow = (h - 1 - y) * w;
		const floorRow = y * w;
		for (let x = 0; x < w; x++) {
			const color = floor.pixels[(((fy * SIZE) | 0) & WRAP) * SIZE + (((fx * SIZE) | 0) & WRAP)] as number;
			buffer[floorRow + x] = shade(color, fog, 0.9, torchAt(fx, fy, 0));
			buffer[ceilingRow + x] = shade(c.CEILING, ceilingFog, 1, torchAt(fx, fy, 1) * 0.6);
			mark(g, floorRow + x, rowDistance, FLOOR, color, color === c.SEAM && rowDistance < 3.5);
			mark(g, ceilingRow + x, rowDistance, CEILING, c.CEILING, false);
			fx += stepX;
			fy += stepY;
		}
	}

	// The walls: one ray per column, stepped cell by cell.
	for (let column = 0; column < w; column++) {
		const cameraX = (2 * column) / w - 1;
		const rayX = dirX + planeX * cameraX;
		const rayY = dirY + planeY * cameraX;
		let mapX = CAMERA.x | 0;
		let mapY = CAMERA.y | 0;
		const deltaX = Math.abs(1 / rayX);
		const deltaY = Math.abs(1 / rayY);
		const stepMapX = rayX < 0 ? -1 : 1;
		const stepMapY = rayY < 0 ? -1 : 1;
		let sideX = rayX < 0 ? (CAMERA.x - mapX) * deltaX : (mapX + 1 - CAMERA.x) * deltaX;
		let sideY = rayY < 0 ? (CAMERA.y - mapY) * deltaY : (mapY + 1 - CAMERA.y) * deltaY;
		let side = 0;
		let cell = 0;
		while (cell === 0) {
			if (sideX < sideY) {
				sideX += deltaX;
				mapX += stepMapX;
				side = 0;
			} else {
				sideY += deltaY;
				mapY += stepMapY;
				side = 1;
			}
			cell = cellAt(mapX, mapY);
		}
		const distance = side === 0 ? sideX - deltaX : sideY - deltaY;
		zBuffer[column] = distance;
		const hitX = CAMERA.x + distance * rayX;
		const hitY = CAMERA.y + distance * rayY;
		let wallX = side === 0 ? hitY : hitX;
		wallX -= Math.floor(wallX);
		let texX = (wallX * SIZE) | 0;
		if ((side === 0 && rayX < 0) || (side === 1 && rayY > 0)) texX = SIZE - 1 - texX; // the text reads right
		const lineHeight = h / distance;
		const start = horizon - lineHeight / 2;
		const y0 = Math.max(0, Math.ceil(start));
		const y1 = Math.min(h, Math.ceil(start + lineHeight));
		const fog = fogAt(distance);
		const dim = side === 1 ? 0.92 : 0.7;
		const texture = walls[cell] as Pixmap;
		const [lx, ly] = [hitX - LIGHT.x, hitY - LIGHT.y];
		const lightDistance2 = lx * lx + ly * ly;
		for (let y = y0; y < y1; y++) {
			const v = (y - start) / lineHeight;
			const color = texture.pixels[Math.min(WRAP, (v * SIZE) | 0) * SIZE + texX] as number;
			const i = y * w + column;
			const flame = isFlame(color);
			buffer[i] = flame ? shade(color, fog * 0.3, 1, 0) : shade(color, fog, dim, torchLight(lightDistance2, 1 - v));
			mark(g, i, distance, flame ? FLAME : WALL + side, color, isLine(color));
		}
	}

	// The Slime: a sprite on the floor with a small shadow, behind the walls where they are nearer.
	const sx = SLIME.x - CAMERA.x;
	const sy = SLIME.y - CAMERA.y;
	const invDet = 1 / (planeX * dirY - dirX * planeY);
	const transformX = invDet * (dirY * sx - dirX * sy);
	const transformY = invDet * (-planeY * sx + planeX * sy);
	if (transformY <= 0.2) return;
	const full = h / transformY;
	const spriteHeight = Math.round(full * SLIME.scale);
	const spriteWidth = Math.round((spriteHeight * bug.width) / bug.height);
	const cx = Math.round((w / 2) * (1 + transformX / transformY));
	const bottom = Math.round(horizon + full / 2);
	const top = bottom - spriteHeight;
	const left = cx - (spriteWidth >> 1);
	const fog = fogAt(transformY);
	const light = torchAt(SLIME.x, SLIME.y, 0.15);
	const shadow = shade(c.SEAM, fog, 0.6, 0);
	const shadowHeight = Math.max(2, Math.round(spriteHeight * 0.08));
	for (let r = 0; r < shadowHeight; r++) {
		const y = bottom - 1 + r;
		const k = ((r + 0.5) / shadowHeight) * 2 - 1;
		const half = spriteWidth * 0.46 * Math.sqrt(1 - k * k);
		if (y < 0 || y >= h) continue;
		for (let x = Math.max(0, Math.round(cx - half)); x < Math.min(w, Math.round(cx + half)); x++) {
			if (transformY < (zBuffer[x] as number)) buffer[y * w + x] = shadow;
		}
	}
	for (let x = Math.max(0, left); x < Math.min(w, left + spriteWidth); x++) {
		if (transformY >= (zBuffer[x] as number)) continue;
		const u = (((x - left) * bug.width) / spriteWidth) | 0;
		for (let y = Math.max(0, top); y < Math.min(h, bottom); y++) {
			const color = bug.pixels[((((y - top) * bug.height) / spriteHeight) | 0) * bug.width + u] as number;
			if (color < 0) continue;
			const i = y * w + x;
			buffer[i] = shade(color, fog, 1, light);
			mark(g, i, transformY, BUG, color, color === c.SLIME_RIM || color === c.INK);
		}
	}
}

function mark(g: Gbuffer, i: number, depth: number, surface: number, color: number, drawn: boolean): void {
	g.depth[i] = depth;
	g.surface[i] = surface;
	g.tone[i] = luminance(color);
	g.line[i] = drawn ? 1 : 0;
}

function cellAt(x: number, y: number): number {
	const row = MAP[y];
	if (x < 0 || y < 0 || row === undefined || x >= row.length) return 1;
	const char = row[x] as string;
	return char === "." ? 0 : Number(char);
}

/** The torch light at a point, from its squared distance along the floor and its height. */
function torchLight(distance2: number, z: number): number {
	const dz = z - LIGHT.z;
	const falloff = 1 - Math.sqrt(distance2 + dz * dz) / LIGHT.reach;
	return falloff > 0 ? falloff * falloff : 0;
}

function torchAt(x: number, y: number, z: number): number {
	const [dx, dy] = [x - LIGHT.x, y - LIGHT.y];
	return torchLight(dx * dx + dy * dy, z);
}

function fogAt(distance: number): number {
	return Math.min(0.85, distance / 9);
}

/** A color lit dimly plus the warm torch light, then mixed toward the fog. */
function shade(color: number, fog: number, dim: number, light: number): number {
	let r = ((color >> 16) & 255) * (dim + light * 1.05) + light * 26;
	let g = ((color >> 8) & 255) * (dim + light * 0.55) + light * 9;
	let b = (color & 255) * (dim + light * 0.15);
	r += (((c.FOG >> 16) & 255) - r) * fog;
	g += (((c.FOG >> 8) & 255) - g) * fog;
	b += ((c.FOG & 255) - b) * fog;
	const channel = (value: number) => (value > 255 ? 255 : value | 0);
	return (channel(r) << 16) | (channel(g) << 8) | channel(b);
}

function luminance(color: number): number {
	return (0.299 * ((color >> 16) & 255) + 0.587 * ((color >> 8) & 255) + 0.114 * (color & 255)) / 255;
}

function isFlame(color: number): boolean {
	return color === c.FLAME_HI || color === c.FLAME || color === c.FLAME_LO;
}

/** Texels that the plate draws as ink lines: mortar, iron, ink, plank gaps, and the Slime rim. */
function isLine(color: number): boolean {
	return color === c.MORTAR || color === c.INK || color === c.IRON || color === c.OAK_GAP || color === c.SLIME_RIM;
}

/**
 * The banner of the Exhibit on its wall: pulp cloth on an iron rod, the Part label "U1" in a ruled
 * box, and an unrolled map, as in the mock. The game draws posters separately; the plate needs the
 * banner in the wall texture.
 */
function banner(): Pixmap {
	const t = stoneWall(79, false);
	const random = seededRandom(83);
	const onCloth = (x: number, y: number) => {
		if (x < 14 || x > 49 || y < 8 || y > 60) return false;
		const notch = y < 56 ? -1 : (y - 55) * 3; // the swallowtail
		return !(notch >= 0 && x > 31 - notch && x < 32 + notch);
	};
	for (let y = 0; y < SIZE; y++) {
		for (let x = 0; x < SIZE; x++) {
			if (onCloth(x, y)) {
				const edge = !onCloth(x - 1, y) || !onCloth(x + 1, y) || !onCloth(x, y - 1) || !onCloth(x, y + 1);
				plot(t, x, y, edge ? c.INK : random() < 0.05 ? c.PAPER_DK : c.PAPER);
			} else if (onCloth(x - 1, y - 1) && colorAt(t, x, y) !== c.MORTAR) {
				plot(t, x, y, c.STONE_LO); // the shadow of the banner on the stone
			}
		}
	}
	// The rod, its knobs, and the wall pins.
	fillRect(t, 10, 6, 53, 7, c.IRON);
	fillRect(t, 11, 6, 52, 6, c.IRON_HI);
	fillRect(t, 8, 5, 10, 8, c.IRON);
	fillRect(t, 53, 5, 55, 8, c.IRON);
	fillRect(t, 12, 3, 12, 5, c.IRON);
	fillRect(t, 51, 3, 51, 5, c.IRON);
	// The Part label in a ruled box.
	outlineRect(t, 19, 12, 44, 31, c.INK);
	text(t, "U1", 21, 15, c.INK, 2);
	// The unrolled map: two rolls, a sheet, a dotted path, a mountain, and an X.
	outlineRect(t, 19, 35, 21, 52, c.INK);
	fillRect(t, 20, 36, 20, 51, c.PAPER_DK);
	outlineRect(t, 42, 35, 44, 52, c.INK);
	fillRect(t, 43, 36, 43, 51, c.PAPER_DK);
	line(t, [22, 37], [41, 37], c.INK);
	line(t, [22, 50], [41, 50], c.INK);
	for (const [x, y] of [
		[24, 47],
		[26, 47],
		[28, 46],
		[30, 45],
		[31, 43],
		[33, 42],
		[35, 42],
		[25, 41],
		[26, 40],
		[27, 41],
		[28, 42],
		[24, 42],
	] as const) {
		plot(t, x, y, c.INK);
	}
	line(t, [36, 39], [40, 43], c.INK);
	line(t, [40, 39], [36, 43], c.INK);
	return t;
}

/** The floor: dark flagstones in two staggered rows, with one-texel seams. */
function flagstones(): Pixmap {
	const t = createPixmap(SIZE, SIZE, c.SEAM);
	const random = seededRandom(91);
	const tones = [c.FLOOR, c.FLOOR_A, c.FLOOR_B];
	const rows = [
		{ top: 0, height: 30, starts: [0, 23, 44] },
		{ top: 30, height: 34, starts: [11, 37] },
	];
	for (const { top, height, starts } of rows) {
		for (const [j, x0] of starts.entries()) {
			const x1 = starts[j + 1] ?? (starts[0] as number) + SIZE;
			const tone = tones[Math.floor(random() * 3)] as number;
			for (let y = top + 1; y < top + height; y++) {
				for (let x = x0 + 1; x < x1; x++) {
					const r = random();
					plot(t, x & WRAP, y, r < 0.05 ? c.FLOOR_SPECK_LO : r < 0.1 ? c.FLOOR_SPECK_HI : tone);
				}
			}
		}
	}
	return t;
}

/** Tone levels 0 to 4 by luminance: paper, sparse hatching, cross-hatching, dense cross-hatching, solid ink. */
const TONE_STEPS = [0.42, 0.29, 0.19, 0.1];

function toneLevel(value: number): number {
	const level = TONE_STEPS.findIndex((step) => value > step);
	return level === -1 ? TONE_STEPS.length : level;
}

function hatch(level: number, x: number, y: number): boolean {
	const a = (x + y) % 6 === 0;
	const b = (x - y + 6000) % 6 === 0;
	switch (level) {
		case 0:
			return false;
		case 1:
			return a;
		case 2:
			return a || b;
		case 3:
			return (x + y) % 3 === 0 || (x - y + 6000) % 4 === 0;
		default:
			return true;
	}
}

/**
 * Prints the image in one ink: a line where the surface, the depth, or the texel tone jumps, a
 * line on drawn texels, and hatching for the tone elsewhere (blurred first, so stone noise does
 * not speckle the hatching).
 */
function ink(buffer: Int32Array, g: Gbuffer): void {
	const [w, h] = [WIDTH, HEIGHT];
	const tone = new Float32Array(w * h);
	for (let i = 0; i < tone.length; i++) tone[i] = luminance(buffer[i] as number);
	const blurred = new Float32Array(w * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let sum = 0;
			let count = 0;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					const [xx, yy] = [x + dx, y + dy];
					if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
					sum += tone[yy * w + xx] as number;
					count++;
				}
			}
			blurred[y * w + x] = sum / count;
		}
	}
	const jump = (a: number, b: number): boolean => {
		if (g.surface[a] !== g.surface[b]) return true;
		if ((g.surface[a] as number) >= BUG) {
			const [da, db] = [g.depth[a] as number, g.depth[b] as number];
			if (Math.abs(da - db) > 0.06 * Math.min(da, db)) return true;
		}
		return Math.abs((g.tone[a] as number) - (g.tone[b] as number)) > 0.28;
	};
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = y * w + x;
			const inked =
				g.line[i] === 1 ||
				(x + 1 < w && jump(i, i + 1)) ||
				(y + 1 < h && jump(i, i + w)) ||
				hatch(toneLevel(blurred[i] as number), x, y);
			buffer[i] = inked ? c.INK : c.PAPER;
		}
	}
}
