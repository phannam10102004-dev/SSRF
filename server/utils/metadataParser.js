const cheerio = require("cheerio");

/**
 * Kiểm tra và extract video ID từ YouTube URL
 * Hỗ trợ các format:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 */
function extractYouTubeVideoId(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Kiểm tra có phải YouTube domain không
    if (!hostname.includes("youtube.com") && !hostname.includes("youtu.be")) {
      return null;
    }

    // Format: youtube.com/watch?v=VIDEO_ID hoặc youtu.be/VIDEO_ID
    if (hostname.includes("youtu.be")) {
      return urlObj.pathname.slice(1); // Bỏ dấu / đầu tiên
    }

    // Format: youtube.com/watch?v=VIDEO_ID
    if (urlObj.pathname === "/watch" && urlObj.searchParams.has("v")) {
      return urlObj.searchParams.get("v");
    }

    // Format: youtube.com/embed/VIDEO_ID
    if (urlObj.pathname.startsWith("/embed/")) {
      return urlObj.pathname.slice(7); // Bỏ "/embed/"
    }

    // Format: youtube.com/v/VIDEO_ID
    if (urlObj.pathname.startsWith("/v/")) {
      return urlObj.pathname.slice(3); // Bỏ "/v/"
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Tạo YouTube metadata từ video ID
 */
function createYouTubeMetadata(videoId, originalUrl) {
  return {
    url: originalUrl,
    title: "YouTube Video",
    description: "Video trên YouTube",
    image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    siteName: "YouTube",
    type: "video",
    videoId: videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    isYouTube: true,
  };
}

/**
 * Parse HTML và extract Open Graph metadata và các metadata khác
 */
function parseMetadata(html, url) {
  // Kiểm tra YouTube trước
  const videoId = extractYouTubeVideoId(url);
  if (videoId) {
    const metadata = createYouTubeMetadata(videoId, url);
    // Thử parse thêm thông tin từ HTML nếu có
    try {
      const $ = cheerio.load(html);
      const ogTitle = $('meta[property="og:title"]').attr("content");
      const ogDescription = $('meta[property="og:description"]').attr(
        "content"
      );
      const ogImage = $('meta[property="og:image"]').attr("content");

      if (ogTitle) metadata.title = ogTitle;
      if (ogDescription) metadata.description = ogDescription;
      if (ogImage) metadata.image = ogImage;
    } catch (e) {
      // Ignore, dùng default metadata
    }
    return metadata;
  }

  // Parse HTML thông thường
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

module.exports = {
  parseMetadata,
  extractYouTubeVideoId,
  createYouTubeMetadata,
};
