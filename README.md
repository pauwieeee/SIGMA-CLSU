# SIGMA — Scholarship Information and Grants Management Analytics

SIGMA is the internal admin website for CLSU's Office of Admissions to manage student scholarships — see who has what scholarship, catch duplicate records, track expiring scholarships, and pull reports.

It's built with **React** (the website itself) and **Supabase** (the database and login system). There's no public sign-up — accounts are created manually by an admin.

---

## What the website can do

- **Dashboard** — a homepage with quick stats (total scholars, active scholarships, duplicate flags, expiring scholarships), charts of scholars by category/college, and a "Recent Activity" feed showing what admins have done recently.
- **Scholarship Categories** — browse and manage all scholarships, grouped into Institutional / Government / Private, with add, edit, and archive/restore.
- **Student Records** — view every student and their scholarship history, edit a student's profile (year level, GWA, org participation, contact info), and archive/restore or batch-update students (change status, term, etc.).
- **Bulk import** — upload a CSV/Excel file of students to add or update many records at once, with a report on which rows succeeded or failed.
- **Duplicate detection** — automatically flags a student if they end up with two active scholarships in the same term, so an admin can review and resolve it.
- **Notifications** — a bell icon with alerts for new duplicate flags, finished imports, and scholarships about to expire; click to mark as read, or "Mark all as read."
- **Reports & Analytics** — charts (scholars per college, trends over time) and exportable reports in PDF/Excel.
- **SIGMA Assistant** — an AI chat bubble where an admin can ask plain-English questions ("list of all scholars in Information Technology", "how many duplicate flags are open") and get a real answer pulled from the actual data.
- **Account Settings** — manage the logged-in admin's own account.

---

## Running it on your computer

1. Install the dependencies (one-time, or whenever `package.json` changes):
   ```
   npm install
   ```
2. Copy the example settings file and fill in your real values (see "Setting up Supabase" below):
   ```
   cp .env.example .env
   ```
3. Start it:
   ```
   npm run dev
   ```
4. Open the link it prints in your terminal (usually `http://localhost:5173`).

---

## Setting up Supabase (the database)

Supabase is where all the data lives (students, scholarships, accounts). You only need to do this once per project.

1. Create a free project at **supabase.com**.
2. Open the **SQL Editor** in your Supabase project and run each file in `supabase/migrations/` **in order** (0001, 0002, 0003...) — these create all the tables and rules.
3. Then run the files in `supabase/seed/` in order — these fill in starter data (colleges, programs, scholarship names).
4. Create your first login: go to **Authentication → Users → Add User** and set an email + password. This is the only way to make an admin account — there's no public sign-up page.
5. Copy your project's URL and public API key from **Project Settings → API**, and paste them into your `.env` file as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

If a migration file mentions `pg_cron` and gives an error, turn that feature on under **Database → Extensions** in your Supabase dashboard first, then re-run it.

---

## The SIGMA AI Assistant (chat feature)

The chat bubble in the corner of the app is powered by Google's Gemini AI. To make it work, add one more line to your `.env` file:

```
VITE_GEMINI_API_KEY=your-key-here
```

Get a free key from **aistudio.google.com/apikey**.

**Heads up:** this key is deliberately kept on the "client side," meaning it's technically visible to anyone who opens their browser's developer tools on the live site. This was an intentional tradeoff made for simplicity — if you'd rather keep it fully private, it would need to move to a Supabase server-side function instead (ask if you want that changed).

If a key you've used ever gets shared publicly (posted somewhere, pasted in a chat, etc.), treat it as compromised — go to Google AI Studio, delete it, and generate a new one.

The assistant automatically tries several AI models in order, so if one is slow or temporarily unavailable it quietly switches to the next one — you shouldn't notice anything except a normal reply.

---

## Publishing the website (deploying)

To put the finished site online for real (not just on your computer), it's deployed to **Vercel**:

1. Push your code to GitHub (`git push`).
2. In Vercel, import the GitHub repo.
3. Add the same three values from your `.env` file as **Environment Variables** in Vercel's project settings (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`).
4. Click Deploy.

After that, every time you `git push` new changes, Vercel automatically rebuilds and updates the live site.

---

## A few things worth knowing about how it works

- **Duplicate scholarship detection** happens automatically — whenever a student's scholarship record is added or changed, the system checks if they already have another active scholarship in the same term, and flags it if so.
- **"Expiring Soon" scholarships** are checked automatically once a day, rather than something an admin has to remember to update.
- **Dashboard trend numbers** (like "up 4% this term") are calculated from real data — if there isn't enough history to compare against yet, it honestly says "No prior data" instead of making up a number.
- **All admin accounts currently have full access** (there's just one role: Admin). If you later want more limited "Staff" or "Viewer" accounts with restricted permissions, that's a database change we can make — just ask.
