/** Styles for the DOM pause layer. Kept separate from its event handlers. */
export const pauseStyles = `
.sokudoku-pause-root{position:fixed;z-index:1000;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:auto;padding:10px;font-family:system-ui,-apple-system,sans-serif;color:var(--ink)}
.sokudoku-pause-root *{box-sizing:border-box}
.sokudoku-pause-card{position:relative;width:min(440px,100%);flex:0 1 auto;min-height:0;max-height:100%;overflow-y:auto;overscroll-behavior:contain;border:1.5px solid var(--line);border-radius:24px;padding:16px 18px 18px;background:var(--panel);box-shadow:0 6px 0 var(--shade);text-align:center;scrollbar-width:thin}
.sokudoku-pause-header{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:12px;text-align:left}
.sokudoku-pause-character{width:64px;height:64px;flex:none;background-image:url("/battle/mage-v5.png");background-size:400% 500%;background-repeat:no-repeat;image-rendering:pixelated;pointer-events:none}
.sokudoku-pause-card h2{font-size:22px;margin:0 0 2px;font-weight:800;line-height:1.25;letter-spacing:-.02em;color:var(--ink)}
.sokudoku-pause-subtitle{font-size:12px;color:var(--muted);margin:0}
.sokudoku-pause-card button,.sokudoku-pause-card select{font:inherit;cursor:pointer;touch-action:manipulation}
.sokudoku-pause-main{display:block;width:100%;height:48px;margin:0 0 10px;border-radius:14px;border:1.5px solid var(--line);font-size:16px;font-weight:800!important;color:var(--ink);background:var(--panel);box-shadow:0 4px 0 var(--shade);transition:transform .08s,box-shadow .08s}
.sokudoku-pause-main.primary{background:var(--blue);color:var(--on-blue);border-color:var(--blue-dark);box-shadow:0 4px 0 var(--blue-dark)}
.sokudoku-pause-main:active,.sokudoku-pause-quick button:active{transform:translateY(3px);box-shadow:none}
.sokudoku-pause-quick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:0}
.sokudoku-pause-quick button{width:100%;min-width:0;height:42px;padding:0 3px;background:var(--panel);border:1.5px solid var(--line);color:var(--ink);border-radius:12px;box-shadow:0 3px 0 var(--shade);font-size:12px;font-weight:700;transition:transform .08s,box-shadow .08s}
.sokudoku-pause-quick button.pause-exit{background:#c94d5f;border-color:#a63a4d;color:#fff;box-shadow:0 3px 0 #943246}
.sokudoku-pause-quick button.pause-exit:active{transform:translateY(3px);box-shadow:none}
.sokudoku-pause-quick button.pause-exit:focus-visible{outline:3px solid var(--blue);outline-offset:3px}
.pause-sound-controls{display:grid;gap:9px;margin-top:14px;padding-top:12px;border-top:1.5px dashed var(--line);text-align:left}
.pause-sound-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
.pause-sound-heading strong{font-size:14px;font-weight:800;color:var(--ink)}
.pause-sound-heading button{min-height:30px;padding:0 10px;border:1.5px solid var(--line);border-radius:999px;background:var(--panel);color:var(--blue);font-size:11px;font-weight:700}
.pause-sound-heading button[aria-pressed=true]{color:var(--muted)}
.pause-sound-slider{display:grid;grid-template-columns:66px minmax(0,1fr) 88px;align-items:center;gap:10px;min-height:36px;font-size:13px;font-weight:700;color:var(--ink)}
.pause-slider-caption{display:contents}
.pause-slider-caption>span:first-child{white-space:nowrap}
.pause-slider-side{display:flex;align-items:center;justify-content:flex-start;gap:6px;width:88px;min-width:88px}
.pause-slider-caption output{display:inline-block;width:42px;min-width:42px;text-align:right;font-variant-numeric:tabular-nums;color:var(--blue);font-weight:800;font-size:12px}
.pause-preview{width:28px;height:28px;padding:0;display:grid;place-items:center;border:1.5px solid var(--line);background:var(--panel);border-radius:9px;color:var(--blue);font-size:11px;box-shadow:0 2px 0 var(--shade)}
.pause-preview:active{transform:translateY(2px);box-shadow:none}
.pause-sound-slider input[type=range]{-webkit-appearance:none!important;appearance:none!important;display:block!important;box-sizing:border-box!important;width:100%!important;height:28px!important;min-height:28px!important;max-height:28px!important;margin:0!important;padding:0!important;border:0!important;border-radius:999px!important;box-shadow:none!important;outline:0!important;cursor:pointer;touch-action:pan-y;--fillpos:calc(100% * var(--p,0));background:linear-gradient(to right,var(--blue) 0,var(--blue) var(--fillpos),var(--track) var(--fillpos),var(--track) 100%) center/100% 7px no-repeat!important}
.pause-sound-slider input[type=range]::-webkit-slider-runnable-track{height:28px!important;border:0!important;background:transparent!important}
.pause-sound-slider input[type=range]::-moz-range-track{height:28px!important;border:0!important;background:transparent!important}
.pause-sound-slider input[type=range]::-webkit-slider-thumb{-webkit-appearance:none!important;appearance:none!important;width:0!important;height:0!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;background:transparent!important}
.pause-sound-slider input[type=range]::-moz-range-thumb{width:0!important;height:0!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;background:transparent!important}
.pause-sound-slider input[type=range]:focus-visible{outline:2px solid var(--blue)!important;outline-offset:2px!important}
.pause-select-grid{display:grid;grid-template-rows:repeat(2,minmax(44px,auto));gap:8px;margin-top:5px;padding-top:12px;border-top:1.5px dashed var(--line)}
.pause-select-row,.pause-correct-review-setting{display:grid;grid-template-columns:minmax(100px,1fr) minmax(0,1.5fr);align-items:center;gap:10px;min-width:0;text-align:left;font-size:13px;font-weight:700;color:var(--ink)}
.sokudoku-pause-card .pause-select-row{min-height:44px;height:44px;margin:0;padding:0}
.pause-select-row select,.pause-correct-review-setting select{width:100%;min-width:0;height:40px;border:1.5px solid var(--line);border-radius:11px;padding:0 9px;color:var(--ink);background:var(--panel);font-size:12px;font-weight:700}
.sokudoku-pause-card .pause-correct-review-setting{min-height:57px;margin:8px 0 0;padding:12px 0 0;border-top:1.5px dashed var(--line)}
.pause-correct-review-setting strong,.pause-reading-setting strong{font-size:13px;font-weight:800;color:var(--ink)}
.pause-reading-setting{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;height:44px;margin-top:8px;text-align:left}
.pause-reading-setting button{flex:none;min-width:62px;height:36px;border:1.5px solid var(--line);border-radius:999px;padding:0 12px;font-size:12px;font-weight:800;background:var(--panel);color:var(--muted)}
.pause-reading-setting button[aria-pressed=true]{background:var(--blue);color:var(--on-blue);border-color:var(--blue-dark)}
@media(max-width:359px){.sokudoku-pause-card{padding:12px}.pause-sound-slider{grid-template-columns:54px minmax(0,1fr) 88px;gap:5px}.pause-select-row,.pause-correct-review-setting{grid-template-columns:minmax(80px,1fr) minmax(0,1.5fr);gap:6px}}
@media(max-height:700px){.sokudoku-pause-card{padding:11px 14px}.sokudoku-pause-header{margin-bottom:8px}.sokudoku-pause-character{height:50px;width:50px}.sokudoku-pause-main{height:42px;margin-bottom:8px}.sokudoku-pause-quick button{height:36px}.pause-sound-controls{gap:5px;margin-top:10px;padding-top:9px}.pause-sound-slider{min-height:32px}.pause-select-grid{gap:8px}.pause-select-row select,.pause-correct-review-setting select{height:36px}.pause-correct-review-setting{margin-top:8px;padding-top:8px}}

.pause-reading-setting small{display:block;font-size:12px;color:var(--muted)}
`;
