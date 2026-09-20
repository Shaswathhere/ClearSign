/**
 * lib/pdf.ts
 * Client-side PDF text extraction using pdfjs-dist.
 * The PDF is processed entirely in the browser memory and never uploaded.
 */

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  // Configure worker src dynamically
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const numPages = pdf.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item: unknown) => {
        if (typeof item === "object" && item !== null && "str" in item) {
          const s = (item as { str?: string }).str;
          return typeof s === "string" ? s : "";
        }
        return "";
      })
      .filter(Boolean);
    pageTexts.push(strings.join(" "));
  }

  return pageTexts.join("\n\n");
}
