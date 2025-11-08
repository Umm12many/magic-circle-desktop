// ==UserScript==
// @name         Magic Garden Controller
// @description  Controller
// @version      2.0
// @match        https://magiccircle.gg/r/*
// @match        https://magicgarden.gg/r/*
// @match        https://starweaver.org/r/*
// @grant        none
// ==/UserScript==

/* === Magic Garden Controller (v40) ===
 * - Input lock: D-pad vs Left-stick. No drift double-triggers.
 * - Crops shop: canonical vertical order (UP=prev, DOWN=next); L/R disabled; wrap; **no R-stick scroll**.
 * - Eggs/Tools shop: product↔price hops; R-stick scroll OK.
 *   • Reverted coin-click behavior to previous logic (no forced re-focus after price click).
 * - Inventory:
 *   • Open: focus starts at slot 1 **without equipping** (hotbar selection preserved).
 *   • 2D wrap (row/col). Favorite heart buttons are skipped.
 *   • **LB/RB jump** between **favorited** tiles only (NOT just "can be favorited").
 *     Favorited detection: the tile's heart button has a red heart SVG
 *     (e.g. `.css-x3b2a6` → `svg.css-17xvong`) or `aria-pressed="true"`.
 * - World Box Mode: strict directional moves; if no neighbor in that direction, focus stays put.
 * - Selected pets remain focusable (so you can move onto them and click to unequip).
 * - Pet-first default when entering Box Mode; else random; else top-left.
 * - Hotbar (live-parsed):
 *     • LB/RB step only through occupied slots; empties ignored.
 *     • From no selection, RB → first occupied; LB → last occupied.
 *     • Edges leave (deselect) the hotbar.
 *     • Auto-refreshes as items change in the DOM (e.g., harvesting adds a new slot).
 * - Combos: RT+A = Shift+1, LT+A = Shift+2, RT+LT+A = Shift+3.
 * - Journal overlay (Crops/Pets): movement blocked outside; Box Mode forced; **green outline**; LB/RB toggles tabs.
 * - "Are you sure?" dialog: Box Mode forced; only 2 choices; default = "Go to journal"; B = close; **yellow outline**.
 * - Donuts overlay (.css-1qcme2z): overrides everything; A or B = close (X).
 * - Minor popups (e.g. "...failed!" with .css-49qew8 close): **press L3** to close.
 *   • **Press L3+R3 together** to click the **SystemHeaderPlayerToken** button (opens the profile drawer).
 * - NEW: Profile Drawer (SystemHeaderPlayerToken / #ProfileDrawer):
 *   • Box Mode forced; blocks world input like Pause.
 *   • A = interact (click); B = back/close; auto-focus sensible default.
 * - HUD/buttons explicitly excluded from Box Mode scanning (per your lists).
 */
(() => {
  /* ---------- config ---------- */
  const CONFIG = {
    MOVE_KEYS: {
      up:   { code: 'KeyW', key: 'w', keyCode: 87 },
      down: { code: 'KeyS', key: 's', keyCode: 83 },
      left: { code: 'KeyA', key: 'a', keyCode: 65 },
      right:{ code: 'KeyD', key: 'd', keyCode: 68 },
    },
    A_KEY: { code: 'Space', key: ' ', keyCode: 32 },
    ESC_KEY: { code: 'Escape', key: 'Escape', keyCode: 27 },
    Y_KEY: { code: 'KeyE', key: 'e', keyCode: 69 },

    DEADZONE: 0.35,
    RB_LB_COOLDOWN_MS: 120,
    SLOTS: 9,

    // UI nav & scanning
    UI_STICK_DZ: 0.40,
    UI_STICK_RELEASE_DZ: 0.25,
    UI_INITIAL_DELAY_MS: 260,
    UI_REPEAT_MS: 120,
    UI_SCAN_THROTTLE_MS: 300,
    UI_MIN_SIZE: 10,
    UI_FAV_RADIUS: 800,
    UI_FAV_ROW_FACTOR: 0.65,
    UI_FAV_X_FACTOR: 1.1,

    // Input lock
    UI_LOCK_RELEASE_MS: 140,

    // Shop scrolling (disabled in crops)
    SHOP_SCROLL_STICK_DZ: 0.22,
    SHOP_SCROLL_SPEED_PX_PER_SEC: 2200,
    SHOP_SCROLL_MAXSTEP_PX: 120,

    // World move cone strictness
    WORLD_DIR_DOT_MIN: 0.75,
  };
  const BTN = { A:0,B:1,X:2,Y:3,LB:4,RB:5,LT:6,RT:7,SELECT:8,START:9,LSTICK:10,RSTICK:11,DPAD_UP:12,DPAD_DOWN:13,DPAD_LEFT:14,DPAD_RIGHT:15 };

  console.log('[MagicGardenController] Starting v40 - DEBUG VERSION...');

  // Enhanced debug function - can be called from browser console: window.MagicGardenController.debug()
  const debugShop = () => {
    console.log('=== ENHANCED SHOP DEBUG ===');
    console.log('shopOpen:', shopOpen);
    console.log('isCropsShop():', UI.isCropsShop());
    console.log('shopLastProductIndex:', UI._getShopLastProductIndex());

    const shopRoot = UI.getShopRoot();
    console.log('shopRoot:', shopRoot);

    if (shopRoot) {
      console.log('shopRoot visibility:', getComputedStyle(shopRoot).visibility);

      // Check all types of buttons
      const oldProducts = Array.from(shopRoot.querySelectorAll('.css-1kkwxjt > button'));
      const newProducts = Array.from(shopRoot.querySelectorAll('.css-79z73n > button'));
      const coinButtons = Array.from(shopRoot.querySelectorAll('button.css-122pv6f, button.css-xvykgk'));
      const donutButtons = Array.from(shopRoot.querySelectorAll('button.css-1wzy7ak'));
      const purchaseButtons = Array.from(shopRoot.querySelectorAll('button.css-1m54phk, button.css-625hoc'));

      console.log('Old format products (.css-1kkwxjt > button):', oldProducts.length);
      console.log('New format products (.css-79z73n > button):', newProducts.length);
      console.log('Coin price buttons:', coinButtons.length);
      console.log('Donut price buttons:', donutButtons.length);
      console.log('Purchase dropdown buttons:', purchaseButtons.length);

      if (purchaseButtons.length > 0) {
        console.log('Purchase button details:', purchaseButtons.map(b => ({
          text: b.textContent?.trim().slice(0, 30),
          classes: b.className,
          visible: UI._isVisible(b),
          rect: b.getBoundingClientRect()
        })));
      }
    }

    // Check scan results and current focus
    const candidates = UI.scan(true);
    console.log('Total scan candidates:', candidates.length);

    if (candidates.length > 0) {
      const currentIdx = UI._getCurrentIndex();
      const currentEl = candidates[currentIdx];
      console.log('Current focus index:', currentIdx);
      console.log('Current focused element:', {
        tagName: currentEl?.tagName,
        text: currentEl?.textContent?.trim().slice(0, 30),
        classes: currentEl?.className,
        isProductButton: currentEl ? UI._isShopProductButton(currentEl) : false,
        isPurchaseButton: currentEl ? UI._isShopPurchaseButton(currentEl) : false,
        isCoinPrice: currentEl ? UI._isShopCoinPrice(currentEl) : false,
        isDonutPrice: currentEl ? UI._isShopDonutPrice(currentEl) : false
      });

      console.log('All scan candidates:');
      candidates.forEach((el, i) => {
        console.log(`  [${i}] ${el.tagName} "${el.textContent?.trim().slice(0, 20)}" ${el.className.split(' ').slice(0, 2).join(' ')}`);
      });
    }

    console.log('Box mode:', boxMode());
    console.log('========================');
  };

  // Movement debug function - call this right after trying to move UP
  const debugMovement = () => {
    console.log('=== MOVEMENT DEBUG ===');
    console.log('shopOpen:', shopOpen);
    console.log('boxMode():', boxMode());
    console.log('isCropsShop():', UI.isCropsShop());

    const candidates = UI.scan(true);
    const currentIdx = UI._getCurrentIndex();
    const currentEl = candidates[currentIdx];

    console.log('Current element:', {
      index: currentIdx,
      element: currentEl,
      text: currentEl?.textContent?.trim().slice(0, 30),
      className: currentEl?.className,
      tagName: currentEl?.tagName
    });

    console.log('Element type checks:', {
      isShopProductButton: currentEl ? UI._isShopProductButton(currentEl) : false,
      isShopCoinPrice: currentEl ? UI._isShopCoinPrice(currentEl) : false,
      isShopDonutPrice: currentEl ? UI._isShopDonutPrice(currentEl) : false,
      isShopPurchaseButton: currentEl ? UI._isShopPurchaseButton(currentEl) : false
    });

    console.log('shopLastProductIndex:', UI._getShopLastProductIndex());
    console.log('Total candidates:', candidates.length);
    console.log('========================');
  };

  /* ---------- Key handling ---------- */
  const keyDown=(spec,mods={})=>{
    const ev=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,code:spec.code,key:spec.key,keyCode:spec.keyCode,...mods});
    document.dispatchEvent(ev);
  };
  const keyUp=(spec,mods={})=>{
    const ev=new KeyboardEvent('keyup',{bubbles:true,cancelable:true,code:spec.code,key:spec.key,keyCode:spec.keyCode,...mods});
    document.dispatchEvent(ev);
  };
  const tapKey=(spec,mods={})=>{ keyDown(spec,mods); keyUp(spec,mods); };

  const digitSpec = (n)=>({ code:`Digit${n}`, key:String(n), keyCode:48+n });

  const activeKeys = new Map();
  const setHeld = (spec,on,mods={})=>{
    const k=spec.code, held=activeKeys.has(k);
    if(on && !held){ activeKeys.set(k,{spec,mods}); keyDown(spec,mods); }
    if(!on && held){ activeKeys.delete(k); keyUp(spec,mods); }
  };
  const tapShiftDigit = (n)=>{
    const S={ code:'ShiftLeft', key:'Shift', keyCode:16 }, D=digitSpec(n);
    keyDown(S,{shiftKey:true}); keyDown(D,{shiftKey:true}); keyUp(D,{shiftKey:true}); keyUp(S);
  };

  /* ---------- state ---------- */
  let hotbarSlot=null, lastDir=0;
  let inventoryOpen=false, pauseOpen=false, shopOpen=false;
  let confirmOpen=false; // "Are you sure?" dialog
  let donutsOpen=false;  // "Get Donuts" overlay
  let journalOpen=false; // Journal (Crops / Pets)
  let journalTab='crops';
  let profileOpen=false; // Profile Drawer (SystemHeaderPlayerToken / #ProfileDrawer)

  const minSlot=1, maxSlot=CONFIG.SLOTS;
  const pick=(n)=>{ hotbarSlot=Math.max(minSlot,Math.min(maxSlot,n|0)); lastDir=0; tapKey(digitSpec(hotbarSlot)); };
  const deselectViaRepeat=()=>{ if(hotbarSlot==null) return; tapKey(digitSpec(hotbarSlot)); hotbarSlot=null; lastDir=0; };

  /* ---------- Hotbar tracker (live parsed) ---------- */
  const Hotbar = (() => {
    let dirty=true;
    let model={ ordered:[], occupied:[], btnByN:new Map() };

    const findRoot = () =>
      document.querySelector('.McFlex.css-znjqbv') || document.querySelector('.css-znjqbv') || null;

    const parse = () => {
      const r=findRoot();
      const ordered=[], occupied=[], btnByN=new Map();
      if(r){
        const btns = Array.from(r.querySelectorAll('button.chakra-button'));
        for(const b of btns){
          const numEl = b.querySelector('.chakra-text.css-glp3xv, .css-glp3xv, .css-1tkifdd p');
          const txt = numEl?.textContent?.trim() || '';
          const m = txt.match(/^([1-9])$/);
          if(!m) continue;
          const n = +m[1];

          // Consider occupied if any of: canvas, a label, or a quantity "×" / "x"
          const hasCanvas = !!b.querySelector('canvas');
          const hasName   = !!b.querySelector('.css-1gd1uup p, .css-8xfasz, .css-1cpa69v');
          const hasQty    = /\u00D7|\bx\b/i.test(b.textContent||'');
          const occ = !!(hasCanvas || hasName || hasQty);

          ordered.push(n);
          if(occ) occupied.push(n);
          btnByN.set(n,b);
        }
        ordered.sort((a,b)=>a-b);
        occupied.sort((a,b)=>a-b);
      }
      model = { ordered, occupied, btnByN };
      dirty=false;
      return model;
    };

    const refresh = ()=> dirty ? parse() : model;
    const markDirty = ()=>{ dirty=true; };

    return { refresh, markDirty };
  })();

  /* ---------- inventory & panels ---------- */
  const onInventoryOpened=()=>{
    // Do NOT equip anything; just focus slot 1 for navigation.
    setTimeout(()=>{ UI.scan(true); UI.focusInventorySlot1() || UI.focusTopLeft(); },0);
  };
  const onInventoryClosed=()=>{ UI.clearFocus(); };
  const tapEscape=()=>{ tapKey(CONFIG.ESC_KEY); inventoryOpen=false; onInventoryClosed(); };
  const tapInventoryToggle=()=>{ tapKey(CONFIG.Y_KEY); inventoryOpen=!inventoryOpen; inventoryOpen?onInventoryOpened():onInventoryClosed(); };

  window.addEventListener('keydown',(ev)=>{
    if(!ev.isTrusted) return;
    if(!ev.shiftKey && /^Digit([1-9])$/.test(ev.code||'')){ const n=+ev.code.slice(5); hotbarSlot=(hotbarSlot===n)?null:n; lastDir=0; }
    if(ev.code==='KeyE' && !ev.shiftKey){ if(shopOpen || confirmOpen || donutsOpen || journalOpen || profileOpen) return; inventoryOpen=!inventoryOpen; inventoryOpen?onInventoryOpened():onInventoryClosed(); }
    if(ev.code==='Escape'){ inventoryOpen=false; onInventoryClosed(); }
  },true);

  /* ---------- Box Mode ---------- */
  let boxModeManual=false;
  const boxModeAuto=()=>inventoryOpen||pauseOpen||shopOpen||confirmOpen||donutsOpen||journalOpen||profileOpen;
  const boxMode=()=>boxModeManual||boxModeAuto();

  // Focus ring themes
  if(!document.getElementById('mgc-focus-style')){
    const st=document.createElement('style');
    st.id='mgc-focus-style';
    st.textContent=`
      .mgc-focus-ring{
        outline:3px solid #fff!important;
        outline-offset:2px!important;
        border-radius:10px!important;
        box-shadow:0 0 0 1px rgba(255,255,255,.15), 0 0 8px rgba(255,255,255,.25);
        transition:outline-color .08s linear, box-shadow .12s ease;
      }
      .mgc-focus-ring[data-mgc-danger="1"]{ outline-color:#f33!important; box-shadow:0 0 0 2px rgba(255,51,51,.25), 0 0 10px rgba(255,51,51,.45); }
      .mgc-confirm-on .mgc-focus-ring{
        outline-color:#ffd83b!important;
        box-shadow:0 0 0 2px rgba(255,216,59,.3), 0 0 12px rgba(255,216,59,.6), inset 0 0 0 1px rgba(255,255,255,.1);
      }
      .mgc-journal-on .mgc-focus-ring{
        outline-color:#34d399!important;
        box-shadow:
          0 0 0 2px rgba(52,211,153,.28),
          0 0 14px rgba(16,185,129,.55),
          inset 0 0 0 1px rgba(255,255,255,.12);
        border-radius:12px!important;
      }
    `;
    document.head.appendChild(st);
  }

  // Controller Hints
  let controllerHintsCreated = false;
  function manageControllerHints(show) {
    if (show) {
      if (controllerHintsCreated) {
        document.getElementById('mgc-controller-hints-style').style.display = '';
        document.getElementById('hint-garden').style.display = '';
        document.getElementById('hint-shop').style.display = '';
        document.getElementById('hint-sell').style.display = '';
      } else {
        const hintsStyle = document.createElement('style');
        hintsStyle.id = 'mgc-controller-hints-style';
        hintsStyle.textContent = `
          .controller-hint {
            position: fixed;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 9999;
            pointer-events: none;
          }
          #hint-garden { top: 50px; left: 10px; }
          #hint-shop { top: 90px; left: 10px; }
          #hint-sell { top: 130px; left: 10px; }
        `;
        document.head.appendChild(hintsStyle);

        const hintGarden = document.createElement('div');
        hintGarden.id = 'hint-garden';
        hintGarden.className = 'controller-hint';
        hintGarden.textContent = 'L-Stick Click: My Garden';
        document.body.appendChild(hintGarden);

        const hintShop = document.createElement('div');
        hintShop.id = 'hint-shop';
        hintShop.className = 'controller-hint';
        hintShop.textContent = 'Left Trigger: Shop';
        document.body.appendChild(hintShop);

        const hintSell = document.createElement('div');
        hintSell.id = 'hint-sell';
        hintSell.className = 'controller-hint';
        hintSell.textContent = 'Right Trigger: Sell';
        document.body.appendChild(hintSell);
        controllerHintsCreated = true;
        document.getElementById('mgc-controller-hints-style').style.display = 'none';
        document.getElementById('hint-garden').style.display = 'none';
        document.getElementById('hint-shop').style.display = 'none';
        document.getElementById('hint-sell').style.display = 'none';
      }
    } else {
      if (controllerHintsCreated) {
        document.getElementById('mgc-controller-hints-style').style.display = 'none';
        document.getElementById('hint-garden').style.display = 'none';
        document.getElementById('hint-shop').style.display = 'none';
        document.getElementById('hint-sell').style.display = 'none';
      }
    }
  }
  manageControllerHints(true);

  /* ---------- UI module ---------- */
  const UI = (() => {
    let idx=0, cached=[], lastScan=0;
    const MIN=CONFIG.UI_MIN_SIZE;

    // Crops order
    let cropsOrder=null, shopLastProductIndex=0, shopLastActivatedProductEl=null;

    const setShopActivated=(el)=>{ shopLastActivatedProductEl=el; };
    const resetShopActivated=()=>{ shopLastActivatedProductEl=null; };

    // ===== Visibility & filters =====
    const isElementVisible=(el)=>{ if(!el) return false; const st=getComputedStyle(el); if(st.display==='none'||st.visibility==='hidden') return false; const r=el.getBoundingClientRect(); return r.width>0 && r.height>0; };
    const isVisible=(el)=>{
      if(!el) return false;
      const allowDisabled = el.classList?.contains('css-xvykgk'); // disabled coin price still navigable
      if(el.disabled && !allowDisabled) return false;
      if(el.offsetParent===null && getComputedStyle(el).position!=='fixed') return false;
      const st=getComputedStyle(el);
      if(st.visibility==='hidden'||st.display==='none'||st.pointerEvents==='none') return false;
      const r=el.getBoundingClientRect();
      if(r.width<MIN||r.height<MIN) return false;
      if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth) return false;
      return true;
    };
    const isMeaningful=(el)=>{
      const tn=el.tagName;
      if(tn==='BUTTON') return true;
      if(tn==='A' && el.href && !el.getAttribute('disabled')) return true;
      if(tn==='INPUT'){ const t=(el.type||'').toLowerCase(); if(['button','submit','checkbox','radio','range','file','text','search'].includes(t)) return true; }
      if(tn==='SELECT'||tn==='TEXTAREA') return true;
      const role=el.getAttribute('role'); if(role==='button'||role==='menuitem'||role==='tab') return true;
      if(el.tabIndex>=0) return true;
      if(el.onclick||el.getAttribute('onclick')) return true;
      return false;
    };
    const isFavoriteButton = (el)=>{
      if(!el) return false;
      if(el.matches?.('button[aria-label="Favorite"], button[aria-label*="favorite" i]')) return true;
      if(el.matches?.('button.css-x3b2a6')) return true;
      return false;
    };

    // ===== HUD & explicit exclusions =====
    const isExcludedHUDorHotbar=(el)=>{
      if(!el) return false;
      if(el.closest('.css-znjqbv')) return true; // hotbar strip
      if(el.closest('#BreadWidget') || el.closest('#CreditsWidget')) return true;
      if(el.closest('#SystemHeaderPlayerToken') || el.matches('button.css-1udeyfp')) return true; // header token (we trigger via L3+R3 when needed)
      if(el.matches('button.css-1bg58bq') && (
           el.closest('#BreadWidget') || el.closest('#CreditsWidget') ||
           el.querySelector('img[src*="FlameIcon"]') || /flame/i.test(el.textContent||'')
        )) return true;
      if(el.matches('button.css-m0yhr1, button.css-18qktn2, button.css-15b5mbq')) return true; // Shop / My Garden / Sell
      if(el.matches('button.css-1ciua3z')) return true; // One Time Rewards
      if(el.matches('button.css-10s18g5')) return true; // Party Menu
      if(el.matches('button.css-1mrcbdi')) return true; // Music/SFX
      if(el.matches('button.css-1cqnmk2')) return true; // Leaderboard
      if(el.closest('.McGrid.css-ts5ugc')) return true; // Hunger/STR block
      if(el.closest('.css-t32k3k')) return true;        // info (i)
      if(el.closest('.McFlex.css-1hd05pq')) return true; // Abilities section
      if(el.matches('button.css-i8m1uj')) return true;   // Edit pet name
      // misc
      if(el.closest('.ChatWidgetButton')||/chat widget/i.test(el.getAttribute?.('aria-label')||'')) return true;
      if(el.closest('.css-1py7i4j')) return true;
      if(/friend\s*bonus/i.test((el.textContent||''))) return true;
      const span=el.closest('span.css-1baulvz'); if(span && span.querySelector?.('canvas')) return true;
      if(el.closest('.css-1nkatww')||el.closest('.McFlex.css-502lyi')) return true;
      return false;
    };
    const isExcludedPause=(el)=>{
      if(!el) return false;
      if(el.closest('.McFlex.css-m94fdb')) return true; // title + close area
      if(el.matches('button.css-1nsyepc')) return true; // Show All Games
      if(/show\s+all\s+games/i.test((el.textContent||''))) return true;
      return false;
    };
    const isExcludedShop=(el)=>{
      if(!el) return false;
      if(el.matches('button.css-a7tmji[aria-label="Close"]')||el.closest('button.css-a7tmji[aria-label="Close"]')) return true;
      if(el.closest('.McFlex.css-bvyqr8')) return true; // "Press & Hold / Restock"
      if(el.matches('button.css-91bxar')||el.closest('button.css-91bxar')) return true; // Restock
      return false;
    };

    // ===== Pause & Shop roots =====
    const findPauseCloseBtn = () =>
      document.querySelector('button[data-testid="system-drawer-close-button"]') ||
      document.querySelector('button.chakra-modal__close-btn[aria-label="close"]') ||
      document.querySelector('[role="dialog"] button[aria-label="close"]');
    const getPauseRoot = () => {
      const cb=findPauseCloseBtn();
      const from=cb?.closest?.('[role="dialog"], .chakra-modal__content, .chakra-drawer__content');
      return from || document.querySelector('.chakra-tabs.css-ip74o3') || null;
    };
    const focusPausePartyTabFirst=()=>{
      const root=getPauseRoot(); if(!root) return null;
      let btn = root.querySelector('button.chakra-tabs__tab[data-index="0"]')
             || root.querySelector('button[id*="--tab-0"]')
             || root.querySelector('[role="tab"]');
      return (btn && isVisible(btn) && !isExcludedPause(btn)) ? focusElement(btn) : null;
    };

    // ---- Shop ----
    const findShopCloseBtn = () =>
      document.querySelector('button.css-a7tmji[aria-label="Close"]') ||
      document.querySelector('button[aria-label="Close"].css-a7tmji');
    const getShopRoot = () => {
      const cb=findShopCloseBtn();
      const by=cb?.closest?.('.McGrid.css-1rfy0yd, [role="dialog"], .chakra-modal__content, .chakra-drawer__content');
      return by || document.querySelector('.McGrid.css-1rfy0yd') || document.querySelector('.css-brvep9') || null;
    };

    const _canScrollY = (el)=> {
      const cs=getComputedStyle(el);
      return ['auto','scroll'].includes(cs.overflowY) || el.scrollHeight>el.clientHeight+2;
    };
    const getShopScrollEl = () => {
      const root = getShopRoot(); if(!root) return null;
      const candidates = [
        root.querySelector('.css-brvep9'),
        root.querySelector('.css-5vhhlj'),
        root.querySelector('.css-1rfy0yd'),
        root
      ].filter(Boolean);
      return candidates.find(_canScrollY) || null;
    };
    const scrollShopBy = (dyPx)=>{
      const el=getShopScrollEl(); if(!el) return;
      const next = el.scrollTop + dyPx;
      el.scrollTop = Math.max(0, Math.min(next, el.scrollHeight - el.clientHeight));
    };

    const isCropsShop = () => {
      const root=getShopRoot(); if(!root) return false;
      // Only check for actual price buttons, not purchase dropdown buttons
      const hasPrice = root.querySelector('button.css-122pv6f, button.css-xvykgk, button.css-1wzy7ak');
      return !hasPrice;
    };

    const isShopProductButton = (el)=> {
      if (el?.tagName !== 'BUTTON') return false;
      // Check for container-based product buttons (old format)
      if (el.closest?.('.css-1kkwxjt') || el.closest?.('.css-79z73n')) return true;
      // Check for direct product button classes (new format)
      if (el.classList.contains('css-1m54phk') || el.classList.contains('css-625hoc')) return true;
      return false;
    };
    const isShopCoinPrice = (el)=> el?.tagName==='BUTTON' && (el.classList.contains('css-122pv6f') || el.classList.contains('css-xvykgk'));
    const isShopDonutPrice = (el)=> el?.tagName==='BUTTON' && el.classList.contains('css-1wzy7ak');
    const isShopPurchaseButton = (el)=> {
      if (el?.tagName !== 'BUTTON') return false;

      // Check for purchase button classes
      if (el.classList.contains('css-1q48fm4')) return true;

      // Check for text-based detection
      const text = el.textContent || '';
      return /buy\s+with\s+donuts|learn\s+more|^buy$|^purchase/i.test(text.trim());
    };


    const _sortedProductsTopToBottom = () => {
      const root=getShopRoot(); if(!root) return [];
      const list = Array.from(root.querySelectorAll('.css-1kkwxjt > button, .css-79z73n > button'))
        .filter(el=>!isExcludedShop(el));
      list.sort((a,b)=>{ const ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect(); return (Math.abs(ra.top-rb.top)>1)?(ra.top-rb.top):(ra.left-rb.left); });
      return list;
    };
    const buildCropsOrder = () => { const arr=_sortedProductsTopToBottom(); cropsOrder=arr.filter(el=>el.isConnected); shopLastProductIndex=0; };
    const clearCropsOrder = () => { cropsOrder=null; };
    const getShopProducts = () => {
      if(cropsOrder && isCropsShop()){
        const arr = cropsOrder.filter(el=>el.isConnected);
        return arr.length ? arr : _sortedProductsTopToBottom();
      }
      return _sortedProductsTopToBottom();
    };

    const findCoinPriceForProduct = (productBtn) => {
      if(!productBtn) return null;
      const wrap = productBtn.closest('.css-1kkwxjt') || productBtn.closest('.css-79z73n') || getShopRoot();
      if(!wrap) return null;
      const local = Array.from(wrap.querySelectorAll('button.css-122pv6f, button.css-xvykgk')).filter(isVisible);
      return local[0] || null;
    };
    const findDonutPriceForProduct = (productBtn) => {
      if(!productBtn) return null;
      const wrap = productBtn.closest('.css-1kkwxjt') || productBtn.closest('.css-79z73n') || getShopRoot();
      if(!wrap) return null;
      const el = Array.from(wrap.querySelectorAll('button.css-1wzy7ak')).find(isVisible);
      return el || null;
    };
    const findCoinPriceNear = (priceBtn) => {
      const wrap = priceBtn?.closest?.('.css-1kkwxjt') || priceBtn?.closest?.('.css-79z73n') || getShopRoot();
      if(!wrap) return null;
      const local = Array.from(wrap.querySelectorAll('button.css-122pv6f, button.css-xvykgk')).filter(isVisible);
      return local[0] || null;
    };
    const findDonutPriceNear = (priceBtn) => {
      const wrap = priceBtn?.closest?.('.css-1kkwxjt') || priceBtn?.closest?.('.css-79z73n') || getShopRoot();
      if(!wrap) return null;
      const el = Array.from(wrap.querySelectorAll('button.css-1wzy7ak')).find(isVisible);
      return el || null;
    };

    const focusShopProductIndex=(i)=>{
      const arr=getShopProducts(); if(!arr.length) return null;
      const c=((i%arr.length)+arr.length)%arr.length;
      shopLastProductIndex=c;
      return focusElement(arr[c]);
    };

    const focusShopDefault=()=>{
      const root=getShopRoot(); if(!root) return null;
      let btn = Array.from(root.querySelectorAll('.css-1kkwxjt > button, .css-79z73n > button'))
                .find(b=>/carrot\s*seed/i.test(b.textContent||'')) ||
                Array.from(root.querySelectorAll('.css-1kkwxjt > button, .css-79z73n > button'))
                .find(b=>/watering\s*can/i.test(b.textContent||'')) ||
                Array.from(root.querySelectorAll('.css-1kkwxjt > button, .css-79z73n > button'))
                .find(b=>/common\s+egg/i.test(b.textContent||'')) ||
                getShopProducts()[0];
      return (btn && isVisible(btn) && !isExcludedShop(btn)) ? focusElement(btn) : null;
    };

    // ===== Inventory helpers =====
    const getSlotNumber=(btn)=>{
      const p=btn.querySelector('.css-1tkifdd p, .css-glp3xv, p');
      if(p){ const m=(p.textContent||'').trim().match(/^(\d{1,3})$/); if(m) return +m[1]; }
      const t=(btn.textContent||'').trim(); const m2=t.match(/^(\d{1,3})\s/); if(m2) return +m2[1];
      return null;
    };
    const looksLikeInventoryTile=(btn)=>{
      if(!isVisible(btn)) return false;
      if(btn.tagName!=='BUTTON') return false;
      if(isFavoriteButton(btn)) return false; // skip hearts (use X to favorite)
      if(isExcludedHUDorHotbar(btn)) return false;
      if(btn.closest('.css-znjqbv')) return false; // hotbar
      const hasNum=getSlotNumber(btn)!==null;
      const hasCanvas=!!btn.querySelector('canvas');
      const hasTitle=!!btn.querySelector('.css-1gd1uup p, .css-8xfasz, .css-1cpa69v, p');
      const hasQty=/\u00D7|\bx\b/i.test(btn.textContent||'');
      const inWrap=!!btn.closest('.css-79elbk');
      return (hasNum&&(hasCanvas||hasTitle||hasQty))||inWrap;
    };
    const findInventorySlotButtons=()=>{
      const raw=Array.from(document.querySelectorAll('button.chakra-button'));
      const slots=raw.filter(looksLikeInventoryTile);
      slots.sort((a,b)=>{ const ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect(); return (Math.abs(ra.top-rb.top)>1)?(ra.top-rb.top):(ra.left-rb.left); });
      return slots;
    };
    const getTileWrapper = (tile)=> tile.closest('.css-79elbk') || tile.parentElement;
    const tileHasHeartBtn = (tile)=>{
      const wrap=getTileWrapper(tile);
      if(!wrap) return null;
      const heart = wrap.querySelector('button.css-x3b2a6[aria-label="Favorite"], button[aria-label="Favorite"].css-x3b2a6');
      return heart || null;
    };
    const isTileFavorited = (tile)=>{
      const heart = tileHasHeartBtn(tile);
      if(!heart) return false; // tiles without hearts are not "favoritable" → not favorite
      const svg = heart.querySelector('svg');
      if(svg && svg.classList.contains('css-17xvong')) return true; // red heart
      if(heart.getAttribute('aria-pressed')==='true') return true;
      if(heart.classList.contains('is-favorited') || heart.getAttribute('data-state')==='on') return true;
      return false;
    };
    const jumpInventoryFavorite = (dir)=>{
      const list = findInventorySlotButtons();
      if(!list.length) return null;

      // Current focus element from our cached scan
      const curList = scan(true);
      const current = (curList[idx] && list.includes(curList[idx])) ? curList[idx] : list[0];
      const curI = list.indexOf(current);

      if(dir>0){
        for(let i=curI+1;i<list.length;i++){
          if(isTileFavorited(list[i])) return focusElement(list[i]);
        }
        return null;
      } else {
        for(let i=curI-1;i>=0;i--){
          if(isTileFavorited(list[i])) return focusElement(list[i]);
        }
        return null;
      }
    };

    // ===== Confirmation dialog =====
    const getConfirmRoot = ()=>{
      const nodes = Array.from(document.querySelectorAll('section[role="alertdialog"].chakra-modal__content, [role="alertdialog"].chakra-modal__content'));
      return nodes.find(n=>getComputedStyle(n).visibility!=='hidden' && getComputedStyle(n).display!=='none') || null;
    };
    const findConfirmGoBtn = (root)=> root?.querySelector('footer .chakra-button.css-nbsbxg') || Array.from(root?.querySelectorAll('button')||[]).find(b=>/go\s+to\s+journal/i.test(b.textContent||'')) || null;
    const findConfirmSellBtn = (root)=> root?.querySelector('footer .chakra-button.css-e73354[data-testid="confirmation-dialog-ok-button"]') || Array.from(root?.querySelectorAll('button')||[]).find(b=>/sell\s+all/i.test(b.textContent||'')) || null;
    const findConfirmCloseBtn = (root)=> root?.querySelector('button.chakra-modal__close-btn, button[aria-label="Close"]') || null;
    const queryConfirmCandidates = ()=>{
      const r=getConfirmRoot();
      if(!r) return [];
      const a=findConfirmGoBtn(r), b=findConfirmSellBtn(r);
      const list = [a,b].filter(Boolean);
      return list.filter(isVisible);
    };

    // ===== Donuts overlay =====
    const getDonutsRoot = ()=> {
      const el = document.querySelector('.css-1qcme2z');
      if(!el) return null;
      const cs = getComputedStyle(el);
      if(cs.display==='none' || cs.visibility==='hidden' || el.offsetParent===null) return null;
      return el;
    };
    const findDonutsCloseBtn = (root)=> root?.querySelector('button.chakra-modal__close-btn.css-9zzz8e, button.chakra-modal__close-btn[aria-label="Close"]');
    const queryDonutsCandidates = ()=>{
      const r=getDonutsRoot();
      if(!r) return [];
      const x=findDonutsCloseBtn(r);
      return x && isVisible(x) ? [x] : [];
    };


    // ===== Journal overlay =====
    const findJournalBackBtn = ()=> document.querySelector('button.chakra-button.css-111ixsx[aria-label="Back"]');
    const findJournalAnyCard = ()=> document.querySelector('.McGrid.css-1q9lgzs');
    const getJournalRoot = ()=>{
      const back=findJournalBackBtn();
      if(back) return back.closest('.chakra-modal__content, .chakra-drawer__content, .css-1qcme2z, body');
      const card=findJournalAnyCard();
      if(card) return card.closest('.chakra-modal__content, .chakra-drawer__content, .css-1qcme2z, body');
      return null;
    };
    const findJournalCards = ()=>{
      const r=getJournalRoot();
      if(!r) return [];
      const cards = Array.from(r.querySelectorAll('.McGrid.css-1q9lgzs'));
      const out = cards.filter(isVisible);
      out.sort((a,b)=>{ const ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect(); return (Math.abs(ra.top-rb.top)>1)?(ra.top-rb.top):(ra.left-rb.left); });
      return out;
    };
    const queryJournalCandidates = ()=>{
      const r=getJournalRoot();
      if(!r) return [];
      const list=[];
      const back=findJournalBackBtn();
      if(back && isVisible(back)) list.push(back);
      list.push(...findJournalCards());
      return list;
    };
    const focusJournalDefault = ()=>{
      const cards=findJournalCards();
      if(cards.length) return focusElement(cards[0]);
      const back=findJournalBackBtn();
      if(back && isVisible(back)) return focusElement(back);
      return null;
    };
    const journalGoTo = (which)=>{ // 'crops' | 'pets'
      const text = which==='pets' ? 'Pets' : 'Crops';
      const cand = Array.from(document.querySelectorAll('.McFlex p, .chakra-text')).find(p=>/pets|crops/i.test(p.textContent||'') && new RegExp(`^\\s*${text}\\s*$`,'i').test(p.textContent||''));
      const clickable = cand?.closest('button,[role="tab"],.chakra-tabs__tab') || cand;
      if(clickable && isElementVisible(clickable)){ clickable.click(); setTimeout(()=>{ scan(true); focusJournalDefault(); }, 50); }
    };
    const journalToggle = ()=>{
      journalTab = (journalTab==='crops')?'pets':'crops';
      journalGoTo(journalTab);
    };

    // ===== Profile Drawer (SystemHeaderPlayerToken / #ProfileDrawer) =====
    const findProfileCloseBtn = () =>
      document.querySelector('button.chakra-button.css-nszvqr[aria-label="close"]') ||
      document.querySelector('[role="dialog"] button[aria-label="close"]');
    const getProfileRoot = () => {
      const drawer = document.getElementById('ProfileDrawer');
      if (drawer) return drawer.closest('.chakra-modal__content, .chakra-drawer__content, .css-s62r1y') || drawer;
      const cb = findProfileCloseBtn();
      return cb?.closest('.chakra-modal__content, .chakra-drawer__content, .css-s62r1y') || null;
    };
    const queryProfileCandidates = () => {
      const root = getProfileRoot(); if(!root) return [];
      const q = ['button','[role="tab"]','[role="button"]','select','input','a[href]'].join(',');
      return Array.from(root.querySelectorAll(q)).filter(isVisible).filter(isMeaningful);
    };
    const focusProfileDefault = () => {
      const root = getProfileRoot(); if(!root) return null;
      // Try Save → first tab → first cosmetic → close
      let btn = root.querySelector('button[aria-label="save"]')
             || root.querySelector('[role="tab"][data-index="0"], [role="tab"]')
             || root.querySelector('button[data-testid^="cosmetic-button-"], button.css-jwk3q1')
             || findProfileCloseBtn();
      return (btn && isVisible(btn)) ? focusElement(btn) : null;
    };
    const clickProfileClose = () => {
      const x = findProfileCloseBtn();
      if (x && isElementVisible(x)) { x.click(); return true; }
      return false;
    };
    const clickHeaderTokenButton = () => {
      const token = document.querySelector('#SystemHeaderPlayerToken');
      const btn = token?.closest('button') || document.querySelector('button.css-1udeyfp');
      if(btn && isElementVisible(btn)) { btn.click(); return true; }
      return false;
    };

    // ===== World scan (generic) =====
    const queryWorldCandidates=()=>{
      const q=['button:not([disabled])','a[href]:not([aria-disabled="true"])','input:not([disabled])','select:not([disabled])','textarea:not([disabled])','[role="button"]','[role="menuitem"]','[tabindex]:not([tabindex="-1"])','[onclick]','[contenteditable="true"]'].join(',');
      return Array.from(document.querySelectorAll(q)).filter(isVisible).filter(isMeaningful).filter(el=>!isFavoriteButton(el)).filter(el=>!isExcludedHUDorHotbar(el));
    };

    const queryPauseCandidates=()=>{
      const root=getPauseRoot(); if(!root) return [];
      const q=['button','[role="tab"]','[role="button"]','select','input','a[href]'].join(',');
      return Array.from(root.querySelectorAll(q)).filter(isVisible).filter(isMeaningful).filter(el=>!isExcludedPause(el));
    };
    const queryShopCandidates=()=>{
      const root=getShopRoot(); if(!root) return [];
      const q=[
        '.css-1kkwxjt > button',            // product buttons (eggs/tools/crops) - old format
        '.css-79z73n > button',             // product buttons (new format)
        'button.css-122pv6f',               // coin price (green)
        'button.css-xvykgk',               // coin price (disabled gray)
        'button.css-1wzy7ak',               // donut price (purple)
        'button.css-1q48fm4',                // purchase dropdown buttons ("Buy with donuts")
        'button.css-1m54phk',                // buy buttons (normal stock)
        'button.css-625hoc'                  // buy buttons (no stock)
      ].join(',');
      const set=Array.from(root.querySelectorAll(q)).filter(isMeaningful).filter(el=>!isExcludedShop(el));
      const seen=new Set(), out=[]; for(const el of set){ if(!seen.has(el)){ seen.add(el); out.push(el); } }
      return out;
    };

    // scanning & focus
    const center=(el)=>{ const r=el.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2, r }; };
    const scan=(force=false)=>{
      const now=performance.now();
      if(!force && (now-lastScan)<CONFIG.UI_SCAN_THROTTLE_MS && cached.length) return cached;

      if(donutsOpen)          cached = queryDonutsCandidates(); // highest priority
      else if(confirmOpen)    cached = queryConfirmCandidates();
      else if(journalOpen)    cached = queryJournalCandidates();
      else if(profileOpen)    cached = queryProfileCandidates();
      else if(pauseOpen)      cached = queryPauseCandidates();
      else if(shopOpen)       cached = queryShopCandidates();
      else if(inventoryOpen)  cached = findInventorySlotButtons();
      else                    cached = queryWorldCandidates();

      lastScan=now; if(idx>=cached.length) idx=Math.max(0,cached.length-1);
      return cached;
    };
    const clearFocus=()=>cached.forEach(el=>el.classList?.remove('mgc-focus-ring'));
    const focusElement=(el)=>{
      const list=scan(true), i=list.indexOf(el);
      if(i<0) return null;
      idx=i; clearFocus(); el.classList.add('mgc-focus-ring');
      el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});
      if(shopOpen && isShopProductButton(el)){
        const arr=_sortedProductsTopToBottom(); const at=arr.indexOf(el); if(at>=0) shopLastProductIndex=at;
      }
      return el;
    };
    const focusIndex=(i)=>{
      const list=scan(true); if(!list.length) return null;
      idx=((i%list.length)+list.length)%list.length; clearFocus();
      const el=list[idx]; el.classList.add('mgc-focus-ring');
      el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});
      if(shopOpen && isShopProductButton(el)){
        const arr=_sortedProductsTopToBottom(); const at=arr.indexOf(el); if(at>=0) shopLastProductIndex=at;
      }
      return el;
    };
    const focusTopLeft=()=>{
      const list=scan(true); if(!list.length) return null;
      let bestI=0,bx=Infinity,by=Infinity;
      list.forEach((el,i)=>{ const {r}=center(el); if(r.top<by-1 || (Math.abs(r.top-by)<=1 && r.left<bx)){ by=r.top; bx=r.left; bestI=i; } });
      return focusIndex(bestI);
    };
    const focusInventorySlot1=()=>{
      const list=scan(true); if(!list.length) return null;
      let i1=-1; for(let i=0;i<list.length;i++){ const n=getSlotNumber(list[i]); if(n===1){ i1=i; break; } }
      return (i1>=0) ? focusIndex(i1) : null;
    };

    // World Box Mode: strict cone; if no candidate that way, don't move
    const moveBy=(dx,dy)=>{
      const list=scan(); if(!list.length) return null;
      const cur=list[idx]||list[0]; const c0=center(cur);
      const dirN=Math.hypot(dx,dy)||1, dir={x:dx/dirN,y:dy/dirN};
      let best=null, bestScore=Infinity;
      for(let i=0;i<list.length;i++){
        if(i===idx) continue; const el=list[i]; const c=center(el);
        const vx=c.x-c0.x, vy=c.y-c0.y, dist=Math.hypot(vx,vy); if(dist<1) continue;
        const dot=(vx/dist)*dir.x + (vy/dist)*dir.y;
        if(dot < CONFIG.WORLD_DIR_DOT_MIN) continue;
        const score=(1+(1-dot)*3)*dist; if(score<bestScore){ bestScore=score; best=i; }
      }
      return (best==null)?null:focusIndex(best);
    };

    // Inventory movement (wrap)
    const moveInventory=(dx,dy)=>{
      const items = findInventorySlotButtons();
      if(!items.length) return null;

      const rows=[]; const ROW_TOL=18;
      for(const el of items){
        const r=el.getBoundingClientRect();
        let row=rows.find(row=>Math.abs(row.y - r.top)<=ROW_TOL);
        if(!row){ row={ y:r.top, cells:[] }; rows.push(row); }
        row.cells.push({ el, x:r.left, y:r.top });
      }
      rows.sort((a,b)=>a.y-b.y);
      rows.forEach(row=>row.cells.sort((a,b)=>a.x-b.x));

      const map=new Map();
      rows.forEach((row,ri)=>row.cells.forEach((cell,ci)=>map.set(cell.el, {ri,ci})));

      const list=scan(true);
      const cur=list[idx] || items[0];
      const pos=map.get(cur) || {ri:0,ci:0};

      let {ri,ci}=pos;

      if(Math.abs(dy)>Math.abs(dx)){
        if(dy>0){ ri = (ri+1) % rows.length; }
        else if(dy<0){ ri = (ri-1+rows.length) % rows.length; }
        const targetRow = rows[ri];
        const curX = cur.getBoundingClientRect().left;
        let bestI=0, bestDx=Infinity;
        targetRow.cells.forEach((c,i)=>{ const dx=Math.abs(c.x-curX); if(dx<bestDx){ bestDx=dx; bestI=i; } });
        ci = bestI;
      } else if(dx!==0){
        const row = rows[ri];
        if(dx>0){ ci = (ci+1) % row.cells.length; }
        else { ci = (ci-1+row.cells.length) % row.cells.length; }
      } else {
        return null;
      }

      const target = rows[ri].cells[ci].el;
      return focusElement(target);
    };

    const moveShop=(dx,dy)=>{
      const cur=scan()[idx];
      const crops = isCropsShop();

      if(crops){
        if(dy>0.5)  return focusShopProductIndex(shopLastProductIndex+1);
        if(dy<-0.5) return focusShopProductIndex(shopLastProductIndex-1);
        return null; // L/R disabled in crops
      }

      // --- Reverted eggs/tools behavior (pre-fix):
      if(dy>0.5){
        if(isShopProductButton(cur)){
          const activatedForThis = shopLastActivatedProductEl && shopLastActivatedProductEl.isConnected && shopLastActivatedProductEl===cur;
          const coinForThis = activatedForThis ? findCoinPriceForProduct(cur) : null;
          if(activatedForThis && coinForThis){
            return focusElement(coinForThis);
          }
          return focusShopProductIndex(shopLastProductIndex+1);
        } else if(isShopCoinPrice(cur)) {
          return focusShopProductIndex(shopLastProductIndex+1);
        }
      }

      if(dy<-0.5){
        console.log('MOVESHOP UP DEBUG:', {
          currentElement: cur?.textContent?.slice(0,40),
          currentClass: cur?.className,
          isCoinPrice: isShopCoinPrice(cur),
          isDonutPrice: isShopDonutPrice(cur),
          isProductButton: isShopProductButton(cur),
          isPurchaseButton: isShopPurchaseButton(cur),
          shopLastProductIndex: shopLastProductIndex,
          shopLastActivatedProductEl: shopLastActivatedProductEl?.textContent?.slice(0,30)
        });

        if(isShopCoinPrice(cur) || isShopDonutPrice(cur)){
          console.log('UP from coin/donut price -> focusShopProductIndex(' + (shopLastProductIndex-1) + ') to escape dropdown');
          return focusShopProductIndex(shopLastProductIndex-1);
        } else if(isShopProductButton(cur)){
          console.log('UP from product button -> focusShopProductIndex(' + (shopLastProductIndex-1) + ')');
          return focusShopProductIndex(shopLastProductIndex-1);
        } else if(isShopPurchaseButton(cur)){
          console.log('UP from purchase button -> focusShopProductIndex(' + shopLastProductIndex + ')');
          // When on a purchase button (Buy/Buy with donuts), go back to the product that opened this dropdown
          return focusShopProductIndex(shopLastProductIndex);
        }
        console.log('UP: No specific handling, using moveBy');
      }

      if(dx>0.5){
        if(isShopCoinPrice(cur)){
          const donut = findDonutPriceNear(cur) || (shopLastActivatedProductEl && findDonutPriceForProduct(shopLastActivatedProductEl));
          if(donut) return focusElement(donut);
        }
      }

      if(dx<-0.5){
        if(isShopDonutPrice(cur)){
          const coin = findCoinPriceNear(cur) || (shopLastActivatedProductEl && findCoinPriceForProduct(shopLastActivatedProductEl));
          if(coin) return focusElement(coin);
        }
      }

      return moveBy(dx,dy);
    };

    const click=()=>{
      const el=scan()[idx]; if(!el) return;
      const label=(el.getAttribute('aria-label')||el.textContent||'').toLowerCase();
      const dangerous=/\b(delete|remove|trash|drop|sell|discard|quit|logout|reset|sign out|delete account)\b/.test(label);
      el.toggleAttribute && el.setAttribute('data-mgc-danger', dangerous?'1':'0');
      el.classList.add('mgc-focus-ring');

      // Reverted: no forced re-focus after clicking coin/donut
      if(shopOpen && isShopProductButton(el)) setShopActivated(el);

      el.click();
    };

    const clickFavoriteForFocused=()=>{
      const hearts=Array.from(document.querySelectorAll('button[aria-label="Favorite"], button[aria-label*="favorite" i], .css-x3b2a6')).filter(isVisible);
      if(!hearts.length) return false;
      const cur=scan()[idx]; const baseRect=cur?.getBoundingClientRect(); if(!baseRect) return false;
      const base={ x:baseRect.left+baseRect.width/2, y:baseRect.top+baseRect.height/2 };
      const rowTol=baseRect.height*CONFIG.UI_FAV_ROW_FACTOR, maxX=Math.max(baseRect.width*CONFIG.UI_FAV_X_FACTOR,240);
      const row=hearts.filter(h=>{ const r=h.getBoundingClientRect(); const cy=r.top+r.height/2; return Math.abs(cy-base.y)<=rowTol; });
      let target=null;
      if(row.length){
        let best=null, bestDx=Infinity;
        row.forEach(h=>{ const r=h.getBoundingClientRect(); const cx=r.left+r.width/2; const dx=Math.abs(cx-base.x); if(dx<bestDx){ bestDx=dx; best=h; } });
        if(best && bestDx<=maxX) target=best;
      }
      if(!target){
        let best=null, bestD=Infinity;
        hearts.forEach(h=>{ const r=h.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2; const d=Math.hypot(cx-base.x,cy-base.y); if(d<bestD){ bestD=d; best=h; } });
        if(best && bestD<=CONFIG.UI_FAV_RADIUS) target=best;
      }
      if(!target) return false;
      target.click(); return true;
    };

    const clickPartyMenu=()=>{
      const btn=document.querySelector('button[aria-label="Party Menu"]')||document.querySelector('button.chakra-button.css-10s18g5[aria-label="Party Menu"]')||document.querySelector('button[aria-label*="Party Menu" i]');
      if(btn && isElementVisible(btn)){ btn.click(); return true; } return false;
    };
    const clickPauseClose=()=>{ const btn=findPauseCloseBtn(); if(btn && isElementVisible(btn)){ btn.click(); return true; } return false; };
    const clickShopClose=()=>{ const btn=findShopCloseBtn(); if(btn && isElementVisible(btn)){ btn.click(); return true; } return false; };

    // Confirmation dialog helpers
    const focusConfirmDefault = ()=>{
      const r=getConfirmRoot(); if(!r) return null;
      const go=findConfirmGoBtn(r);
      return (go && isVisible(go)) ? focusElement(go) : null;
    };
    const clickConfirmClose = ()=>{
      const r=getConfirmRoot(); if(!r) return false;
      const x=findConfirmCloseBtn(r);
      if(x && isElementVisible(x)){ x.click(); return true; }
      return false;
    };

    // Donuts overlay helpers
    const focusDonutsDefault = ()=>{
      const r=getDonutsRoot(); if(!r) return null;
      const x=findDonutsCloseBtn(r);
      return (x && isVisible(x)) ? focusElement(x) : null;
    };
    const clickDonutsClose = ()=>{
      const r=getDonutsRoot(); if(!r) return false;
      const x=findDonutsCloseBtn(r);
      if(x && isElementVisible(x)){ x.click(); return true; }
      return false;
    };

    // Pets (for initial Box Mode focus)
    const findPetButtons = () => {
      const candidates = Array.from(
        document.querySelectorAll('button.chakra-button.css-16uonwq, button.chakra-button.css-566vi0')
      );
      return candidates.filter(isVisible);
    };
    const focusTopMostPet = () => {
      const pets = findPetButtons();
      if (!pets.length) return null;
      pets.sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return (Math.abs(ra.top - rb.top) > 1) ? (ra.top - rb.top) : (ra.left - rb.left);
      });
      return focusElement(pets[0]);
    };
    const focusRandomCandidate = () => {
      const list = scan(true);
      if (!list.length) return null;
      const i = Math.floor(Math.random() * list.length);
      return focusIndex(i);
    };

    return {
      scan, clearFocus, focusTopLeft, focusIndex, focusElement,
      focusInventorySlot1, moveBy, moveShop, click, moveInventory,
      fav: clickFavoriteForFocused,
      jumpInventoryFavorite,
      clickPartyMenu, clickPauseClose, focusPausePartyTabFirst,
      getShopRoot, focusShopDefault, clickShopClose,
      getShopProducts,
      _resetShopActivated: resetShopActivated,
      _setShopActivated: setShopActivated,
      _isShopProductButton: isShopProductButton,
      scrollShopBy,
      isCropsShop,
      buildCropsOrder, clearCropsOrder,
      focusTopMostPet, focusRandomCandidate,
      // confirm
      _getConfirmRoot: getConfirmRoot,
      _focusConfirmDefault: focusConfirmDefault,
      _clickConfirmClose: clickConfirmClose,
      // donuts
      _getDonutsRoot: getDonutsRoot,
      _focusDonutsDefault: focusDonutsDefault,
      _clickDonutsClose: clickDonutsClose,
      // minor popup
      _findMinorPopupCloseBtns: ()=> Array.from(document.querySelectorAll('button.css-49qew8[aria-label="Close"], button.css-49qew8')).filter(isVisible),
      // journal
      _getJournalRoot: getJournalRoot,
      _focusJournalDefault: focusJournalDefault,
      _journalToggle: journalToggle,
      _findJournalBackBtn: findJournalBackBtn,
      // profile
      _getProfileRoot: getProfileRoot,
      _queryProfileCandidates: queryProfileCandidates,
      _focusProfileDefault: focusProfileDefault,
      _clickProfileClose: clickProfileClose,
      _clickHeaderTokenButton: clickHeaderTokenButton,
      // debug helpers
      _getCurrentIndex: ()=> idx,
      _getShopLastProductIndex: ()=> shopLastProductIndex,
      _isShopPurchaseButton: isShopPurchaseButton,
      _isShopCoinPrice: isShopCoinPrice,
      _isShopDonutPrice: isShopDonutPrice,
      _isVisible: isVisible,
    };
  })();

  /* ---------- MutationObserver: detect panels & mark hotbar dirty ---------- */
  const mo=new MutationObserver(()=>{
    UI.scan(true);
    Hotbar.markDirty();

    // Pause panel
    const pauseClose=document.querySelector('button[data-testid="system-drawer-close-button"], button.chakra-modal__close-btn[aria-label="close"], [role="dialog"] button[aria-label="close"]');
    const wasPause=pauseOpen; pauseOpen=!!pauseClose;
    if(pauseOpen && !wasPause){ setTimeout(()=>{ UI.scan(true); UI.focusPausePartyTabFirst() || UI.focusTopLeft(); },0); }

    // Shop panel
    const shopRoot=UI.getShopRoot();
    const wasShop=shopOpen; shopOpen=!!(shopRoot && (getComputedStyle(shopRoot).visibility!=='hidden'));
    if(shopOpen && !wasShop){
      setTimeout(()=>{
        if(UI.isCropsShop()) UI.buildCropsOrder();
        UI.scan(true);
        UI.focusShopDefault() || UI.focusTopLeft();
      },0);
    }
    if(!shopOpen && wasShop){ UI._resetShopActivated(); UI.clearCropsOrder?.(); }

    // Confirmation dialog
    const wasConfirm = confirmOpen;
    confirmOpen = !!UI._getConfirmRoot();
    setOutlineMode();
    if(confirmOpen && !wasConfirm){
      setTimeout(()=>{ UI.scan(true); UI._focusConfirmDefault() || UI.focusTopLeft(); },0);
    }
    if(!confirmOpen && wasConfirm){ UI.clearFocus(); }

    // Donuts overlay
    const wasDonuts = donutsOpen;
    donutsOpen = !!UI._getDonutsRoot();
    if(donutsOpen && !wasDonuts){
      setTimeout(()=>{ UI.scan(true); UI._focusDonutsDefault() || UI.focusTopLeft(); },0);
    }
    if(!donutsOpen && wasDonuts){ UI.clearFocus(); }

    // Journal overlay
    const wasJournal = journalOpen;
    journalOpen = !!UI._getJournalRoot();
    setOutlineMode();
    if(journalOpen && !wasJournal){
      setTimeout(()=>{ UI.scan(true); UI._focusJournalDefault() || UI.focusTopLeft(); },0);
    }
    if(!journalOpen && wasJournal){ UI.clearFocus(); }

    // Profile drawer
    const wasProfile = profileOpen;
    profileOpen = !!UI._getProfileRoot();
    if(profileOpen && !wasProfile){
      setTimeout(()=>{ UI.scan(true); UI._focusProfileDefault() || UI.focusTopLeft(); },0);
    }
    if(!profileOpen && wasProfile){ UI.clearFocus(); }

  });

 // Focus ring themes & Input Switching
  const mgcFocusStyleId = 'mgc-focus-style';
  let mgcFocusStyleElement = document.getElementById(mgcFocusStyleId);
  const mgcFocusStyleContent = `
      .mgc-focus-ring{
        outline:3px solid #fff!important;
        outline-offset:2px!important;
        border-radius:10px!important;
        box-shadow:0 0 0 1px rgba(255,255,255,.15), 0 0 8px rgba(255,255,255,.25);
        transition:outline-color .08s linear, box-shadow .12s ease;
      }
      .mgc-focus-ring[data-mgc-danger="1"]{ outline-color:#f33!important; box-shadow:0 0 0 2px rgba(255,51,51,.25), 0 0 10px rgba(255,51,51,.45); }
      .mgc-confirm-on .mgc-focus-ring{
        outline-color:#ffd83b!important;
        box-shadow:0 0 0 2px rgba(255,216,59,.3), 0 0 12px rgba(255,216,59,.6), inset 0 0 0 1px rgba(255,255,255,.1);
      }
      .mgc-journal-on .mgc-focus-ring{
        outline-color:#34d399!important;
        box-shadow:
          0 0 0 2px rgba(52,211,153,.28),
          0 0 14px rgba(16,185,129,.55),
          inset 0 0 0 1px rgba(255,255,255,.12);
        border-radius:12px!important;
      }
    `;

  if(!mgcFocusStyleElement){
    const st=document.createElement('style');
    st.id=mgcFocusStyleId;
    st.textContent=mgcFocusStyleContent;
    document.head.appendChild(st);
    mgcFocusStyleElement = st;
  }

  let usingGamepad = true;

  function switchToKeyboard() {
    if (!usingGamepad) return;
    console.log('[MagicGardenController] Switching to Keyboard input mode.');
    usingGamepad = false;
    if (mgcFocusStyleElement) mgcFocusStyleElement.textContent = '';
    UI.clearFocus();
    releaseAllHeldKeys();
    if (boxModeManual) boxModeManual = false;
    manageControllerHints(false);
  }

  function switchToGamepad() {
    if (usingGamepad) return;
    console.log('[MagicGardenController] Switching to Gamepad input mode.');
    usingGamepad = true;
    if (mgcFocusStyleElement) mgcFocusStyleElement.textContent = mgcFocusStyleContent;
    manageControllerHints(true);
  }

  window.addEventListener('keydown', (e) => {
    if (e.isTrusted && !e.repeat) {
      const isEmulatedKey = Object.values(CONFIG.MOVE_KEYS).some(k => k.code === e.code) ||
                            ['Space', 'Escape', 'KeyE', 'KeyX', 'KeyC'].includes(e.code) ||
                            /Digit[1-9]/.test(e.code);
      if (!isEmulatedKey) {
        switchToKeyboard();
      }
    }
  }, true);

  window.addEventListener('mousedown', (e) => {
    if (e.isTrusted) {
      switchToKeyboard();
    }
  }, true);


  mo.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});

  function setOutlineMode(){
    document.documentElement.classList.toggle('mgc-confirm-on', !!confirmOpen);
    document.documentElement.classList.toggle('mgc-journal-on', !!journalOpen && !confirmOpen);
  }

  /* ---------- Hotbar stepping ---------- */
  const stepHotbar=(dir)=>{
    const { occupied } = Hotbar.refresh();
    if(!occupied.length){ deselectViaRepeat(); return; }

    if(hotbarSlot==null){
      pick(dir>0 ? occupied[0] : occupied[occupied.length-1]);
      return;
    }

    const idx = occupied.indexOf(hotbarSlot);
    if(idx === -1){
      pick(dir>0 ? occupied[0] : occupied[occupied.length-1]);
      return;
    }

    const nextI = idx + (dir>0?1:-1);
    if(nextI<0 || nextI>=occupied.length){
      deselectViaRepeat();
      return;
    }
    pick(occupied[nextI]);
  };

  /* ---------- input loop ---------- */
  const btnPressed=(gp,idx,thr=0.5)=>{ const b=gp.buttons[idx]; return (typeof b==='object')?(b.pressed||b.value>thr):(b>thr); };

  let navLock = null; // 'dpad' | 'stick' | null
  let navLockLastActive = 0;

  const releaseAllHeldKeys=()=>{ for(const {spec,mods} of activeKeys.values()) keyUp(spec,mods); activeKeys.clear(); };

  const makeRep=()=>({ x:0, y:0, tX:0, tY:0 });
  const repD = makeRep();
  const repS = makeRep();

  let lastButtons=[], lastRB=0,lastLB=0;
  let lastFrame=performance.now();

  const rightStickScroll = (gp, dt)=>{
    if(!shopOpen) return;
    if(UI.isCropsShop()) return; // disabled in crops
    const ry = gp.axes[3]||0;
    if(Math.abs(ry) > CONFIG.SHOP_SCROLL_STICK_DZ){
      const px = Math.max(-CONFIG.SHOP_SCROLL_MAXSTEP_PX, Math.min(CONFIG.SHOP_SCROLL_MAXSTEP_PX, ry * CONFIG.SHOP_SCROLL_SPEED_PX_PER_SEC * dt));
      if(Math.abs(px) > 0.5) UI.scrollShopBy(px);
    }
  };

  const quantizeStick = (val, prev, on=CONFIG.UI_STICK_DZ, off=CONFIG.UI_STICK_RELEASE_DZ)=>{
    if(prev===0){ if(val>on) return +1; if(val<-on) return -1; return 0; }
    if(prev>0){ return (val<off)?0:+1; } else { return (val>-off)?0:-1; }
  };

  let qStickX=0, qStickY=0;

  const loop=()=>{
    const pads=navigator.getGamepads?Array.from(navigator.getGamepads()):[];
    const gp=pads.find(p=>p&&p.connected);
    if(!gp){ releaseAllHeldKeys(); lastButtons=[]; requestAnimationFrame(loop); return; }

    // Auto-switch back to gamepad
    if (!usingGamepad) {
        const isAnyButtonPressed = gp.buttons.some(b => b.pressed);
        const isAnyAxisMoved = gp.axes.some(a => Math.abs(a) > CONFIG.DEADZONE);
        if (isAnyButtonPressed || isAnyAxisMoved) {
            switchToGamepad();
        } else {
            requestAnimationFrame(loop);
            return; // Don't run the rest of the loop if in keyboard mode
        }
    }

    const now=performance.now();
    const dt=(now-lastFrame)/1000;
    lastFrame=now;

    const b=(i)=>btnPressed(gp,i);
    const prev=lastButtons; lastButtons=gp.buttons.map((_,i)=>b(i));
    const inBox=boxMode();

    // Teleportation
    const LSTICK_now = b(BTN.LSTICK);
    const LSTICK_prev = prev[BTN.LSTICK] || false;
    const LT_now = btnPressed(gp, BTN.LT, 0.2);
    const LT_prev = prev[BTN.LT];
    const RT_now = btnPressed(gp, BTN.RT, 0.2);
    const RT_prev = prev[BTN.RT];

    if (LSTICK_now && !LSTICK_prev) {
        const gardenButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('My Garden'));
        if (gardenButton) gardenButton.click();
    }

    if (LT_now && !LT_prev) {
        const shopButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Shop'));
        if (shopButton) shopButton.click();
    }

    if (RT_now && !RT_prev) {
        const sellButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Sell'));
        if (sellButton) sellButton.click();
    }

    // SELECT -> toggle Box Mode (ignored if panels already force it)
    const SELECT_now=b(BTN.SELECT), SELECT_prev=prev[BTN.SELECT]||false;
    if(SELECT_now && !SELECT_prev){
      if(!inventoryOpen && !pauseOpen && !shopOpen && !confirmOpen && !donutsOpen && !journalOpen && !profileOpen){
        boxModeManual=!boxModeManual;
        if(boxMode()){
          releaseAllHeldKeys();
          UI.scan(true);
          UI.focusTopMostPet?.() || UI.focusRandomCandidate?.() || UI.focusTopLeft();
        } else {
          UI.clearFocus();
        }
      }
    }

    // Minor popups & header token:
    const L3_now=b(BTN.LSTICK), R3_now=b(BTN.RSTICK);
    const L3_prev=prev[BTN.LSTICK]||false, R3_prev=prev[BTN.RSTICK]||false;

    // If BOTH pressed (rising together) -> click SystemHeaderPlayerToken button
    if(L3_now && R3_now && !(L3_prev && R3_prev)){
      UI._clickHeaderTokenButton();
    } else if (L3_now && !L3_prev && !R3_now) {
      // L3 alone -> close any minor popup
      const closes = UI._findMinorPopupCloseBtns();
      if(closes.length){ closes[0].click(); }
    } else if (R3_now && !R3_prev && !L3_now && inventoryOpen) {
      // R3 alone in inventory -> left mouse click on focused element
      const el = UI.scan()[UI._getCurrentIndex()];
      if(el) {
        const rect = el.getBoundingClientRect();
        const clickX = rect.left + rect.width / 2;
        const clickY = rect.top + rect.height / 2;
        const mouseEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: clickX,
          clientY: clickY,
          button: 0
        });
        el.dispatchEvent(mouseEvent);
      }
    }

    // A: combos and clicks (donuts hijacks A)
    const A_now=b(BTN.A), A_prev=prev[BTN.A]||false;
    if(A_now && !A_prev && donutsOpen){
      UI._clickDonutsClose();
    } else if(!inBox){
      if(A_now && !A_prev){
        if(LT_now && RT_now)      tapShiftDigit(3); // RT+LT+A => Shift+3
        else if(RT_now)           tapShiftDigit(1); // RT+A => Shift+1
        else if(LT_now)           tapShiftDigit(2); // LT+A => Shift+2
        else                      setHeld(CONFIG.A_KEY,true);
      }
      if(!A_now && A_prev) setHeld(CONFIG.A_KEY,false);
    } else if(A_now && !A_prev){
      UI.click();
    }

    // X -> Favorite toggle (nearby heart)
    const X_now=b(BTN.X), X_prev=prev[BTN.X]||false;
    if(X_now && !X_prev){ try{ UI.fav?.(); }catch{} }

    // B -> back/close/deselect
    const B_now=b(BTN.B), B_prev=prev[BTN.B]||false;
    if(B_now && !B_prev){
      if(donutsOpen){ UI.clearFocus(); UI._clickDonutsClose(); }
      else if(confirmOpen){ UI.clearFocus(); UI._clickConfirmClose() || tapKey(CONFIG.ESC_KEY); }
      else if(journalOpen){
        const back=UI._findJournalBackBtn();
        if(back && getComputedStyle(back).display!=='none'){ back.click(); } // detail → main
        else { tapKey(CONFIG.ESC_KEY); } // main → close journal
      }
      else if(profileOpen){ UI.clearFocus(); UI._clickProfileClose() || tapKey(CONFIG.ESC_KEY); }
      else if(shopOpen){ UI.clearFocus(); UI.clickShopClose(); UI._resetShopActivated(); }
      else if(pauseOpen){ UI.clearFocus(); UI.clickPauseClose(); }
      else if(inBox && !inventoryOpen){ boxModeManual=false; UI.clearFocus(); }
      else if(inventoryOpen){ UI.clearFocus(); tapEscape(); }
      else if(hotbarSlot!=null){ deselectViaRepeat(); }
      else { tapEscape(); }
    }

    // Y -> Inventory toggle (blocked by shop/pause/confirm/donuts/journal/profile/purchase)
    const Y_now=b(BTN.Y), Y_prev=prev[BTN.Y]||false;
    if(Y_now && !Y_prev){ if(!shopOpen && !pauseOpen && !confirmOpen && !donutsOpen && !journalOpen && !profileOpen) tapInventoryToggle(); }

    // LB/RB (Inventory: jump between favorites ONLY; Journal: toggle tabs)
    const RB_now=b(BTN.RB), RB_prev=prev[BTN.RB]||false;
    const LB_now=b(BTN.LB), LB_prev=prev[BTN.LB]||false;
    if(RB_now && !RB_prev && (now-lastRB)>CONFIG.RB_LB_COOLDOWN_MS){
      lastRB=now;
      if(inBox){
        if(donutsOpen){ /* ignore */ }
        else if(confirmOpen){ UI.moveBy(+1,0); }
        else if(journalOpen){ UI._journalToggle(); }
        else if(inventoryOpen){ UI.jumpInventoryFavorite(+1); }
        else if(profileOpen){ UI.moveBy(+1,0); }
        else { (shopOpen?UI.moveShop(+1,0):UI.moveBy(+1,0)); }
      } else {
        stepHotbar(+1);
      }
    }
    if(LB_now && !LB_prev && (now-lastLB)>CONFIG.RB_LB_COOLDOWN_MS){
      lastLB=now;
      if(inBox){
        if(donutsOpen){ /* ignore */ }
        else if(confirmOpen){ UI.moveBy(-1,0); }
        else if(journalOpen){ UI._journalToggle(); }
        else if(inventoryOpen){ UI.jumpInventoryFavorite(-1); }
        else if(profileOpen){ UI.moveBy(-1,0); }
        else { (shopOpen?UI.moveShop(-1,0):UI.moveBy(-1,0)); }
      } else {
        stepHotbar(-1);
      }
    }

    // START -> Pause (blocked if donuts/confirm/journal/profile/purchase)
    const START_now=b(BTN.START), START_prev=prev[BTN.START]||false;
    if(START_now && !START_prev){
      if(shopOpen){
        // ignore
      } else if(pauseOpen){
        UI.clearFocus(); if(!UI.clickPauseClose()) tapKey(CONFIG.ESC_KEY);
      } else if(confirmOpen || donutsOpen || journalOpen || profileOpen){
        // ignore START while gated dialogs are up
      } else {
        if(!UI.clickPartyMenu()) {/* no-op */}
        setTimeout(()=>{ if(document.querySelector('button[data-testid="system-drawer-close-button"], button.chakra-modal__close-btn[aria-label="close"], [role="dialog"] button[aria-label="close"]')){ UI.scan(true); UI.focusPausePartyTabFirst() || UI.focusTopLeft(); } },50);
      }
    }

    // Left stick & dpad
    const dz=CONFIG.DEADZONE;
    const axXraw=gp.axes[0]||0, axYraw=gp.axes[1]||0;

    if(!inBox){
      const wantUp   = (axYraw<-dz)||b(BTN.DPAD_UP);
      const wantDown = (axYraw> dz)||b(BTN.DPAD_DOWN);
      const wantLeft = (axXraw<-dz)||b(BTN.DPAD_LEFT);
      const wantRight= (axXraw> dz)||b(BTN.DPAD_RIGHT);
      setHeld(CONFIG.MOVE_KEYS.up,   wantUp);
      setHeld(CONFIG.MOVE_KEYS.down, wantDown);
      setHeld(CONFIG.MOVE_KEYS.left, wantLeft);
      setHeld(CONFIG.MOVE_KEYS.right,wantRight);
      lastButtons=gp.buttons.map((_,i)=>b(i));
      requestAnimationFrame(loop);
      return;
    }

    // In Box Mode: disable WASD/Space entirely
    setHeld(CONFIG.MOVE_KEYS.up,false); setHeld(CONFIG.MOVE_KEYS.down,false);
    setHeld(CONFIG.MOVE_KEYS.left,false); setHeld(CONFIG.MOVE_KEYS.right,false);
    setHeld(CONFIG.A_KEY,false);

    // Donuts overlay swallows navigation; only A/B close
    if(donutsOpen){
      requestAnimationFrame(loop);
      return;
    }

    const prevQX=qStickX, prevQY=qStickY;
    qStickX = quantizeStick(axXraw, prevQX);
    qStickY = quantizeStick(axYraw, prevQY);

    const dX = (b(BTN.DPAD_LEFT)?-1:(b(BTN.DPAD_RIGHT)?+1:0));
    const dY = (b(BTN.DPAD_UP)?-1:(b(BTN.DPAD_DOWN)?+1:0));

    const anyD = (dX!==0 || dY!==0);
    const anyS = (qStickX!==0 || qStickY!==0);

    if(navLock==null){
      if(anyD){ navLock='dpad'; navLockLastActive=now; }
      else if(anyS){ navLock='stick'; navLockLastActive=now; }
    } else if(navLock==='dpad'){
      if(anyD) navLockLastActive=now;
      if(!anyD && (now - navLockLastActive) > CONFIG.UI_LOCK_RELEASE_MS) navLock=null;
    } else if(navLock==='stick'){
      if(anyS) navLockLastActive=now;
      if(!anyS && (now - navLockLastActive) > CONFIG.UI_LOCK_RELEASE_MS) navLock=null;
    }

    const fireRepeat = (rep, dir, axis, nowT)=>{
      const init=CONFIG.UI_INITIAL_DELAY_MS, rpt=CONFIG.UI_REPEAT_MS;
      const t = axis==='x'? 'tX':'tY', last = rep[axis];
      if(dir!==last){ rep[axis]=dir; rep[t] = dir===0 ? 0 : (nowT + init); return dir!==0; }
      if(dir!==0 && nowT>=rep[t]){ rep[t]=nowT+rpt; return true; }
      return false;
    };

    if(navLock==='dpad'){
      if(fireRepeat(repD, dY, 'y', now)) {
        if(confirmOpen){ /* vertical ignored on confirm */ }
        else (shopOpen?UI.moveShop(0,dY):inventoryOpen?UI.moveInventory(0,dY):UI.moveBy(0,dY));
      }
      if(fireRepeat(repD, dX, 'x', now)) {
        if(confirmOpen){ UI.moveBy(dX,0); }
        else (shopOpen?UI.moveShop(dX,0):inventoryOpen?UI.moveInventory(dX,0):UI.moveBy(dX,0));
      }
    } else if(navLock==='stick'){
      if(fireRepeat(repS, qStickY, 'y', now)) {
        if(confirmOpen){ /* vertical ignored on confirm */ }
        else (shopOpen?UI.moveShop(0,qStickY):inventoryOpen?UI.moveInventory(0,qStickY):UI.moveBy(0,qStickY));
      }
      if(fireRepeat(repS, qStickX, 'x', now)) {
        if(confirmOpen){ UI.moveBy(qStickX,0); }
        else (shopOpen?UI.moveShop(qStickX,0):inventoryOpen?UI.moveInventory(qStickX,0):UI.moveBy(qStickX,0));
      }
    }

    rightStickScroll(gp, dt);

    requestAnimationFrame(loop);
  };

  const start=()=>{ if(document.activeElement?.blur) document.activeElement.blur(); window.focus(); requestAnimationFrame(loop); console.log('[MagicGardenController] Started (v40).'); };
  const stop =()=>{ for(const {spec,mods} of activeKeys.values()) keyUp(spec,mods); activeKeys.clear(); console.log('[MagicGardenController] Stopped.'); };

  window.MagicGardenController = {
    start, stop, pick,
    get hotbarSlot(){ return hotbarSlot; },
    get inventoryOpen(){ return inventoryOpen; },
    get pauseOpen(){ return pauseOpen; },
    get shopOpen(){ return shopOpen; },
    get confirmOpen(){ return confirmOpen; },
    get donutsOpen(){ return donutsOpen; },
    get journalOpen(){ return journalOpen; },
    get profileOpen(){ return profileOpen; },
    get boxMode(){ return boxMode(); },
    config: CONFIG,
    debug: debugShop,
    debugMovement: debugMovement,
  };

  // Debug function to check what's in shop scan results
  const debugShopScan = () => {
    console.log('=== SHOP SCAN DEBUG ===');
    console.log('shopOpen:', shopOpen);
    const candidates = UI.scan(true);
    console.log('Total scan candidates:', candidates.length);

    candidates.forEach((el, i) => {
      const isPurchase = UI._isShopPurchaseButton(el);
      const isProduct = UI._isShopProductButton(el);
      const text = el.textContent?.trim().slice(0, 30);
      const classes = el.className.split(' ').slice(0, 3).join(' ');
      console.log(`[${i}] ${el.tagName} "${text}" ${classes} - Product:${isProduct} Purchase:${isPurchase}`);
    });
    console.log('===================');
  };

  window.MagicGardenController.debugShopScan = debugShopScan;

  console.log('[MagicGardenController] Functions exported:', {
    debug: typeof debugShop,
    debugMovement: typeof debugMovement,
    debugShopScan: typeof debugShopScan,
    controller: !!window.MagicGardenController
  });

  window.addEventListener('gamepadconnected', start, { once:true });
  start();
})();