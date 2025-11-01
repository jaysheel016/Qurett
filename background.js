chrome.runtime.onInstalled.addListener(() => {
  console.log("BookWise Extension Installed");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "sendBulkEmail") {
    // Placeholder for Gmail API integration
  }
});
