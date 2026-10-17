/*
 * Game frame mock: "Dungeon" Theme preview.
 * Plain browser JS, no imports. Defines window.renderGameFrame(canvas, opts) and
 * window.renderInkPlate(canvas).
 * A tiny grid raycaster draws into an ImageData buffer: cut stone walls, a torch
 * whose warm light falls off with distance, an iron-banded door, flagstone floor,
 * one Bug (a slime), one Exhibit (a parchment banner), and the adventure sheet HUD.
 * The ink plate draws the same scene at 320x240 and turns it into a 1-bit
 * pen-and-ink illustration, like a gamebook interior plate.
 */
(function () {
  'use strict';

  var W = 640, H = 360, BAR = 40, VIEW_H = H - BAR;
  var PW = 320, PH = 240; // ink plate size
  var T = 64; // texture size

  // Palette (0xRRGGBB).
  var STONE = 0x4a4f57, STONE_A = 0x474c54, STONE_B = 0x4d525a;
  var STONE_HI = 0x5d636b, STONE_LO = 0x353940, MORTAR = 0x24262a;
  var SPK_HI = 0x53585f, SPK_LO = 0x40454c;
  var MOSS = 0x3f5a3a, MOSS_HI = 0x4d6b45, MOSS_DK = 0x33492f;
  var FLAME_HI = 0xffd27a, FLAME = 0xf39a32, FLAME_LO = 0xc4521f;
  var IRON = 0x2b2d30, IRON_HI = 0x45484d, RIVET = 0x8a8f96;
  var OAK = 0x5a3b22, OAK_DK = 0x3f2816, OAK_GAP = 0x24170c;
  var PAPER = 0xe0d9c5, PAPER_DK = 0xcfc7b0, INK = 0x171717, INK2 = 0x4a463d;
  var CEIL = 0x0e0d0c, FOG = 0x0a0908;
  var FLOOR = 0x22201d, FLOOR_A = 0x25221e, FLOOR_B = 0x1f1d1a, SEAM = 0x171513;
  var FLOOR_SPK_HI = 0x2a2722, FLOOR_SPK_LO = 0x1b1916;
  var SLIME = 0x5fae4e, SLIME_HI = 0xa6dc78, SLIME_SH = 0x4f9a42, SLIME_RIM = 0x2f6b2c;
  var EYE = 0xf6f6f0, PUPIL = INK, SHINE = 0xf4fbe8;

  // ---------- 5x7 bitmap font: 7 rows per glyph, 2 hex digits per row, bit 4 = left ----------
  var FONT = {
    A: '0E11111F111111', B: '1E11111E11111E', C: '0E11101010110E', D: '1E11111111111E',
    E: '1F10101E10101F', F: '1F10101E101010', G: '0E11101711110F', H: '1111111F111111',
    I: '0E04040404040E', J: '0702020202120C', K: '11121418141211', L: '1010101010101F',
    M: '111B1515111111', N: '11111915131111', O: '0E11111111110E', P: '1E11111E101010',
    Q: '0E11111115120D', R: '1E11111E141211', S: '0F10100E01011E', T: '1F040404040404',
    U: '1111111111110E', V: '11111111110A04', W: '1111111515150A', X: '11110A040A1111',
    Y: '11110A04040404', Z: '1F01020408101F',
    '0': '0E11131519110E', '1': '040C040404040E', '2': '0E11010204081F', '3': '1F02040201110E',
    '4': '02060A121F0202', '5': '1F101E0101110E', '6': '0608101E11110E', '7': '1F010204080808',
    '8': '0E11110E11110E', '9': '0E11110F01020C',
    '/': '01010204081010', '.': '00000000000C0C', ':': '000C0C000C0C00', '-': '0000001F000000',
    ' ': '00000000000000'
  };

  // Calls plot(x, y) for every lit pixel of str. Advance is 6 px per glyph (x scale).
  function drawText(plot, str, x, y, scale) {
    for (var i = 0; i < str.length; i++) {
      var g = FONT[str[i]] || FONT[' '];
      for (var row = 0; row < 7; row++) {
        var bits = parseInt(g.substr(row * 2, 2), 16);
        for (var col = 0; col < 5; col++) {
          if (!(bits & (16 >> col))) continue;
          for (var dy = 0; dy < scale; dy++)
            for (var dx = 0; dx < scale; dx++)
              plot(x + col * scale + dx, y + row * scale + dy);
        }
      }
      x += 6 * scale;
    }
  }
  function textWidth(str, scale) { return (str.length * 6 - 1) * scale; }

  // ---------- Texture helpers (64x64 Int32Array of 0xRRGGBB) ----------
  function mulberry32(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function px(t, x, y, c) { if (x >= 0 && x < T && y >= 0 && y < T) t[y * T + x] = c; }
  function rect(t, x0, y0, x1, y1, c) { // inclusive corners
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) px(t, x, y, c);
  }
  function box(t, x0, y0, x1, y1, c) {
    for (var x = x0; x <= x1; x++) { px(t, x, y0, c); px(t, x, y1, c); }
    for (var y = y0; y <= y1; y++) { px(t, x0, y, c); px(t, x1, y, c); }
  }
  function line(t, x0, y0, x1, y1, c) { // Bresenham
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) {
      px(t, x0, y0, c);
      if (x0 === x1 && y0 === y1) return;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function inkText(t, str, x, y, scale, c) {
    drawText(function (a, b) { px(t, a, b, c); }, str, x, y, scale);
  }

  // ---------- Stone ----------
  // One block: mortar column at x0 (wraps), mortar row at y0, lit top/left, shaded bottom/right.
  function block(t, rnd, x0, y0, bw, h, tone, rough) {
    for (var y = y0 + 1; y < y0 + h; y++) {
      for (var i = 1; i < bw; i++) {
        var x = (x0 + i) & 63, c = tone, r = rnd();
        if (y === y0 + 1 || i === 1) c = rough && r < 0.3 ? tone : STONE_HI;
        else if (y === y0 + h - 1 || i === bw - 1) c = rough && r < 0.2 ? tone : STONE_LO;
        else if (r < (rough ? 0.16 : 0.08)) c = r < (rough ? 0.08 : 0.04) ? SPK_LO : SPK_HI;
        t[y * T + x] = c;
      }
    }
  }
  // Chips: a dark notch with a lit lower lip.
  function chips(t, rnd, n) {
    for (var k = 0; k < n; k++) {
      var x = (rnd() * 62) | 0, y = 2 + ((rnd() * 58) | 0);
      if (t[y * T + x] === MORTAR) continue;
      px(t, x, y, MORTAR); px(t, x + 1, y, STONE_LO); px(t, x, y + 1, STONE_LO); px(t, x + 1, y + 1, STONE_HI);
    }
  }
  // Cracks: short downward random walks of mortar color.
  function cracks(t, rnd, n, len) {
    for (var k = 0; k < n; k++) {
      var x = (rnd() * 64) | 0, y = 2 + ((rnd() * 50) | 0), steps = (len / 2 + rnd() * len / 2) | 0;
      for (var s = 0; s < steps; s++) {
        px(t, x & 63, y, MORTAR);
        y++; x += ((rnd() * 3) | 0) - 1;
      }
    }
  }
  // Moss: a noisy patch that creeps further along the mortar lines.
  function moss(t, rnd, cx, cy, r) {
    for (var y = Math.round(cy - r * 1.5); y <= cy + r * 1.5; y++) {
      if (y < 0 || y >= T) continue;
      for (var x = Math.round(cx - r * 1.6); x <= cx + r * 1.6; x++) {
        var i = y * T + (x & 63), dx = x - cx, dy = (y - cy) * 1.3, d = Math.sqrt(dx * dx + dy * dy);
        var on = t[i] === MORTAR ? d < r * 1.5 && rnd() < 0.8 : d < r * (0.6 + 0.5 * rnd());
        if (!on) continue;
        var q = rnd();
        t[i] = q < 0.2 ? MOSS_HI : q < 0.45 ? MOSS_DK : MOSS;
      }
    }
  }
  function stoneWall(seed, rough) {
    var t = new Int32Array(T * T).fill(MORTAR), rnd = mulberry32(seed);
    var courses = rough ? [14, 17, 15, 17] : [16, 16, 16, 15]; // sum 63: row 63 stays mortar
    var tones = [STONE, STONE_A, STONE_B], minW = rough ? 10 : 14, y0 = 0;
    for (var c = 0; c < courses.length; c++) {
      var h = courses[c], off = (rnd() * 64) | 0, done = 0;
      while (done < 64) {
        var bw = rough ? 10 + ((rnd() * 15) | 0) : 14 + ((rnd() * 13) | 0);
        if (64 - done - bw < minW) bw = 64 - done;
        block(t, rnd, off + done, y0, bw, h, tones[(rnd() * 3) | 0], rough);
        done += bw;
      }
      y0 += h;
    }
    chips(t, rnd, rough ? 8 : 3);
    cracks(t, rnd, rough ? 3 : 1, rough ? 10 : 6);
    return t;
  }

  // ---------- Wall textures ----------
  function makeStoneA() { return stoneWall(11, false); }
  function makeStoneB() {
    var t = stoneWall(23, true), rnd = mulberry32(29);
    moss(t, rnd, 14, 53, 7);
    moss(t, rnd, 47, 30, 3);
    return t;
  }

  // Flame: r = outer, o = body, y = core. 12 columns at x 26..37, rows at y 9..25.
  var FLAME_ROWS = [[
    '......r.....', '.....rr.....', '.....ro.....', '....roor....', '....rooor...', '...rooyor...',
    '...royyor...', '..rooyyoor..', '..royyyyor..', '..royyyyor..', '.rooyyyyoor.', '.royyyyyyor.',
    '.royyyyyyor.', '.rooyyyyoor.', '..rooyyoor..', '...roooor...', '....rrrr....'
  ], [
    '....r.......', '....rr......', '.....or.....', '....roor....', '...roooor...', '...royoor...',
    '..rooyyor...', '..royyyoor..', '..royyyyor..', '.rooyyyyor..', '.royyyyyoor.', '.royyyyyyor.',
    '.rooyyyyyor.', '..royyyyoor.', '..rooyyoor..', '...roooor...', '....rrrr....'
  ]];
  var FLAME_COLORS = { r: FLAME_LO, o: FLAME, y: FLAME_HI };
  function makeTorch(frame) {
    var t = stoneWall(41, false), rnd = mulberry32(43);
    // Soot above the flame, thicker near it.
    for (var y = 1; y < 10; y++)
      for (var x = 27; x <= 36; x++)
        if (t[y * T + x] !== MORTAR && rnd() < 0.12 + y * 0.045) t[y * T + x] = STONE_LO;
    // Iron sconce: wall plate, arm, cup.
    rect(t, 29, 33, 34, 46, IRON);
    px(t, 31, 35, RIVET); px(t, 32, 44, RIVET);
    rect(t, 31, 30, 32, 32, IRON);
    rect(t, 26, 26, 37, 27, IRON); rect(t, 27, 28, 36, 28, IRON); rect(t, 28, 29, 35, 29, IRON);
    rect(t, 27, 26, 36, 26, IRON_HI); px(t, 27, 27, RIVET);
    var rows = FLAME_ROWS[frame];
    for (var r = 0; r < rows.length; r++)
      for (var c = 0; c < 12; c++)
        if (rows[r][c] !== '.') px(t, 26 + c, 9 + r, FLAME_COLORS[rows[r][c]]);
    return t;
  }

  function makeDoor() {
    var t = stoneWall(67, false), rnd = mulberry32(71);
    var X0 = 8, X1 = 55, Y0 = 9;
    // Lintel: one long stone over the opening.
    rect(t, 3, 0, 60, 8, MORTAR);
    rect(t, 4, 1, 59, 7, STONE);
    rect(t, 4, 1, 59, 1, STONE_HI); rect(t, 4, 1, 4, 7, STONE_HI);
    rect(t, 5, 7, 59, 7, STONE_LO); rect(t, 59, 2, 59, 7, STONE_LO);
    rect(t, X0 - 1, Y0 - 1, X1 + 1, 63, MORTAR); // dark reveal around the leaf
    // Planks: 8 px wide, a gap on the left, a shaded right edge, random grain.
    for (var x = X0; x <= X1; x++) {
      var p = (x - X0) % 8;
      for (var y = Y0; y <= 63; y++) t[y * T + x] = p === 0 ? OAK_GAP : p === 7 ? OAK_DK : OAK;
    }
    for (var k = 0; k < 46; k++) {
      var gx = X0 + 1 + ((rnd() * (X1 - X0)) | 0);
      if ((gx - X0) % 8 === 0) continue;
      var gy = Y0 + ((rnd() * 50) | 0), len = 3 + ((rnd() * 8) | 0);
      for (var j = 0; j < len && gy + j < 63; j++) px(t, gx, gy + j, OAK_DK);
    }
    // Iron bands with rivets.
    [16, 47].forEach(function (by) {
      rect(t, X0, by, X1, by + 3, IRON);
      for (var rx = X0 + 4; rx < X1; rx += 8) px(t, rx, by + 1, RIVET);
    });
    // Ring pull on a small plate.
    rect(t, 43, 28, 46, 31, IRON); px(t, 44, 29, RIVET);
    [[44, 32], [45, 32], [43, 33], [46, 33], [42, 34], [47, 34], [42, 35], [47, 35], [43, 36], [46, 36], [44, 37], [45, 37]]
      .forEach(function (p) { px(t, p[0], p[1], IRON); });
    px(t, 43, 34, RIVET);
    rect(t, X0 - 1, 63, X1 + 1, 63, OAK_GAP); // threshold
    return t;
  }

  // The Exhibit: a parchment banner on an iron rod, Part label "U1" in a ruled box, a map pictogram.
  function makeExhibit() {
    var t = stoneWall(79, false), rnd = mulberry32(83);
    var mask = new Uint8Array(T * T), x, y;
    for (y = 8; y <= 60; y++) {
      var hw = y < 56 ? -1 : (y - 55) * 3; // swallowtail notch
      for (x = 14; x <= 49; x++) {
        if (hw >= 0 && x > 31 - hw && x < 32 + hw) continue;
        mask[y * T + x] = 1;
      }
    }
    function m(a, b) { return a >= 0 && a < T && b >= 0 && b < T && mask[b * T + a] === 1; }
    for (y = 0; y < T; y++) {
      for (x = 0; x < T; x++) {
        if (m(x, y)) {
          var edge = !m(x - 1, y) || !m(x + 1, y) || !m(x, y - 1) || !m(x, y + 1);
          t[y * T + x] = edge ? INK : rnd() < 0.05 ? PAPER_DK : PAPER;
        } else if (m(x - 1, y - 1) && t[y * T + x] !== MORTAR) {
          t[y * T + x] = STONE_LO; // cast shadow on the stone
        }
      }
    }
    // Rod, knobs, wall pins.
    rect(t, 10, 6, 53, 7, IRON); rect(t, 11, 6, 52, 6, IRON_HI);
    rect(t, 8, 5, 10, 8, IRON); rect(t, 53, 5, 55, 8, IRON);
    rect(t, 12, 3, 12, 5, IRON); rect(t, 51, 3, 51, 5, IRON);
    // Part label in a ruled box.
    box(t, 19, 12, 44, 31, INK);
    inkText(t, 'U1', 21, 15, 2, INK);
    // Unrolled map: two rolls, a sheet, a dotted path, a mountain, an X.
    box(t, 19, 35, 21, 52, INK); rect(t, 20, 36, 20, 51, PAPER_DK);
    box(t, 42, 35, 44, 52, INK); rect(t, 43, 36, 43, 51, PAPER_DK);
    line(t, 22, 37, 41, 37, INK); line(t, 22, 50, 41, 50, INK);
    [[24, 47], [26, 47], [28, 46], [30, 45], [31, 43], [33, 42], [35, 42]].forEach(function (p) { px(t, p[0], p[1], INK); });
    px(t, 25, 41, INK); px(t, 26, 40, INK); px(t, 27, 41, INK); px(t, 28, 42, INK); px(t, 24, 42, INK);
    line(t, 36, 39, 40, 43, INK); line(t, 40, 39, 36, 43, INK);
    return t;
  }

  // Floor: dark flagstones in two staggered rows with 1 px seams.
  function makeFloor() {
    var t = new Int32Array(T * T).fill(SEAM), rnd = mulberry32(91);
    var rows = [[0, 30, [0, 23, 44]], [30, 34, [11, 37]]], tones = [FLOOR, FLOOR_A, FLOOR_B];
    rows.forEach(function (row) {
      var y0 = row[0], h = row[1], xs = row[2];
      for (var j = 0; j < xs.length; j++) {
        var x0 = xs[j], x1 = j + 1 < xs.length ? xs[j + 1] : xs[0] + 64, tone = tones[(rnd() * 3) | 0];
        for (var y = y0 + 1; y < y0 + h; y++)
          for (var x = x0 + 1; x < x1; x++) {
            var r = rnd();
            t[y * T + (x & 63)] = r < 0.05 ? FLOOR_SPK_LO : r < 0.1 ? FLOOR_SPK_HI : tone;
          }
      }
    });
    return t;
  }

  // ---------- Bug sprite: a friendly slime, 32x24, two frames (rest, squash), -1 = transparent ----------
  var SW = 32, SH = 24;
  function makeSlime(frame) {
    var t = new Int32Array(SW * SH).fill(-1);
    var a = frame ? 14.5 : 12.5, h = frame ? 16 : 20, cx = 15.5, base = 24, cy = base - h * 0.42;
    function inside(x, y) {
      if (x < 0 || y < 0 || x >= SW || y >= SH) return false;
      var nx = (x + 0.5 - cx) / a, ny = y + 0.5 - cy;
      if (ny < 0) { ny /= h * 0.58; return nx * nx + ny * ny <= 1; } // dome
      ny /= h * 0.42 + 0.5;
      return nx * nx * nx * nx + ny * ny * ny * ny <= 1; // flat, rounded bottom
    }
    function set(x, y, c) { if (x >= 0 && x < SW && y >= 0 && y < SH) t[y * SW + x] = c; }
    for (var y = 0; y < SH; y++) {
      for (var x = 0; x < SW; x++) {
        if (!inside(x, y)) continue;
        var c = SLIME;
        if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) c = SLIME_RIM;
        else if (!inside(x - 1, y - 2)) c = SLIME_HI;
        else if (!inside(x + 2, y + 2)) c = SLIME_SH;
        set(x, y, c);
      }
    }
    // Eyes (3x4 white, 2x2 pupils looking a little down), a small smile, a shine spot.
    var ey = Math.round(base - h * 0.62), ex = [Math.round(cx - 5.5), Math.round(cx + 2.5)];
    ex.forEach(function (x0) {
      for (var yy = 0; yy < 4; yy++) for (var xx = 0; xx < 3; xx++) set(x0 + xx, ey + yy, EYE);
      set(x0 + 1, ey + 2, PUPIL); set(x0 + 2, ey + 2, PUPIL); set(x0 + 1, ey + 3, PUPIL); set(x0 + 2, ey + 3, PUPIL);
    });
    var my = ey + 6, mx = Math.round(cx) - 2;
    set(mx, my, SLIME_RIM); set(mx + 1, my + 1, SLIME_RIM); set(mx + 2, my + 1, SLIME_RIM); set(mx + 3, my, SLIME_RIM);
    var sx = Math.round(cx - a * 0.55), sy = Math.round(base - h * 0.8);
    set(sx, sy, SHINE); set(sx + 1, sy, SHINE); set(sx, sy + 1, SHINE);
    return t;
  }

  // ---------- Scene: grid map, camera, torch light, Bug ----------
  // 1 stone A, 2 stone B (moss), 3 torch, 4 door, 5 Exhibit
  var MAP = [
    '1235421',
    '1.....2',
    '2.....1',
    '1.....1',
    '1.....1',
    '1111111'
  ];
  var MAP_W = 7;
  var CAM_X = 2.2, CAM_Y = 3.3, CAM_ANGLE = -1.15, FOV_PLANE = 0.66;
  var SLIME_X = 3.3, SLIME_Y = 2.1, SLIME_SCALE = 0.25;
  var LX = 2.5, LY = 1.08, LZ = 0.72, LR = 1.7; // torch light: world position (z up, 0..1) and reach

  var tex = null;
  function buildTextures() {
    if (tex) return tex;
    tex = {
      walls: [null, makeStoneA(), makeStoneB(), null, makeDoor(), makeExhibit()],
      torch: [makeTorch(0), makeTorch(1)],
      floor: makeFloor(),
      slime: [makeSlime(0), makeSlime(1)]
    };
    return tex;
  }
  function cellAt(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP.length) return 1;
    var ch = MAP[y][x];
    return ch === '.' ? 0 : ch.charCodeAt(0) - 48;
  }

  // Torch light at a point, from its squared floor-plane distance and height. k = flicker.
  function torchD(dh2, z, k) {
    var dz = z - LZ, f = 1 - Math.sqrt(dh2 + dz * dz) / LR;
    return f > 0 ? f * f * k : 0;
  }
  function torchAt(x, y, z, k) { var dx = x - LX, dy = y - LY; return torchD(dx * dx + dy * dy, z, k); }

  var FR = FOG >> 16, FG = (FOG >> 8) & 255, FB = FOG & 255;
  function fogAt(d) { return Math.min(0.85, d / 9); }
  // Light (dim, plus warm torch light L), then mix toward FOG; return ABGR for the little-endian Uint32 view.
  function shade(c, fog, dim, L) {
    var r = ((c >> 16) & 255) * (dim + L * 1.05) + L * 26;
    var g = ((c >> 8) & 255) * (dim + L * 0.55) + L * 9;
    var b = (c & 255) * (dim + L * 0.15);
    r += (FR - r) * fog; g += (FG - g) * fog; b += (FB - b) * fog;
    r = r > 255 ? 255 : r | 0; g = g > 255 ? 255 : g | 0; b = b > 255 ? 255 : b | 0;
    return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  }
  function abgr(c) { return shade(c, 0, 1, 0); }
  function lum(c) { return (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255; }
  function isFlame(c) { return c === FLAME_HI || c === FLAME || c === FLAME_LO; }
  // Texels that are drawn lines in the ink plate (mortar, iron, ink, plank gaps, slime rim).
  function isLine(c) { return c === MORTAR || c === INK || c === IRON || c === OAK_GAP || c === SLIME_RIM; }

  function makeView(w, h) { return { w: w, h: h, zbuf: new Float64Array(w) }; }

  // Draws the 3D view into the top v.h rows of buf (stride v.w). g, when given, collects
  // per-pixel depth, surface id, texel luminance, and line flags for the ink plate.
  function renderScene(v, buf, time, animated, g) {
    var t = buildTextures(), w = v.w, vh = v.h, hz = vh >> 1, zbuf = v.zbuf;
    var ang = CAM_ANGLE + (animated ? Math.sin(time * 0.0005) * 0.04 : 0);
    var dirX = Math.cos(ang), dirY = Math.sin(ang);
    var planeX = -dirY * FOV_PLANE, planeY = dirX * FOV_PLANE;
    var step = Math.floor(time / 125); // ~8 Hz, stepped
    var flick = animated ? 0.88 + 0.24 * mulberry32(step * 7919 + 13)() : 1;
    var flame = animated ? step % 2 : 0;
    var slimeFrame = animated ? Math.floor(time / 300) % 2 : 0;
    var i, c;

    // Floor and ceiling, one row at a time, with per-pixel torch light.
    var rdx0 = dirX - planeX, rdy0 = dirY - planeY, rdx1 = dirX + planeX, rdy1 = dirY + planeY;
    for (var y = hz; y < vh; y++) {
      var rowDist = (0.5 * vh) / (y - hz + 0.5);
      var fog = fogAt(rowDist), cfog = Math.min(0.9, fog * 1.4);
      var stepX = rowDist * (rdx1 - rdx0) / w, stepY = rowDist * (rdy1 - rdy0) / w;
      var fx = CAM_X + rowDist * rdx0, fy = CAM_Y + rowDist * rdy0;
      var crow = (vh - 1 - y) * w, frow = y * w;
      for (var x = 0; x < w; x++) {
        var tx = ((fx * T) | 0) & 63, ty = ((fy * T) | 0) & 63;
        c = t.floor[ty * T + tx];
        buf[frow + x] = shade(c, fog, 0.9, torchAt(fx, fy, 0, flick));
        buf[crow + x] = shade(CEIL, cfog, 1, torchAt(fx, fy, 1, flick) * 0.6);
        if (g) {
          i = frow + x;
          g.depth[i] = rowDist; g.surf[i] = 2; g.tl[i] = lum(c); g.line[i] = c === SEAM && rowDist < 3.5 ? 1 : 0;
          i = crow + x;
          g.depth[i] = rowDist; g.surf[i] = 1; g.tl[i] = lum(CEIL); g.line[i] = 0;
        }
        fx += stepX; fy += stepY;
      }
    }

    // Walls: DDA per column.
    for (var col = 0; col < w; col++) {
      var camX = 2 * col / w - 1;
      var rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      var mapX = CAM_X | 0, mapY = CAM_Y | 0;
      var ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      var stepMX = rdx < 0 ? -1 : 1, stepMY = rdy < 0 ? -1 : 1;
      var sdx = rdx < 0 ? (CAM_X - mapX) * ddx : (mapX + 1 - CAM_X) * ddx;
      var sdy = rdy < 0 ? (CAM_Y - mapY) * ddy : (mapY + 1 - CAM_Y) * ddy;
      var side = 0, cell = 0;
      while (cell === 0) {
        if (sdx < sdy) { sdx += ddx; mapX += stepMX; side = 0; } else { sdy += ddy; mapY += stepMY; side = 1; }
        cell = cellAt(mapX, mapY);
      }
      var perp = side === 0 ? sdx - ddx : sdy - ddy;
      zbuf[col] = perp;
      var hx = CAM_X + perp * rdx, hy = CAM_Y + perp * rdy;
      var wallX = side === 0 ? hy : hx;
      wallX -= Math.floor(wallX);
      var texX = (wallX * T) | 0;
      if ((side === 0 && rdx < 0) || (side === 1 && rdy > 0)) texX = T - 1 - texX; // keep text readable
      var lineH = vh / perp, start = hz - lineH / 2;
      var y0 = Math.max(0, Math.ceil(start)), y1 = Math.min(vh, Math.ceil(start + lineH));
      var wfog = fogAt(perp), dim = side === 1 ? 0.92 : 0.7;
      var wt = cell === 3 ? t.torch[flame] : t.walls[cell];
      var lx = hx - LX, ly = hy - LY, dh2 = lx * lx + ly * ly;
      for (var wy = y0; wy < y1; wy++) {
        var v01 = (wy - start) / lineH, texY = Math.min(63, (v01 * T) | 0);
        c = wt[texY * T + texX]; i = wy * w + col;
        buf[i] = isFlame(c) ? shade(c, wfog * 0.3, 1, 0) : shade(c, wfog, dim, torchD(dh2, 1 - v01, flick));
        if (g) { g.depth[i] = perp; g.surf[i] = isFlame(c) ? 12 : 10 + side; g.tl[i] = lum(c); g.line[i] = isLine(c) ? 1 : 0; }
      }
    }

    // Bug: slime billboard on the floor, with a small contact shadow, depth tested per column.
    var sx = SLIME_X - CAM_X, sy = SLIME_Y - CAM_Y;
    var invDet = 1 / (planeX * dirY - dirX * planeY);
    var trX = invDet * (dirY * sx - dirX * sy), trY = invDet * (-planeY * sx + planeX * sy);
    if (trY > 0.2) {
      var spr = t.slime[slimeFrame];
      var full = vh / trY, sh = Math.round(full * SLIME_SCALE), sw = Math.round(sh * SW / SH);
      var cx = Math.round((w / 2) * (1 + trX / trY)), bottom = Math.round(hz + full / 2);
      var top = bottom - sh, left = cx - (sw >> 1), sfog = fogAt(trY);
      var sl = torchAt(SLIME_X, SLIME_Y, 0.15, flick), shadow = shade(SEAM, sfog, 0.6, 0);
      var shH = Math.max(2, Math.round(sh * 0.08));
      for (var r = 0; r < shH; r++) {
        var ry = bottom - 1 + r, k = (r + 0.5) / shH * 2 - 1, half = sw * 0.46 * Math.sqrt(1 - k * k);
        if (ry < 0 || ry >= vh) continue;
        for (var qx = Math.max(0, Math.round(cx - half)); qx < Math.min(w, Math.round(cx + half)); qx++)
          if (trY < zbuf[qx]) buf[ry * w + qx] = shadow;
      }
      for (var bx = Math.max(0, left); bx < Math.min(w, left + sw); bx++) {
        if (trY >= zbuf[bx]) continue;
        var u = ((bx - left) * SW / sw) | 0;
        for (var by = Math.max(0, top); by < Math.min(vh, bottom); by++) {
          c = spr[(((by - top) * SH / sh) | 0) * SW + u];
          if (c < 0) continue;
          i = by * w + bx;
          buf[i] = shade(c, sfog, 1, sl);
          if (g) { g.depth[i] = trY; g.surf[i] = 5; g.tl[i] = lum(c); g.line[i] = c === SLIME_RIM || c === PUPIL ? 1 : 0; }
        }
      }
    }
  }

  // ---------- HUD: adventure sheet strip, hint, crosshair (640x360 only) ----------
  function fill(buf, x0, y0, x1, y1, c) { // inclusive
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) buf[y * W + x] = c;
  }
  function outline(buf, x0, y0, x1, y1, c) {
    fill(buf, x0, y0, x1, y0, c); fill(buf, x0, y1, x1, y1, c);
    fill(buf, x0, y0, x0, y1, c); fill(buf, x1, y0, x1, y1, c);
  }
  function text(buf, str, x, y, scale, c) {
    drawText(function (a, b) { if (a >= 0 && a < W && b >= 0 && b < H) buf[b * W + a] = c; }, str, x, y, scale);
  }

  function renderHud(buf) {
    var paper = abgr(PAPER), ink = abgr(INK), ink2 = abgr(INK2);
    // Hint above the bar: 2x, paper color, 1px ink outline in 8 directions.
    var hint = 'PRESS E', hs = 2, hx = (W - textWidth(hint, hs)) >> 1, hy = VIEW_H - 16 - 7 * hs;
    for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) if (ox || oy) text(buf, hint, hx + ox, hy + oy, hs, ink);
    text(buf, hint, hx, hy, hs, paper);

    // Bar: pulp paper, 1px ink top line, ink-outlined sections.
    fill(buf, 0, VIEW_H, W - 1, H - 1, paper);
    fill(buf, 0, VIEW_H, W - 1, VIEW_H, ink);
    var top = VIEW_H + 4, bot = H - 5, right = W - 5, split = W - 5 - 150;
    var sections = [[4, split - 4, 'ROOM', 'LOBBY'], [split, right, 'BUGS FIXED', '3/7']];
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      outline(buf, s[0], top, s[1], bot, ink);
      text(buf, s[2], s[0] + 6, top + 5, 1, ink2);
      text(buf, s[3], s[0] + 6, top + 15, 2, ink);
    }
    // Seven 7x7 tick boxes after the Bug count, three ticked with an ink X.
    var bx = split + 6 + textWidth('3/7', 2) + 8, byy = top + 15 + 4;
    for (var b = 0; b < 7; b++) {
      var x0 = bx + b * 10;
      outline(buf, x0, byy, x0 + 6, byy + 6, ink);
      if (b < 3) for (var d = 1; d <= 5; d++) { buf[(byy + d) * W + x0 + d] = ink; buf[(byy + d) * W + x0 + 6 - d] = ink; }
    }
  }

  function drawCrosshair(buf) {
    var paper = abgr(PAPER), ink = abgr(INK), cx = W >> 1, cy = VIEW_H >> 1, arm = [], d, k;
    for (d = 1; d <= 5; d++) arm.push([cx + d, cy], [cx - 1 - d, cy], [cx, cy + d], [cx, cy - 1 - d]);
    for (k = 0; k < arm.length; k++)
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) buf[(arm[k][1] + oy) * W + arm[k][0] + ox] = ink;
    for (k = 0; k < arm.length; k++) buf[arm[k][1] * W + arm[k][0]] = paper;
  }

  // ---------- Ink plate: 1-bit pen-and-ink conversion ----------
  // Tone level 0..4 from luminance: paper, sparse diagonal, cross, dense cross, solid ink.
  var TONE_STEPS = [0.42, 0.29, 0.19, 0.1];
  function toneLevel(l) {
    for (var k = 0; k < TONE_STEPS.length; k++) if (l > TONE_STEPS[k]) return k;
    return 4;
  }
  function hatch(level, x, y) {
    var a = (x + y) % 6 === 0, b = (x - y + 6000) % 6 === 0;
    switch (level) {
      case 0: return false;
      case 1: return a;
      case 2: return a || b;
      case 3: return (x + y) % 3 === 0 || (x - y + 6000) % 4 === 0;
      default: return true;
    }
  }
  function inkify(buf, g, w, h) {
    var n = w * h, L = new Float32Array(n), B = new Float32Array(n), x, y, i;
    for (i = 0; i < n; i++) {
      var c = buf[i];
      L[i] = (0.299 * (c & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * ((c >> 16) & 255)) / 255;
    }
    for (y = 0; y < h; y++) { // 3x3 box blur so texture noise does not speckle the hatching
      for (x = 0; x < w; x++) {
        var s = 0, cnt = 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          s += L[yy * w + xx]; cnt++;
        }
        B[y * w + x] = s / cnt;
      }
    }
    function jump(a, b) {
      if (g.surf[a] !== g.surf[b]) return true;
      if (g.surf[a] >= 5) { var da = g.depth[a], db = g.depth[b]; if (Math.abs(da - db) > 0.06 * Math.min(da, db)) return true; }
      return Math.abs(g.tl[a] - g.tl[b]) > 0.28;
    }
    var ink = abgr(INK), paper = abgr(PAPER);
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        var on = g.line[i] === 1 || (x + 1 < w && jump(i, i + 1)) || (y + 1 < h && jump(i, i + w)) || hatch(toneLevel(B[i]), x, y);
        buf[i] = on ? ink : paper;
      }
    }
  }

  // ---------- Public entry ----------
  window.renderGameFrame = function (canvas, opts) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(W, H);
    var buf = new Uint32Array(img.data.buffer);
    var view = makeView(W, VIEW_H);
    function draw(time, animated) {
      renderScene(view, buf, time, animated);
      renderHud(buf);
      drawCrosshair(buf);
      ctx.putImageData(img, 0, 0);
    }
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!opts || !opts.animate || reduce) { draw(0, false); return function () {}; }
    var raf = 0, last = -1e9, t0 = performance.now();
    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (now - last < 33) return; // ~30 fps covers the 8 Hz flicker and the slime squash
      last = now;
      draw(Math.max(0, now - t0), true); // rAF time can be a bit before t0
    }
    draw(0, true);
    raf = requestAnimationFrame(tick);
    return function stop() { cancelAnimationFrame(raf); };
  };

  // Static, deterministic: the same scene at 320x240, no HUD, as ink on paper.
  window.renderInkPlate = function (canvas) {
    canvas.width = PW; canvas.height = PH;
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(PW, PH);
    var buf = new Uint32Array(img.data.buffer), n = PW * PH;
    var g = { depth: new Float32Array(n), surf: new Uint8Array(n), tl: new Float32Array(n), line: new Uint8Array(n) };
    renderScene(makeView(PW, PH), buf, 0, false, g);
    inkify(buf, g, PW, PH);
    ctx.putImageData(img, 0, 0);
  };
})();
