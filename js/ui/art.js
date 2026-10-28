var PS = globalThis.PS || (globalThis.PS = {});

PS.Art = (function () {
  'use strict';

  var seq = 0;
  var INK = '#2a1d16';

  function uid() { return 'a' + (++seq) + '_'; }
  function rg(id, a, b, cx, cy, r) {
    return '<radialGradient id="' + id + '" cx="' + (cx || 38) + '%" cy="' + (cy || 30) + '%" r="' + (r || 80) + '%"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></radialGradient>';
  }
  function lg(id, a, b) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>';
  }
  function svg(vb, defs, body, cls) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vb + ' ' + vb + '" class="' + (cls || 'art-svg') + '"><defs>' + defs + '</defs>' + body + '</svg>';
  }
  function eyes(x1, x2, y, r, col) {
    r = r || 6; col = col || INK;
    return '<g class="eyes"><ellipse cx="' + x1 + '" cy="' + y + '" rx="' + r + '" ry="' + r * 1.3 + '" fill="' + col + '"/><ellipse cx="' + x2 + '" cy="' + y + '" rx="' + r + '" ry="' + r * 1.3 + '" fill="' + col + '"/>' +
      '<circle cx="' + (x1 + r * .35) + '" cy="' + (y - r * .5) + '" r="' + r * .38 + '" fill="#fff"/><circle cx="' + (x2 + r * .35) + '" cy="' + (y - r * .5) + '" r="' + r * .38 + '" fill="#fff"/></g>';
  }
  function brows(x1, x2, y, on, w) {
    if (!on) return '';
    w = w || 10;
    return '<g stroke="#5a1410" stroke-width="4.5" stroke-linecap="round"><path d="M' + (x1 - w) + ' ' + (y - 9) + ' L' + (x1 + w * .6) + ' ' + (y - 2) + '"/><path d="M' + (x2 + w) + ' ' + (y - 9) + ' L' + (x2 - w * .6) + ' ' + (y - 2) + '"/></g>';
  }
  function smile(x, y, w, d, sw) {
    return '<path d="M' + (x - w) + ' ' + y + ' Q' + x + ' ' + (y + d) + ' ' + (x + w) + ' ' + y + '" stroke="' + INK + '" stroke-width="' + (sw || 3.5) + '" fill="none" stroke-linecap="round"/>';
  }
  function crown(cx, y, s, col, gem, edge) {
    col = col || '#ffcf4a'; gem = gem || '#ff6b5b'; edge = edge || '#a8740b';
    var k = s || 1;
    function p(dx, dy) { return (cx + dx * k).toFixed(1) + ' ' + (y + dy * k).toFixed(1); }
    return '<path d="M' + p(-21, 16) + ' L' + p(-24, 0) + ' L' + p(-13, 8) + ' L' + p(-3, -5) + ' L' + p(7, 8) + ' L' + p(18, 0) + ' L' + p(15, 16) + ' Z" fill="' + col + '" stroke="' + edge + '" stroke-width="2" stroke-linejoin="round" transform="translate(' + (3 * k).toFixed(1) + ' 0)"/>' +
      '<circle cx="' + (cx + 3 * k - 3 * k).toFixed(1) + '" cy="' + (y + 9 * k).toFixed(1) + '" r="' + 3.5 * k + '" fill="' + gem + '"/>';
  }
  function wrapMon(vb, u, rage, defs, body) {
    var g = rage ? '<radialGradient id="' + u + 'rage"><stop offset=".55" stop-color="#ff3b2a" stop-opacity=".55"/><stop offset="1" stop-color="#ff3b2a" stop-opacity="0"/></radialGradient>' : '';
    var halo = rage ? '<circle cx="' + vb / 2 + '" cy="' + vb / 2 + '" r="' + vb * .49 + '" fill="url(#' + u + 'rage)"/>' : '';
    return svg(vb, defs + g, halo + body, 'art-svg mon-svg' + (rage ? ' rage' : ''));
  }

  var spots = function (arr, col) {
    return arr.map(function (a) { return '<circle cx="' + a[0] + '" cy="' + a[1] + '" r="' + a[2] + '" fill="' + col + '"/>'; }).join('');
  };
  var shine = function (x, y, rx, ry, rot) {
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="#fff9" transform="rotate(' + (rot || -28) + ' ' + x + ' ' + y + ')"/>';
  };

  // ---------- regular enemies (viewBox 120) ----------
  var E = {
    slime: function (u, r) {
      return [rg(u + 'a', '#c6f7a8', '#3fae5a'),
        '<path d="M16 104 C10 62 34 30 60 30 C86 30 110 62 104 104 Q60 113 16 104Z" fill="url(#' + u + 'a)"/>' + shine(42, 50, 11, 6) +
        '<circle cx="90" cy="48" r="3" fill="#fff8"/>' + eyes(47, 73, 70) + brows(47, 73, 70, r) + smile(60, 86, 10, 8)];
    },
    gremlin: function (u, r) {
      return [rg(u + 'a', '#d3b3f7', '#7b4fc4'),
        '<path d="M32 60 L4 30 L40 48Z" fill="#7b4fc4"/><path d="M88 60 L116 30 L80 48Z" fill="#7b4fc4"/><path d="M30 56 L14 40 L36 50Z" fill="#ff8ccf"/><path d="M90 56 L106 40 L84 50Z" fill="#ff8ccf"/>' +
        '<ellipse cx="60" cy="74" rx="36" ry="31" fill="url(#' + u + 'a)"/>' +
        '<g class="eyes"><ellipse cx="46" cy="66" rx="9" ry="10" fill="#ffd23f"/><ellipse cx="74" cy="66" rx="9" ry="10" fill="#ffd23f"/><circle cx="47" cy="68" r="4" fill="' + INK + '"/><circle cx="73" cy="68" r="4" fill="' + INK + '"/></g>' + brows(46, 74, 66, r) +
        '<path d="M44 86 Q60 100 76 86 Z" fill="' + INK + '"/><path d="M50 87 l3 5 l3 -5 M64 87 l3 5 l3 -5" fill="#fff"/>' +
        '<path d="M92 92 Q112 84 110 104 Q106 112 94 108Z" fill="#c48a55" stroke="#8a5a30" stroke-width="2"/><circle cx="101" cy="98" r="4" fill="#ffd23f"/>'];
    },
    beetle: function (u, r) {
      return [rg(u + 'a', '#ffcf8a', '#c4682a') + rg(u + 'b', '#f8e2b8', '#d9a86a'),
        '<g stroke="#6b3a18" stroke-width="5" stroke-linecap="round" fill="none"><path d="M24 98 L12 108"/><path d="M96 98 L108 108"/><path d="M34 104 L28 114"/><path d="M86 104 L92 114"/></g>' +
        '<path d="M18 98 C14 50 106 50 102 98 Q60 110 18 98Z" fill="url(#' + u + 'a)" stroke="#8a4a1e" stroke-width="2.5"/>' +
        '<path d="M60 54 L60 90" stroke="#8a4a1e" stroke-width="3" opacity=".6"/>' +
        '<path d="M28 68 L20 50 L40 60Z M46 58 L44 38 L58 54Z M64 54 L72 36 L80 58Z M84 62 L98 48 L96 70Z" fill="#f2e6c9" stroke="#8a6a3a" stroke-width="2" stroke-linejoin="round"/>' +
        '<ellipse cx="60" cy="90" rx="26" ry="17" fill="url(#' + u + 'b)"/>' + eyes(50, 70, 88, 4.5) + brows(50, 70, 88, r, 7) + smile(60, 98, 6, 4, 3)];
    },
    golem: function (u, r) {
      return [rg(u + 'a', '#d8cfc4', '#7d7166'),
        '<rect x="9" y="58" width="22" height="36" rx="10" fill="#7d7166"/><rect x="89" y="58" width="22" height="36" rx="10" fill="#7d7166"/>' +
        '<rect x="22" y="38" width="76" height="68" rx="20" fill="url(#' + u + 'a)"/>' +
        '<path d="M28 46 Q42 32 58 42 Q72 30 92 46 Q80 40 70 44 Q58 38 48 46 Q38 40 28 46Z" fill="#7fb069"/>' +
        '<path d="M38 96 L46 84 L42 74" stroke="#00000033" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<g class="eyes"><rect x="40" y="62" width="14" height="8" rx="3" fill="#ffd23f"/><rect x="66" y="62" width="14" height="8" rx="3" fill="#ffd23f"/></g>' + brows(47, 73, 62, r, 9) +
        '<rect x="50" y="82" width="20" height="5" rx="2.5" fill="#5e544b"/>'];
    },
    boulder: function (u, r) {
      return [rg(u + 'a', '#cdb79a', '#6e5640'),
        '<g stroke="#b8a68c" stroke-width="4" stroke-linecap="round" opacity=".7"><path d="M4 50 L22 50"/><path d="M0 66 L20 66"/><path d="M6 82 L24 82"/></g>' +
        '<ellipse cx="60" cy="112" rx="40" ry="6" fill="#0003"/><circle cx="64" cy="66" r="44" fill="url(#' + u + 'a)"/>' +
        '<path d="M40 30 L52 48 L44 62 M92 40 L80 56 M80 102 L72 86 L84 76" stroke="#0004" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M44 40 Q58 28 78 34" stroke="#7fb069" stroke-width="6" fill="none" stroke-linecap="round"/>' +
        '<path d="M44 64 L58 70 M86 64 L72 70" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
        '<circle cx="53" cy="74" r="4.5" fill="#ffd23f"/><circle cx="77" cy="74" r="4.5" fill="#ffd23f"/><path d="M52 92 Q65 84 78 92" stroke="' + INK + '" stroke-width="4" fill="none" stroke-linecap="round"/>' + brows(53, 77, 74, r, 6)];
    },
    mole: function (u, r) {
      return [rg(u + 'a', '#b98e6a', '#5e4030'),
        '<ellipse cx="60" cy="108" rx="48" ry="10" fill="#7a5a3c"/><circle cx="26" cy="104" r="5" fill="#8a6a48"/><circle cx="96" cy="106" r="6" fill="#8a6a48"/>' +
        '<ellipse cx="60" cy="74" rx="36" ry="32" fill="url(#' + u + 'a)"/>' +
        '<path d="M22 86 L10 100 M28 92 L20 106 M16 92 L8 90 M98 86 L110 100 M92 92 L100 106 M104 92 L112 90" stroke="#f3e6d0" stroke-width="5" stroke-linecap="round" fill="none"/>' +
        '<ellipse cx="60" cy="82" rx="14" ry="11" fill="#e8b7a8"/><ellipse cx="60" cy="77" rx="7" ry="5" fill="#d98a8a"/>' +
        '<circle cx="44" cy="62" r="4" fill="' + INK + '"/><circle cx="76" cy="62" r="4" fill="' + INK + '"/><circle cx="45.5" cy="60.5" r="1.4" fill="#fff"/><circle cx="77.5" cy="60.5" r="1.4" fill="#fff"/>' + brows(44, 76, 62, r, 6) +
        '<path d="M46 80 L32 78 M46 84 L32 88 M74 80 L88 78 M74 84 L88 88" stroke="#f3e6d0" stroke-width="1.8" stroke-linecap="round"/>'];
    },
    frost_spirit: function (u, r) {
      return [rg(u + 'a', '#f4fdff', '#8cc9ea'),
        '<path d="M24 100 L24 58 C24 32 40 20 60 20 C80 20 96 32 96 58 L96 100 Q92 112 84 102 Q76 94 70 106 Q62 96 54 108 Q46 94 38 104 Q30 112 24 100Z" fill="url(#' + u + 'a)" opacity=".95"/>' +
        shine(44, 38, 9, 5, -30) +
        '<g stroke="#7ec9ea" stroke-width="3" stroke-linecap="round"><path d="M60 8 L60 24 M53 11 L67 21 M67 11 L53 21"/></g>' +
        '<circle cx="30" cy="30" r="3" fill="#fff"/><circle cx="92" cy="40" r="2.5" fill="#fff"/><circle cx="100" cy="76" r="2" fill="#fff"/>' +
        eyes(47, 73, 58, 6, '#1d4e6b') + brows(47, 73, 58, r) + '<ellipse cx="60" cy="76" rx="5" ry="6" fill="#1d4e6b"/>'];
    },
    ice_wolf: function (u, r) {
      return [rg(u + 'a', '#e4f5ff', '#6fa4d6'),
        '<path d="M22 56 L16 14 L48 36Z" fill="#8fb9e0"/><path d="M98 56 L104 14 L72 36Z" fill="#8fb9e0"/><path d="M26 48 L22 24 L40 38Z" fill="#c9ecff"/><path d="M94 48 L98 24 L80 38Z" fill="#c9ecff"/>' +
        '<path d="M10 70 L22 62 L16 80 L28 82 L22 96 L38 98 L60 108 L82 98 L98 96 L92 82 L104 80 L98 62 L110 70 C106 38 84 30 60 30 C36 30 14 38 10 70Z" fill="url(#' + u + 'a)"/>' +
        '<ellipse cx="60" cy="86" rx="24" ry="17" fill="#f2fbff"/><ellipse cx="60" cy="76" rx="8" ry="5.5" fill="#24425c"/>' +
        '<g class="eyes"><ellipse cx="44" cy="60" rx="7" ry="7.5" fill="#fff"/><ellipse cx="76" cy="60" rx="7" ry="7.5" fill="#fff"/><circle cx="45" cy="61" r="4" fill="#2b7fc4"/><circle cx="75" cy="61" r="4" fill="#2b7fc4"/><circle cx="45" cy="61" r="1.8" fill="#10253a"/><circle cx="75" cy="61" r="1.8" fill="#10253a"/></g>' + brows(44, 76, 60, r, 8) +
        '<path d="M48 90 Q60 100 72 90 Z" fill="#7a2f3a"/><path d="M51 90 l3 6 l3 -6 M63 90 l3 6 l3 -6" fill="#fff"/><path d="M60 82 L60 90" stroke="#24425c" stroke-width="2.5"/>'];
    },
    snow_golem: function (u, r) {
      return [rg(u + 'a', '#ffffff', '#aecbe0') + rg(u + 'b', '#e9f6ff', '#8fb6d6'),
        '<path d="M16 72 L2 52 L24 62Z M104 72 L118 52 L96 62Z" fill="#bfeaff" stroke="#6fb7dc" stroke-width="2" stroke-linejoin="round"/>' +
        '<circle cx="60" cy="82" r="31" fill="url(#' + u + 'a)"/><circle cx="60" cy="42" r="24" fill="url(#' + u + 'b)"/>' +
        '<path d="M44 26 L38 8 L52 20Z M62 22 L64 2 L72 20Z M78 28 L90 12 L88 32Z" fill="#cdf1ff" stroke="#7ec9ea" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M46 98 L56 88 L52 78 M78 92 L70 82" stroke="#6f9cbf" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
        '<g class="eyes"><rect x="46" y="38" width="10" height="9" rx="3" fill="#2b6fb0"/><rect x="64" y="38" width="10" height="9" rx="3" fill="#2b6fb0"/><circle cx="51" cy="42" r="2" fill="#aef"/><circle cx="69" cy="42" r="2" fill="#aef"/></g>' + brows(51, 69, 40, r, 8) +
        '<path d="M52 54 L68 54" stroke="#4a6f8c" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="76" r="3.5" fill="#4a6f8c"/><circle cx="60" cy="90" r="3.5" fill="#4a6f8c"/>'];
    },
    mycelium: function (u, r) {
      return [rg(u + 'a', '#eed4f5', '#9a66b8') + rg(u + 'c', '#c7f2e0', '#3f9c86'),
        '<g stroke="#c9a2d8" stroke-width="4" stroke-linecap="round" fill="none"><path d="M20 104 Q8 108 6 116"/><path d="M40 108 Q34 116 28 118"/><path d="M80 108 Q88 116 94 118"/><path d="M100 104 Q112 108 114 116"/></g>' +
        '<path d="M14 104 C8 66 34 44 60 44 C86 44 112 66 106 104 Q60 114 14 104Z" fill="url(#' + u + 'a)"/>' +
        '<path d="M24 52 C20 34 52 28 56 46Z" fill="url(#' + u + 'c)"/><path d="M70 42 C72 24 104 28 98 54Z" fill="url(#' + u + 'c)"/><path d="M52 40 C54 22 76 22 74 42Z" fill="#f2b8d8"/>' +
        spots([[34, 40, 3], [86, 38, 3.5], [62, 30, 2.5]], '#fff') + shine(40, 62, 10, 5) +
        '<circle cx="14" cy="34" r="2.5" fill="#d9f5c8"/><circle cx="104" cy="26" r="2" fill="#d9f5c8"/><circle cx="110" cy="48" r="3" fill="#d9f5c8"/><circle cx="8" cy="58" r="2" fill="#d9f5c8"/>' +
        eyes(46, 74, 78, 6) + brows(46, 74, 78, r) + '<ellipse cx="60" cy="94" rx="6" ry="4.5" fill="#5a2a6e"/>'];
    },
    toad_shaman: function (u, r) {
      return [rg(u + 'a', '#c9e88a', '#5a9a3a') + rg(u + 'b', '#ff9b8a', '#d63a2a'),
        '<path d="M100 112 L100 30" stroke="#8a5a30" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="24" r="9" fill="#7ee89a" stroke="#fff8" stroke-width="2"/><circle cx="97" cy="21" r="2.5" fill="#fff"/>' +
        '<ellipse cx="60" cy="86" rx="34" ry="26" fill="url(#' + u + 'a)"/><ellipse cx="60" cy="96" rx="22" ry="14" fill="#e8f2b8"/>' +
        '<ellipse cx="30" cy="110" rx="12" ry="6" fill="#4a8a30"/><ellipse cx="82" cy="110" rx="12" ry="6" fill="#4a8a30"/>' +
        '<circle cx="40" cy="62" r="11" fill="#fff"/><circle cx="80" cy="62" r="11" fill="#fff"/><circle cx="41" cy="64" r="6" fill="' + INK + '"/><circle cx="79" cy="64" r="6" fill="' + INK + '"/><circle cx="43" cy="61" r="2" fill="#fff"/><circle cx="81" cy="61" r="2" fill="#fff"/>' +
        '<path d="M6 48 C6 4 114 4 114 48 Q60 62 6 48Z" fill="url(#' + u + 'b)"/>' + spots([[30, 30, 7], [60, 20, 6], [88, 32, 7], [56, 42, 4], [104, 44, 3.5], [14, 42, 3.5]], '#fff') +
        brows(40, 80, 60, r, 9) + '<path d="M40 88 Q60 100 80 88" stroke="#2a4a1a" stroke-width="3.5" fill="none" stroke-linecap="round"/>'];
    },
    rot_slime: function (u, r) {
      return [rg(u + 'a', '#cfd685', '#6f7a2e'),
        '<path d="M14 106 C8 70 30 38 58 38 C88 38 112 66 106 106 Q96 112 90 104 Q84 114 76 106 Q60 114 46 106 Q36 114 28 106 Q20 112 14 106Z" fill="url(#' + u + 'a)"/>' +
        spots([[30, 80, 6], [88, 60, 5], [76, 90, 4], [36, 56, 3.5]], '#5a6422') + shine(40, 54, 10, 5) +
        '<circle cx="96" cy="36" r="5" fill="#d9e69a" opacity=".8"/><circle cx="106" cy="24" r="3" fill="#d9e69a" opacity=".8"/>' +
        '<rect x="56" y="22" width="6" height="18" rx="3" fill="#f0e2c4"/><path d="M48 24 C48 10 70 10 70 24Z" fill="#c4572e"/><circle cx="55" cy="18" r="2" fill="#fff"/>' +
        '<ellipse cx="46" cy="70" rx="7" ry="8" fill="' + INK + '"/><ellipse cx="74" cy="68" rx="5" ry="6" fill="' + INK + '"/><circle cx="48" cy="67" r="2.4" fill="#fff"/><circle cx="76" cy="66" r="1.8" fill="#fff"/>' + brows(46, 74, 69, r, 7) +
        '<path d="M46 88 Q54 82 60 88 Q68 94 76 86" stroke="' + INK + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>'];
    },
    imp: function (u, r) {
      return [rg(u + 'a', '#ff9a6a', '#c92f1e') + lg(u + 'f', '#ffe36a', '#ff6a1a'),
        '<path d="M44 38 C34 22 40 8 52 2 C50 14 56 18 58 12 C60 4 66 2 68 0 C72 12 82 18 78 38Z" fill="url(#' + u + 'f)"/><path d="M52 38 C48 28 54 22 60 20 C66 24 70 30 68 38Z" fill="#fff3a0"/>' +
        '<path d="M36 46 L26 22 L50 38Z M84 46 L94 22 L70 38Z" fill="#5a1a1a"/>' +
        '<path d="M92 100 Q112 96 110 78 L116 82 L112 70 L104 74 Q104 90 90 92Z" fill="#c92f1e"/>' +
        '<ellipse cx="60" cy="74" rx="32" ry="32" fill="url(#' + u + 'a)"/>' + shine(44, 56, 9, 5) +
        '<g class="eyes"><path d="M38 66 Q46 58 54 68 Q46 72 38 66Z" fill="#ffe36a"/><path d="M82 66 Q74 58 66 68 Q74 72 82 66Z" fill="#ffe36a"/><circle cx="47" cy="67" r="2.6" fill="' + INK + '"/><circle cx="73" cy="67" r="2.6" fill="' + INK + '"/></g>' + brows(46, 74, 66, true, 9) +
        '<path d="M40 84 Q60 102 80 84 Z" fill="' + INK + '"/><path d="M46 85 l3 6 l3 -6 M66 85 l3 6 l3 -6" fill="#fff"/><ellipse cx="34" cy="108" rx="9" ry="5" fill="#7a2418"/><ellipse cx="86" cy="108" rx="9" ry="5" fill="#7a2418"/>'];
    },
    lava_golem: function (u, r) {
      return [rg(u + 'a', '#7d6a68', '#2e2428') + lg(u + 'l', '#ffe36a', '#ff5a1a'),
        '<rect x="7" y="56" width="24" height="40" rx="11" fill="#3a2e30"/><rect x="89" y="56" width="24" height="40" rx="11" fill="#3a2e30"/>' +
        '<path d="M14 82 L24 78 M100 84 L108 78" stroke="#ff7a2a" stroke-width="3" stroke-linecap="round"/>' +
        '<rect x="22" y="36" width="76" height="72" rx="20" fill="url(#' + u + 'a)"/>' +
        '<path d="M34 40 L42 56 L36 70 L48 84 L44 104 M84 40 L76 54 L86 68 L74 82 L80 104 M52 40 L58 52 L70 46" stroke="url(#' + u + 'l)" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M48 108 Q50 116 52 108 M70 108 Q72 118 74 108" stroke="#ff7a2a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<g class="eyes"><rect x="40" y="58" width="14" height="9" rx="3" fill="#ffb02a"/><rect x="66" y="58" width="14" height="9" rx="3" fill="#ffb02a"/></g>' + brows(47, 73, 58, true, 9) +
        '<rect x="48" y="80" width="24" height="7" rx="3.5" fill="#ff7a2a"/>'];
    },
    ash_trickster: function (u, r) {
      return [rg(u + 'a', '#b4b4c4', '#464654'),
        '<path d="M60 36 L108 112 L12 112 Z" fill="url(#' + u + 'a)"/>' +
        '<path d="M34 40 Q20 24 10 30 Q16 44 34 52Z" fill="#5a5a6a"/><path d="M86 40 Q100 24 110 30 Q104 44 86 52Z" fill="#5a5a6a"/>' +
        '<circle cx="10" cy="30" r="4" fill="#ff8a3a"/><circle cx="110" cy="30" r="4" fill="#ff8a3a"/>' +
        '<ellipse cx="60" cy="54" rx="26" ry="22" fill="#3a3a48"/><ellipse cx="60" cy="56" rx="19" ry="17" fill="#f4efe6"/>' +
        '<g class="eyes"><path d="M46 52 Q51 47 56 54 Q50 57 46 52Z" fill="#ff8a3a"/><path d="M74 52 Q69 47 64 54 Q70 57 74 52Z" fill="#ff8a3a"/></g>' + brows(51, 69, 52, r, 7) +
        '<path d="M46 64 Q60 76 74 64" stroke="' + INK + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
        '<g fill="#8a8a98" opacity=".6"><circle cx="20" cy="92" r="6"/><circle cx="12" cy="80" r="4"/><circle cx="102" cy="90" r="6"/><circle cx="110" cy="76" r="3.5"/></g>' +
        '<circle cx="60" cy="96" r="6" fill="#ffd23f" stroke="#a8740b" stroke-width="2"/>'];
    }
  };

  // ---------- bosses (viewBox 160) ----------
  var B = {
    slime_king: function (u, r) {
      return [rg(u + 'a', '#e0b8ff', '#8a4fd8'),
        '<ellipse cx="80" cy="146" rx="62" ry="8" fill="#0003"/>' +
        '<path d="M20 142 C10 84 44 40 80 40 C116 40 150 84 140 142 Q130 150 120 142 Q106 154 92 142 Q80 152 66 142 Q50 154 40 142 Q28 150 20 142Z" fill="url(#' + u + 'a)"/>' +
        '<path d="M24 120 Q50 132 80 128 Q112 132 136 120" stroke="#6a3ab0" stroke-width="3" fill="none" opacity=".5"/>' + shine(52, 64, 16, 8) +
        '<circle cx="124" cy="62" r="4" fill="#fff8"/><circle cx="112" cy="50" r="2.5" fill="#fff8"/>' +
        crown(80, 20, 1.5) +
        eyes(62, 98, 90, 8.5) + brows(62, 98, 90, r, 13) + smile(80, 112, 16, 12, 4.5) +
        '<ellipse cx="22" cy="150" rx="14" ry="9" fill="#a874ec"/><ellipse cx="140" cy="152" rx="12" ry="8" fill="#a874ec"/><circle cx="18" cy="148" r="2.2" fill="' + INK + '"/><circle cx="26" cy="148" r="2.2" fill="' + INK + '"/>'];
    },
    ancient_golem: function (u, r) {
      return [rg(u + 'a', '#d4ccd8', '#605872') + rg(u + 'b', '#c9c0d8', '#5d5576'),
        '<ellipse cx="80" cy="150" rx="58" ry="7" fill="#0003"/>' +
        '<rect x="8" y="62" width="34" height="76" rx="16" fill="url(#' + u + 'b)"/><rect x="118" y="62" width="34" height="76" rx="16" fill="url(#' + u + 'b)"/>' +
        '<rect x="14" y="120" width="22" height="24" rx="9" fill="#4a4260"/><rect x="124" y="120" width="22" height="24" rx="9" fill="#4a4260"/>' +
        '<rect x="30" y="46" width="100" height="98" rx="26" fill="url(#' + u + 'a)"/>' +
        '<path d="M34 56 Q52 38 76 52 Q96 36 126 56 Q108 50 94 56 Q76 46 60 56 Q46 48 34 56Z" fill="#7fb069"/><circle cx="48" cy="52" r="3" fill="#a8d58a"/>' +
        '<path d="M44 134 L56 112 L50 98" stroke="#0004" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
        '<g stroke="#7ee8fa" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M70 108 L80 98 L90 108 L80 122 Z"/><path d="M100 96 L112 96 M106 96 L106 112"/><path d="M48 100 L58 104"/></g>' +
        '<path d="M40 40 L36 14 L52 28 L62 6 L72 26 L80 4 L88 26 L98 6 L108 28 L124 14 L120 40Z" fill="#cfd8e8" stroke="#8a9ab8" stroke-width="2.5" stroke-linejoin="round"/><circle cx="80" cy="30" r="5" fill="#7ee8fa"/>' +
        '<g class="eyes"><rect x="48" y="66" width="22" height="12" rx="4" fill="#7ee8fa"/><rect x="90" y="66" width="22" height="12" rx="4" fill="#7ee8fa"/></g>' + brows(59, 101, 66, r, 14) +
        '<path d="M62 92 L98 92" stroke="#3b3550" stroke-width="6" stroke-linecap="round"/>'];
    },
    ice_queen: function (u, r) {
      return [rg(u + 'a', '#f2fbff', '#4a8fd8'),
        '<path d="M32 148 L32 84 C32 46 54 32 80 32 C106 32 128 46 128 84 L128 148 Q120 160 112 148 Q104 138 96 152 Q88 140 80 154 Q72 140 64 152 Q56 138 48 148 Q40 160 32 148Z" fill="url(#' + u + 'a)" opacity=".96"/>' +
        '<path d="M44 90 Q80 120 116 90" stroke="#fff" stroke-width="2.5" fill="none" opacity=".7"/>' + shine(58, 56, 14, 7, -30) +
        '<g stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"><path d="M50 124 L50 138 M44 128 L56 134 M56 128 L44 134"/><path d="M110 118 L110 132 M104 122 L116 128 M116 122 L104 128"/></g>' +
        '<path d="M48 40 L52 8 L64 30 L72 0 L80 26 L88 0 L96 30 L108 8 L112 40 Z" fill="#c9f1ff" stroke="#7ec9ea" stroke-width="2.5" stroke-linejoin="round"/><circle cx="80" cy="30" r="5" fill="#ff7ab8"/>' +
        '<path d="M130 140 L138 40" stroke="#9fd8f0" stroke-width="5" stroke-linecap="round"/><path d="M138 40 L130 24 L138 14 L146 24Z" fill="#e6fbff" stroke="#7ec9ea" stroke-width="2"/>' +
        eyes(62, 98, 74, 7.5, '#123a63') + brows(62, 98, 74, r, 12) +
        '<path d="M66 98 Q80 92 94 98" stroke="#123a63" stroke-width="4" fill="none" stroke-linecap="round"/>'];
    },
    mycelium_mother: function (u, r) {
      return [rg(u + 'a', '#c46a9a', '#4a1f52') + rg(u + 'b', '#f0dcc4', '#b89a78') + rg(u + 'c', '#c7f2e0', '#3f9c86'),
        '<ellipse cx="80" cy="150" rx="64" ry="7" fill="#0003"/>' +
        '<g stroke="#b88ac8" stroke-width="5" stroke-linecap="round" fill="none"><path d="M54 144 Q36 154 20 150"/><path d="M106 144 Q124 154 140 150"/><path d="M66 148 Q60 158 48 158"/></g>' +
        '<rect x="46" y="76" width="68" height="72" rx="28" fill="url(#' + u + 'b)"/>' +
        '<path d="M10 80 C6 14 154 14 150 80 Q80 98 10 80Z" fill="url(#' + u + 'a)"/>' +
        '<g fill="#7ee8d0" opacity=".95">' + spots([[36, 52, 9], [66, 34, 7], [98, 38, 9], [126, 56, 7], [82, 62, 5], [18, 70, 4]], '#7ee8d0') + '</g>' +
        '<g fill="#d9fff2" opacity=".8">' + spots([[34, 50, 3], [96, 36, 3], [124, 54, 2.5]], '#d9fff2') + '</g>' +
        '<path d="M16 62 C10 44 40 38 44 56Z" fill="url(#' + u + 'c)"/>' +
        '<g fill="#d9f5c8"><circle cx="14" cy="30" r="3"/><circle cx="148" cy="30" r="3.5"/><circle cx="152" cy="62" r="2.5"/><circle cx="8" cy="52" r="2.5"/><circle cx="130" cy="10" r="2.5"/></g>' +
        crown(80, 6, 1.1, '#e8c8ff', '#7ee8d0', '#8a5ab0') +
        eyes(64, 96, 102, 7.5) + brows(64, 96, 102, r, 12) + '<ellipse cx="80" cy="124" rx="9" ry="6" fill="#5a2a6e"/>'];
    },
    lava_serpent: function (u, r) {
      return [rg(u + 'a', '#c45a3a', '#4a1814') + lg(u + 'l', '#ffe36a', '#ff5a1a'),
        '<ellipse cx="80" cy="152" rx="60" ry="6" fill="#0003"/>' +
        '<path d="M30 140 C-4 130 14 98 50 108 C96 120 112 80 70 70 C40 62 44 44 74 42" stroke="#7a2a1c" stroke-width="30" fill="none" stroke-linecap="round"/>' +
        '<path d="M30 140 C-4 130 14 98 50 108 C96 120 112 80 70 70 C40 62 44 44 74 42" stroke="url(#' + u + 'a)" stroke-width="22" fill="none" stroke-linecap="round"/>' +
        '<path d="M26 140 C-2 130 16 100 50 110 C96 122 110 82 70 72" stroke="url(#' + u + 'l)" stroke-width="3.5" fill="none" stroke-dasharray="9 9" stroke-linecap="round"/>' +
        '<path d="M96 52 L88 22 L108 38Z M138 52 L150 22 L128 38Z" fill="#3a1410"/>' +
        '<path d="M100 28 C96 14 106 8 110 2 C110 12 116 14 118 8 C120 14 126 18 126 28Z" fill="url(#' + u + 'l)"/>' +
        '<ellipse cx="118" cy="62" rx="36" ry="30" fill="url(#' + u + 'a)"/><ellipse cx="118" cy="74" rx="26" ry="16" fill="#e8a06a" opacity=".55"/>' +
        '<g class="eyes"><ellipse cx="104" cy="56" rx="7" ry="8" fill="#ffd23f"/><ellipse cx="132" cy="56" rx="7" ry="8" fill="#ffd23f"/><ellipse cx="105" cy="57" rx="2.5" ry="6" fill="' + INK + '"/><ellipse cx="131" cy="57" rx="2.5" ry="6" fill="' + INK + '"/></g>' + brows(104, 132, 56, true, 10) +
        '<circle cx="111" cy="76" r="2.2" fill="' + INK + '"/><circle cx="125" cy="76" r="2.2" fill="' + INK + '"/>' +
        '<path d="M106 86 Q118 94 130 86" stroke="' + INK + '" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M110 88 l2 6 l2 -6 M122 88 l2 6 l2 -6" fill="#fff"/>' +
        '<path d="M118 96 L118 108 L112 116 M118 108 L124 116" stroke="#ff5a3a" stroke-width="3" fill="none" stroke-linecap="round"/>'];
    },
    trickster: function (u, r) {
      return [rg(u + 'a', '#9a96b8', '#2e2c44') + lg(u + 'l', '#ffe36a', '#ff5a1a'),
        '<ellipse cx="80" cy="152" rx="52" ry="6" fill="#0003"/>' +
        '<path d="M80 62 L142 152 L18 152Z" fill="url(#' + u + 'a)"/><path d="M80 90 L112 152 L48 152Z" fill="#1e1c30" opacity=".6"/>' +
        '<path d="M46 52 Q22 30 8 36 Q14 58 44 70Z" fill="#4a4866"/><path d="M114 52 Q138 30 152 36 Q146 58 116 70Z" fill="#4a4866"/><path d="M62 34 Q60 6 74 -2 Q78 20 84 34Z" fill="#4a4866"/>' +
        '<circle cx="8" cy="36" r="5" fill="#ff8a3a"/><circle cx="152" cy="36" r="5" fill="#ff8a3a"/>' +
        '<ellipse cx="80" cy="70" rx="38" ry="32" fill="#2a2840"/>' +
        '<path d="M80 40 C58 40 46 54 46 72 C46 90 62 102 80 102Z" fill="#f4efe6"/><path d="M80 40 C102 40 114 54 114 72 C114 90 98 102 80 102Z" fill="#3a3858"/>' +
        '<g class="eyes"><path d="M58 64 Q65 56 72 66 Q64 70 58 64Z" fill="#ff8a3a"/><path d="M102 64 Q95 56 88 66 Q96 70 102 64Z" fill="#ffd23f"/></g>' + brows(65, 95, 64, r, 10) +
        '<path d="M58 84 Q80 102 102 84" stroke="' + INK + '" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M64 88 l3 7 l3 -7 M90 88 l3 7 l3 -7" fill="#fff"/>' +
        '<g stroke-linejoin="round"><rect x="10" y="100" width="22" height="30" rx="4" fill="#f4efe6" stroke="#8a8a98" stroke-width="2" transform="rotate(-18 21 115)"/><path d="M21 108 l5 7 -5 7 -5 -7z" fill="#e0483a" transform="rotate(-18 21 115)"/>' +
        '<rect x="128" y="96" width="22" height="30" rx="4" fill="#f4efe6" stroke="#8a8a98" stroke-width="2" transform="rotate(16 139 111)"/><circle cx="139" cy="111" r="6" fill="#2a2840" transform="rotate(16 139 111)"/></g>' +
        '<circle cx="80" cy="130" r="9" fill="#ffd23f" stroke="#a8740b" stroke-width="2.5"/><path d="M76 130 L84 130" stroke="#a8740b" stroke-width="2"/>' +
        '<g fill="#8a8aa0" opacity=".5"><circle cx="30" cy="144" r="7"/><circle cx="130" cy="146" r="8"/></g>'];
    }
  };

  // Painted enemies replace their vector drawing inside the same svg, so sizing, state filters and the plaster keep working.
  // The vector drawings below stay only as a fallback for an id without a picture.
  function painted(id, kind, vb) {
    var d = PS.DATA && PS.DATA[kind === 'boss' ? 'bosses' : 'enemies'][id];
    return d && ['', '<image href="img/mobs/world_' + d.world + '/' + kind + '_' + id + '.webp" width="' + vb + '" height="' + vb + '"/>'];
  }
  function enemy(id, opts) {
    var f = E[id];
    if (!f) return '';
    var u = uid(), rage = !!(opts && opts.rage), p = painted(id, 'enemy', 120) || f(u, rage);
    return wrapMon(120, u, rage, p[0], p[1]);
  }
  // Forehead spot above the right eye of each boss; a returning boss wears a plaster there.
  var PLASTER_AT = { slime_king: [110, 52, -30], ancient_golem: [84, 22, -25], ice_queen: [80, 29, -30], mycelium_mother: [94, 57, -25], lava_serpent: [124, 18, -20], trickster: [112, 32, -30] };
  function plaster(at) {
    // The painted X sits square in its picture, so it is turned to keep the old strips' tilt.
    return '<image class="plaster" href="img/mobs/plaster.webp" x="-18" y="-18" width="36" height="36" transform="translate(' + at[0] + ' ' + at[1] + ') rotate(' + (at[2] + 45) + ')"/>';
  }
  function boss(id, opts) {
    var f = B[id];
    if (!f) return '';
    var u = uid(), rage = !!(opts && opts.rage), p = painted(id, 'boss', 160) || f(u, rage);
    var body = p[1] + (opts && opts.patched && PLASTER_AT[id] ? plaster(PLASTER_AT[id]) : '');
    return wrapMon(160, u, rage, p[0], body);
  }

  // ---------- islands (viewBox 320 x 260) ----------
  var WORLD = {
    1: { top: ['#a6e07a', '#4f9a45'], lip: '#7a5a3a', rock: ['#9a7a58', '#5a4430'], water: '#5fc4e8' },
    2: { top: ['#b8c88a', '#6f8a58'], lip: '#6a5a4a', rock: ['#a8a0a0', '#5a5260'], water: '#6fb4d0' },
    3: { top: ['#f4fbff', '#a8d4ee'], lip: '#7aa4c8', rock: ['#9ec4e4', '#4a76a8'], water: '#4a9ad8' },
    4: { top: ['#4e8a6a', '#1f4a46'], lip: '#2a3a3a', rock: ['#4a4a62', '#1e1e34'], water: '#3a7a90' },
    5: { top: ['#6a5a58', '#2e2428'], lip: '#241a1c', rock: ['#5a4448', '#1c1416'], water: '#ff6a2a' }
  };

  function palm(x, y, s) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M0 0 Q4 -22 -2 -40" stroke="#8a5a30" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M-2 -40 Q-18 -52 -30 -38 Q-14 -44 -2 -40 Q-6 -58 -20 -62 Q-4 -58 -2 -40 Q8 -60 24 -56 Q6 -52 -2 -40 Q16 -44 28 -32 Q10 -38 -2 -40Z" fill="#3f9c4a" stroke="#2a6a34" stroke-width="1.5" stroke-linejoin="round"/></g>';
  }
  function tree(x, y, s, a, b) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><rect x="-3" y="-12" width="6" height="14" rx="2" fill="#7a5230"/><circle cx="0" cy="-26" r="15" fill="' + (b || '#3f9c4a') + '"/><circle cx="-5" cy="-30" r="8" fill="' + (a || '#6cc65a') + '"/></g>';
  }
  function pine(x, y, s, a, b) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><rect x="-3" y="-8" width="6" height="10" fill="#6a4a30"/><path d="M0 -50 L-16 -18 L16 -18Z M0 -38 L-20 -6 L20 -6Z" fill="' + (b || '#2f8a5a') + '"/><path d="M0 -50 L-7 -34 L7 -34Z" fill="' + (a || '#f4fbff') + '"/></g>';
  }
  function rockp(x, y, s, a, b) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-16 2 L-12 -14 L-2 -20 L10 -14 L16 2Z" fill="' + (b || '#7d7166') + '"/><path d="M-12 -14 L-2 -20 L10 -14 L2 -8Z" fill="' + (a || '#b8aea2') + '"/></g>';
  }
  function crystal(x, y, s, a, b) {
    a = a || '#e6fbff'; b = b || '#7ec9ea';
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" stroke="' + b + '" stroke-width="1.5" stroke-linejoin="round"><path d="M-10 2 L-8 -22 L-2 -34 L4 -20 L6 2Z" fill="' + a + '"/><path d="M4 2 L8 -14 L14 -22 L18 -8 L16 2Z" fill="' + a + '" opacity=".9"/><path d="M-2 -34 L-2 2" stroke="#fff" opacity=".7"/></g>';
  }
  function mush(x, y, s, cap, glowC, stem) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><ellipse cx="0" cy="-22" rx="30" ry="22" fill="' + glowC + '" opacity=".22"/><rect x="-6" y="-24" width="12" height="26" rx="5" fill="' + (stem || '#e8dcc4') + '"/><path d="M-26 -22 C-26 -52 26 -52 26 -22 Q0 -14 -26 -22Z" fill="' + cap + '"/>' +
      '<circle cx="-10" cy="-34" r="3.5" fill="' + glowC + '"/><circle cx="8" cy="-38" r="4" fill="' + glowC + '"/><circle cx="14" cy="-28" r="2.5" fill="' + glowC + '"/></g>';
  }
  function pool(x, y, rx, ry, col) {
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="' + col + '"/><ellipse cx="' + (x - rx * .3) + '" cy="' + (y - ry * .3) + '" rx="' + rx * .35 + '" ry="' + ry * .3 + '" fill="#fff5"/>';
  }
  function windmill(x, y, s) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-12 2 L-8 -36 L8 -36 L12 2Z" fill="#f2e4c8" stroke="#a8884a" stroke-width="2"/><path d="M-11 -36 L0 -50 L11 -36Z" fill="#c4572e"/>' +
      '<rect x="-4" y="-14" width="8" height="16" rx="3" fill="#8a5a30"/>' +
      '<g stroke="#8a5a30" stroke-width="3" stroke-linecap="round"><path d="M0 -38 L-26 -62 M0 -38 L26 -14 M0 -38 L24 -64 M0 -38 L-24 -14"/></g>' +
      '<g fill="#fff8e8" stroke="#a8884a" stroke-width="1.5"><path d="M-8 -48 L-26 -62 L-20 -44Z M10 -30 L26 -14 L8 -22Z M8 -48 L24 -64 L20 -42Z M-10 -30 L-24 -14 L-8 -20Z" opacity=".9"/></g><circle cx="0" cy="-38" r="3.5" fill="#6a4a30"/></g>';
  }
  function tower(x, y, w, h, wall, roof, lit) {
    var l = lit ? '<rect x="' + (x - 3) + '" y="' + (y - h * .62) + '" width="6" height="9" rx="3" fill="' + lit + '"/>' : '';
    return '<rect x="' + (x - w / 2) + '" y="' + (y - h) + '" width="' + w + '" height="' + h + '" rx="2" fill="' + wall + '"/><path d="M' + (x - w / 2 - 4) + ' ' + (y - h) + ' L' + x + ' ' + (y - h - w * 1.1) + ' L' + (x + w / 2 + 4) + ' ' + (y - h) + 'Z" fill="' + roof + '"/>' + l;
  }
  function arch(x, y, s, a, b) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><rect x="-26" y="-34" width="14" height="36" rx="3" fill="' + b + '"/><rect x="12" y="-26" width="14" height="28" rx="3" fill="' + b + '"/><rect x="-28" y="-44" width="58" height="14" rx="4" fill="' + a + '"/><rect x="-20" y="-34" width="3" height="30" fill="#0002"/><path d="M-4 -34 L-8 -22 L0 -16" stroke="#0004" stroke-width="2" fill="none"/><circle cx="-6" cy="-40" r="2.5" fill="#7ee8fa"/></g>';
  }
  function lavacracks(x, y, s) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" stroke="#ff7a2a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M-40 0 L-24 -6 L-14 2 L2 -4 L16 4 L36 -2"/><path d="M-14 2 L-18 12 M16 4 L22 14" stroke="#ffd23f" stroke-width="2"/></g>';
  }
  function debris(w, i, d) {
    var cols = d.rock;
    var pos = [[[34, 214, 9], [286, 196, 7], [62, 238, 5]], [[290, 222, 8], [26, 190, 6], [262, 244, 4]]][i % 2];
    return pos.map(function (p) {
      return '<path d="M' + (p[0] - p[2]) + ' ' + p[1] + ' L' + (p[0] - p[2] * .4) + ' ' + (p[1] - p[2]) + ' L' + (p[0] + p[2] * .6) + ' ' + (p[1] - p[2] * .6) + ' L' + (p[0] + p[2]) + ' ' + (p[1] + p[2] * .4) + ' L' + p[0] + ' ' + (p[1] + p[2]) + 'Z" fill="' + cols[0] + '"/>';
    }).join('');
  }

  // decor per island number (1..10); coordinates sit on the top surface (y ~ 100..130)
  var DECOR = {
    1: function (d) { return pool(216, 122, 40, 10, d.water) + windmill(98, 120, 1.05) + palm(152, 124, 1) + palm(250, 112, .8) + '<ellipse cx="206" cy="128" rx="26" ry="5" fill="#f2e4b0" opacity=".7"/>'; },
    2: function (d) { return pool(96, 122, 34, 9, '#7ee06a') + pool(222, 114, 40, 10, '#6fd05a') + pool(166, 134, 20, 5, '#7ee06a') + '<g stroke="#4a8a3a" stroke-width="2.5" stroke-linecap="round"><path d="M60 122 l-2 -16 M64 122 l3 -14 M254 112 l-3 -16 M258 112 l4 -12"/></g>' + tree(150, 116, .9, '#8ab05a', '#4a7a3a') + '<path d="M120 100 Q126 88 134 100 Q128 106 120 100Z" fill="#7ee06a"/>'; },
    3: function (d) { return arch(110, 124, 1.2, '#b8aea2', '#8a8078') + rockp(190, 124, 1.3) + rockp(232, 112, .9) + rockp(68, 114, .8) + '<path d="M150 124 l16 -24 l12 24Z" fill="#a8a094"/><path d="M150 124 l16 -24 l4 8 l-8 16Z" fill="#7d7166"/>'; },
    4: function (d) {
      return '<path d="M120 126 L158 36 L176 70 L196 50 L226 126Z" fill="#8a8098"/><path d="M158 36 L176 70 L168 74 L152 56Z" fill="#cfc8da"/><path d="M196 50 L226 126 L200 126Z" fill="#6a6078"/>' +
        '<path d="M158 36 L158 22" stroke="#cfd8e8" stroke-width="3"/><path d="M158 22 L172 28 L158 34Z" fill="#e0483a"/>' + rockp(80, 120, 1.1) + rockp(254, 118, .9) + '<circle cx="168" cy="96" r="5" fill="#7ee8fa" opacity=".9"/>' + arch(96, 108, .6, '#b8aea2', '#8a8078');
    },
    5: function (d) { return crystal(96, 124, 1.5) + crystal(130, 118, 1) + crystal(228, 122, 1.3, '#d6f0ff', '#6fb4e0') + pine(188, 118, .9) + '<path d="M150 128 Q170 118 200 128 Q176 136 150 128Z" fill="#bfe8f8" opacity=".8"/><g transform="translate(166 128)"><path d="M-14 0 Q0 -16 14 0Z" fill="#f4fbff" stroke="#9ec4e4" stroke-width="1.5"/><rect x="-3" y="-6" width="6" height="6" rx="3" fill="#8ab0d0"/></g>'; },
    6: function (d) { return tower(160, 122, 34, 62, '#e6f6ff', '#6fb4e8', '#ffd98a') + tower(112, 120, 22, 40, '#d4ecfa', '#4a8fd8', '#ffd98a') + tower(208, 120, 22, 44, '#d4ecfa', '#4a8fd8', '#ffd98a') + crystal(70, 116, 1) + crystal(256, 114, 1.1) + '<path d="M160 36 L160 22" stroke="#7ec9ea" stroke-width="2.5"/><path d="M160 22 L172 27 L160 32Z" fill="#ff7ab8"/>' + '<rect x="120" y="108" width="80" height="14" fill="#c4e4f6"/>'; },
    7: function (d) { return mush(100, 124, 1.4, '#7a4ac4', '#c48aff') + mush(212, 118, 1.1, '#2a9a8a', '#7ef0d8') + mush(160, 132, .7, '#c44a8a', '#ff9ad0') + mush(256, 130, .6, '#7a4ac4', '#c48aff') + pool(140, 118, 18, 5, '#3a7a90'); },
    8: function (d) { return mush(160, 128, 2.3, '#8a2a7a', '#ff8ac8') + '<circle cx="160" cy="62" r="6" fill="#ffd0f0"/>' + mush(84, 124, .9, '#2a9a8a', '#7ef0d8') + mush(244, 124, .9, '#7a4ac4', '#c48aff') + '<g fill="#d9f5c8"><circle cx="120" cy="52" r="2"/><circle cx="206" cy="46" r="2.5"/><circle cx="224" cy="70" r="2"/></g>'; },
    9: function (d) { return lavacracks(100, 120, 1.3) + lavacracks(230, 116, 1.1) + pool(166, 124, 34, 8, '#ff6a2a') + pool(166, 124, 22, 5, '#ffb02a') + rockp(70, 114, 1, '#6a5458', '#3a2c30') + rockp(262, 126, 1.1, '#6a5458', '#3a2c30') + rockp(150, 106, .8, '#6a5458', '#3a2c30'); },
    10: function (d) {
      return lavacracks(96, 124, 1.1) + lavacracks(240, 122, 1) +
        '<path d="M130 126 L134 54 L186 54 L190 126Z" fill="#2e2832"/><path d="M122 56 L160 -2 L198 56Z" fill="#3a2e42"/><path d="M160 -2 L160 -18" stroke="#8a8aa0" stroke-width="3"/><path d="M160 -18 L174 -12 L160 -6Z" fill="#ff5a1a"/>' +
        '<rect x="152" y="70" width="16" height="22" rx="8" fill="#ff8a3a"/><rect x="142" y="100" width="6" height="12" rx="3" fill="#ffb02a"/><rect x="172" y="100" width="6" height="12" rx="3" fill="#ffb02a"/>' +
        '<path d="M126 126 L126 80 L140 80 L140 126Z M180 126 L180 80 L194 80 L194 126Z" fill="#241e2a"/>' + rockp(74, 118, 1, '#6a5458', '#3a2c30') + rockp(258, 120, 1, '#6a5458', '#3a2c30');
    }
  };

  function island(worldN, islandN, opts) {
    var w = Math.max(1, Math.min(5, worldN | 0 || 1)), n = Math.max(1, Math.min(10, islandN | 0 || 1));
    var global = n;
    var d = WORLD[w], u = uid();
    var defs = lg(u + 't', d.top[0], d.top[1]) + lg(u + 'r', d.rock[0], d.rock[1]) +
      (opts && opts.locked ? '<filter id="' + u + 'k"><feColorMatrix type="matrix" values="0 0 0 0 .12  0 0 0 0 .15  0 0 0 0 .24  0 0 0 1 0"/></filter>' : '');
    var night = w >= 4;
    var body =
      '<ellipse cx="160" cy="252" rx="70" ry="5" fill="#0003"/>' +
      debris(w, global, d) +
      '<path d="M18 122 Q26 176 100 204 Q132 226 160 252 Q190 224 220 204 Q294 176 302 122 Z" fill="url(#' + u + 'r)"/>' +
      '<path d="M60 150 Q100 164 130 158 M200 160 Q236 164 268 148 M110 184 Q140 192 170 184" stroke="#0003" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M96 140 L104 170 M222 140 L214 172 M158 196 L160 224" stroke="#fff3" stroke-width="2" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="160" cy="122" rx="142" ry="32" fill="' + d.lip + '"/>' +
      '<ellipse cx="160" cy="116" rx="142" ry="30" fill="url(#' + u + 't)"/>' +
      '<ellipse cx="160" cy="116" rx="142" ry="30" fill="none" stroke="#fff4" stroke-width="2"/>' +
      (w === 5 ? '<path d="M40 124 Q50 136 60 126 M260 130 Q270 140 282 128" stroke="#ff7a2a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M92 150 Q96 164 90 176" stroke="#ff7a2a" stroke-width="3" fill="none" stroke-linecap="round"/>' : '') +
      (night && w === 4 ? '<g fill="#7ef0d8" opacity=".8"><circle cx="40" cy="110" r="2"/><circle cx="280" cy="104" r="2"/><circle cx="60" cy="90" r="1.6"/></g>' : '') +
      DECOR[global](d);
    return      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 260" class="art-svg island-svg"><defs>' + defs + '</defs>' +
      (opts && opts.locked ? '<g filter="url(#' + u + 'k)" opacity=".9">' + body + '</g>' : body) + '</svg>';
  }

  function bg(worldN) {
    var w = Math.max(1, Math.min(5, worldN | 0 || 1));
    var sky = {
      1: 'linear-gradient(180deg,#5aa8e8 0%,#9ad4f4 55%,#d8f0f0 100%)',
      2: 'linear-gradient(180deg,#6a98c8 0%,#b0c8d8 55%,#ecd8c0 100%)',
      3: 'linear-gradient(180deg,#7aa8dc 0%,#bcdcf2 55%,#f2fbff 100%)',
      4: 'linear-gradient(180deg,#0c1230 0%,#1a2a4a 60%,#1f4a4a 100%)',
      5: 'linear-gradient(180deg,#140c1c 0%,#2a1424 55%,#5a2418 100%)'
    }[w];
    var clouds = w <= 3 ?
      'radial-gradient(60px 16px at 20% 22%,#ffffff88,transparent),radial-gradient(80px 20px at 74% 34%,#ffffff70,transparent),radial-gradient(50px 12px at 48% 14%,#ffffff60,transparent),' : '';
    var stars = w >= 4 ?
      'radial-gradient(1.5px 1.5px at 12% 14%,#fff,transparent),radial-gradient(1px 1px at 28% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 44% 10%,#fff,transparent),' +
      'radial-gradient(1px 1px at 58% 24%,#fff,transparent),radial-gradient(2px 2px at 72% 12%,#ffe9b0,transparent),radial-gradient(1px 1px at 86% 28%,#fff,transparent),' +
      'radial-gradient(1.5px 1.5px at 92% 8%,#fff,transparent),radial-gradient(1px 1px at 6% 42%,#fff,transparent),radial-gradient(1px 1px at 36% 48%,#fff,transparent),' +
      'radial-gradient(1.5px 1.5px at 66% 44%,#fff,transparent),radial-gradient(40px 40px at 82% 18%,#ffe9b022,transparent),' : '';
    return clouds + stars + sky;
  }

  // ---------- icons (viewBox 32) ----------
  var ICONS = {
    coin: '<circle cx="16" cy="16" r="13" fill="#e0a82a"/><circle cx="16" cy="16" r="12" fill="#ffcf4a"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="#c4881a" stroke-width="2"/><path d="M16 10.5 l1.7 3.6 3.9 .5 -2.9 2.7 .8 3.9 -3.5 -2 -3.5 2 .8 -3.9 -2.9 -2.7 3.9 -.5z" fill="#c4881a"/><path d="M8 10 Q11 6 16 5" stroke="#fff9" stroke-width="2" fill="none" stroke-linecap="round"/>',
    gem: '<path d="M8 6 H24 L30 13 L16 29 L2 13Z" fill="#4ad0e8" stroke="#1f8aa8" stroke-width="1.5" stroke-linejoin="round"/><path d="M2 13 H30 M8 6 L12 13 L16 29 L20 13 L24 6 M12 13 L16 6 L20 13" stroke="#1f8aa8" stroke-width="1.2" fill="none" stroke-linejoin="round"/><path d="M8 6 L16 6 L12 13 L2 13Z" fill="#aef2ff"/>',
    flask: '<path d="M12 3 H20 M13 3 V12 L5 25 Q3 29 8 29 H24 Q29 29 27 25 L19 12 V3" fill="#d8f2ff" stroke="#6a8aa8" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><path d="M8.5 21 Q16 17 23.5 21 L27 25 Q29 29 24 29 H8 Q3 29 5 25Z" fill="#c46aff"/><circle cx="13" cy="24" r="1.8" fill="#fff9"/><circle cx="19" cy="22.5" r="1.2" fill="#fff9"/><path d="M11 2 H21" stroke="#c4881a" stroke-width="2.5" stroke-linecap="round"/>',
    shop: '<path d="M4 12 L7 4 H25 L28 12Z" fill="#e0483a"/><path d="M4 12 Q7 17 10 12 Q13 17 16 12 Q19 17 22 12 Q25 17 28 12Z" fill="#fff4e0"/><path d="M10 4 L9 12 M16 4 V12 M22 4 L23 12" stroke="#fff4e0" stroke-width="1.8" opacity=".9"/><rect x="6" y="16" width="20" height="12" rx="2" fill="#c48a55"/><rect x="11" y="19" width="10" height="9" rx="1.5" fill="#6a4a30"/><circle cx="19.5" cy="23.5" r="1" fill="#ffcf4a"/>',
    map: '<path d="M3 8 L11 5 L21 8 L29 5 V24 L21 27 L11 24 L3 27Z" fill="#f4e4b8" stroke="#a8884a" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 5 V24 M21 8 V27" stroke="#a8884a" stroke-width="1.2"/><path d="M16 11 C12 11 12 16 16 20 C20 16 20 11 16 11Z" fill="#e0483a"/><circle cx="16" cy="14.5" r="1.8" fill="#fff4e0"/>',
    book: '<path d="M16 8 C12 5 6 5 3 6 V25 C6 24 12 24 16 27 C20 24 26 24 29 25 V6 C26 5 20 5 16 8Z" fill="#8a5ac4" stroke="#5a3a8a" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 8 V27" stroke="#5a3a8a" stroke-width="1.6"/><path d="M6.5 10 Q11 9.5 13.5 11.5 M6.5 14 Q11 13.5 13.5 15.5 M25.5 10 Q21 9.5 18.5 11.5 M25.5 14 Q21 13.5 18.5 15.5" stroke="#f4e4ff" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M23 3 V11 L25 9 L27 11 V4Z" fill="#ffcf4a"/>',
    gift: '<rect x="4" y="13" width="24" height="15" rx="2" fill="#e0483a"/><rect x="3" y="9" width="26" height="6" rx="2" fill="#f2685a"/><rect x="14" y="9" width="4" height="19" fill="#ffcf4a"/><path d="M16 9 C10 9 8 3 12 3 C15 3 16 7 16 9 C16 7 17 3 20 3 C24 3 22 9 16 9Z" fill="#ffcf4a" stroke="#c4881a" stroke-width="1.2" stroke-linejoin="round"/>',
    quests: '<path d="M8 4 H22 Q26 4 26 8 V26 Q26 28 24 28 H10 Q8 28 8 26Z" fill="#f4e4b8" stroke="#a8884a" stroke-width="1.6"/><path d="M8 26 Q8 29 5 29 Q4 29 4 27 V25 H8" fill="#e8d098" stroke="#a8884a" stroke-width="1.4"/><path d="M12 11 L14 13.5 L18.5 9 M12 18 H21 M12 22 H19" stroke="#6a4a30" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    gear: '<g fill="#9aa8c0" stroke="#5a6a88" stroke-width="1.5"><rect x="13" y="2" width="6" height="28" rx="2"/><rect x="2" y="13" width="28" height="6" rx="2"/><rect x="13" y="2" width="6" height="28" rx="2" transform="rotate(45 16 16)"/><rect x="13" y="2" width="6" height="28" rx="2" transform="rotate(-45 16 16)"/></g><circle cx="16" cy="16" r="9" fill="#b8c4da" stroke="#5a6a88" stroke-width="1.5"/><circle cx="16" cy="16" r="4" fill="#2a3a5a"/>',
    seal: '<path d="M10 20 L6 30 L12 27 L15 31 L17 21Z M22 20 L26 30 L20 27 L17 31 L15 21Z" fill="#e0483a"/><circle cx="16" cy="14" r="11.5" fill="#e0a82a"/><circle cx="16" cy="14" r="10" fill="#ffcf4a"/><circle cx="16" cy="14" r="7.4" fill="none" stroke="#c4881a" stroke-width="1.5"/><path d="M10.5 17 L9.5 10.5 L13 13 L16 9 L19 13 L22.5 10.5 L21.5 17Z" fill="#c4881a"/><circle cx="16" cy="12.5" r="1.5" fill="#ff6b5b"/>',
    skull: '<path d="M16 3 C8 3 4 9 4 15 C4 19 6 21 9 22 V27 H23 V22 C26 21 28 19 28 15 C28 9 24 3 16 3Z" fill="#f4efe6" stroke="#8a8a98" stroke-width="1.6" stroke-linejoin="round"/><circle cx="11" cy="15" r="3.6" fill="#2a1d16"/><circle cx="21" cy="15" r="3.6" fill="#2a1d16"/><path d="M16 18 L14 22 H18Z" fill="#2a1d16"/><path d="M13 27 V23 M16 27 V24 M19 27 V23" stroke="#8a8a98" stroke-width="1.4"/>',
    flag: '<path d="M7 3 V30" stroke="#8a5a30" stroke-width="3" stroke-linecap="round"/><path d="M7 5 Q14 2 18 5 Q23 8 28 5 V17 Q23 20 18 17 Q14 14 7 17Z" fill="#e0483a" stroke="#a82a20" stroke-width="1.4" stroke-linejoin="round"/><circle cx="7" cy="3" r="2.2" fill="#ffcf4a"/>',
    boss: '<path d="M16 2 L28 9 V23 L16 30 L4 23 V9Z" fill="#6a3ab0" stroke="#3a1a70" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 5 L25 10 V22 L16 27 L7 22 V10Z" fill="none" stroke="#a884e8" stroke-width="1.2"/><path d="M9.5 20 L8.5 11.5 L12.5 15 L16 10 L19.5 15 L23.5 11.5 L22.5 20Z" fill="#ffcf4a" stroke="#a8740b" stroke-width="1.2" stroke-linejoin="round"/><circle cx="16" cy="16" r="1.6" fill="#ff6b5b"/>'
  };

  function icon(name) {
    var b = ICONS[name];
    if (!b) return '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="art-svg icon-svg icon-' + name + '">' + b + '</svg>';
  }

  return { enemy: enemy, boss: boss, island: island, bg: bg, icon: icon, ids: { enemies: Object.keys(E), bosses: Object.keys(B), icons: Object.keys(ICONS) } };
})();
