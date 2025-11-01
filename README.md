# 🧩 Qurett – AI-powered Hotel Insights (Chrome Extension)

**Qurett** is an AI-powered Chrome extension that helps users instantly access **Google-verified hotel insights** — including ratings, reviews, summaries, directions, and quick inquiry options — all in one click from any hotel listing page.

---

## 🚀 How to Test

1. **Download the repository**
   - Click the green **Code → Download ZIP** button, then extract it.

2. **Open in Chrome Extensions**
   - Go to: `chrome://extensions/`
   - Turn **Developer mode ON** (top right)
   - Click **Load unpacked**
   - Select the extracted `Qurett` folder

3. **Use the Extension**
   - Open any hotel listing page (e.g. on Google or Booking.com)
   - Click the **Qurett** icon in the Chrome toolbar  
   - You’ll see:  
     - Google Ratings & Reviews  
     - AI Summary (via Gemini Nano)  
     - Inquiry & Compare options  
     - Shortlist save and manage panel  

---

## 🔐 Notes
- The included Google Places API key is **restricted** to a 10-call daily quota for judging purposes.  
- After the hackathon, this key will be deactivated.  

---

## ⚙️ Built With
- Chrome Extension APIs (Manifest V3)
- Google Places API (searchText endpoint)
- Chrome AI APIs: Summarizer, Writer, and Prompt
- LocalStorage for shortlist persistence
- Vanilla JS + HTML + CSS

---

© 2025 Qurett. All rights reserved.
