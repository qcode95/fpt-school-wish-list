# Wish Form Landing Page

Static HTML/CSS/JS landing page for collecting wishes, uploading one image to
Supabase Storage, and sending the result to Google Forms/Sheets.

## Configure

Configure these environment variables in Vercel:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_BUCKET`
- `GOOGLE_FORM_ACTION`
- `GOOGLE_FORM_FIELD_FULL_NAME`
- `GOOGLE_FORM_FIELD_PHONE`
- `GOOGLE_FORM_FIELD_WISH`
- `GOOGLE_FORM_FIELD_IMAGE_URL`

During deployment, `npm run build` generates the public `config.js` consumed by
the static frontend. Update values once in Vercel's Environment Variables
settings, then redeploy.

For local development, copy `config.example.js` to `config.js` and replace its
placeholder values. `config.js` is gitignored.

To find Google Form field names, open the form, choose **Get pre-filled link**,
fill sample values, and inspect the generated URL. Each value is paired with an
`entry.xxxxx` key. The action URL uses the same form ID and ends in
`/formResponse`.

The Storage bucket must allow anonymous uploads. Restrict the policy to the
single bucket and only permit image MIME types / reasonable file sizes.
Because this is a frontend-only project, the anon key is visible to visitors.
Never place a Supabase service-role key in `script.js`.

Google Forms requires `mode: "no-cors"` from a static site. The browser can
confirm that it dispatched the request, but cannot read Google's response.
Verify the first real submission in the linked Google Sheet.

## Supabase checklist

1. Create a public bucket matching `CONFIG.supabase.bucket`.
2. Add a narrowly scoped Storage policy allowing anonymous `INSERT` only into
   that bucket.
3. Set file-size and image MIME-type restrictions in the bucket settings.
4. Test one upload and confirm its public URL opens before publishing.


## Run locally

Serve the folder with any static server, for example:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy to Vercel

Import this repository into Vercel and deploy with no framework preset.
`vercel.json` runs the small configuration-generation build and configures
clean URLs plus basic security headers.

Using the Vercel CLI:

```powershell
vercel
vercel --prod
```
