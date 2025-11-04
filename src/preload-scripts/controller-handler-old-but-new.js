const AXIS_THRESHOLD = 0.7; // Increased threshold for joystick movement

const keyMap = {
    'w': false,
    'a': false,
    's': false,
    'd': false,
};

function dispatchKeyEvent(key, type) {
    console.log(`Dispatching ${type} for key: ${key}`); // Debug log
    const event = new KeyboardEvent(type, {
        key: key,
        code: `Key${key.toUpperCase()}`,
        bubbles: true,
        cancelable: true,
    });
    document.dispatchEvent(event);
}

// Game-specific CONFIG from ctrl.txt
const CONFIG = {
    // Buttons (Xbox-style)
    BTN_A: 0,
    BTN_L2: 6,
    BTN_R2: 7,
    BTN_START: 9, // Added Start button

    // Trigger fallbacks on axes (some pads map triggers to axes)
    AXIS_L2: 2,
    AXIS_R2: 5,
    AXIS_DZ: 0.55,

    // Right Stick horizontal axis (explicit crop cycling)
    RS_X_AXIS: 2,      // Typical: 2 on many pads; change to 2 or 3 based on your browser's mapping
    RS_DZ: 0.5,        // deadzone for RS left/right
    RS_REQUIRE_CENTER: true, // must recenter (back into deadzone) before next flick

    // Lock windows
    ROUTE_LOCK_MS: 1500,
    TELEPORT_LOCK_MS: 1500,

    // Allowed nav selectors (so our own teleport clicks aren't blocked)
    NAV_ALLOW_SELECTORS: [
      'button[data-nav="shop"]',
      'button[data-nav="garden"]',
      'button[data-nav="sell"]',
    ],
    NAV_TEXT_MATCH: {
      shop:   ['shop'],
      garden: ['my garden','garden'],
      sell:   ['sell'],
    },
};

function nowMs(){ return performance.now(); }
function visible(el){ if(!el) return false; const r=el.getBoundingClientRect(); return !!(r.width||r.height); }
function isTyping(){ const a=document.activeElement; if(!a) return false; const t=(a.tagName||'').toLowerCase(); return t==='input'||t==='textarea'||a.isContentEditable===true; }

// Hard key tap (keydown+keyup)
function hardTapKey(code, key, keyCode){
    console.log(`Hard tapping key: ${key}`); // Debug log
    const target = document.activeElement || document.body || document;
    const init = { key, code, keyCode, which:keyCode, bubbles:true, cancelable:true, composed:true, repeat:false, location:0 };
    try{ target.dispatchEvent(new KeyboardEvent('keydown', init)); }catch(_){}
    try{ target.dispatchEvent(new KeyboardEvent('keyup', init)); }catch(_){}
}
const tapX = () => hardTapKey('KeyX','x',88);
const tapC = () => hardTapKey('KeyC','c',67);

// ---- Route/Teleport lock ----
let lockUntil = 0;
function lockFor(ms){ if(ms>0) lockUntil = Math.max(lockUntil, nowMs()+ms); }
function locked(){ return nowMs() < lockUntil; }

(function hookSPA(){
    try{
      const ps = history.pushState, rs = history.replaceState;
      history.pushState = function(){ lockFor(CONFIG.ROUTE_LOCK_MS); return ps.apply(this, arguments); };
      history.replaceState = function(){ lockFor(CONFIG.ROUTE_LOCK_MS); return rs.apply(this, arguments); };
      addEventListener('popstate', function(){ lockFor(CONFIG.ROUTE_LOCK_MS); }, {passive:true, capture:true});
    }catch(_){}
    let last = location.href;
    setInterval(function(){ if(location.href!==last){ last=location.href; lockFor(CONFIG.ROUTE_LOCK_MS); }}, 250);
})();

// Risky key filter
const RISKY = new Set([
    'KeyX','KeyC',
    'Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
    'Numpad1','Numpad2','Numpad3','Numpad4','Numpad5','Numpad6','Numpad7','Numpad8','Numpad9',
]);
function riskyKey(e){ const code=e.code||''; const k=(e.key||'').toLowerCase(); return RISKY.has(code) || (!!k && '123456789xc'.indexOf(e.key)>=0); }

function swallowKey(e){ if(!locked()) return; if(!riskyKey(e)) return; e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }
addEventListener('keydown', swallowKey, true);
addEventListener('keyup', swallowKey, true);
addEventListener('keypress', swallowKey, true);

function isAllowedTarget(t){
    try { for(const sel of CONFIG.NAV_ALLOW_SELECTORS){ if(t && t.closest && t.closest(sel)) return true; } } catch(_){}
    try {
      const btn = t && t.closest && t.closest('a,button,[role="button"]');
      if(btn && visible(btn)){
        const txt=(btn.textContent||'').toLowerCase();
        if(CONFIG.NAV_TEXT_MATCH.shop.some(s=>txt.includes(s))) return true;
        if(CONFIG.NAV_TEXT_MATCH.garden.some(s=>txt.includes(s))) return true;
        if(CONFIG.NAV_TEXT_MATCH.sell.some(s=>txt.includes(s))) return true;
      }
    } catch(_){}
    return false;
}

function swallowPtr(e){ if(!locked()) return; if(isAllowedTarget(e.target)) return; e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }
['mousedown','mouseup','click','pointerdown','pointerup','touchstart','touchend'].forEach(function(t){ addEventListener(t, swallowPtr, true); });

// ---- UI nav helpers ----
function clickTopNav(which){
    console.log(`Clicking top nav: ${which}`); // Debug log
    for(const sel of CONFIG.NAV_ALLOW_SELECTORS){
      const btn = document.querySelector(sel);
      if(btn && visible(btn)){ btn.click(); return true; }
    }
    const wants = CONFIG.NAV_TEXT_MATCH[which] || [];
    const cand = Array.from(document.querySelectorAll('a,button,[role="button"]'));
    for(const el of cand){
      if(!visible(el)) continue;
      const t=(el.textContent||'').toLowerCase();
      if(wants.some(w=>t.includes(w))){ el.click(); return true; }
    }
    return false;
}

function teleport(which){
    console.log(`Teleporting to: ${which}`); // Debug log
    lockFor(CONFIG.TELEPORT_LOCK_MS);
    try{ document.activeElement && document.activeElement.blur(); }catch(_){}
    clickTopNav(which);
}

// Call installNavigatorShim from the exposed API
ipcRenderer.invoke('gamepad:install-shim'); // Use ipcRenderer to call the main process

let lastA=false, lastL2=false, lastR2=false, lastStart=false; // Added lastStart
let lastRSsign=0; // -1 (left), 0 (center), 1 (right)

function triggerPressed(gp, idxBtn, idxAxis){
    let pressed=false;
    try{ pressed = gp.buttons[idxBtn] && gp.buttons[idxBtn].pressed; }catch(_){}
    // Ignore axis if it clashes with RS_X axis
    if(!pressed && gp.axes && typeof gp.axes[idxAxis]==='number' && idxAxis!==CONFIG.RS_X_AXIS){
      if(gp.axes[idxAxis] > CONFIG.AXIS_DZ) pressed = true;
    }
    return !!pressed;
}

function onFrame() {
    const gamepads = navigator.getGamepads();

    for (const gamepad of gamepads) {
        if (!gamepad) continue;

        // WASD mapping for Left Stick
        const leftStickX = gamepad.axes[0];
        const leftStickY = gamepad.axes[1];

        // W (Up)
        if (leftStickY < -AXIS_THRESHOLD && !keyMap['w']) {
            dispatchKeyEvent('w', 'keydown');
            keyMap['w'] = true;
        } else if (leftStickY >= -AXIS_THRESHOLD && keyMap['w']) {
            dispatchKeyEvent('w', 'keyup');
            keyMap['w'] = false;
        }

        // S (Down)
        if (leftStickY > AXIS_THRESHOLD && !keyMap['s']) {
            dispatchKeyEvent('s', 'keydown');
            keyMap['s'] = true;
        } else if (leftStickY <= AXIS_THRESHOLD && keyMap['s']) {
            dispatchKeyEvent('s', 'keyup');
            keyMap['s'] = false;
        }

        // A (Left)
        if (leftStickX < -AXIS_THRESHOLD && !keyMap['a']) {
            dispatchKeyEvent('a', 'keydown');
            keyMap['a'] = true;
        } else if (leftStickX >= -AXIS_THRESHOLD && keyMap['a']) {
            dispatchKeyEvent('a', 'keyup');
            keyMap['a'] = false;
        }

        // D (Right)
        if (leftStickX > AXIS_THRESHOLD && !keyMap['d']) {
            dispatchKeyEvent('d', 'keydown');
            keyMap['d'] = true;
        } else if (leftStickX <= AXIS_THRESHOLD && keyMap['d']) {
            dispatchKeyEvent('d', 'keyup');
            keyMap['d'] = false;
        }

        // WASD mapping for D-pad
        // D-pad Up (W)
        if (gamepad.buttons[12]?.pressed && !keyMap['w']) {
            dispatchKeyEvent('w', 'keydown');
            keyMap['w'] = true;
        } else if (!gamepad.buttons[12]?.pressed && keyMap['w']) {
            dispatchKeyEvent('w', 'keyup');
            keyMap['w'] = false;
        }

        // D-pad Down (S)
        if (gamepad.buttons[13]?.pressed && !keyMap['s']) {
            dispatchKeyEvent('s', 'keydown');
            keyMap['s'] = true;
        } else if (!gamepad.buttons[13]?.pressed && keyMap['s']) {
            dispatchKeyEvent('s', 'keyup');
            keyMap['s'] = false;
        }

        // D-pad Left (A)
        if (gamepad.buttons[14]?.pressed && !keyMap['a']) {
            dispatchKeyEvent('a', 'keydown');
            keyMap['a'] = true;
        } else if (!gamepad.buttons[14]?.pressed && keyMap['a']) {
            dispatchKeyEvent('a', 'keyup');
            keyMap['a'] = false;
        }

        // D-pad Right (D)
        if (gamepad.buttons[15]?.pressed && !keyMap['d']) {
            dispatchKeyEvent('d', 'keydown');
            keyMap['d'] = true;
        } else if (!gamepad.buttons[15]?.pressed && keyMap['d']) {
            dispatchKeyEvent('d', 'keyup');
            keyMap['d'] = false;
        }

        // Game-specific actions from ctrl.txt
        const A_now  = !!(gamepad.buttons[CONFIG.BTN_A] && gamepad.buttons[CONFIG.BTN_A].pressed);
        const L2_now = triggerPressed(gamepad, CONFIG.BTN_L2, CONFIG.AXIS_L2);
        const R2_now = triggerPressed(gamepad, CONFIG.BTN_R2, CONFIG.AXIS_R2);
        const Start_now = !!(gamepad.buttons[CONFIG.BTN_START] && gamepad.buttons[CONFIG.BTN_START].pressed); // Check Start button

        // Debug log for A button
        if (A_now && !lastA) {
            console.log('A button pressed!');
        }
        // Debug log for Start button
        if (Start_now && !lastStart) {
            console.log('Start button pressed!');
            // Example action: open dev console
            ipcRenderer.invoke('dev-console:execute-command', 'open-dev-console'); // Assuming such a command exists
        }


        // Teleport combos
        if(A_now && !lastA){
            if(L2_now && R2_now)      teleport('sell');
            else if(R2_now)           teleport('shop');
            else if(L2_now)           teleport('garden');
        }

        // L2/R2 -> crops (edge). Suppress while typing or during lock
        if(!A_now && !locked() && !isTyping()){
            if(R2_now && !lastR2) tapC();
            if(L2_now && !lastL2) tapX();
        }

        // Right Stick horizontal -> crops (flick left/right)
        const rsx = (gamepad.axes && typeof gamepad.axes[CONFIG.RS_X_AXIS]==='number') ? gamepad.axes[CONFIG.RS_X_AXIS] : 0;
        const inDead = Math.abs(rsx) < CONFIG.RS_DZ;
        let sign = 0;
        if(!inDead) sign = (rsx > 0) ? 1 : -1;

        if(!A_now && !locked() && !isTyping()){
            if(sign === 1 && (lastRSsign<=0)) { tapC(); if(CONFIG.RS_REQUIRE_CENTER) lastRSsign = 1; else lastRSsign = 0; }
            if(sign === -1 && (lastRSsign>=0)) { tapX(); if(CONFIG.RS_REQUIRE_CENTER) lastRSsign = -1; else lastRSsign = 0; }
        }

        if(inDead) lastRSsign = 0;
        lastA=A_now; lastL2=L2_now; lastR2=R2_now; lastStart=Start_now; // Update lastStart
    }
    requestAnimationFrame(onFrame);
}
requestAnimationFrame(onFrame);