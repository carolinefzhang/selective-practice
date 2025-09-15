# Scholarly Selective Practice Quiz

This project is designed to help users practice challenging questions from Scholarly trial tests. It consists of two main parts:

1.  **Backend Scripts**: Node.js scripts using Puppeteer to scrape questions (including text and images) that were answered incorrectly from a specified Scholarly quiz URL. The scraped data is then processed and uploaded to a Supabase database, including storing images in Supabase Storage.
2.  **Frontend Application**: A React/Vite application with Auth0 authentication that fetches a random question from the Supabase database and displays it, allowing users to selectively practice.

## Tech Stack

### Backend
- Node.js with Puppeteer for web scraping
- Supabase for database and file storage
- CSV processing for data handling

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- React Router for navigation
- Auth0 for authentication
- Supabase client for data fetching

## Project Structure

```
/
├── backend/                 # Contains all backend scripts and related files
│   ├── src/
│   │   ├── scraper.js       # Puppeteer script to scrape questions
│   │   ├── uploadToSupabase.js # Script to upload data and images to Supabase
│   │   └── scraped_data.csv # Temporary CSV output from scraper (used by uploader)
│   ├── runAll.js            # Master script to run scraper and uploader sequentially
│   └── package.json         # Backend dependencies
├── frontend/                # Contains the React/Vite frontend application
│   ├── public/              # Static assets for the frontend
│   ├── src/
│   │   ├── auth/            # Auth0 authentication components
│   │   │   ├── auth0-provider-with-navigate.tsx
│   │   │   └── authentication-guard.tsx
│   │   ├── components/      # Reusable UI components
│   │   │   ├── logout-button.tsx
│   │   │   ├── header.tsx
│   │   │   ├── page-layout.tsx
│   │   │   ├── page-loader.tsx
│   │   │   └── question-display.tsx
│   │   ├── pages/           # Page components
│   │   │   ├── callback-page.tsx
│   │   │   ├── home-page.tsx
│   │   │   └── not-found-page.tsx
│   │   ├── app.tsx          # Main app component
│   │   └── main.tsx         # App entry point
│   ├── package.json         # Frontend dependencies
│   └── README.md            # Detailed frontend README
├── .env.local               # (You need to create this) Environment variables for the project
└── README.md                # This file - a general overview of the project
```

## Environment Setup

Before running any part of the project, you need to create a `.env.local` file in the **root directory** of the project. This file will store your credentials and API keys.

Create a file named `.env.local` in the project root and add the following variables, replacing the placeholder values with your actual information:

```env
# Credentials for the Scholarly website (used by backend/src/scraper.js)
SCHOLARLY_USERNAME=your_scholarly_email@example.com
SCHOLARLY_PASSWORD=your_scholarly_password

# Supabase credentials (used by backend/src/uploadToSupabase.js and frontend)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Auth0 credentials (used by frontend for authentication)
VITE_AUTH0_DOMAIN=your-auth0-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your_auth0_client_id
VITE_AUTH0_REDIRECT_URI=http://localhost:5173/callback
```

**Important Notes:**
*   All frontend environment variables must be prefixed with `VITE_` for Vite to access them.
*   The Auth0 credentials are required for user authentication in the frontend.
*   The `SCHOLARLY_USERNAME` and `SCHOLARLY_PASSWORD` are used by the backend scraping script.

## Backend Usage

The backend scripts are responsible for scraping questions and uploading them to your Supabase database.

**1. Installation:**

Navigate to the backend directory and install the necessary dependencies:

```bash
cd backend
npm install
```

**2. Configuration:**

Before running the scraper, you **must** update the `DATA_PAGE_URL` constant within the `backend/src/scraper.js` file. This URL should point to the specific Scholarly quiz results page from which you want to scrape the "incorrectly answered" questions.

Example in `backend/src/scraper.js`:
```javascript
// ... other constants
const DATA_PAGE_URL = "https://exams.scholarlytraining.com//quiz/a/YOUR_SPECIFIC_QUIZ_ID_HERE"; // <-- UPDATE THIS
// ...
```

**3. Running the Scripts:**

You can run the scraper and uploader scripts individually or using the `runAll.js` master script.

*   **Using `runAll.js` (Recommended for a full cycle):**
    This script will first run the scraper and then, upon its completion, run the uploader.
    ```bash
    cd backend
    node runAll.js
    ```

*   **Running scripts individually:**
    1.  Run the scraper:
        ```bash
        cd backend
        node src/scraper.js
        ```
        This will generate `backend/src/scraped_data.csv`.
    2.  Run the uploader (after the scraper has finished):
        ```bash
        cd backend
        node src/uploadToSupabase.js
        ```
        This will read `scraped_data.csv` and upload its contents (including images) to Supabase.

**Important:** The backend scripts are intended to be run manually whenever you need to update your question bank in Supabase with questions from a new Scholarly trial test.

## Frontend Usage

The frontend is a React application built with Vite and TypeScript that displays random questions from your Supabase question bank with Auth0 authentication.

**1. Installation:**

Navigate to the frontend directory and install the necessary dependencies:

```bash
cd frontend
npm install
```

**2. Running the Development Server:**

To start the frontend application in development mode:

```bash
cd frontend
npm run dev
```

This will typically open the application in your web browser at `http://localhost:5173` (the port may vary).

**3. Authentication Flow:**

- Users must authenticate with Auth0 to access questions
- Unauthenticated users are redirected to login
- The app includes protected routes and authentication guards
- Logout functionality is available in the header

**4. Building for Production:**

To build the static files for deployment:

```bash
cd frontend
npm run build
```

This will create a `dist` folder inside the `frontend` directory, containing the optimized static assets.

## Deployment

*   **Frontend:** The frontend application (`frontend/`) is designed to be deployed as a **Static Site**. Services like Render.com, Vercel, or Netlify are excellent choices. You will typically configure:
    - Build command: `npm install && npm run build` (with `frontend` as the root directory)
    - Publish directory: `frontend/dist`
    - Environment variables: All `VITE_*` variables from your `.env.local` file
*   **Backend:** The backend scripts are not designed for continuous server deployment in this project. They are intended to be run manually from your local machine (or any machine with Node.js and the required setup) as needed to update the Supabase database.

---

## Features

- **Authentication**: Secure user authentication with Auth0
- **Protected Routes**: Questions are only accessible to authenticated users
- **Random Question Display**: Fetches and displays random questions from Supabase
- **Interactive UI**: Click options to see if answers are correct/incorrect
- **Image Support**: Displays question images, option images, and answer explanation images
- **Responsive Design**: Works on desktop and mobile devices
- **Modern Stack**: Built with React 18, TypeScript, and Vite for optimal performance

---

For more specific details about the frontend, please refer to the `frontend/README.md` file. 