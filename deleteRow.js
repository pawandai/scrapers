import fs from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const directoryPath = path.join("./data/company-wise");

fs.readdir(directoryPath, (err, files) => {
  if (err) {
    console.error("Error reading directory:", err);
    return;
  }

  files
    .filter((file) => path.extname(file) === ".csv")
    .forEach((file) => {
      const filePath = path.join(directoryPath, file);
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split(/\r?\n/);

        const matchingIndices = [];
        lines.forEach((line, index) => {
          if (line.includes("Calendar")) {
            matchingIndices.push(index);
          }
        });

        const indexToRemove = matchingIndices[matchingIndices.length - 2];
        const removed = lines.splice(indexToRemove, 1);
        fs.writeFileSync(filePath, lines.join("\n"), "utf8");

        console.log(
          `Updated "${file}" - removed row at line ${indexToRemove + 1}: ${
            removed[0]
          }`
        );
      } catch (error) {
        console.error(`Error processing file "${file}":`, error);
      }
    });
});
