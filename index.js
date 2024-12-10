const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json());

async function extractMetadata(url) {
  try {
    // More comprehensive headers to mimic a real browser
    const response = await axios.get(url, {
      timeout: 10000, // increased timeout to 10 seconds
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "sec-ch-ua": '"Google Chrome";v="91", "Chromium";v="91"',
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1"
      },
      maxContentLength: 5 * 1024 * 1024,
      validateStatus: function (status) {
        return status >= 200 && status < 300; // default
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Initialize metadata object
    const metadata = {
      url: url,
      title: "",
      description: "",
      image: "",
      siteName: ""
    };

    // Enhanced metadata extraction with more fallbacks
    metadata.title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $('meta[name="title"]').attr("content") ||
      $("title").text() ||
      $("h1").first().text();

    metadata.description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      $('meta[itemprop="description"]').attr("content");

    metadata.image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[property="og:image:url"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[name="twitter:image:src"]').attr("content") ||
      $('meta[itemprop="image"]').attr("content");

    metadata.siteName =
      $('meta[property="og:site_name"]').attr("content") ||
      $('meta[name="application-name"]').attr("content") ||
      new URL(url).hostname;

    // Special handling for YouTube URLs
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const videoId = extractYouTubeVideoId(url);
      if (videoId) {
        // Use YouTube oEmbed API
        const youtubeData = await axios.get(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        metadata.title = youtubeData.data.title;
        metadata.image = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        metadata.description =
          metadata.description || youtubeData.data.author_name;
        metadata.siteName = "YouTube";
      }
    }

    // Clean up the data
    Object.keys(metadata).forEach((key) => {
      metadata[key] = metadata[key] || "";
      metadata[key] = metadata[key].trim();

      // Convert relative URLs to absolute URLs
      if (
        key === "image" &&
        metadata[key] &&
        !metadata[key].startsWith("http")
      ) {
        const baseUrl = new URL(url);
        metadata[key] = metadata[key].startsWith("/")
          ? `${baseUrl.protocol}//${baseUrl.host}${metadata[key]}`
          : `${baseUrl.protocol}//${baseUrl.host}/${metadata[key]}`;
      }
    });

    return metadata;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        throw new Error("Request timeout");
      }
      if (error.response) {
        throw new Error(
          `Failed to fetch URL: ${error.response.status} ${error.response.statusText}`
        );
      }
      throw new Error(`Network error: ${error.message}`);
    }
    throw new Error(`Failed to extract metadata: ${error.message}`);
  }
}

// Helper function to extract YouTube video ID
function extractYouTubeVideoId(url) {
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// API endpoint remains the same
app.post("/api/preview", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    const metadata = await extractMetadata(url);
    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
