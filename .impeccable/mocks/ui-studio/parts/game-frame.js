/*
 * Game frame mock: "Inside the machine" re-theme preview.
 * Plain browser JS, no imports. Defines window.renderGameFrame(canvas, opts).
 * A tiny grid raycaster draws into a 640x360 ImageData buffer: textured walls,
 * flat floor and ceiling with distance shading, one Bug sprite, one Exhibit, HUD.
 */
(function () {
  'use strict';

  var W = 640, H = 360, BAR = 40, VIEW_H = H - BAR, HORIZON = VIEW_H >> 1;
  var T = 64; // texture size

  // Palette (0xRRGGBB). Copper marks only live things.
  var MASK = 0x1a2024, MASK_HI = 0x1e2529, MASK_LO = 0x161b1f;
  var TRACE = 0x2c363c, RING = 0x3c454b, HOLE = 0x070909;
  var SILK = 0xe9ebe6, SILVER = 0xaeb3b6, SILVER_DK = 0x6f7477;
  var EPOXY = 0x1a1d20, COPPER = 0xc06a36, COPPER_LIT = 0xe08a4f;
  var LED_DIM = 0x2a2f33, CEIL = 0x0b0d0f, FOG = 0x07090a;
  var HUD_LINE = 0x3a4045, HUD_LABEL = 0x9aa1a5;

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
  function line(t, x0, y0, x1, y1, c) { // Bresenham, fine for 45/90 degree routes
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
  function path(t, pts, c, wide) {
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      line(t, a[0], a[1], b[0], b[1], c);
      if (wide) { line(t, a[0] + 1, a[1], b[0] + 1, b[1], c); line(t, a[0], a[1] + 1, b[0], b[1] + 1, c); }
    }
  }
  function disc(t, cx, cy, r, c) {
    for (var y = -r; y <= r; y++)
      for (var x = -r; x <= r; x++)
        if (x * x + y * y <= r * r + r) px(t, cx + x, cy + y, c);
  }
  function via(t, x, y) { disc(t, x, y, 2, RING); px(t, x, y, HOLE); }
  function silkText(t, str, x, y, scale, c) {
    drawText(function (a, b) { px(t, a, b, c); }, str, x, y, scale);
  }
  // Matte solder mask: base color with sparse light and dark noise.
  function maskBase(seed) {
    var t = new Int32Array(T * T), rnd = mulberry32(seed);
    for (var i = 0; i < t.length; i++) {
      var r = rnd();
      t[i] = r < 0.14 ? MASK_HI : r < 0.24 ? MASK_LO : MASK;
    }
    return t;
  }
  // A thin board edge top and bottom so walls separate from floor and ceiling.
  function boardEdges(t) { rect(t, 0, 0, 63, 0, TRACE); rect(t, 0, 63, 63, 63, RING); }

  // ---------- Wall textures ----------
  function makeBoardA() {
    var t = maskBase(11);
    path(t, [[0, 12], [18, 12], [26, 20], [26, 34], [34, 42], [63, 42]], TRACE, true);
    path(t, [[40, 0], [40, 9], [48, 17], [63, 17]], TRACE);
    path(t, [[0, 52], [12, 52], [20, 44]], TRACE);
    path(t, [[50, 63], [50, 55], [56, 49]], TRACE);
    path(t, [[8, 63], [8, 58], [14, 58]], TRACE);
    via(t, 20, 44); via(t, 56, 49); via(t, 14, 58); via(t, 10, 22);
    // Resistor footprint with silver pads and a label.
    box(t, 36, 25, 55, 33, SILK);
    rect(t, 38, 27, 40, 31, SILVER_DK); rect(t, 51, 27, 53, 31, SILVER_DK);
    silkText(t, 'R12', 37, 4 + 13, 1, SILK);
    // Capacitor outline.
    box(t, 4, 28, 12, 36, SILK); px(t, 8, 30, SILK); px(t, 7, 31, SILK); px(t, 8, 31, SILK); px(t, 9, 31, SILK);
    silkText(t, 'C4', 3, 39, 1, SILK);
    boardEdges(t);
    return t;
  }
  function makeBoardB() {
    var t = maskBase(23);
    path(t, [[0, 30], [14, 30], [22, 22], [22, 4], [30, 4], [30, 0]], TRACE);
    path(t, [[0, 34], [16, 34], [24, 26], [44, 26], [52, 34], [63, 34]], TRACE, true);
    path(t, [[63, 8], [52, 8], [46, 14]], TRACE);
    path(t, [[34, 63], [34, 52], [40, 46], [58, 46]], TRACE);
    via(t, 46, 14); via(t, 58, 46); via(t, 6, 50); via(t, 12, 50);
    // Small SOIC footprint: outline, pin-1 dot, pads.
    box(t, 40, 52, 60, 61, SILK); px(t, 42, 54, SILK);
    for (var x = 44; x <= 57; x += 4) { rect(t, x, 50, x + 1, 51, SILVER_DK); rect(t, x, 62, x + 1, 62, SILVER_DK); }
    silkText(t, 'U3', 6, 6, 1, SILK);
    box(t, 4, 15, 18, 21, SILK);
    boardEdges(t);
    return t;
  }
  // Board B plus the "patched" mark: a check inside a small rectangle.
  function makePatched() {
    var t = makeBoardB();
    rect(t, 21, 39, 42, 57, MASK);
    box(t, 22, 40, 41, 56, SILK);
    path(t, [[26, 48], [30, 52], [37, 44]], SILK, true);
    return t;
  }
  function makeChip() {
    var t = maskBase(37);
    rect(t, 13, 13, 50, 50, EPOXY);
    rect(t, 13, 13, 50, 13, 0x23272b); rect(t, 13, 13, 13, 50, 0x23272b); // lit edges
    rect(t, 13, 50, 50, 50, 0x121416); rect(t, 50, 13, 50, 50, 0x121416); // shadow edges
    for (var p = 16; p <= 46; p += 4) { // pins on all four sides
      rect(t, p, 8, p + 1, 12, SILVER); px(t, p, 8, SILVER_DK); px(t, p + 1, 8, SILVER_DK);
      rect(t, p, 51, p + 1, 55, SILVER); px(t, p, 55, SILVER_DK); px(t, p + 1, 55, SILVER_DK);
      rect(t, 8, p, 12, p + 1, SILVER); px(t, 8, p, SILVER_DK); px(t, 8, p + 1, SILVER_DK);
      rect(t, 51, p, 55, p + 1, SILVER); px(t, 55, p, SILVER_DK); px(t, 55, p + 1, SILVER_DK);
    }
    disc(t, 18, 18, 2, 0x24282c); // faint pin-1 dot
    silkText(t, 'MCU', 24, 26, 1, 0x3a3f43); // laser etch, low contrast
    silkText(t, '2026', 21, 36, 1, 0x30353a);
    rect(t, 3, 3, 5, 3, SILK); rect(t, 3, 3, 3, 5, SILK); // pin-1 corner mark
    boardEdges(t);
    return t;
  }
  function makeRack() {
    var t = new Int32Array(T * T), rnd = mulberry32(51);
    for (var i = 0; i < t.length; i++) t[i] = rnd() < 0.12 ? 0x171b1e : 0x14181b;
    box(t, 0, 0, 63, 63, 0x22282c); box(t, 1, 1, 62, 62, 0x0d1012);
    [[4, 4], [59, 4], [4, 59], [59, 59]].forEach(function (s) {
      disc(t, s[0], s[1], 2, HUD_LINE); line(t, s[0] - 1, s[1], s[0] + 1, s[1], 0x15191c);
    });
    var lit = { '0:0': 1, '2:1': 1 }; // row:led pairs that are lit
    for (var r = 0; r < 5; r++) {
      var y = 10 + r * 9;
      rect(t, 8, y, 45, y + 5, 0x0a0c0d);
      rect(t, 8, y, 45, y, 0x070809); rect(t, 8, y + 6, 45, y + 6, RING); // lip highlight
      for (var x = 11; x < 44; x += 4) rect(t, x, y + 2, x + 1, y + 3, 0x14181a); // vents
      for (var l = 0; l < 2; l++) rect(t, 50 + l * 5, y + 2, 51 + l * 5, y + 3, lit[r + ':' + l] ? COPPER_LIT : LED_DIM);
    }
    return t;
  }
  function makeDoor() {
    var t = maskBase(67);
    path(t, [[0, 20], [10, 20], [16, 26], [16, 46]], TRACE);
    path(t, [[63, 14], [52, 14], [46, 20], [46, 46]], TRACE);
    box(t, 4, 3, 59, 49, SILK);
    // Arrow pointing up.
    rect(t, 30, 18, 33, 38, SILK);
    for (var r = 0; r < 8; r++) rect(t, 31 - r, 10 + r, 32 + r, 10 + r, SILK);
    silkText(t, 'J1', 8, 7, 1, SILK);
    // Connector edge: fingers in silver.
    rect(t, 0, 52, 63, 63, 0x0c0f11);
    for (var x = 4; x < 60; x += 5) { rect(t, x, 54, x + 2, 63, SILVER); rect(t, x, 54, x + 2, 54, SILVER_DK); }
    return t;
  }
  // The Exhibit: an IC component with "U1" above it and a copper outline (live).
  function makeExhibit() {
    var t = maskBase(79);
    path(t, [[0, 40], [8, 40]], TRACE); path(t, [[56, 34], [63, 34]], TRACE);
    silkText(t, 'U1', 21, 4, 2, SILK);
    box(t, 11, 22, 52, 58, COPPER);
    rect(t, 18, 24, 45, 56, EPOXY);
    rect(t, 18, 24, 45, 24, 0x23272b);
    for (var y = 27; y <= 53; y += 4) { rect(t, 13, y, 17, y + 1, SILVER); rect(t, 46, y, 50, y + 1, SILVER); }
    disc(t, 22, 28, 1, 0x2a2e32); // pin-1 dot
    // Two-color icon inside: "</>".
    var ICON = 0xc9cdc9;
    path(t, [[27, 35], [23, 39], [27, 43]], ICON, true);
    path(t, [[34, 33], [29, 46]], ICON, true);
    path(t, [[36, 35], [40, 39], [36, 43]], ICON, true);
    rect(t, 22, 50, 41, 50, 0x2a2e32); // faint marking line
    return t;
  }
  // Floor tile: solder mask a bit lighter than the ceiling, sparse traces.
  function makeFloor() {
    var t = new Int32Array(T * T), rnd = mulberry32(91);
    for (var i = 0; i < t.length; i++) { var r = rnd(); t[i] = r < 0.12 ? 0x111518 : r < 0.2 ? 0x0c0f11 : 0x0e1114; }
    path(t, [[0, 20], [24, 20], [36, 32], [63, 32]], 0x161b1e);
    path(t, [[44, 0], [44, 10], [50, 16]], 0x161b1e);
    disc(t, 50, 16, 1, 0x1b2024);
    return t;
  }

  // ---------- Bug sprite: 32x24, two walk frames, -1 = transparent ----------
  var BW = 32, BH = 24;
  var BUG_BODY = [ // left half, 12 columns; mirrored for the right half
    '....a.......', '.....a......', '......a.....', '.......aoooo', '.......ohhhh', '.......ohehh',
    '.......ohhhh', '......oooooo', '.....occcccc', '.....ocssccc', '.....ooooooo', '...occccccco',
    '..ocssccccco', '..ocssccccco', '.ocsscccccco', '.ocsscccccco', '.ocsccccccco', '.occccccccco',
    '..occcccccco', '..occcccccco', '...occccccco', '....ooccccco', '......oooooo', '............'
  ];
  var BUG_COLORS = { o: 0x161a17, c: 0x2b2f2a, s: 0x5f7a6a, h: 0x1e221f, e: SILK, a: 0x737d74 };
  var LEGS = [ // left-side legs per frame: front, middle, back (tripod gait)
    [[[9, 9], [6, 7], [4, 4]], [[5, 14], [2, 15], [1, 18]], [[6, 20], [4, 22], [3, 23]]],
    [[[9, 9], [6, 9], [3, 8]], [[5, 14], [2, 13], [0, 11]], [[6, 20], [3, 20], [1, 22]]]
  ];
  function makeBug(frame) {
    var t = new Int32Array(BW * BH).fill(-1);
    function set(x, y, c) { if (x >= 0 && x < BW && y >= 0 && y < BH) t[y * BW + x] = c; }
    function leg(pts, mirror) {
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
        for (var k = 0; k <= n; k++) {
          var x = Math.round(a[0] + (b[0] - a[0]) * k / n), y = Math.round(a[1] + (b[1] - a[1]) * k / n);
          set(mirror ? BW - 1 - x : x, y, BUG_COLORS.a);
        }
      }
    }
    LEGS[frame].forEach(function (p) { leg(p, false); });
    LEGS[1 - frame].forEach(function (p) { leg(p, true); }); // right side moves opposite
    for (var y = 0; y < BH; y++) {
      for (var x = 0; x < 12; x++) {
        var ch = BUG_BODY[y][x];
        if (ch === '.') continue;
        set(x + 4, y, BUG_COLORS[ch]);
        set(27 - x, y, BUG_COLORS[ch === 's' ? 'c' : ch]); // light from the left only
      }
    }
    return t;
  }

  // ---------- Scene: grid map, camera, Bug ----------
  // 1 board A, 2 chip, 3 rack, 4 door, 5 Exhibit, 6 patched board, 7 board B
  var MAP = [
    '13176421',
    '1......3',
    '1......5',
    '3......7',
    '2......1',
    '11111111'
  ];
  var MAP_W = 8;
  var CAM_X = 2.0, CAM_Y = 4.6, CAM_ANGLE = -0.9, FOV_PLANE = 0.66;
  var BUG_X = 3.9, BUG_Y = 2.8, BUG_SCALE = 0.3;

  var tex = null;
  function buildTextures() {
    if (tex) return tex;
    tex = {
      walls: [null, makeBoardA(), makeChip(), makeRack(), makeDoor(), makeExhibit(), makePatched(), makeBoardB()],
      floor: makeFloor(),
      bug: [makeBug(0), makeBug(1)]
    };
    return tex;
  }
  function cellAt(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP.length) return 1;
    var ch = MAP[y][x];
    return ch === '.' ? 0 : ch.charCodeAt(0) - 48;
  }

  var FR = FOG >> 16, FG = (FOG >> 8) & 255, FB = FOG & 255;
  function fogAt(d) { return Math.min(0.8, d / 14); }
  // Mix 0xRRGGBB toward FOG, return ABGR for the little-endian Uint32 view.
  function shade(c, fog, dim) {
    var r = ((c >> 16) & 255) * dim, g = ((c >> 8) & 255) * dim, b = (c & 255) * dim;
    r += (FR - r) * fog; g += (FG - g) * fog; b += (FB - b) * fog;
    return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  }
  function abgr(c) { return shade(c, 0, 1); }

  var zbuf = new Float64Array(W);

  function renderScene(buf, time, animated) {
    var t = buildTextures();
    var ang = CAM_ANGLE + (animated ? Math.sin(time * 0.0005) * 0.05 : 0);
    var dirX = Math.cos(ang), dirY = Math.sin(ang);
    var planeX = -dirY * FOV_PLANE, planeY = dirX * FOV_PLANE;

    // Floor and ceiling, one row at a time.
    var rdx0 = dirX - planeX, rdy0 = dirY - planeY, rdx1 = dirX + planeX, rdy1 = dirY + planeY;
    for (var y = HORIZON; y < VIEW_H; y++) {
      var rowDist = (0.5 * VIEW_H) / (y - HORIZON + 0.5);
      var fog = fogAt(rowDist);
      var stepX = rowDist * (rdx1 - rdx0) / W, stepY = rowDist * (rdy1 - rdy0) / W;
      var fx = CAM_X + rowDist * rdx0, fy = CAM_Y + rowDist * rdy0;
      var ceil = shade(CEIL, Math.min(0.9, fog * 1.4), 1), crow = (VIEW_H - 1 - y) * W, frow = y * W;
      for (var x = 0; x < W; x++) {
        var tx = ((fx * T) | 0) & 63, ty = ((fy * T) | 0) & 63;
        buf[frow + x] = shade(t.floor[ty * T + tx], fog, 1);
        buf[crow + x] = ceil;
        fx += stepX; fy += stepY;
      }
    }

    // Walls: DDA per column.
    for (var col = 0; col < W; col++) {
      var camX = 2 * col / W - 1;
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
      var wallX = side === 0 ? CAM_Y + perp * rdy : CAM_X + perp * rdx;
      wallX -= Math.floor(wallX);
      var texX = (wallX * T) | 0;
      if ((side === 0 && rdx < 0) || (side === 1 && rdy > 0)) texX = T - 1 - texX; // keep text readable
      var lineH = VIEW_H / perp, start = HORIZON - lineH / 2;
      var y0 = Math.max(0, Math.ceil(start)), y1 = Math.min(VIEW_H, Math.ceil(start + lineH));
      var wfog = fogAt(perp), dim = side === 1 ? 1 : 0.78, wt = t.walls[cell];
      for (var wy = y0; wy < y1; wy++) {
        var texY = Math.min(63, ((wy - start) / lineH * T) | 0);
        buf[wy * W + col] = shade(wt[texY * T + texX], wfog, dim);
      }
    }

    // Bug sprite billboard, depth tested per column.
    var sx = BUG_X - CAM_X, sy = BUG_Y - CAM_Y;
    var invDet = 1 / (planeX * dirY - dirX * planeY);
    var trX = invDet * (dirY * sx - dirX * sy), trY = invDet * (-planeY * sx + planeX * sy);
    if (trY > 0.2) {
      var spr = t.bug[animated ? Math.floor(time / 250) % 2 : 0];
      var full = VIEW_H / trY, sh = Math.round(full * BUG_SCALE), sw = Math.round(sh * BW / BH);
      var cx = Math.round((W / 2) * (1 + trX / trY)), bottom = Math.round(HORIZON + full / 2);
      var top = bottom - sh, left = cx - (sw >> 1), sfog = fogAt(trY);
      for (var bx = Math.max(0, left); bx < Math.min(W, left + sw); bx++) {
        if (trY >= zbuf[bx]) continue;
        var u = ((bx - left) * BW / sw) | 0;
        for (var by = Math.max(0, top); by < Math.min(VIEW_H, bottom); by++) {
          var c = spr[(((by - top) * BH / sh) | 0) * BW + u];
          if (c >= 0) buf[by * W + bx] = shade(c, sfog, 1);
        }
      }
    }
  }

  // ---------- HUD: crosshair, hint, status bar ----------
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
    var silk = abgr(SILK);
    // Hint above the status bar: 2x, 1px dark outline, no glow.
    var hint = 'PRESS E', hs = 2, hx = (W - textWidth(hint, hs)) >> 1, hy = VIEW_H - 16 - 7 * hs;
    var dark = abgr(MASK);
    for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) if (ox || oy) text(buf, hint, hx + ox, hy + oy, hs, dark);
    text(buf, hint, hx, hy, hs, silk);

    // Status bar: board strip, 1px silkscreen line on top, boxed sections.
    fill(buf, 0, VIEW_H, W - 1, H - 1, abgr(MASK));
    fill(buf, 0, VIEW_H, W - 1, VIEW_H, abgr(HUD_LINE));
    var top = VIEW_H + 4, bot = H - 5, right = W - 5, split = W - 5 - 120;
    var sections = [[4, split - 4, 'ROOM', 'LOBBY'], [split, right, 'BUGS FIXED', '3/7']];
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      outline(buf, s[0], top, s[1], bot, abgr(HUD_LINE));
      text(buf, s[2], s[0] + 6, top + 5, 1, abgr(HUD_LABEL));
      text(buf, s[3], s[0] + 6, top + 15, 2, abgr(COPPER_LIT));
    }
  }

  function drawCrosshair(buf) {
    var silk = abgr(SILK), cx = W >> 1, cy = HORIZON; // gap pixels: cx-1, cx (and cy-1, cy)
    for (var d = 1; d <= 5; d++) {
      buf[cy * W + cx + d] = silk; buf[cy * W + cx - 1 - d] = silk; // right, left arms
      buf[(cy + d) * W + cx] = silk; buf[(cy - 1 - d) * W + cx] = silk; // down, up arms
    }
  }

  // ---------- Public entry ----------
  window.renderGameFrame = function (canvas, opts) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(W, H);
    var buf = new Uint32Array(img.data.buffer);
    function draw(time, animated) {
      renderScene(buf, time, animated);
      renderHud(buf);
      drawCrosshair(buf);
      ctx.putImageData(img, 0, 0);
    }
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!opts || !opts.animate || reduce) { draw(0, false); return function () {}; }
    var raf = 0, last = -1e9, t0 = performance.now();
    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (now - last < 33) return; // ~30 fps is plenty for a slow sway
      last = now;
      draw(Math.max(0, now - t0), true); // rAF time can be a bit before t0
    }
    draw(0, true);
    raf = requestAnimationFrame(tick);
    return function stop() { cancelAnimationFrame(raf); };
  };
})();
