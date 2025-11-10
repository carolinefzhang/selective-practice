const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const axios = require('axios'); // For downloading images
const { v4: uuidv4 } = require('uuid'); // For generating unique filenames

// Load environment variables from .env.local in the base directory
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
// For backend operations like image uploads, consider using the SERVICE_ROLE_KEY if ANON_KEY is too restricted
// const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) { // || (useServiceKey && !supabaseServiceKey)) {
  console.error("Supabase URL or Key is missing. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (and potentially VITE_SUPABASE_SERVICE_KEY) are set in .env.local");
  process.exit(1);
}

// Initialize Supabase client (use Anon key for general ops, but Storage might need elevated privileges or specific policies)
const supabase = createClient(supabaseUrl, supabaseAnonKey);
// const supabaseAdmin = useServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

const CSV_FILE_PATH = path.join(__dirname, 'scraped_data.csv');
const SUPABASE_TABLE_NAME = 'questions';
const SUPABASE_STORAGE_BUCKET = 'question-images'; // As confirmed by user

// Helper function to download an image and upload it to Supabase Storage
async function downloadAndUploadImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
    // console.warn(`Invalid image URL provided: ${imageUrl}`);
    return null;
  }
  try {
    console.log(`Downloading image from: ${imageUrl}`);
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    
    // Determine file extension (basic)
    const urlParts = imageUrl.split('.');
    const extension = urlParts.length > 1 ? urlParts.pop().split('?')[0].split('#')[0] : 'png'; // Default to png
    const fileName = `${uuidv4()}.${extension}`;
    const filePathInBucket = `public/${fileName}`; // Store in a 'public' folder within the bucket for easier public access if desired

    console.log(`Uploading ${fileName} to Supabase Storage bucket '${SUPABASE_STORAGE_BUCKET}' at path '${filePathInBucket}'...`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(filePathInBucket, imageBuffer, {
        contentType: response.headers['content-type'] || 'image/png', // Use actual content type if available
        upsert: false, // Don't overwrite if file with same name exists (uuid should make this rare)
      });

    if (uploadError) {
      console.error(`Error uploading image ${fileName} to Supabase Storage:`, uploadError);
      return null;
    }

    // Get the public URL of the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(filePathInBucket);

    if (!publicUrlData || !publicUrlData.publicUrl) {
        console.error(`Could not get public URL for ${filePathInBucket}`);
        return null;
    }
    console.log(`Successfully uploaded ${fileName}, Supabase URL: ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;

  } catch (error) {
    console.error(`Failed to download or upload image from ${imageUrl}:`, error.message);
    if (error.response && error.response.status === 404) {
        console.warn("Image URL returned 404 Not Found.");
    }
    return null;
  }
}

async function uploadCsvToSupabase() {
  console.log(`Reading CSV file from: ${CSV_FILE_PATH}`);

  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`Error: CSV file not found at ${CSV_FILE_PATH}`);
    return;
  }

  const csvFileContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');

  Papa.parse(csvFileContent, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      let processedRows = 0;
      const totalRows = results.data.length;
      const allDataToInsert = [];

      for (const row of results.data) {
        processedRows++;
        console.log(`\nProcessing CSV row ${processedRows}/${totalRows}: ${row.question ? row.question.substring(0,30) : 'NO_QUESTION_TEXT'}...`);

        let questionSupabaseImageUrls = [];
        if (row.question_images) {
          try {
            const originalQuestionImageUrls = JSON.parse(row.question_images);
            if (Array.isArray(originalQuestionImageUrls)) {
              for (const imgUrl of originalQuestionImageUrls) {
                const supUrl = await downloadAndUploadImage(imgUrl);
                if (supUrl) questionSupabaseImageUrls.push(supUrl);
              }
            }
          } catch (e) { console.error("Error parsing question_images JSON:", e); }
        }

        let answerSupabaseImageUrls = [];
        if (row.answer_images) {
          try {
            const originalAnswerImageUrls = JSON.parse(row.answer_images);
            if (Array.isArray(originalAnswerImageUrls)) {
              for (const imgUrl of originalAnswerImageUrls) {
                const supUrl = await downloadAndUploadImage(imgUrl);
                if (supUrl) answerSupabaseImageUrls.push(supUrl);
              }
            }
          } catch (e) { console.error("Error parsing answer_images JSON:", e); }
        }
        
        // Process options and their images for JSONB
        let optionsForSupabaseJsonb = [];
        const optionTexts = row.options ? row.options.split(' | ') : [];
        let originalOptionImageArrays = [];
        if (row.options_images) {
            try {
                originalOptionImageArrays = JSON.parse(row.options_images);
            } catch(e) { console.error("Error parsing options_images JSON:", e); }
        }

        for (let i = 0; i < optionTexts.length; i++) {
            const optionText = optionTexts[i];
            const originalImageUrlsForOption = (Array.isArray(originalOptionImageArrays) && Array.isArray(originalOptionImageArrays[i])) ? originalOptionImageArrays[i] : [];
            let supabaseImageUrlsForOption = [];

            for (const imgUrl of originalImageUrlsForOption) {
                const supUrl = await downloadAndUploadImage(imgUrl);
                if (supUrl) supabaseImageUrlsForOption.push(supUrl);
            }
            optionsForSupabaseJsonb.push({ text: optionText, supabase_urls: supabaseImageUrlsForOption });
        }

        allDataToInsert.push({
          question: row.question,
          options: row.options ? row.options.split(' | ') : [], // Keep original text options for the TEXT column if still needed by user
          answer: row.answer,
          question_images: questionSupabaseImageUrls.length > 0 ? questionSupabaseImageUrls : null, // Supabase TEXT[] for question images
          options_images: optionsForSupabaseJsonb.length > 0 ? optionsForSupabaseJsonb : null,      // Supabase JSONB for options with their images
          answer_images: answerSupabaseImageUrls.length > 0 ? answerSupabaseImageUrls : null,    // Supabase TEXT[] for answer images
          note: row.note || null,
        });
      }

      if (allDataToInsert.length === 0) {
        console.log("No data to upload from CSV.");
        return;
      }

      console.log(`Attempting to insert ${allDataToInsert.length} rows into Supabase table '${SUPABASE_TABLE_NAME}'...`);

      try {
        const { data, error } = await supabase
          .from(SUPABASE_TABLE_NAME)
          .insert(allDataToInsert)
          .select(); // .select() can be useful to get back the inserted data or confirm success

        if (error) {
          console.error('Error inserting data into Supabase:', error);
          if (error.details) console.error('Error details:', error.details);
          if (error.hint) console.error('Error hint:', error.hint);
          return;
        }
        console.log(`Successfully inserted ${data ? data.length : 0} rows into Supabase.`);
        if (data) {
            console.log("Inserted data sample (first row):", JSON.stringify(data[0], null, 2));
        }

      } catch (err) {
        console.error('An unexpected error occurred during Supabase operation:', err);
      }
    },
    error: (error) => {
      console.error('Error parsing CSV file:', error.message);
    }
  });
}

// Run the upload function
uploadCsvToSupabase().catch(console.error); 