s ye ? oconst puppeteer = require('puppeteer');

async function testPuppeteer() {
    console.log('🧪 Testing Puppeteer initialization...');
    
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });
        
        console.log('✅ Puppeteer launched successfully');
        
        const page = await browser.newPage();
        console.log('✅ New page created');
        
        await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle0', timeout: 30000 });
        console.log('✅ WhatsApp Web loaded successfully');
        
        await browser.close();
        console.log('✅ Browser closed successfully');
        
        console.log('🎉 Puppeteer test completed successfully!');
        
    } catch (error) {
        console.error('❌ Puppeteer test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testPuppeteer();
