const puppeteer = require("puppeteer");
const Papa = require("papaparse");
const fs = require("fs");
const path = require("path");
const dotenv = require('dotenv');

// Load environment variables from .env.local in the base directory
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// --- Configuration ---
// !! REPLACE THESE WITH ACTUAL VALUES FROM YOUR INSPECTION !!
const LOGIN_PAGE_URL = process.env.SCHOLARLY_SIGNIN_URL; // The URL the login form POSTs to (reverted to learn subdomain)
const USERNAME_SELECTOR = "input[name=email]"; // Name attribute of the username input
const PASSWORD_SELECTOR = "input[name=password]"; // Name attribute of the password input
const LOGIN_BUTTON_SELECTOR = "button[type=submit]"; // Selector for the login button
const USERNAME = process.env.SCHOLARLY_USERNAME;
const PASSWORD = process.env.SCHOLARLY_PASSWORD;

const QUIZZES_BUTTON_SELECTOR = "div[data-testid=quizzes]";
const DATA_PAGE_URL = process.env.SCHOLARLY_QUIZ_URL;

// Updated selectors for quiz content
const QUESTION_SELECTOR = "section#question-stem-content";
const OPTIONS_SELECTOR = "div.option-component>span";
const ANSWER_SELECTOR = "div.option-component:has(i.check)>span"; // Selects the span of the option div that contains an i.check descendant
const NEXT_BUTTON_SELECTOR = "button.naked-button.modal-nav-arrow--right"; // Corrected typo: aria-label

const OUTPUT_CSV_FILE = path.join(__dirname, "scraped_data.csv");
// --- End Configuration ---

async function clickViewMoreIfExists(page, containerSelector, questionCount) {
  try {
    const clickedViewMore = await page.evaluate((selector) => {
      const questionContainer = document.querySelector(selector);
      if (questionContainer) {
        const viewMoreElements = Array.from(questionContainer.querySelectorAll('button, a'));
        for (const el of viewMoreElements) {
          if (el.innerText && el.innerText.toLowerCase().includes('view more')) {
            // Check if the element is visible before clicking
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null) {
               el.click(); // Click the element
               return true; // Indicate that "view more" was clicked
            }
          }
        }
      }
      return false; // "view more" not found or clicked
    }, containerSelector);

    if (clickedViewMore) {
      console.log(`Clicked 'view more' link/button (Q_idx:${questionCount}). Waiting for content to expand...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for potential content expansion
      await page.screenshot({ path: `debug_after_view_more_q_idx${questionCount}.png` });
      console.log("Content hopefully expanded after 'view more' click.");
      return true;
    }
  } catch (e) {
    console.warn(`Error during 'view more' (Q_idx:${questionCount}) check/click:`, e.message);
    // Don't stop the process, just log and continue.
  }
  return false;
}

async function main() {
  console.log("Starting Puppeteer scraper...");
  let browser = null; // Declare browser outside try so it can be accessed in finally

  try {
    const POST_LOGIN_ELEMENT_SELECTOR =
      "header"; // IMPORTANT: Replace with a selector for an element visible only after successful login
    const SCREENSHOT_PATH_LOGIN = path.join(
      __dirname,
      "debug_screenshot_login.png"
    );
    const SCREENSHOT_PATH_DATA = path.join(
      __dirname,
      "debug_screenshot_data_page.png"
    );

    // These selectors are used by the page.evaluate function.
    // DATA_TABLE_SELECTOR: Should select the main container for each item (e.g., question) to be scraped.
    // If DATA_PAGE_URL shows one question at a time, 'body' or a main quiz wrapper is suitable.
    const DATA_TABLE_SELECTOR = "div"; // Example: 'body' or a more specific selector like 'div.quiz-content'

    // ITEM_NAME_SELECTOR and ITEM_VALUE_SELECTOR are used to get the 'name' and 'value' for the CSV.
    // Here, we use the globally defined QUESTION_SELECTOR for the name (question text)
    // and OPTIONS_SELECTOR for the value (options text).
    // These will be queried within the element(s) found by DATA_TABLE_SELECTOR.
    const ITEM_NAME_SELECTOR = QUESTION_SELECTOR;
    const ITEM_VALUE_SELECTOR = OPTIONS_SELECTOR;
    // Note: The global ANSWER_SELECTOR is not used by this specific page.evaluate block.
    // The resulting CSV will have 'name' (question) and 'value' (options).
    // 1. Launch Puppeteer
    browser = await puppeteer.launch({
      headless: "new", // Use 'new' headless mode. Set to false to see the browser UI for debugging.
      // args: ['--no-sandbox', '--disable-setuid-sandbox'] // Uncomment if running in a Docker/Linux environment
    });
    const page = await browser.newPage();

    // Optional: Set a realistic viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // 2. Navigate to Login Page and Perform Login
    console.log(`Navigating to login page: ${LOGIN_PAGE_URL}`);
    await page.goto(LOGIN_PAGE_URL, { waitUntil: "networkidle0" }); // Wait until network activity has ceased

    // Add a delay to ensure the login page is fully loaded
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log("Typing credentials...");
    await page.waitForSelector(USERNAME_SELECTOR, { visible: true });
    await page.type(USERNAME_SELECTOR, USERNAME);

    await page.waitForSelector(PASSWORD_SELECTOR, { visible: true });
    await page.type(PASSWORD_SELECTOR, PASSWORD);

    console.log("Clicking login button...");
    // It's often good to wait for navigation AFTER clicking a submit button
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }), // Waits for the page to load after click
      page.click(LOGIN_BUTTON_SELECTOR),
    ]);

    // 3. Verify Login (Optional but Recommended)
    // Check for an element that only appears after successful login
    try {
      await page.waitForSelector(POST_LOGIN_ELEMENT_SELECTOR, {
        timeout: 10000,
      }); // Wait up to 10 seconds
      console.log("Login appears successful.");
    } catch (err) {
      console.error("Login failed or post-login element not found.");
      await page.screenshot({ path: SCREENSHOT_PATH_LOGIN });
      console.log(
        `Screenshot saved to ${SCREENSHOT_PATH_LOGIN} for debugging.`
      );
      // console.log('Current page URL:', page.url());
      // const pageContent = await page.content();
      // console.log('Page content (first 500 chars):', pageContent.substring(0,500));
      throw new Error("Login verification failed."); // Re-throw to be caught by outer try-catch
    }
    await page.screenshot({ path: SCREENSHOT_PATH_LOGIN }); // Screenshot after successful login attempt
    console.log(`Login step screenshot saved to ${SCREENSHOT_PATH_LOGIN}`);

    // Add a delay to ensure the page is fully loaded after login
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Handle modal popup after login
    try {
      await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
      await page.click('input[type="checkbox"]');
      await page.click('button');
      console.log("Modal dismissed successfully.");
    } catch (e) {
      console.log("No modal found or failed to dismiss:", e.message);
    }

    // Click the 'Quizzes' button and wait for popup
    console.log("Clicking 'Quizzes' button...");
    
    // Wait for button to be visible and clickable
    await page.waitForSelector(QUIZZES_BUTTON_SELECTOR, { visible: true, timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000)); // Extra wait after modal
    
    const newPagePromise = new Promise(resolve => {
      browser.once('targetcreated', async target => {
        const newPage = await target.page();
        resolve(newPage);
      });
    });
    
    // Try clicking with force if normal click fails
    try {
      await page.click(QUIZZES_BUTTON_SELECTOR);
    } catch (e) {
      console.log("Normal click failed, trying force click:", e.message);
      await page.evaluate((selector) => {
        document.querySelector(selector).click();
      }, QUIZZES_BUTTON_SELECTOR);
    }
    const newPage = await newPagePromise;
    console.log("New window opened, switching to it...");
    
    await newPage.waitForNavigation({ waitUntil: 'networkidle0' });
    await newPage.screenshot({ path: "debug_quizzes_page.png" });
    console.log("Screenshot of quizzes page saved to debug_quizzes_page.png");

    // Extract cookies after login
    const cookies = await page.cookies();
    console.log("Cookies extracted after login:", cookies);

    // Navigate to the exams page in the same session
    console.log(`Navigating to exams page: ${DATA_PAGE_URL}`);
    await newPage.setCookie(...cookies);
    await newPage.goto(DATA_PAGE_URL, { waitUntil: "networkidle0" });
    await newPage.screenshot({ path: "debug_exams_page.png" });
    console.log("Screenshot of exams page saved to debug_exams_page.png");

    // --- NEW NAVIGATION FLOW ON EXAMS PAGE ---
    console.log("Navigating through 'View results' flow...");

    console.log("Looking for 'Questions' link/button using document.evaluate (XPath)...");
    const questionsButtonXPath = "//button[normalize-space(.)='Questions']"; // Assumes it's a button
    
    const questionsButtonElementHandle = await newPage.evaluateHandle((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    }, questionsButtonXPath);

    if (questionsButtonElementHandle && questionsButtonElementHandle.asElement()) {
      // It's good practice to ensure the element is not null before trying to click
      const element = questionsButtonElementHandle.asElement();
      if (element) {
        await element.click();
        console.log("Clicked 'Questions' link/button found by document.evaluate (XPath).");
      } else {
        await newPage.screenshot({ path: "debug_questions_button_not_found_by_evaluate_null_element.png" });
        throw new Error("Found handle for 'Questions' button, but asElement() was null. XPath: " + questionsButtonXPath);
      }
    } else {
      await newPage.screenshot({ path: "debug_questions_button_not_found_by_evaluate.png" });
      throw new Error("Could not find 'Questions' button using document.evaluate (XPath): " + questionsButtonXPath + ". Screenshot saved.");
    }
    // Add the screenshot back after the click, assuming it's successful.
    await newPage.screenshot({ path: "debug_after_questions_link.png"});
    
    // --- DROPDOWN FILTER LOGIC ---
    console.log("Attempting to apply dropdown filter for 'Incorrect' questions...");

    const DROPDOWN_TRIGGER_SELECTOR = "div.ember-basic-dropdown-trigger";
    try {
      await newPage.waitForSelector(DROPDOWN_TRIGGER_SELECTOR, { visible: true, timeout: 10000 });
      await newPage.click(DROPDOWN_TRIGGER_SELECTOR);
      console.log("Clicked dropdown trigger.");
    } catch (e) {
      console.error(`Could not find or click dropdown trigger: ${DROPDOWN_TRIGGER_SELECTOR}`, e);
      await newPage.screenshot({ path: "debug_dropdown_trigger_error.png" });
      throw new Error("Failed to find or click dropdown trigger."); // Or handle more gracefully
    }
    
    const DROPDOWN_OPTIONS_CONTAINER_SELECTOR = "ul.ember-power-select-options";
    try {
      await newPage.waitForSelector(DROPDOWN_OPTIONS_CONTAINER_SELECTOR, { visible: true, timeout: 5000 });
      console.log("Dropdown options container is visible.");
    } catch (e) {
      console.error(`Dropdown options container not visible: ${DROPDOWN_OPTIONS_CONTAINER_SELECTOR}`, e);
      await newPage.screenshot({ path: "debug_dropdown_options_container_error.png" });
      throw new Error("Dropdown options container did not become visible.");
    }

    const DROPDOWN_OPTION_ITEM_SELECTOR = "li.ember-power-select-option";
    const incorrectOptionTextStartsWith = "Incorrect";
    let clickedDropdownOption = false;

    try {
      const optionElements = await newPage.$$(DROPDOWN_OPTION_ITEM_SELECTOR);
      let targetOptionElement = null;

      for (const optionElement of optionElements) {
        const optionText = await newPage.evaluate(el => el.innerText, optionElement);
        if (optionText && optionText.trim().startsWith(incorrectOptionTextStartsWith)) {
          targetOptionElement = optionElement;
          break; 
        }
      }

      if (targetOptionElement) {
        await targetOptionElement.click();
        clickedDropdownOption = true;
      } else {
        console.warn(`Could not find a dropdown option starting with '${incorrectOptionTextStartsWith}'.`);
      }
    } catch (e) {
      console.error("Error while finding or clicking dropdown option:", e);
      await newPage.screenshot({ path: "debug_dropdown_interaction_error.png" });
      // Decide whether to throw or continue
    }

    if (clickedDropdownOption) {
      console.log(`Clicked the dropdown option starting with '${incorrectOptionTextStartsWith}'.`);
      await new Promise(resolve => setTimeout(resolve, 2500)); // Wait a bit longer for filter to apply
      await newPage.screenshot({ path: "debug_after_dropdown_incorrect_filter.png" });
    } else {
      console.warn(`Could not find or click a dropdown option starting with '${incorrectOptionTextStartsWith}'.`);
      await newPage.screenshot({ path: "debug_dropdown_option_not_found.png" });
      // Potentially throw an error if this filter is critical
      // throw new Error("Failed to apply dropdown filter for incorrect questions.");
    }
    // --- END OF DROPDOWN FILTER LOGIC ---

    const INCORRECT_QUESTION_SELECTOR = "button.naked-button.small.full-width"; // Placeholder - Reverted :first-of-type
    await newPage.waitForSelector(INCORRECT_QUESTION_SELECTOR, { timeout: 10000 }); // Increased timeout to 10 seconds
    await newPage.click(INCORRECT_QUESTION_SELECTOR);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for filter to apply
    await newPage.screenshot({ path: "debug_after_incorrect_question_selector.png"});
    console.log("Clicked button to display first filtered question (using INCORRECT_QUESTION_SELECTOR).");

    // Wait for the first question (of the filtered list) to load
    console.log("Waiting for first question (after filtering) to load...");
    // Using the existing QUESTION_SELECTOR, assuming it's still valid for the question text itself
    try {
      await newPage.waitForSelector(QUESTION_SELECTOR, { timeout: 10000 });
      console.log("First filtered question loaded.");
    } catch (error) {
      console.error("Filtered question selector not found. Check selectors and page state.");
      await newPage.screenshot({ path: "debug_filtered_question_not_found.png" });
      throw error; // Re-throw to stop execution if questions aren't found
    }

    // The DATA_TABLE_SELECTOR might need to be adjusted if the page structure for questions changes
    // For now, we assume it's still a general container or 'body'
    // const DATA_TABLE_SELECTOR = "div"; // This is already defined above, review if it needs change

    // --- End NEW NAVIGATION FLOW ---

    await page.screenshot({ path: SCREENSHOT_PATH_DATA }); // Screenshot of the data page
    console.log(`Data page screenshot saved to ${SCREENSHOT_PATH_DATA}`);

    console.log("Extracting data (for filtered questions)...");
    // Wait for the main data container to be present, if known
    try {
      await page.waitForSelector(DATA_TABLE_SELECTOR, { timeout: 15000 });
    } catch (e) {
      console.warn(
        `Data table selector "${DATA_TABLE_SELECTOR}" not found. Trying to proceed...`
      );
      // You might want to log current page HTML here for debugging if this happens
    }

    const scrapedData = [];

    // Function to extract question data
    const extractQuestionData = async () => {
      return await newPage.evaluate((QUESTION_SELECTOR, OPTIONS_SELECTOR, ANSWER_SELECTOR) => {
        const questionElement = document.querySelector(QUESTION_SELECTOR);
        let questionText = '';
        let questionImageUrls = [];

        if (questionElement) {
          // Try to preserve some table structure in text for questions
          let questionHtml = questionElement.innerHTML;

          // Basic table tag replacements for text representation
          // Replace closing row tags with a newline
          questionHtml = questionHtml.replace(/<\/tr\s*>/gi, '\n');
          // Replace closing cell tags (td, th) with a pipe separator
          questionHtml = questionHtml.replace(/<\/(td|th)\s*>/gi, ' | ');
          // Replace opening cell tags with a space to ensure separation if no content before
          questionHtml = questionHtml.replace(/<(td|th)[^>]*>/gi, ' '); 

          // Create a temporary div to parse this modified HTML and get text
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = questionHtml; // This will strip out remaining tags by only rendering their content

          // Now get innerText from this, which should have newlines and pipes
          questionText = tempDiv.innerText.trim();
          
          // Clean up: remove extra spaces around pipes, collapse multiple newlines/spaces
          questionText = questionText.replace(/\s*\|\s*/g, ' | ').replace(/(\n\s*)+/g, '\n').trim();

          questionElement.querySelectorAll('img').forEach(img => {
            if (img.src) {
              questionImageUrls.push(img.src);
            }
          });
        }

        const optionsData = Array.from(document.querySelectorAll(OPTIONS_SELECTOR)).map(optionSpan => {
          // Assuming OPTIONS_SELECTOR targets the span directly (e.g., "div.option-component>span")
          // The parent "div.option-component" would be optionSpan.parentElement
          const optionContainer = optionSpan.parentElement; // Adjust if OPTIONS_SELECTOR is different
          let optionText = optionSpan.innerText.trim();
          let optionImageUrls = [];
          if (optionContainer) {
            optionContainer.querySelectorAll('img').forEach(img => {
              if (img.src) {
                optionImageUrls.push(img.src);
              }
            });
          }
          return { text: optionText, imageUrls: optionImageUrls };
        });
        
        // For correctAnswer, we need to get its text and any images within it.
        // ANSWER_SELECTOR is "div.option-component:has(i.check)>span"
        const correctAnswerSpan = document.querySelector(ANSWER_SELECTOR);
        let correctAnswerText = '';
        let correctAnswerImageUrls = [];

        if (correctAnswerSpan) {
          correctAnswerText = correctAnswerSpan.innerText.trim();
          // The container of the correct answer is correctAnswerSpan.parentElement
          const correctAnswerContainer = correctAnswerSpan.parentElement; // Adjust if ANSWER_SELECTOR structure implies differently
          if (correctAnswerContainer) {
            correctAnswerContainer.querySelectorAll('img').forEach(img => {
              if (img.src) {
                correctAnswerImageUrls.push(img.src);
              }
            });
          }
        }

        return {
          question: questionText, // Renaming for consistency with CSV
          question_images: questionImageUrls, // New field for question images
          // Options will be an array of objects, handle in main loop for CSV
          options_data: optionsData, 
          answer: correctAnswerText, // Renaming for consistency with CSV
          answer_images: correctAnswerImageUrls, // New field for answer images
          note: 'term4'
        };
      }, QUESTION_SELECTOR, OPTIONS_SELECTOR, ANSWER_SELECTOR);
    };

    // Extract data from each question
    // Ensure questionCount is initialized before its first use with clickViewMoreIfExists
    let questionCount = 0; 
    
    // Click "view more" if it exists for the first question
    await clickViewMoreIfExists(newPage, QUESTION_SELECTOR, questionCount); // Pass current question index (0 for the first)
    let currentQuestionData = await extractQuestionData();
    
    while ((currentQuestionData.question || currentQuestionData.question_images) && questionCount < 100) { // Check for question text
      if (currentQuestionData.question || currentQuestionData.question_images) { // Ensure there's a question
        // Prepare data for CSV
        const csvRow = {
          question: currentQuestionData.question,
          question_images: JSON.stringify(currentQuestionData.question_images || []), // Store as JSON string
          // Join simple option texts for one CSV column, and image URLs for another.
          // This is a simplification. If more complex option structure is needed in DB, this will change.
          options: currentQuestionData.options_data.map(opt => opt.text).join(' | '),
          options_images: JSON.stringify(currentQuestionData.options_data.map(opt => opt.imageUrls)), // Store array of arrays of image URLs, preserving empty arrays for options without images
          answer: currentQuestionData.answer,
          answer_images: JSON.stringify(currentQuestionData.answer_images || []), // Store as JSON string
          note: currentQuestionData.note || ''
        };
        scrapedData.push(csvRow);
        questionCount++;
        console.log(`Scraped question ${questionCount}: ${currentQuestionData.question.substring(0, 50)}...`);
      }

      // Try to click next question button
      // TODO: Verify NEXT_BUTTON_SELECTOR is still correct for the "View results" questions page.
      // It might be a different "next" button or pagination mechanism.
      try {
        const nextButton = await newPage.$(NEXT_BUTTON_SELECTOR);
        if (!nextButton) {
          console.log("No more questions available (next button not found).");
          break;
        }
        
        await nextButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for next question to load
        
        // Click "view more" if it exists for the newly loaded question
        await clickViewMoreIfExists(newPage, QUESTION_SELECTOR, questionCount); // Pass current question index
        
        currentQuestionData = await extractQuestionData();
      } catch (error) {
        console.log("Navigation failed or reached end of questions.");
        // Take a screenshot for debugging
        await newPage.screenshot({ path: `debug_navigation_error_${questionCount}.png` });
        break;
      }
    }

    if (scrapedData.length === 0) {
      console.warn("No data scraped. Check selectors or page content.");
      // Take a screenshot for debugging
      await newPage.screenshot({ path: "debug_no_data.png" });
      console.log("Debug screenshot saved to debug_no_data.png");
      
      // Log the current page content for debugging
      const pageContent = await newPage.content();
      fs.writeFileSync('debug_page.html', pageContent);
      console.log("Page HTML saved to debug_page.html");
      return;
    }

    console.log(`Successfully scraped ${scrapedData.length} questions.`);

    // Save to CSV
    const csv = Papa.unparse(scrapedData);
    fs.writeFileSync(OUTPUT_CSV_FILE, csv);
    console.log(`Data saved to ${OUTPUT_CSV_FILE}`);
  } catch (error) {
    console.error("An error occurred in the scraper:", error);
    if (page) {
      // If page exists, try to get more debug info
      console.error("Current URL:", page.url());
      await page.screenshot({ path: "error_screenshot.png" });
      console.error("Error screenshot saved to error_screenshot.png");
    }
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser closed.");
    }
  }
}

main().catch(console.error);
