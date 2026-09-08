# Firecracker Worker Study — Hosted Web App

A web app version of the proforma scanner: your student opens a URL (works
on phone or laptop), uploads photos, Claude reads them, and the data is
stored centrally — retrievable by you anytime, from anywhere, by opening
the same URL and exporting to Excel.

This is different from the earlier tools:
- Not a Claude artifact (no Claude account/subscription needed to use it)
- Not a local script (nothing to install on the student's machine)
- Data lives in a small free cloud database, not in one browser or laptop

---

## Before you deploy: an important note on data

This app will store worker **names, addresses, and health information**
in a third-party cloud database (Upstash) accessed through a shared app
password. That's a reasonable setup for a student pilot, but it's worth
being clear-eyed about: a shared password is basic protection, not the
same as an access-controlled research data system. If your study's ethics
approval / IRB has specific requirements about where identifiable health
data can be stored, check that this setup satisfies them before relying on
it for real participant data — swap in de-identified worker codes instead
of names if you're at all unsure.

---

## One-time setup (about 10 minutes)

### 1. Push this folder to a new GitHub repo
Same process as before: create a new repo (e.g. `firecracker-webapp`),
upload all the files in this folder (`index.html`, the `api/` folder,
`package.json`, `.gitignore`, this README) via "uploading an existing
file" on the repo page.

### 2. Create a free Vercel account
Go to [vercel.com](https://vercel.com) → Sign Up → **"Continue with
GitHub"**. This links your GitHub account so Vercel can deploy straight
from your repos.

### 3. Import the repo into Vercel
- On your Vercel dashboard, click **Add New → Project**
- Find `firecracker-webapp` in the list and click **Import**
- Leave all settings as default (it will detect this as a plain static
  project with serverless functions — no build step needed)
- Click **Deploy**. It'll finish in under a minute, but it won't work yet
  — you still need to add the secrets below.

### 4. Add a free Upstash Redis database
- In your new Vercel project, go to the **Storage** tab (or **Integrations
  → Browse Marketplace** depending on Vercel's current layout)
- Search for **Upstash** and add it
- Follow its prompts to create a free Redis database and connect it to
  this project — Vercel will automatically add two environment variables
  for you: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

*(If Vercel's Storage/Marketplace flow looks different by the time you do
this — these things change — search "Vercel Upstash integration" for the
current steps. The end goal is just: those two environment variables
present in your project settings.)*

### 5. Add your own two environment variables
Still in the project, go to **Settings → Environment Variables** and add:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from the "dataentry" workspace |
| `APP_PASSWORD` | Any password you choose — this is what you'll give your student |

### 6. Redeploy
Environment variables only take effect on a fresh deploy. Go to the
**Deployments** tab, click the **⋯** menu on the latest deployment, and
choose **Redeploy**.

### 7. Test it yourself first
Open the URL Vercel gives you (something like
`firecracker-webapp.vercel.app`), enter the `APP_PASSWORD` you set, and
try uploading one worker's photos before handing it to your student.

---

## Giving it to your student

Send them two things, **separately** (not in the same message):
1. The URL (e.g. `https://firecracker-webapp.vercel.app`)
2. The `APP_PASSWORD`

They open the link on their phone or laptop, enter the password once (it's
remembered after that), and follow the same workflow as before: upload →
extract → review each section → save → repeat.

---

## Retrieving the data anytime

Open the same URL yourself, enter the password, and either:
- Browse the **"Saved workers"** list on the left, or
- Click **"Export all to Excel"** to download everything as a `.xlsx` file
  — same 201-column format as before, with a "Fields to Verify" column
  flagging anything Claude wasn't confident about.

Data persists in the database regardless of which device or browser
anyone uses to access the app — that's the point of moving off local
browser storage.

---

## Known limits to keep in mind

- **Upload size per worker**: each extraction step sends all of a
  worker's photos in one request, and free hosting plans typically cap
  request size around 4–4.5 MB. The app already shrinks photos before
  sending, but a worker with many high-resolution pages could still hit
  this — if a worker consistently fails to extract, try re-photographing
  their pages a bit smaller/more compressed, or fewer at a time.
- **Free tier ceilings**: Vercel and Upstash's free tiers are generous for
  a study of this size (hundreds of workers), but if usage grows a lot
  (many students, ongoing over months), it's worth glancing at each
  platform's usage dashboard occasionally.
- **No per-user accounts**: everyone with the password sees and can edit
  the same shared dataset. Fine for one student; if you add more people,
  everyone's using the same password and same pool of data.

---

## If something breaks

| Symptom | Likely cause |
|---|---|
| "Wrong or missing app password" | `APP_PASSWORD` env var not set, or not redeployed after setting it |
| Extraction fails on every section | Check `ANTHROPIC_API_KEY` is set correctly and the workspace has credit |
| Saved workers don't appear / export is empty | Check the Upstash integration is connected and env vars are present |
| Page loads but looks broken/blank | Check the browser console (rare, but would indicate a deploy issue — check Vercel's deployment logs) |
