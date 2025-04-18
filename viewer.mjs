import * as pdfjsLib from './pdfjs/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.mjs';

const fileInput = document.getElementById('fileInput');
const pdfCanvas = document.getElementById('pdfCanvas');
const ctx = pdfCanvas.getContext('2d');
const coordinatesDiv = document.getElementById('coordinates');
const zoomSelect = document.getElementById('zoomSelect');
const pageIndicator = document.getElementById('pageIndicator');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');

let pdfDoc = null;
let scale = 1.5;
let pageNum = 1;

const PDF_UNIT_TO_CM = 0.0352778;

function renderPage(num) {
  pdfDoc.getPage(num).then(page => {
    const viewport = page.getViewport({ scale });
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };
    page.render(renderContext);

    pageIndicator.textContent = `Page ${pageNum} / ${pdfDoc.numPages}`;

    pdfCanvas.onmousemove = (event) => {
      const rect = pdfCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const x_cm = (x / scale) * PDF_UNIT_TO_CM;
      const y_cm = (y / scale) * PDF_UNIT_TO_CM;
      coordinatesDiv.textContent = `Coordinates: (${x_cm.toFixed(2)}cm,${y_cm.toFixed(2)}cm)`;
    };

    pdfCanvas.onclick = () => {
      const text = coordinatesDiv.textContent.match(/\((.*?)\)/)?.[1];
      if (text) {
        navigator.clipboard.writeText(`(${text})`).then(() => {
          alert(`Copied: (${text})`);
        });
      }
    };
  });
}

function changeZoom(newScale) {
  scale = newScale;
  renderPage(pageNum);
}

function loadPDF(data) {
  pdfjsLib.getDocument(data).promise.then(doc => {
    pdfDoc = doc;
    pageNum = 1;
    renderPage(pageNum);
  });
}

fileInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file || file.type !== 'application/pdf') return;

  const reader = new FileReader();
  reader.onload = function () {
    const typedarray = new Uint8Array(this.result);
    loadPDF(typedarray);
  };
  reader.readAsArrayBuffer(file);
};

zoomSelect.addEventListener('change', () => {
  changeZoom(parseFloat(zoomSelect.value));
});

prevBtn.onclick = () => {
  if (pageNum > 1) {
    pageNum--;
    renderPage(pageNum);
  }
};

nextBtn.onclick = () => {
  if (pageNum < pdfDoc.numPages) {
    pageNum++;
    renderPage(pageNum);
  }
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' && pageNum < pdfDoc.numPages) {
    pageNum++;
    renderPage(pageNum);
  } else if (e.key === 'ArrowLeft' && pageNum > 1) {
    pageNum--;
    renderPage(pageNum);
  }
});

// Touch: swipe + pinch
let startX = null;
let startDist = null;

pdfCanvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    startX = e.touches[0].clientX;
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    startDist = Math.sqrt(dx * dx + dy * dy);
  }
});

pdfCanvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const newDist = Math.sqrt(dx * dx + dy * dy);
    if (startDist) {
      const ratio = newDist / startDist;
      if (ratio > 1.1) {
        changeZoom(scale * 1.1);
        startDist = newDist;
      } else if (ratio < 0.9) {
        changeZoom(scale / 1.1);
        startDist = newDist;
      }
    }
    e.preventDefault();
  }
});

pdfCanvas.addEventListener('touchend', (e) => {
  if (e.changedTouches.length === 1 && startX !== null) {
    const deltaX = e.changedTouches[0].clientX - startX;
    if (deltaX > 50 && pageNum > 1) {
      pageNum--;
      renderPage(pageNum);
    } else if (deltaX < -50 && pageNum < pdfDoc.numPages) {
      pageNum++;
      renderPage(pageNum);
    }
  }
  startX = null;
  startDist = null;
});

