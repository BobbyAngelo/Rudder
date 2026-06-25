/* =======================================================================
   Ingest | vCard (.vcf) parser.
   Parses contact details from standard vCard files.
   ======================================================================= */

import { readFileSync } from "fs";

export interface ParsedContact {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  website: string | null;
  address: string | null;
  linkedin: string | null;
  notes: string;
}

function unescapeVCard(val: string): string {
  return val
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

export function parseVCF(content: string): ParsedContact[] {
  const rawLines = content.split(/\r?\n/);
  const lines: string[] = [];

  // Unfold folded lines
  for (const line of rawLines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      }
    } else {
      lines.push(line);
    }
  }

  const contacts: ParsedContact[] = [];
  let name = "";
  let structureName = "";
  let company = "";
  let role = "";
  const emails: string[] = [];
  const phones: string[] = [];
  const websites: string[] = [];
  const addresses: string[] = [];
  let linkedin: string | null = null;
  const notesList: string[] = [];
  let inCard = false;

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const rawKey = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    // Remove group prefixes (e.g. item1.EMAIL -> EMAIL)
    let keyPart = rawKey.split(";")[0].toUpperCase();
    if (keyPart.includes(".")) {
      keyPart = keyPart.slice(keyPart.indexOf(".") + 1);
    }

    if (keyPart === "BEGIN" && value.toUpperCase() === "VCARD") {
      name = "";
      structureName = "";
      company = "";
      role = "";
      emails.length = 0;
      phones.length = 0;
      websites.length = 0;
      addresses.length = 0;
      linkedin = null;
      notesList.length = 0;
      inCard = true;
      continue;
    }

    if (keyPart === "END" && value.toUpperCase() === "VCARD") {
      if (inCard) {
        const finalName = name || structureName.replace(/;/g, " ").replace(/\s+/g, " ").trim() || "Unknown Contact";
        contacts.push({
          name: finalName,
          email: emails[0] || null,
          phone: phones[0] || null,
          company: company || null,
          role: role || null,
          website: websites[0] || null,
          address: addresses[0] || null,
          linkedin,
          notes: notesList.join("\n").trim()
        });
      }
      inCard = false;
      continue;
    }

    if (inCard) {
      const cleanVal = unescapeVCard(value);
      if (!cleanVal) continue;

      switch (keyPart) {
        case "FN":
          name = cleanVal;
          break;
        case "N":
          structureName = cleanVal;
          break;
        case "ORG": {
          // ORG can contain sub-units separated by semicolon. Take first one.
          const parts = cleanVal.split(";");
          company = parts[0].trim();
          break;
        }
        case "TITLE":
          role = cleanVal;
          break;
        case "EMAIL":
          emails.push(cleanVal);
          break;
        case "TEL":
          phones.push(cleanVal);
          break;
        case "URL":
          if (cleanVal.toLowerCase().includes("linkedin.com")) {
            linkedin = cleanVal;
          } else {
            websites.push(cleanVal);
          }
          break;
        case "X-SOCIALPROFILE":
          if (cleanVal.toLowerCase().includes("linkedin.com") || rawKey.toLowerCase().includes("linkedin")) {
            linkedin = cleanVal;
          }
          break;
        case "ADR": {
          // ADR is structured: PO Box; Extended Addr; Street; Locality; Region; Postal Code; Country
          const parts = cleanVal.split(";").map(p => p.trim()).filter(Boolean);
          if (parts.length) {
            addresses.push(parts.join(", "));
          }
          break;
        }
        case "NOTE":
          notesList.push(cleanVal);
          break;
      }
    }
  }

  return contacts;
}

export function readVCFFile(filePath: string): ParsedContact[] {
  const content = readFileSync(filePath, "utf-8");
  return parseVCF(content);
}
