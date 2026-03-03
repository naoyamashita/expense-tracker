// State Management
const state = {
    expenses: [],
    viewingDate: new Date(),
    github: {
        user: localStorage.getItem('gh-user') || '',
        repo: localStorage.getItem('gh-repo') || '',
        token: localStorage.getItem('gh-token') || '',
        sha: '' // Keep track of the file SHA for updates
    }
};

const CSV_FILENAME = 'data.csv';

// Selectors
const monthlyTotalEl = document.getElementById('monthly-total');
const amountInput = document.getElementById('amount-input');
const descInput = document.getElementById('desc-input');
const addBtn = document.getElementById('add-btn');
const historyList = document.getElementById('history-list');
const periodNameEl = document.getElementById('period-name');
const periodDatesEl = document.getElementById('period-dates');
const prevBtn = document.getElementById('prev-period');
const nextBtn = document.getElementById('next-period');

// Settings Selectors
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');
const ghUserInp = document.getElementById('gh-user');
const ghRepoInp = document.getElementById('gh-repo');
const ghTokenInp = document.getElementById('gh-token');
const syncStatus = document.getElementById('sync-status');
const syncText = document.getElementById('sync-text');

// Helper: Format Number
const formatNumber = (num) => new Intl.NumberFormat('ja-JP').format(num);

// Logic: CSV Handling
const jsonToCsv = (data) => {
    const header = 'id,date,description,amount\n';
    const rows = data.map(item => `${item.id},${item.date},"${(item.description || '').replace(/"/g, '""')}",${item.amount}`).join('\n');
    return header + rows;
};

const csvToJson = (csv) => {
    const lines = csv.trim().split('\n');
    if (lines.length <= 1) return [];

    // Simple CSV parser
    return lines.slice(1).map(line => {
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 4) return null;
        return {
            id: parts[0],
            date: parts[1],
            description: parts[2].replace(/^"|"$/g, '').replace(/""/g, '"'),
            amount: parseFloat(parts[3])
        };
    }).filter(x => x !== null);
};

// GitHub API Logic
const showSync = (text) => {
    syncText.textContent = text;
    syncStatus.classList.remove('hide');
};
const hideSync = () => syncStatus.classList.add('hide');

const githubFetch = async () => {
    const { user, repo, token } = state.github;
    if (!user || !repo || !token) return;

    showSync('取得中...');
    try {
        const url = `https://api.github.com/repos/${user}/${repo}/contents/${CSV_FILENAME}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `token ${token}` }
        });

        if (res.status === 404) {
            state.expenses = [];
            state.github.sha = '';
            return;
        }

        const json = await res.json();
        state.github.sha = json.sha;
        const csvContent = atob(json.content); // Decode Base64
        state.expenses = csvToJson(decodeURIComponent(escape(csvContent))); // Handle UTF-8
    } catch (e) {
        console.error('Fetch failed', e);
        alert('GitHubからのデータ取得に失敗しました。設定を確認してください。');
    } finally {
        hideSync();
        updateUI();
    }
};

const githubPush = async () => {
    const { user, repo, token, sha } = state.github;
    if (!user || !repo || !token) return;

    showSync('保存中...');
    try {
        const url = `https://api.github.com/repos/${user}/${repo}/contents/${CSV_FILENAME}`;
        const csvContent = jsonToCsv(state.expenses);
        const encodedContent = btoa(unescape(encodeURIComponent(csvContent))); // Handle UTF-8

        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update ${CSV_FILENAME} via Expense Tracker`,
                content: encodedContent,
                sha: sha || undefined
            })
        });

        if (!res.ok) throw new Error('Push failed');
        const json = await res.json();
        state.github.sha = json.content.sha;
    } catch (e) {
        console.error('Push failed', e);
        alert('GitHubへの保存に失敗しました。');
    } finally {
        hideSync();
    }
};

// Logic: Period Calculation
const getPeriodInfo = (date) => {
    const d = new Date(date);
    const day = d.getDate();
    let year = d.getFullYear();
    let month = d.getMonth();

    if (day <= 10) month -= 1;

    const startOfPeriod = new Date(year, month, 11);
    const pYear = startOfPeriod.getFullYear();
    const pMonth = startOfPeriod.getMonth();

    const startDate = new Date(pYear, pMonth, 11);
    const endDate = new Date(pYear, pMonth + 1, 10, 23, 59, 59);

    return {
        name: `${pYear}年${pMonth + 1}月度`,
        start: startDate,
        end: endDate
    };
};

// Logic: Update UI
const updateUI = () => {
    const period = getPeriodInfo(state.viewingDate);
    periodNameEl.textContent = period.name;
    periodDatesEl.textContent = `${period.start.getMonth() + 1}/${period.start.getDate()} ~ ${period.end.getMonth() + 1}/${period.end.getDate()}`;

    const periodExpenses = state.expenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= period.start && expDate <= period.end;
    });

    const total = periodExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    monthlyTotalEl.textContent = formatNumber(total);

    historyList.innerHTML = '';
    periodExpenses.slice().reverse().forEach((exp) => {
        const item = document.createElement('li');
        item.className = 'history-item';
        const dateObj = new Date(exp.date);
        item.innerHTML = `
            <div class="item-info">
                <span class="item-desc">${exp.description || '出費'}</span>
                <span class="item-date">${dateObj.getMonth() + 1}/${dateObj.getDate()}</span>
            </div>
            <span class="item-amount">¥${formatNumber(exp.amount)}</span>
        `;
        historyList.appendChild(item);
    });
};

// Events
const addExpense = async () => {
    const amount = parseFloat(amountInput.value);
    const description = descInput.value.trim();

    if (isNaN(amount) || amount <= 0) {
        amountInput.focus();
        return;
    }

    const newExpense = {
        id: Date.now(),
        amount: amount,
        description: description,
        date: new Date().toISOString(),
    };

    state.expenses.push(newExpense);
    state.viewingDate = new Date();

    updateUI();

    amountInput.value = '';
    descInput.value = '';

    // Save to GitHub
    await githubPush();
};

const changePeriod = (direction) => {
    const currentPeriod = getPeriodInfo(state.viewingDate);
    const newDate = new Date(currentPeriod.start);
    direction === 'prev' ? newDate.setMonth(newDate.getMonth() - 1) : newDate.setMonth(newDate.getMonth() + 1);
    newDate.setDate(15);
    state.viewingDate = newDate;
    updateUI();
};

// Settings Events
const openSettings = () => {
    ghUserInp.value = state.github.user;
    ghRepoInp.value = state.github.repo;
    ghTokenInp.value = state.github.token;
    settingsModal.classList.remove('hide');
};

const closeSettings = () => settingsModal.classList.add('hide');

const saveSettings = async () => {
    const user = ghUserInp.value.trim();
    const repo = ghRepoInp.value.trim();
    const token = ghTokenInp.value.trim();

    if (!user || !repo || !token) {
        alert('すべての項目を入力してください。');
        return;
    }

    state.github.user = user;
    state.github.repo = repo;
    state.github.token = token;

    localStorage.setItem('gh-user', user);
    localStorage.setItem('gh-repo', repo);
    localStorage.setItem('gh-token', token);

    closeSettings();
    await githubFetch();
};

// Event Listeners
addBtn.addEventListener('click', addExpense);
prevBtn.addEventListener('click', () => changePeriod('prev'));
nextBtn.addEventListener('click', () => changePeriod('next'));
settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', saveSettings);

amountInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') descInput.focus(); });
descInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addExpense(); });

// Initialize
(async () => {
    // Migration check (optional but good for UX)
    const localData = localStorage.getItem('expenses');
    if (localData && state.expenses.length === 0) {
        console.log('Migrating local data...');
        state.expenses = JSON.parse(localData);
        // We'll prompt user to sync after they set up GitHub
    }

    if (state.github.token) {
        await githubFetch();
    } else {
        updateUI();
        openSettings(); // Prompt for setup if not configured
    }
})();
