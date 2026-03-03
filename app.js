// State Management
const state = {
    expenses: [],
    subscriptions: [],
    viewingDate: new Date(),
    github: {
        user: localStorage.getItem('gh-user') || '',
        repo: localStorage.getItem('gh-repo') || '',
        token: localStorage.getItem('gh-token') || '',
        sha_expenses: '',
        sha_subs: ''
    }
};

const EXP_FILENAME = 'data.csv';
const SUBS_FILENAME = 'subscriptions.csv';

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
const reloadBtn = document.getElementById('reload-btn');

// Settings & Sub Selectors
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');
const ghUserInp = document.getElementById('gh-user');
const ghRepoInp = document.getElementById('gh-repo');
const ghTokenInp = document.getElementById('gh-token');
const syncStatus = document.getElementById('sync-status');
const syncText = document.getElementById('sync-text');

const subListEl = document.getElementById('sub-list');
const subNameInp = document.getElementById('sub-name');
const subAmountInp = document.getElementById('sub-amount');
const subFreqSel = document.getElementById('sub-freq');
const subDayInp = document.getElementById('sub-day');
const subMonthInp = document.getElementById('sub-month');
const addSubBtn = document.getElementById('add-sub-btn');

// Helper: Format Number
const formatNumber = (num) => new Intl.NumberFormat('ja-JP').format(num);

// Logic: CSV Handling
const jsonToCsv = (data, type) => {
    if (type === 'expenses') {
        const header = 'id,date,description,amount\n';
        return header + data.map(item => `${item.id},${item.date},"${(item.description || '').replace(/"/g, '""')}",${item.amount}`).join('\n');
    } else {
        const header = 'id,name,amount,frequency,day,month\n';
        return header + data.map(item => `${item.id},"${item.name.replace(/"/g, '""')}",${item.amount},${item.frequency},${item.day},${item.month || ''}`).join('\n');
    }
};

const csvToJson = (csv, type) => {
    const lines = csv.trim().split('\n');
    if (lines.length <= 1) return [];

    return lines.slice(1).map(line => {
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!parts) return null;
        if (type === 'expenses') {
            return {
                id: parts[0], date: parts[1],
                description: parts[2].replace(/^"|"$/g, '').replace(/""/g, '"'),
                amount: parseFloat(parts[3])
            };
        } else {
            return {
                id: parts[0], name: parts[1].replace(/^"|"$/g, '').replace(/""/g, '"'),
                amount: parseFloat(parts[2]), frequency: parts[3],
                day: parseInt(parts[4]), month: parts[5] ? parseInt(parts[5]) : null
            };
        }
    }).filter(x => x !== null);
};

// GitHub API Logic
const showSync = (text) => {
    syncText.textContent = text;
    syncStatus.classList.remove('hide');
};
const hideSync = () => syncStatus.classList.add('hide');

const githubFetchFile = async (filename) => {
    const { user, repo, token } = state.github;
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${filename}`;
    const res = await fetch(url, { headers: { 'Authorization': `token ${token}` } });
    if (res.status === 404) return null;
    const json = await res.json();
    const content = decodeURIComponent(escape(atob(json.content)));
    return { sha: json.sha, content: csvToJson(content, filename === EXP_FILENAME ? 'expenses' : 'subs') };
};

const githubFetchAll = async () => {
    if (!state.github.token) return;
    showSync('同期中...');
    try {
        const expData = await githubFetchFile(EXP_FILENAME);
        if (expData) { state.expenses = expData.content; state.github.sha_expenses = expData.sha; }

        const subData = await githubFetchFile(SUBS_FILENAME);
        if (subData) { state.subscriptions = subData.content; state.github.sha_subs = subData.sha; }
    } catch (e) {
        console.error('Fetch error', e);
    } finally {
        hideSync();
        updateUI();
    }
};

const githubPushFile = async (filename, data, type) => {
    const { user, repo, token } = state.github;
    const sha = type === 'expenses' ? state.github.sha_expenses : state.github.sha_subs;
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${filename}`;
    const csv = jsonToCsv(data, type);
    const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: `Update ${filename}`,
            content: btoa(unescape(encodeURIComponent(csv))),
            sha: sha || undefined
        })
    });
    const json = await res.json();
    if (type === 'expenses') state.github.sha_expenses = json.content.sha;
    else state.github.sha_subs = json.content.sha;
};

// Logic: Period & UI
const getPeriodInfo = (date) => {
    const d = new Date(date);
    const day = d.getDate();
    let year = d.getFullYear();
    let month = d.getMonth();
    if (day <= 10) month -= 1;
    const start = new Date(year, month, 11);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 10, 23, 59, 59);
    return { name: `${start.getFullYear()}年${start.getMonth() + 1}月度`, start, end };
};

const updateUI = () => {
    const period = getPeriodInfo(state.viewingDate);
    periodNameEl.textContent = period.name;
    periodDatesEl.textContent = `${period.start.getMonth() + 1}/${period.start.getDate()} ~ ${period.end.getMonth() + 1}/${period.end.getDate()}`;

    // Filter Manual Expenses
    const periodExpenses = state.expenses.filter(exp => {
        const d = new Date(exp.date);
        return d >= period.start && d <= period.end;
    });

    // Calculate Subscriptions for this period
    const activeSubs = state.subscriptions.map(sub => {
        let isActive = false;
        if (sub.frequency === 'monthly') isActive = true;
        else if (sub.frequency === 'yearly') {
            const periodMonths = [];
            let curr = new Date(period.start);
            while (curr <= period.end) {
                periodMonths.push(curr.getMonth() + 1);
                curr.setDate(curr.getDate() + 1);
                if (curr.getDate() === 1) curr.setHours(0, 0, 0, 0);
            }
            if (new Set(periodMonths).has(sub.month)) isActive = true;
        }
        return isActive ? sub : null;
    }).filter(x => x !== null);

    const manualTotal = periodExpenses.reduce((s, e) => s + e.amount, 0);
    const subTotal = activeSubs.reduce((s, e) => s + e.amount, 0);
    monthlyTotalEl.textContent = formatNumber(manualTotal + subTotal);

    // History: Combine Manual + Subs (UI only)
    historyList.innerHTML = '';

    // Add Subs to history display
    activeSubs.forEach(sub => {
        const item = document.createElement('li');
        item.className = 'history-item sub-entry';
        item.style.borderLeft = '4px solid var(--accent-secondary)';
        item.innerHTML = `
            <div class="item-info">
                <span class="item-desc">🔄 ${sub.name}</span>
                <span class="item-date">固定費</span>
            </div>
            <span class="item-amount">¥${formatNumber(sub.amount)}</span>
        `;
        historyList.appendChild(item);
    });

    periodExpenses.slice().reverse().forEach(exp => {
        const item = document.createElement('li');
        item.className = 'history-item';
        const d = new Date(exp.date);
        item.innerHTML = `
            <div class="item-info">
                <span class="item-desc">${exp.description || '出費'}</span>
                <span class="item-date">${d.getMonth() + 1}/${d.getDate()}</span>
            </div>
            <span class="item-amount">¥${formatNumber(exp.amount)}</span>
        `;
        historyList.appendChild(item);
    });

    // Update Sub List in Settings
    subListEl.innerHTML = '';
    state.subscriptions.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'sub-item';
        div.innerHTML = `
            <div class="sub-item-info">
                <span>${sub.name}</span>
                <span class="sub-item-meta">¥${formatNumber(sub.amount)} / ${sub.frequency === 'monthly' ? '月' : sub.month + '月'}</span>
            </div>
            <button class="delete-sub-btn" onclick="deleteSub(${sub.id})">🗑️</button>
        `;
        subListEl.appendChild(div);
    });
};

// App Actions
const addExpense = async () => {
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) return amountInput.focus();
    state.expenses.push({ id: Date.now(), amount, description: descInput.value.trim(), date: new Date().toISOString() });
    state.viewingDate = new Date();
    updateUI();
    amountInput.value = ''; descInput.value = '';
    await githubPushFile(EXP_FILENAME, state.expenses, 'expenses');
};

const addSub = async () => {
    const name = subNameInp.value.trim();
    const amount = parseFloat(subAmountInp.value);
    if (!name || isNaN(amount)) return;
    state.subscriptions.push({
        id: Date.now(), name, amount,
        frequency: subFreqSel.value,
        day: parseInt(subDayInp.value) || 1,
        month: subFreqSel.value === 'yearly' ? parseInt(subMonthInp.value) : null
    });
    updateUI();
    subNameInp.value = ''; subAmountInp.value = '';
    await githubPushFile(SUBS_FILENAME, state.subscriptions, 'subs');
};

window.deleteSub = async (id) => {
    state.subscriptions = state.subscriptions.filter(s => s.id != id);
    updateUI();
    await githubPushFile(SUBS_FILENAME, state.subscriptions, 'subs');
};

// Events
addBtn.addEventListener('click', addExpense);
addSubBtn.addEventListener('click', addSub);
reloadBtn.addEventListener('click', githubFetchAll);
prevBtn.addEventListener('click', () => {
    const p = getPeriodInfo(state.viewingDate);
    const d = new Date(p.start); d.setMonth(d.getMonth() - 1); d.setDate(15);
    state.viewingDate = d; updateUI();
});
nextBtn.addEventListener('click', () => {
    const p = getPeriodInfo(state.viewingDate);
    const d = new Date(p.start); d.setMonth(d.getMonth() + 1); d.setDate(15);
    state.viewingDate = d; updateUI();
});
settingsBtn.addEventListener('click', () => {
    ghUserInp.value = state.github.user; ghRepoInp.value = state.github.repo; ghTokenInp.value = state.github.token;
    settingsModal.classList.remove('hide');
});
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hide'));
saveSettingsBtn.addEventListener('click', async () => {
    state.github.user = ghUserInp.value.trim();
    state.github.repo = ghRepoInp.value.trim();
    state.github.token = ghTokenInp.value.trim();
    localStorage.setItem('gh-user', state.github.user);
    localStorage.setItem('gh-repo', state.github.repo);
    localStorage.setItem('gh-token', state.github.token);
    await githubFetchAll();
});
subFreqSel.addEventListener('change', () => {
    subMonthInp.classList.toggle('hide', subFreqSel.value === 'monthly');
});

// Init
(async () => {
    updateUI();
    if (state.github.token) await githubFetchAll();
    else settingsModal.classList.remove('hide');
})();
