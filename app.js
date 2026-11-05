"use strict";

const STORAGE_KEY = "mybudget.v1";
const EXPENSE_CATEGORIES = ["Housing", "Food & dining", "Transport", "Shopping", "Health", "Entertainment", "Utilities", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Investment", "Other"];
const CATEGORY_INITIALS = {
  Housing: "H",
  "Food & dining": "F",
  Transport: "T",
  Shopping: "S",
  Health: "H",
  Entertainment: "E",
  Utilities: "U",
  Salary: "S",
  Freelance: "F",
  Investment: "I",
  Other: "O"
};

const currency = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const shortMonthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const today = new Date();
let selectedMonth = toMonthKey(today);
let appData = { transactions: [], budgets: {} };

const elements = {
  todayLabel: document.querySelector("#today-label"),
  selectedMonth: document.querySelector("#selected-month"),
  previousMonth: document.querySelector("#previous-month"),
  nextMonth: document.querySelector("#next-month"),
  notice: document.querySelector("#notice"),
  balanceTotal: document.querySelector("#balance-total"),
  incomeTotal: document.querySelector("#income-total"),
  expenseTotal: document.querySelector("#expense-total"),
  incomeCount: document.querySelector("#income-count"),
  expenseCount: document.querySelector("#expense-count"),
  trendChart: document.querySelector("#trend-chart"),
  transactionList: document.querySelector("#transaction-list"),
  transactionTotal: document.querySelector("#transaction-total"),
  transactionSubtitle: document.querySelector("#transactions-subtitle"),
  transactionForm: document.querySelector("#transaction-form"),
  categorySelect: document.querySelector("#category"),
  transactionDate: document.querySelector("#date"),
  budgetMonthLabel: document.querySelector("#budget-month-label"),
  budgetList: document.querySelector("#budget-list"),
  budgetForm: document.querySelector("#budget-form"),
  budgetCategory: document.querySelector("#budget-category"),
  budgetAmount: document.querySelector("#budget-amount")
};

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateForMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseAmountToCents(value) {
  const amount = String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount)) {
    return null;
  }
  const [whole, fraction = ""] = amount.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return cents > 0n && cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

function formatCents(cents) {
  return currency.format(cents / 100);
}

function isValidMonthKey(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && localDateKey(date) === value;
}

function validateStoredData(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.transactions) || !data.budgets || typeof data.budgets !== "object") {
    throw new Error("Saved data has an unexpected format.");
  }

  const monthlyTotals = new Map();
  for (const transaction of data.transactions) {
    if (
      !transaction ||
      typeof transaction.id !== "string" ||
      !["income", "expense"].includes(transaction.type) ||
      !Number.isSafeInteger(transaction.amount) ||
      transaction.amount <= 0 ||
      !isValidDate(transaction.date) ||
      typeof transaction.category !== "string" ||
      !(transaction.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).includes(transaction.category) ||
      typeof transaction.note !== "string"
    ) {
      throw new Error("A saved transaction is invalid.");
    }
    const month = transaction.date.slice(0, 7);
    const totals = monthlyTotals.get(month) || { income: 0, expense: 0 };
    totals[transaction.type] += transaction.amount;
    if (!Number.isSafeInteger(totals[transaction.type])) {
      throw new Error("A saved monthly total exceeds the supported amount.");
    }
    monthlyTotals.set(month, totals);
  }

  for (const [month, monthBudgets] of Object.entries(data.budgets)) {
    if (!isValidMonthKey(month) || !monthBudgets || typeof monthBudgets !== "object" || Array.isArray(monthBudgets)) {
      throw new Error("A saved budget is invalid.");
    }
    for (const [category, amount] of Object.entries(monthBudgets)) {
      if (!EXPENSE_CATEGORIES.includes(category) || !Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error("A saved budget amount is invalid.");
      }
    }
  }
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return;
    }
    const parsed = JSON.parse(stored);
    validateStoredData(parsed);
    appData = parsed;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The browser storage could not be read.";
    showNotice(`Saved data could not be loaded: ${reason} Your new entries will stay in memory until you refresh.`);
  }
}

function persistData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "browser storage is unavailable.";
    showNotice(`This change could not be saved to this device: ${reason}`);
    return false;
  }
}

function showNotice(message) {
  elements.notice.textContent = message;
  elements.notice.hidden = false;
}

function clearNotice() {
  elements.notice.textContent = "";
  elements.notice.hidden = true;
}

function getMonthTransactions(monthKey) {
  return appData.transactions.filter((transaction) => transaction.date.slice(0, 7) === monthKey);
}

function getMonthTotals(monthKey) {
  const transactions = getMonthTransactions(monthKey);
  return transactions.reduce((totals, transaction) => {
    totals[transaction.type] += transaction.amount;
    return totals;
  }, { income: 0, expense: 0 });
}

function renderSummary() {
  const transactions = getMonthTransactions(selectedMonth);
  const totals = getMonthTotals(selectedMonth);
  elements.balanceTotal.textContent = formatCents(totals.income - totals.expense);
  elements.incomeTotal.textContent = formatCents(totals.income);
  elements.expenseTotal.textContent = formatCents(totals.expense);
  const incomeCount = transactions.filter((transaction) => transaction.type === "income").length;
  const expenseCount = transactions.filter((transaction) => transaction.type === "expense").length;
  elements.incomeCount.textContent = incomeCount === 0 ? "No income recorded yet" : `${incomeCount} ${incomeCount === 1 ? "income entry" : "income entries"}`;
  elements.expenseCount.textContent = expenseCount === 0 ? "No expenses recorded yet" : `${expenseCount} ${expenseCount === 1 ? "expense" : "expenses"} recorded`;
}

function renderTrend() {
  const selectedDate = dateForMonth(selectedMonth);
  const months = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - offset, 1);
    const key = toMonthKey(monthDate);
    months.push({ key, date: monthDate, totals: getMonthTotals(key) });
  }
  const largestValue = Math.max(0, ...months.flatMap((month) => [month.totals.income, month.totals.expense]));

  elements.trendChart.innerHTML = months.map((month) => {
    const incomeHeight = largestValue === 0 ? 0 : (month.totals.income / largestValue) * 100;
    const expenseHeight = largestValue === 0 ? 0 : (month.totals.expense / largestValue) * 100;
    const label = shortMonthFormatter.format(month.date);
    return `<div class="chart-month${month.key === selectedMonth ? " current" : ""}" aria-label="${monthFormatter.format(month.date)}: income ${formatCents(month.totals.income)}, expenses ${formatCents(month.totals.expense)}">
      <div class="chart-bars">
        <span class="chart-bar income-bar" style="height:${incomeHeight}%" title="${label} income: ${formatCents(month.totals.income)}"></span>
        <span class="chart-bar expense-bar" style="height:${expenseHeight}%" title="${label} expenses: ${formatCents(month.totals.expense)}"></span>
      </div>
      <span class="chart-month-label">${label}</span>
    </div>`;
  }).join("");
  elements.trendChart.setAttribute("aria-label", `Monthly income and expense comparison for the six months ending ${monthFormatter.format(selectedDate)}.`);
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function renderTransactions() {
  const transactions = getMonthTransactions(selectedMonth)
    .slice()
    .sort((first, second) => second.date.localeCompare(first.date) || second.id.localeCompare(first.id));
  elements.transactionSubtitle.textContent = `Your activity in ${monthFormatter.format(dateForMonth(selectedMonth))}`;
  elements.transactionTotal.textContent = `${transactions.length} ${transactions.length === 1 ? "entry" : "entries"}`;

  if (transactions.length === 0) {
    elements.transactionList.innerHTML = `<div class="empty-state"><strong>A fresh start.</strong><p>No transactions in this month yet. Add one to begin your story.</p></div>`;
    return;
  }

  elements.transactionList.innerHTML = transactions.map((transaction) => {
    const category = escapeHTML(transaction.category);
    const note = transaction.note.trim() ? ` · ${escapeHTML(transaction.note.trim())}` : "";
    const formattedDate = dateFormatter.format(new Date(`${transaction.date}T00:00:00`));
    const sign = transaction.type === "income" ? "+" : "−";
    return `<div class="transaction-row">
      <span class="category-mark" aria-hidden="true">${CATEGORY_INITIALS[transaction.category] || "•"}</span>
      <div class="transaction-meta">
        <p class="transaction-name">${category}</p>
        <p class="transaction-detail">${formattedDate}${note}</p>
      </div>
      <span class="transaction-amount ${transaction.type}">${sign}${formatCents(transaction.amount)}</span>
      <button class="delete-transaction" type="button" data-delete-id="${escapeHTML(transaction.id)}" aria-label="Delete ${category} transaction for ${formatCents(transaction.amount)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>
      </button>
    </div>`;
  }).join("");
}

function renderBudgets() {
  const monthBudgets = appData.budgets[selectedMonth] || {};
  const budgetEntries = Object.entries(monthBudgets)
    .filter(([, amount]) => Number.isSafeInteger(amount) && amount > 0)
    .sort(([first], [second]) => first.localeCompare(second));
  elements.budgetMonthLabel.textContent = monthFormatter.format(dateForMonth(selectedMonth));

  if (budgetEntries.length === 0) {
    elements.budgetList.innerHTML = `<div class="empty-state"><strong>Make room for what matters.</strong><p>Set a category budget to see how your spending is tracking.</p></div>`;
    return;
  }

  const spentByCategory = new Map();
  for (const transaction of getMonthTransactions(selectedMonth)) {
    if (transaction.type === "expense") {
      spentByCategory.set(transaction.category, (spentByCategory.get(transaction.category) || 0) + transaction.amount);
    }
  }

  elements.budgetList.innerHTML = budgetEntries.map(([category, budget]) => {
    const spent = spentByCategory.get(category) || 0;
    const percent = Math.min(100, Math.round((spent / budget) * 100));
    const overBudget = spent > budget;
    const remaining = Math.max(0, budget - spent);
    const caption = overBudget ? `${formatCents(spent - budget)} over budget` : `${formatCents(remaining)} left`;
    return `<div class="budget-row">
      <div class="budget-row-top">
        <span class="budget-name">${escapeHTML(category)}</span>
        <span class="budget-amount">${formatCents(spent)} <span aria-hidden="true">/</span> ${formatCents(budget)}</span>
      </div>
      <div class="budget-progress" role="progressbar" aria-label="${escapeHTML(category)} budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round((spent / budget) * 100))}">
        <span class="${overBudget ? "over-budget" : ""}" style="width:${percent}%"></span>
      </div>
      <div class="budget-caption"><span>${overBudget ? "Budget exceeded" : "Monthly limit"}</span><span>${caption}</span></div>
    </div>`;
  }).join("");
}

function renderMonth() {
  elements.selectedMonth.textContent = monthFormatter.format(dateForMonth(selectedMonth));
  renderSummary();
  renderTrend();
  renderTransactions();
  renderBudgets();
  populateBudgetForm();
}

function populateTransactionCategories() {
  const type = elements.transactionForm.elements.type.value;
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  elements.categorySelect.innerHTML = categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
}

function populateBudgetForm() {
  const currentValue = elements.budgetCategory.value;
  elements.budgetCategory.innerHTML = EXPENSE_CATEGORIES.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
  const monthBudgets = appData.budgets[selectedMonth] || {};
  const categoriesWithBudgets = Object.keys(monthBudgets);
  const firstUnbudgeted = EXPENSE_CATEGORIES.find((category) => !categoriesWithBudgets.includes(category));
  if (firstUnbudgeted) {
    elements.budgetCategory.value = firstUnbudgeted;
  } else if (EXPENSE_CATEGORIES.includes(currentValue)) {
    elements.budgetCategory.value = currentValue;
  }
  const existingAmount = monthBudgets[elements.budgetCategory.value];
  elements.budgetAmount.value = existingAmount ? (existingAmount / 100).toFixed(2) : "";
}

function updateSelectedMonth(monthOffset) {
  const date = dateForMonth(selectedMonth);
  date.setMonth(date.getMonth() + monthOffset);
  selectedMonth = toMonthKey(date);
  renderMonth();
}

function addTransaction(event) {
  event.preventDefault();
  clearNotice();

  const form = elements.transactionForm;
  const amount = parseAmountToCents(form.elements.amount.value);
  const type = form.elements.type.value;
  const category = form.elements.category.value;
  const date = form.elements.date.value;
  const note = form.elements.note.value.trim();

  if (amount === null) {
    showNotice("Enter an amount greater than $0.00 with no more than two decimal places.");
    form.elements.amount.focus();
    return;
  }
  if (!["income", "expense"].includes(type) || !(type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).includes(category)) {
    showNotice("Choose a valid transaction type and category.");
    return;
  }
  if (!isValidDate(date)) {
    showNotice("Choose a valid transaction date.");
    form.elements.date.focus();
    return;
  }
  const existingTotal = getMonthTotals(date.slice(0, 7))[type];
  if (!Number.isSafeInteger(existingTotal + amount)) {
    showNotice("This transaction would exceed the largest safely supported monthly total.");
    form.elements.amount.focus();
    return;
  }

  appData.transactions.push({
    id: crypto.randomUUID(),
    type,
    amount,
    date,
    category,
    note
  });
  persistData();
  selectedMonth = date.slice(0, 7);
  form.elements.amount.value = "";
  form.elements.note.value = "";
  renderMonth();
}

function addBudget(event) {
  event.preventDefault();
  clearNotice();

  const category = elements.budgetCategory.value;
  const amount = parseAmountToCents(elements.budgetAmount.value);
  if (!EXPENSE_CATEGORIES.includes(category) || amount === null) {
    showNotice("Choose an expense category and enter a budget greater than $0.00.");
    elements.budgetAmount.focus();
    return;
  }

  if (!appData.budgets[selectedMonth]) {
    appData.budgets[selectedMonth] = {};
  }
  appData.budgets[selectedMonth][category] = amount;
  persistData();
  renderMonth();
}

function deleteTransaction(id) {
  const transactionIndex = appData.transactions.findIndex((transaction) => transaction.id === id);
  if (transactionIndex === -1) {
    showNotice("That transaction could not be found. Refresh the page and try again.");
    return;
  }
  appData.transactions.splice(transactionIndex, 1);
  persistData();
  renderMonth();
}

function updateTypeSelection() {
  const selectedType = elements.transactionForm.elements.type.value;
  document.querySelectorAll(".type-option").forEach((option) => {
    option.classList.toggle("selected", option.dataset.type === selectedType);
  });
  populateTransactionCategories();
}

function initialize() {
  loadData();
  elements.todayLabel.textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(today);
  elements.transactionDate.value = localDateKey(today);
  populateTransactionCategories();
  renderMonth();

  elements.previousMonth.addEventListener("click", () => updateSelectedMonth(-1));
  elements.nextMonth.addEventListener("click", () => updateSelectedMonth(1));
  elements.transactionForm.addEventListener("submit", addTransaction);
  elements.budgetForm.addEventListener("submit", addBudget);
  elements.transactionForm.querySelectorAll('input[name="type"]').forEach((input) => {
    input.addEventListener("change", updateTypeSelection);
  });
  elements.transactionList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest("[data-delete-id]");
    if (button instanceof HTMLButtonElement) {
      deleteTransaction(button.dataset.deleteId);
    }
  });
  elements.budgetCategory.addEventListener("change", () => {
    const amount = (appData.budgets[selectedMonth] || {})[elements.budgetCategory.value];
    elements.budgetAmount.value = amount ? (amount / 100).toFixed(2) : "";
  });
}

initialize();
