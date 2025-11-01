// popup.js — Qurett v5.6-AI Enhanced (Final Submission Build)
// ----------------------------------------------------------------------
// ✅ Keeps all UI + Google API + Shortlist features intact
// ✅ Fetches only editorialSummary (clean, no reviews)
// ✅ Uses Chrome Summarizer API (Gemini Nano) for 300-char summary
// ✅ Adds "Read Reviews / Summary" overlay in UI with divider + padding
// ✅ Adds Writer API (Gemini Nano) for inquiry drafting with fallback
// ✅ Restores ALL buttons + shortlist logic (Map, Website, WhatsApp, etc.)
// ✅ Final fixes: Image, Send Inquiry (overlay), Delete alignment, WhatsApp full draft
// ----------------------------------------------------------------------

const GOOGLE_API_KEY = "AIzaSyCJ-wUiCXECizH9PWrB9N3hE6Qzn5lcEY8";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ Qurett popup loaded (Final Submission)");
  await updateUI();
  initShortlist();
});

// --- Detect hotel name + location ---
async function detectPropertyDetails() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab) return resolve({ name: "", location: "" });

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const nameSelectors = [
              "h1",
              ".hp__hotel-name",
              ".pp-header__title",
              "[data-testid='header-hotel-name']",
              ".hotel-name",
              ".sr-hotel__name",
              ".title",
            ];
            const locationSelectors = [
              ".hp_address_subtitle",
              ".pp-header__subtitle",
              "[data-testid='header-hotel-address']",
              ".address",
              ".property-address",
              ".sr_card_address_line",
            ];

            let name =
              nameSelectors.map((s) => document.querySelector(s)?.innerText?.trim()).filter(Boolean)[0] ||
              document.title;
            let location =
              locationSelectors.map((s) => document.querySelector(s)?.innerText?.trim()).filter(Boolean)[0] ||
              "";

            name = name.replace(/\(.*deals.*\)/i, "").replace(/deals/gi, "").trim();

            if (!name || name.length < 3) {
              const titleTag = document.querySelector("title")?.innerText || "";
              const possibleName = titleTag.split(" - ")[0];
              if (possibleName) name = possibleName;
            }

            return { name, location };
          },
        });

        const detected = results?.[0]?.result || {};
        if (!detected?.name) {
          setTimeout(async () => {
            const retry = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                const name = document.querySelector("h1, .pp-header__title, .hp__hotel-name")?.innerText || document.title;
                const location = document.querySelector(".address, .property-address, [data-testid='header-hotel-address']")?.innerText || "";
                return { name: name.trim(), location: location.trim() };
              },
            });
            resolve(retry?.[0]?.result || { name: "", location: "" });
          }, 700);
        } else {
          resolve(detected);
        }
      } catch (err) {
        console.error("❌ detectPropertyDetails error:", err);
        resolve({ name: "", location: "" });
      }
    });
  });
}

// --- Fetch from Google Places API (Cleaned) ---
async function fetchGooglePlaceData(name, location) {
  const query = `${name} ${location}`.trim();
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.shortFormattedAddress,places.rating,places.userRatingCount,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.photos,places.editorialSummary",
      },
      body: JSON.stringify({
        textQuery: query,
        includedType: "lodging",
        regionCode: "IN",
        maxResultCount: 1,
        languageCode: "en",
      }),
    });

    const data = await res.json();
    if (!data.places?.length) return null;

    const place = data.places[0];
    const shortAddress = place.shortFormattedAddress || "";
    const photoUri = place.photos?.length
      ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?key=${GOOGLE_API_KEY}&maxHeightPx=145&maxWidthPx=145`
      : "";
    const editorial = place.editorialSummary?.text?.trim() || "";

    return {
      placeId: place.id,
      name: place.displayName?.text || name,
      shortAddress,
      rating: place.rating || "N/A",
      reviews: place.userRatingCount || 0,
      phone: place.internationalPhoneNumber || "",
      website: place.websiteUri || "",
      googleMapsUri: place.googleMapsUri || "",
      photoUri,
      placeSummary: editorial,
    };
  } catch (err) {
    console.error("🚨 Google API error:", err);
    return null;
  }
}

// --- Summarize with Chrome Summarizer API ---
async function getAISummary(text) {
  if (!text || text.length < 50) return text;

  const cleanText = text.replace(/\s+/g, " ").trim();

  if (chrome?.ai?.summarizer) {
    try {
      const summarizer = await chrome.ai.summarizer.create({
        type: "tl;dr",
        length: "short",
      });
      const summary = await summarizer.summarize(cleanText);
      let trimmed = summary?.trim() || cleanText;
      if (trimmed.length > 400) {
        const cutoff = trimmed.slice(0, 380);
        const endPunct = cutoff.lastIndexOf(".");
        trimmed = endPunct > 100 ? cutoff.slice(0, endPunct + 1) : cutoff;
        trimmed += "...";
      }
      return trimmed;
    } catch (err) {
      console.warn("⚠️ Summarizer API unavailable, using fallback:", err);
    }
  }
  return cleanText.slice(0, 380) + "...";
}

// --- Update UI ---
async function updateUI() {
  const titleEl = document.getElementById("property-title");
  const ratingEl = document.getElementById("rating");
  const cityEl = document.getElementById("city-name");
  const imageEl = document.getElementById("property-image");

  titleEl.textContent = "Detecting Property...";
  ratingEl.textContent = "";

  try {
    let { name, location } = await detectPropertyDetails();
    if (!name) {
      console.log("⚙️ Using fallback AI...");
      const aiDetected = await detectWithPromptAPI();
      if (aiDetected) ({ name, location } = aiDetected);
    }

    if (!name) {
      titleEl.textContent = "No property detected";
      return;
    }

    titleEl.textContent = name;
    cityEl.textContent = location || "";

    const placeData = await fetchGooglePlaceData(name, location);
    if (!placeData) {
      ratingEl.textContent = "No Google data found.";
      return;
    }

    const { rating, reviews, phone, website, photoUri, shortAddress, placeId, placeSummary } = placeData;

    const reviewsLink = `https://search.google.com/local/reviews?placeid=${placeId}`;
    ratingEl.innerHTML = rating
      ? `
        <div style="display:flex;align-items:center;gap:6px;line-height:1.3;">
          ⭐ <span style="color:#2e7d32;font-size:13px;">${rating} (${reviews} reviews)</span>
        </div>
        <div style="display:flex;gap:6px;">
          <a href="${reviewsLink}" target="_blank" style="color:#0078ff;text-decoration:none;font-size:12px;">Read Reviews</a>
          <a href="#" id="summary-link" style="color:#0078ff;text-decoration:none;font-size:12px;">/ Summary</a>
        </div>`
      : "⭐ No ratings found";

    cityEl.textContent = shortAddress || location || "";
    if (photoUri) imageEl.src = photoUri;

    const summaryLink = document.getElementById("summary-link");
    if (summaryLink && placeSummary) {
      summaryLink.addEventListener("click", async (e) => {
        e.preventDefault();
        const overlay = document.getElementById("shortlist-overlay");
        const summarizedText = await getAISummary(placeSummary);
        overlay.innerHTML = `
          <button class="shortlist-close" style="position:fixed;top:8px;right:14px;background:none;border:none;color:#e53935;font-size:18px;cursor:pointer;z-index:9999;">✕</button>
          <div class="ai-summary-content" style="font-size:13px;line-height:1.5;color:#333;padding:12px;margin:8px;max-width:95%;word-wrap:break-word;">
            <h3 class="ai-summary-title">AI Summary</h3>
            <hr class="ai-summary-divider" />
            <p>${summarizedText}</p>
          </div>
        `;
        overlay.classList.add("active");
        overlay.querySelector(".shortlist-close").onclick = () => overlay.classList.remove("active");
      });
    }

    setupButtons({ name, location, phone, website, placeId, photoUri });
  } catch (err) {
    console.error("Error in updateUI:", err);
    titleEl.textContent = "Detection failed";
  }
}

// --- Prompt API fallback ---
async function detectWithPromptAPI() {
  try {
    if (!chrome?.ai?.prompt?.generate) return null;
    const aiResponse = await chrome.ai.prompt.generate({
      prompt: `Identify hotel name and location. Return {"name":"...","location":"..."} from this page text: ${document.body?.innerText?.slice(0, 1200)}`,
    });
    return JSON.parse(aiResponse.outputText);
  } catch (err) {
    console.error("Prompt API fallback error:", err);
    return null;
  }
}

// --- Inquiry Writer API ---
async function generateInquiryText(name, location) {
  try {
    if (chrome?.ai?.writer) {
      const writer = await chrome.ai.writer.create();
      const result = await writer.write(
        `Draft a polite hotel inquiry email for ${name} located at ${location}, asking for availability and rates. Include check-in/out placeholders.`
      );
      if (result?.outputText) return result.outputText;
    }
  } catch {
    console.warn("Writer API unavailable, using fallback.");
  }

  return `Dear ${name} Team,

I am interested in booking a stay at your property and would like to inquire about availability and rates.

Check-in: [specify]
Check-out: [specify]
Guests: [specify]

Could you please share:
- Room availability
- Best rates
- Any special offers

Best regards,
[Your Name]`;
}

// --- Setup all functional buttons ---
function setupButtons({ name, location, phone, website, placeId, photoUri }) {
  const inquiryBtn = document.getElementById("bulk-inquiry");
  if (inquiryBtn)
    inquiryBtn.onclick = async () => {
      const subject = `Inquiry about ${name}`;
      const body = await generateInquiryText(name, location);
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

  const mapBtn = document.getElementById("map-button");
  if (mapBtn)
    mapBtn.onclick = (e) => {
      e.preventDefault();
      if (placeId) window.open(`https://www.google.com/maps/place/?q=place_id:${placeId}`, "_blank");
    };

  const websiteBtn = document.getElementById("website-tab");
  if (websiteBtn && website) websiteBtn.onclick = () => window.open(website, "_blank");

  const whatsappBtn = document.getElementById("whatsapp-button");
  if (whatsappBtn)
    whatsappBtn.onclick = async () => {
      const body = await generateInquiryText(name, location);
      const msg = encodeURIComponent(body);
      if (phone) window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
    };

  const callBtn = document.getElementById("call-button");
  if (callBtn && phone) callBtn.onclick = () => (window.location.href = `tel:${phone}`);

  const bookBtn = document.getElementById("bookdirect-button");
  if (bookBtn)
    bookBtn.onclick = () =>
      window.open(`https://www.google.com/travel/search?q=${encodeURIComponent(name + " " + location)}`, "_blank");

  const heartBtn = document.getElementById("save-heart");
  if (heartBtn)
    heartBtn.onclick = () => {
      const saved = heartBtn.classList.toggle("saved");
      updateShortlist({ name, location, website, phone, placeId, photoUri }, saved);
    };

  const shortlistBtn = document.getElementById("view-shortlist");
  if (shortlistBtn) shortlistBtn.onclick = () => showShortlistOverlay();
}

// --- Shortlist Logic ---
function initShortlist() {
  console.log("✅ Shortlist initialized");
}

function updateShortlist(item, saved) {
  const list = JSON.parse(localStorage.getItem("shortlist") || "[]");
  const exists = list.find((x) => x.name === item.name);
  let updated;
  const enriched = {
    name: item.name,
    location: item.location,
    website: item.website || "",
    phone: item.phone || "",
    photoUri: item.photoUri || "",
    placeId: item.placeId || "",
  };
  if (saved && !exists) updated = [...list, enriched];
  else updated = list.filter((x) => x.name !== item.name);
  localStorage.setItem("shortlist", JSON.stringify(updated));
}

// --- Shortlist Overlay (Final Polished) ---
function showShortlistOverlay() {
  const overlay = document.getElementById("shortlist-overlay");
  const list = JSON.parse(localStorage.getItem("shortlist") || "[]");

  overlay.innerHTML = `
    <button class="shortlist-close" 
      style="position:fixed;top:8px;right:14px;background:none;border:none;color:#e53935;font-size:18px;cursor:pointer;z-index:9999;">
      ✕
    </button>
    <div style="padding:12px;">
      <h3 class="ai-summary-title" style="margin-bottom:6px;">Saved Shortlist</h3>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin-bottom:10px;" />
      ${
        list.length
          ? list
              .map(
                (i, idx) => `
                <div class="shortlist-card" style="display:flex;align-items:flex-start;gap:10px;background:#fafafa;border-radius:10px;padding:10px 12px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.1);position:relative;">
                  <div style="font-weight:600;font-size:13px;width:16px;text-align:center;margin-top:4px;">${idx + 1}</div>
                  <img src="${i.photoUri || "https://via.placeholder.com/50?text=Hotel"}"
                       alt="hotel"
                       style="width:50px;height:50px;border-radius:6px;object-fit:cover;border:1px solid #ddd;" />
                  <div style="flex:1;">
                    <div style="font-weight:600;font-size:13px;color:#222;margin-bottom:2px;">${i.name}</div>
                    <div style="font-size:12px;color:#555;margin-bottom:4px;">${i.location || ""}</div>
                    <div class="link-group" style="font-size:11px;display:flex;flex-wrap:wrap;gap:8px;">
                      <a href="${i.placeId
                        ? `https://search.google.com/local/reviews?placeid=${i.placeId}`
                        : `https://www.google.com/search?q=${encodeURIComponent(i.name + ' ' + i.location)}`
                      }" target="_blank" style="color:#0078ff;">Read Reviews</a>
                      <a href="#" class="send-inquiry" data-name="${encodeURIComponent(
                        i.name
                      )}" data-location="${encodeURIComponent(i.location)}" style="color:#0078ff;">Send Inquiry</a>
                      ${i.website ? `<a href="${i.website}" target="_blank" style="color:#0078ff;">Website</a>` : ""}
                      ${i.phone ? `<a href="tel:${i.phone}" style="color:#0078ff;">Call</a>` : ""}
                      <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        i.name + ' ' + i.location
                      )}" target="_blank" style="color:#0078ff;">Map</a>
                      <a href="https://www.google.com/travel/search?q=${encodeURIComponent(
                        i.name + ' ' + i.location
                      )}" target="_blank" style="color:#0078ff;">Compare/Book</a>
                      ${
                        i.phone
                          ? `<a href="#" class="whatsapp-send" data-phone="${i.phone.replace(/\D/g, "")}" data-name="${encodeURIComponent(
                              i.name
                            )}" data-location="${encodeURIComponent(i.location)}" style="color:#0078ff;">WhatsApp</a>`
                          : ""
                      }
                    </div>
                  </div>
                  <button class="delete-shortlist" data-name="${encodeURIComponent(
                    i.name
                  )}" style="background:none;border:none;cursor:pointer;color:#888;font-size:14px;position:absolute;top:8px;right:8px;">🗑️</button>
                </div>`
              )
              .join("")
          : "<p style='font-size:13px;color:#777;'>No hotels shortlisted yet.</p>"
      }
    </div>
  `;

  overlay.classList.add("active");
  overlay.querySelector(".shortlist-close").onclick = () => overlay.classList.remove("active");

  overlay.querySelectorAll(".delete-shortlist").forEach((btn) => {
    btn.onclick = (e) => {
      const name = decodeURIComponent(e.currentTarget.dataset.name);
      removeFromShortlist(name);
      showShortlistOverlay();
    };
  });

  overlay.querySelectorAll(".send-inquiry").forEach((btn) => {
    btn.onclick = async (e) => {
      e.preventDefault();
      const name = decodeURIComponent(btn.dataset.name);
      const location = decodeURIComponent(btn.dataset.location);
      const subject = `Inquiry about ${name}`;
      const body = await generateInquiryText(name, location);
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };
  });

  overlay.querySelectorAll(".whatsapp-send").forEach((btn) => {
    btn.onclick = async (e) => {
      e.preventDefault();
      const name = decodeURIComponent(btn.dataset.name);
      const location = decodeURIComponent(btn.dataset.location);
      const phone = btn.dataset.phone;
      const body = await generateInquiryText(name, location);
      const encoded = encodeURIComponent(body);
      window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
    };
  });
}

function removeFromShortlist(name) {
  const list = JSON.parse(localStorage.getItem("shortlist") || "[]");
  const updated = list.filter((x) => x.name !== name);
  localStorage.setItem("shortlist", JSON.stringify(updated));
}
