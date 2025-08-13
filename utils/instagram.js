const targetUrl = document.getElementById('linkInput').value;
const btnCopy = document.getElementById('btnCopy');

btnCopy.addEventListener('click', () => {
    if (navigator.clipboard) {
    navigator.clipboard.writeText(targetUrl)
        .then(() => alert('✅ Link copiado! Cole no navegador.'))
        .catch(() => fallbackCopy(targetUrl));
    } else {
    fallbackCopy(targetUrl);
    }
});

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
    document.execCommand('copy');
    alert('✅ Link copiado! Cole no navegador.');
    } catch (err) {
    alert('Link: ' + text);
    }
    document.body.removeChild(textarea);
}

function openBrowser() {
    const methods = [
    () => window.open(targetUrl, '_blank', 'noopener,noreferrer'),
    () => window.location.href = targetUrl,
    () => window.location.replace(targetUrl),
    () => window.top.location.href = targetUrl
    ];
    
    methods.forEach((method, i) => {
    setTimeout(() => {
        try { method(); } catch(e) { console.log('Method', i, 'failed'); }
    }, i * 200);
    });
}

function copyUrl() {
    if (navigator.clipboard) {
    navigator.clipboard.writeText(targetUrl).then(() => {
        alert('✅ Link copiado! Cole no navegador.');
    });
    } else {
    const textarea = document.createElement('textarea');
    textarea.value = targetUrl;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        alert('✅ Link copiado!');
    } catch (err) {
        alert('Link: ' + targetUrl);
    }
    document.body.removeChild(textarea);
    }
}

// Auto-redirect após 3 segundos
setTimeout(openBrowser, 3000);