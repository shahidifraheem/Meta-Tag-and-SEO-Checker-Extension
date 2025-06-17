// Listen for analysis request
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.type === 'ANALYZE_PAGE') {
        const analysisResult = analyzePage();
        chrome.runtime.sendMessage({
            type: 'SEO_ANALYSIS_RESULT',
            data: analysisResult
        });
    }
});

function analyzePage() {
    // Get all meta tags
    const metaTags = Array.from(document.querySelectorAll('meta')).map(meta => {
        return {
            name: meta.getAttribute('name'),
            property: meta.getAttribute('property'),
            content: meta.getAttribute('content') || '',
            charset: meta.getAttribute('charset')
        };
    }).filter(tag => tag.name || tag.property || tag.charset);

    // Get title
    const title = document.title;
    const titleTag = { name: 'title', content: title };
    metaTags.unshift(titleTag);

    // Get canonical URL
    const canonical = document.querySelector('link[rel="canonical"]')?.href;

    // Check for important tags
    const hasDescription = metaTags.some(tag => tag.name === 'description');
    const hasViewport = metaTags.some(tag => tag.name === 'viewport');
    const hasRobots = metaTags.some(tag => tag.name === 'robots');
    const hasCanonical = !!canonical;
    const hasOgTitle = metaTags.some(tag => tag.property === 'og:title');
    const hasOgDescription = metaTags.some(tag => tag.property === 'og:description');
    const hasOgImage = metaTags.some(tag => tag.property === 'og:image');

    // Calculate SEO score (simplified)
    let score = 0;
    const checks = [];

    // Title check
    if (title && title.length >= 30 && title.length <= 60) {
        score += 20;
        checks.push({ status: 'good', message: 'Title tag has good length (30-60 characters)' });
    } else {
        checks.push({ status: 'warning', message: `Title tag should be 30-60 characters (current: ${title.length})` });
    }

    // Description check
    const descriptionTag = metaTags.find(tag => tag.name === 'description');
    if (descriptionTag) {
        const descLength = descriptionTag.content.length;
        if (descLength >= 70 && descLength <= 160) {
            score += 20;
            checks.push({ status: 'good', message: 'Description has good length (70-160 characters)' });
        } else {
            checks.push({ status: 'warning', message: `Description should be 70-160 characters (current: ${descLength})` });
        }
    } else {
        checks.push({ status: 'bad', message: 'Missing meta description tag' });
    }

    // Viewport check
    if (hasViewport) {
        score += 10;
        checks.push({ status: 'good', message: 'Viewport meta tag present (good for mobile)' });
    } else {
        checks.push({ status: 'bad', message: 'Missing viewport meta tag (bad for mobile)' });
    }

    // Canonical check
    if (hasCanonical) {
        score += 10;
        checks.push({ status: 'good', message: 'Canonical link present (good for SEO)' });
    } else {
        checks.push({ status: 'warning', message: 'Consider adding a canonical link' });
    }

    // OpenGraph check
    if (hasOgTitle && hasOgDescription) {
        score += 10;
        checks.push({ status: 'good', message: 'OpenGraph tags present (good for social sharing)' });
    } else {
        if (!hasOgTitle) checks.push({ status: 'warning', message: 'Consider adding og:title tag' });
        if (!hasOgDescription) checks.push({ status: 'warning', message: 'Consider adding og:description tag' });
    }

    // Heading structure check
    const headings = {
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('h2').length,
        h3: document.querySelectorAll('h3').length
    };

    if (headings.h1 === 1) {
        score += 10;
        checks.push({ status: 'good', message: 'Good heading structure (1 H1 tag)' });
    } else {
        checks.push({
            status: headings.h1 === 0 ? 'bad' : 'warning',
            message: headings.h1 === 0 ? 'Missing H1 tag' : `Multiple H1 tags (${headings.h1})`
        });
    }

    // Image alt check (sample)
    const images = document.querySelectorAll('img');
    const imagesWithoutAlt = Array.from(images).filter(img => !img.alt).length;
    const altPercentage = images.length > 0 ?
        Math.round(((images.length - imagesWithoutAlt) / images.length) * 100) : 100;

    if (altPercentage >= 90) {
        score += 10;
        checks.push({ status: 'good', message: `Good image alt text coverage (${altPercentage}%)` });
    } else {
        checks.push({ status: 'warning', message: `${imagesWithoutAlt} images missing alt text (${altPercentage}% coverage)` });
    }

    // Robots check
    if (hasRobots) {
        checks.push({ status: 'good', message: 'Robots meta tag present' });
    } else {
        checks.push({ status: 'info', message: 'No robots meta tag (search engines will index by default)' });
    }

    // Ensure score doesn't exceed 100
    score = Math.min(100, score);

    return {
        url: window.location.href,
        score: score,
        metaTags: metaTags,
        recommendations: checks,
        canonical: canonical,
        ogImage: hasOgImage ? metaTags.find(tag => tag.property === 'og:image').content : null
    };
}