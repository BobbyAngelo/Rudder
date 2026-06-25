/* =======================================================================
   Ingest | Core Document Parser.
   Handles plaintext, CSV, HTML, and lazily parses PDF, DOCX, and images.
   ======================================================================= */

export interface ParseResult {
  success: boolean;
  text?: string;
  error?: string;
  missingDependency?: string;
  installCommand?: string;
}

export async function parseFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParseResult> {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";

  try {
    // Handle standard flat-text formats natively
    if (
      mimeType === "text/plain" ||
      mimeType === "text/markdown" ||
      extension === "txt" ||
      extension === "md" ||
      extension === "markdown"
    ) {
      return {
        success: true,
        text: buffer.toString("utf-8")
      };
    }

    if (mimeType === "text/csv" || extension === "csv") {
      return {
        success: true,
        text: buffer.toString("utf-8")
      };
    }

    if (mimeType === "text/html" || extension === "html" || extension === "htm") {
      const rawHtml = buffer.toString("utf-8");
      // Basic tag stripping to extract search indexing content
      const cleanText = rawHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return {
        success: true,
        text: cleanText
      };
    }

    // Handle PDF with lazy dependency loading
    if (mimeType === "application/pdf" || extension === "pdf") {
      try {
        // @ts-ignore
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const data = await pdfParse(buffer);
        return {
          success: true,
          text: data.text || ""
        };
      } catch (err: any) {
        if (
          err.code === "MODULE_NOT_FOUND" ||
          err.message?.includes("Cannot find module") ||
          err.message?.includes("pdf-parse")
        ) {
          return {
            success: false,
            missingDependency: "pdf-parse",
            installCommand: "npm install pdf-parse",
            error: "PDF parser library is not installed."
          };
        }
        throw err;
      }
    }

    // Handle DOCX with lazy dependency loading
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      extension === "docx"
    ) {
      try {
        // @ts-ignore
        const mammothModule = await import("mammoth");
        const mammoth = mammothModule.default || mammothModule;
        const data = await mammoth.extractRawText({ buffer });
        return {
          success: true,
          text: data.value || ""
        };
      } catch (err: any) {
        if (
          err.code === "MODULE_NOT_FOUND" ||
          err.message?.includes("Cannot find module") ||
          err.message?.includes("mammoth")
        ) {
          return {
            success: false,
            missingDependency: "mammoth",
            installCommand: "npm install mammoth",
            error: "Word document parser library is not installed."
          };
        }
        throw err;
      }
    }

    // Handle Images with OCR (tesseract.js)
    if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(extension)) {
      try {
        // @ts-ignore
        const tesseractModule = await import("tesseract.js");
        const tesseract = tesseractModule.default || tesseractModule;
        const { recognize } = tesseract;
        const result = await recognize(buffer, "eng");
        return {
          success: true,
          text: result.data.text || ""
        };
      } catch (err: any) {
        if (
          err.code === "MODULE_NOT_FOUND" ||
          err.message?.includes("Cannot find module") ||
          err.message?.includes("tesseract.js")
        ) {
          return {
            success: false,
            missingDependency: "tesseract.js",
            installCommand: "npm install tesseract.js",
            error: "OCR text recognition library is not installed."
          };
        }
        throw err;
      }
    }

    return {
      success: false,
      error: `Unsupported file format: ${extension || mimeType}`
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to parse file."
    };
  }
}
