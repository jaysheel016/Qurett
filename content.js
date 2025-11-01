// Extract property name and location
(() => {
  const title =
    document.querySelector("h1")?.innerText ||
    document.querySelector("#hotel_name")?.innerText ||
    document.title;

  const location =
    document.querySelector(".address")?.innerText ||
    document.querySelector(".hotel-address")?.innerText ||
    "";

  chrome.runtime.sendMessage({
    action: "pageData",
    data: { title, location },
  });
})();
