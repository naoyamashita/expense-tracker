// State Management
const state = {
    expenses: JSON.parse(localStorage.getItem('expenses')) || [],
    viewingDate: new Date(), // Date used to determine the visible period
};

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

// Helper: Format Number
const formatNumber = (num) => {
    return new Intl.NumberFormat('ja-JP').format(num);
};

/**
 * Logic: Get Period Info
 * Closing date is 10th. 
 * Period for Date(Y, M, D):
 * If D <= 10: Period is (Y, M) [Start: (Y, M-1, 11), End: (Y, M, 10)]
 * If D > 10: Period is (Y, M+1) [Start: (Y, M, 11), End: (Y, M+1, 10)]
 */
const getPeriodInfo = (date) => {
    const d = new Date(date);
    const day = d.getDate();
    let year = d.getFullYear();
    let month = d.getMonth(); // 0-indexed

    if (day <= 10) {
        month -= 1;
    }

    // Normalize year/month
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

    // Update labels
    periodNameEl.textContent = period.name;
    periodDatesEl.textContent = `${period.start.getMonth() + 1}/${period.start.getDate()} ~ ${period.end.getMonth() + 1}/${period.end.getDate()}`;

    // Filter expenses for this period
    const periodExpenses = state.expenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= period.start && expDate <= period.end;
    });

    const total = periodExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    monthlyTotalEl.textContent = formatNumber(total);

    // Render History
    historyList.innerHTML = '';
    periodExpenses.slice().reverse().forEach((exp) => {
        const item = document.createElement('li');
        item.className = 'history-item';

        const dateObj = new Date(exp.date);
        const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

        item.innerHTML = `
            <div class="item-info">
                <span class="item-desc">${exp.description || '出費'}</span>
                <span class="item-date">${dateStr}</span>
            </div>
            <span class="item-amount">¥${formatNumber(exp.amount)}</span>
        `;
        historyList.appendChild(item);
    });

    // Save to LocalStorage
    localStorage.setItem('expenses', JSON.stringify(state.expenses));
};

// Event: Add Expense
const addExpense = () => {
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

    // When adding, usually want to see the period of the newly added expense (current date)
    state.viewingDate = new Date();

    updateUI();

    // Clear Inputs
    amountInput.value = '';
    descInput.value = '';
    amountInput.focus();
};

// Event: Navigate Periods
const changePeriod = (direction) => {
    const currentPeriod = getPeriodInfo(state.viewingDate);
    const newDate = new Date(currentPeriod.start);

    if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
    } else {
        newDate.setMonth(newDate.getMonth() + 1);
    }

    // Ensure we are in the middle of the new period to avoid edge cases
    newDate.setDate(15);
    state.viewingDate = newDate;
    updateUI();
};

// Event Listeners
addBtn.addEventListener('click', addExpense);
prevBtn.addEventListener('click', () => changePeriod('prev'));
nextBtn.addEventListener('click', () => changePeriod('next'));

amountInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') descInput.focus();
});
descInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addExpense();
});

// Initialize
updateUI();
