document.addEventListener('DOMContentLoaded', function () {
    const analyzeBtn = document.getElementById('analyze-btn');
    const exportBtn = document.getElementById('export-btn');
    const exportFormat = document.getElementById('export-format');
    const historyToggle = document.getElementById('history-toggle');
    const historyContainer = document.getElementById('history-container');
    let historyChart = null;
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

        // Load history
        loadHistory(tab.url);
    });

    // Re-analyze button
    analyzeBtn.addEventListener('click', function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            loadAndAnalyze(tabs[0].id);
        });
    });

    // History toggle
    historyToggle.addEventListener('click', function () {
        historyContainer.classList.toggle('hidden');
        historyToggle.textContent = historyContainer.classList.contains('hidden') ? 'Show History' : 'Hide History';
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
                    saveToHistory(message.data);
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

    function loadHistory(url) {
        chrome.storage.local.get(['seoHistory'], function (result) {
            const history = result.seoHistory || {};
            const siteHistory = history[url] || [];

            if (siteHistory.length > 0) {
                renderHistoryChart(siteHistory);
            } else {
                historyToggle.style.display = 'none';
            }
        });
    }

    function renderHistoryChart(history) {
        const ctx = document.getElementById('history-chart').getContext('2d');

        if (historyChart) {
            historyChart.destroy();
        }

        historyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: history.map(item => new Date(item.timestamp).toLocaleDateString()),
                datasets: [{
                    label: 'SEO Score',
                    data: history.map(item => item.score),
                    borderColor: '#4285f4',
                    backgroundColor: 'rgba(66, 133, 244, 0.1)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    function saveToHistory(data) {
        chrome.storage.local.get(['seoHistory'], function (result) {
            const history = result.seoHistory || {};
            const url = data.url;
            const entry = {
                score: data.score,
                timestamp: Date.now(),
                url: url
            };

            if (!history[url]) {
                history[url] = [];
            }

            history[url].push(entry);

            // Keep only last 10 entries per URL
            if (history[url].length > 10) {
                history[url] = history[url].slice(-10);
            }

            chrome.storage.local.set({ seoHistory: history }, function () {
                loadHistory(url);
            });
        });
    }

    function exportAsJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        saveAs(blob, `${filename}.json`);
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
        saveAs(blob, `${filename}.csv`);
    }

    function exportAsPDF(data, filename) {
        // Initialize jsPDF properly
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Set document properties
        doc.setProperties({
            title: 'SEO Analysis Report',
            subject: 'SEO analysis for ' + data.url,
            creator: 'Meta Tag & SEO Checker'
        });

        // Title
        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text('SEO Analysis Report', 105, 15, { align: 'center' });

        // Score with colored circle
        doc.setFontSize(16);
        doc.text('SEO Score:', 14, 30);

        // Draw score circle
        const scoreColor = getPDFScoreColor(data.score);
        doc.setFillColor(scoreColor.r, scoreColor.g, scoreColor.b);
        doc.circle(45, 25, 8, 'F');

        // Add score text
        doc.setTextColor(255, 255, 255);
        doc.text(data.score.toString(), 45, 29, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        doc.text(data.score.toString(), 60, 30);

        // Add analysis date
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Analyzed on: ' + new Date().toLocaleDateString(), 14, 40);

        // Meta tags section
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text('Meta Tags:', 14, 50);

        let y = 55;
        doc.setFontSize(10);
        data.metaTags.forEach(tag => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            const name = tag.name || tag.property || 'charset';
            const value = tag.content || tag.charset || '';
            doc.text(`${name}: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`, 20, y);
            y += 7;
        });

        // Recommendations section
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Recommendations:', 14, 20);

        y = 25;
        data.recommendations.forEach(rec => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(10);

            // Set color based on recommendation status
            const color = getRecommendationColor(rec.status);
            doc.setTextColor(color.r, color.g, color.b);

            doc.text(`• ${rec.message}`, 20, y);
            y += 7;
        });

        // Save the PDF
        doc.save(`${filename}.pdf`);
    }

    // Helper function for PDF color values
    function getPDFScoreColor(score) {
        if (score >= 80) return { r: 76, g: 175, b: 80 };   // Green
        if (score >= 50) return { r: 255, g: 193, b: 7 };   // Amber
        return { r: 244, g: 67, b: 54 };                   // Red
    }

    // Helper function for recommendation colors
    function getRecommendationColor(status) {
        switch (status) {
            case 'good': return { r: 46, g: 125, b: 50 };     // Dark green
            case 'warning': return { r: 255, g: 143, b: 0 };   // Orange
            case 'bad': return { r: 198, g: 40, b: 40 };      // Red
            default: return { r: 66, g: 66, b: 66 };          // Dark gray
        }
    }

    function getScoreColor(score, forPDF = false) {
        if (score >= 80) return forPDF ? [46, 125, 50] : '#4CAF50';
        if (score >= 50) return forPDF ? [255, 143, 0] : '#FFC107';
        return forPDF ? [198, 40, 40] : '#F44336';
    }
});