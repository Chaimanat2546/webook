# Booking customer birth dates

The booking customer form uses the existing Input component to accept birthdays as
`DD/MM/BBBB`, where `BBBB` is the Buddhist Era year (for example, `23/09/2535`).
The review screen uses the same display format. This is a text field, not a calendar picker.

The form retains the user's draft across wizard steps and converts it to the existing
Gregorian `YYYY-MM-DD` contract before review and submission. Blank input clears the
optional date. Invalid dates, incomplete input, and future dates prevent review/save;
the form returns to General information with an inline error. Leaving General
information also validates the birthday draft before navigation. Leap days are validated
against the converted Gregorian year. Existing server validation remains unchanged.

Conversion and payload regression tests: `tests/thai-birth-date.test.ts`.
