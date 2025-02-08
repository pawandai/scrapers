// ...existing code or header comments...

export function convertCommaSeparatedNumberToFloat(numberStr) {
  // Remove all commas and parse as float
  return parseFloat(numberStr.replace(/,/g, ""));
}

// ...existing code...
