# pdfjs-coordinates

A PDFjs based viewer that allows copying coordinates in cm on the page wherever you click - useful for positioning TikZ elements on the page.

This is how you can use the resulting coordinates:

```
\begin{tikzpicture}[remember picture,overlay,
	yscale=-1, shift={(current page.north west)},
    ]
    \node at (4cm,9.77cm) {test};
\end{tikzpicture}
```

## How to install and run

* Unpack repo into a folder
* Run ```python -m http.server 8000``` from that folder
* Connect to [http://localhost:8000/](http://localhost:8000/)
* Upload your PDF and keep clicking :)
