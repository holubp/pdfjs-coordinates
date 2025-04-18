const fileInput = document.getElementById('fileInput');
const pdfCanvas = document.getElementById('pdfCanvas');
const ctx = pdfCanvas.getContext('2d');
const coordinatesDiv = document.getElementById('coordinates');

let pdfDoc = null;
let scale = 1.5; // Zoom level (adjustable)
let pageRendering = false;
let pageNum = 1;

// PDF units: 1 unit = 1/72 inch = 0.3527 mm = 0.03527 cm
const PDF_UNIT_TO_CM = 0.0352778;

// Render the page
function renderPage(num) {
    pageRendering = true;
    pdfDoc.getPage(num).then(page => {
        const viewport = page.getViewport({ scale: scale });
        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        page.render(renderContext).promise.then(() => {
            pageRendering = false;
        });

        pdfCanvas.onmousemove = (event) => {
            const rect = pdfCanvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const x_pdf = (x / scale) * PDF_UNIT_TO_CM;
            const y_pdf = (y / scale) * PDF_UNIT_TO_CM;

            coordinatesDiv.textContent = `Coordinates: (${x_pdf.toFixed(2)}cm, ${y_pdf.toFixed(2)}cm)`;
        };

        pdfCanvas.onclick = () => {
            const coordText = coordinatesDiv.textContent.replace('Coordinates: ', '');
            navigator.clipboard.writeText(coordText).then(() => {
                alert(`Copied to clipboard:\n${coordText}`);
            });
        };
    });
}

// Load PDF from file input
fileInput.onchange = (event) => {
    const file = event.target.files[0];
    if (file.type !== 'application/pdf') {
        alert('Please select a PDF file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function () {
        const typedarray = new Uint8Array(this.result);
        pdfjsLib.getDocument(typedarray).promise.then(pdfDoc_ => {
            pdfDoc = pdfDoc_;
            pageNum = 1;
            renderPage(pageNum);
        });
    };
    reader.readAsArrayBuffer(file);
};

