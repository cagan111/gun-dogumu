/** Sahne A: kodla çizilmiş salon illüstrasyonu (özgün). Lisanslı fotoğraf gelince HeroStage `photoSrc` ile değişir. */
export const SALON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Berber koltuğunda saç kesimi: aynalı bir salon, akşam ışığı">
<style>
.scn-blade{transform-box:fill-box;transform-origin:100% 50%;animation:scn-snip 1.6s ease-in-out infinite}
.scn-blade.b2{animation-name:scn-snip2}
.scn-clip{animation:scn-fall 4.8s ease-in infinite;opacity:0}
.scn-clip.c2{animation-delay:1.6s}.scn-clip.c3{animation-delay:3.2s}
.scn-glow{animation:scn-flick 7s ease-in-out infinite}
@keyframes scn-snip{0%,60%,100%{transform:rotate(0)}70%{transform:rotate(-9deg)}80%{transform:rotate(0)}90%{transform:rotate(-9deg)}}
@keyframes scn-snip2{0%,60%,100%{transform:rotate(0)}70%{transform:rotate(9deg)}80%{transform:rotate(0)}90%{transform:rotate(9deg)}}
@keyframes scn-fall{0%{opacity:0;transform:translate(0,0) rotate(0)}12%{opacity:.9}100%{opacity:0;transform:translate(-18px,150px) rotate(140deg)}}
@keyframes scn-flick{0%,100%{opacity:1}50%{opacity:.86}}
@media (prefers-reduced-motion:reduce){.scn-blade,.scn-clip,.scn-glow{animation:none}.scn-clip{opacity:.0}}
</style>
<defs>
<linearGradient id="scn-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173a40"/><stop offset=".62" stop-color="#0f272b"/><stop offset="1" stop-color="#0a1c1f"/></linearGradient>
<radialGradient id="scn-lamp" cx="400" cy="150" r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#F3C97A" stop-opacity=".55"/><stop offset=".45" stop-color="#E2B15A" stop-opacity=".16"/><stop offset="1" stop-color="#E2B15A" stop-opacity="0"/></radialGradient>
<linearGradient id="scn-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34666c"/><stop offset=".5" stop-color="#1f464c"/><stop offset="1" stop-color="#14333a"/></linearGradient>
<linearGradient id="scn-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4a6b"/><stop offset=".55" stop-color="#d9714b"/><stop offset="1" stop-color="#F3C97A"/></linearGradient>
<linearGradient id="scn-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3D08A"/><stop offset=".5" stop-color="#C8932F"/><stop offset="1" stop-color="#8d6119"/></linearGradient>
<linearGradient id="scn-chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7d8b8e"/><stop offset=".4" stop-color="#e9efef"/><stop offset="1" stop-color="#6b7a7d"/></linearGradient>
<linearGradient id="scn-leather" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a3d27"/><stop offset="1" stop-color="#5e2216"/></linearGradient>
<linearGradient id="scn-cape" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d0583b"/><stop offset="1" stop-color="#a1402a"/></linearGradient>
<pattern id="scn-star" width="72" height="72" patternUnits="userSpaceOnUse"><g fill="none" stroke="#E2B15A" stroke-opacity=".09" stroke-width="1.2"><rect x="22" y="22" width="28" height="28"/><rect x="22" y="22" width="28" height="28" transform="rotate(45 36 36)"/><circle cx="36" cy="36" r="3"/></g></pattern>
<pattern id="scn-floor" width="56" height="56" patternUnits="userSpaceOnUse"><rect width="56" height="56" fill="#e6d6b4"/><path d="M28 0 56 28 28 56 0 28Z" fill="#1F5A60"/><path d="M28 12 44 28 28 44 12 28Z" fill="#e6d6b4"/><circle cx="28" cy="28" r="4" fill="#A8432B"/></pattern>
<clipPath id="scn-mir"><path d="M64 432V246A126 126 0 0 1 316 246V432Z"/></clipPath>
<clipPath id="scn-win"><path d="M478 258V150a56 56 0 0 1 112 0V258Z"/></clipPath>
</defs>
<rect width="640" height="640" fill="url(#scn-wall)"/>
<rect width="640" height="560" fill="url(#scn-star)"/>
<rect y="404" width="640" height="14" fill="#0a1c1f" opacity=".5"/>
<!-- pencere -->
<g>
<path d="M478 258V150a56 56 0 0 1 112 0V258Z" fill="url(#scn-sky)"/>
<g clip-path="url(#scn-win)">
<rect x="470" y="205" width="130" height="60" fill="#2a5560"/>
<path d="M470 205h130" stroke="#F3C97A" stroke-opacity=".6" stroke-width="2"/>
<path d="M486 205v-14h10v-10h8v10h10v14zM540 205c0-14 6-20 14-20s14 6 14 20z" fill="#142c33"/>
<path d="M515 205l12-24 14 24zM512 190v15" fill="#142c33" stroke="#142c33"/>
<path d="M500 222h30M545 232h34M520 242h26" stroke="#F3C97A" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>
<circle cx="540" cy="168" r="13" fill="#F7DDA0" opacity=".9"/>
</g>
<path d="M534 94v164M478 176h112" stroke="#8d6119" stroke-width="3"/>
<path d="M478 258V150a56 56 0 0 1 112 0V258Z" fill="none" stroke="url(#scn-brass)" stroke-width="9"/>
<rect x="470" y="256" width="128" height="9" rx="2" fill="url(#scn-brass)"/>
</g>
<!-- ayna -->
<path d="M64 432V246A126 126 0 0 1 316 246V432Z" fill="url(#scn-glass)"/>
<g clip-path="url(#scn-mir)">
<!-- yansıma: müşteri önden -->
<path d="M120 440c4-44 24-72 70-76 46 4 66 32 70 76z" fill="#8a3623" opacity=".9"/>
<rect x="172" y="330" width="36" height="40" rx="10" fill="#c58a69" opacity=".9"/>
<ellipse cx="190" cy="298" rx="36" ry="43" fill="#d19873" opacity=".95"/>
<path d="M152 292c-2-30 14-48 38-48s42 18 38 48c-6-14-14-22-20-26-18 8-40 6-56 26z" fill="#1a1412"/>
<path d="M155 292c0 8 1 12 3 16M225 292c0 8-1 12-3 16" stroke="#3a2c26" stroke-width="6" stroke-linecap="round" opacity=".9"/>
<path d="M172 303q6 4 12 0M198 303q6 4 12 0" stroke="#3a2418" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<path d="M190 304v12l-5 3" stroke="#b07652" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M181 331q9 5 18 0" stroke="#8a4a38" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<!-- yansıma: berber -->
<path d="M262 440c0-44 8-84 28-100l40 10v90z" fill="#0f2f35" opacity=".85"/>
<circle cx="285" cy="262" r="22" fill="#a97452" opacity=".7"/>
<path d="M264 258c2-20 20-28 34-22 4 6 2 12-2 14-8-2-18 0-32 8z" fill="#1a1412" opacity=".8"/>
<!-- parıltılar -->
<path d="M70 120 180 0 230 0 90 160Z M150 250 330 70 345 100 190 290Z" fill="#fff" opacity=".07"/>
</g>
<path d="M64 432V246A126 126 0 0 1 316 246V432Z" fill="none" stroke="url(#scn-brass)" stroke-width="14"/>
<path d="M72 424V246A118 118 0 0 1 308 246V424Z" fill="none" stroke="#0a1c1f" stroke-opacity=".55" stroke-width="2"/>
<circle cx="190" cy="104" r="6" fill="#F3C97A"/>
<!-- konsol -->
<rect x="38" y="432" width="304" height="16" rx="3" fill="#5b3a28"/>
<rect x="38" y="432" width="304" height="4" fill="#7a5238"/>
<rect x="54" y="402" width="16" height="30" rx="4" fill="#E2B15A" opacity=".9"/><rect x="58" y="396" width="8" height="8" rx="2" fill="#c8932f"/>
<rect x="76" y="412" width="14" height="20" rx="3" fill="#7fb3b3" opacity=".85"/><rect x="79" y="406" width="8" height="7" rx="2" fill="#10262A"/>
<rect x="296" y="408" width="26" height="24" rx="5" fill="#d9e6e4" opacity=".85"/><path d="M302 408v-16M308 408v-18M314 408v-16" stroke="#10262A" stroke-width="3" stroke-linecap="round"/>
<path d="M104 432c0-8 6-12 14-12h36c8 0 14 4 14 12z" fill="#f4ecdd"/><path d="M110 424h56" stroke="#d9c9a8"/>
<!-- sarkıt lamba -->
<g class="scn-glow"><circle cx="400" cy="150" r="300" fill="url(#scn-lamp)"/></g>
<path d="M400 0v96" stroke="#E2B15A" stroke-width="2"/>
<path d="M366 134a34 34 0 0 1 68 0z" fill="url(#scn-brass)"/><rect x="394" y="92" width="12" height="9" fill="#8d6119"/>
<ellipse cx="400" cy="136" rx="34" ry="5" fill="#F3C97A"/>
<!-- zemin -->
<rect y="556" width="640" height="84" fill="url(#scn-floor)"/>
<rect y="556" width="640" height="84" fill="#0a1c1f" opacity=".35"/>
<rect y="552" width="640" height="8" fill="#0a1c1f"/><rect y="552" width="640" height="2" fill="#E2B15A" opacity=".5"/>
<ellipse cx="370" cy="598" rx="130" ry="16" fill="#000" opacity=".35"/>
<!-- berber gövde (arkada) -->
<g>
<path d="M458 440c-2-60 6-120 20-160h44c12 40 16 100 14 160z" fill="#efe3cd"/>
<path d="M470 330h56l14 120-22 6-6 118h-34l-8-124z" fill="#16272b"/>
<path d="M472 300h52l8 150h-62z" fill="#1F5A60"/>
<path d="M472 300 484 278h26l14 22z" fill="#1F5A60"/>
<path d="M484 276c6 14 20 14 26 0" stroke="#E2B15A" stroke-width="2.5" fill="none"/>
<path d="M472 574v-124M524 574v-124" stroke="#10262A" stroke-width="2" opacity=".0"/>
<path d="M472 574h22v8h-26zM508 574h24v8h-28z" fill="#0b171a"/>
<!-- boyun, kafa -->
<rect x="486" y="250" width="22" height="30" rx="8" fill="#a97452"/>
<ellipse cx="490" cy="226" rx="30" ry="36" fill="#bd8461"/>
<path d="M470 224c-4 2-9 8-9 14 6 2 10 0 14-3z" fill="#bd8461"/>
<path d="M464 206c0-24 16-36 34-34 22 2 30 18 24 40-4-16-12-22-22-22-12 0-22 4-36 16z" fill="#1a1412"/>
<path d="M468 214c-6-12 0-26 14-30l10 2c-12 6-18 16-24 28z" fill="#2b211d"/>
<path d="M472 236c6 24 20 36 38 30 6-6 10-14 10-24-8 10-20 14-34 8z" fill="#1a1412"/>
<ellipse cx="518" cy="228" rx="5" ry="9" fill="#a97452"/>
<path d="M471 224q4-3 9-1" stroke="#2b1a12" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<path d="M468 244q6 4 12 2" stroke="#7a3a2a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</g>
<!-- koltuk -->
<g>
<rect x="352" y="500" width="18" height="76" fill="url(#scn-chrome)"/>
<rect x="346" y="528" width="30" height="12" rx="4" fill="url(#scn-chrome)"/>
<path d="M300 592c20-14 100-14 120 0-24 12-96 12-120 0z" fill="url(#scn-chrome)"/>
<path d="M300 592c20-14 100-14 120 0" stroke="#000" stroke-opacity=".25" fill="none"/>
<path d="M278 506 236 546" stroke="url(#scn-chrome)" stroke-width="7" stroke-linecap="round"/>
<rect x="212" y="540" width="58" height="10" rx="4" fill="url(#scn-chrome)" transform="rotate(-8 240 545)"/>
<rect x="274" y="470" width="168" height="38" rx="14" fill="url(#scn-leather)"/>
<rect x="274" y="470" width="168" height="8" rx="4" fill="#fff" opacity=".12"/>
<g transform="rotate(7 424 420)"><rect x="402" y="320" width="44" height="170" rx="16" fill="url(#scn-leather)"/><rect x="396" y="282" width="54" height="52" rx="16" fill="url(#scn-leather)"/><path d="M412 296v26M424 296v26M436 296v26" stroke="#000" stroke-opacity=".18" stroke-width="2"/></g>
<path d="M322 450h96" stroke="url(#scn-chrome)" stroke-width="9" stroke-linecap="round"/>
</g>
<!-- müşteri (profil) -->
<g>
<path d="M392 478 296 470" stroke="#223a40" stroke-width="40" stroke-linecap="round"/>
<path d="M294 470 252 540" stroke="#223a40" stroke-width="32" stroke-linecap="round"/>
<path d="M240 548h40a6 6 0 0 1 0 14h-48a8 8 0 0 1 8-14z" fill="#0b171a"/>
<rect x="340" y="318" width="32" height="40" rx="10" fill="#c58a69"/>
<path d="M342 350c-40 10-52 62-54 124l8 38h134l2-112c-2-28-30-48-56-52z" fill="url(#scn-cape)"/>
<path d="M300 420c22 8 52 8 78-4M296 452c26 8 62 8 90-2M330 360c0 24-10 44-28 56" stroke="#7d2e1c" stroke-opacity=".5" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M346 350c14 14 34 16 50 6" stroke="#f4ecdd" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/>
<path d="M388 286c12 12 14 30 6 44" stroke="none"/>
<ellipse cx="358" cy="292" rx="35" ry="42" fill="#d19873"/>
<path d="M324 288 311 300l12 6z" fill="#d19873"/>
<path d="M336 262c10-26 36-34 56-20 10 8 14 26 8 48-2 12-4 22-10 32-10-6-10-18-6-34-8-14-26-22-48-26z" fill="#1a1412"/>
<path d="M346 268c-8 8-12 20-10 34-6-6-8-18-4-30z" fill="#3a2c26"/>
<path d="M362 300c0 8 2 14 6 18 3-4 4-10 4-16z" fill="#3a2c26" opacity=".8"/>
<ellipse cx="372" cy="298" rx="5" ry="10" fill="#c58a69"/>
<path d="M331 289q5-3 10 0" stroke="#3a2418" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M326 316q6 3 12 0" stroke="#8a4a38" stroke-width="2.2" fill="none" stroke-linecap="round"/>
</g>
<!-- berber kolu + makas (önde) -->
<g>
<path d="M484 288 452 318" stroke="#efe3cd" stroke-width="22" stroke-linecap="round"/>
<path d="M452 318 410 292" stroke="#bd8461" stroke-width="15" stroke-linecap="round"/>
<path d="M446 322 466 304" stroke="#e4d6b8" stroke-width="22" stroke-linecap="round" opacity=".0"/>
<circle cx="402" cy="288" r="10" fill="#bd8461"/>
<g class="scn-blade"><path d="M398 282 346 252" stroke="#e9efef" stroke-width="3.6" stroke-linecap="round"/></g>
<g class="scn-blade b2"><path d="M398 286 354 266" stroke="#aebbbe" stroke-width="3.6" stroke-linecap="round"/></g>
<circle cx="402" cy="276" r="5.5" fill="none" stroke="#C8932F" stroke-width="2.6"/><circle cx="410" cy="296" r="5.5" fill="none" stroke="#C8932F" stroke-width="2.6"/>
<path d="M437 328 424 346" stroke="none"/>
</g>
<!-- kesilen saçlar -->
<g fill="none" stroke="#1a1412" stroke-width="2.4" stroke-linecap="round">
<path class="scn-clip" d="M372 332q4-4 8 0t8 0" transform="translate(0 0)"/>
<path class="scn-clip c2" d="M352 338q4-4 8 0t8 0"/>
<path class="scn-clip c3" d="M386 326q4-4 8 0t8 0"/>
</g>
<!-- vinyet -->
<rect width="640" height="640" fill="none"/>
</svg>
`;
