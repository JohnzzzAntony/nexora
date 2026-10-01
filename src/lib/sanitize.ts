import sanitize from "sanitize-html";

// Allow-list for user rich text (tickets, comments, knowledge articles).
const OPTIONS: sanitize.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "code", "pre", "h1", "h2", "h3", "h4", "hr", "img", "span", "table", "thead", "tbody", "tr", "th", "td"],
  allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt", "width", "height"], span: ["data-type", "data-id", "data-label", "class"], code: ["class"], pre: ["class"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["https", "http"] },
  transformTags: { a: sanitize.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }) },
};

export const sanitizeHtml = (html: string) => sanitize(html ?? "", OPTIONS).trim();

/** Plain text → safe HTML paragraphs (used for inbound email and API plain-text bodies). */
export const textToHtml = (text: string) =>
  text.split(/\n{2,}/).map(p => `<p>${sanitize(p, { allowedTags: [], allowedAttributes: {} }).replace(/\n/g, "<br>")}</p>`).join("");

export const stripHtml = (html: string) => sanitize(html ?? "", { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
