# Baeci Market

Marketplace premium untuk server panel Pterodactyl dan produk digital berkualitas.

## Overview

Baeci Market adalah website e-commerce untuk pembelian:
- Server Panel Pterodactyl (dengan pilihan RAM, CPU, Disk)
- Produk Digital lainnya

### Fitur Utama
- Desain premium dengan efek blur iOS style (glassmorphism)
- Sistem login/register dengan local JSON storage
- Sistem saldo dan deposit dengan TokoPay payment gateway
- Integrasi Pterodactyl Panel API untuk auto-create server
- Dashboard admin lengkap untuk konfigurasi semua data termasuk API keys
- Responsif untuk semua device

## Tech Stack

- **Backend**: Node.js + Express.js
- **Frontend**: EJS Templates + Tailwind CSS
- **Database**: Google Sheets API (persistent cloud storage)
- **Payment**: TokoPay API
- **Panel**: Pterodactyl Panel API
- **Deployment**: Vercel-ready with vercel.json

## Project Structure

```
src/
├── app.js                 # Main application entry
├── credentials.json       # Legacy credentials (Google only)
├── data/                  # JSON data storage
│   ├── users.json         # User accounts and balances
│   ├── products.json      # Digital products
│   ├── servers.json       # Server panel offerings
│   ├── transactions.json  # Payment transactions
│   ├── orders.json        # Purchase orders
│   └── settings.json      # Site + API configuration
├── views/                 # EJS templates
│   ├── partials/          # Header & footer
│   ├── index.ejs          # Homepage
│   ├── login.ejs          # Login page
│   ├── register.ejs       # Register page
│   ├── server.ejs         # Server list
│   ├── server-buy.ejs     # Buy server page
│   ├── products.ejs       # Products list
│   ├── product-detail.ejs # Product detail
│   ├── deposit.ejs        # Deposit saldo
│   ├── profile.ejs        # User profile
│   ├── transactions.ejs   # Transaction history
│   ├── orders.ejs         # Order history (with server credentials)
│   ├── admin.ejs          # Admin dashboard (with API tab)
│   └── 404.ejs            # 404 page
├── routes/                # Express routes
│   ├── index.js           # Homepage routes
│   ├── auth.js            # Authentication
│   ├── server.js          # Server purchase + Pterodactyl integration
│   ├── products.js        # Products
│   ├── deposit.js         # Deposit/payment
│   ├── profile.js         # User profile
│   └── admin.js           # Admin panel + API settings
├── utils/                 # Utility functions
│   ├── localDb.js         # Local JSON database operations
│   ├── pterodactyl.js     # Pterodactyl Panel API integration
│   └── tokopay.js         # TokoPay payment API
├── middleware/            # Express middleware
│   └── auth.js            # Authentication middleware
└── public/                # Static files
    └── uploads/           # Uploaded images
```

## Configuration

### API Settings (Admin Panel)
All API configurations are stored in `src/data/settings.json` and can be managed via Admin Dashboard > API tab:

**Pterodactyl Panel:**
- Panel URL (domain)
- Application API Key (ptla_xxx)
- Client API Key (ptlc_xxx)
- Nest ID, Egg ID, Location ID

**TokoPay:**
- Merchant ID
- Secret Key

## Admin Access

- Email: admin@vynaa.web.id
- Username: admin123
- Password: pwadmin123

## Server Purchase Flow

1. User selects server package and duration
2. System checks user balance
3. System creates Pterodactyl user account via API
4. System creates server on Pterodactyl panel via API
5. Credentials (username, password, panel URL) saved to order
6. User can view credentials in Orders page

## TokoPay Deposit Flow

1. User selects amount and payment method
2. System creates order via TokoPay API
3. User pays via QRIS/e-wallet/bank
4. Auto-polling checks status every 5 seconds
5. TokoPay has 1-5 minute delay for status update (normal behavior)
6. Balance updated when TokoPay confirms payment

## Running the Project

```bash
node src/app.js
```

Server will run on port 5000.

## Recent Changes

- 2025-12-27: Admin UI Overhaul & Cancel Deposit
  - Complete admin UI redesign with modal-based forms (no more prompt() dialogs)
  - User management: view details, edit balance, change password modals
  - Product management: supports both URL input and file upload for images
  - Server/Order/Transaction management with inline status updates and delete
  - Cancel deposit feature: users can cancel pending deposits
  - Footer navigation: less transparent, more visible on mobile
  - Added deleteOrder() and deleteTransaction() to localDb.js
  - New admin API endpoints for user password change, product/server fetching

- 2025-12-27: Pterodactyl Panel Integration
  - Added API settings tab in admin dashboard for Panel & TokoPay configuration
  - Implemented pterodactyl.js utility for API calls
  - Server purchase now actually creates user + server on Pterodactyl panel
  - Server credentials (username, password, URL) displayed in Orders page
  - TokoPay now reads config from settings.json (admin-configurable)
  - Added "Test Connection" button for Panel API

- 2025-12-27: TokoPay Improvements
  - Fixed status recognition for "Success" status from API
  - Improved modal messaging for payment processing delays
  - All timestamps now use Asia/Jakarta timezone

- 2025-12-27: Mobile UI Improvements
  - Fixed mobile sidebar/menu with proper close functionality
  - Admin dashboard fully mobile responsive
  - All pages optimized for mobile

- 2025-12-27: Initial Setup
  - Local JSON storage instead of Google Sheets
  - Premium glassmorphism UI
  - Complete e-commerce functionality

## Data Storage

Google Sheets database (persistent cloud storage):
- Spreadsheet ID: 1h-9GW9r3ZjYB8OCIB8yVI_yuVEX_7etIy5jhV0F_p4w
- Sheets auto-created: users, products, servers, transactions, orders, settings
- Each sheet has proper headers and data validation
- Uses service account for authentication
- Works on both Replit and Vercel deployment
- Local JSON storage is no longer used.

## Recent Changes
- 2025-12-29: Updated server specs mapping and fixed price display.
  - Implemented automatic RAM/Disk/CPU detection based on plan name (1GB-10GB).
  - Fixed 'Total Harga' display bug in purchase page.
  - Removed all legacy JSON data files; app now fully relies on Google Sheets.
  - Improved admin control over pricing and specifications via spreadsheet.
