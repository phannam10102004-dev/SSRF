const cheerio = require("cheerio");

/**
 * Parse HTML và extract Open Graph metadata và các metadata khác
 */
function parseMetadata(html, url) {
  const $ = cheerio.load(html);
  const metadata = {
    url: url,
    title: "",
    description: "",
    image: "",
    siteName: "",
    type: "website",
  };

  // Open Graph tags (ưu tiên)
  metadata.title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("title").text() ||
    "";

  metadata.description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";

  metadata.image =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $('meta[name="twitter:image:src"]').attr("content") ||
    "";

  metadata.siteName =
    $('meta[property="og:site_name"]').attr("content") || new URL(url).hostname;

  metadata.type = $('meta[property="og:type"]').attr("content") || "website";

  // Nếu image là relative URL, convert thành absolute
  if (metadata.image && !metadata.image.startsWith("http")) {
    try {
      const baseUrl = new URL(url);
      metadata.image = new URL(metadata.image, baseUrl).href;
    } catch (e) {
      // Ignore
    }
  }

  return metadata;
}

module.exports = { parseMetadata };
