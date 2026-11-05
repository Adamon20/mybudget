# MyBudget

MyBudget is a personal budget tracking app intended to help me understand my finances, manage spending, and stay within my budget.

## App purpose

The app should provide a clear overview of money coming in, money going out, and how much remains available to spend or save.

## Intended core features

- Record income and expenses with an amount, date, category, and optional note.
- Organize transactions into useful spending categories.
- Set monthly budgets and compare actual spending with those budgets.
- Show total income, total expenses, and the remaining monthly balance.
- Review transaction history and spending trends over time.

## Product principles

- Keep everyday budget tracking simple and quick.
- Present financial information clearly and consistently.
- Handle monetary values accurately.
- Treat personal financial data as private.

## Guidance for contributors and coding agents

The app is a dependency-free browser application. Transactions and monthly category budgets are stored locally in the user's browser; do not introduce a remote data service without an explicit product decision.

Keep changes focused on MyBudget's purpose as a personal budget tracker. Handle monetary values as integer cents, keep personal financial data private, and update this description when the app's behavior or scope changes.
