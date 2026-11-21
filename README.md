# 🚀 PesaPilot — AI M-Pesa Assistant & STK Copilot

**Chat. Pay. Done.**  
PesaPilot is a real-time web application and AI assistant designed to streamline M-Pesa STK push requests, transaction tracking, and instant digital receipting.

---

## ✨ Features

- 💬 **Natural Language STK Dispatch**: Request payments using everyday language (e.g., *"Request KES 500 from 0712345678 for lunch"*).
- 🔄 **Real-Time Polling & Status Tracking**: Live background synchronization every 3 seconds to check payment states (`PENDING`, `SUCCESS`, `FAILED`).
- 🔔 **Celebratory Audio & Confetti**:
  - Web Audio API success chime on confirmed payment (zero third-party audio assets).
  - Canvas confetti particle effects.
- 🧾 **Simulated SMS & Digital Receipts**:
  - Instant M-Pesa receipt preview modal.
  - One-click **PNG receipt image generator** (rendered dynamically via HTML Canvas).
  - Native browser Print & PDF export support.
  - Fast SMS text copy to clipboard.
- 🌙 **Theme & Responsive Design**:
  - Full Dark/Light mode toggle.
  - Mobile-optimized segmented view (Chat vs. Payments tab switching).
- ▶️ **Interactive Pitch Demo**: Automated simulation in the header to demonstrate an STK payment flow with a single click.

---

## 🏗️ Project Architecture

```plaintext
pesapilot-react/
├── index.html          # Web entry point with Plus Jakarta Sans font
├── package.json        # Dependencies (React 19, Vite 6)
├── vite.config.js      # Vite configuration (runs on port 3000)
├── .gitignore          # Ignores node_modules, build outputs, etc.
└── src/
    ├── main.jsx        # React DOM render root
    ├── App.jsx         # Core app logic (Chat, Payments, Audio, Canvas, Modals)
    └── styles.css      # Custom styling, dark/light theme variables & animations
```

---

## ⚙️ Backend Integration

PesaPilot connects to your backend service running at `http://localhost:8080/api`:

- **POST** `/api/chat`:
  - Request: `{ "message": string, "sessionId": string }`
  - Response: `{ "reply": string }`
- **GET** `/api/payments`:
  - Response: Array of payments:
    ```json
    [
      {
        "reference": "PP-f3e29a44",
        "phone": "0712345678",
        "amount": 500,
        "status": "SUCCESS"
      }
    ]
    ```

> [!IMPORTANT]
> Ensure your backend controller has `@CrossOrigin(origins = "*")` (or allows `http://localhost:3000`) to permit cross-origin requests from the frontend.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/doctor-nails/pesapilot.git
   cd pesapilot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Production Build**:
   ```bash
   npm run build
   npm run preview
   ```

---

## 🧪 Testing & Verification

1. **Pitch Demo**:
   Click **▶ Pitch Demo** on the top navigation bar to automatically test chat dispatch and status query.
2. **STK Trigger**:
   Use suggestion chips or type:
   - `Request 10 bob from 0712345678`
   - `Did it go through?`
   - `Show all payments`
3. **Receipt Export**:
   Click on any transaction card in the **Recent Payments** list to open the receipt modal and test **Download Receipt (.PNG)** or **Print / PDF**.

---

## 📄 License

This project is licensed under the MIT License.
