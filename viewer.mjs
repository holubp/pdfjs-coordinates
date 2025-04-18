/**
 * viewer.mjs
 *
 * A PDF.js-based viewer that:
 *  - Renders a PDF page on an HTML5 canvas
 *  - Tracks cursor X/Y in cm and shows a tooltip next to the crosshair
 *  - Copies "(X.XXcm,Y.XXcm)" on click if enabled
 *  - Supports prev/next page via buttons, arrow keys, or swipe
 *  - Supports zoom via dropdown or pinch
 *  - Supports drag & drop of a PDF onto the canvas
 *  - Supports Refreshing the current PDF file
 */

import * as pdfjsLib from './pdfjs/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.mjs';

// ----- DOM references -----
const fileInput     = document.getElementById('fileInput');
const prevBtn       = document.getElementById('prevPage');
const nextBtn       = document.getElementById('nextPage');
const refreshBtn    = document.getElementById('refreshBtn');
const zoomSelect    = document.getElementById('zoomSelect');
const autoCopyChk   = document.getElementById('autoCopy');
const pageIndicator = document.getElementById('pageIndicator');
const canvas        = document.getElementById('pdfCanvas');
const ctx           = canvas.getContext('2d');
const coordsDiv     = document.getElementById('coordinates');
const tooltip       = document.getElementById('tooltip');

// ----- State -----
let pdfDoc    = null;
let pdfData   = null;           // Uint8Array of current PDF
let pageNum   = 1;
let scale     = parseFloat(zoomSelect.value);
const PDF_UNIT_TO_CM = 0.0352778;  // 1 PDF pt = 1/72in = 0.0352778 cm

/**
 * Renders the given page number at the current scale.
 * @param {number} num - The page number to render.
 */
async function renderPage(num) {
  const page     = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale });

  // Resize canvas
  canvas.width  = viewport.width;
  canvas.height = viewport.height;

  // Draw page
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Update page indicator
  pageIndicator.textContent = `Page ${pageNum} / ${pdfDoc.numPages}`;
}

/**
 * Updates zoom and re-renders.
 * @param {number} newScale
 */
function changeZoom(newScale) {
  scale = newScale;
  renderPage(pageNum);
}

/**
 * Loads (or reloads) a PDF from ArrayBuffer data and renders.
 * If initial load, resets to page 1; if reload, preserves pageNum.
 * @param {Uint8Array} data
 * @param {boolean} preservePage - true to keep current pageNum, false to reset to 1
 */
function loadPDF(data, preservePage = false) {
  pdfjsLib.getDocument(data).promise.then(doc => {
    pdfDoc = doc;
    if (!preservePage) pageNum = 1;
    renderPage(pageNum);
  });
}

// ----- Event Listeners -----

// File input › initial load
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file || file.type !== 'application/pdf') return;
  const reader = new FileReader();
  reader.onload = () => {
    pdfData = new Uint8Array(reader.result);
    loadPDF(pdfData, false);
  };
  reader.readAsArrayBuffer(file);
});

// Prev/Next buttons
prevBtn.addEventListener('click', () => {
  if (pageNum > 1) {
    pageNum--;
    renderPage(pageNum);
  }
});
nextBtn.addEventListener('click', () => {
  if (pdfDoc && pageNum < pdfDoc.numPages) {
    pageNum++;
    renderPage(pageNum);
  }
});

// Refresh button › reload same file & preserve pageNum
refreshBtn.addEventListener('click', () => {
  if (pdfData) {
    loadPDF(pdfData, true);
  }
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

// Mouse move › show coords & tooltip
canvas.addEventListener('mousemove', e => {
  const rect   = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const x_cm   = (mouseX / scale) * PDF_UNIT_TO_CM;
  const y_cm   = (mouseY / scale) * PDF_UNIT_TO_CM;
  const coordText = `(${x_cm.toFixed(2)}cm,${y_cm.toFixed(2)}cm)`;

  // Update bottom coords
  coordsDiv.textContent = `Coordinates: ${coordText}`;

  // Show tooltip
  tooltip.textContent   = coordText;
  tooltip.style.display = 'block';

  // Tooltip sizing & positioning (stays in canvas)
  const ttW    = tooltip.offsetWidth;
  const ttH    = tooltip.offsetHeight;
  const margin = 5;
  const offset = 12;

  let left = mouseX + offset;
  if (left + ttW + margin > canvas.width) {
    left = mouseX - ttW - offset;
    if (left < margin) left = margin;
  }

  let top = mouseY + offset;
  if (top + ttH + margin > canvas.height) {
    top = mouseY - ttH - offset;
    if (top < margin) top = margin;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top  = `${top}px`;
});

// Hide tooltip on leave
canvas.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none';
});

// Click › copy coords if checkbox is checked
canvas.addEventListener('click', () => {
  if (!autoCopyChk.checked) return;
  const txt = tooltip.textContent;
  if (!txt) return;
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
canvas.addEventListener('dragleave', () => {
  canvas.classList.remove('dragover');
});
canvas.addEventListener('drop', e => {
  e.preventDefault();
  canvas.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    const reader = new FileReader();
    reader.onload = () => {
      pdfData = new Uint8Array(reader.result);
      loadPDF(pdfData, false);
    };
    reader.readAsArrayBuffer(file);
  }
});

