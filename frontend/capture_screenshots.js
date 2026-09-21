const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, '../../docs/screenshots');

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  
  const takeScreenshots = async (theme) => {
    console.log(`Starting ${theme} mode captures...`);
    
    // Desktop Viewport
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      colorScheme: theme
    });
    const page = await context.newPage();
    
    // Set theme in localStorage if app uses it
    await page.goto(BASE_URL);
    await page.evaluate((theme) => {
      localStorage.setItem('vite-ui-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }, theme);
    
    // 1. Dashboard
    console.log("Capturing Dashboard...");
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(3000); // Wait for charts to animate
    await page.screenshot({ path: path.join(OUTPUT_DIR, `dashboard_${theme}.png`) });

    // AI Insight Banner
    console.log("Capturing AI Insight Banner...");
    const banner = page.locator('text="AI Analytical Insights Platform"');
    if (await banner.isVisible()) {
        await banner.screenshot({ path: path.join(OUTPUT_DIR, `ai_banner_${theme}.png`) });
    }

    // 2. India Heatmap & Ask Nexus Trace/Final
    // Need to trigger Ask Nexus query
    console.log("Capturing Ask Nexus...");
    await page.click('button[aria-label="Ask Nexus"]');
    await page.waitForTimeout(1000);
    // Fill question
    await page.fill('input[placeholder="Search or ask..."]', "Show the top fraud risk claims this month");
    await page.press('input[placeholder="Search or ask..."]', 'Enter');
    
    // Capture mid-answer with agent trace
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `ask_nexus_trace_${theme}.png`) });
    
    // Wait for final answer
    await page.waitForTimeout(8000); 
    await page.screenshot({ path: path.join(OUTPUT_DIR, `ask_nexus_final_${theme}.png`) });
    
    // 3. Forecast Chart (Assuming on Portfolio or Claims page)
    console.log("Capturing Forecast...");
    await page.goto(`${BASE_URL}/claims`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `forecast_chart_${theme}.png`) });

    // 4. Fraud Graph
    console.log("Capturing Fraud Graph...");
    await page.goto(`${BASE_URL}/fraud`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `fraud_graph_${theme}.png`) });

    // 5. Case Management Queue
    console.log("Capturing Case Queue...");
    await page.goto(`${BASE_URL}/cases`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `case_queue_${theme}.png`) });
    
    // 6. Audit Log
    console.log("Capturing Audit Log...");
    await page.goto(`${BASE_URL}/audit`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `audit_log_${theme}.png`) });

    // 7. Executive Briefing
    console.log("Capturing Executive Briefing...");
    await page.goto(`${BASE_URL}/briefing`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `executive_briefing_${theme}.png`) });
    
    // 8. Model Monitoring
    console.log("Capturing Model Monitoring...");
    await page.goto(`${BASE_URL}/model-monitor`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `model_monitoring_${theme}.png`) });

    await context.close();

    // Mobile Viewport
    if (theme === 'light') {
        console.log(`Starting mobile captures...`);
        const mobileContext = await browser.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true
        });
        const mobilePage = await mobileContext.newPage();
        
        console.log("Capturing Mobile Dashboard...");
        await mobilePage.goto(`${BASE_URL}/`);
        await mobilePage.waitForTimeout(3000);
        await mobilePage.screenshot({ path: path.join(OUTPUT_DIR, `dashboard_mobile.png`) });
        await mobileContext.close();
    }
  };

  await takeScreenshots('light');
  await takeScreenshots('dark');

  await browser.close();
  console.log("Screenshots captured successfully!");
})();
