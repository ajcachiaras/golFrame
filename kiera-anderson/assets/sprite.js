/* Kiera Anderson — garment illustration sprite.
   Every symbol paints with three cascading custom properties so one shape can
   be re-coloured per product / per colourway:
     --gm  main fabric    --ga  accent (bands, cuffs, trims)    --gl  line work
   Injected once per page; <use href="#g-tee"> picks a shape up from anywhere.
   All symbols share a 200x200 box with the garment sitting roughly in 30..170. */
(function () {
  "use strict";

  var STROKE = 'stroke="var(--gl,rgba(36,31,28,.5))" stroke-width="3.2" ' +
               'stroke-linejoin="round" stroke-linecap="round"';

  function sym(id, fill, body) {
    return '<symbol id="' + id + '" viewBox="0 0 200 200">' +
             '<g fill="var(--gm,' + fill + ')" ' + STROKE + '>' + body + '</g>' +
           '</symbol>';
  }

  var ACC = 'fill="var(--ga,#F7EDDF)"';

  /* Bib straps: an outline pass, then a narrower pass in the fabric colour. */
  function straps(fill) {
    var d = "M82 56V40q0-11 10-11M118 56V40q0-11-10-11";
    return '<g fill="none">' +
             '<path d="' + d + '" stroke-width="13"/>' +
             '<path d="' + d + '" stroke="var(--gm,' + fill + ')" stroke-width="7"/>' +
           '</g>';
  }

  /* Long sleeves, mirrored. Used by the sweatshirt, the coat and the jumpsuit. */
  var SLEEVE_L = '<path d="M68 48 32 62q-7 3-5 10l10 42q2 7 9 5l10-3q7-2 5-9L62 58z"/>';
  var SLEEVE_R = '<path d="M132 48l36 14q7 3 5 10l-10 42q-2 7-9 5l-10-3q-7-2-5-9l10-49z"/>';
  var CUFF_L   = '<path ' + ACC + ' d="M36 108l20-6 5 13-20 6z"/>';
  var CUFF_R   = '<path ' + ACC + ' d="M164 108l-20-6-5 13 20 6z"/>';
  var COLLAR   = '<path ' + ACC + ' d="M78 51q22 14 44 0l-4 10q-18 9-36 0z"/>';

  var SPRITE =
    '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"' +
    ' style="position:absolute;width:0;height:0;overflow:hidden" id="ka-sprite">' +

    /* ------------------------------------------------------------ short tee */
    sym("g-tee", "#C56A4C",
      '<path d="M68 48 40 62q-6 3-4 9l8 21q2 6 8 3l10-5"/>' +
      '<path d="M132 48 160 62q6 3 4 9l-8 21q-2 6-8 3l-10-5"/>' +
      '<path d="M68 48q32 15 64 0l8 6 5 98q0 6-6 6H59q-6 0-6-6l7-98z"/>' +
      '<path ' + ACC + ' d="M79 51q21 14 42 0l-4 10q-17 8-34 0z"/>' +
      '<path d="M57 138h86" stroke-opacity=".3" fill="none"/>'
    ) +

    /* --------------------------------------------------- long-sleeve sweatshirt */
    sym("g-sweat", "#7D9A74",
      SLEEVE_L + SLEEVE_R + CUFF_L + CUFF_R +
      '<path d="M68 48q32 14 64 0l6 6 3 96q0 7-7 7H66q-7 0-7-7l3-96z"/>' +
      COLLAR +
      '<path ' + ACC + ' d="M60 140h80l1 10q0 7-7 7H66q-7 0-7-7z"/>'
    ) +

    /* -------------------------------------------------------- hooded raincoat */
    sym("g-coat", "#9BC0D4",
      '<path d="M70 54c0-28 60-28 60 0l-6 6H76z"/>' +
      SLEEVE_L + SLEEVE_R + CUFF_L + CUFF_R +
      '<path d="M68 50h64l7 6 3 100q0 8-8 8H66q-8 0-8-8l3-100z"/>' +
      '<path d="M100 58v106" fill="none" stroke-opacity=".55"/>' +
      '<rect x="66" y="112" width="26" height="22" rx="6" ' + ACC + '/>' +
      '<rect x="108" y="112" width="26" height="22" rx="6" ' + ACC + '/>'
    ) +

    /* -------------------------------------------------------- pinafore dress */
    sym("g-pinafore", "#8C6E8F",
      straps("#8C6E8F") +
      '<rect x="72" y="54" width="56" height="44" rx="8"/>' +
      '<path d="M50 96h100l14 58q2 8-6 8H42q-8 0-6-8z"/>' +
      '<circle cx="84" cy="64" r="4" ' + ACC + '/>' +
      '<circle cx="116" cy="64" r="4" ' + ACC + '/>' +
      '<path d="M44 140h112" stroke-opacity=".3" fill="none"/>'
    ) +

    /* --------------------------------------------------------------- overalls */
    sym("g-overalls", "#7D8FA8",
      straps("#7D8FA8") +
      '<rect x="74" y="54" width="52" height="40" rx="8"/>' +
      '<path d="M54 92h92v58q0 8-8 8h-24q-8 0-8-8v-28h-12v28q0 8-8 8H62q-8 0-8-8z"/>' +
      '<rect x="86" y="64" width="28" height="18" rx="5" ' + ACC + '/>' +
      '<circle cx="80" cy="62" r="4" ' + ACC + '/>' +
      '<circle cx="120" cy="62" r="4" ' + ACC + '/>'
    ) +

    /* --------------------------------------------------------- zip jumpsuit */
    sym("g-jumpsuit", "#7D9A74",
      SLEEVE_L + SLEEVE_R + CUFF_L + CUFF_R +
      '<path d="M68 48q32 14 64 0l6 6 3 92q0 8-8 8h-18q-8 0-8-8l-5-44h-4l-5 44q0 8-8 8H67q-8 0-8-8l3-92z"/>' +
      COLLAR +
      '<path d="M100 60v44" fill="none" stroke-opacity=".55"/>' +
      '<path ' + ACC + ' d="M61 136h30l1 12H61zM109 136h30l1 12h-31z"/>'
    ) +

    /* ------------------------------------------------------------------ shorts */
    sym("g-shorts", "#EFC75E",
      '<path d="M54 70h92l5 56q1 8-7 8h-26q-7 0-8-7l-6-32-6 32q-1 7-8 7H56q-8 0-7-8z"/>' +
      '<path ' + ACC + ' d="M54 64h92v14H54z"/>'
    ) +

    /* ---------------------------------------------------------------- leggings */
    sym("g-leggings", "#5E6F8C",
      '<path d="M64 52h72l-8 112q-1 8-9 8h-10q-7 0-8-7l-7-70-7 70q-1 7-8 7H80q-8 0-9-8z"/>' +
      '<path ' + ACC + ' d="M64 46h72v14H64z"/>' +
      '<path ' + ACC + ' d="M71 158h22l-1 8q-1 6-8 6H80q-8 0-9-8zM129 158h-22l1 8q1 6 8 6h4q8 0 9-8z"/>'
    ) +

    /* ---------------------------------------------------------------- cardigan */
    sym("g-cardigan", "#EFC75E",
      '<path d="M68 48 32 62q-7 3-5 10l10 42q2 7 9 5l10-3q7-2 5-9L62 58z"/>' +
      '<path d="M132 48l36 14q7 3 5 10l-10 42q-2 7-9 5l-10-3q-7-2-5-9l10-49z"/>' +
      CUFF_L + CUFF_R +
      '<path d="M68 48q16 10 29 8v94q0 4-4 4H66q-7 0-7-7l3-93z"/>' +
      '<path d="M132 48q-16 10-29 8v94q0 4 4 4h27q7 0 7-7l-3-93z"/>' +
      '<g ' + ACC + ' stroke-width="2.6">' +
        '<circle cx="104" cy="74" r="4"/><circle cx="104" cy="100" r="4"/><circle cx="104" cy="126" r="4"/>' +
      '</g>'
    ) +

    /* ------------------------------------------------------------------ beanie */
    sym("g-beanie", "#C56A4C",
      '<circle cx="100" cy="44" r="14" ' + ACC + '/>' +
      '<path d="M58 120q0-62 42-62t42 62z"/>' +
      '<path d="M100 60v58M80 64v54M120 64v54" fill="none" stroke-opacity=".3"/>' +
      '<rect x="46" y="116" width="108" height="30" rx="13" ' + ACC + '/>'
    ) +

    /* ------------------------------------------------------------------- socks */
    sym("g-socks", "#9BC0D4",
      '<path d="M54 50h26v62q0 10-8 14l-22 11q-9 5-14-4l-5-9q-5-9 5-14l16-8q2-1 2-4z"/>' +
      '<path d="M146 50h-26v62q0 10 8 14l22 11q9 5 14-4l5-9q5-9-5-14l-16-8q-2-1-2-4z"/>' +
      '<path ' + ACC + ' d="M54 50h26v14H54zM120 50h26v14h-26z"/>' +
      '<path d="M54 76h26M54 90h26M120 76h26M120 90h26" fill="none" stroke-opacity=".32"/>'
    ) +

    '</svg>';

  function inject() {
    if (document.getElementById("ka-sprite")) return;
    var holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    holder.innerHTML = SPRITE;
    document.body.insertBefore(holder, document.body.firstChild);
  }

  if (document.body) inject();
  else document.addEventListener("DOMContentLoaded", inject);

  window.KA_SPRITE_IDS = [
    "g-tee", "g-sweat", "g-coat", "g-pinafore", "g-overalls",
    "g-jumpsuit", "g-shorts", "g-leggings", "g-cardigan", "g-beanie", "g-socks"
  ];
})();
