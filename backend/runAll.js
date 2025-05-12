const { exec } = require('child_process');
const path = require('path');

// Define paths to the scripts relative to runAll.js (which will be in backend/)
const scraperScriptPath = path.join(__dirname, 'src', 'scraper.js');
const uploaderScriptPath = path.join(__dirname, 'src', 'uploadToSupabase.js');

function runScript(scriptPath, scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`--- Starting ${scriptName} ---`);
    // Ensure paths are correctly quoted if they contain spaces, though __dirname usually doesn't.
    // We execute from the backend directory, so paths for scripts should be like src/script.js
    const command = `node "${scriptPath}"`;
    
    const childProcess = exec(command, { cwd: __dirname }); // Run command from backend directory

    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data); // Stream stdout
    });

    childProcess.stderr.on('data', (data) => {
      process.stderr.write(data); // Stream stderr
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`--- ${scriptName} finished successfully ---`);
        resolve();
      } else {
        console.error(`--- ${scriptName} failed with exit code ${code} ---`);
        reject(new Error(`${scriptName} failed.`));
      }
    });

    childProcess.on('error', (err) => {
      console.error(`--- Failed to start ${scriptName}: ${err.message} ---`);
      reject(err);
    });
  });
}

async function main() {
  try {
    await runScript(scraperScriptPath, 'scraper.js');
    // If scraper was successful, proceed to upload
    await runScript(uploaderScriptPath, 'uploadToSupabase.js');
    console.log('--- All scripts executed successfully ---');
  } catch (error) {
    console.error('--- Main process failed:', error.message);
    process.exit(1); // Exit with error code if any script fails
  }
}

main(); 