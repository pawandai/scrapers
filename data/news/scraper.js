const puppeteer = require("puppeteer");
const { createObjectCsvWriter } = require("csv-writer");
const fs = require("fs");
const csvParser = require("csv-parser");

// Function to format date to 'YYYY-MM-DD'
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Function to scrape news for a specific date
const scrapeNewsForDate = async (page, date) => {
  const formattedDate = formatDate(date);
  const url = `https://www.sharesansar.com/category/latest?date=${formattedDate}`;

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  const resultSelector = ".featured-news-list";
  await page.waitForSelector(resultSelector, { visible: true, timeout: 15000 });

  const newsItems = await page.evaluate(() => {
    const items = [];
    const newsElements = document.querySelectorAll(".featured-news-list");
    newsElements.forEach((element) => {
      const title = element.querySelector("h4")?.innerText.trim() || "No Title";
      const date = element.querySelector("p")?.innerText.trim() || "No Date";
      items.push({ date, title });
    });
    return items;
  });

  return newsItems.map((item) => ({
    ...item,
    date: formatDate(new Date(item.date)),
  }));
};

// Function to read existing CSV data and return a Set of unique entries
const readExistingTitles = async (filePath) => {
  if (!fs.existsSync(filePath)) return new Set();

  return new Promise((resolve, reject) => {
    const titles = new Set();
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row) => {
        // Ensure the keys match the CSV headers
        titles.add(`${row.Date.trim()}-${row.Title.trim()}`);
      })
      .on("end", () => resolve(titles))
      .on("error", reject);
  });
};

// Function to initialize the CSV file with headers if it doesn't exist
const initializeCsvFile = async (filePath) => {
  if (!fs.existsSync(filePath)) {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: "date", title: "Date" },
        { id: "title", title: "Title" },
      ],
    });

    // Write an empty array to initialize with headers
    await csvWriter.writeRecords([]);
    console.log(`Initialized CSV file with headers at ${filePath}`);
  }
};

// Main function to run the scraper
const runScraper = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const filePath = "./data/news/raw_news.csv";

  // Ensure the CSV file has the correct headers
  await initializeCsvFile(filePath);

  // Read existing titles
  const existingTitles = await readExistingTitles(filePath);

  // Set up CSV writer
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: "date", title: "Date" },
      { id: "title", title: "Title" },
    ],
    append: true, // Append to the file after headers are written
  });

  const currentDate = new Date();

  try {
    const newsItems = await scrapeNewsForDate(page, currentDate);

    // Filter new items based on both date and title
    const newItems = newsItems.filter(
      (item) => !existingTitles.has(`${item.date.trim()}-${item.title.trim()}`)
    );

    if (newItems.length > 0) {
      await csvWriter.writeRecords(newItems);
      console.log(
        `Added ${newItems.length} news items for ${formatDate(currentDate)}`
      );

      // Add new items to the existing titles set
      newItems.forEach((item) =>
        existingTitles.add(`${item.date.trim()}-${item.title.trim()}`)
      );
    } else {
      console.log(`No new news items for ${formatDate(currentDate)}`);
    }
  } catch (error) {
    console.error(
      `Error scraping data for ${formatDate(currentDate)}:`,
      error.message
    );
  }

  await browser.close();
};

runScraper().catch((error) => {
  console.error("Error running the scraper:", error);
});
