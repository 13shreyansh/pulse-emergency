# 🚨 Project Pulse: Autonomous Emergency Dispatch

[![Built with React](https://img.shields.io/badge/Built_with-React-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactjs.org/)
[![Powered by TinyFish](https://img.shields.io/badge/Powered_by-TinyFish-0066FF?style=for-the-badge&logo=fish&logoColor=white)](https://tinyfish.ai/)
[![Vapi AI](https://img.shields.io/badge/Voice_Agent-Vapi_AI-FF3366?style=for-the-badge)](https://vapi.ai/)
[![Twilio SMS](https://img.shields.io/badge/SMS-Twilio-F22F46?style=for-the-badge&logo=twilio&logoColor=white)](https://www.twilio.com/)

**Project Pulse** is a fully autonomous emergency dispatch system built for the TinyFish Hackathon. It replaces the traditional, slow 911 dispatch process with a hyper-fast, AI-driven pipeline that connects patients to the *right* hospital in under 60 seconds.

---

## 🎯 The Problem

When a medical emergency occurs, every second counts. Traditional dispatch relies on human operators who must manually triage the situation, locate nearby hospitals, and call them one by one to check for ER capacity and equipment readiness. This process can take precious minutes, often resulting in patients being sent to hospitals that are full or lack the necessary equipment (e.g., ECMO machines for cardiac arrest).

## 💡 The Solution

Pulse automates the entire dispatch process using advanced AI agents:

1. **Instant Voice Capture:** A bystander presses the Panic Button and describes the emergency.
2. **AI Classification:** The system instantly transcribes the audio and uses GPT-4o to classify the emergency type, severity, and required equipment.
3. **Live Geolocation:** The bystander's exact GPS coordinates are acquired.
4. **Intelligent Hospital Search:** Google Places API finds all relevant hospitals within a 15km radius.
5. **Real-Time Web Scraping (TinyFish):** Concurrent TinyFish web agents scrape the websites of all nearby hospitals to check live ER wait times, bed capacity, and specialized equipment availability.
6. **Autonomous Dispatch (Vapi):** A Vapi voice agent calls the best-ranked hospital, has natural conversation with the ER staff to confirm readiness, and negotiates acceptance.
7. **Auto-Retry & GPS SMS:** If a hospital declines, Pulse automatically dials the next best hospital. Once accepted, it fires a Twilio SMS to the hospital with the patient's exact GPS coordinates and a Google Maps link.

---

## 🏗️ Architecture & Tech Stack

Pulse is built as a modern, full-stack web application:

### Frontend
- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS & Radix UI
- **State Management:** React Hooks & tRPC React Query
- **UI Components:** Custom animated components for CPR Metronome, Call Tracker, and Status Feed

### Backend
- **Server:** Node.js with Express & tRPC
- **Database:** MySQL (via TiDB) with Drizzle ORM (includes in-memory fallback for demo mode)
- **AI Models:** OpenAI GPT-4.1-mini (Classification), Whisper/Deepgram (Transcription)

### Integrations
- **TinyFish Web Agents:** Concurrent scraping of hospital readiness data.
- **Vapi AI:** Autonomous outbound phone calls with a custom system prompt and 11Labs voice.
- **Twilio:** Automated SMS delivery for GPS coordinates.
- **Google Places API:** Geospatial hospital discovery.

---

## 🚀 Key Features

- **End-to-End Autonomy:** From the moment the panic button is pressed, the system requires zero human intervention until the ambulance is dispatched.
- **TinyFish Data Advantage:** Unlike standard dispatch, Pulse knows *before* calling if a hospital is on divert or lacks equipment, thanks to live web scraping.
- **Graceful Auto-Retry:** If a hospital rejects the AI's request, the system instantly auto-dials the next facility in the ranked list.
- **Real-Time Transparency:** The UI displays a live transcript of the AI's phone call with the hospital, along with outcome badges (Hospital Confirmed, ER Available, Equipment Ready).
- **Bystander Support:** Provides an interactive CPR Metronome with audio-visual cues while the dispatch is happening in the background.

---

## 🛠️ Setup & Installation

To run Project Pulse locally, you will need several API keys.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/13shreyansh/pulse-emergency.git
   cd pulse-emergency
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add the following keys:
   ```env
   DATABASE_URL=your_mysql_url
   OPENAI_API_KEY=your_openai_key
   ELEVENLABS_API_KEY=your_elevenlabs_key
   VAPI_API_KEY=your_vapi_key
   VAPI_PHONE_NUMBER_ID=your_vapi_phone_id
   TINYFISH_API_KEY=your_tinyfish_key
   GOOGLE_PLACES_API_KEY=your_google_places_key
   DEMO_TARGET_PHONE=your_test_phone_number
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_API_KEY_SID=your_twilio_api_key
   TWILIO_API_KEY_SECRET=your_twilio_secret
   TWILIO_PHONE_NUMBER=your_twilio_phone
   ```

4. **Run the Development Server:**
   ```bash
   pnpm run dev
   ```

---

## 🏆 Hackathon Context

This project was built for the **TinyFish Hackathon**, showcasing the power of web agents to solve real-world, life-or-death problems. The integration of TinyFish allows Pulse to make intelligent routing decisions based on data that is normally hidden behind hospital dashboards, saving crucial minutes in the dispatch process.

*Built with ❤️ to save lives.*
