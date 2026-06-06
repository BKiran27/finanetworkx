# FinaNetwork — Real-Time Financial Networking Platform

A premium fintech networking platform where finance professionals connect, track portfolios in real-time, and stay updated with live market data.

## Features

- **Real-Time Market Data** — Live crypto prices via CoinGecko API, updated every 30 seconds via WebSocket
- **Portfolio Tracking** — Add assets, track P&L, view allocation charts
- **Professional Networking** — Connect with traders, analysts, and investors
- **Live Dashboard** — TradingView charts, market tables, sparklines, trending coins
- **Real-Time Notifications** — Instant alerts via Socket.IO
- **Premium UI** — Dark fintech theme with glassmorphism, animations, and responsive design

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js |
| Real-time | Socket.IO |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |
| Market Data | CoinGecko API (free) |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Charts | TradingView Lightweight Charts, Chart.js |

## Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/finanetwork.git
cd finanetwork

# Install dependencies
npm install

# Create .env file
echo PORT=3000 > .env
echo JWT_SECRET=your_secret_key_here >> .env
echo NODE_ENV=development >> .env

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploy on Render (Free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) and sign in with GitHub
3. Click **New > Web Service**
4. Connect your `finanetwork` repository
5. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**: Add `JWT_SECRET` and `NODE_ENV=production`
6. Click **Deploy** — your site will be live in minutes!

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user (protected) |
| GET | /api/market/prices | Live market prices |
| GET | /api/market/trending | Trending coins |
| GET | /api/market/chart/:id | Price chart data |
| GET | /api/portfolio | User portfolio (protected) |
| POST | /api/portfolio | Add asset (protected) |
| GET | /api/network/connections | User connections (protected) |
| POST | /api/network/connect | Send connection request (protected) |
| GET | /api/users | List/search users |

## Screenshots

After starting the server, visit:
- `/` — Landing page
- `/auth.html` — Login/Register
- `/dashboard.html` — Real-time dashboard
- `/portfolio.html` — Portfolio management
- `/network.html` — Professional network
- `/profile.html` — User profile

## License

ISC
