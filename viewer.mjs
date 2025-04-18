/**
 * viewer.mjs
 *
 * A PDF.js-based viewer that:
 *  - Renders a PDF page on an HTML5 canvas
 *  - Tracks cursor X/Y in cm and copies "(X.XXcm,Y.XXcm)" on click
 *  - Supports prev/next page via buttons, arrow keys, or swipe
 *  - Supports zoom via dropdown or pinch
 *  - Supports drag & drop of a PDF onto the canvas
 */

import * as pdfjsLib from './pdfjs/pdf.mjs';

// Tell PDF.js where to find its worker
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.mjs';

// ----- DOM references -----
const fileInput     = document.getElementById('fileInput');
const prevBtn       = document.getElementById('prevPage');
const nextBtn       = document.getElementById('nextPage');
const zoomSelect    = document.getElementById('zoomSelect');
const pageIndicator = document.getElementById('pageIndicator');
const canvas        = document.getElementById('pdfCanvas');
const ctx           = canvas.getContext('2d');
const coordsDiv     = document.getElementById('coordinates');

// ----- State -----
let pdfDoc   = null;
let pageNum  = 1;
let scale    = parseFloat(zoomSelect.value);
const PDF_UNIT_TO_CM = 0.0352778;  // 1 PDF pt = 1/72in = 0.0352778 cm

/**
 * Renders the given page number at the current scale.
 * @param {number} num - The page number to render.
 */
async function renderPage(num) {
  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale });

  // Resize canvas to match PDF page dimensions
  canvas.width  = viewport.width;
  canvas.height = viewport.height;

  // Draw the page
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Update page indicator
  pageIndicator.textContent = `Page ${pageNum} / ${pdfDoc.numPages}`;
}

/**
 * Handles updating the zoom and re-rendering.
 * @param {number} newScale 
 */
function changeZoom(newScale) {
  scale = newScale;
  renderPage(pageNum);
}

/**
 * Loads a PDF from an ArrayBuffer (Uint8Array) and renders page 1.
 * @param {Uint8Array} data
 */
function loadPDF(data) {
  pdfjsLib.getDocument(data).promise.then(doc => {
    pdfDoc = doc;
    pageNum = 1;
    renderPage(pageNum);
  });
}

// ----- Event Listeners -----

// File input
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file || file.type !== 'application/pdf') return;
  const reader = new FileReader();
  reader.onload = () => loadPDF(new Uint8Array(reader.result));
  reader.readAsArrayBuffer(file);
});

// Prev/Next buttons
prevBtn.addEventListener('click', () => {
  if (pageNum <= 1) return;
  pageNum--;
  renderPage(pageNum);
});
nextBtn.addEventListener('click', () => {
  if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
  pageNum++;
  renderPage(pageNum);
});

// Zoom dropdown
zoomSelect.addEventListener('change', () => {
  changeZoom(parseFloat(zoomSelect.value));
});

// Keyboard ‹ / ›
document.addEventListener('keydown', e => {
  if (!pdfDoc) return;
  if (e.key === 'ArrowRight' && pageNum < pdfDoc.numPages) {
    pageNum++; renderPage(pageNum);
  } else if (e.key === 'ArrowLeft' && pageNum > 1) {
    pageNum--; renderPage(pageNum);
  }
});

// Mouse move › show coords
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const x_px = e.clientX - rect.left;
  const y_px = e.clientY - rect.top;
  const x_cm = (x_px / scale) * PDF_UNIT_TO_CM;
  const y_cm = (y_px / scale) * PDF_UNIT_TO_CM;
  coordsDiv.textContent = 
    `Coordinates: (${x_cm.toFixed(2)}cm,${y_cm.toFixed(2)}cm)`;
});

// Click › copy coords
canvas.addEventListener('click', () => {
  const match = coordsDiv.textContent.match(/\((.*?)\)/);
  if (!match) return;
  const txt = `(${match[1]})`;
  navigator.clipboard.writeText(txt).then(() => {
    alert(`Copied to clipboard:\n${txt}`);
  });
});

// Touch: swipe for page nav & pinch for zoom
let startX = null, startDist = null;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    startX = e.touches[0].clientX;
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    startDist = Math.hypot(dx, dy);
  }
});
canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && startDist) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const newDist = Math.hypot(dx, dy);
    const ratio = newDist / startDist;
    if (ratio > 1.1) {
      changeZoom(scale * 1.1);
      startDist = newDist;
    } else if (ratio < 0.9) {
      changeZoom(scale / 1.1);
      startDist = newDist;
    }
    e.preventDefault();
  }
});
canvas.addEventListener('touchend', e => {
  if (startX !== null && e.changedTouches.length === 1) {
    const deltaX = e.changedTouches[0].clientX - startX;
    if (deltaX > 50 && pageNum > 1) {
      pageNum--; renderPage(pageNum);
    } else if (deltaX < -50 && pageNum < pdfDoc.numPages) {
      pageNum++; renderPage(pageNum);
    }
  }
  startX = null; startDist = null;
});

// Drag & drop PDF onto canvas
canvas.addEventListener('dragover', e => {
  e.preventDefault();
  canvas.classList.add('dragover');
});
canvas.addEventListener('dragleave', e => {
  canvas.classList.remove('dragover');
});
canvas.addEventListener('drop', e => {
  e.preventDefault();
  canvas.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    const reader = new FileReader();
    reader.onload = () => loadPDF(new Uint8Array(reader.result));
    reader.readAsArrayBuffer(file);
  }
});

