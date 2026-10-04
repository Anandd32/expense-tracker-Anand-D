# Expense Tracker

A simple, responsive expense tracker built with plain HTML, CSS and JavaScript. No frameworks, no build step, no dependencies.

## How to run

1. Clone or download this repository.
2. Open `index.html` in any modern browser (double-click it, or right-click → Open with).

Optional: serve it locally with `npx serve` or `python3 -m http.server`, then open the printed address.

## Features

- Add income or expense transactions with amount, category, date and description
- Edit and delete transactions (delete asks for confirmation)
- Live totals: income, expenses and current balance
- Filter by type (income / expense) and by category
- Data saved in browser Local Storage, so it persists after a refresh
- Responsive layout for desktop and mobile
- **Bonus:** monthly summary with a month picker
- **Bonus:** category-wise expense chart for the selected month
- **Bonus:** form validation with inline error messages

## Validation rules

- Amount: required, greater than 0, at most 2 decimal places
- Category: required (list changes with Income / Expense)
- Date: required and valid
- Description: required, up to 80 characters

## Project structure

```
index.html   page structure
style.css    styles and responsive rules
script.js    app logic, Local Storage, rendering
README.md    this file
```

## Notes

- Amounts are shown in Indian Rupees (₹). To change the currency, edit the `Intl.NumberFormat` line in `script.js`.
- Data lives only in the current browser. Clearing site data removes it.
- User-entered text is escaped before rendering to prevent HTML injection.
