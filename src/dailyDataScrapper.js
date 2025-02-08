import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import csvParser from "csv-parser";
import { createObjectCsvWriter as createCsvWriter } from "csv-writer";
import axios from "axios";
import * as cheerio from "cheerio";
import { getStatus } from "./utils/status.js";
import { convertCommaSeparatedNumberToFloat } from "./utils/numberUtils.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

(async () => {
  try {
    // URL to scrape stock data
    const dailyPriceUrl = "https://www.sharesansar.com/today-share-price";

    console.log("Fetching HTML...");
    const { data: html } = await axios.get(dailyPriceUrl);
    const $ = cheerio.load(html);

    console.log("Extracting today's date...");
    const today = $("span.text-org").text().trim().split(" ")[0];

    console.log("Today's date:", today);

    console.log("Extracting stock data...");
    const stockData = [];
    $("table tbody tr").each((index, element) => {
      const row = {};
      $(element)
        .find("td")
        .each((i, el) => {
          row[$("table thead th").eq(i).text().trim()] = $(el).text().trim();
        });
      stockData.push(row);
    });

    if (stockData.length === 0) {
      throw new Error(
        "No stock data extracted. The page structure might have changed."
      );
    }

    console.log(`Extracted ${stockData.length} rows of stock data.`);

    // Define data storage path
    const fileDir = path.join("./data/company-wise/");

    console.log("Processing CSV files...");
    fs.readdirSync(fileDir)
      .filter((file) => file.endsWith(".csv"))
      .forEach((file) => {
        const filePath = path.join(fileDir, file);
        const rows = [];

        fs.createReadStream(filePath)
          .pipe(csvParser())
          .on("data", (data) => rows.push(data))
          .on("end", () => {
            const lastRow = rows[rows.length - 1];
            if (lastRow && lastRow.published_date === today) {
              console.log(`Skipping ${file} - Already updated.`);
              return;
            }

            const symbol = path.basename(file, ".csv");
            const data = stockData.find((d) => d.Symbol === symbol);

            if (!data) {
              console.warn(`No matching stock data found for ${symbol}`);
              return;
            }

            const status = getStatus(
              parseFloat(data.Open),
              parseFloat(data.Close)
            );
            const csvWriter = createCsvWriter({
              path: filePath,
              header: [
                { id: "published_date", title: "published_date" },
                { id: "Open", title: "Open" },
                { id: "High", title: "High" },
                { id: "Low", title: "Low" },
                { id: "Close", title: "Close" },
                { id: "Diff %", title: "Diff %" },
                { id: "Vol", title: "Vol" },
                { id: "Turnover", title: "Turnover" },
                { id: "Status", title: "Status" },
              ],
              append: true,
            });

            csvWriter
              .writeRecords([
                {
                  published_date: today,
                  Open: convertCommaSeparatedNumberToFloat(data.Open),
                  High: convertCommaSeparatedNumberToFloat(data.High),
                  Low: convertCommaSeparatedNumberToFloat(data.Low),
                  Close: convertCommaSeparatedNumberToFloat(data.Close),
                  "Diff %": convertCommaSeparatedNumberToFloat(data["Diff %"]),
                  Vol: convertCommaSeparatedNumberToFloat(data.Vol),
                  Turnover: convertCommaSeparatedNumberToFloat(data.Turnover),
                  Status: status,
                },
              ])
              .then(() => console.log(`Updated: ${filePath}`));
          });
      });
  } catch (error) {
    console.error("❌ Error fetching or processing data:", error);
  }
})();
