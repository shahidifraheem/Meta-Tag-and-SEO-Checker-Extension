document.addEventListener('DOMContentLoaded', function () {
    const analyzeBtn = document.getElementById('analyze-btn');
    const exportBtn = document.getElementById('export-btn');
    const exportFormat = document.getElementById('export-format');
    let currentAnalysis = null;

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Get current tab and analyze its content
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs[0];
        loadAndAnalyze(tab.id);
    });

    // Re-analyze button
    analyzeBtn.addEventListener('click', function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            loadAndAnalyze(tabs[0].id);
        });
    });

    // Export button
    exportBtn.addEventListener('click', function () {
        if (!currentAnalysis) return;

        const format = exportFormat.value;
        const filename = `seo-report-${new Date().toISOString().slice(0, 10)}`;

        switch (format) {
            case 'json':
                exportAsJSON(currentAnalysis, filename);
                break;
            case 'csv':
                exportAsCSV(currentAnalysis, filename);
                break;
            case 'pdf':
                exportAsPDF(currentAnalysis, filename);
                break;
        }
    });

    function loadAndAnalyze(tabId) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['js/content.js']
        }, () => {
            // Listen for messages from content script
            chrome.runtime.onMessage.addListener(function (message) {
                if (message.type === 'SEO_ANALYSIS_RESULT') {
                    currentAnalysis = message.data;
                    displayResults(message.data);
                }
            });

            // Request analysis from content script
            chrome.tabs.sendMessage(tabId, { type: 'ANALYZE_PAGE' });
        });
    }

    function displayResults(data) {
        // Display SEO score
        const scoreElement = document.querySelector('.score-circle');
        scoreElement.textContent = data.score;
        scoreElement.style.backgroundColor = getScoreColor(data.score);

        // Display meta tags
        const metaTagsContainer = document.getElementById('meta-tags');
        metaTagsContainer.innerHTML = '';

        data.metaTags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'meta-tag';
            tagElement.innerHTML = `<strong>${tag.name || tag.property || 'charset'}:</strong> ${tag.content || tag.charset || ''}`;
            metaTagsContainer.appendChild(tagElement);
        });

        // Display recommendations
        const recommendationsContainer = document.getElementById('recommendations-list');
        recommendationsContainer.innerHTML = '';

        data.recommendations.forEach(rec => {
            const recElement = document.createElement('div');
            recElement.className = `recommendation ${rec.status}`;
            recElement.textContent = rec.message;
            recommendationsContainer.appendChild(recElement);
        });

        // Display social preview
        updateSocialPreview(data);
    }

    function updateSocialPreview(data) {
        const ogImage = data.metaTags.find(tag => tag.property === 'og:image')?.content;
        const ogTitle = data.metaTags.find(tag => tag.property === 'og:title')?.content || data.metaTags.find(tag => tag.name === 'title')?.content;
        const ogDescription = data.metaTags.find(tag => tag.property === 'og:description')?.content ||
            data.metaTags.find(tag => tag.name === 'description')?.content;
        const url = new URL(data.url);

        // Facebook
        document.getElementById('facebook-title').textContent = ogTitle || 'No title';
        document.getElementById('facebook-description').textContent = ogDescription || 'No description';
        document.getElementById('facebook-url').textContent = url.hostname;

        // Twitter
        document.getElementById('twitter-title').textContent = ogTitle || 'No title';
        document.getElementById('twitter-description').textContent = ogDescription || 'No description';
        document.getElementById('twitter-url').textContent = url.hostname;

        // Set images
        if (ogImage) {
            document.getElementById('facebook-image').style.backgroundImage = `url(${ogImage})`;
            document.getElementById('twitter-image').style.backgroundImage = `url(${ogImage})`;
        } else {
            document.getElementById('facebook-image').style.backgroundImage = '';
            document.getElementById('twitter-image').style.backgroundImage = '';
        }
    }

    function exportAsJSON(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `seo-report-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    }

    function exportAsCSV(data, filename) {
        let csv = 'Category,Value,Status\n';

        // Meta tags
        data.metaTags.forEach(tag => {
            const name = tag.name || tag.property || 'charset';
            const value = tag.content || tag.charset || '';
            csv += `"Meta: ${name}","${value.replace(/"/g, '""')}","Info"\n`;
        });

        // Recommendations
        data.recommendations.forEach(rec => {
            csv += `"Recommendation","${rec.message.replace(/"/g, '""')}","${rec.status}"\n`;
        });

        // Score
        csv += `"SEO Score","${data.score}","Score"\n`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // Create invisible download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    function exportAsPDF(data) {
        const html = `
    <style>
        body { font-family: Arial; padding: 20px; }
        h1 { color: #2c3e50; }
        .score { font-size: 24px; color: #4CAF50; }
    </style>
    <h1>SEO Report for ${data.url}</h1>
    <div class="score">SEO Score: ${data.score}/100</div>
    <!-- Add other report content -->
    `;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.print();
    }

    function getScoreColor(score, forPDF = false) {
        if (score >= 80) return forPDF ? [46, 125, 50] : '#4CAF50';
        if (score >= 50) return forPDF ? [255, 143, 0] : '#FFC107';
        return forPDF ? [198, 40, 40] : '#F44336';
    }
});