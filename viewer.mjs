/**
 * viewer.mjs
 *
 * - Both canvases share DPR buffer.
 * - Dashed lines drawn in CSS px via ctx.setTransform(DPR,…).
 * - + / - zoom steps update the dropdown.
 * - Esc closes help overlay.
 * - Click-to-copy shows a “Copied!” tooltip briefly.
 * - 10px padding ensures border at high zoom.
 */

import * as pdfjsLib from './pdfjs/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.mjs';

// DOM refs
const fileInput       = document.getElementById('fileInput');
const prevBtn         = document.getElementById('prevPage');
const nextBtn         = document.getElementById('nextPage');
const zoomSelect      = document.getElementById('zoomSelect');
const autoCopyChk     = document.getElementById('autoCopy');
const retainViewport  = document.getElementById('retainViewport');
const helpBtn         = document.getElementById('helpBtn');
const helpOverlay     = document.getElementById('helpOverlay');
const wrapper         = document.getElementById('canvasWrapper');
const pdfCanvas       = document.getElementById('pdfCanvas');
const pdfCtx          = pdfCanvas.getContext('2d');
const overlayCanvas   = document.getElementById('overlayCanvas');
const overlayCtx      = overlayCanvas.getContext('2d');
const pageIndicator   = document.getElementById('pageIndicator');
const coordsDiv       = document.getElementById('coordinates');
const tooltip         = document.getElementById('tooltip');

// State
let pdfDoc    = null, pdfData = null, pageNum = 1;
let scale     = parseFloat(zoomSelect.value);
const DPR         = window.devicePixelRatio || 1;
const PDF_UNIT_CM = 0.0352778;
const TT_OFFSET   = 8;       // constant screen px distance
let lastCssX = 0, lastCssY = 0;
let copyTimeout = null;

// Discrete zoom steps
const zoomSteps = Array.from(zoomSelect.options).map(o => parseFloat(o.value));

/** Render the PDF page */
async function renderPage(num) {
  const page = await pdfDoc.getPage(num);
  const vp   = page.getViewport({ scale });
  const cssW = vp.width, cssH = vp.height;

  // PDF canvas at DPR
  pdfCanvas.width  = Math.round(cssW * DPR);
  pdfCanvas.height = Math.round(cssH * DPR);
  pdfCanvas.style.width  = `${cssW}px`;
  pdfCanvas.style.height = `${cssH}px`;

  // Overlay canvas same DPR buffer
  overlayCanvas.width  = pdfCanvas.width;
  overlayCanvas.height = pdfCanvas.height;
  overlayCanvas.style.width  = `${cssW}px`;
  overlayCanvas.style.height = `${cssH}px`;

  // Wrapper centering
  wrapper.style.width  = `${cssW}px`;
  wrapper.style.height = `${cssH}px`;

  // Render
  pdfCtx.setTransform(DPR,0,0,DPR,0,0);
  await page.render({ canvasContext: pdfCtx, viewport: vp }).promise;
  pdfCtx.setTransform(1,0,0,1,0,0);

  pageIndicator.textContent = `Page ${pageNum} / ${pdfDoc.numPages}`;
}

/** Draw crosshairs and update coords & tooltip */
function updateOverlays(cssX, cssY) {
  const rect = pdfCanvas.getBoundingClientRect();
  const x    = Math.max(0, Math.min(cssX, rect.width));
  const y    = Math.max(0, Math.min(cssY, rect.height));
  lastCssX = x; lastCssY = y;

  const ptX = x/scale, ptY = y/scale;
  const coordText = `(${(ptX*PDF_UNIT_CM).toFixed(2)}cm,${(ptY*PDF_UNIT_CM).toFixed(2)}cm)`;

  coordsDiv.textContent = `Coordinates: ${coordText}`;
  tooltip.textContent   = coordText;
  tooltip.style.display = 'block';
  tooltip.style.left    = `${x + TT_OFFSET}px`;
  tooltip.style.top     = `${y + TT_OFFSET}px`;

  // Clear
  overlayCtx.setTransform(1,0,0,1,0,0);
  overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);

  // Draw in CSS px
  overlayCtx.setTransform(DPR,0,0,DPR,0,0);
  overlayCtx.setLineDash([1,2]);
  overlayCtx.lineWidth   = 1;
  overlayCtx.strokeStyle = 'rgba(255,255,255,0.6)';

  // Vertical
  overlayCtx.beginPath();
  overlayCtx.moveTo(x+0.5, 0);
  overlayCtx.lineTo(x+0.5, overlayCanvas.height/DPR);
  overlayCtx.stroke();

  // Horizontal
  overlayCtx.beginPath();
  overlayCtx.moveTo(0, y+0.5);
  overlayCtx.lineTo(overlayCanvas.width/DPR, y+0.5);
  overlayCtx.stroke();

  overlayCtx.setTransform(1,0,0,1,0,0);
}

/** Hide overlays */
function clearOverlays() {
  tooltip.style.display = 'none';
  overlayCtx.setTransform(1,0,0,1,0,0);
  overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
}

/** Load PDF */
function loadPDF(data) {
  const keep = retainViewport.checked;
  pdfjsLib.getDocument(data).promise.then(doc => {
    pdfDoc = doc;
    if (!keep) { pageNum=1; scale=parseFloat(zoomSelect.value); }
    pageNum = Math.min(Math.max(1,pageNum), pdfDoc.numPages);
    zoomSelect.value = scale.toString();  // sync dropdown
    renderPage(pageNum);
  });
}

// — Event wiring —

fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f||f.type!=='application/pdf') return;
  const r = new FileReader();
  r.onload = ()=>{ pdfData=new Uint8Array(r.result); loadPDF(pdfData); };
  r.readAsArrayBuffer(f);
});
prevBtn.addEventListener('click', ()=>{ if(pageNum>1) pageNum--,renderPage(pageNum); });
nextBtn.addEventListener('click', ()=>{ if(pageNum<pdfDoc.numPages) pageNum++,renderPage(pageNum); });
zoomSelect.addEventListener('change', ()=>{ scale=parseFloat(zoomSelect.value); renderPage(pageNum); });

pdfCanvas.addEventListener('mousemove', e=>{
  const r = pdfCanvas.getBoundingClientRect();
  updateOverlays(e.clientX-r.left, e.clientY-r.top);
});
pdfCanvas.addEventListener('mouseleave', clearOverlays);

pdfCanvas.addEventListener('click', ()=>{
  if (!autoCopyChk.checked) return;
  const txt = tooltip.textContent || '';
  navigator.clipboard.writeText(txt).catch(()=>{});
  clearTimeout(copyTimeout);
  tooltip.textContent = `Copied: ${txt}`;
  copyTimeout = setTimeout(()=>tooltip.style.display='none', 1200);
});

// Drag & drop
pdfCanvas.addEventListener('dragover', e=>e.preventDefault());
pdfCanvas.addEventListener('drop', e=>{
  e.preventDefault();
  const f=e.dataTransfer.files[0];
  if(f&&f.type==='application/pdf'){
    const r=new FileReader();
    r.onload=()=>{ pdfData=new Uint8Array(r.result); loadPDF(pdfData); };
    r.readAsArrayBuffer(f);
  }
});

// Help overlay
helpBtn.addEventListener('click', ()=>helpOverlay.style.display='flex');
helpOverlay.addEventListener('click', ()=>helpOverlay.style.display='none');

// Keyboard
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && helpOverlay.style.display==='flex'){
    helpOverlay.style.display='none'; e.preventDefault(); return;
  }
  if(!pdfDoc) return;

  // Scroll: Arrow/Page (no Alt)
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown'].includes(e.key) && !e.altKey){
    if(e.ctrlKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){
      window.scrollBy(0,e.key==='ArrowUp'?-40:40); e.preventDefault();
    }
    return;
  }

  // Alt+Arrow => nudge crosshair
  if(e.altKey&&!e.ctrlKey&&!e.shiftKey && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
    const s=1;
    switch(e.key){
      case 'ArrowUp':    lastCssY=Math.max(0,lastCssY-s); break;
      case 'ArrowDown':  lastCssY=Math.min(overlayCanvas.height/DPR,lastCssY+s); break;
      case 'ArrowLeft':  lastCssX=Math.max(0,lastCssX-s); break;
      case 'ArrowRight': lastCssX=Math.min(overlayCanvas.width/DPR,lastCssX+s); break;
    }
    e.preventDefault(); updateOverlays(lastCssX,lastCssY); return;
  }

  // Prev page: P or Ctrl+‹
  if((!e.altKey&&!e.shiftKey&&(e.key==='p'||e.key==='P'))||(e.ctrlKey&&e.key==='ArrowLeft')){
    e.preventDefault(); if(pageNum>1) pageNum--,renderPage(pageNum); return;
  }
  // Next page: N or Ctrl+›
  if((!e.altKey&&!e.shiftKey&&(e.key==='n'||e.key==='N'))||(e.ctrlKey&&e.key==='ArrowRight')){
    e.preventDefault(); if(pageNum<pdfDoc.numPages) pageNum++,renderPage(pageNum); return;
  }

  // Zoom in: + or =
  if(e.key==='+'||e.key==='='){
    e.preventDefault();
    const idx=zoomSteps.indexOf(scale);
    if(idx>=0&&idx<zoomSteps.length-1){
      scale=zoomSteps[idx+1];
      zoomSelect.value=scale.toString();
      renderPage(pageNum);
    }
    return;
  }
  // Zoom out: -
  if(e.key==='-'){
    e.preventDefault();
    const idx=zoomSteps.indexOf(scale);
    if(idx>0){
      scale=zoomSteps[idx-1];
      zoomSelect.value=scale.toString();
      renderPage(pageNum);
    }
    return;
  }

  // Reload: R
  if(!e.altKey&&!e.ctrlKey&&!e.shiftKey&&(e.key==='r'||e.key==='R')){
    e.preventDefault(); pdfData&&loadPDF(pdfData); return;
  }
  // Help: H
  if(!e.altKey&&!e.ctrlKey&&!e.shiftKey&&(e.key==='h'||e.key==='H')){
    e.preventDefault(); helpOverlay.style.display='flex'; return;
  }
});

// Touch: pinch & swipe
let touchStartX=null, touchStartDist=null;
pdfCanvas.addEventListener('touchstart', e=>{
  if(e.touches.length===1) touchStartX=e.touches[0].clientX;
  else if(e.touches.length===2){
    const dx=e.touches[0].clientX-e.touches[1].clientX;
    const dy=e.touches[0].clientY-e.touches[1].clientY;
    touchStartDist=Math.hypot(dx,dy);
  }
});
pdfCanvas.addEventListener('touchmove', e=>{
  if(e.touches.length===2&&touchStartDist){
    const dx=e.touches[0].clientX-e.touches[1].clientX;
    const dy=e.touches[0].clientY-e.touches[1].clientY;
    const dist=Math.hypot(dx,dy), ratio=dist/touchStartDist;
    if(ratio>1.1){ scale*=1.1; zoomSelect.value=scale.toString(); renderPage(pageNum); touchStartDist=dist; }
    else if(ratio<0.9){ scale/=1.1; zoomSelect.value=scale.toString(); renderPage(pageNum); touchStartDist=dist; }
    e.preventDefault();
  }
});
pdfCanvas.addEventListener('touchend', e=>{
  if(touchStartX!==null&&e.changedTouches.length===1){
    const dx=e.changedTouches[0].clientX-touchStartX;
    if(dx>50&&pageNum>1){ pageNum--; renderPage(pageNum); }
    else if(dx<-50&&pageNum<pdfDoc.numPages){ pageNum++; renderPage(pageNum); }
  }
  touchStartX=touchStartDist=null;
});

