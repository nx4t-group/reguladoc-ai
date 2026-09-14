import zlib from "node:zlib";

function decodeAscii85(str: string): Buffer {
  const s = str.replace(/<~|~>/g, "").replace(/\s+/g, "");
  const out: number[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === "z") {
      out.push(0, 0, 0, 0);
      i++;
      continue;
    }
    let count = 0;
    let val = 0;
    for (let j = 0; j < 5; j++) {
      if (i + j < s.length) {
        val = val * 85 + (s.charCodeAt(i + j) - 33);
        count++;
      } else {
        val = val * 85 + 84;
      }
    }
    const b1 = (val >>> 24) & 255;
    const b2 = (val >>> 16) & 255;
    const b3 = (val >>> 8) & 255;
    const b4 = val & 255;
    if (count >= 2) out.push(b1);
    if (count >= 3) out.push(b2);
    if (count >= 4) out.push(b3);
    if (count >= 5) out.push(b4);
    i += count;
  }
  return Buffer.from(out);
}

function unescapePdfText(text: string): string {
  // Converte octais \315 -> caracter latin1
  const replaced = text
    .replace(/\\([0-7]{3})/g, (_, oct) => {
      const charCode = parseInt(oct, 8);
      return Buffer.from([charCode]).toString("latin1");
    })
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");

  // Se tiver sequência UTF-8 mal interpretada, tenta decodificar
  try {
    const bytes = Buffer.from(replaced, "binary");
    const utf8 = bytes.toString("utf-8");
    if (!utf8.includes("")) return utf8;
  } catch {
    // fallback
  }
  return replaced;
}

export function extractPdfText(buffer: Buffer): string[] {
  const content = buffer.toString("latin1");
  const pages: string[] = [];

  // Localiza todos os streams
  const streamRegex = /(<<[\s\S]*?>>\s*)?stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(content)) !== null) {
    const dict = match[1] || "";
    const rawStream = match[2];

    let decompressed: Buffer | null = null;

    if (dict.includes("ASCII85Decode") && dict.includes("FlateDecode")) {
      try {
        const a85 = decodeAscii85(rawStream);
        decompressed = zlib.inflateSync(a85);
      } catch {
        // ignora
      }
    } else if (dict.includes("FlateDecode")) {
      try {
        decompressed = zlib.inflateSync(Buffer.from(rawStream, "latin1"));
      } catch {
        // ignora
      }
    } else if (dict.includes("ASCII85Decode")) {
      try {
        decompressed = decodeAscii85(rawStream);
      } catch {
        // ignora
      }
    } else {
      decompressed = Buffer.from(rawStream, "latin1");
    }

    if (!decompressed) continue;

    const streamStr = decompressed.toString("latin1");

    // Extrai textos via operadores Tj, TJ e '
    const texts: string[] = [];

    // Operador Tj: (string) Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = tjRegex.exec(streamStr)) !== null) {
      texts.push(unescapePdfText(m[1]));
    }

    // Operador TJ: [(string) 120 (string)] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = tjArrayRegex.exec(streamStr)) !== null) {
      const innerTj = /\(([^)]*)\)/g;
      let im: RegExpExecArray | null;
      let combined = "";
      while ((im = innerTj.exec(m[1])) !== null) {
        combined += unescapePdfText(im[1]);
      }
      if (combined.trim()) texts.push(combined);
    }

    if (texts.length > 0) {
      pages.push(texts.join(" | "));
    }
  }

  return pages;
}
