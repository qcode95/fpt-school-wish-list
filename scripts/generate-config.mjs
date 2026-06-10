import { writeFile } from "node:fs/promises";

const requiredVariables = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_BUCKET",
  "SUPABASE_WISHES_TABLE",
  "GOOGLE_FORM_ACTION",
  "GOOGLE_FORM_FIELD_FULL_NAME",
  "GOOGLE_FORM_FIELD_PHONE",
  "GOOGLE_FORM_FIELD_WISH",
  "GOOGLE_FORM_FIELD_IMAGE_URL",
];

const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length) {
  throw new Error(`Missing environment variables: ${missingVariables.join(", ")}`);
}

const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    bucket: process.env.SUPABASE_BUCKET,
    wishesTable: process.env.SUPABASE_WISHES_TABLE,
  },
  googleForm: {
    action: process.env.GOOGLE_FORM_ACTION,
    fields: {
      fullName: process.env.GOOGLE_FORM_FIELD_FULL_NAME,
      phone: process.env.GOOGLE_FORM_FIELD_PHONE,
      wish: process.env.GOOGLE_FORM_FIELD_WISH,
      imageUrl: process.env.GOOGLE_FORM_FIELD_IMAGE_URL,
    },
  },
};

await writeFile("config.js", `window.APP_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
console.log("Generated config.js");
