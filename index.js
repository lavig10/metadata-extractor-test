const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json());

// Function to extract metadata from URL
async function extractMetadata(url) {
  try {
    const response = await axios.get(url, {
      timeout: 5000, // 5 second timeout
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MetadataBot/1.0)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      },
      maxContentLength: 5 * 1024 * 1024 // 5MB max content size
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

    // Try Open Graph tags first
    metadata.title =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text() ||
      $('meta[name="title"]').attr("content");

    metadata.description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content");

    metadata.image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[property="twitter:image"]').attr("content");

    metadata.siteName =
      $('meta[property="og:site_name"]').attr("content") ||
      new URL(url).hostname;

    // Clean up the data
    Object.keys(metadata).forEach((key) => {
      metadata[key] = metadata[key] || "";
      metadata[key] = metadata[key].trim();
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

// API endpoint
app.post("/api/preview", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Validate URL
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
