console.log('[Keep Game Running Mod] Initializing Keep Game Running Mod preload script.');

Object.defineProperty(document, "hidden", {
    value: false,
    writable: false
});
Object.defineProperty(document, "visibilityState", {
    value: "visible",
    writable: false
});

document.addEventListener("visibilitychange", (e) => {
    e.stopImmediatePropagation();
}, true);

window.addEventListener("blur", (e) => {
    e.stopImmediatePropagation();
}, true);

window.addEventListener("focus", (e) => {
    e.stopImmediatePropagation();
}, true);