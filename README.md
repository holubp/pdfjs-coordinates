# pdfjs-coordinates

A PDFjs based viewer that allows copying coordinates in cm on the page wherever you click - useful for positioning LaTeX TikZ elements on the page.

# PDF.js Cursor Coordinates Viewer

A lightweight browser-based PDF viewer using PDF.js (ES Modules) that:

- Renders PDF pages on an HTML5 `<canvas>`
- Tracks cursor X/Y in **centimeters** and copies `(X.XXcm,Y.YYcm)` format
- Navigates pages via **Prev/Next** buttons, **‹/›** keys, or **swipe** gestures
- Zooms in/out via **pinch** (touch) or **dropdown menu**
- Supports **drag & drop** of a PDF onto the canvas

---

## Project Structure

```
pdfjs-coordinates/
+¦¦ index.html         ‹ main HTML
+¦¦ viewer.mjs         ‹ ES module with all logic
+¦¦ README.md          ‹ this file
L¦¦ pdfjs/
    +¦¦ pdf.mjs        ‹ PDF.js ES Module (v4.x+)
    L¦¦ pdf.worker.mjs ‹ PDF.js Worker Module
```

> **Note:** Download `pdf.mjs` and `pdf.worker.mjs` from the [PDF.js Releases page](https://github.com/mozilla/pdf.js/releases) (v4.x or newer).

---

## Prerequisites

- A modern browser with ES Module support.
- A simple HTTP server (browser security won’t allow ES Modules over `file://`).

Example (Python):

```bash
cd pdfjs-coordinates
python -m http.server 8000
```

Open your browser and navigate to [http://localhost:8000](http://localhost:8000).

---

## Usage

1. **Load or Drop**  
   - Click **“Choose File”** to open a PDF, or  
   - **Drag & drop** a PDF file onto the dashed canvas border.

2. **Navigate Pages**  
   - **Prev/Next** buttons  
   - Keyboard **‹ / ›**  
   - **Swipe** left/right (touch devices)

3. **Zoom**  
   - **Dropdown** select (50%–300%)  
   - **Pinch** gesture (touch devices)

4. **Coordinates**  
   - Move the mouse over the PDF to see `(X.XXcm,Y.XXcm)` at the bottom.  
   - Click the canvas to copy that exact string to your clipboard.

---

## How to use it in TikZ

This is how you can use the resulting coordinates:

```
\begin{tikzpicture}[remember picture,overlay,
	yscale=-1, shift={(current page.north west)},
    ]
    \node at (4cm,9.77cm) {test};
\end{tikzpicture}
```


## License

Apache License

