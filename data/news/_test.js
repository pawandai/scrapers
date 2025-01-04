const puppeteer = require("puppeteer");
const { createObjectCsvWriter } = require("csv-writer");

// Function to format date to 'YYYY-MM-DD'
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Function to scrape news from the current page
const scrapeNewsFromPage = async (page) => {
  return page.evaluate(() => {
    const items = [];
    const newsElements = document.querySelectorAll(".featured-news-list");
    newsElements.forEach((element) => {
      const title = element.querySelector("h4")?.innerText.trim() || "No Title";
      const date = element.querySelector("p")?.innerText.trim() || "No Date";
      items.push({ date, title });
    });
    return items;
  });
};

// Function to scrape news for a specific date
const scrapeNewsForDate = async (page, date, csvWriter) => {
  const formattedDate = formatDate(date);
  const url = `https://www.sharesansar.com/category/latest?date=${formattedDate}`;

  let attempts = 3;
  while (attempts > 0) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      console.log(`Scraping news for ${formattedDate}`);

      const resultSelector = ".featured-news-list";
      const nextButtonSelector = 'a[rel="next"]';
      let newsItems = [];

      while (true) {
        // Wait for the page content to load
        await page.waitForSelector(resultSelector, {
          visible: true,
          timeout: 15000,
        });

        // Scrape news from the current page
        const newItems = await scrapeNewsFromPage(page);
        newsItems = newsItems.concat(newItems);

        // Write news to CSV file
        if (newItems.length > 0) {
          await csvWriter.writeRecords(newItems);
          console.log(`Scraped ${newItems.length} news items.`);
        }

        // Check if the next button is disabled
        const isNextDisabled = await page.evaluate((selector) => {
          const nextButton = document.querySelector(selector);
          return !nextButton || nextButton.classList.contains("disabled");
        }, nextButtonSelector);

        if (isNextDisabled) {
          console.log("Next button is disabled. Moving to next date.");
          break;
        }

        // Click the next button
        await Promise.all([
          page.click(nextButtonSelector),
          page.waitForNavigation({
            waitUntil: "domcontentloaded",
            timeout: 120000,
          }),
        ]);
        setTimeout(() => {}, 2000);
      }
      break; // Exit retry loop if successful
    } catch (error) {
      console.error(
        `Error while scraping news for ${formattedDate}:`,
        error.message
      );
      attempts--;
      if (attempts === 0) throw error; // Rethrow after retries
    }
  }
};

// Main function to run the scraper
const runScraper = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set up CSV writer
  const csvWriter = createObjectCsvWriter({
    path: "nepse_news.csv",
    header: [
      { id: "date", title: "Date" },
      { id: "title", title: "Title" },
      { id: "link", title: "Link" },
    ],
    append: true,
  });

  const startDate = new Date("2019-11-17");
  const today = new Date();
  let currentDate = new Date(startDate);

  while (currentDate <= today) {
    try {
      await scrapeNewsForDate(page, currentDate, csvWriter);
    } catch (error) {
      console.error(
        `Error scraping data for ${formatDate(currentDate)}:`,
        error.message
      );
    }

    // Move to the next date
    currentDate.setDate(currentDate.getDate() + 1);
    await page.waitForTimeout(3000); // 3-second delay
  }

  await browser.close();
};

runScraper().catch((error) => {
  console.error("Error running the scraper:", error);
});
