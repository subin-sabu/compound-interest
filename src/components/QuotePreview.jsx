import { useState } from "react";
import jsPDF from "jspdf";

function formatCurrency(value) {
  return Number(value).toLocaleString("en-IN");
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/*
 * Loads an image and returns it as a base64 PNG data URL so it can be
 * embedded directly into the PDF with pdf.addImage(). Using a canvas
 * (rather than fetch + FileReader) keeps this working the same way
 * whether the image is same-origin or served with CORS headers.
 */
function loadImageAsDataURL(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () =>
      reject(new Error(`Failed to load template image: ${src}`));
    img.src = src;
  });
}

/*
 * jsPDF's setFontSize() always takes POINTS, even when the document's
 * coordinate unit is "px". Our layout coordinates (x/y/width) below are
 * plain CSS px at 96 DPI, matching the on-screen preview. To make a
 * font-size value declared in px actually come out the right visual
 * size in the PDF, it has to be converted to pt first:
 *   96 px = 1 inch = 72 pt  =>  1 px = 0.75 pt
 */
const PX_TO_PT = 72 / 96;

/*
 * jsPDF's built-in "standard 14" fonts (Helvetica, Times, Courier) only
 * support the WinAnsi character set — the Rupee sign (\u20B9) isn't in
 * it. When jsPDF meets a glyph it can't map, it falls back to drawing
 * the raw character code instead, which shows up as a stray little
 * digit next to the ₹ symbol (looks like a superscript). The on-screen
 * preview never shows this because the browser's font rendering has
 * full Unicode coverage — only the PDF's built-in font doesn't.
 *
 * Swapping ₹ for "Rs. " here (PDF output only, preview keeps the real
 * symbol) sidesteps the issue without needing to embed a custom
 * Unicode-capable TTF font into the PDF.
 */
function sanitizeForPdf(text) {
  return String(text).replace(/\u20B9/g, "Rs. ");
}

/* ============================================================
   TEMPLATE REGISTRY

   This is the single source of truth for where every dynamic value
   sits on a given background image. Both the on-screen preview and
   the PDF export read from the same config, so they can never drift
   apart the way hand-duplicated JSX + html2canvas output did.

   To support a new quote layout in future, add another key here
   (e.g. "compact") with its own image/dimensions/fields/table, then
   pass templateId="compact" (or quote.templateId) into <QuotePreview>.
============================================================ */
const TEMPLATES = {
  default: {
    id: "default",
    image: "/investment-template.png",
    width: 1024,
    height: 1536,
    fields: [
      {
        id: "pt-header",
        x: 265,
        width: 50,
        y: 74,
        fontSize: 48,
        fontWeight: "bold",
        color: "#10458E",
        align: "center",
        value: (q) => String(q.ppt),
      },
      {
        id: "maturity-header",
        x: 174,
        y: 126,
        fontSize: 48,
        fontWeight: "bold",
        color: "#E3262E",
        align: "left",
        value: (q) => formatCurrency(q.maturity),
      },
      {
        id: "premium",
        x: 39,
        width: 218,
        y: 375,
        fontSize: 25,
        fontWeight: "bold",
        color: "#064596",
        align: "center",
        value: (q) => `\u20B9${formatCurrency(q.premium)}`,
      },
      {
        id: "ppt",
        x: 284,
        width: 220,
        y: 375,
        fontSize: 25,
        fontWeight: "bold",
        color: "#064596",
        align: "center",
        value: (q) => `${q.ppt} Years`,
      },
      {
        id: "pt-table-header",
        x: 529,
        width: 220,
        y: 375,
        fontSize: 25,
        fontWeight: "bold",
        color: "#064596",
        align: "center",
        value: (q) => `${q.pt} Years`,
      },
      {
        id: "cagr",
        x: 774,
        width: 210,
        y: 375,
        fontSize: 25,
        fontWeight: "bold",
        color: "#064596",
        align: "center",
        value: (q) => `${q.cagr}%`,
      },
    ],
    table: {
      x: 39,
      y: 486,
      width: 945,
      headerHeight: 32,
      rowHeight: 28,
      headerBg: "#064596",
      headerColor: "#ffffff",
      headerFontSize: 19,
      bodyFontSize: 19,
      bodyColor: "#111111",
      borderColor: "#D8DFE8",
      columns: [
        { key: "Year", label: "Year", width: 115, format: (v) => String(v) },
        {
          key: "Investment",
          label: "Investment (\u20B9)",
          width: 337,
          format: formatCurrency,
        },
        {
          key: "FundValue",
          label: "Fund Value at the End of Year (\u20B9)",
          width: 493,
          format: formatCurrency,
        },
      ],
    },
  },

  // Example of how a second layout would slot in later — fill in the
  // real coordinates once you have the template image measured out:
  //
  // compact: {
  //   id: "compact",
  //   image: "/investment-template-compact.png",
  //   width: 1024,
  //   height: 1200,
  //   fields: [ /* ... */ ],
  //   table: { /* ... */ },
  // },
};

/* ============================================================
   ON-SCREEN PREVIEW (reads the same TEMPLATES config as the PDF)
============================================================ */
function TemplateField({ field, quote }) {
  const style = {
    position: "absolute",
    left: field.x,
    top: field.y,
    width: field.width || "auto",
    fontSize: field.fontSize,
    fontWeight: field.fontWeight === "bold" ? 800 : 400,
    color: field.color,
    lineHeight: `${field.fontSize}px`,
    whiteSpace: "nowrap",
    display: field.width ? "flex" : "block",
    justifyContent: field.width ? "center" : undefined,
    textAlign: field.align,
  };

  return <div style={style}>{field.value(quote)}</div>;
}

function TemplateTable({ table, data }) {
  const gridTemplateColumns = table.columns
    .map((c) => `${c.width}px`)
    .join(" ");

  return (
    <div
      style={{
        position: "absolute",
        left: table.x,
        top: table.y,
        width: table.width,
        fontWeight: 600,
        lineHeight: 1,
        color: table.bodyColor,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns,
          height: table.headerHeight,
          alignItems: "center",
          background: table.headerBg,
          color: table.headerColor,
          fontWeight: 700,
          fontSize: table.headerFontSize,
          textAlign: "center",
        }}
      >
        {table.columns.map((col) => (
          <div key={col.key}>{col.label}</div>
        ))}
      </div>

      {data.map((row) => (
        <div
          key={row.Year}
          style={{
            display: "grid",
            gridTemplateColumns,
            height: table.rowHeight,
            alignItems: "center",
            background: "#ffffff",
            borderLeft: `1px solid ${table.borderColor}`,
            borderRight: `1px solid ${table.borderColor}`,
            borderBottom: `1px solid ${table.borderColor}`,
            textAlign: "center",
            fontSize: table.bodyFontSize,
          }}
        >
          {table.columns.map((col, i) => (
            <div
              key={col.key}
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRight:
                  i < table.columns.length - 1
                    ? `1px solid ${table.borderColor}`
                    : "none",
              }}
            >
              {col.format(row[col.key])}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   PDF GENERATION

   Draws the background image and then every field/table cell using
   jsPDF's own native text and vector APIs. Nothing here is rasterized
   from the DOM, so there is no browser-layout-vs-canvas-layout
   mismatch — jsPDF is the only engine involved, and it lays out the
   same field list the preview renders, from the same coordinates.
============================================================ */
async function generateQuotePDF(quote, template) {
  const bgDataUrl = await loadImageAsDataURL(template.image);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [template.width, template.height],
    compress: true,
    hotfixes: ["px_scaling"],
  });

  pdf.addImage(bgDataUrl, "PNG", 0, 0, template.width, template.height);

  template.fields.forEach((field) => {
    const { r, g, b } = hexToRgb(field.color);
    pdf.setFont("helvetica", field.fontWeight === "bold" ? "bold" : "normal");
    pdf.setFontSize(field.fontSize * PX_TO_PT);
    pdf.setTextColor(r, g, b);

    const text = sanitizeForPdf(field.value(quote));

    if (field.align === "center" && field.width) {
      pdf.text(text, field.x + field.width / 2, field.y, {
        align: "center",
        baseline: "top",
      });
    } else {
      pdf.text(text, field.x, field.y, {
        align: "left",
        baseline: "top",
      });
    }
  });

  drawTable(pdf, template.table, quote.data);

  pdf.save(`invest-${quote.premium}-${quote.ppt}ppt-${quote.pt}pt.pdf`);
}

function drawTable(pdf, table, data) {
  let cursorY = table.y;

  // Header background
  const headerBg = hexToRgb(table.headerBg);
  pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
  pdf.rect(table.x, cursorY, table.width, table.headerHeight, "F");

  // Header text
  const headerText = hexToRgb(table.headerColor);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(table.headerFontSize * PX_TO_PT);
  pdf.setTextColor(headerText.r, headerText.g, headerText.b);

  let colX = table.x;
  table.columns.forEach((col) => {
    pdf.text(
      sanitizeForPdf(col.label),
      colX + col.width / 2,
      cursorY + table.headerHeight / 2,
      { align: "center", baseline: "middle" }
    );
    colX += col.width;
  });

  cursorY += table.headerHeight;

  // Body rows
  const border = hexToRgb(table.borderColor);
  const body = hexToRgb(table.bodyColor);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(table.bodyFontSize * PX_TO_PT);
  pdf.setTextColor(body.r, body.g, body.b);
  pdf.setDrawColor(border.r, border.g, border.b);
  pdf.setLineWidth(1);

  data.forEach((row) => {
    // Row border box
    pdf.rect(table.x, cursorY, table.width, table.rowHeight);

    colX = table.x;
    table.columns.forEach((col, i) => {
      // Vertical column separators (skip the leading edge, box already drew it)
      if (i > 0) {
        pdf.line(colX, cursorY, colX, cursorY + table.rowHeight);
      }

      pdf.text(
        sanitizeForPdf(col.format(row[col.key])),
        colX + col.width / 2,
        cursorY + table.rowHeight / 2,
        { align: "center", baseline: "middle" }
      );

      colX += col.width;
    });

    cursorY += table.rowHeight;
  });
}

/* ============================================================
   COMPONENT
============================================================ */
function QuotePreview({ quote, onBack }) {
  const [downloading, setDownloading] = useState(false);

  if (!quote) {
    return null;
  }

  const template = TEMPLATES[quote.templateId || "default"];

  if (!template) {
    console.error(`Unknown template id: ${quote.templateId}`);
    return (
      <div className="text-red-600">
        Unknown quote template: {quote.templateId}
      </div>
    );
  }

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await generateQuotePDF(quote, template);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Unable to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center">
      {/* ACTION BAR */}
      <div className="mb-6 flex w-full max-w-6xl items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          ← Edit Quote
        </button>

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="rounded-lg bg-blue-700 px-6 py-2.5 font-semibold text-white shadow-md transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {downloading ? "Generating PDF..." : "Download Quote PDF"}
        </button>
      </div>

      {/* PREVIEW CONTAINER */}
      <div className="w-full overflow-auto rounded-xl bg-gray-300 p-5 shadow-inner">
        <div className="flex min-w-max justify-center">
          <div
            className="relative shrink-0 overflow-hidden bg-white font-[Arial,Helvetica,sans-serif]"
            style={{ width: template.width, height: template.height }}
          >
            <img
              src={template.image}
              alt=""
              crossOrigin="anonymous"
              className="absolute inset-0 h-full w-full object-fill"
            />

            {template.fields.map((field) => (
              <TemplateField key={field.id} field={field} quote={quote} />
            ))}

            <TemplateTable table={template.table} data={quote.data} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuotePreview;
